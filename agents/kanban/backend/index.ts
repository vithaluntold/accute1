import type { LlmConfiguration } from '../../../shared/schema';
import { LLMService } from '../../../server/llm-service';

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  tags?: string[];
}

export interface KanbanBoard {
  columns: KanbanColumn[];
  title: string;
}

export interface KanbanInput {
  type: 'workflow' | 'pipeline';
  data: any; // Workflow or Pipeline data with stages/steps/tasks
  organizationId: string;
}

/**
 * Kanban View AI Agent
 * Analyzes workflows/pipelines and generates intelligent Kanban board visualizations
 */
export class KanbanAgent {
  private llmService: LLMService;
  
  constructor(llmConfig: LlmConfiguration) {
    this.llmService = new LLMService(llmConfig);
  }
  
  async execute(input: KanbanInput): Promise<KanbanBoard> {
    const systemPrompt = `You are an expert project management AI assistant specialized in creating Kanban board visualizations.
Your task is to analyze workflow or pipeline data and organize it into an intuitive Kanban board structure.

For workflows: Organize nodes by status/type into logical columns (To Do, In Progress, Completed, etc.)
For pipelines: Use the hierarchical structure (Stages → Steps → Tasks) to create meaningful columns.

Always return valid JSON in this exact format:
{
  "title": "Board Title",
  "columns": [
    {
      "id": "col-1",
      "title": "Column Name",
      "cards": [
        {
          "id": "card-1",
          "title": "Card Title",
          "description": "Optional description",
          "assignee": "User ID if assigned",
          "priority": "low|medium|high",
          "dueDate": "ISO date string if applicable",
          "tags": ["tag1", "tag2"]
        }
      ]
    }
  ]
}`;

    const userPrompt = `Analyze this ${input.type} data and create a Kanban board visualization:

${JSON.stringify(input.data, null, 2)}

Create an intuitive Kanban board with appropriate columns and cards. Use meaningful column names based on the data structure and workflow state.`;

    try {
      const response = await this.llmService.sendPrompt(userPrompt, systemPrompt);
      
      // Parse the AI response
      // Extract JSON from markdown code blocks if present
      let jsonStr = response.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }
      
      const kanbanBoard = JSON.parse(jsonStr);
      
      // Validate the structure
      if (!kanbanBoard.columns || !Array.isArray(kanbanBoard.columns)) {
        throw new Error('Invalid Kanban board structure');
      }
      
      return kanbanBoard;
    } catch (error) {
      console.error('Kanban Agent execution failed:', error);
      // Return a fallback basic structure
      return this.createFallbackBoard(input);
    }
  }
  
  /**
   * Create a basic fallback Kanban board if AI fails
   */
  private createFallbackBoard(input: KanbanInput): KanbanBoard {
    if (input.type === 'pipeline' && input.data?.stages) {
      // Create columns from stages
      const columns: KanbanColumn[] = input.data.stages.map((stage: any, idx: number) => ({
        id: `col-${stage.id || idx}`,
        title: stage.name || `Stage ${idx + 1}`,
        cards: stage.steps?.flatMap((step: any) => 
          step.tasks?.map((task: any) => ({
            id: task.id,
            title: task.name,
            description: task.description,
            assignee: task.assignedTo,
            priority: task.priority,
            dueDate: task.dueDate,
          })) || []
        ) || []
      }));
      
      return {
        title: input.data?.name || 'Pipeline Board',
        columns
      };
    }
    
    // Default fallback
    return {
      title: input.data?.name || 'Kanban Board',
      columns: [
        { id: 'col-1', title: 'To Do', cards: [] },
        { id: 'col-2', title: 'In Progress', cards: [] },
        { id: 'col-3', title: 'Done', cards: [] }
      ]
    };
  }
}
