import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  requireAuth,
  requirePermission,
  rateLimit,
  logActivity,
  encrypt,
  type AuthRequest,
} from "./auth";
import {
  insertUserSchema,
  insertOrganizationSchema,
  insertRoleSchema,
  insertPermissionSchema,
  insertWorkflowSchema,
  insertAiAgentSchema,
  insertDocumentSchema,
  insertNotificationSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ==================== Auth Routes ====================
  
  // Register
  app.post("/api/auth/register", rateLimit(5, 15 * 60 * 1000), async (req: Request, res: Response) => {
    try {
      const { email, username, password, firstName, lastName, organizationName } = req.body;

      // Validate input
      if (!email || !username || !password) {
        return res.status(400).json({ error: "Email, username and password are required" });
      }

      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ error: "Username already taken" });
      }

      // Create organization for first user (Super Admin)
      let organization;
      if (organizationName) {
        const slug = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const orgData = insertOrganizationSchema.parse({
          name: organizationName,
          slug,
        });
        organization = await storage.createOrganization(orgData);
      }

      // Get client role by default
      let clientRole = await storage.getRoleByName("Client");
      if (!clientRole) {
        // Try to create it if missing
        try {
          clientRole = await storage.createRole({
            name: "Client",
            description: "Client with portal access for documents and workflow status",
            isSystemRole: true,
            organizationId: null,
          });
        } catch (error) {
          return res.status(500).json({ error: "System roles not initialized. Please contact administrator." });
        }
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Validate and create user
      const userData = insertUserSchema.parse({
        email,
        username,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        roleId: clientRole.id,
        organizationId: organization?.id || null,
        isActive: true,
      });

      const user = await storage.createUser(userData);

      // Create session
      const token = generateToken(user.id);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await storage.createSession(user.id, token, expiresAt);

      // Log activity
      await logActivity(user.id, organization?.id, "register", "user", user.id, {}, req);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          roleId: user.roleId,
          organizationId: user.organizationId,
        },
        token,
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Login
  app.post("/api/auth/login", rateLimit(10, 15 * 60 * 1000), async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Verify password
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: "Account is inactive" });
      }

      // Create session
      const token = generateToken(user.id);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await storage.createSession(user.id, token, expiresAt);

      // Log activity
      await logActivity(user.id, user.organizationId || undefined, "login", "user", user.id, {}, req);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          roleId: user.roleId,
          organizationId: user.organizationId,
        },
        token,
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Logout
  app.post("/api/auth/logout", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const token = req.headers.authorization?.substring(7);
      if (token) {
        await storage.deleteSession(token);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // Get current user
  app.get("/api/auth/me", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const role = await storage.getRole(user.roleId);
      const permissions = await storage.getPermissionsByRole(user.roleId);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          roleId: user.roleId,
          organizationId: user.organizationId,
          isActive: user.isActive,
        },
        role,
        permissions: permissions.map(p => p.name),
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // ==================== User Routes ====================
  
  app.get("/api/users", requireAuth, requirePermission("users.view"), async (req: AuthRequest, res: Response) => {
    try {
      const users = req.user!.organizationId
        ? await storage.getUsersByOrganization(req.user!.organizationId)
        : [];
      res.json(users.map(u => ({ ...u, password: undefined })));
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireAuth, requirePermission("users.create"), async (req: AuthRequest, res: Response) => {
    try {
      const { password, ...userData } = req.body;
      const hashedPassword = await hashPassword(password);
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        organizationId: req.user!.organizationId,
      });

      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "user", user.id, { email: user.email }, req);
      res.json({ ...user, password: undefined });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", requireAuth, requirePermission("users.edit"), async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { password, ...userData } = req.body;
      
      const updateData = password 
        ? { ...userData, password: await hashPassword(password) }
        : userData;

      const user = await storage.updateUser(id, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "user", user.id, {}, req);
      res.json({ ...user, password: undefined });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAuth, requirePermission("users.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteUser(id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "user", id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // ==================== Role Routes ====================
  
  app.get("/api/roles", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const roles = await storage.getSystemRoles();
      const customRoles = req.user!.organizationId
        ? await storage.getRolesByOrganization(req.user!.organizationId)
        : [];
      res.json([...roles, ...customRoles]);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  app.post("/api/roles", requireAuth, requirePermission("roles.create"), async (req: AuthRequest, res: Response) => {
    try {
      const role = await storage.createRole({
        ...req.body,
        organizationId: req.user!.organizationId,
        isSystemRole: false,
      });
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "role", role.id, { name: role.name }, req);
      res.json(role);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create role" });
    }
  });

  app.get("/api/roles/:id/permissions", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const permissions = await storage.getPermissionsByRole(id);
      res.json(permissions);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  app.post("/api/roles/:roleId/permissions/:permissionId", requireAuth, requirePermission("roles.edit"), async (req: AuthRequest, res: Response) => {
    try {
      const { roleId, permissionId } = req.params;
      await storage.assignPermissionToRole(roleId, permissionId);
      await logActivity(req.userId, req.user!.organizationId || undefined, "assign_permission", "role", roleId, { permissionId }, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to assign permission" });
    }
  });

  // ==================== Permission Routes ====================
  
  app.get("/api/permissions", requireAuth, async (req: Request, res: Response) => {
    try {
      const permissions = await storage.getAllPermissions();
      res.json(permissions);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  // ==================== Workflow Routes ====================
  
  app.get("/api/workflows", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      const workflows = req.user!.organizationId
        ? await storage.getWorkflowsByOrganization(req.user!.organizationId)
        : [];
      res.json(workflows);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch workflows" });
    }
  });

  app.get("/api/workflows/:id", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.params.id);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.json(workflow);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch workflow" });
    }
  });

  app.post("/api/workflows", requireAuth, requirePermission("workflows.create"), async (req: AuthRequest, res: Response) => {
    try {
      const workflow = await storage.createWorkflow({
        ...req.body,
        organizationId: req.user!.organizationId!,
        createdBy: req.userId!,
      });
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "workflow", workflow.id, { name: workflow.name }, req);
      res.json(workflow);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create workflow" });
    }
  });

  app.patch("/api/workflows/:id", requireAuth, requirePermission("workflows.edit"), async (req: AuthRequest, res: Response) => {
    try {
      const workflow = await storage.updateWorkflow(req.params.id, req.body);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "workflow", workflow.id, {}, req);
      res.json(workflow);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update workflow" });
    }
  });

  app.delete("/api/workflows/:id", requireAuth, requirePermission("workflows.delete"), async (req: AuthRequest, res: Response) => {
    try {
      await storage.deleteWorkflow(req.params.id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "workflow", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete workflow" });
    }
  });

  // ==================== AI Agent Routes ====================
  
  app.get("/api/ai-agents", requireAuth, async (req: Request, res: Response) => {
    try {
      const agents = await storage.getAllPublicAiAgents();
      res.json(agents);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch AI agents" });
    }
  });

  app.get("/api/ai-agents/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const agent = await storage.getAiAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ error: "AI agent not found" });
      }
      res.json(agent);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch AI agent" });
    }
  });

  app.post("/api/ai-agents", requireAuth, requirePermission("ai_agents.create"), async (req: AuthRequest, res: Response) => {
    try {
      const agent = await storage.createAiAgent({
        ...req.body,
        createdBy: req.userId,
      });
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "ai_agent", agent.id, { name: agent.name }, req);
      res.json(agent);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create AI agent" });
    }
  });

  app.post("/api/ai-agents/:id/install", requireAuth, requirePermission("ai_agents.install"), async (req: AuthRequest, res: Response) => {
    try {
      const installation = await storage.installAiAgent(
        req.params.id,
        req.user!.organizationId!,
        req.userId!,
        req.body.configuration || {}
      );
      await logActivity(req.userId, req.user!.organizationId || undefined, "install", "ai_agent", req.params.id, {}, req);
      res.json(installation);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to install AI agent" });
    }
  });

  app.get("/api/ai-agents/installed", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const installed = req.user!.organizationId
        ? await storage.getInstalledAgents(req.user!.organizationId)
        : [];
      res.json(installed);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch installed agents" });
    }
  });

  // ==================== AI Provider Config Routes ====================
  
  app.post("/api/ai-providers", requireAuth, requirePermission("ai_agents.configure"), async (req: AuthRequest, res: Response) => {
    try {
      const { provider, apiKey, endpoint, priority } = req.body;
      const encryptedApiKey = encrypt(apiKey);

      const config = await storage.createAiProviderConfig({
        organizationId: req.user!.organizationId!,
        provider,
        encryptedApiKey,
        endpoint: endpoint || null,
        priority: priority || 0,
        isActive: true,
      });

      await logActivity(req.userId, req.user!.organizationId || undefined, "configure", "ai_provider", config.id, { provider }, req);
      res.json({ ...config, encryptedApiKey: undefined });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to configure AI provider" });
    }
  });

  app.get("/api/ai-providers", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const providers = req.user!.organizationId
        ? await storage.getActiveProviders(req.user!.organizationId)
        : [];
      res.json(providers.map(p => ({ ...p, encryptedApiKey: undefined })));
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch AI providers" });
    }
  });

  // ==================== Document Routes ====================
  
  app.get("/api/documents", requireAuth, requirePermission("documents.view"), async (req: AuthRequest, res: Response) => {
    try {
      const role = await storage.getRole(req.user!.roleId);
      let documents;
      
      if (role?.name === "Client") {
        documents = await storage.getDocumentsByUser(req.userId!);
      } else {
        documents = req.user!.organizationId
          ? await storage.getDocumentsByOrganization(req.user!.organizationId)
          : [];
      }
      
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.post("/api/documents", requireAuth, requirePermission("documents.upload"), async (req: AuthRequest, res: Response) => {
    try {
      const document = await storage.createDocument({
        ...req.body,
        organizationId: req.user!.organizationId!,
        uploadedBy: req.userId!,
      });
      await logActivity(req.userId, req.user!.organizationId || undefined, "upload", "document", document.id, { name: document.name }, req);
      res.json(document);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  app.delete("/api/documents/:id", requireAuth, requirePermission("documents.delete"), async (req: AuthRequest, res: Response) => {
    try {
      await storage.deleteDocument(req.params.id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "document", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // ==================== Notification Routes ====================
  
  app.get("/api/notifications", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const notifications = await storage.getUserNotifications(req.userId!);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await storage.markNotificationAsRead(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // ==================== Activity Log Routes ====================
  
  app.get("/api/activity-logs", requireAuth, requirePermission("analytics.view"), async (req: AuthRequest, res: Response) => {
    try {
      const logs = req.user!.organizationId
        ? await storage.getActivityLogsByOrganization(req.user!.organizationId)
        : [];
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
