/**
 * Personality Profiling API Routes
 * 
 * Endpoints for AI Personality Profiling & Performance Monitoring system.
 * Provides access to multi-framework personality analysis using ML model fusion.
 * 
 * Features:
 * - Batch analysis triggering
 * - Real-time progress tracking
 * - User profile retrieval
 * - Consent management (GDPR-compliant)
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { createPersonalityProfilingService } from "./service-factory";
import { createMLAnalysisQueueService } from "./service-factory";
import { requireAuth } from "./auth";
import { db } from "./db";
import { users } from "@shared/schema";
import { inArray } from "drizzle-orm";

const profilingService = createPersonalityProfilingService();
const queueService = createMLAnalysisQueueService();

/**
 * Batch analysis request schema
 */
const batchAnalysisSchema = z.object({
  userIds: z.array(z.string()).min(1).max(100), // Limit to 100 users per batch
});

/**
 * Consent update schema
 */
const consentUpdateSchema = z.object({
  consented: z.boolean(),
});

export function registerPersonalityProfilingRoutes(app: Express) {
  /**
   * POST /api/personality-profiling/batch-analysis
   * Trigger batch personality analysis for multiple users
   * 
   * Requires: Admin role
   * Body: { userIds: string[] }
   * Returns: Analysis run record with tracking ID
   */
  app.post(
    "/api/personality-profiling/batch-analysis",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        // Role check: Only admins can trigger batch analysis
        if (req.user!.role !== "super_admin" && req.user!.role !== "admin") {
          return res.status(403).json({
            message: "Only admins can trigger batch personality analysis",
          });
        }

        // Validate request body
        const parseResult = batchAnalysisSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({
            message: "Invalid request body",
            errors: parseResult.error.errors,
          });
        }

        const { userIds } = parseResult.data;
        const organizationId = req.user!.organizationId!;

        // Verify all users belong to the organization
        const orgUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, userIds));

        if (orgUsers.length !== userIds.length) {
          return res.status(400).json({
            message: "Some users do not exist or do not belong to your organization",
          });
        }

        // Trigger batch analysis (creates jobs for background processing)
        const analysisRun = await profilingService.runBatchAnalysis(
          organizationId,
          userIds
        );

        return res.status(202).json({
          message: "Batch analysis started",
          analysisRun: {
            id: analysisRun.id,
            status: analysisRun.status,
            totalUsers: analysisRun.totalUsers,
            usersProcessed: analysisRun.usersProcessed,
            failedUsers: analysisRun.failedUsers,
            createdAt: analysisRun.startedAt,
          },
        });
      } catch (error: any) {
        console.error("Error triggering batch analysis:", error);
        return res.status(500).json({
          message: "Failed to trigger batch analysis",
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/personality-profiling/runs/:runId
   * Get analysis run status and progress
   * 
   * Requires: Admin role
   * Returns: Run details with progress metrics
   */
  app.get(
    "/api/personality-profiling/runs/:runId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { runId } = req.params;

        // Get analysis run
        const analysisRun = await profilingService.getAnalysisRun(runId);

        // Organization check
        if (analysisRun.organizationId !== req.user!.organizationId) {
          return res.status(404).json({ message: "Analysis run not found" });
        }

        // Role check: Only admins can view runs
        if (req.user!.role !== "super_admin" && req.user!.role !== "admin") {
          return res.status(403).json({
            message: "Only admins can view analysis runs",
          });
        }

        return res.json({
          id: analysisRun.id,
          status: analysisRun.status,
          totalUsers: analysisRun.totalUsers,
          usersProcessed: analysisRun.usersProcessed,
          failedUsers: analysisRun.failedUsers,
          tokensConsumed: analysisRun.tokensConsumed,
          processingTimeSeconds: analysisRun.processingTimeSeconds,
          createdAt: analysisRun.startedAt,
          completedAt: analysisRun.completedAt,
          progress: analysisRun.totalUsers > 0
            ? Math.round((analysisRun.usersProcessed / analysisRun.totalUsers) * 100)
            : 0,
        });
      } catch (error: any) {
        console.error("Error fetching analysis run:", error);
        return res.status(500).json({
          message: "Failed to fetch analysis run",
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/personality-profiling/runs/:runId/jobs
   * Get individual jobs for an analysis run
   * 
   * Requires: Admin role
   * Returns: Array of job records with status
   */
  app.get(
    "/api/personality-profiling/runs/:runId/jobs",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { runId } = req.params;

        // Get analysis run (for org check)
        const analysisRun = await profilingService.getAnalysisRun(runId);

        // Organization check
        if (analysisRun.organizationId !== req.user!.organizationId) {
          return res.status(404).json({ message: "Analysis run not found" });
        }

        // Role check: Only admins can view jobs
        if (req.user!.role !== "super_admin" && req.user!.role !== "admin") {
          return res.status(403).json({
            message: "Only admins can view analysis jobs",
          });
        }

        // Get jobs for this run
        const jobs = await queueService.getRunJobs(runId);

        return res.json({
          runId,
          totalJobs: jobs.length,
          jobs: jobs.map((job) => ({
            id: job.id,
            userId: job.userId,
            status: job.status,
            attemptCount: job.attemptCount,
            maxAttempts: job.maxAttempts,
            processingTimeMs: job.processingTimeMs,
            errorMessage: job.errorMessage,
            createdAt: job.createdAt,
            completedAt: job.completedAt,
          })),
        });
      } catch (error: any) {
        console.error("Error fetching analysis jobs:", error);
        return res.status(500).json({
          message: "Failed to fetch analysis jobs",
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/personality-profiling/profiles/:userId
   * Get personality profile for a user
   * 
   * Requires: Auth (users can view their own, admins can view any)
   * Returns: Complete personality profile with traits
   */
  app.get(
    "/api/personality-profiling/profiles/:userId",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { userId } = req.params;

        // Permission check: Users can only view their own profile unless admin
        const isAdmin =
          req.user!.role === "super_admin" || req.user!.role === "admin";
        if (!isAdmin && req.user!.id !== userId) {
          return res.status(403).json({
            message: "You can only view your own personality profile",
          });
        }

        const organizationId = req.user!.organizationId!;

        // Get profile
        const profile = await profilingService.getProfile(userId, organizationId);

        if (!profile) {
          return res.status(404).json({
            message: "Personality profile not found. User may need to complete analysis first.",
          });
        }

        // Get traits
        const traits = await profilingService.getTraits(profile.id);

        return res.json({
          profile: {
            id: profile.id,
            userId: profile.userId,
            overallConfidence: profile.overallConfidence,
            mbtiType: profile.mbtiType,
            mbtiConfidence: profile.mbtiConfidence,
            discPrimary: profile.discPrimary,
            discConfidence: profile.discConfidence,
            lastAnalyzedAt: profile.lastAnalyzedAt,
            analysisConsented: profile.analysisConsented,
          },
          traits: traits.map((trait) => ({
            id: trait.id,
            framework: trait.framework,
            traitName: trait.traitName,
            score: trait.score,
            confidence: trait.confidence,
          })),
        });
      } catch (error: any) {
        console.error("Error fetching personality profile:", error);
        return res.status(500).json({
          message: "Failed to fetch personality profile",
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/personality-profiling/consent
   * Get current user's consent status
   * 
   * Requires: Auth
   * Returns: Consent status for personality profiling
   */
  app.get(
    "/api/personality-profiling/consent",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const organizationId = req.user!.organizationId!;

        const consented = await profilingService.getConsent(
          userId,
          organizationId
        );

        return res.json({
          userId,
          organizationId,
          consented,
        });
      } catch (error: any) {
        console.error("Error fetching consent status:", error);
        return res.status(500).json({
          message: "Failed to fetch consent status",
          error: error.message,
        });
      }
    }
  );

  /**
   * POST /api/personality-profiling/consent
   * Update current user's consent for personality profiling
   * 
   * Requires: Auth
   * Body: { consented: boolean }
   * Returns: Updated consent status
   */
  app.post(
    "/api/personality-profiling/consent",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        // Validate request body
        const parseResult = consentUpdateSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({
            message: "Invalid request body",
            errors: parseResult.error.errors,
          });
        }

        const { consented } = parseResult.data;
        const userId = req.user!.id;
        const organizationId = req.user!.organizationId!;

        await profilingService.updateConsent(userId, organizationId, consented);

        return res.json({
          message: `Personality profiling consent ${consented ? "granted" : "revoked"}`,
          userId,
          organizationId,
          consented,
        });
      } catch (error: any) {
        console.error("Error updating consent:", error);
        return res.status(500).json({
          message: "Failed to update consent",
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/personality-profiling/queue/stats
   * Get queue statistics (admin only)
   * 
   * Requires: Admin role
   * Returns: Queue metrics (pending, processing, completed, failed)
   */
  app.get(
    "/api/personality-profiling/queue/stats",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        // Role check: Only admins can view queue stats
        if (req.user!.role !== "super_admin" && req.user!.role !== "admin") {
          return res.status(403).json({
            message: "Only admins can view queue statistics",
          });
        }

        const stats = await queueService.getQueueStats();

        return res.json(stats);
      } catch (error: any) {
        console.error("Error fetching queue stats:", error);
        return res.status(500).json({
          message: "Failed to fetch queue statistics",
          error: error.message,
        });
      }
    }
  );
}
