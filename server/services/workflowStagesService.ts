import { db } from "../db";
import { eq, and, isNotNull } from "drizzle-orm";
import { workflowStages, workflowSteps, workflowTasks } from "../../shared/schema";

/**
 * Timeline View Stage Aggregation Service
 * Provides high-level workflow stage data with computed metrics
 */

export interface StageWithMetrics {
  id: string;
  workflowId: string;
  name: string;
  description: string | null;
  order: number;
  status: string;
  autoProgress: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Computed metrics
  startDate: Date | null; // Earliest step/task start
  dueDate: Date | null; // Latest step/task due
  percentComplete: number; // 0-100
  isMilestone: boolean; // True if marked as milestone or has no children
  isOverdue: boolean; // True if past due and not completed
  totalSteps: number;
  completedSteps: number;
  totalTasks: number;
  completedTasks: number;
  
  // Optional nested steps
  steps?: StepWithMetrics[];
}

export interface StepWithMetrics {
  id: string;
  stageId: string;
  name: string;
  description: string | null;
  order: number;
  status: string;
  completedAt: Date | null;
  
  // Computed metrics
  startDate: Date | null;
  dueDate: Date | null;
  percentComplete: number;
  totalTasks: number;
  completedTasks: number;
}

export class WorkflowStagesService {
  
  /**
   * Get all stages for a workflow with computed metrics
   */
  async getStagesWithMetrics(workflowId: string, includeSteps: boolean = false): Promise<StageWithMetrics[]> {
    // Fetch all stages for this workflow
    const stages = await db.query.workflowStages.findMany({
      where: eq(workflowStages.workflowId, workflowId),
      orderBy: (stages, { asc }) => [asc(stages.order)],
    });

    // Fetch all steps for this workflow
    const stageIds = stages.map(s => s.id);
    const steps = stageIds.length > 0
      ? await db.query.workflowSteps.findMany({
          where: (steps, { inArray }) => inArray(steps.stageId, stageIds),
          orderBy: (steps, { asc }) => [asc(steps.order)],
        })
      : [];

    // Fetch all tasks for these steps
    const stepIds = steps.map(s => s.id);
    const tasks = stepIds.length > 0
      ? await db.query.workflowTasks.findMany({
          where: (tasks, { inArray }) => inArray(tasks.stepId, stepIds),
        })
      : [];

    // Group steps by stage
    const stepsByStage = new Map<string, typeof steps>();
    steps.forEach(step => {
      if (!stepsByStage.has(step.stageId)) {
        stepsByStage.set(step.stageId, []);
      }
      stepsByStage.get(step.stageId)!.push(step);
    });

    // Group tasks by step
    const tasksByStep = new Map<string, typeof tasks>();
    tasks.forEach(task => {
      if (!tasksByStep.has(task.stepId)) {
        tasksByStep.set(task.stepId, []);
      }
      tasksByStep.get(task.stepId)!.push(task);
    });

    // Compute metrics for each stage
    const stagesWithMetrics: StageWithMetrics[] = stages.map(stage => {
      const stageSteps = stepsByStage.get(stage.id) || [];
      
      // Collect all tasks for this stage
      const stageTasks: typeof tasks = [];
      stageSteps.forEach(step => {
        const stepTasks = tasksByStep.get(step.id) || [];
        stageTasks.push(...stepTasks);
      });

      // Compute dates (earliest start, latest due)
      const allDates: Date[] = [];
      stageTasks.forEach(task => {
        if (task.startDate) allDates.push(new Date(task.startDate));
        if (task.dueDate) allDates.push(new Date(task.dueDate));
      });
      
      const startDate = allDates.length > 0 
        ? new Date(Math.min(...allDates.map(d => d.getTime())))
        : null;
      const dueDate = allDates.length > 0
        ? new Date(Math.max(...allDates.map(d => d.getTime())))
        : null;

      // Compute completion metrics
      const completedSteps = stageSteps.filter(s => s.status === 'completed').length;
      const completedTasks = stageTasks.filter(t => t.status === 'completed').length;
      
      const totalSteps = stageSteps.length;
      const totalTasks = stageTasks.length;
      
      // Percent complete based on tasks (more granular)
      const percentComplete = totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : (stage.status === 'completed' ? 100 : 0);

      // Milestone detection: no children or explicitly marked
      const isMilestone = totalSteps === 0 && totalTasks === 0;

      // Overdue detection
      const isOverdue = dueDate !== null 
        && new Date() > dueDate 
        && stage.status !== 'completed';

      const stageWithMetrics: StageWithMetrics = {
        id: stage.id,
        workflowId: stage.workflowId,
        name: stage.name,
        description: stage.description,
        order: stage.order,
        status: stage.status,
        autoProgress: stage.autoProgress,
        completedAt: stage.completedAt,
        createdAt: stage.createdAt,
        updatedAt: stage.updatedAt,
        
        // Computed
        startDate,
        dueDate,
        percentComplete,
        isMilestone,
        isOverdue,
        totalSteps,
        completedSteps,
        totalTasks,
        completedTasks,
      };

      // Include steps if requested
      if (includeSteps && stageSteps.length > 0) {
        stageWithMetrics.steps = stageSteps.map(step => {
          const stepTasks = tasksByStep.get(step.id) || [];
          
          // Compute step dates
          const stepDates: Date[] = [];
          stepTasks.forEach(task => {
            if (task.startDate) stepDates.push(new Date(task.startDate));
            if (task.dueDate) stepDates.push(new Date(task.dueDate));
          });
          
          const stepStartDate = stepDates.length > 0
            ? new Date(Math.min(...stepDates.map(d => d.getTime())))
            : null;
          const stepDueDate = stepDates.length > 0
            ? new Date(Math.max(...stepDates.map(d => d.getTime())))
            : null;

          const stepCompletedTasks = stepTasks.filter(t => t.status === 'completed').length;
          const stepTotalTasks = stepTasks.length;
          const stepPercentComplete = stepTotalTasks > 0
            ? Math.round((stepCompletedTasks / stepTotalTasks) * 100)
            : (step.status === 'completed' ? 100 : 0);

          return {
            id: step.id,
            stageId: step.stageId,
            name: step.name,
            description: step.description,
            order: step.order,
            status: step.status,
            completedAt: step.completedAt,
            
            // Computed
            startDate: stepStartDate,
            dueDate: stepDueDate,
            percentComplete: stepPercentComplete,
            totalTasks: stepTotalTasks,
            completedTasks: stepCompletedTasks,
          };
        });
      }

      return stageWithMetrics;
    });

    return stagesWithMetrics;
  }

  /**
   * Get single stage with metrics
   */
  async getStageWithMetrics(stageId: string, includeSteps: boolean = false): Promise<StageWithMetrics | null> {
    const stage = await db.query.workflowStages.findFirst({
      where: eq(workflowStages.id, stageId),
    });

    if (!stage) {
      return null;
    }

    // Reuse the getStagesWithMetrics logic for consistency
    const stages = await this.getStagesWithMetrics(stage.workflowId, includeSteps);
    return stages.find(s => s.id === stageId) || null;
  }
}

export const workflowStagesService = new WorkflowStagesService();
