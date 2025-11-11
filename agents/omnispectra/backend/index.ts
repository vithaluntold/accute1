/**
 * OmniSpectra AI Agent - Assignment Tracking & Team Management
 * 
 * OmniSpectra helps teams track assignments, monitor progress, check team availability,
 * and get insights about workload distribution and project status.
 */

import type { LlmConfiguration } from "../../../shared/schema";
import { LLMService } from "../../../server/llm-service";

export interface OmniSpectraInput {
  message: string;
  history?: Array<{role: "user" | "assistant", content: string}>;
  context?: any;
  organizationData?: {
    assignments?: any[];
    workflows?: any[];
    users?: any[];
    clients?: any[];
  };
}

export class OmniSpectraAgent {
  private llmService: LLMService;
  
  constructor(llmConfig: LlmConfiguration) {
    this.llmService = new LLMService(llmConfig);
  }
  
  /**
   * Execute OmniSpectra agent in conversational mode
   */
  async execute(input: OmniSpectraInput | string): Promise<{ response: string; suggestions?: string[] }> {
    const message = typeof input === 'string' ? input : input.message;
    const history = typeof input === 'string' ? undefined : input.history;
    const context = typeof input === 'string' ? undefined : input.context;
    
    const systemPrompt = this.buildSystemPrompt(context);
    const fullPrompt = this.buildPromptWithHistory(message, history);
    
    try {
      const responseText = await this.llmService.sendPrompt(fullPrompt, systemPrompt);
      return {
        response: responseText,
        suggestions: [
          "How many assignments are currently overdue?",
          "Which team member has the most active assignments?",
          "Show me team workload distribution",
          "What are the current bottlenecks?"
        ]
      };
    } catch (error) {
      console.error('OmniSpectra agent execution failed:', error);
      return {
        response: 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.',
        suggestions: []
      };
    }
  }
  
  /**
   * Execute in streaming mode for real-time responses
   */
  async executeStream(
    input: OmniSpectraInput | string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const message = typeof input === 'string' ? input : input.message;
    const history = typeof input === 'string' ? undefined : input.history;
    const context = typeof input === 'string' ? undefined : input.context;
    
    const systemPrompt = this.buildSystemPrompt(context);
    const fullPrompt = this.buildPromptWithHistory(message, history);
    
    try {
      const response = await this.llmService.sendPromptStream(fullPrompt, systemPrompt, onChunk);
      return response;
    } catch (error) {
      console.error('OmniSpectra agent streaming failed:', error);
      const errorMsg = 'I apologize, but I encountered an error processing your request. Please check your LLM configuration and try again.';
      onChunk(errorMsg);
      return errorMsg;
    }
  }
  
  /**
   * Build context-aware system prompt with organization data
   */
  private buildSystemPrompt(context?: any): string {
    const orgData = context?.organizationData;
    
    let dataContext = '';
    if (orgData) {
      const totalAssignments = orgData.assignments?.length || 0;
      const activeAssignments = orgData.assignments?.filter((a: any) => a.status === 'active').length || 0;
      const completedAssignments = orgData.assignments?.filter((a: any) => a.status === 'completed').length || 0;
      const overdueAssignments = orgData.assignments?.filter((a: any) => {
        if (!a.dueDate || a.status === 'completed') return false;
        return new Date(a.dueDate) < new Date();
      }).length || 0;

      dataContext = `
**Organization Data Available:**
- Total assignments: ${totalAssignments}
- Active assignments: ${activeAssignments}
- Completed assignments: ${completedAssignments}
- Overdue assignments: ${overdueAssignments}
- ${orgData.workflows?.length || 0} workflows
- ${orgData.users?.length || 0} team members
- ${orgData.clients?.length || 0} clients

**Detailed Data:**
${JSON.stringify(orgData, null, 2)}
`;
    }

    return `You are OmniSpectra, an AI assistant that helps teams track assignments, monitor progress, and manage team availability.

## STRICT ROLE BOUNDARIES - CRITICAL

**YOU MUST ONLY ANSWER QUESTIONS WITHIN YOUR DOMAIN OF EXPERTISE:**

✅ **Allowed Topics:**
- Assignment tracking and status
- Workflow progress and bottlenecks
- Team workload distribution
- Task completion rates
- Overdue assignments and deadlines
- Team performance insights
- Team availability and status
- Meeting coordination
- Workload balancing

❌ **Prohibited Topics - REFUSE POLITELY:**
- Accounting or tax advice (refer to Luca)
- Workflow creation or editing (refer to Cadence)
- Form building (refer to Forma)
- Legal documents (refer to Parity)
- Client onboarding (refer to Echo)
- General advice unrelated to assignments or team status

**When You Receive an Out-of-Scope Question:**
"I appreciate your question, but as an assignment tracking and team management specialist within the Accute platform, I'm specifically designed to help with assignment status, team workload, and availability. For questions about [topic], I'd recommend consulting with the appropriate specialist. Is there anything related to assignments or team management that I can help you with instead?"

**Your Capabilities:**
1. Answer questions about assignment status and progress
2. Identify bottlenecks and overdue assignments
3. Provide team performance summaries
4. Track workflow completion rates
5. Monitor team workload distribution
6. Check team member availability
7. Help coordinate meetings based on availability
8. Provide insights on project timelines

**Guidelines:**
- Be concise and data-driven
- Use the organization data to answer accurately
- Provide specific numbers and metrics when available
- Identify actionable insights and recommendations
- Help prioritize work based on deadlines and workload
- Be professional and supportive

${dataContext}

**Context:**
${context && !orgData ? `User context: ${JSON.stringify(context)}` : ''}`;
  }
  
  /**
   * Build prompt with conversation history
   */
  private buildPromptWithHistory(message: string, history?: Array<{role: string, content: string}>): string {
    if (!history || history.length === 0) {
      return message;
    }
    
    const conversationContext = history
      .slice(-4)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n');
    
    return `${conversationContext}\n\nuser: ${message}`;
  }
}

export { registerRoutes } from "./handler";
