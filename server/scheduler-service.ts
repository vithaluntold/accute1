import parser from 'cron-parser';
import { storage } from './storage';
import * as schema from '@shared/schema';

export class SchedulerService {
  private static instance: SchedulerService;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  start() {
    if (this.isRunning) {
      console.log('Scheduler already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting automation scheduler...');

    this.intervalId = setInterval(async () => {
      try {
        await this.checkAndExecuteTriggers();
      } catch (error) {
        console.error('Scheduler error:', error);
      }
    }, 60000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Scheduler stopped');
  }

  private async checkAndExecuteTriggers() {
    const triggers = await storage.getScheduledTriggersDueForExecution();
    
    for (const trigger of triggers) {
      try {
        await this.executeTrigger(trigger);
      } catch (error) {
        console.error(`Failed to execute trigger ${trigger.id}:`, error);
      }
    }
  }

  private async executeTrigger(trigger: schema.AutomationTrigger) {
    const now = new Date();

    if (trigger.scheduleType === 'cron' && trigger.cronExpression) {
      const interval = parser.parseExpression(trigger.cronExpression);
      const nextRun = interval.next().toDate();
      
      await storage.updateAutomationTrigger(trigger.id, {
        lastExecuted: now,
        nextExecution: nextRun,
      });
    } else if (trigger.scheduleType === 'one_time') {
      await storage.updateAutomationTrigger(trigger.id, {
        lastExecuted: now,
        enabled: false,
      });
    }

    console.log(`Executed scheduled trigger: ${trigger.name} (${trigger.id})`);
  }

  static computeNextCronExecution(cronExpression: string): Date | null {
    try {
      const interval = parser.parseExpression(cronExpression);
      return interval.next().toDate();
    } catch (error) {
      console.error('Invalid cron expression:', cronExpression, error);
      return null;
    }
  }

  static validateCronExpression(cronExpression: string): boolean {
    try {
      parser.parseExpression(cronExpression);
      return true;
    } catch {
      return false;
    }
  }
}

export const schedulerService = SchedulerService.getInstance();
