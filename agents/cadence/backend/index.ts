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
  type: 'workflow' | 'pipeline';
  data: any;
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
  
  async execute(input: CadenceInput): Promise<CadenceAnalysis> {
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
   * Execute in streaming mode (streams JSON result in one chunk)
   */
  async executeStream(input: CadenceInput, onChunk: (chunk: string) => void): Promise<string> {
    const result = await this.execute(input);
    const resultStr = JSON.stringify(result, null, 2);
    onChunk(resultStr);
    return resultStr;
  }
}
