import type { LlmConfiguration } from '../../../shared/schema';
import { LLMService } from '../../../server/llm-service';

export interface ParityCheck {
  status: 'pass' | 'fail' | 'warning';
  summary: string;
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
    details?: any;
  }[];
  inconsistencies: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    affectedItems: string[];
    suggestedFix: string;
  }[];
  recommendations: string[];
}

export interface ParityInput {
  type: 'workflow' | 'pipeline' | 'data';
  data: any;
  referenceData?: any; // Data to compare against
  rules?: string[]; // Custom parity rules
}

/**
 * Parity AI Agent
 * Checks data consistency, balance, and validates against rules
 * Can operate in two modes:
 * 1. Structured validation: Pass ParityInput object for detailed data validation
 * 2. Conversational: Pass string for Q&A about data validation and document analysis
 */
export class ParityAgent {
  private llmService: LLMService;
  
  constructor(llmConfig: LlmConfiguration) {
    this.llmService = new LLMService(llmConfig);
  }
  
  async execute(input: ParityInput | string): Promise<ParityCheck | string> {
    // Handle conversational mode (string input)
    if (typeof input === 'string') {
      return this.executeConversational(input);
    }
    
    // Handle structured validation mode
    return this.executeValidation(input);
  }
  
  private async executeConversational(userMessage: string): Promise<string> {
    const systemPrompt = `You are Parity, an expert AI assistant specializing in document validation, data consistency, and accounting compliance.

Your expertise includes:
- Document analysis and validation
- Financial data consistency checks
- Engagement letter preparation
- Compliance verification
- Data parity checks across accounting systems

Be helpful, professional, and provide actionable guidance. If the user asks about creating documents or validating data, guide them through the process and explain what information you need.`;

    try {
      const response = await this.llmService.sendPrompt(userMessage, systemPrompt);
      return response;
    } catch (error) {
      console.error('Parity conversational mode failed:', error);
      return 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.';
    }
  }
  
  private async executeValidation(input: ParityInput): Promise<ParityCheck> {
    const systemPrompt = `You are an expert data validation AI specialized in checking consistency, balance, and parity.
Your task is to analyze data and identify inconsistencies, imbalances, or rule violations.

Focus on:
1. Data consistency across related entities
2. Balance verification (e.g., financial totals, task assignments)
3. Structural integrity
4. Rule compliance

Always return valid JSON in this exact format:
{
  "status": "pass|fail|warning",
  "summary": "Overall assessment",
  "checks": [
    {
      "name": "Check name",
      "status": "pass|fail|warning",
      "message": "Check result message",
      "details": {}
    }
  ],
  "inconsistencies": [
    {
      "type": "Type of inconsistency",
      "severity": "low|medium|high|critical",
      "description": "Description of the issue",
      "affectedItems": ["item1", "item2"],
      "suggestedFix": "How to fix this"
    }
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`;

    const userPrompt = `Perform a parity check on this ${input.type} data:

Data to Validate:
${JSON.stringify(input.data, null, 2)}

${input.referenceData ? `Reference Data:\n${JSON.stringify(input.referenceData, null, 2)}` : ''}

${input.rules ? `Validation Rules:\n${input.rules.join('\n')}` : ''}

Check for inconsistencies, imbalances, and violations. Provide detailed analysis.`;

    try {
      const response = await this.llmService.sendPrompt(userPrompt, systemPrompt);
      
      // Parse the AI response
      let jsonStr = response.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }
      
      const parityCheck = JSON.parse(jsonStr);
      return parityCheck;
    } catch (error) {
      console.error('Parity Agent execution failed:', error);
      return {
        status: 'warning',
        summary: 'Parity check failed. Please check your LLM configuration.',
        checks: [],
        inconsistencies: [],
        recommendations: ['Verify LLM configuration and try again']
      };
    }
  }
}
