import type { LlmConfiguration } from '../../../shared/schema';
import { LLMService } from '../../../server/llm-service';

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
}

export interface FormaInput {
  data?: any;
  targetFormat?: 'json' | 'csv' | 'xml' | 'accounting' | 'custom';
  formatRules?: string[];
  validationRules?: string[];
}

/**
 * Forma AI Agent
 * Formats and validates documents and data according to specified rules
 */
export class FormaAgent {
  private llmService: LLMService;
  
  constructor(llmConfig: LlmConfiguration) {
    this.llmService = new LLMService(llmConfig);
  }
  
  async execute(input: FormaInput | string): Promise<FormatResult> {
    // Handle string input for conversational mode
    if (typeof input === 'string') {
      return this.executeConversational(input);
    }
    
    // Handle structured input
    return this.executeStructured(input);
  }
  
  private async executeConversational(message: string): Promise<FormatResult> {
    const systemPrompt = `You are Forma, an intelligent form building assistant. Help users create forms through natural conversation.

When building forms:
1. Ask clarifying questions about what data to collect
2. Suggest appropriate field types
3. Recommend validation rules
4. Help structure the form logically

Always return valid JSON in this exact format:
{
  "success": true,
  "formattedData": {
    "formName": "Name of the form",
    "fields": [
      {
        "name": "field_name",
        "label": "Field Label",
        "type": "text|email|number|select|checkbox|date",
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

    try {
      const response = await this.llmService.sendPrompt(message, systemPrompt);
      
      let jsonStr = response.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }
      
      const formatResult = JSON.parse(jsonStr);
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
   * Execute in streaming mode for real-time responses
   */
  async executeStream(input: FormaInput | string, onChunk: (chunk: string) => void): Promise<string> {
    // Handle string input for conversational streaming
    if (typeof input === 'string') {
      const systemPrompt = `You are Forma, an intelligent form building assistant. Help users create forms through natural conversation.

Provide clear, actionable advice about:
- Form structure and field types
- Validation rules
- User experience best practices
- Data collection strategies

Be conversational and helpful.`;

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
