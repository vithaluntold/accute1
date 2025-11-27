/**
 * Onboard AI Agent - Jurisdiction-Aware Employee Onboarding Assistant
 * 
 * Helps employees with:
 * - Understanding jurisdiction-specific document requirements
 * - Tracking onboarding progress and compliance status
 * - Answering questions about required documents
 * - Providing guidance on document submission
 */

import OpenAI from "openai";
import type { LlmConfiguration } from "@shared/schema";

interface JurisdictionContext {
  code: string;
  name: string;
  requirements: Array<{
    documentTypeName: string;
    documentTypeCode: string;
    isRequired: boolean;
    priority: number;
    validationRules?: any;
    description?: string;
  }>;
}

interface OnboardingContext {
  userId?: string;
  organizationId?: string;
  sessionId?: string;
  jurisdiction?: JurisdictionContext;
  employeeType?: string;
  submittedDocuments?: string[];
  pendingDocuments?: string[];
  progressPercent?: number;
}

export class OnboardAgent {
  private llmConfig: LlmConfiguration;
  private openai: OpenAI | null = null;

  constructor(llmConfig: LlmConfiguration) {
    this.llmConfig = llmConfig;
    
    if (llmConfig.provider === "openai" && llmConfig.apiKey) {
      this.openai = new OpenAI({
        apiKey: llmConfig.apiKey,
      });
    }
  }

  private getSystemPrompt(context?: OnboardingContext): string {
    let jurisdictionInfo = "";
    
    if (context?.jurisdiction) {
      const { code, name, requirements } = context.jurisdiction;
      const reqList = requirements
        .sort((a, b) => a.priority - b.priority)
        .map(r => `- ${r.documentTypeName}${r.isRequired ? ' (Required)' : ' (Optional)'}: ${r.description || 'Standard document'}`)
        .join('\n');
      
      jurisdictionInfo = `

## Current Employee's Jurisdiction: ${name} (${code})

### Required Documents for this Jurisdiction:
${reqList}

${context.submittedDocuments?.length ? `### Already Submitted Documents:
${context.submittedDocuments.map(d => `- ${d} ✓`).join('\n')}` : ''}

${context.pendingDocuments?.length ? `### Pending Documents:
${context.pendingDocuments.map(d => `- ${d} ⏳`).join('\n')}` : ''}

${context.progressPercent !== undefined ? `### Onboarding Progress: ${context.progressPercent}%` : ''}`;
    }

    return `You are Onboard, an AI assistant specializing in employee onboarding and compliance documentation.

## Your Role
You are a friendly, knowledgeable guide helping employees navigate the document requirements for their onboarding process. You understand jurisdiction-specific compliance requirements and can explain what documents are needed based on the employee's country/region.

## Your Capabilities
1. **Document Requirements** - Explain what documents are required for specific jurisdictions
2. **Compliance Guidance** - Help employees understand why certain documents are needed
3. **Progress Tracking** - Inform employees about their onboarding status
4. **Document Preparation** - Provide tips on preparing and submitting documents
5. **FAQ Assistance** - Answer common questions about the onboarding process
${jurisdictionInfo}

## Communication Style
- Be warm, supportive, and professional
- Use clear, simple language avoiding legal jargon when possible
- Provide specific, actionable guidance
- Acknowledge employee concerns and provide reassurance
- Be proactive in offering help with next steps

## Jurisdiction-Specific Knowledge
You have expertise in document requirements for major jurisdictions including:
- **USA**: Social Security Number (SSN), I-9 Employment Eligibility, W-4 Tax Withholding
- **India**: PAN Card, Aadhaar Card, Provident Fund documentation
- **UK**: National Insurance Number, Right to Work documentation
- **Canada**: Social Insurance Number (SIN), TD1 Tax Form
- **Australia**: Tax File Number (TFN), superannuation forms
- **Singapore**: NRIC/FIN, CPF documentation
- **UAE**: Emirates ID, work permit requirements
- **Germany**: Steuer-ID, health insurance documentation
- **France**: Carte Vitale, social security registration
- **Netherlands**: BSN, DigiD requirements

## Important Guidelines
- Always verify jurisdiction context before giving specific advice
- If no jurisdiction is specified, ask which country/region they're based in
- Prioritize required documents over optional ones in your guidance
- Never request or ask employees to share sensitive document numbers in chat
- Direct employees to official secure upload channels for document submission
- If unsure about specific requirements, recommend consulting HR directly

When responding:
1. First acknowledge their question
2. Provide clear, jurisdiction-specific guidance
3. Suggest next steps or offer additional help`;
  }

  /**
   * Non-streaming execution
   */
  async execute(
    input: string,
    context?: OnboardingContext
  ): Promise<string> {
    if (!this.openai) {
      return "I apologize, but I'm not properly configured at the moment. Please ensure an AI provider is set up for your organization, or contact your administrator for assistance.";
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.llmConfig.model || "gpt-4o-mini",
        messages: [
          { role: "system", content: this.getSystemPrompt(context) },
          { role: "user", content: input },
        ],
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content || "I'm sorry, I couldn't process your request. Please try again.";
    } catch (error: any) {
      console.error("[Onboard] Error processing request:", error);
      return `I encountered an issue while processing your request. Please try again or contact support if the problem persists.`;
    }
  }

  /**
   * Streaming execution
   */
  async executeStream(
    input: string,
    onChunk: (chunk: string) => void,
    context?: OnboardingContext
  ): Promise<string> {
    if (!this.openai) {
      const errorMsg = "I apologize, but I'm not properly configured at the moment. Please ensure an AI provider is set up for your organization.";
      onChunk(errorMsg);
      return errorMsg;
    }

    try {
      const stream = await this.openai.chat.completions.create({
        model: this.llmConfig.model || "gpt-4o-mini",
        messages: [
          { role: "system", content: this.getSystemPrompt(context) },
          { role: "user", content: input },
        ],
        temperature: 0.7,
        stream: true,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          onChunk(content);
        }
      }

      return fullResponse;
    } catch (error: any) {
      const errorMsg = `I encountered an issue: ${error.message}. Please try again.`;
      onChunk(errorMsg);
      return errorMsg;
    }
  }

  /**
   * Analyze document requirements for a jurisdiction
   */
  async analyzeRequirements(
    jurisdictionCode: string,
    employeeType: string = "full-time"
  ): Promise<{
    summary: string;
    required: string[];
    optional: string[];
    estimatedTime: string;
  }> {
    if (!this.openai) {
      return {
        summary: "Unable to analyze requirements - AI not configured",
        required: [],
        optional: [],
        estimatedTime: "Unknown",
      };
    }

    try {
      const prompt = `Provide a brief analysis of employee onboarding document requirements for jurisdiction ${jurisdictionCode} and employee type ${employeeType}. 
      
Return JSON with:
- summary: A 1-2 sentence overview
- required: Array of required document types
- optional: Array of optional but recommended documents
- estimatedTime: How long the full process typically takes`;

      const completion = await this.openai.chat.completions.create({
        model: this.llmConfig.model || "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an HR compliance expert. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
      return {
        summary: result.summary || "Analysis not available",
        required: result.required || [],
        optional: result.optional || [],
        estimatedTime: result.estimatedTime || "2-4 weeks",
      };
    } catch (error: any) {
      console.error("[Onboard] Error analyzing requirements:", error);
      return {
        summary: "Unable to analyze requirements at this time",
        required: [],
        optional: [],
        estimatedTime: "Unknown",
      };
    }
  }
}

/**
 * Express route registration (for backend API endpoints)
 */
export function registerRoutes(app: any) {
  console.log("[Onboard Agent] Routes registered");
  
  // Onboard uses the standard AI agent chat interface
  // Custom routes can be added here if needed
}
