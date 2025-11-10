/**
 * Onboarding Progression Service
 * Handles day advancement logic and automatic task creation
 */

import { IStorage } from './storage';
import { getTasksForDay, hasDayTemplates } from './onboardingTemplates';

export class OnboardingProgressService {
  constructor(private storage: IStorage) {}

  /**
   * Check if user has completed all required tasks for current day
   * If yes, advance to next day and create next day's tasks
   * Called after each task completion
   */
  async checkAndAdvance(progressId: string): Promise<{
    advanced: boolean;
    newDay?: number;
    tasksCreated?: number;
  }> {
    // Get current progress
    const progress = await this.storage.getOnboardingProgress(progressId);
    if (!progress) {
      throw new Error('Onboarding progress not found');
    }

    // Don't advance if already completed
    if (progress.isCompleted) {
      return { advanced: false };
    }

    const currentDay = progress.currentDay;

    // Get all tasks for current day
    const allTasks = await this.storage.getOnboardingTasksByProgress(progressId);
    const currentDayTasks = allTasks.filter(t => t.day === currentDay);

    // Check if all REQUIRED tasks for current day are completed
    const requiredTasks = currentDayTasks.filter(t => t.requiredForDay);
    const completedRequiredTasks = requiredTasks.filter(t => t.isCompleted);

    console.log(`[Onboarding] Day ${currentDay}: ${completedRequiredTasks.length}/${requiredTasks.length} required tasks completed`);

    // If not all required tasks are done, don't advance
    if (completedRequiredTasks.length < requiredTasks.length) {
      return { advanced: false };
    }

    // All required tasks completed! Advance to next day
    const nextDay = currentDay + 1;

    // Check if onboarding is complete (Day 21 finished)
    if (nextDay > 21) {
      await this.storage.updateOnboardingProgress(progressId, {
        isCompleted: true,
        completedAt: new Date(),
      });
      console.log(`[Onboarding] Journey completed! 🎉`);
      return { advanced: true, newDay: 21 };
    }

    // Update current day
    await this.storage.updateOnboardingProgress(progressId, {
      currentDay: nextDay,
    });

    console.log(`[Onboarding] Advanced from Day ${currentDay} to Day ${nextDay}`);

    // Create tasks for next day if templates exist
    let tasksCreated = 0;
    if (hasDayTemplates(nextDay)) {
      tasksCreated = await this.createTasksForDay(progressId, nextDay);
      console.log(`[Onboarding] Created ${tasksCreated} tasks for Day ${nextDay}`);
    } else {
      console.log(`[Onboarding] No task templates defined for Day ${nextDay} yet`);
    }

    return {
      advanced: true,
      newDay: nextDay,
      tasksCreated,
    };
  }

  /**
   * Create tasks for a specific day from templates
   * Idempotent - won't create duplicates
   */
  async createTasksForDay(progressId: string, day: number): Promise<number> {
    // Check if tasks already exist (idempotency)
    const existingTasks = await this.storage.getOnboardingTasksByDay(progressId, day);
    if (existingTasks.length > 0) {
      console.log(`[Onboarding] Tasks for Day ${day} already exist, skipping creation`);
      return 0;
    }

    const templates = getTasksForDay(day);
    if (templates.length === 0) {
      return 0;
    }

    // Create all tasks for this day
    for (const template of templates) {
      await this.storage.createOnboardingTask({
        progressId,
        day,
        taskId: template.taskId,
        taskType: template.taskType,
        title: template.title,
        description: template.description || undefined,
        requiredForDay: template.requiredForDay,
        points: template.points,
        actionUrl: template.actionUrl || undefined,
        estimatedMinutes: template.estimatedMinutes || undefined,
        videoUrl: template.videoUrl || undefined,
      });
    }

    return templates.length;
  }
}
