import type { Express, Response } from "express";
import { z, ZodError } from "zod";
import { requireAuth, requirePermission, logActivity, type AuthRequest } from "./auth";
import { PerformanceMetricsService } from "./services/PerformanceMetricsService";
import { 
  insertPerformanceMetricDefinitionSchema, 
  insertPerformanceScoreSchema 
} from "@shared/schema";

export function registerPerformanceMetricsRoutes(app: Express) {
  const metricsService = new PerformanceMetricsService();

  // ==================== PERFORMANCE METRIC SUGGESTIONS ====================

  /**
   * GET /api/performance-metrics/suggestions
   * Get AI-suggested performance metrics for the organization
   * Requires: reports.view
   */
  app.get(
    "/api/performance-metrics/suggestions",
    requireAuth,
    requirePermission("reports.view"),
    async (req: AuthRequest, res: Response) => {
      try {
        const organizationId = req.user?.organizationId;
        const currentUserId = req.user?.id;

        if (!organizationId || !currentUserId) {
          return res.status(403).json({ error: "Organization access required" });
        }

        const suggestions = await metricsService.suggestMetrics(organizationId);

        await logActivity(
          currentUserId,
          organizationId,
          "view",
          "performance_metric_suggestions",
          organizationId,
          {},
          req
        );

        res.json({ suggestions });
      } catch (error: any) {
        console.error("[Performance Metrics] Failed to fetch suggestions:", error);
        res.status(500).json({ 
          error: "Failed to generate metric suggestions",
          details: error.message 
        });
      }
    }
  );

  // ==================== METRIC DEFINITION CRUD ====================

  /**
   * POST /api/performance-metrics
   * Create a new performance metric definition
   * Requires: settings.manage
   */
  app.post(
    "/api/performance-metrics",
    requireAuth,
    requirePermission("settings.manage"),
    async (req: AuthRequest, res: Response) => {
      try {
        const organizationId = req.user?.organizationId;
        const currentUserId = req.user?.id;

        if (!organizationId || !currentUserId) {
          return res.status(403).json({ error: "Organization access required" });
        }

        const validated = insertPerformanceMetricDefinitionSchema.parse({
          ...req.body,
          organizationId,
        });

        const metric = await metricsService.createMetric(validated);

        await logActivity(
          currentUserId,
          organizationId,
          "create",
          "performance_metric_definition",
          metric.id,
          {},
          req
        );

        res.status(201).json(metric);
      } catch (error: any) {
        if (error instanceof ZodError) {
          return res.status(400).json({ 
            error: "Validation failed", 
            details: error.errors 
          });
        }
        console.error("[Performance Metrics] Failed to create metric:", error);
        res.status(500).json({ error: "Failed to create metric definition" });
      }
    }
  );

  /**
   * GET /api/performance-metrics
   * List all active performance metrics for the organization
   * Requires: reports.view
   */
  app.get(
    "/api/performance-metrics",
    requireAuth,
    requirePermission("reports.view"),
    async (req: AuthRequest, res: Response) => {
      try {
        const organizationId = req.user?.organizationId;

        if (!organizationId) {
          return res.status(403).json({ error: "Organization access required" });
        }

        const metrics = await metricsService.getOrganizationMetrics(organizationId);
        res.json({ metrics });
      } catch (error: any) {
        console.error("[Performance Metrics] Failed to fetch metrics:", error);
        res.status(500).json({ error: "Failed to fetch metrics" });
      }
    }
  );

  /**
   * PATCH /api/performance-metrics/:id
   * Update a performance metric definition
   * Requires: settings.manage
   */
  app.patch(
    "/api/performance-metrics/:id",
    requireAuth,
    requirePermission("settings.manage"),
    async (req: AuthRequest, res: Response) => {
      try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;
        const currentUserId = req.user?.id;

        if (!organizationId || !currentUserId) {
          return res.status(403).json({ error: "Organization access required" });
        }

        const updateSchema = insertPerformanceMetricDefinitionSchema
          .partial()
          .omit({
            id: true,
            organizationId: true,
            createdAt: true,
            updatedAt: true,
          });

        const validated = updateSchema.parse(req.body);
        const metric = await metricsService.updateMetric(id, organizationId, validated);

        await logActivity(
          currentUserId,
          organizationId,
          "update",
          "performance_metric_definition",
          metric.id,
          {},
          req
        );

        res.json(metric);
      } catch (error: any) {
        if (error.message === "Metric not found") {
          return res.status(404).json({ error: error.message });
        }
        if (error instanceof ZodError) {
          return res.status(400).json({ 
            error: "Validation failed", 
            details: error.errors 
          });
        }
        console.error("[Performance Metrics] Failed to update metric:", error);
        res.status(500).json({ error: "Failed to update metric definition" });
      }
    }
  );

  /**
   * DELETE /api/performance-metrics/:id
   * Delete (soft delete) a performance metric definition
   * Requires: settings.manage
   */
  app.delete(
    "/api/performance-metrics/:id",
    requireAuth,
    requirePermission("settings.manage"),
    async (req: AuthRequest, res: Response) => {
      try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;
        const currentUserId = req.user?.id;

        if (!organizationId || !currentUserId) {
          return res.status(403).json({ error: "Organization access required" });
        }

        const metric = await metricsService.deleteMetric(id, organizationId);

        await logActivity(
          currentUserId,
          organizationId,
          "delete",
          "performance_metric_definition",
          metric.id,
          {},
          req
        );

        res.json(metric);
      } catch (error: any) {
        if (error.message === "Metric not found") {
          return res.status(404).json({ error: error.message });
        }
        console.error("[Performance Metrics] Failed to delete metric:", error);
        res.status(500).json({ error: "Failed to delete metric definition" });
      }
    }
  );

  // ==================== PERFORMANCE SCORES ====================

  /**
   * GET /api/performance-metrics/:id/scores
   * Get performance scores for a specific metric
   * Requires: reports.view
   */
  app.get(
    "/api/performance-metrics/:metricId/scores",
    requireAuth,
    requirePermission("reports.view"),
    async (req: AuthRequest, res: Response) => {
      try {
        const { metricId } = req.params;
        const organizationId = req.user?.organizationId;

        if (!organizationId) {
          return res.status(403).json({ error: "Organization access required" });
        }

        // Parse and validate optional date filters from query params
        let periodStart: Date | undefined;
        let periodEnd: Date | undefined;

        if (req.query.periodStart) {
          const parsedStart = z.coerce.date().safeParse(req.query.periodStart);
          if (!parsedStart.success || isNaN(parsedStart.data.getTime())) {
            return res.status(400).json({ 
              error: "Invalid periodStart date. Expected ISO 8601 format (e.g., 2024-01-01)",
              details: parsedStart.success ? ["Invalid date value"] : parsedStart.error.errors 
            });
          }
          periodStart = parsedStart.data;
        }

        if (req.query.periodEnd) {
          const parsedEnd = z.coerce.date().safeParse(req.query.periodEnd);
          if (!parsedEnd.success || isNaN(parsedEnd.data.getTime())) {
            return res.status(400).json({ 
              error: "Invalid periodEnd date. Expected ISO 8601 format (e.g., 2024-01-01)",
              details: parsedEnd.success ? ["Invalid date value"] : parsedEnd.error.errors 
            });
          }
          periodEnd = parsedEnd.data;
        }

        const scores = await metricsService.getMetricScores(
          metricId, 
          organizationId,
          periodStart,
          periodEnd
        );
        res.json({ scores });
      } catch (error: any) {
        if (error.message === "Metric not found") {
          return res.status(404).json({ error: error.message });
        }
        console.error("[Performance Metrics] Failed to fetch scores:", error);
        res.status(500).json({ error: "Failed to fetch metric scores" });
      }
    }
  );

  /**
   * POST /api/performance-metrics/:id/scores
   * Record a new performance score
   * Requires: workflows.manage (operational task during workflow execution)
   */
  app.post(
    "/api/performance-metrics/:metricId/scores",
    requireAuth,
    requirePermission("workflows.manage"),
    async (req: AuthRequest, res: Response) => {
      try {
        const { metricId } = req.params;
        const organizationId = req.user?.organizationId;
        const currentUserId = req.user?.id;

        if (!organizationId || !currentUserId) {
          return res.status(403).json({ error: "Organization access required" });
        }

        const validated = insertPerformanceScoreSchema.parse({
          ...req.body,
          metricDefinitionId: metricId,
          organizationId,
        });

        const score = await metricsService.recordScore(validated);

        await logActivity(
          currentUserId,
          organizationId,
          "create",
          "performance_score",
          score.id,
          {},
          req
        );

        res.status(201).json(score);
      } catch (error: any) {
        if (error.message === "Metric not found") {
          return res.status(404).json({ error: error.message });
        }
        if (error instanceof ZodError) {
          return res.status(400).json({ 
            error: "Validation failed", 
            details: error.errors 
          });
        }
        console.error("[Performance Metrics] Failed to record score:", error);
        res.status(500).json({ error: "Failed to record performance score" });
      }
    }
  );
}
