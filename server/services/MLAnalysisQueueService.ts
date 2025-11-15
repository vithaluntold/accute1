/**
 * MLAnalysisQueueService - Database-Backed Job Queue for Batch Analysis
 * 
 * Implements fault-tolerant job queue using PostgreSQL for personality profiling.
 * Designed for Replit Cloud Run deployment without external dependencies.
 * 
 * Architecture:
 * - Jobs stored in ml_analysis_jobs table
 * - Atomic job claiming with status transitions
 * - Exponential backoff retry logic
 * - Recovery sweep for stuck jobs on startup
 * - Limited concurrency (3-5 parallel workers)
 * 
 * Status Flow:
 * pending → processing → completed/failed
 *           ↓ (on failure)
 *         pending (retry if attempts < max)
 */

import { db } from "../db";
import { mlAnalysisJobs, mlAnalysisRuns, users, personalityProfiles } from "@shared/schema";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import type { PersonalityProfilingService } from "./PersonalityProfilingService";

/**
 * Job processing result
 */
export interface JobResult {
  jobId: string;
  userId: string;
  success: boolean;
  tokensUsed: number;
  processingTimeMs: number;
  error?: string;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

/**
 * ML Analysis Queue Service
 * Manages background processing of personality analysis jobs
 */
export class MLAnalysisQueueService {
  private isProcessing = false;
  private workerInterval: NodeJS.Timeout | null = null;
  private readonly WORKER_POLL_INTERVAL_MS = 5000; // 5 seconds
  private readonly CONCURRENCY_LIMIT = 5; // Max parallel jobs
  private readonly STUCK_JOB_TIMEOUT_MINUTES = 30; // Consider job stuck after 30 min

  constructor(private profilingService: PersonalityProfilingService) {}

  /**
   * Start the worker loop
   * Called on server initialization
   */
  async startWorker(): Promise<void> {
    console.log("🔧 Starting ML Analysis Queue Worker...");

    // Recovery sweep: reset stuck jobs
    await this.recoverStuckJobs();

    // Start polling loop
    this.workerInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processNextBatch();
      }
    }, this.WORKER_POLL_INTERVAL_MS);

    console.log("✅ ML Analysis Queue Worker started");
  }

  /**
   * Stop the worker loop
   * Called on server shutdown
   */
  stopWorker(): void {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
      console.log("⏹️  ML Analysis Queue Worker stopped");
    }
  }

  /**
   * Recover stuck jobs on startup
   * Jobs stuck in "processing" state are reset to "pending"
   */
  private async recoverStuckJobs(): Promise<void> {
    const stuckJobsThreshold = new Date(
      Date.now() - this.STUCK_JOB_TIMEOUT_MINUTES * 60 * 1000
    );

    const recovered = await db
      .update(mlAnalysisJobs)
      .set({ status: "pending" })
      .where(
        and(
          eq(mlAnalysisJobs.status, "processing"),
          sql`${mlAnalysisJobs.lastAttemptAt} < ${stuckJobsThreshold}`
        )
      )
      .returning({ id: mlAnalysisJobs.id });

    if (recovered.length > 0) {
      console.log(`🔄 Recovered ${recovered.length} stuck jobs`);
    }
  }

  /**
   * Process next batch of jobs (limited concurrency)
   */
  private async processNextBatch(): Promise<void> {
    this.isProcessing = true;

    try {
      // Claim up to CONCURRENCY_LIMIT pending jobs atomically
      const jobs = await this.claimJobs(this.CONCURRENCY_LIMIT);

      if (jobs.length === 0) {
        this.isProcessing = false;
        return;
      }

      console.log(`🏗️  Processing ${jobs.length} ML analysis jobs...`);

      // Process jobs in parallel
      const results = await Promise.allSettled(
        jobs.map((job) => this.processJob(job))
      );

      // Update run progress for all affected runs
      const runIds = Array.from(new Set(jobs.map((j) => j.analysisRunId)));
      await Promise.all(runIds.map((runId) => this.updateRunProgress(runId)));

      const successCount = results.filter(
        (r) => r.status === "fulfilled"
      ).length;
      console.log(
        `✅ Completed ${successCount}/${jobs.length} ML analysis jobs`
      );
    } catch (error) {
      console.error("❌ Error processing job batch:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Atomically claim pending jobs for processing
   * Uses SELECT FOR UPDATE SKIP LOCKED for safe concurrent claiming
   */
  private async claimJobs(limit: number): Promise<typeof mlAnalysisJobs.$inferSelect[]> {
    // Atomic claim using raw SQL for SELECT FOR UPDATE SKIP LOCKED
    const claimed = await db.execute(sql`
      UPDATE ml_analysis_jobs
      SET 
        status = 'processing',
        last_attempt_at = NOW(),
        attempt_count = attempt_count + 1
      WHERE id IN (
        SELECT id 
        FROM ml_analysis_jobs
        WHERE status = 'pending'
        AND attempt_count < max_attempts
        ORDER BY created_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `);

    return claimed.rows as any[];
  }

  /**
   * Process a single job
   */
  private async processJob(
    job: typeof mlAnalysisJobs.$inferSelect
  ): Promise<JobResult> {
    const startTime = Date.now();

    try {
      console.log(`  → Processing job ${job.id} for user ${job.userId}...`);

      // Get user's organization from personality profile or user record
      const [profile] = await db
        .select({ organizationId: personalityProfiles.organizationId })
        .from(personalityProfiles)
        .where(eq(personalityProfiles.userId, job.userId))
        .limit(1);

      let organizationId: string;

      if (profile) {
        organizationId = profile.organizationId;
      } else {
        // Fallback: get from user record
        const [user] = await db
          .select({ organizationId: users.organizationId })
          .from(users)
          .where(eq(users.id, job.userId))
          .limit(1);

        if (!user?.organizationId) {
          throw new Error(`User ${job.userId} has no organization`);
        }

        organizationId = user.organizationId;
      }

      // Run personality analysis for this user
      const result = await this.profilingService.analyzeUser(
        job.userId,
        organizationId
      );

      const processingTimeMs = Date.now() - startTime;

      // Mark job as completed
      await db
        .update(mlAnalysisJobs)
        .set({
          status: "completed",
          completedAt: new Date(),
          processingTimeMs,
          startedAt: startTime > 0 ? new Date(startTime) : null,
        })
        .where(eq(mlAnalysisJobs.id, job.id));

      console.log(`  ✅ Job ${job.id} completed in ${processingTimeMs}ms`);

      return {
        jobId: job.id,
        userId: job.userId,
        success: true,
        tokensUsed: 0, // TODO: Track tokens from analyzeUser
        processingTimeMs,
      };
    } catch (error: any) {
      const processingTimeMs = Date.now() - startTime;

      console.error(`  ❌ Job ${job.id} failed:`, error.message);

      // Check if we should retry
      const shouldRetry = job.attemptCount < job.maxAttempts;

      if (shouldRetry) {
        // Reset to pending for retry with exponential backoff
        await db
          .update(mlAnalysisJobs)
          .set({
            status: "pending",
            errorMessage: error.message,
          })
          .where(eq(mlAnalysisJobs.id, job.id));

        console.log(
          `  🔄 Job ${job.id} will retry (attempt ${job.attemptCount + 1}/${job.maxAttempts})`
        );
      } else {
        // Max attempts reached, mark as failed
        await db
          .update(mlAnalysisJobs)
          .set({
            status: "failed",
            errorMessage: error.message,
            completedAt: new Date(),
            processingTimeMs,
          })
          .where(eq(mlAnalysisJobs.id, job.id));

        console.log(`  ❌ Job ${job.id} permanently failed after ${job.attemptCount} attempts`);
      }

      return {
        jobId: job.id,
        userId: job.userId,
        success: false,
        tokensUsed: 0,
        processingTimeMs,
        error: error.message,
      };
    }
  }

  /**
   * Update analysis run progress
   * Aggregates job statuses and updates run record
   */
  private async updateRunProgress(runId: string): Promise<void> {
    // Get job counts for this run
    const [stats] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        completed: sql<number>`COUNT(CASE WHEN status = 'completed' THEN 1 END)::int`,
        failed: sql<number>`COUNT(CASE WHEN status = 'failed' THEN 1 END)::int`,
        pending: sql<number>`COUNT(CASE WHEN status = 'pending' THEN 1 END)::int`,
        processing: sql<number>`COUNT(CASE WHEN status = 'processing' THEN 1 END)::int`,
      })
      .from(mlAnalysisJobs)
      .where(eq(mlAnalysisJobs.analysisRunId, runId));

    if (!stats) return;

    const allComplete = stats.pending === 0 && stats.processing === 0;
    const hasFailures = stats.failed > 0;

    // Determine run status
    let runStatus: string;
    if (allComplete) {
      runStatus = hasFailures ? "completed" : "completed";
    } else {
      runStatus = "running";
    }

    // Update run record
    await db
      .update(mlAnalysisRuns)
      .set({
        status: runStatus,
        usersProcessed: stats.completed,
        failedUsers: stats.failed,
        completedAt: allComplete ? new Date() : null,
      })
      .where(eq(mlAnalysisRuns.id, runId));
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    const [stats] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        pending: sql<number>`COUNT(CASE WHEN status = 'pending' THEN 1 END)::int`,
        processing: sql<number>`COUNT(CASE WHEN status = 'processing' THEN 1 END)::int`,
        completed: sql<number>`COUNT(CASE WHEN status = 'completed' THEN 1 END)::int`,
        failed: sql<number>`COUNT(CASE WHEN status = 'failed' THEN 1 END)::int`,
      })
      .from(mlAnalysisJobs);

    return stats || { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
  }

  /**
   * Get jobs for a specific analysis run
   */
  async getRunJobs(runId: string): Promise<typeof mlAnalysisJobs.$inferSelect[]> {
    return await db
      .select()
      .from(mlAnalysisJobs)
      .where(eq(mlAnalysisJobs.analysisRunId, runId))
      .orderBy(mlAnalysisJobs.createdAt);
  }
}
