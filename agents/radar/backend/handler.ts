import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { registerAgentSessionRoutes } from "../../../server/agent-sessions";
import { RadarAgent } from "./index";
import multer from "multer";
import { FileParserService } from "../../../server/file-parser-service";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const registerRoutes = (app: any) => {
  // Register session management routes
  registerAgentSessionRoutes(app, "radar");

  // Chat endpoint for activity log analysis and queries
  app.post("/api/agents/radar/chat", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { message, history, assignmentId, projectId } = req.body;
      
      // Get default LLM configuration for the organization
      const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
      
      if (!llmConfig) {
        return res.status(400).json({ 
          error: "No LLM configuration found. Please configure your AI provider in Settings > LLM Configuration." 
        });
      }

      // Fetch relevant activity logs for context
      const activities = await storage.getActivityLogsByOrganization(
        req.user!.organizationId!,
        {
          limit: 100,
          resource: assignmentId ? "assignment" : projectId ? "project" : undefined,
          resourceId: assignmentId || projectId
        }
      );

      // Use RadarAgent class
      const agent = new RadarAgent(llmConfig);
      const result = await agent.execute({ message, history, activities, assignmentId, projectId });

      res.json({ 
        response: result.response,
        activityCount: result.activityCount,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("Radar error:", error);
      res.status(500).json({ 
        error: "Failed to process message",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get activity logs for a specific resource
  app.get("/api/agents/radar/activities/:resourceType/:resourceId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { resourceType, resourceId } = req.params;
      const { limit = 100, offset = 0 } = req.query;

      const activities = await storage.getActivityLogsByOrganization(
        req.user!.organizationId!,
        {
          resource: resourceType,
          resourceId,
          limit: Number(limit),
          offset: Number(offset)
        }
      );

      res.json({ 
        activities,
        total: activities.length
      });
      
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ 
        error: "Failed to fetch activities",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Generate accountability report
  app.post("/api/agents/radar/report", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { resourceType, resourceId, startDate, endDate } = req.body;

      const activities = await storage.getActivityLogsByOrganization(
        req.user!.organizationId!,
        {
          resource: resourceType,
          resourceId,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined
        }
      );

      // Group activities by date
      const activityByDate: Record<string, typeof activities> = {};
      activities.forEach(activity => {
        const date = new Date(activity.createdAt).toLocaleDateString();
        if (!activityByDate[date]) {
          activityByDate[date] = [];
        }
        activityByDate[date].push(activity);
      });

      res.json({ 
        activities,
        activityByDate,
        summary: {
          totalActivities: activities.length,
          dateRange: {
            start: startDate || activities[activities.length - 1]?.createdAt,
            end: endDate || activities[0]?.createdAt
          },
          resourceType,
          resourceId
        }
      });
      
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ 
        error: "Failed to generate report",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // File upload and parsing endpoint
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'text/plain'
      ];
      allowedMimes.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'));
    }
  });
  
  app.post("/api/agents/radar/upload-document", requireAuth, (req: AuthRequest, res: Response, next: any) => {
    upload.single("file")(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ 
          error: err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE' 
            ? 'File too large. Maximum size is 10MB.' 
            : err.message || 'Invalid file upload'
        });
      }

      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        // Get LLM config (optional - only needed for scanned PDF OCR)
        const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
        
        const parsed = await FileParserService.parseFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          llmConfig || undefined
        );

        // Warn if scanned PDF detected without LLM config
        if (parsed.isScannedPdf && !llmConfig) {
          console.warn(`[Radar] Scanned PDF upload without LLM config - OCR unavailable for org ${req.user!.organizationId}`);
        }

        res.json({ 
          success: true,
          extractedText: parsed.text,
          filename: parsed.filename,
          metadata: parsed.metadata
        });
      } catch (error: any) {
        console.error("File parsing error:", error);
        res.status(500).json({ error: error.message || "Failed to parse file" });
      }
    });
  });
};

export default { registerRoutes };
