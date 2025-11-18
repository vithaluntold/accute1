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
import type { AuthRequest } from "./auth";
import { z } from "zod";
import { createPersonalityProfilingService } from "./service-factory";
import { createMLAnalysisQueueService } from "./service-factory";
import { requireAuth } from "./auth";
import { requireFeature } from "./feature-gating";
import { db } from "./db";
import * as schema from "@shared/schema";
import { users, personalityProfiles, performanceScores, mlAnalysisRuns } from "@shared/schema";
import { inArray, eq, and, desc } from "drizzle-orm";

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
  hasConsented: z.boolean(),
});

export function registerPersonalityProfilingRoutes(app: Express) {
  /**
   * POST /api/personality-profiling/batch-analysis
   * Trigger batch personality analysis for multiple users
   * 
   * Requires: Admin role + Enterprise subscription (personality_assessment feature)
   * Body: { userIds: string[] }
   * Returns: Analysis run record with tracking ID
   */
  app.post(
    "/api/personality-profiling/batch-analysis",
    requireAuth,
    requireFeature('personality_assessment'),
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

        // CRITICAL: Verify all users belong to the SAME organization as the requester
        const orgUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              inArray(users.id, userIds),
              eq(users.organizationId, organizationId)
            )
          );

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
   * GET /api/personality-profiling/runs
   * Get all analysis runs for the organization
   * 
   * Requires: Admin role + Enterprise subscription (personality_assessment feature)
   * Returns: List of analysis runs with progress metrics
   */
  app.get(
    "/api/personality-profiling/runs",
    requireAuth,
    requireFeature('personality_assessment'),
    async (req: Request, res: Response) => {
      try {
        // Role check: Only admins can view runs
        if (req.user!.role !== "super_admin" && req.user!.role !== "admin") {
          return res.status(403).json({
            message: "Only admins can view analysis runs",
          });
        }

        const organizationId = req.user!.organizationId!;

        // Fetch all runs for this organization
        const runs = await db
          .select()
          .from(mlAnalysisRuns)
          .where(eq(mlAnalysisRuns.organizationId, organizationId))
          .orderBy(desc(mlAnalysisRuns.createdAt))
          .limit(50); // Limit to last 50 runs

        return res.json({
          runs: runs.map((run) => ({
            id: run.id,
            status: run.status,
            runType: run.runType,
            totalUsers: run.totalUsers,
            usersProcessed: run.usersProcessed,
            failedUsers: run.failedUsers,
            conversationsAnalyzed: run.conversationsAnalyzed,
            tokensConsumed: run.tokensConsumed,
            processingTimeSeconds: run.processingTimeSeconds,
            createdAt: run.createdAt,
            updatedAt: run.updatedAt,
            progress: run.totalUsers > 0
              ? Math.round((run.usersProcessed / run.totalUsers) * 100)
              : 0,
          })),
          totalRuns: runs.length,
        });
      } catch (error: any) {
        console.error("Error fetching analysis runs:", error);
        return res.status(500).json({
          message: "Failed to fetch analysis runs",
          error: error.message,
        });
      }
    }
  );

  /**
   * GET /api/personality-profiling/runs/:runId
   * Get analysis run status and progress
   * 
   * Requires: Admin role + Enterprise subscription (personality_assessment feature)
   * Returns: Run details with progress metrics
   */
  app.get(
    "/api/personality-profiling/runs/:runId",
    requireAuth,
    requireFeature('personality_assessment'),
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
   * Requires: Admin role + Enterprise subscription (personality_assessment feature)
   * Returns: Array of job records with status
   */
  app.get(
    "/api/personality-profiling/runs/:runId/jobs",
    requireAuth,
    requireFeature('personality_assessment'),
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
   * Requires: Auth + Enterprise subscription (personality_assessment feature)
   * Note: Users can view their own, admins can view any
   * Returns: Complete personality profile with traits
   */
  app.get(
    "/api/personality-profiling/profiles/:userId",
    requireAuth,
    requireFeature('personality_assessment'),
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
   * GET /api/personality-profiling/profiles/me
   * Get current user's personality profile
   * 
   * Requires: Auth + Enterprise subscription (personality_assessment feature)
   * Returns: Complete personality profile with traits for the authenticated user
   */
  app.get(
    "/api/personality-profiling/profiles/me",
    requireAuth,
    requireFeature('personality_assessment'),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const organizationId = req.user!.organizationId!;

        // Get profile
        const profile = await profilingService.getProfile(userId, organizationId);

        if (!profile) {
          return res.status(404).json({
            message: "Personality profile not found. Analysis may not have been run yet, or consent may not be granted.",
          });
        }

        // Get traits
        const traits = await profilingService.getTraits(profile.id);

        return res.json({
          userId: profile.userId,
          bigFiveTraits: profile.bigFiveTraits,
          discProfile: profile.discProfile,
          mbtiType: profile.mbtiType,
          emotionalIntelligence: profile.emotionalIntelligence,
          hofstedeFactors: profile.hofstedeFactors,
          culturalContext: profile.culturalContext,
          confidenceScore: profile.overallConfidence / 100,
          lastAnalyzedAt: profile.updatedAt,
          conversationsAnalyzed: profile.conversationsAnalyzed,
        });
      } catch (error: any) {
        console.error("Error fetching current user's personality profile:", error);
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
   * Requires: Auth + Enterprise subscription (personality_assessment feature)
   * Returns: Consent status for personality profiling
   */
  app.get(
    "/api/personality-profiling/consent",
    requireAuth,
    requireFeature('personality_assessment'),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const organizationId = req.user!.organizationId!;

        const hasConsented = await profilingService.getConsent(
          userId,
          organizationId
        );

        return res.json({
          userId,
          organizationId,
          hasConsented,
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
   * Requires: Auth + Enterprise subscription (personality_assessment feature)
   * Body: { hasConsented: boolean }
   * Returns: Updated consent status
   */
  app.post(
    "/api/personality-profiling/consent",
    requireAuth,
    requireFeature('personality_assessment'),
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

        const { hasConsented } = parseResult.data;
        const userId = req.user!.id;
        const organizationId = req.user!.organizationId!;

        await profilingService.updateConsent(userId, organizationId, hasConsented);

        return res.json({
          message: `Personality profiling consent ${hasConsented ? "granted" : "revoked"}`,
          userId,
          organizationId,
          hasConsented,
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
   * Requires: Admin role + Enterprise subscription (personality_assessment feature)
   * Returns: Queue metrics (pending, processing, completed, failed)
   */
  app.get(
    "/api/personality-profiling/queue/stats",
    requireAuth,
    requireFeature('personality_assessment'),
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

  /**
   * GET /api/personality-profiling/performance-correlations
   * Get correlations between personality traits and performance metrics
   * 
   * Requires: Admin role + Enterprise subscription (personality_assessment feature)
   * Returns: Organization-wide personality-performance correlation insights
   */
  app.get(
    "/api/personality-profiling/performance-correlations",
    requireAuth,
    requireFeature('personality_assessment'),
    async (req: AuthRequest, res: Response) => {
      try {
        // Role check: Only admins can view correlations
        if (req.user!.role !== "super_admin" && req.user!.role !== "admin") {
          return res.status(403).json({
            message: "Only admins can view performance correlations",
          });
        }

        // CRITICAL: Validate organization membership
        const organizationId = req.user!.organizationId;
        if (!organizationId) {
          return res.status(403).json({
            error: "Organization access required to view correlations",
          });
        }

        // Fetch all personality profiles for users in organization
        const profiles = await db
          .select()
          .from(personalityProfiles)
          .where(eq(personalityProfiles.organizationId, organizationId));

        if (profiles.length < 5) {
          return res.status(200).json({
            message: "Insufficient data for correlation analysis",
            minRequired: 5,
            currentCount: profiles.length,
            correlations: [],
          });
        }

        // Fetch performance scores for these users
        const userIds = profiles.map((p) => p.userId);
        const performanceScores = await db
          .select()
          .from(schema.performanceScores)
          .where(
            and(
              eq(schema.performanceScores.organizationId, organizationId),
              inArray(schema.performanceScores.userId, userIds)
            )
          );

        // Calculate correlations
        const correlations: any[] = [];
        
        // Helper: Pearson correlation coefficient
        const calculateCorrelation = (x: number[], y: number[]): number => {
          if (x.length !== y.length || x.length === 0) return 0;
          
          const n = x.length;
          const sumX = x.reduce((a, b) => a + b, 0);
          const sumY = y.reduce((a, b) => a + b, 0);
          const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
          const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
          const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
          
          const numerator = n * sumXY - sumX * sumY;
          const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
          
          return denominator === 0 ? 0 : numerator / denominator;
        };

        // Group performance scores by metric
        const scoresByMetric = performanceScores.reduce((acc, score) => {
          if (!acc[score.metricDefinitionId]) {
            acc[score.metricDefinitionId] = [];
          }
          acc[score.metricDefinitionId].push(score);
          return acc;
        }, {} as Record<string, any[]>);

        // Analyze Big Five traits vs performance metrics
        if (profiles.some((p) => p.bigFiveTraits)) {
          const traits = ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"];
          
          for (const trait of traits) {
            for (const [metricId, scores] of Object.entries(scoresByMetric)) {
              const pairs: Array<{ trait: number; performance: number }> = [];
              
              for (const score of scores) {
                const profile = profiles.find((p) => p.userId === score.userId);
                if (profile?.bigFiveTraits && (profile.bigFiveTraits as any)[trait] != null) {
                  pairs.push({
                    trait: (profile.bigFiveTraits as any)[trait],
                    performance: Number(score.scoreValue),
                  });
                }
              }
              
              if (pairs.length >= 3) {
                const traitValues = pairs.map((p) => p.trait);
                const perfValues = pairs.map((p) => p.performance);
                const correlation = calculateCorrelation(traitValues, perfValues);
                
                if (Math.abs(correlation) > 0.1) {
                  correlations.push({
                    framework: "Big Five",
                    trait,
                    metricId,
                    correlation: Math.round(correlation * 1000) / 1000,
                    sampleSize: pairs.length,
                    strength: Math.abs(correlation) > 0.5 ? "strong" : Math.abs(correlation) > 0.3 ? "moderate" : "weak",
                    direction: correlation > 0 ? "positive" : "negative",
                  });
                }
              }
            }
          }
        }

        res.json({
          organizationId,
          profilesAnalyzed: profiles.length,
          correlations: correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)),
          generatedAt: new Date().toISOString(),
        });
      } catch (error: any) {
        console.error("[Personality Profiling] Failed to calculate correlations:", error);
        res.status(500).json({ error: "Failed to calculate performance correlations" });
      }
    }
  );
}
