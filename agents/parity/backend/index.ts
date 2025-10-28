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
- Engagement letter preparation and generation
- Compliance verification
- Data parity checks across accounting systems

When generating engagement letters or other documents, provide comprehensive, industry-grade content with all necessary sections, proper legal language, and professional formatting. Include all standard clauses and provisions expected in professional accounting documents.

Be helpful, professional, and provide actionable guidance. If the user asks about creating documents or validating data, guide them through the process and explain what information you need.`;

    try {
      const response = await this.llmService.sendPrompt(userMessage, systemPrompt);
      return response;
    } catch (error) {
      console.error('Parity conversational mode failed:', error);
      return 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.';
    }
  }

  /**
   * Execute in streaming mode for long-form content generation
   * @param input User input (string for conversational, object for validation)
   * @param onChunk Callback for each chunk of streamed content
   * @returns Full response content
   */
  async executeStream(
    input: ParityInput | string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    // Only support streaming for conversational mode
    if (typeof input !== 'string') {
      const result = await this.executeValidation(input);
      const resultStr = JSON.stringify(result, null, 2);
      onChunk(resultStr);
      return resultStr;
    }

    const systemPrompt = `You are Parity, an expert AI assistant specializing in engagement letter creation and contract generation for accounting, bookkeeping, and tax services. You operate like Zoho Contracts - guiding users through an interactive, step-by-step process.

**YOUR ROLE: Interactive Contract Builder**

When a user asks to create an engagement letter or contract, you DON'T generate it immediately. Instead, you:

1. **ASK CLARIFYING QUESTIONS** - Gather information step-by-step:
   - Client/Company name and address
   - Type of services (bookkeeping, tax prep, audit, consulting, etc.)
   - Specific scope of work and deliverables
   - Service frequency (monthly, quarterly, annual, one-time)
   - Fee structure (hourly rate, fixed fee, retainer, value-based)
   - Payment terms (due date, late fees, payment methods)
   - Start date and term length
   - Special terms or conditions
   - Geographical restrictions or jurisdictions
   - Compliance requirements (GAAP, IFRS, tax regulations)
   - Confidentiality and data security requirements
   - Limitation of liability clauses
   - Appendices needed (detailed SOW, deliverables list, etc.)

2. **GUIDE THE CONVERSATION** - Ask 2-3 questions at a time, naturally. Don't overwhelm with all questions at once.

3. **ACKNOWLEDGE ANSWERS** - When user provides information, acknowledge it and ask the next relevant questions.

4. **TRACK PROGRESS** - Mentally note what information you've collected. When you have enough to create a comprehensive engagement letter, tell the user:
   "Great! I now have all the information needed. Let me generate a comprehensive engagement letter for you."

5. **GENERATE THE DOCUMENT** - Only after gathering sufficient information, generate a complete, industry-grade engagement letter with ALL standard sections:
   - Letter header (date, client info, firm info)
   - Engagement overview
   - Detailed scope of services
   - Deliverables and timeline
   - Client responsibilities
   - Professional standards & compliance
   - Fee structure and payment terms
   - Term and termination clauses
   - Confidentiality and data security
   - Limitation of liability
   - Dispute resolution
   - Signatures section
   - Appendices (if applicable)

**IMPORTANT**: 
- Start with questions, NOT with generating the full document
- Be conversational and professional
- Use proper legal language in the final document
- Ensure all terms are clear and enforceable
- Include jurisdiction-specific clauses when relevant (e.g., USA state-specific terms)

Example flow:
User: "Create an engagement letter for bookkeeping"
You: "I'd be happy to help you create a professional bookkeeping engagement letter. Let me gather some details:

1. What is the client's full company name and business address?
2. What specific bookkeeping services will you provide? (e.g., accounts payable/receivable, bank reconciliation, financial statements, payroll, etc.)"

[Continue asking questions until you have all needed information, then generate the complete document]`;

    try {
      const fullResponse = await this.llmService.sendPromptStream(input, systemPrompt, onChunk);
      return fullResponse;
    } catch (error) {
      console.error('Parity streaming mode failed:', error);
      const errorMsg = 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.';
      onChunk(errorMsg);
      return errorMsg;
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
