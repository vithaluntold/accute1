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
  data: any;
  targetFormat: 'json' | 'csv' | 'xml' | 'accounting' | 'custom';
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
  
  async execute(input: FormaInput): Promise<FormatResult> {
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
   * Execute in streaming mode (streams JSON result in one chunk)
   */
  async executeStream(input: FormaInput, onChunk: (chunk: string) => void): Promise<string> {
    const result = await this.execute(input);
    const resultStr = JSON.stringify(result, null, 2);
    onChunk(resultStr);
    return resultStr;
  }
}
