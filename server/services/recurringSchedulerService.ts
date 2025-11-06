import { db } from "../db";
import { recurringSchedules, workflowAssignments, clients } from "@shared/schema";
import { eq, and, lte, sql } from "drizzle-orm";

export class RecurringSchedulerService {
  private static instance: RecurringSchedulerService;
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor() {}

  static getInstance(): RecurringSchedulerService {
    if (!RecurringSchedulerService.instance) {
      RecurringSchedulerService.instance = new RecurringSchedulerService();
    }
    return RecurringSchedulerService.instance;
  }

  start(intervalMinutes: number = 5): void {
    if (this.intervalHandle) {
      console.log("Recurring scheduler already running");
      return;
    }

    console.log(`Starting recurring scheduler (checking every ${intervalMinutes} minutes)...`);
    
    this.processSchedules();
    
    this.intervalHandle = setInterval(() => {
      this.processSchedules();
    }, intervalMinutes * 60 * 1000);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log("Recurring scheduler stopped");
    }
  }

  async processSchedules(): Promise<void> {
    if (this.isRunning) {
      console.log("Recurring scheduler already processing, skipping...");
      return;
    }

    this.isRunning = true;
    
    try {
      const now = new Date();
      
      const dueSchedules = await db
        .select()
        .from(recurringSchedules)
        .where(
          and(
            eq(recurringSchedules.isActive, true),
            lte(recurringSchedules.nextRunAt, now)
          )
        );

      if (dueSchedules.length === 0) {
        console.log("No recurring schedules due for processing");
        return;
      }

      console.log(`Processing ${dueSchedules.length} recurring schedules...`);

      for (const schedule of dueSchedules) {
        try {
          await this.processSchedule(schedule);
        } catch (error) {
          console.error(`Failed to process schedule ${schedule.id}:`, error);
        }
      }
    } catch (error) {
      console.error("Error in recurring scheduler:", error);
    } finally {
      this.isRunning = false;
    }
  }

  private async processSchedule(schedule: typeof recurringSchedules.$inferSelect): Promise<void> {
    console.log(`Processing schedule: ${schedule.name} (${schedule.id})`);

    if (schedule.endDate && new Date(schedule.endDate) < new Date()) {
      console.log(`Schedule ${schedule.id} has ended, deactivating...`);
      await db
        .update(recurringSchedules)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(recurringSchedules.id, schedule.id));
      return;
    }

    const template = schedule.assignmentTemplate as any;
    
    const assignmentData: any = {
      workflowId: schedule.workflowId,
      organizationId: schedule.organizationId,
      status: template?.status || 'not-started',
      priority: template?.priority || 'medium',
      assignedTo: template?.assignedTo || null,
      dueDate: template?.dueDate ? new Date(template.dueDate) : null,
      metadata: {
        ...template?.metadata || {},
        createdBySchedule: schedule.id,
        scheduleName: schedule.name,
        scheduleRunCount: schedule.runCount + 1,
      },
    };

    if (template?.clientId) {
      const client = await db
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.id, template.clientId),
            eq(clients.organizationId, schedule.organizationId)
          )
        )
        .limit(1);

      if (client.length > 0) {
        assignmentData.clientId = template.clientId;
      } else {
        console.log(`Client ${template.clientId} not found, creating assignment without client`);
      }
    }

    await db.insert(workflowAssignments).values(assignmentData);
    console.log(`Created assignment from schedule ${schedule.id}${template?.clientId ? ` for client ${template.clientId}` : ' (no client)'}`);

    const nextRun = this.calculateNextRun(
      new Date(),
      schedule.frequency,
      schedule.interval,
      schedule.dayOfWeek,
      schedule.dayOfMonth,
      schedule.monthOfYear,
      schedule.timeOfDay
    );

    await db
      .update(recurringSchedules)
      .set({
        lastRunAt: new Date(),
        nextRunAt: nextRun,
        runCount: schedule.runCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(recurringSchedules.id, schedule.id));

    console.log(`Schedule ${schedule.id} processed successfully, next run: ${nextRun.toISOString()}`);
  }

  private calculateNextRun(
    fromDate: Date,
    frequency: string,
    interval: number,
    dayOfWeek: number | null,
    dayOfMonth: number | null,
    monthOfYear: number | null,
    timeOfDay: string | null
  ): Date {
    const nextRun = new Date(fromDate);

    if (timeOfDay) {
      const [hours, minutes, seconds] = timeOfDay.split(':').map(Number);
      nextRun.setHours(hours, minutes, seconds || 0, 0);
    }

    switch (frequency) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + interval);
        break;

      case 'weekly':
        nextRun.setDate(nextRun.getDate() + (7 * interval));
        if (dayOfWeek !== null) {
          while (nextRun.getDay() !== dayOfWeek) {
            nextRun.setDate(nextRun.getDate() + 1);
          }
        }
        break;

      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + interval);
        if (dayOfMonth !== null) {
          nextRun.setDate(Math.min(dayOfMonth, this.getDaysInMonth(nextRun)));
        }
        break;

      case 'quarterly':
        nextRun.setMonth(nextRun.getMonth() + (3 * interval));
        if (dayOfMonth !== null) {
          nextRun.setDate(Math.min(dayOfMonth, this.getDaysInMonth(nextRun)));
        }
        break;

      case 'annually':
        nextRun.setFullYear(nextRun.getFullYear() + interval);
        if (monthOfYear !== null) {
          nextRun.setMonth(monthOfYear - 1);
        }
        if (dayOfMonth !== null) {
          nextRun.setDate(Math.min(dayOfMonth, this.getDaysInMonth(nextRun)));
        }
        break;

      default:
        console.warn(`Unknown frequency: ${frequency}, defaulting to daily`);
        nextRun.setDate(nextRun.getDate() + interval);
    }

    if (nextRun <= fromDate) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return nextRun;
  }

  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  async manualTrigger(scheduleId: string): Promise<void> {
    const schedule = await db
      .select()
      .from(recurringSchedules)
      .where(eq(recurringSchedules.id, scheduleId))
      .limit(1);

    if (schedule.length === 0) {
      throw new Error("Schedule not found");
    }

    await this.processSchedule(schedule[0]);
  }
}

export const getRecurringSchedulerService = () => RecurringSchedulerService.getInstance();
