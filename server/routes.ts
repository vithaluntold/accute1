import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
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
  generateSecureToken,
  hashTokenSHA256,
  validateSuperAdminKey,
  validateInvitationToken,
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
  insertClientSchema,
} from "@shared/schema";

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});

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

      // Set session cookie
      res.cookie('session_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

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

  // ==================== Super Admin Routes ====================

  // Get super admin keys (requires super admin)
  app.get("/api/super-admin/keys", requireAuth, requirePermission("super_admin.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const keys = await storage.getSuperAdminKeysByUser(req.userId!);
      res.json(keys);
    } catch (error: any) {
      console.error("Get super admin keys error:", error);
      res.status(500).json({ error: "Failed to fetch super admin keys" });
    }
  });

  // Generate super admin key (requires existing super admin)
  app.post("/api/super-admin/keys", requireAuth, requirePermission("super_admin.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { expiresInDays = 30 } = req.body;
      
      const key = generateSecureToken();
      const keyHash = hashTokenSHA256(key);
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

      await storage.createSuperAdminKey({
        keyHash,
        generatedBy: req.userId!,
        expiresAt,
        usedBy: null,
        usedAt: null,
        revokedAt: null,
        metadata: {},
      });

      await logActivity(req.userId, req.user!.organizationId || undefined, "generate", "super_admin_key", undefined, { expiresInDays }, req);

      res.json({
        key,
        expiresAt,
        message: "Super admin key generated. Save this key securely - it will not be shown again."
      });
    } catch (error: any) {
      console.error("Super admin key generation error:", error);
      res.status(500).json({ error: "Failed to generate super admin key" });
    }
  });

  // Register as super admin with key
  app.post("/api/super-admin/register", rateLimit(5, 15 * 60 * 1000), async (req: Request, res: Response) => {
    try {
      const { email, username, password, firstName, lastName, superAdminKey } = req.body;

      if (!email || !username || !password || !superAdminKey) {
        return res.status(400).json({ error: "All fields including super admin key are required" });
      }

      const validation = await validateSuperAdminKey(superAdminKey);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ error: "Username already taken" });
      }

      const superAdminRole = await storage.getRoleByName("Super Admin");
      if (!superAdminRole) {
        return res.status(500).json({ error: "Super Admin role not found. Contact system administrator." });
      }

      const hashedPassword = await hashPassword(password);
      const userData = insertUserSchema.parse({
        email,
        username,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        roleId: superAdminRole.id,
        organizationId: null,
        isActive: true,
      });

      const user = await storage.createUser(userData);
      await storage.markSuperAdminKeyAsUsed(validation.keyRecord.id, user.id);

      const token = generateToken(user.id);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await storage.createSession(user.id, token, expiresAt);

      await logActivity(user.id, undefined, "register_super_admin", "user", user.id, {}, req);

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
      console.error("Super admin registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // ==================== Admin Self-Registration ====================

  app.post("/api/auth/register-admin", rateLimit(5, 15 * 60 * 1000), async (req: Request, res: Response) => {
    try {
      const { email, username, password, firstName, lastName, organizationName } = req.body;

      if (!email || !username || !password || !organizationName) {
        return res.status(400).json({ error: "All fields including organization name are required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ error: "Username already taken" });
      }

      const slug = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const existingOrg = await storage.getOrganizationBySlug(slug);
      if (existingOrg) {
        return res.status(400).json({ error: "Organization name already taken. Please choose a different name." });
      }

      const orgData = insertOrganizationSchema.parse({
        name: organizationName,
        slug,
      });
      const organization = await storage.createOrganization(orgData);

      const adminRole = await storage.getRoleByName("Admin");
      if (!adminRole) {
        return res.status(500).json({ error: "Admin role not found. Contact system administrator." });
      }

      const hashedPassword = await hashPassword(password);
      const userData = insertUserSchema.parse({
        email,
        username,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        roleId: adminRole.id,
        organizationId: organization.id,
        isActive: true,
      });

      const user = await storage.createUser(userData);

      const token = generateToken(user.id);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await storage.createSession(user.id, token, expiresAt);

      await logActivity(user.id, organization.id, "register_admin", "user", user.id, { organizationId: organization.id }, req);

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
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        },
        token,
      });
    } catch (error: any) {
      console.error("Admin registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // ==================== Invitation Routes ====================

  app.post("/api/invitations", requireAuth, requirePermission("users.invite"), async (req: AuthRequest, res: Response) => {
    try {
      const { email, phone, type, roleId, expiresInDays = 7 } = req.body;

      if (!type || (type === 'email' && !email) || (type === 'sms' && !phone)) {
        return res.status(400).json({ error: "Type and corresponding contact method required" });
      }

      if (!roleId) {
        return res.status(400).json({ error: "Role is required" });
      }

      const role = await storage.getRole(roleId);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }

      if (role.name === "Super Admin") {
        return res.status(403).json({ error: "Cannot invite users with Super Admin role" });
      }

      const token = generateSecureToken();
      const tokenHash = hashTokenSHA256(token);
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

      const invitation = await storage.createInvitation({
        tokenHash,
        type,
        email: email || null,
        phone: phone || null,
        organizationId: req.user!.organizationId!,
        roleId,
        invitedBy: req.userId!,
        status: 'pending',
        expiresAt,
        acceptedBy: null,
        acceptedAt: null,
        revokedAt: null,
        metadata: {},
      });

      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "invitation", invitation.id, { type, roleId }, req);

      const inviteUrl = `${req.protocol}://${req.get('host')}/register?token=${token}`;

      res.json({
        invitation: {
          id: invitation.id,
          type: invitation.type,
          email: invitation.email,
          phone: invitation.phone,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
        inviteUrl,
        token,
        message: type === 'sms' ? "Send this URL via SMS to complete invitation" : "Send this URL via email to complete invitation"
      });
    } catch (error: any) {
      console.error("Invitation creation error:", error);
      res.status(500).json({ error: "Failed to create invitation" });
    }
  });

  app.get("/api/invitations/validate/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      const validation = await validateInvitationToken(token);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error, valid: false });
      }

      const role = await storage.getRole(validation.invitation.roleId);
      const organization = await storage.getOrganization(validation.invitation.organizationId);

      res.json({
        valid: true,
        invitation: {
          type: validation.invitation.type,
          email: validation.invitation.email,
          organizationName: organization?.name,
          roleName: role?.name,
          expiresAt: validation.invitation.expiresAt,
        }
      });
    } catch (error: any) {
      console.error("Invitation validation error:", error);
      res.status(500).json({ error: "Failed to validate invitation", valid: false });
    }
  });

  app.post("/api/auth/register-invite", rateLimit(5, 15 * 60 * 1000), async (req: Request, res: Response) => {
    try {
      const { email, username, password, firstName, lastName, invitationToken } = req.body;

      if (!email || !username || !password || !invitationToken) {
        return res.status(400).json({ error: "All fields including invitation token are required" });
      }

      const validation = await validateInvitationToken(invitationToken);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      if (validation.invitation.email && validation.invitation.email !== email) {
        return res.status(400).json({ error: "Email must match invitation" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ error: "Username already taken" });
      }

      const hashedPassword = await hashPassword(password);
      const userData = insertUserSchema.parse({
        email,
        username,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        roleId: validation.invitation.roleId,
        organizationId: validation.invitation.organizationId,
        isActive: true,
      });

      const user = await storage.createUser(userData);
      await storage.updateInvitationStatus(validation.invitation.id, 'accepted', user.id);

      const token = generateToken(user.id);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await storage.createSession(user.id, token, expiresAt);

      await logActivity(user.id, user.organizationId || undefined, "register_invite", "user", user.id, { invitationId: validation.invitation.id }, req);

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
      console.error("Invite registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.get("/api/invitations", requireAuth, requirePermission("users.invite"), async (req: AuthRequest, res: Response) => {
    try {
      const invitations = await storage.getInvitationsByOrganization(req.user!.organizationId!);
      res.json(invitations);
    } catch (error: any) {
      console.error("Fetch invitations error:", error);
      res.status(500).json({ error: "Failed to fetch invitations" });
    }
  });

  app.post("/api/invitations/:id/revoke", requireAuth, requirePermission("users.invite"), async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const invitation = await storage.getInvitationById(id);
      
      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found" });
      }

      if (invitation.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await storage.revokeInvitation(id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "revoke", "invitation", id, {}, req);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Revoke invitation error:", error);
      res.status(500).json({ error: "Failed to revoke invitation" });
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
      
      // Validate Azure OpenAI requires endpoint
      if (provider === "azure_openai" && !endpoint) {
        return res.status(400).json({ error: "Azure OpenAI requires an endpoint URL" });
      }
      
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

  app.delete("/api/ai-providers/:id", requireAuth, requirePermission("ai_agents.configure"), async (req: AuthRequest, res: Response) => {
    try {
      // Verify the provider belongs to the user's organization
      const provider = await storage.getAiProviderConfigById(req.params.id);
      if (!provider || provider.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "AI provider not found" });
      }
      
      await storage.deleteAiProviderConfig(req.params.id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "ai_provider", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete AI provider" });
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

  app.post("/api/documents", requireAuth, requirePermission("documents.upload"), upload.single('file'), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const documentData = {
        name: req.body.name || req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`,
        organizationId: req.user!.organizationId!,
        uploadedBy: req.userId!,
        status: "processed",
        workflowId: req.body.workflowId || null,
        encryptedContent: null,
      };

      const document = await storage.createDocument(documentData);
      await logActivity(req.userId, req.user!.organizationId || undefined, "upload", "document", document.id, { name: document.name }, req);
      res.json(document);
    } catch (error: any) {
      console.error("Document upload error:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  app.get("/api/documents/:id/download", requireAuth, requirePermission("documents.view"), async (req: AuthRequest, res: Response) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      const role = await storage.getRole(req.user!.roleId);
      if (role?.name === "Client" && document.uploadedBy !== req.userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (document.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const filePath = path.join(process.cwd(), document.url.replace(/^\//, ''));
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }

      res.download(filePath, document.name);
    } catch (error: any) {
      console.error("Document download error:", error);
      res.status(500).json({ error: "Failed to download document" });
    }
  });

  app.delete("/api/documents/:id", requireAuth, requirePermission("documents.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (document) {
        const filePath = path.join(process.cwd(), document.url.replace(/^\//, ''));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      await storage.deleteDocument(req.params.id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "document", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // ==================== Client Routes ====================
  
  app.get("/api/clients", requireAuth, requirePermission("clients.view"), async (req: AuthRequest, res: Response) => {
    try {
      const clients = await storage.getClientsByOrganization(req.user!.organizationId!);
      res.json(clients);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.post("/api/clients", requireAuth, requirePermission("clients.create"), async (req: AuthRequest, res: Response) => {
    try {
      const validated = insertClientSchema.parse(req.body);
      const client = await storage.createClient({
        ...validated,
        organizationId: req.user!.organizationId!,
        createdBy: req.userId!,
      });
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "client", client.id, { name: client.companyName }, req);
      res.json(client);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.patch("/api/clients/:id", requireAuth, requirePermission("clients.edit"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getClient(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      const validated = insertClientSchema.partial().parse(req.body);
      const { organizationId, createdBy, ...safeData } = validated as any;
      
      const client = await storage.updateClient(req.params.id, safeData);
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "client", req.params.id, {}, req);
      res.json(client);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", requireAuth, requirePermission("clients.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getClient(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      await storage.deleteClient(req.params.id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "client", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete client" });
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
