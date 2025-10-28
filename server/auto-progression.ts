import { storage } from "./storage";

/**
 * Auto-progression Engine
 * Implements TaxDome-style cascade automation:
 * - Checklist complete → Task complete
 * - Subtask complete → Task complete
 * - All tasks complete → Step complete
 * - All steps complete → Stage complete
 * - All stages complete → Assignment complete
 */

export class AutoProgressionEngine {
  /**
   * Check if all checklists in a task are completed
   */
  async areAllChecklistsComplete(taskId: string): Promise<boolean> {
    const checklists = await storage.getChecklistsByTask(taskId);
    if (checklists.length === 0) return true; // No checklists = considered complete
    return checklists.every(c => c.isChecked);
  }

  /**
   * Check if all subtasks in a task are completed
   */
  async areAllSubtasksComplete(taskId: string): Promise<boolean> {
    const subtasks = await storage.getSubtasksByTask(taskId);
    if (subtasks.length === 0) return true; // No subtasks = considered complete
    return subtasks.every(s => s.status === 'completed');
  }

  /**
   * Check if all tasks in a step are completed
   */
  async areAllTasksInStepComplete(stepId: string): Promise<boolean> {
    const tasks = await storage.getTasksByStep(stepId);
    if (tasks.length === 0) return false; // No tasks means step isn't ready
    return tasks.every(t => t.status === 'completed');
  }

  /**
   * Check if all steps in a stage are completed
   */
  async areAllStepsInStageComplete(stageId: string): Promise<boolean> {
    const steps = await storage.getStepsByStage(stageId);
    if (steps.length === 0) return false; // No steps means stage isn't ready
    return steps.every(s => s.status === 'completed');
  }

  /**
   * Check if all stages in a workflow are completed
   */
  async areAllStagesInWorkflowComplete(workflowId: string): Promise<boolean> {
    const stages = await storage.getStagesByWorkflow(workflowId);
    if (stages.length === 0) return false;
    return stages.every(s => s.status === 'completed');
  }

  /**
   * Attempt to auto-progress a task when its checklists/subtasks complete
   * Returns true if task was auto-completed
   */
  async tryAutoProgressTask(taskId: string): Promise<boolean> {
    const task = await storage.getWorkflowTask(taskId);
    if (!task || task.status === 'completed') return false;
    if (!task.autoProgress) return false; // Auto-progression not enabled

    // Check if requirements are met
    const checklistsComplete = task.requireAllChecklistsComplete 
      ? await this.areAllChecklistsComplete(taskId)
      : true;
    
    const subtasksComplete = task.requireAllSubtasksComplete
      ? await this.areAllSubtasksComplete(taskId)
      : true;

    if (checklistsComplete && subtasksComplete) {
      // Mark task as complete
      await storage.updateWorkflowTask(taskId, {
        status: 'completed',
      });

      console.log(`[Auto-Progression] Task ${taskId} auto-completed`);

      // Cascade up to step
      await this.tryAutoProgressStep(task.stepId);
      return true;
    }

    return false;
  }

  /**
   * Attempt to auto-progress a step when all its tasks complete
   */
  async tryAutoProgressStep(stepId: string): Promise<boolean> {
    const step = await storage.getWorkflowStep(stepId);
    if (!step || step.status === 'completed') return false;
    if (!step.autoProgress) return false; // Auto-progression not enabled

    const allTasksComplete = await this.areAllTasksInStepComplete(stepId);

    if (allTasksComplete) {
      // Mark step as complete
      await storage.updateWorkflowStep(stepId, {
        status: 'completed',
      });

      console.log(`[Auto-Progression] Step ${stepId} auto-completed`);

      // Execute on-complete actions if any
      if (step.onCompleteActions && Array.isArray(step.onCompleteActions)) {
        await this.executeActions(step.onCompleteActions, { stepId });
      }

      // Cascade up to stage
      await this.tryAutoProgressStage(step.stageId);
      return true;
    }

    return false;
  }

  /**
   * Attempt to auto-progress a stage when all its steps complete
   */
  async tryAutoProgressStage(stageId: string): Promise<boolean> {
    const stage = await storage.getWorkflowStage(stageId);
    if (!stage || stage.status === 'completed') return false;
    if (!stage.autoProgress) return false; // Auto-progression not enabled

    const allStepsComplete = await this.areAllStepsInStageComplete(stageId);

    if (allStepsComplete) {
      // Mark stage as complete
      await storage.updateWorkflowStage(stageId, {
        status: 'completed',
      });

      console.log(`[Auto-Progression] Stage ${stageId} auto-completed`);

      // Execute on-complete actions if any
      if (stage.onCompleteActions && Array.isArray(stage.onCompleteActions)) {
        await this.executeActions(stage.onCompleteActions, { stageId });
      }

      // Cascade up to workflow
      await this.tryAutoProgressWorkflow(stage.workflowId);
      
      // Update assignment if linked
      await this.updateAssignmentProgress(stage.workflowId);

      return true;
    }

    return false;
  }

  /**
   * Attempt to auto-progress a workflow when all its stages complete
   */
  async tryAutoProgressWorkflow(workflowId: string): Promise<boolean> {
    const workflow = await storage.getWorkflow(workflowId);
    if (!workflow || workflow.status === 'completed') return false;

    const allStagesComplete = await this.areAllStagesInWorkflowComplete(workflowId);

    if (allStagesComplete) {
      // Mark workflow as complete
      await storage.updateWorkflow(workflowId, {
        status: 'completed',
      });

      console.log(`[Auto-Progression] Workflow ${workflowId} auto-completed`);
      return true;
    }

    return false;
  }

  /**
   * Update assignment progress when workflow progresses
   */
  async updateAssignmentProgress(workflowId: string): Promise<void> {
    // Find assignments for this workflow
    const assignments = await storage.getWorkflowAssignmentsByWorkflow(workflowId);

    for (const assignment of assignments) {
      const stages = await storage.getStagesByWorkflow(workflowId);
      const completedStages = stages.filter(s => s.status === 'completed').length;
      const progress = stages.length > 0 
        ? Math.round((completedStages / stages.length) * 100)
        : 0;

      // Check if all stages complete
      const allComplete = completedStages === stages.length && stages.length > 0;

      await storage.updateWorkflowAssignment(assignment.id, {
        completedStages,
        progress,
        status: allComplete ? 'completed' : (completedStages > 0 ? 'in_progress' : 'not_started'),
        completedAt: allComplete ? new Date() : undefined,
      });

      console.log(`[Auto-Progression] Assignment ${assignment.id} updated: ${progress}% complete`);
    }
  }

  /**
   * Execute automation actions (e.g., notifications, webhooks)
   */
  private async executeActions(actions: any[], context: any): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'send_notification':
            // TODO: Implement notification sending
            console.log(`[Auto-Progression] Would send notification:`, action);
            break;
          case 'webhook':
            // TODO: Implement webhook calls
            console.log(`[Auto-Progression] Would call webhook:`, action);
            break;
          case 'create_task':
            // TODO: Implement task creation
            console.log(`[Auto-Progression] Would create task:`, action);
            break;
          default:
            console.log(`[Auto-Progression] Unknown action type: ${action.type}`);
        }
      } catch (error) {
        console.error(`[Auto-Progression] Action execution failed:`, error);
      }
    }
  }

  /**
   * Trigger auto-progression when a checklist item is checked
   */
  async onChecklistItemChecked(taskId: string): Promise<void> {
    console.log(`[Auto-Progression] Checklist item checked in task ${taskId}`);
    await this.tryAutoProgressTask(taskId);
  }

  /**
   * Trigger auto-progression when a subtask is completed
   */
  async onSubtaskCompleted(taskId: string): Promise<void> {
    console.log(`[Auto-Progression] Subtask completed in task ${taskId}`);
    await this.tryAutoProgressTask(taskId);
  }

  /**
   * Trigger auto-progression when a task is manually completed
   */
  async onTaskCompleted(stepId: string): Promise<void> {
    console.log(`[Auto-Progression] Task completed in step ${stepId}`);
    await this.tryAutoProgressStep(stepId);
  }
}

// Export singleton instance
export const autoProgressionEngine = new AutoProgressionEngine();
