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
        const acquired = await this.acquireLock(trigger.id);
        if (!acquired) {
          console.log(`Skipping trigger ${trigger.id}: already being executed by another worker`);
          continue;
        }

        try {
          const nextExecution = await this.executeTrigger(trigger);
          if (nextExecution) {
            await this.releaseLock(trigger.id, nextExecution);
          } else {
            console.warn(`Executor returned null nextExecution for ${trigger.id}, preserving existing value`);
            await this.releaseLock(trigger.id, null, true);
          }
        } catch (error) {
          console.error(`Failed to execute/release trigger ${trigger.id}:`, error);
          const fallbackNext = this.computeFallbackNextExecution(trigger);
          if (fallbackNext) {
            await this.releaseLock(trigger.id, fallbackNext);
          } else {
            console.warn(`Failed to compute fallback nextExecution for ${trigger.id}, preserving existing value`);
            await this.releaseLock(trigger.id, null, true);
          }
        }
      } catch (error) {
        console.error(`Failed to execute trigger ${trigger.id}:`, error);
      }
    }
  }

  private async acquireLock(triggerId: string): Promise<boolean> {
    const now = new Date();
    const lockTimeout = new Date(now.getTime() - 5 * 60 * 1000);

    const locked = await storage.atomicAcquireTriggerLock(triggerId, lockTimeout);
    
    return !!locked;
  }

  private async releaseLock(triggerId: string, nextExecution: Date | null, preserveNext: boolean = false): Promise<void> {
    await storage.releaseTriggerLock(triggerId, nextExecution, preserveNext);
  }

  private async executeTrigger(trigger: schema.AutomationTrigger) {
    const now = new Date();
    let nextExecution: Date | null = null;

    try {
      const { AutomationEngine } = await import('./automation-engine');
      const automationEngine = new AutomationEngine(storage);

      const context = {
        triggerId: trigger.id,
        triggerName: trigger.name,
        organizationId: trigger.organizationId,
        workflowId: trigger.workflowId,
        event: trigger.event,
        scheduleType: trigger.scheduleType,
        executedAt: now,
      };

      await automationEngine.executeActions(
        trigger.actions as any,
        context
      );

      console.log(`✅ Executed scheduled trigger: ${trigger.name} (${trigger.id})`);

      if (trigger.scheduleType === 'cron' && trigger.cronExpression) {
        const interval = parser.parseExpression(trigger.cronExpression, {
          currentDate: now
        });
        nextExecution = interval.next().toDate();
      } else if (trigger.scheduleType === 'one_time') {
        await storage.updateAutomationTrigger(trigger.id, {
          enabled: false,
        });
      }
    } catch (error) {
      console.error(`❌ Failed to execute trigger ${trigger.id}:`, error);
    }

    return nextExecution;
  }

  private computeFallbackNextExecution(trigger: schema.AutomationTrigger): Date | null {
    if (trigger.scheduleType === 'cron' && trigger.cronExpression) {
      try {
        const interval = parser.parseExpression(trigger.cronExpression, {
          currentDate: new Date()
        });
        return interval.next().toDate();
      } catch {
        return null;
      }
    }
    return trigger.nextExecution;
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
