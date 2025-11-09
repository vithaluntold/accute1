import type { LlmConfiguration } from '../../../shared/schema';
import { LLMService } from '../../../server/llm-service';
import { retrieveRelevantContext, extractFieldTypeRecommendations, type RetrievalContext } from '../retrieval-service';
import { executeFormaTool, getFormaToolsForLLM } from '../tools';

export interface FormatResult {
  success: boolean;
  formattedData: any;
  validationResults: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  transformations: {
    field: string;
    original: any;
    formatted: any;
    action: string;
  }[];
  suggestions: string[];
  reasoning?: string;
}

export interface FormaInput {
  data?: any;
  targetFormat?: 'json' | 'csv' | 'xml' | 'accounting' | 'custom';
  formatRules?: string[];
  validationRules?: string[];
  organizationContext?: {
    industry?: string;
    name?: string;
  };
}

/**
 * Forma AI Agent - RAG-Enhanced Intelligent Form Builder
 * Uses retrieval-augmented generation with field catalog and exemplars
 */
export class FormaAgent {
  private llmService: LLMService;
  private organizationContext?: { industry?: string; name?: string };
  
  constructor(llmConfig: LlmConfiguration, organizationContext?: { industry?: string; name?: string }) {
    this.llmService = new LLMService(llmConfig);
    this.organizationContext = organizationContext;
  }
  
  async execute(input: FormaInput | string): Promise<FormatResult> {
    // Handle string input for conversational mode
    if (typeof input === 'string') {
      return this.executeConversational(input);
    }
    
    // Merge organization context
    if (input.organizationContext) {
      this.organizationContext = input.organizationContext;
    }
    
    // Handle structured input
    return this.executeStructured(input);
  }
  
  private async executeConversational(message: string): Promise<FormatResult> {
    // STEP 1: Analyze query and pre-execute relevant tool calls for comprehensive context
    const toolResults = await this.preExecuteRelevantTools(message);
    
    // STEP 2: Retrieve relevant context from field catalog and exemplars
    const retrievalContext: RetrievalContext = {
      userQuery: message,
      organizationIndustry: this.organizationContext?.industry,
      organizationContext: this.organizationContext?.name
    };
    
    const retrievedContext = retrieveRelevantContext(retrievalContext);
    const fieldRecommendations = extractFieldTypeRecommendations(retrievedContext);
    
    // STEP 3: Build reasoning-based system prompt with retrieved context + tool results
    const systemPrompt = this.buildReasoningPrompt(retrievedContext, fieldRecommendations, toolResults);
    
    // STEP 4: Send to LLM for intelligent reasoning
    try {
      const response = await this.llmService.sendPrompt(message, systemPrompt);
      
      let jsonStr = response.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }
      
      const formatResult = JSON.parse(jsonStr);
      
      // STEP 5: Add self-critique reasoning
      if (formatResult.formattedData?.fields) {
        formatResult.reasoning = this.generateFieldReasoningExplanation(formatResult.formattedData.fields);
      }
      
      return formatResult;
    } catch (error) {
      console.error('Forma conversational mode failed:', error);
      return {
        success: true,
        formattedData: {
          formName: 'New Form',
          fields: []
        },
        validationResults: {
          isValid: true,
          errors: [],
          warnings: ['Describe the form you need and I\'ll help build it']
        },
        transformations: [],
        suggestions: ['Tell me what data you need to collect', 'Describe the purpose of this form', 'What fields should it have?']
      };
    }
  }
  
  /**
   * Pre-execute relevant tools based on intelligent query analysis
   * This provides context-enrichment without requiring LLM function calling infrastructure
   */
  private async preExecuteRelevantTools(query: string): Promise<string> {
    const lowerQuery = query.toLowerCase();
    const toolOutputs: Map<string, any> = new Map(); // Deduplicate results
    
    // Always search field catalog for form-building queries
    try {
      const catalogResult = executeFormaTool('search_field_catalog', { 
        query: query,
        industry: this.organizationContext?.industry 
      });
      
      // Only include if we got useful results
      if (catalogResult.relevantFieldTypes?.length > 0 || catalogResult.exampleFields?.length > 0) {
        toolOutputs.set('catalog_search', {
          type: 'Catalog Search',
          data: {
            topFieldTypes: catalogResult.relevantFieldTypes?.slice(0, 3),
            exampleFields: catalogResult.exampleFields?.slice(0, 3)
          }
        });
      }
    } catch (error) {
      console.error('Field catalog search failed:', error);
    }
    
    // Industry-specific exemplars if applicable
    if (this.organizationContext?.industry) {
      try {
        const industryResult = executeFormaTool('get_industry_exemplars', { 
          industry: this.organizationContext.industry 
        });
        if (industryResult.exemplarCount > 0) {
          toolOutputs.set('industry_exemplars', {
            type: 'Industry Examples',
            data: {
              industry: this.organizationContext.industry,
              examples: industryResult.exemplars?.slice(0, 2).map((ex: any) => ({
                name: ex.name,
                keyDecisions: ex.keyDecisions?.slice(0, 3),
                sampleFields: ex.sampleFields?.slice(0, 3)
              }))
            }
          });
        }
      } catch (error) {
        console.error('Industry exemplars fetch failed:', error);
      }
    }
    
    // Format tool outputs concisely
    if (toolOutputs.size === 0) {
      return '';
    }
    
    const formattedOutputs = Array.from(toolOutputs.values()).map(output => {
      return `\n**${output.type}**:\n${JSON.stringify(output.data, null, 2)}`;
    });
    
    return `\n\n=== Context from Knowledge Base ===\n${formattedOutputs.join('\n')}\n=== End Context ===\n`;
  }
  
  /**
   * Build reasoning-based prompt with retrieved context and tool results
   */
  private buildReasoningPrompt(retrievedContext: any, fieldRecommendations: string, toolResults?: string): string {
    return `You are Forma, an intelligent form building assistant with expertise in user experience and data collection design.

## STRICT ROLE BOUNDARIES - CRITICAL

**YOU MUST ONLY ANSWER QUESTIONS WITHIN YOUR DOMAIN OF EXPERTISE:**

✅ **Allowed Topics:**
- Form creation, design, and optimization
- Field type selection and configuration
- User experience for data collection
- Form validation and logic
- Conditional field display
- Field layout and organization
- Form templates and best practices

❌ **Prohibited Topics - REFUSE POLITELY:**
- Accounting or tax advice (refer to Luca)
- Workflow automation (refer to Cadence)
- Message templates (refer to Echo)
- Legal documents (refer to Parity)
- Email templates (refer to Scribe)
- General advice unrelated to forms

**When You Receive an Out-of-Scope Question:**
"I appreciate your question, but as a form building specialist within the Accute platform, I'm specifically designed to help with form creation, field design, and data collection optimization. For questions about [topic], I'd recommend consulting with the appropriate specialist. Is there anything related to form building that I can help you with instead?"

${toolResults || ''}

Your approach to form building:
1. **Understand Intent**: Analyze what data the user needs to collect and why
2. **Infer Semantics**: Determine the nature and type of each data point
3. **Select Best Fit**: Choose field types that match data semantics and optimize user experience
4. **Validate UX**: Ensure the form is intuitive, accessible, and minimizes user error

${this.organizationContext ? `Organization Context:
- Organization: ${this.organizationContext.name || 'Unknown'}
- Industry: ${this.organizationContext.industry || 'General'}
` : ''}

${retrievedContext.semanticGuidance}

${fieldRecommendations}

Key Principles:
- Match field types to data semantics (use email fields for emails, currency for money, etc.)
- Use dropdowns (select) when there's a single choice from predefined options
- Use multi-select when users may choose multiple items from a list
- Use radio buttons when you want all options visible immediately (best for 2-5 mutually exclusive choices)
- Use text areas for multi-line content, not single-line inputs
- Consider mobile UX - appropriate keyboards and input methods
- Prioritize data quality through appropriate field types and validation

When building forms, reason through:
1. What is the purpose of each field?
2. What type of data does it collect?
3. How will users interact with it?
4. What field type best serves these needs?

Always return valid JSON in this exact format:
{
  "success": true,
  "formattedData": {
    "formName": "Name of the form",
    "fields": [
      {
        "name": "field_name",
        "label": "Field Label",
        "type": "select|multi_select|radio|text|email|number|currency|date|etc",
        "options": ["Option 1", "Option 2"],
        "required": true/false,
        "validation": "validation rules if any"
      }
    ]
  },
  "validationResults": {
    "isValid": true,
    "errors": [],
    "warnings": []
  },
  "transformations": [],
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}`;
  }
  
  /**
   * Generate explanation of field type choices
   */
  private generateFieldReasoningExplanation(fields: any[]): string {
    const explanations = fields.slice(0, 5).map(field => {
      return `- "${field.label}" (${field.type}): Chosen for ${this.explainFieldTypeChoice(field.type, field.label)}`;
    });
    
    return `Field Type Decisions:\n${explanations.join('\n')}`;
  }
  
  /**
   * Explain why a field type was chosen
   */
  private explainFieldTypeChoice(type: string, label: string): string {
    const explanations: Record<string, string> = {
      'select': 'single selection from predefined options',
      'multi_select': 'allowing multiple selections from a list',
      'radio': 'mutually exclusive choices with immediate visibility',
      'checkbox': 'independent yes/no options',
      'text': 'short freeform text entry',
      'textarea': 'multi-line detailed responses',
      'email': 'email validation and mobile keyboard optimization',
      'phone': 'phone number formatting and numeric keyboard',
      'number': 'whole number input',
      'currency': 'monetary values with proper formatting',
      'date': 'date selection with calendar picker',
      'signature': 'legal signature capture',
      'file_upload': 'document or file submission'
    };
    
    return explanations[type] || 'appropriate data semantics';
  }
  
  private async executeStructured(input: FormaInput): Promise<FormatResult> {
    const systemPrompt = `You are an expert data formatting and validation AI.
Your task is to format data according to specifications and validate it against rules.

Focus on:
1. Proper data formatting and standardization
2. Validation against rules
3. Data transformation and cleaning
4. Ensuring consistency and quality

Always return valid JSON in this exact format:
{
  "success": true/false,
  "formattedData": {}, // The properly formatted data
  "validationResults": {
    "isValid": true/false,
    "errors": ["Error 1", "Error 2"],
    "warnings": ["Warning 1", "Warning 2"]
  },
  "transformations": [
    {
      "field": "fieldName",
      "original": "original value",
      "formatted": "formatted value",
      "action": "Description of what was done"
    }
  ],
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}`;

    const userPrompt = `Format and validate this data:

Input Data:
${JSON.stringify(input.data, null, 2)}

Target Format: ${input.targetFormat}

${input.formatRules ? `Format Rules:\n${input.formatRules.join('\n')}` : ''}

${input.validationRules ? `Validation Rules:\n${input.validationRules.join('\n')}` : ''}

Format the data properly, validate it, and provide detailed transformation information.`;

    try {
      const response = await this.llmService.sendPrompt(userPrompt, systemPrompt);
      
      // Parse the AI response
      let jsonStr = response.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }
      
      const formatResult = JSON.parse(jsonStr);
      return formatResult;
    } catch (error) {
      console.error('Forma Agent execution failed:', error);
      return {
        success: false,
        formattedData: input.data,
        validationResults: {
          isValid: false,
          errors: ['Formatting failed. Please check your LLM configuration.'],
          warnings: []
        },
        transformations: [],
        suggestions: ['Verify LLM configuration and try again']
      };
    }
  }

  /**
   * Execute in streaming mode for real-time responses with RAG
   */
  async executeStream(input: FormaInput | string, onChunk: (chunk: string) => void): Promise<string> {
    // Handle string input for conversational streaming
    if (typeof input === 'string') {
      // STEP 1: Retrieve relevant context
      const retrievalContext: RetrievalContext = {
        userQuery: input,
        organizationIndustry: this.organizationContext?.industry,
        organizationContext: this.organizationContext?.name
      };
      
      const retrievedContext = retrieveRelevantContext(retrievalContext);
      const fieldRecommendations = extractFieldTypeRecommendations(retrievedContext);
      
      // STEP 2: Build reasoning prompt with retrieved context
      const systemPrompt = `You are Forma, an intelligent form building assistant with expertise in user experience and data collection design.

## STRICT ROLE BOUNDARIES - CRITICAL

**YOU MUST ONLY ANSWER QUESTIONS WITHIN YOUR DOMAIN OF EXPERTISE:**

✅ **Allowed Topics:**
- Form creation, design, and optimization
- Field type selection and configuration
- User experience for data collection
- Form validation and logic
- Conditional field display
- Field layout and organization
- Form templates and best practices

❌ **Prohibited Topics - REFUSE POLITELY:**
- Accounting or tax advice (refer to Luca)
- Workflow automation (refer to Cadence)
- Message templates (refer to Echo)
- Legal documents (refer to Parity)
- Email templates (refer to Scribe)
- General advice unrelated to forms

**When You Receive an Out-of-Scope Question:**
"I appreciate your question, but as a form building specialist within the Accute platform, I'm specifically designed to help with form creation, field design, and data collection optimization. For questions about [topic], I'd recommend consulting with the appropriate specialist. Is there anything related to form building that I can help you with instead?"

Your approach to form building:
1. **Understand Intent**: Analyze what data the user needs to collect and why
2. **Infer Semantics**: Determine the nature and type of each data point
3. **Select Best Fit**: Choose field types that match data semantics and optimize user experience
4. **Validate UX**: Ensure the form is intuitive, accessible, and minimizes user error

${this.organizationContext ? `Organization Context:
- Organization: ${this.organizationContext.name || 'Unknown'}
- Industry: ${this.organizationContext.industry || 'General'}
` : ''}

${retrievedContext.semanticGuidance}

${fieldRecommendations}

Key Principles:
- Match field types to data semantics (email for emails, currency for money, select for single choices, multi_select for multiple choices)
- Use radio buttons when all options should be visible (2-5 mutually exclusive choices)
- Use text areas for multi-line content, not single-line inputs
- Consider mobile UX and data quality

Provide clear, actionable advice. Be conversational and helpful. Explain your reasoning when suggesting field types.`;

      try {
        const response = await this.llmService.sendPromptStream(input, systemPrompt, onChunk);
        return response;
      } catch (error) {
        console.error('Forma streaming failed:', error);
        const errorMsg = 'I can help you build forms. What data do you need to collect?';
        onChunk(errorMsg);
        return errorMsg;
      }
    }
    
    // Handle structured input
    const result = await this.execute(input);
    const resultStr = JSON.stringify(result, null, 2);
    onChunk(resultStr);
    return resultStr;
  }
}

export { registerRoutes } from './handler';
