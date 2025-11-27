import { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { db } from "./db";
import { requireAuth, logActivity } from "./auth";
import { enforceOrganizationScope, requireOrganization } from "./middleware/enforce-organization-scope";
import { taskRecordings, recordingViews, insertTaskRecordingSchema, insertRecordingViewSchema } from "@shared/schema";
import { eq, and, desc, sql, or } from "drizzle-orm";

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads", "recordings");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `recording-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  }),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max for video recordings
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "video/webm", "video/mp4", "video/quicktime", 
      "audio/webm", "audio/mp3",
      "image/png", "image/jpeg", "image/webp"
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only video, audio, and image files are allowed."));
    }
  },
});

export function registerTaskRecordingRoutes(app: Express) {
  
  app.get(
    "/api/recordings",
    requireAuth,
    enforceOrganizationScope,
    async (req: Request, res: Response) => {
      try {
        const { organizationId } = req.user!;
        const { status, category, taskId, workflowId, clientId, search, limit = "50", offset = "0" } = req.query;
        
        const conditions = [
          eq(taskRecordings.organizationId, organizationId),
          or(
            eq(taskRecordings.isPublic, true),
            eq(taskRecordings.createdBy, req.user!.id),
            sql`${req.user!.id} = ANY(${taskRecordings.sharedWith})`
          )
        ];

        if (status && typeof status === "string") {
          conditions.push(eq(taskRecordings.status, status as "draft" | "processing" | "ready" | "failed"));
        }

        if (category && typeof category === "string") {
          conditions.push(eq(taskRecordings.category, category));
        }

        if (taskId && typeof taskId === "string") {
          conditions.push(eq(taskRecordings.taskId, taskId));
        }

        if (workflowId && typeof workflowId === "string") {
          conditions.push(eq(taskRecordings.workflowId, workflowId));
        }

        if (clientId && typeof clientId === "string") {
          conditions.push(eq(taskRecordings.clientId, clientId));
        }

        if (search && typeof search === "string") {
          const searchLower = `%${search.toLowerCase()}%`;
          conditions.push(
            or(
              sql`LOWER(${taskRecordings.title}) LIKE ${searchLower}`,
              sql`LOWER(${taskRecordings.description}) LIKE ${searchLower}`
            )
          );
        }

        const recordings = await db
          .select()
          .from(taskRecordings)
          .where(and(...conditions))
          .orderBy(desc(taskRecordings.createdAt))
          .limit(parseInt(limit as string))
          .offset(parseInt(offset as string));
        
        res.json(recordings);
      } catch (error) {
        console.error("Error fetching recordings:", error);
        res.status(500).json({ message: "Failed to fetch recordings" });
      }
    }
  );

  app.get(
    "/api/recordings/:id",
    requireAuth,
    enforceOrganizationScope,
    async (req: Request, res: Response) => {
      try {
        const { organizationId } = req.user!;
        const { id } = req.params;
        
        const [recording] = await db
          .select()
          .from(taskRecordings)
          .where(
            and(
              eq(taskRecordings.id, id),
              eq(taskRecordings.organizationId, organizationId)
            )
          )
          .limit(1);

        if (!recording) {
          return res.status(404).json({ message: "Recording not found" });
        }

        const canAccess = 
          recording.isPublic || 
          recording.createdBy === req.user!.id ||
          (recording.sharedWith && recording.sharedWith.includes(req.user!.id));

        if (!canAccess) {
          return res.status(403).json({ message: "Access denied" });
        }

        res.json(recording);
      } catch (error) {
        console.error("Error fetching recording:", error);
        res.status(500).json({ message: "Failed to fetch recording" });
      }
    }
  );

  app.post(
    "/api/recordings",
    requireAuth,
    enforceOrganizationScope,
    async (req: Request, res: Response) => {
      try {
        const { organizationId, id: userId } = req.user!;
        
        const createSchema = insertTaskRecordingSchema.extend({
          title: z.string().min(1, "Title is required"),
        });
        
        const validatedData = createSchema.parse({
          ...req.body,
          organizationId,
          createdBy: userId,
          status: "draft",
        });

        const [recording] = await db
          .insert(taskRecordings)
          .values(validatedData)
          .returning();

        await logActivity(
          userId,
          "create",
          "task_recording",
          recording.id,
          { title: recording.title },
          req,
          organizationId
        );

        res.status(201).json(recording);
      } catch (error) {
        console.error("Error creating recording:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Validation error", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create recording" });
      }
    }
  );

  app.post(
    "/api/recordings/:id/upload",
    requireAuth,
    enforceOrganizationScope,
    upload.fields([
      { name: "video", maxCount: 1 },
      { name: "thumbnail", maxCount: 1 },
    ]),
    async (req: Request, res: Response) => {
      try {
        const { organizationId, id: userId } = req.user!;
        const { id } = req.params;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        const [existing] = await db
          .select()
          .from(taskRecordings)
          .where(
            and(
              eq(taskRecordings.id, id),
              eq(taskRecordings.organizationId, organizationId),
              eq(taskRecordings.createdBy, userId)
            )
          )
          .limit(1);

        if (!existing) {
          return res.status(404).json({ message: "Recording not found or access denied" });
        }

        const updateData: Partial<typeof taskRecordings.$inferInsert> = {
          updatedAt: new Date(),
        };

        if (files.video?.[0]) {
          const videoFile = files.video[0];
          updateData.videoUrl = `/uploads/recordings/${videoFile.filename}`;
          updateData.videoSize = videoFile.size;
          updateData.status = "ready";
        } else {
          updateData.status = "processing";
        }

        if (files.thumbnail?.[0]) {
          const thumbFile = files.thumbnail[0];
          updateData.thumbnailUrl = `/uploads/recordings/${thumbFile.filename}`;
        }

        if (req.body.videoDuration) {
          updateData.videoDuration = parseInt(req.body.videoDuration);
        }

        if (req.body.hasAudio !== undefined) {
          updateData.hasAudio = req.body.hasAudio === "true";
        }

        if (req.body.resolution) {
          updateData.resolution = req.body.resolution;
        }

        const [updated] = await db
          .update(taskRecordings)
          .set(updateData)
          .where(eq(taskRecordings.id, id))
          .returning();

        res.json(updated);
      } catch (error) {
        console.error("Error uploading recording:", error);
        res.status(500).json({ message: "Failed to upload recording" });
      }
    }
  );

  app.patch(
    "/api/recordings/:id",
    requireAuth,
    enforceOrganizationScope,
    async (req: Request, res: Response) => {
      try {
        const { organizationId, id: userId } = req.user!;
        const { id } = req.params;

        const [existing] = await db
          .select()
          .from(taskRecordings)
          .where(
            and(
              eq(taskRecordings.id, id),
              eq(taskRecordings.organizationId, organizationId)
            )
          )
          .limit(1);

        if (!existing) {
          return res.status(404).json({ message: "Recording not found" });
        }

        if (existing.createdBy !== userId) {
          return res.status(403).json({ message: "Only the creator can edit this recording" });
        }

        const allowedFields = [
          "title",
          "description",
          "taskId",
          "workflowId",
          "clientId",
          "category",
          "tags",
          "isPublic",
          "sharedWith",
          "transcript",
          "procedureSteps",
        ];

        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            updateData[field] = req.body[field];
          }
        }

        const [updated] = await db
          .update(taskRecordings)
          .set(updateData)
          .where(eq(taskRecordings.id, id))
          .returning();

        res.json(updated);
      } catch (error) {
        console.error("Error updating recording:", error);
        res.status(500).json({ message: "Failed to update recording" });
      }
    }
  );

  app.delete(
    "/api/recordings/:id",
    requireAuth,
    enforceOrganizationScope,
    async (req: Request, res: Response) => {
      try {
        const { organizationId, id: userId } = req.user!;
        const { id } = req.params;

        const [existing] = await db
          .select()
          .from(taskRecordings)
          .where(
            and(
              eq(taskRecordings.id, id),
              eq(taskRecordings.organizationId, organizationId)
            )
          )
          .limit(1);

        if (!existing) {
          return res.status(404).json({ message: "Recording not found" });
        }

        if (existing.createdBy !== userId) {
          return res.status(403).json({ message: "Only the creator can delete this recording" });
        }

        if (existing.videoUrl) {
          const videoPath = path.join(process.cwd(), existing.videoUrl);
          if (fs.existsSync(videoPath)) {
            fs.unlinkSync(videoPath);
          }
        }

        if (existing.thumbnailUrl) {
          const thumbPath = path.join(process.cwd(), existing.thumbnailUrl);
          if (fs.existsSync(thumbPath)) {
            fs.unlinkSync(thumbPath);
          }
        }

        await db.delete(taskRecordings).where(eq(taskRecordings.id, id));

        await logActivity(
          userId,
          "delete",
          "task_recording",
          id,
          { title: existing.title },
          req,
          organizationId
        );

        res.status(204).send();
      } catch (error) {
        console.error("Error deleting recording:", error);
        res.status(500).json({ message: "Failed to delete recording" });
      }
    }
  );

  app.post(
    "/api/recordings/:id/view",
    requireAuth,
    enforceOrganizationScope,
    async (req: Request, res: Response) => {
      try {
        const { id: userId } = req.user!;
        const { id } = req.params;
        const { watchedSeconds } = req.body;

        const [existingView] = await db
          .select()
          .from(recordingViews)
          .where(
            and(
              eq(recordingViews.recordingId, id),
              eq(recordingViews.userId, userId)
            )
          )
          .limit(1);

        if (existingView) {
          const updateData: Record<string, unknown> = {
            watchedSeconds: Math.max(existingView.watchedSeconds || 0, watchedSeconds || 0),
            updatedAt: new Date(),
          };
          
          if (req.body.completed) {
            updateData.completedAt = new Date();
          }

          const [updated] = await db
            .update(recordingViews)
            .set(updateData)
            .where(eq(recordingViews.id, existingView.id))
            .returning();

          return res.json(updated);
        }

        const [view] = await db
          .insert(recordingViews)
          .values({
            recordingId: id,
            userId,
            watchedSeconds: watchedSeconds || 0,
            completedAt: req.body.completed ? new Date() : null,
          })
          .returning();

        res.status(201).json(view);
      } catch (error) {
        console.error("Error recording view:", error);
        res.status(500).json({ message: "Failed to record view" });
      }
    }
  );

  app.get(
    "/api/recordings/:id/views",
    requireAuth,
    enforceOrganizationScope,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;

        const views = await db
          .select()
          .from(recordingViews)
          .where(eq(recordingViews.recordingId, id))
          .orderBy(desc(recordingViews.createdAt));

        res.json(views);
      } catch (error) {
        console.error("Error fetching views:", error);
        res.status(500).json({ message: "Failed to fetch views" });
      }
    }
  );

  console.log("Task Recording routes registered");
}
