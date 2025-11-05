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

FIELD TYPE SELECTION RULES - CRITICAL:
Choose the MOST APPROPRIATE field type based on the data being collected:

**Single Choice Questions:**
- Single choice from a list → "select" (dropdown)
- Yes/No → "radio" with options ["Yes", "No"]
- Yes/No/NA → "radio" with options ["Yes", "No", "N/A"]
- True/False → "radio" with options ["True", "False"]
- Rating scale → "rating" or "slider"

**Multiple Choice Questions:**
- Multiple selections from a list → "multi_select" (dropdown with checkboxes)
- Multiple checkboxes → "checkbox" with options array

**Text Input:**
- Short text (name, title) → "text"
- Long text (description, comments) → "textarea"
- Email address → "email"
- Phone number → "phone"
- Website URL → "url"

**Numbers & Currency:**
- Whole numbers → "number"
- Decimal numbers → "decimal"
- Money amounts → "currency"
- Percentages → "percentage"

**Date & Time:**
- Date only → "date"
- Time only → "time"
- Date and time → "datetime"

**Composite Fields:**
- Full name with title/first/middle/last → "name"
- Full address with street/city/state/zip → "address"

**Special Fields:**
- File upload → "file_upload"
- Signature capture → "signature"
- Image selection → "image_choice"
- Matrix/grid questions → "matrix_choice"
- Audio recording → "audio"
- Video recording → "video"
- Camera photo → "camera"

**Calculated/Auto Fields:**
- Auto-calculated based on formula → "formula"
- Auto-incrementing ID → "unique_id"
- Random ID → "random_id"

**Structural Elements:**
- Section heading → "heading"
- Visual separator → "divider"
- Multi-page separator → "page_break"
- Terms & conditions → "terms"
- Custom HTML → "html"

IMPORTANT: 
- For lists with single selection, ALWAYS use "select" type
- For lists with multiple selections, ALWAYS use "multi_select" type
- For Yes/No/NA questions, ALWAYS use "radio" type
- Never default to "text" when a more specific type exists

Always return valid JSON in this exact format:
{
  "success": true,
  "formattedData": {
    "formName": "Name of the form",
    "fields": [
      {
        "name": "field_name",
        "label": "Field Label",
        "type": "select|multi_select|radio|text|email|number|...",
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

CRITICAL FIELD TYPE SELECTION RULES:
- Single choice from list → "select" (dropdown)
- Multiple choices from list → "multi_select" (dropdown with checkboxes)
- Yes/No → "radio" with 2 options
- Yes/No/NA → "radio" with 3 options
- Short text → "text"
- Long text → "textarea"
- Email → "email"
- Phone → "phone"
- Numbers → "number", "decimal", or "currency"
- Date/Time → "date", "time", or "datetime"
- Ratings → "rating" or "slider"

Never default to text fields when a more specific type exists!

Provide clear, actionable advice about:
- Form structure and appropriate field types
- Validation rules
- User experience best practices
- Data collection strategies

Be conversational and helpful. Always suggest the MOST APPROPRIATE field type for each piece of data.`;

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
