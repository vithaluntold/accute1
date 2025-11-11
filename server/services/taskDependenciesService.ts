import { db } from "../db";
import { taskDependencies, workflowTasks } from "@shared/schema";
import * as schema from "@shared/schema";
import { eq, and, or, inArray } from "drizzle-orm";

export class TaskDependenciesService {
  /**
   * Create a new task dependency with circular dependency validation
   * SECURITY: Validates both tasks belong to same organization and workflow
   */
  static async createDependency(
    taskId: string,
    dependsOnTaskId: string,
    organizationId: string,
    dependencyType: string = "finish-to-start",
    lag: number = 0
  ) {
    // Self-dependency check
    if (taskId === dependsOnTaskId) {
      throw new Error("A task cannot depend on itself");
    }

    // SECURITY: Fetch tasks with step/workflow info to verify same organization/workflow
    const tasksWithWorkflow = await db
      .select({
        taskId: workflowTasks.id,
        stepId: workflowTasks.stepId,
        stageId: schema.workflowSteps.stageId,
        workflowId: schema.workflowStages.workflowId,
        workflowOrgId: schema.workflows.organizationId,
      })
      .from(workflowTasks)
      .innerJoin(schema.workflowSteps, eq(workflowTasks.stepId, schema.workflowSteps.id))
      .innerJoin(schema.workflowStages, eq(schema.workflowSteps.stageId, schema.workflowStages.id))
      .innerJoin(schema.workflows, eq(schema.workflowStages.workflowId, schema.workflows.id))
      .where(inArray(workflowTasks.id, [taskId, dependsOnTaskId]));

    if (tasksWithWorkflow.length !== 2) {
      throw new Error("One or both tasks not found");
    }

    const task1 = tasksWithWorkflow.find(t => t.taskId === taskId);
    const task2 = tasksWithWorkflow.find(t => t.taskId === dependsOnTaskId);

    // SECURITY: Verify both tasks belong to caller's organization
    if (task1!.workflowOrgId !== organizationId || task2!.workflowOrgId !== organizationId) {
      throw new Error("Unauthorized: Tasks must belong to your organization");
    }

    // SECURITY: Verify both tasks belong to same workflow
    if (task1!.workflowId !== task2!.workflowId) {
      throw new Error("Tasks must belong to the same workflow to create dependency");
    }

    const workflowId = task1!.workflowId;

    // Circular dependency check
    const wouldCreateCycle = await this.wouldCreateCycle(taskId, dependsOnTaskId, organizationId);
    if (wouldCreateCycle) {
      throw new Error("This dependency would create a circular dependency");
    }

    // Create the dependency
    const [dependency] = await db
      .insert(taskDependencies)
      .values({
        taskId,
        dependsOnTaskId,
        organizationId,
        workflowId, // SECURITY: Store workflow ID for isolation
        dependencyType,
        lag,
      })
      .returning();

    return dependency;
  }

  /**
   * Delete a task dependency
   */
  static async deleteDependency(dependencyId: string, organizationId: string) {
    const [deleted] = await db
      .delete(taskDependencies)
      .where(
        and(
          eq(taskDependencies.id, dependencyId),
          eq(taskDependencies.organizationId, organizationId)
        )
      )
      .returning();

    if (!deleted) {
      throw new Error("Dependency not found");
    }

    return deleted;
  }

  /**
   * Get all dependencies for a task (predecessors and successors)
   */
  static async getTaskDependencies(taskId: string, organizationId: string) {
    // Get predecessors (tasks this task depends on)
    const predecessors = await db
      .select()
      .from(taskDependencies)
      .where(
        and(
          eq(taskDependencies.taskId, taskId),
          eq(taskDependencies.organizationId, organizationId)
        )
      );

    // Get successors (tasks that depend on this task)
    const successors = await db
      .select()
      .from(taskDependencies)
      .where(
        and(
          eq(taskDependencies.dependsOnTaskId, taskId),
          eq(taskDependencies.organizationId, organizationId)
        )
      );

    return {
      predecessors,
      successors,
    };
  }

  /**
   * Get all dependencies for multiple tasks in a workflow
   */
  static async getWorkflowDependencies(taskIds: string[], organizationId: string) {
    if (taskIds.length === 0) return [];

    const dependencies = await db
      .select()
      .from(taskDependencies)
      .where(
        and(
          or(
            inArray(taskDependencies.taskId, taskIds),
            inArray(taskDependencies.dependsOnTaskId, taskIds)
          ),
          eq(taskDependencies.organizationId, organizationId)
        )
      );

    return dependencies;
  }

  /**
   * Check if adding a dependency would create a cycle using DFS
   */
  private static async wouldCreateCycle(
    taskId: string,
    newPredecessorId: string,
    organizationId: string
  ): Promise<boolean> {
    // Build adjacency list of current dependencies
    const allDeps = await db
      .select()
      .from(taskDependencies)
      .where(eq(taskDependencies.organizationId, organizationId));

    // Create adjacency list: task -> list of tasks it depends on
    const graph = new Map<string, string[]>();
    
    for (const dep of allDeps) {
      if (!graph.has(dep.taskId)) {
        graph.set(dep.taskId, []);
      }
      graph.get(dep.taskId)!.push(dep.dependsOnTaskId);
    }

    // Add the proposed new edge
    if (!graph.has(taskId)) {
      graph.set(taskId, []);
    }
    graph.get(taskId)!.push(newPredecessorId);

    // DFS to detect cycle starting from newPredecessorId
    // If we can reach taskId from newPredecessorId, we have a cycle
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          return true; // Back edge found, cycle detected
        }
      }

      recursionStack.delete(node);
      return false;
    };

    return hasCycle(taskId);
  }

  /**
   * Calculate critical path through a set of tasks
   * Uses actual task durations (estimatedHours) and lag times
   * Returns: { criticalPath: taskId[], criticalPathDuration: hours, taskDetails: {} }
   */
  static async calculateCriticalPath(taskIds: string[], organizationId: string) {
    if (taskIds.length === 0) {
      return { criticalPath: [], criticalPathDuration: 0, taskDetails: {} };
    }

    // Get all tasks with their durations
    const tasks = await db
      .select({
        id: workflowTasks.id,
        name: workflowTasks.name,
        estimatedHours: workflowTasks.estimatedHours,
        actualHours: workflowTasks.actualHours,
        startDate: workflowTasks.startDate,
        dueDate: workflowTasks.dueDate,
      })
      .from(workflowTasks)
      .where(inArray(workflowTasks.id, taskIds));

    // Create task duration map (use actualHours if available, else estimatedHours, default to 1)
    const taskDurations = new Map<string, number>();
    const taskDetails = new Map<string, any>();
    
    for (const task of tasks) {
      const duration = Number(task.actualHours || task.estimatedHours || 1);
      taskDurations.set(task.id, duration);
      taskDetails.set(task.id, task);
    }

    const dependencies = await this.getWorkflowDependencies(taskIds, organizationId);

    // Build dependency graph with lag times
    const graph = new Map<string, Array<{ taskId: string, lag: number }>>();
    const inDegree = new Map<string, number>();
    
    // Initialize
    for (const task of tasks) {
      graph.set(task.id, []);
      inDegree.set(task.id, 0);
    }

    // Build adjacency list with lag information and dependency type
    const dependencyMetadata = new Map<string, Array<{ taskId: string, lag: number, type: string }>>();
    
    for (const dep of dependencies) {
      if (graph.has(dep.dependsOnTaskId) && graph.has(dep.taskId)) {
        const lagHours = dep.lag / 60; // Convert minutes to hours
        
        if (!dependencyMetadata.has(dep.dependsOnTaskId)) {
          dependencyMetadata.set(dep.dependsOnTaskId, []);
        }
        
        dependencyMetadata.get(dep.dependsOnTaskId)!.push({ 
          taskId: dep.taskId, 
          lag: lagHours,
          type: dep.dependencyType 
        });
        
        graph.get(dep.dependsOnTaskId)!.push({ 
          taskId: dep.taskId, 
          lag: lagHours 
        });
        inDegree.set(dep.taskId, (inDegree.get(dep.taskId) || 0) + 1);
      }
    }

    // Topological sort with longest path calculation (weighted by duration + lag)
    const queue: string[] = [];
    const earliestStart = new Map<string, number>();
    const parent = new Map<string, string | null>();

    // Start with tasks that have no dependencies
    for (const [taskId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(taskId);
        earliestStart.set(taskId, 0); // Start time is 0
        parent.set(taskId, null);
      }
    }

    const topologicalOrder: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      topologicalOrder.push(current);

      const currentStart = earliestStart.get(current) || 0;
      const currentDuration = taskDurations.get(current) || 1;
      const currentEnd = currentStart + currentDuration;

      const dependencies = dependencyMetadata.get(current) || [];
      
      for (const { taskId: successor, lag, type } of dependencies) {
        let newStart = 0;
        const successorDuration = taskDurations.get(successor) || 1;
        
        // Calculate earliest start based on dependency type
        switch (type) {
          case "finish-to-start":
            // Successor starts when predecessor finishes + lag
            newStart = currentEnd + lag;
            break;
            
          case "start-to-start":
            // Successor starts when predecessor starts + lag
            newStart = currentStart + lag;
            break;
            
          case "finish-to-finish":
            // Successor finishes when predecessor finishes + lag
            // So successor must start early enough to finish at that time
            const successorEnd = currentEnd + lag;
            newStart = successorEnd - successorDuration;
            break;
            
          case "start-to-finish":
            // Successor finishes when predecessor starts + lag (rare)
            const sfSuccessorEnd = currentStart + lag;
            newStart = sfSuccessorEnd - successorDuration;
            break;
            
          default:
            // Default to finish-to-start
            newStart = currentEnd + lag;
        }
        
        // Update if this gives a later start time (critical path)
        if (!earliestStart.has(successor) || newStart > earliestStart.get(successor)!) {
          earliestStart.set(successor, newStart);
          parent.set(successor, current);
        }

        // Decrease in-degree
        inDegree.set(successor, inDegree.get(successor)! - 1);
        if (inDegree.get(successor) === 0) {
          queue.push(successor);
        }
      }
    }

    // Find the task with maximum end time (end of critical path)
    let maxEndTime = 0;
    let endTask: string | null = null;

    for (const [taskId, startTime] of earliestStart.entries()) {
      const duration = taskDurations.get(taskId) || 1;
      const endTime = startTime + duration;
      
      if (endTime > maxEndTime) {
        maxEndTime = endTime;
        endTask = taskId;
      }
    }

    // Reconstruct critical path by following parent pointers
    const criticalPath: string[] = [];
    let current: string | null = endTask;

    while (current !== null) {
      criticalPath.unshift(current);
      current = parent.get(current) || null;
    }

    // Build detailed task info for critical path
    const criticalTaskDetails: Record<string, any> = {};
    for (const taskId of criticalPath) {
      criticalTaskDetails[taskId] = {
        ...taskDetails.get(taskId),
        earliestStart: earliestStart.get(taskId),
        duration: taskDurations.get(taskId),
      };
    }

    return {
      criticalPath,
      criticalPathDuration: maxEndTime, // Total duration in hours
      taskDetails: criticalTaskDetails,
    };
  }

  /**
   * Validate all dependencies in a workflow for cycles
   */
  static async validateWorkflowDependencies(taskIds: string[], organizationId: string) {
    const dependencies = await this.getWorkflowDependencies(taskIds, organizationId);

    // Build adjacency list
    const graph = new Map<string, string[]>();
    for (const taskId of taskIds) {
      graph.set(taskId, []);
    }

    for (const dep of dependencies) {
      if (graph.has(dep.taskId)) {
        graph.get(dep.taskId)!.push(dep.dependsOnTaskId);
      }
    }

    // DFS cycle detection
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const detectCycle = (node: string, path: string[]): boolean => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (detectCycle(neighbor, [...path])) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // Cycle detected
          const cycleStart = path.indexOf(neighbor);
          cycles.push(path.slice(cycleStart));
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const taskId of taskIds) {
      if (!visited.has(taskId)) {
        detectCycle(taskId, []);
      }
    }

    return {
      isValid: cycles.length === 0,
      cycles,
    };
  }
}
