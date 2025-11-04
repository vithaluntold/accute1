import type { LlmConfiguration } from '../../../shared/schema';
import { LLMService } from '../../../server/llm-service';

export interface CadenceAnalysis {
  summary: string;
  insights: string[];
  recommendations: string[];
  timeline: {
    currentPace: string;
    estimatedCompletion?: string;
    bottlenecks?: string[];
  };
  optimizations: {
    task: string;
    currentDuration: string;
    suggestedDuration: string;
    reasoning: string;
  }[];
}

export interface CadenceInput {
  type?: 'workflow' | 'pipeline';
  data?: any;
  historicalData?: any[]; // Past executions for analysis
}

/**
 * Cadence AI Agent
 * Analyzes workflow timing and scheduling to optimize execution cadence
 */
export class CadenceAgent {
  private llmService: LLMService;
  
  constructor(llmConfig: LlmConfiguration) {
    this.llmService = new LLMService(llmConfig);
  }
  
  async execute(input: CadenceInput | string): Promise<CadenceAnalysis> {
    // Handle string input for conversational mode
    if (typeof input === 'string') {
      return this.executeConversational(input);
    }
    
    // Handle structured input
    return this.executeStructured(input);
  }
  
  private async executeConversational(message: string): Promise<CadenceAnalysis> {
    const systemPrompt = `You are Cadence, an intelligent workflow building assistant. Help users create and optimize workflows through natural conversation.

When analyzing or building workflows:
1. Ask clarifying questions if needed
2. Suggest stages and steps based on descriptions
3. Identify bottlenecks and optimization opportunities
4. Provide actionable recommendations

Always return valid JSON in this exact format:
{
  "summary": "Brief overview of the workflow analysis or suggestion",
  "insights": ["Insight 1", "Insight 2", "..."],
  "recommendations": ["Recommendation 1", "Recommendation 2", "..."],
  "timeline": {
    "currentPace": "Description of execution pace or workflow structure",
    "estimatedCompletion": "Time estimate if applicable",
    "bottlenecks": ["Bottleneck 1", "Bottleneck 2"] or []
  },
  "optimizations": [
    {
      "task": "Task or stage name",
      "currentDuration": "Current state",
      "suggestedDuration": "Suggested improvement",
      "reasoning": "Why this optimization makes sense"
    }
  ]
}`;

    const userPrompt = message;

    try {
      const response = await this.llmService.sendPrompt(userPrompt, systemPrompt);
      
      let jsonStr = response.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }
      
      const analysis = JSON.parse(jsonStr);
      return analysis;
    } catch (error) {
      console.error('Cadence conversational mode failed:', error);
      return {
        summary: 'I can help you build and optimize workflows. What workflow would you like to create or analyze?',
        insights: ['Describe the process you want to automate', 'I can help identify stages and steps', 'I can suggest optimizations and improvements'],
        recommendations: ['Tell me about the workflow you need', 'Describe the current process', 'Share any pain points or bottlenecks'],
        timeline: {
          currentPace: 'Ready to help',
        },
        optimizations: []
      };
    }
  }
  
  private async executeStructured(input: CadenceInput): Promise<CadenceAnalysis> {
    const systemPrompt = `You are an expert workflow optimization AI specialized in analyzing timing and scheduling patterns.
Your task is to analyze workflow/pipeline execution data and provide insights on optimizing cadence and timing.

Focus on:
1. Identifying bottlenecks and delays
2. Suggesting optimal task durations
3. Recommending scheduling improvements
4. Analyzing execution patterns

Always return valid JSON in this exact format:
{
  "summary": "Brief overview of cadence analysis",
  "insights": ["Insight 1", "Insight 2", "..."],
  "recommendations": ["Recommendation 1", "Recommendation 2", "..."],
  "timeline": {
    "currentPace": "Description of current execution pace",
    "estimatedCompletion": "ISO date string or time estimate",
    "bottlenecks": ["Bottleneck 1", "Bottleneck 2"]
  },
  "optimizations": [
    {
      "task": "Task name",
      "currentDuration": "e.g., 2 days",
      "suggestedDuration": "e.g., 1 day",
      "reasoning": "Explanation of why this optimization makes sense"
    }
  ]
}`;

    const userPrompt = `Analyze the timing and cadence of this ${input.type}:

Current State:
${JSON.stringify(input.data, null, 2)}

${input.historicalData ? `Historical Execution Data:\n${JSON.stringify(input.historicalData, null, 2)}` : ''}

Provide a comprehensive cadence analysis with actionable recommendations for optimization.`;

    try {
      const response = await this.llmService.sendPrompt(userPrompt, systemPrompt);
      
      // Parse the AI response
      let jsonStr = response.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }
      
      const analysis = JSON.parse(jsonStr);
      return analysis;
    } catch (error) {
      console.error('Cadence Agent execution failed:', error);
      return {
        summary: 'Cadence analysis failed. Please check your LLM configuration.',
        insights: ['Unable to perform analysis at this time'],
        recommendations: ['Verify LLM configuration and try again'],
        timeline: {
          currentPace: 'Unknown',
        },
        optimizations: []
      };
    }
  }

  /**
   * Execute in streaming mode for real-time responses
   */
  async executeStream(input: CadenceInput | string, onChunk: (chunk: string) => void): Promise<string> {
    // Handle string input for conversational streaming
    if (typeof input === 'string') {
      const systemPrompt = `You are Cadence, an intelligent workflow building assistant. Help users create and optimize workflows through natural conversation.

Provide clear, actionable advice about:
- Workflow structure and stages
- Process optimization
- Bottleneck identification
- Time estimation
- Best practices

Be conversational and helpful.`;

      try {
        const response = await this.llmService.sendPromptStream(input, systemPrompt, onChunk);
        return response;
      } catch (error) {
        console.error('Cadence streaming failed:', error);
        const errorMsg = 'I can help you build and optimize workflows. What workflow would you like to create or analyze?';
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
