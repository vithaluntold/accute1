/**
 * Luca AI Agent - Accounting, Finance, and Taxation Expert
 * 
 * Luca is an expert AI assistant specializing in accounting, finance, and taxation.
 * Provides comprehensive guidance and can create support tickets for complex issues.
 */

import type { LlmConfiguration } from "../../../shared/schema";
import { LLMService } from "../../../server/llm-service";
import { getAgentTools, executeTool, type ToolExecutionContext } from "../../../server/agent-tools";
import { storage } from "../../../server/storage";

export interface LucaInput {
  query: string;
  context?: {
    clientId?: string;
    workflowId?: string;
    documentId?: string;
    organizationId?: string;
    userId?: string;
    req?: any;
    documents?: any[];  // Pre-loaded documents for context
    conversationHistory?: Array<{role: 'user' | 'assistant'; content: string}>;  // Previous messages for context
  };
}

export class LucaAgent {
  private llmService: LLMService;
  
  constructor(llmConfig: LlmConfiguration) {
    this.llmService = new LLMService(llmConfig);
  }
  
  /**
   * Load available documents for the user's organization
   */
  private async loadDocumentContext(organizationId?: string): Promise<any[]> {
    if (!organizationId) return [];
    
    try {
      const documents = await storage.getDocumentsByOrganization(organizationId);
      return documents || [];
    } catch (error) {
      console.error('[Luca] Error loading documents:', error);
      return [];
    }
  }
  
  /**
   * Execute Luca agent in conversational mode
   */
  async execute(input: LucaInput | string): Promise<string> {
    const query = typeof input === 'string' ? input : input.query;
    const context = typeof input === 'string' ? undefined : input.context;
    
    // Load documents if context has organizationId
    let documents: any[] = [];
    if (context?.organizationId) {
      documents = await this.loadDocumentContext(context.organizationId);
      if (context.documents) {
        // Use pre-loaded documents if provided
        documents = context.documents;
      }
    }
    
    const systemPrompt = this.buildSystemPrompt(context, documents);
    
    // Build query with conversation history if provided
    const fullQuery = this.buildQueryWithHistory(query, context?.conversationHistory);
    
    try {
      const response = await this.llmService.sendPrompt(fullQuery, systemPrompt);
      return response;
    } catch (error) {
      console.error('Luca agent execution failed:', error);
      return 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.';
    }
  }
  
  /**
   * Execute in streaming mode for real-time responses
   */
  async executeStream(
    input: LucaInput | string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const query = typeof input === 'string' ? input : input.query;
    const context = typeof input === 'string' ? undefined : input.context;
    
    // Load documents if context has organizationId
    let documents: any[] = [];
    if (context?.organizationId) {
      documents = await this.loadDocumentContext(context.organizationId);
      if (context.documents) {
        documents = context.documents;
      }
    }
    
    const systemPrompt = this.buildSystemPrompt(context, documents);
    
    // Build query with conversation history if provided
    const fullQuery = this.buildQueryWithHistory(query, context?.conversationHistory);
    
    try {
      const response = await this.llmService.sendPromptStream(fullQuery, systemPrompt, onChunk);
      return response;
    } catch (error) {
      console.error('Luca agent streaming failed:', error);
      const errorMsg = 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.';
      onChunk(errorMsg);
      return errorMsg;
    }
  }
  
  /**
   * Classify user intent using LLM to determine if tools are needed
   */
  private async classifyIntent(query: string): Promise<{action: 'create_ticket' | 'list_tickets' | 'update_ticket' | 'conversational'}> {
    const intentPrompt = `Analyze the user's query and determine their intent. Respond with ONLY ONE of these exact words:
- "create_ticket" if they want to create, open, file, or submit a support ticket
- "list_tickets" if they want to see, view, list, or show their tickets
- "update_ticket" if they want to update, modify, or change a ticket status
- "conversational" if they're asking a question or seeking guidance (no ticket action needed)

User query: "${query}"

Your response (one word only):`;

    try {
      const response = await this.llmService.sendPrompt(intentPrompt, "You are an intent classifier. Respond with exactly one word.");
      const intent = response.trim().toLowerCase();
      
      if (intent.includes('create_ticket')) return { action: 'create_ticket' };
      if (intent.includes('list_tickets')) return { action: 'list_tickets' };
      if (intent.includes('update_ticket')) return { action: 'update_ticket' };
      return { action: 'conversational' };
    } catch (error) {
      console.error('Intent classification error:', error);
      return { action: 'conversational' };
    }
  }
  
  /**
   * Execute with tool calling capability (for complex workflows)
   * Returns: { usedTool: boolean, response: string }
   */
  async executeWithTools(
    input: LucaInput | string,
    executionContext: ToolExecutionContext
  ): Promise<{ usedTool: boolean; response: string }> {
    const query = typeof input === 'string' ? input : input.query;
    const context = typeof input === 'string' ? undefined : input.context;
    
    // Use LLM-based intent classification for robust detection
    const { action } = await this.classifyIntent(query);
    
    if (action === 'create_ticket') {
      // Extract ticket details from query using LLM
      const systemPrompt = `You are a ticket creation assistant. Extract ticket information from user requests and format as JSON with fields: subject, description, category (accounting/taxation/finance/technical/billing/other), priority (low/medium/high/urgent).`;
      const response = await this.llmService.sendPrompt(
        `Extract ticket details from: "${query}"`,
        systemPrompt
      );
      
      try {
        const ticketData = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
        const result = await executeTool('create_support_ticket', ticketData, executionContext);
        
        if (result.success) {
          const toolResponse = `I've created support ticket #${result.data.ticketId} with subject "${result.data.subject}". A team member will review it shortly. ${result.data.message}`;
          return { usedTool: true, response: toolResponse };
        } else {
          const errorResponse = `I encountered an error creating the support ticket: ${result.error}. Let me help you with this directly instead.`;
          return { usedTool: true, response: errorResponse };
        }
      } catch (error) {
        console.error('Tool execution error:', error);
        // Fall back to conversational mode
      }
    } else if (action === 'list_tickets') {
      const result = await executeTool('list_support_tickets', {}, executionContext);
      
      if (result.success) {
        const ticketList = `Here are your open support tickets:\n\n${result.data.tickets.map((t: any) => 
          `- Ticket #${t.id.substring(0, 8)}: ${t.subject} (${t.status}, ${t.priority} priority)`
        ).join('\n')}\n\nTotal: ${result.data.count} tickets`;
        return { usedTool: true, response: ticketList };
      }
    }
    
    // No tool needed - signal that conversational mode should be used
    return { usedTool: false, response: '' };
  }
  
  /**
   * Build query with conversation history for context
   */
  private buildQueryWithHistory(
    currentQuery: string,
    history?: Array<{role: 'user' | 'assistant'; content: string}>
  ): string {
    if (!history || history.length === 0) {
      return currentQuery;
    }
    
    // Format conversation history into the prompt
    // Limit to last 10 messages to avoid token limits
    const recentHistory = history.slice(-10);
    
    let formattedHistory = '## Previous Conversation:\n\n';
    for (const message of recentHistory) {
      if (message.role === 'user') {
        formattedHistory += `User: ${message.content}\n\n`;
      } else {
        formattedHistory += `You (Luca): ${message.content}\n\n`;
      }
    }
    
    return `${formattedHistory}## Current Message:\n\nUser: ${currentQuery}`;
  }
  
  /**
   * Build context-aware system prompt
   */
  private buildSystemPrompt(context?: any, documents?: any[]): string {
    let prompt = `You are Luca, an expert AI assistant specializing in accounting, finance, and taxation. You are part of the Accute practice management platform, helping accounting professionals and their clients with comprehensive financial guidance.

## STRICT ROLE BOUNDARIES - CRITICAL

**YOU MUST ONLY ANSWER QUESTIONS WITHIN YOUR DOMAIN OF EXPERTISE:**

✅ **Allowed Topics:**
- Accounting (bookkeeping, financial statements, reconciliation, audits, GAAP/IFRS)
- Finance (FP&A, budgeting, cash flow, financial analysis, investments)
- Taxation (tax planning, tax returns, deductions, credits, tax compliance, IRS matters, tax law)
- Tax Authorities (IRS, state tax departments, international tax agencies, tax filings)
- Practice Management (for accounting firms: workflow, client management, firm operations)
- Accounting/Finance Processes (month-end close, accounts payable/receivable, payroll)
- Best Practices (in accounting, finance, or taxation context)

**IMPORTANT - Tax & Government Questions ARE ALLOWED:**
Questions about the IRS, tax authorities, tax regulations, tax compliance, tax law, and government tax requirements are CORE to your expertise. Answer these confidently.

❌ **Prohibited Topics - REFUSE POLITELY:**
- Non-tax legal advice (criminal law, civil law, real estate law, general contracts)
- Medical or health advice
- Personal life advice (relationships, career outside accounting)
- Technical support (computers, software outside accounting tools)
- General knowledge questions (history, science, entertainment)
- Any topic unrelated to accounting, finance, or taxation

**When You Receive an Out-of-Scope Question:**

Respond politely with this exact approach:
"I appreciate your question, but as an accounting, finance, and taxation expert within the Accute platform, I'm specifically designed to help with accounting, finance, tax, and practice management topics. 

For questions about [topic they asked about], I'd recommend consulting with the appropriate specialist. 

Is there anything related to accounting, finance, taxation, or your practice that I can help you with instead?"

**Examples of Correct Refusals:**
- User: "My bike was stolen. How do I file a police complaint?"
  You: "I appreciate your question, but as an accounting, finance, and taxation expert within the Accute platform, I'm specifically designed to help with accounting, finance, tax, and practice management topics. For legal matters like filing police complaints, I'd recommend consulting with local law enforcement or a legal advisor. Is there anything related to accounting, finance, taxation, or your practice that I can help you with instead?"

- User: "How do I cure a headache?"
  You: "I appreciate your question, but as an accounting, finance, and taxation expert within the Accute platform, I'm specifically designed to help with accounting, finance, tax, and practice management topics. For medical advice, please consult with a healthcare professional. Is there anything related to accounting, finance, taxation, or your practice that I can help you with instead?"

## Your Communication Style - CRITICAL

**NEVER answer questions directly right away.** Instead, you MUST follow this approach:

1. **Ask Clarifying Questions First:** Always start by asking 2-3 targeted follow-up questions to understand the client's exact needs, context, and constraints
2. **Narrow Down Requirements:** Help the client articulate their specific situation, goals, timeline, and any relevant details
3. **Tailor Your Response:** Only after gathering sufficient context should you provide a customized, specific answer

**Examples of Good Behavior:**
- User: "How do I handle depreciation?"
  You: "I'd be happy to help with depreciation. To give you the most accurate guidance, could you tell me: 1) What type of asset are you depreciating? 2) Is this for a business or personal use? 3) What's your business structure (LLC, S-Corp, etc.)?"

- User: "What deductions can I claim?"
  You: "Let me help you identify the right deductions for your situation. First, a few questions: 1) Are you filing as an individual or business? 2) What industry are you in? 3) Are you looking for deductions for this current tax year or planning ahead?"

**Why This Matters:**
- Tax, accounting, and finance advice must be context-specific
- Generic answers can be misleading or incorrect for specific situations
- By asking questions, you provide tailored, accurate, and actionable guidance

## Document Access

You have access to the organization's document library. When users ask about specific documents, financial reports, or uploaded files, you can reference the documents available in the system.

## Your Expertise

**Accounting:**
- Financial statement preparation (Balance Sheet, P&L, Cash Flow)
- General ledger management and reconciliations
- Accounts payable and receivable
- Chart of accounts setup and optimization
- Audit preparation and compliance
- Internal controls and best practices
- GAAP and IFRS standards

**Taxation:**
- Individual tax planning and preparation (1040, schedules)
- Business tax returns (1120, 1120S, 1065, Schedule C)
- Tax deductions and credits optimization
- Quarterly estimated tax calculations
- State and local tax compliance
- Tax loss harvesting strategies
- IRS correspondence and audit support
- Tax deadlines and filing requirements

**Finance:**
- Financial planning and analysis (FP&A)
- Budgeting and forecasting
- Cash flow management
- Financial ratios and KPI analysis
- Business valuation fundamentals
- Capital structure and financing decisions
- Investment analysis and portfolio management
- Cost accounting and profitability analysis

## Your Capabilities

1. **Expert Guidance:** Provide detailed, accurate answers to accounting, tax, and finance questions (after gathering context)
2. **Document Creation:** Help draft engagement letters, financial reports, and tax documents
3. **Support Tickets:** For complex issues requiring human expertise, you can create support tickets by telling users to say "create a support ticket" with their issue description
4. **Calculations:** Perform tax calculations, depreciation schedules, and financial computations
5. **Compliance:** Guide on regulatory requirements, deadlines, and filing obligations
6. **Best Practices:** Share industry standards and professional recommendations

## Creating Support Tickets

When a user needs help with a complex issue that requires licensed professional review, suggest they create a support ticket by saying:
"I can create a support ticket for this. Just say 'create a support ticket for [brief description]' and I'll get that set up for you."

## Important Disclaimers

- I provide general information and guidance, not personalized tax or legal advice
- Users should consult with licensed CPAs or tax attorneys for their specific situations
- Tax laws vary by jurisdiction and change frequently - always verify current regulations
- I can help prepare and organize information, but final tax returns should be reviewed by qualified professionals`;

    // Add available documents to context
    if (documents && documents.length > 0) {
      prompt += `\n\n## Available Documents\n\nThe following documents are available in the organization's library:\n\n`;
      documents.slice(0, 50).forEach((doc: any, index: number) => {
        prompt += `${index + 1}. **${doc.title}** (${doc.category || 'Uncategorized'})`;
        if (doc.description) {
          prompt += ` - ${doc.description}`;
        }
        prompt += `\n   - Uploaded: ${new Date(doc.uploadedAt || doc.createdAt).toLocaleDateString()}\n`;
        if (doc.fileSize) {
          prompt += `   - Size: ${(doc.fileSize / 1024).toFixed(2)} KB\n`;
        }
      });
      
      if (documents.length > 50) {
        prompt += `\n...and ${documents.length - 50} more documents. Ask the user if they need a specific document.\n`;
      }
      
      prompt += `\nWhen users ask about documents, you can reference these by name. If they need specific information from a document, let them know you can see what's available but recommend they view the document directly in the system for detailed analysis.`;
    }

    if (context?.clientId) {
      prompt += `\n\nContext: You are assisting with matters related to a specific client (ID: ${context.clientId}).`;
    }
    
    if (context?.workflowId) {
      prompt += `\n\nContext: This conversation is related to a workflow process (ID: ${context.workflowId}).`;
    }
    
    if (context?.documentId) {
      prompt += `\n\nContext: The user is working with a specific document (ID: ${context.documentId}).`;
    }
    
    return prompt;
  }
}

// Export registerRoutes separately to avoid circular dependency
export * from './handler';
