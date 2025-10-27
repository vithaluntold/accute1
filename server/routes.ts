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
  insertContactSchema,
  insertTagSchema,
  insertTaggableSchema,
  insertFormTemplateSchema,
  insertFormSubmissionSchema,
  insertFormShareLinkSchema,
} from "@shared/schema";
import bcrypt from "bcrypt";
import crypto from "crypto";

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
      console.error("Failed to create workflow:", error);
      res.status(500).json({ error: "Failed to create workflow", details: error.message });
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

  // ==================== LLM Configuration Routes ====================
  
  app.get("/api/llm-configurations", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const configs = req.user!.organizationId
        ? await storage.getLlmConfigurationsByOrganization(req.user!.organizationId)
        : [];
      // Don't send back the encrypted API keys in the list
      const sanitized = configs.map(c => ({
        ...c,
        apiKeyEncrypted: '[ENCRYPTED]'
      }));
      res.json(sanitized);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch LLM configurations" });
    }
  });

  app.post("/api/llm-configurations", requireAuth, requirePermission("settings.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { encrypt } = await import('./llm-service');
      const { apiKey, ...rest } = req.body;
      
      // Encrypt the API key before storing
      const encryptedKey = encrypt(apiKey);
      
      const config = await storage.createLlmConfiguration({
        ...rest,
        apiKeyEncrypted: encryptedKey,
        organizationId: req.user!.organizationId!,
        createdBy: req.user!.id
      });
      
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "llm_configuration", config.id, {}, req);
      
      // Don't send back the encrypted key
      res.json({ ...config, apiKeyEncrypted: '[ENCRYPTED]' });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create LLM configuration" });
    }
  });

  app.patch("/api/llm-configurations/:id", requireAuth, requirePermission("settings.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { encrypt } = await import('./llm-service');
      const existing = await storage.getLlmConfiguration(req.params.id);
      
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "LLM configuration not found" });
      }
      
      const { apiKey, ...rest } = req.body;
      const updates: any = rest;
      
      // If a new API key is provided, encrypt it
      if (apiKey && apiKey !== '[ENCRYPTED]') {
        updates.apiKeyEncrypted = encrypt(apiKey);
      }
      
      const config = await storage.updateLlmConfiguration(req.params.id, updates);
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "llm_configuration", req.params.id, {}, req);
      
      res.json({ ...config, apiKeyEncrypted: '[ENCRYPTED]' });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update LLM configuration" });
    }
  });

  app.delete("/api/llm-configurations/:id", requireAuth, requirePermission("settings.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getLlmConfiguration(req.params.id);
      
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "LLM configuration not found" });
      }
      
      await storage.deleteLlmConfiguration(req.params.id);
      await logActivity(req.user!.id, req.user!.organizationId!, "delete", "llm_configuration", req.params.id, {}, req);
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete LLM configuration" });
    }
  });

  app.post("/api/llm-configurations/test", requireAuth, requirePermission("settings.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { provider, apiKey, endpoint } = req.body;
      
      if (!provider || !apiKey) {
        return res.status(400).json({ 
          success: false, 
          message: "Provider and API key are required" 
        });
      }

      let testResult = { success: false, message: "" };

      if (provider === "openai") {
        try {
          const { OpenAI } = await import('openai');
          const client = new OpenAI({ apiKey });
          
          await client.models.list();
          testResult = { success: true, message: "OpenAI connection successful" };
        } catch (error: any) {
          testResult = { 
            success: false, 
            message: error.message || "Failed to connect to OpenAI" 
          };
        }
      } else if (provider === "anthropic") {
        try {
          const { Anthropic } = await import('@anthropic-ai/sdk');
          const client = new Anthropic({ apiKey });
          
          await client.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 10,
            messages: [{ role: "user", content: "test" }]
          });
          testResult = { success: true, message: "Anthropic connection successful" };
        } catch (error: any) {
          testResult = { 
            success: false, 
            message: error.message || "Failed to connect to Anthropic" 
          };
        }
      } else if (provider === "azure_openai") {
        try {
          if (!endpoint) {
            return res.status(400).json({ 
              success: false, 
              message: "Azure OpenAI endpoint is required" 
            });
          }
          
          // Use Azure's REST API to list deployments as a health check
          const apiVersion = '2024-02-01';
          const testUrl = `${endpoint}/openai/deployments?api-version=${apiVersion}`;
          
          const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
              'api-key': apiKey,
              'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });
          
          if (response.ok) {
            testResult = { success: true, message: "Azure OpenAI connection successful" };
          } else {
            // Try to parse JSON error, fallback to text
            let errorMessage = `HTTP ${response.status}`;
            try {
              const errorJson = await response.json();
              errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
            } catch {
              const errorText = await response.text();
              errorMessage = errorText || errorMessage;
            }
            testResult = { 
              success: false, 
              message: `Azure OpenAI error: ${errorMessage}` 
            };
          }
        } catch (error: any) {
          testResult = { 
            success: false, 
            message: error.name === 'AbortError' 
              ? "Connection timeout - please check your Azure endpoint" 
              : error.message || "Failed to connect to Azure OpenAI" 
          };
        }
      } else {
        return res.status(400).json({ 
          success: false, 
          message: "Unsupported provider" 
        });
      }

      res.json(testResult);
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to test LLM configuration" 
      });
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

  // Specific routes MUST come before dynamic parameter routes
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

  // Execute AI Agent
  app.post("/api/ai-agents/execute", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { agentName, input, llmConfigId } = req.body;
      
      // Get LLM configuration - use specified or default
      let llmConfig;
      if (llmConfigId) {
        llmConfig = await storage.getLlmConfiguration(llmConfigId);
        if (!llmConfig || llmConfig.organizationId !== req.user!.organizationId) {
          return res.status(404).json({ error: "LLM configuration not found" });
        }
      } else {
        llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
        if (!llmConfig) {
          return res.status(400).json({ error: "No default LLM configuration found. Please configure an LLM provider first." });
        }
      }
      
      // Load and execute the appropriate agent
      let result;
      switch (agentName) {
        case 'kanban': {
          const { KanbanAgent } = await import('../agents/kanban/backend/index');
          const agent = new KanbanAgent(llmConfig);
          result = await agent.execute(input);
          break;
        }
        case 'cadence': {
          const { CadenceAgent } = await import('../agents/cadence/backend/index');
          const agent = new CadenceAgent(llmConfig);
          result = await agent.execute(input);
          break;
        }
        case 'parity': {
          const { ParityAgent } = await import('../agents/parity/backend/index');
          const agent = new ParityAgent(llmConfig);
          result = await agent.execute(input);
          break;
        }
        case 'forma': {
          const { FormaAgent } = await import('../agents/forma/backend/index');
          const agent = new FormaAgent(llmConfig);
          result = await agent.execute(input);
          break;
        }
        default:
          return res.status(400).json({ error: `Unknown agent: ${agentName}` });
      }
      
      await logActivity(req.user!.id, req.user!.organizationId!, "execute", "ai_agent", agentName, { input }, req);
      res.json({ success: true, result });
    } catch (error: any) {
      console.error('Agent execution error:', error);
      res.status(500).json({ error: "Failed to execute AI agent", details: error.message });
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

  // ==================== Contact Routes ====================

  app.get("/api/contacts", requireAuth, requirePermission("contacts.view"), async (req: AuthRequest, res: Response) => {
    try {
      const { clientId } = req.query;
      let contacts;
      
      if (clientId) {
        const client = await storage.getClient(clientId as string);
        if (!client || client.organizationId !== req.user!.organizationId) {
          return res.status(404).json({ error: "Client not found" });
        }
        contacts = await storage.getContactsByClient(clientId as string);
      } else {
        contacts = await storage.getContactsByOrganization(req.user!.organizationId!);
      }
      
      res.json(contacts);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.post("/api/contacts", requireAuth, requirePermission("contacts.create"), async (req: AuthRequest, res: Response) => {
    try {
      const validated = insertContactSchema.parse(req.body);
      
      const client = await storage.getClient(validated.clientId);
      if (!client || client.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      const contact = await storage.createContact({
        ...validated,
        organizationId: req.user!.organizationId!,
        createdBy: req.userId!,
      });
      
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "contact", contact.id, { name: `${contact.firstName} ${contact.lastName}` }, req);
      res.json(contact);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  app.patch("/api/contacts/:id", requireAuth, requirePermission("contacts.edit"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getContact(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Contact not found" });
      }
      
      const validated = insertContactSchema.partial().parse(req.body);
      const { organizationId, createdBy, ...safeData } = validated as any;
      
      if (safeData.clientId) {
        const client = await storage.getClient(safeData.clientId);
        if (!client || client.organizationId !== req.user!.organizationId) {
          return res.status(404).json({ error: "Client not found" });
        }
      }
      
      const contact = await storage.updateContact(req.params.id, safeData);
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "contact", req.params.id, {}, req);
      res.json(contact);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", requireAuth, requirePermission("contacts.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getContact(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Contact not found" });
      }
      
      await storage.deleteContact(req.params.id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "contact", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });

  // ==================== Tag Routes ====================

  app.get("/api/tags", requireAuth, requirePermission("tags.view"), async (req: AuthRequest, res: Response) => {
    try {
      const tags = await storage.getTagsByOrganization(req.user!.organizationId!);
      res.json(tags);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch tags" });
    }
  });

  app.post("/api/tags", requireAuth, requirePermission("tags.create"), async (req: AuthRequest, res: Response) => {
    try {
      console.log("POST /api/tags - Request body:", req.body);
      console.log("User organizationId:", req.user?.organizationId);
      console.log("User userId:", req.userId);
      
      const validated = insertTagSchema.parse(req.body);
      console.log("Validated data:", validated);
      
      const tag = await storage.createTag({
        ...validated,
        organizationId: req.user!.organizationId!,
        createdBy: req.userId!,
      });
      console.log("Tag created successfully:", tag.id);
      
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "tag", tag.id, { name: tag.name }, req);
      res.json(tag);
    } catch (error: any) {
      console.error("Failed to create tag:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({ error: "Failed to create tag", details: error.message });
    }
  });

  app.patch("/api/tags/:id", requireAuth, requirePermission("tags.edit"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getTag(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Tag not found" });
      }
      
      const validated = insertTagSchema.partial().parse(req.body);
      const { organizationId, createdBy, ...safeData } = validated as any;
      
      const tag = await storage.updateTag(req.params.id, safeData);
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "tag", req.params.id, {}, req);
      res.json(tag);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update tag" });
    }
  });

  app.delete("/api/tags/:id", requireAuth, requirePermission("tags.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getTag(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Tag not found" });
      }
      
      await storage.deleteTag(req.params.id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "tag", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete tag" });
    }
  });

  // Taggables routes
  app.post("/api/taggables", requireAuth, requirePermission("tags.apply"), async (req: AuthRequest, res: Response) => {
    try {
      const validated = insertTaggableSchema.parse(req.body);
      
      const tag = await storage.getTag(validated.tagId);
      if (!tag || tag.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Tag not found" });
      }
      
      const taggable = await storage.addTag(validated);
      await logActivity(req.userId, req.user!.organizationId || undefined, "apply_tag", validated.taggableType, validated.taggableId, { tagId: validated.tagId }, req);
      res.json(taggable);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to add tag" });
    }
  });

  app.delete("/api/taggables", requireAuth, requirePermission("tags.apply"), async (req: AuthRequest, res: Response) => {
    try {
      const { tagId, taggableType, taggableId } = req.body;
      
      const tag = await storage.getTag(tagId);
      if (!tag || tag.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Tag not found" });
      }
      
      await storage.removeTag(tagId, taggableType, taggableId);
      await logActivity(req.userId, req.user!.organizationId || undefined, "remove_tag", taggableType, taggableId, { tagId }, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to remove tag" });
    }
  });

  app.get("/api/resources/:type/:id/tags", requireAuth, requirePermission("tags.view"), async (req: AuthRequest, res: Response) => {
    try {
      const tags = await storage.getTagsForResource(req.params.type, req.params.id);
      res.json(tags);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch resource tags" });
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

  // ==================== Form Template Routes ====================
  
  app.get("/api/forms", requireAuth, requirePermission("forms.view"), async (req: AuthRequest, res: Response) => {
    try {
      const forms = await storage.getFormTemplatesByOrganization(req.user!.organizationId!);
      res.json(forms);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch forms" });
    }
  });

  app.get("/api/forms/:id", requireAuth, requirePermission("forms.view"), async (req: AuthRequest, res: Response) => {
    try {
      const form = await storage.getFormTemplate(req.params.id);
      if (!form) {
        return res.status(404).json({ error: "Form not found" });
      }
      if (form.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(form);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch form" });
    }
  });

  app.post("/api/forms", requireAuth, requirePermission("forms.create"), async (req: AuthRequest, res: Response) => {
    try {
      const parsed = insertFormTemplateSchema.parse(req.body);
      const form = await storage.createFormTemplate({
        ...parsed,
        organizationId: req.user!.organizationId!,
        createdBy: req.user!.id,
      });
      
      await logActivity(
        req.user!.id,
        req.user!.organizationId!,
        "create",
        "form",
        form.id,
        { formName: form.name },
        req
      );
      
      res.status(201).json(form);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create form" });
    }
  });

  app.put("/api/forms/:id", requireAuth, requirePermission("forms.edit"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getFormTemplate(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Form not found" });
      }
      if (existing.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const parsed = insertFormTemplateSchema.partial().parse(req.body);
      const updated = await storage.updateFormTemplate(req.params.id, parsed);
      
      await logActivity(
        req.user!.id,
        req.user!.organizationId!,
        "update",
        "form",
        req.params.id,
        { formName: updated?.name },
        req
      );
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update form" });
    }
  });

  app.post("/api/forms/:id/publish", requireAuth, requirePermission("forms.publish"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getFormTemplate(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Form not found" });
      }
      if (existing.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const published = await storage.publishFormTemplate(req.params.id);
      
      await logActivity(
        req.user!.id,
        req.user!.organizationId!,
        "publish",
        "form",
        req.params.id,
        { formName: published?.name },
        req
      );
      
      res.json(published);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to publish form" });
    }
  });

  app.delete("/api/forms/:id", requireAuth, requirePermission("forms.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getFormTemplate(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Form not found" });
      }
      if (existing.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.deleteFormTemplate(req.params.id);
      
      await logActivity(
        req.user!.id,
        req.user!.organizationId!,
        "delete",
        "form",
        req.params.id,
        { formName: existing.name },
        req
      );
      
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete form" });
    }
  });

  // Submit form data (simplified endpoint for form preview)
  app.post("/api/forms/:id/submit", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const form = await storage.getFormTemplate(req.params.id);
      if (!form) {
        return res.status(404).json({ error: "Form not found" });
      }
      
      // Allow submission if user is in same org
      if (form.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Extract submission data from request body
      const { data, clientId } = req.body;
      
      if (!data) {
        return res.status(400).json({ error: "Form data is required" });
      }
      
      const submission = await storage.createFormSubmission({
        formTemplateId: req.params.id,
        formVersion: form.version,
        organizationId: form.organizationId,
        submittedBy: req.user!.id,
        clientId: clientId || null,
        data: data,
        attachments: [],
        status: "submitted",
        ipAddress: req.ip || null,
        userAgent: req.get("user-agent") || null,
      });
      
      await logActivity(
        req.user!.id,
        form.organizationId,
        "submit",
        "form_submission",
        submission.id,
        { formName: form.name, submissionId: submission.id },
        req
      );
      
      res.status(201).json(submission);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to submit form" });
    }
  });

  // ==================== Form Submission Routes ====================
  
  app.get("/api/form-submissions", requireAuth, requirePermission("form_submissions.view"), async (req: AuthRequest, res: Response) => {
    try {
      const { formTemplateId, clientId } = req.query;
      let submissions;
      
      if (formTemplateId) {
        const form = await storage.getFormTemplate(formTemplateId as string);
        if (!form || form.organizationId !== req.user!.organizationId) {
          return res.status(403).json({ error: "Access denied" });
        }
        submissions = await storage.getFormSubmissionsByTemplate(formTemplateId as string);
      } else if (clientId) {
        const client = await storage.getClient(clientId as string);
        if (!client || client.organizationId !== req.user!.organizationId) {
          return res.status(403).json({ error: "Access denied" });
        }
        submissions = await storage.getFormSubmissionsByClient(clientId as string);
      } else {
        submissions = await storage.getFormSubmissionsByOrganization(req.user!.organizationId!);
      }
      
      res.json(submissions);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  app.post("/api/form-submissions", requireAuth, requirePermission("form_submissions.submit"), async (req: AuthRequest, res: Response) => {
    try {
      const parsed = insertFormSubmissionSchema.parse(req.body);
      
      // Verify form exists and get version
      const form = await storage.getFormTemplate(parsed.formTemplateId);
      if (!form) {
        return res.status(404).json({ error: "Form template not found" });
      }
      
      // Allow submission if user is in same org or form allows external submissions
      if (form.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const submission = await storage.createFormSubmission({
        ...parsed,
        formVersion: form.version,
        organizationId: form.organizationId,
      });
      
      await logActivity(
        req.user!.id,
        form.organizationId,
        "submit",
        "form_submission",
        submission.id,
        { formName: form.name, submissionId: submission.id },
        req
      );
      
      res.status(201).json(submission);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to submit form" });
    }
  });

  app.put("/api/form-submissions/:id/review", requireAuth, requirePermission("form_submissions.review"), async (req: AuthRequest, res: Response) => {
    try {
      const { status, reviewNotes } = req.body;
      
      if (!status || !["approved", "rejected", "under_review"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      
      const existing = await storage.getFormSubmission(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Submission not found" });
      }
      if (existing.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const reviewed = await storage.reviewFormSubmission(
        req.params.id,
        req.user!.id,
        status,
        reviewNotes
      );
      
      await logActivity(
        req.user!.id,
        req.user!.organizationId!,
        "review",
        "form_submission",
        req.params.id,
        { status, reviewNotes },
        req
      );
      
      res.json(reviewed);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to review submission" });
    }
  });

  // Add staff note to submission
  app.post("/api/form-submissions/:id/notes", requireAuth, requirePermission("form_submissions.review"), async (req: AuthRequest, res: Response) => {
    try {
      const { note } = req.body;
      
      if (!note || !note.trim()) {
        return res.status(400).json({ error: "Note is required" });
      }
      
      const existing = await storage.getFormSubmission(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Submission not found" });
      }
      if (existing.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const submissionNote = await storage.addSubmissionNote(
        req.params.id,
        req.user!.id,
        note
      );
      
      await logActivity(
        req.user!.id,
        req.user!.organizationId!,
        "submission_note_added",
        "form_submission",
        req.params.id,
        { note },
        req
      );
      
      res.status(201).json(submissionNote);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to add note" });
    }
  });

  // Get all staff notes for a submission
  app.get("/api/form-submissions/:id/notes", requireAuth, requirePermission("form_submissions.view"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getFormSubmission(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Submission not found" });
      }
      if (existing.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const notes = await storage.getSubmissionNotes(req.params.id);
      res.json(notes);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get notes" });
    }
  });

  // Create revision request
  app.post("/api/form-submissions/:id/revision-request", requireAuth, requirePermission("form_submissions.review"), async (req: AuthRequest, res: Response) => {
    try {
      const { fieldsToRevise } = req.body;
      
      if (!fieldsToRevise || !Array.isArray(fieldsToRevise) || fieldsToRevise.length === 0) {
        return res.status(400).json({ error: "At least one field to revise is required" });
      }
      
      const existing = await storage.getFormSubmission(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Submission not found" });
      }
      if (existing.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const revisionRequest = await storage.createRevisionRequest(
        req.params.id,
        req.user!.id,
        fieldsToRevise
      );
      
      await logActivity(
        req.user!.id,
        req.user!.organizationId!,
        "revision_requested",
        "form_submission",
        req.params.id,
        { fieldsCount: fieldsToRevise.length },
        req
      );
      
      res.status(201).json(revisionRequest);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create revision request" });
    }
  });

  // Get revision requests for a submission
  app.get("/api/form-submissions/:id/revision-requests", requireAuth, requirePermission("form_submissions.view"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getFormSubmission(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Submission not found" });
      }
      if (existing.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const revisionRequests = await storage.getRevisionRequests(req.params.id);
      res.json(revisionRequests);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get revision requests" });
    }
  });

  // Assign reviewer to submission
  app.put("/api/form-submissions/:id/assign", requireAuth, requirePermission("form_submissions.review"), async (req: AuthRequest, res: Response) => {
    try {
      const { reviewerId } = req.body;
      
      if (!reviewerId) {
        return res.status(400).json({ error: "Reviewer ID is required" });
      }
      
      const existing = await storage.getFormSubmission(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Submission not found" });
      }
      if (existing.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Verify reviewer exists and belongs to same organization
      const reviewer = await storage.getUser(reviewerId);
      if (!reviewer || reviewer.organizationId !== req.user!.organizationId) {
        return res.status(400).json({ error: "Invalid reviewer" });
      }
      
      const updated = await storage.assignSubmissionReviewer(req.params.id, reviewerId);
      
      await logActivity(
        req.user!.id,
        req.user!.organizationId!,
        "reviewer_assigned",
        "form_submission",
        req.params.id,
        { reviewerId },
        req
      );
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to assign reviewer" });
    }
  });

  // ==================== Form Share Link Routes ====================

  // Create share link for a form
  app.post("/api/forms/:formId/share-links", requireAuth, requirePermission("forms.share"), async (req: AuthRequest, res: Response) => {
    try {
      const form = await storage.getFormTemplate(req.params.formId);
      if (!form) {
        return res.status(404).json({ error: "Form not found" });
      }
      if (form.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { clientId, password, expiresAt, maxSubmissions, dueDate, notes } = req.body;

      // Generate unique share token
      const shareToken = crypto.randomBytes(16).toString('hex');

      // Hash password if provided
      let hashedPassword = null;
      if (password) {
        hashedPassword = await hashPassword(password);
      }

      const shareLink = await storage.createFormShareLink({
        formTemplateId: req.params.formId,
        organizationId: req.user!.organizationId!,
        createdBy: req.user!.id,
        shareToken,
        clientId: clientId || null,
        password: hashedPassword,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxSubmissions: maxSubmissions || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        status: 'active',
      });

      await logActivity(
        req.user!.id,
        req.user!.organizationId!,
        "create",
        "form_share_link",
        shareLink.id,
        { formName: form.name, shareToken },
        req
      );

      res.status(201).json(shareLink);
    } catch (error: any) {
      console.error("Failed to create share link:", error);
      res.status(500).json({ error: "Failed to create share link" });
    }
  });

  // Get all share links for a form
  app.get("/api/forms/:formId/share-links", requireAuth, requirePermission("forms.view"), async (req: AuthRequest, res: Response) => {
    try {
      const form = await storage.getFormTemplate(req.params.formId);
      if (!form) {
        return res.status(404).json({ error: "Form not found" });
      }
      if (form.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const shareLinks = await storage.getFormShareLinksByForm(req.params.formId);
      res.json(shareLinks);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch share links" });
    }
  });

  // Delete share link
  app.delete("/api/share-links/:id", requireAuth, requirePermission("forms.share"), async (req: AuthRequest, res: Response) => {
    try {
      const shareLink = await storage.getFormShareLink(req.params.id);
      if (!shareLink) {
        return res.status(404).json({ error: "Share link not found" });
      }
      if (shareLink.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteFormShareLink(req.params.id);

      await logActivity(
        req.user!.id,
        req.user!.organizationId!,
        "delete",
        "form_share_link",
        req.params.id,
        { shareToken: shareLink.shareToken },
        req
      );

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete share link" });
    }
  });

  // ==================== Public Form Routes (NO AUTH) ====================

  // Get form by share token (public access)
  app.get("/api/public/forms/:shareToken", async (req: Request, res: Response) => {
    try {
      const shareLink = await storage.getFormShareLinkByToken(req.params.shareToken);
      
      if (!shareLink) {
        return res.status(404).json({ error: "Form not found or link is invalid" });
      }

      // Check if link is active
      if (shareLink.status !== 'active') {
        return res.status(403).json({ error: "This link has been disabled" });
      }

      // Check expiration
      if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
        await storage.updateFormShareLink(shareLink.id, { status: 'expired' });
        return res.status(403).json({ error: "This link has expired" });
      }

      // Check max submissions
      if (shareLink.maxSubmissions && shareLink.submissionCount >= shareLink.maxSubmissions) {
        return res.status(403).json({ error: "Maximum submissions reached for this link" });
      }

      // Get the form template
      const form = await storage.getFormTemplate(shareLink.formTemplateId);
      if (!form) {
        return res.status(404).json({ error: "Form template not found" });
      }

      // Increment view count
      await storage.incrementShareLinkView(req.params.shareToken);

      // Return form and share link info (without sensitive data)
      res.json({
        form: {
          id: form.id,
          name: form.name,
          description: form.description,
          fields: form.fields,
          sections: form.sections,
          pages: form.pages,
          conditionalRules: form.conditionalRules,
          settings: form.settings,
        },
        shareLink: {
          id: shareLink.id,
          requiresPassword: !!shareLink.password,
          dueDate: shareLink.dueDate,
          expiresAt: shareLink.expiresAt,
          maxSubmissions: shareLink.maxSubmissions,
          submissionCount: shareLink.submissionCount,
        },
      });
    } catch (error: any) {
      console.error("Failed to fetch public form:", error);
      res.status(500).json({ error: "Failed to load form" });
    }
  });

  // Submit form via share link (public access)
  app.post("/api/public/forms/:shareToken/submit", async (req: Request, res: Response) => {
    try {
      const { data: formData, password } = req.body;

      const shareLink = await storage.getFormShareLinkByToken(req.params.shareToken);
      
      if (!shareLink) {
        return res.status(404).json({ error: "Form not found or link is invalid" });
      }

      // Check if link is active
      if (shareLink.status !== 'active') {
        return res.status(403).json({ error: "This link has been disabled" });
      }

      // Check expiration
      if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
        await storage.updateFormShareLink(shareLink.id, { status: 'expired' });
        return res.status(403).json({ error: "This link has expired" });
      }

      // Check max submissions
      if (shareLink.maxSubmissions && shareLink.submissionCount >= shareLink.maxSubmissions) {
        return res.status(403).json({ error: "Maximum submissions reached for this link" });
      }

      // Verify password if required
      if (shareLink.password) {
        if (!password) {
          return res.status(401).json({ error: "Password required" });
        }
        const passwordValid = await bcrypt.compare(password, shareLink.password);
        if (!passwordValid) {
          return res.status(401).json({ error: "Invalid password" });
        }
      }

      // Get the form template
      const form = await storage.getFormTemplate(shareLink.formTemplateId);
      if (!form) {
        return res.status(404).json({ error: "Form template not found" });
      }

      // Create submission
      const submission = await storage.createFormSubmission({
        formTemplateId: shareLink.formTemplateId,
        formVersion: form.version,
        organizationId: shareLink.organizationId,
        submittedBy: null, // Public submission, no user
        clientId: shareLink.clientId,
        data: formData,
        attachments: [],
        status: "submitted",
        ipAddress: req.ip || null,
        userAgent: req.get("user-agent") || null,
      });

      // Increment submission count on share link
      await storage.incrementShareLinkSubmission(req.params.shareToken);

      res.status(201).json({ 
        success: true, 
        submissionId: submission.id,
        message: "Form submitted successfully" 
      });
    } catch (error: any) {
      console.error("Failed to submit public form:", error);
      res.status(500).json({ error: "Failed to submit form" });
    }
  });

  // ==================== Client Portal Routes ====================

  // Get client associated with current user's email
  app.get("/api/me/client", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Find client by email
      const clients = await storage.getClientsByOrganization(req.user!.organizationId!);
      const client = clients.find((c: any) => c.email.toLowerCase() === user.email.toLowerCase());

      if (!client) {
        return res.status(404).json({ error: "No client profile found for this user" });
      }

      res.json({ clientId: client.id, client });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch client information" });
    }
  });

  // Get document requests for client (client-facing)
  app.get("/api/my/document-requests", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Find client by email
      const clients = await storage.getClientsByOrganization(req.user!.organizationId!);
      const client = clients.find((c: any) => c.email.toLowerCase() === user.email.toLowerCase());

      if (!client) {
        return res.status(404).json({ error: "No client profile found for this user" });
      }

      const requests = await storage.getDocumentRequestsByClient(client.id);
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch document requests" });
    }
  });

  // Get required documents for a request (client-facing)
  app.get("/api/my/document-requests/:id/required-documents", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Find client by email
      const clients = await storage.getClientsByOrganization(req.user!.organizationId!);
      const client = clients.find((c: any) => c.email.toLowerCase() === user.email.toLowerCase());

      if (!client) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Verify request belongs to this client
      const request = await storage.getDocumentRequest(req.params.id);
      if (!request || request.clientId !== client.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const requiredDocs = await storage.getRequiredDocumentsByRequest(req.params.id);
      res.json(requiredDocs);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch required documents" });
    }
  });

  // Get submissions for a required document (client-facing)
  app.get("/api/my/required-documents/:id/submissions", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Find client by email
      const clients = await storage.getClientsByOrganization(req.user!.organizationId!);
      const client = clients.find((c: any) => c.email.toLowerCase() === user.email.toLowerCase());

      if (!client) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Verify required document belongs to client's request
      const requiredDoc = await storage.getRequiredDocument(req.params.id);
      if (!requiredDoc) {
        return res.status(404).json({ error: "Required document not found" });
      }

      const request = await storage.getDocumentRequest(requiredDoc.requestId);
      if (!request || request.clientId !== client.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const submissions = await storage.getDocumentSubmissionsByRequiredDoc(req.params.id);
      res.json(submissions);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  // Submit document for required document (client-facing)
  app.post("/api/my/required-documents/:id/submit", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Find client by email
      const clients = await storage.getClientsByOrganization(req.user!.organizationId!);
      const client = clients.find((c: any) => c.email.toLowerCase() === user.email.toLowerCase());

      if (!client) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Verify required document belongs to client's request
      const requiredDoc = await storage.getRequiredDocument(req.params.id);
      if (!requiredDoc) {
        return res.status(404).json({ error: "Required document not found" });
      }

      const request = await storage.getDocumentRequest(requiredDoc.requestId);
      if (!request || request.clientId !== client.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { documentId } = req.body;

      if (!documentId) {
        return res.status(400).json({ error: "Document ID is required" });
      }

      // Verify document exists and belongs to organization
      const document = await storage.getDocument(documentId);
      if (!document || document.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const submission = await storage.createDocumentSubmission({
        requiredDocumentId: req.params.id,
        documentId,
        submittedBy: req.user!.id,
        status: "pending_review",
        reviewNotes: null,
      });

      // Update required document status
      await storage.updateRequiredDocument(req.params.id, { status: "submitted" });

      res.status(201).json(submission);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to submit document" });
    }
  });

  // ==================== Document Collection Tracking Routes ====================

  // Get all document requests for organization
  app.get("/api/document-requests", requireAuth, requirePermission("documents.view"), async (req: AuthRequest, res: Response) => {
    try {
      const requests = await storage.getDocumentRequestsByOrganization(req.user!.organizationId!);
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch document requests" });
    }
  });

  // Get document requests for a specific client
  app.get("/api/clients/:clientId/document-requests", requireAuth, requirePermission("documents.view"), async (req: AuthRequest, res: Response) => {
    try {
      const client = await storage.getClient(req.params.clientId);
      if (!client || client.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const requests = await storage.getDocumentRequestsByClient(req.params.clientId);
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch document requests" });
    }
  });

  // Get a single document request
  app.get("/api/document-requests/:id", requireAuth, requirePermission("documents.view"), async (req: AuthRequest, res: Response) => {
    try {
      const request = await storage.getDocumentRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ error: "Document request not found" });
      }
      if (request.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(request);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch document request" });
    }
  });

  // Create a new document request
  app.post("/api/document-requests", requireAuth, requirePermission("documents.create"), async (req: AuthRequest, res: Response) => {
    try {
      const { clientId, title, description, assignedTo, priority, dueDate, notes, requiredDocuments } = req.body;

      if (!clientId || !title) {
        return res.status(400).json({ error: "Client ID and title are required" });
      }

      const client = await storage.getClient(clientId);
      if (!client || client.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const request = await storage.createDocumentRequest({
        clientId,
        title,
        description: description || null,
        assignedTo: assignedTo || null,
        priority: priority || "medium",
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        status: "pending",
        organizationId: req.user!.organizationId!,
        createdBy: req.user!.id,
      });

      // Create required documents if provided
      if (requiredDocuments && Array.isArray(requiredDocuments)) {
        for (let i = 0; i < requiredDocuments.length; i++) {
          const doc = requiredDocuments[i];
          await storage.createRequiredDocument({
            requestId: request.id,
            name: doc.name,
            description: doc.description || null,
            category: doc.category || null,
            isRequired: doc.isRequired !== false,
            expectedQuantity: doc.expectedQuantity || 1,
            sortOrder: i,
            status: "pending",
          });
        }
      }

      await logActivity(
        req.user!.id,
        req.user!.organizationId!,
        "create",
        "document_request",
        request.id,
        { title, clientId },
        req
      );

      res.status(201).json(request);
    } catch (error: any) {
      console.error("Failed to create document request:", error);
      res.status(500).json({ error: "Failed to create document request" });
    }
  });

  // Update a document request
  app.put("/api/document-requests/:id", requireAuth, requirePermission("documents.edit"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getDocumentRequest(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Document request not found" });
      }
      if (existing.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { title, description, assignedTo, priority, dueDate, notes, status } = req.body;

      const updateData: any = {
        title,
        description,
        assignedTo,
        priority,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        notes,
        status,
      };

      // Set completedAt when marking as completed
      if (status === "completed") {
        updateData.completedAt = new Date();
      }

      const updated = await storage.updateDocumentRequest(req.params.id, updateData);

      await logActivity(
        req.user!.id,
        req.user!.organizationId!,
        "update",
        "document_request",
        req.params.id,
        { status },
        req
      );

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update document request" });
    }
  });

  // Delete a document request
  app.delete("/api/document-requests/:id", requireAuth, requirePermission("documents.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getDocumentRequest(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Document request not found" });
      }
      if (existing.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteDocumentRequest(req.params.id);

      await logActivity(
        req.user!.id,
        req.user!.organizationId!,
        "delete",
        "document_request",
        req.params.id,
        { title: existing.title },
        req
      );

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete document request" });
    }
  });

  // Get required documents for a request
  app.get("/api/document-requests/:id/required-documents", requireAuth, requirePermission("documents.view"), async (req: AuthRequest, res: Response) => {
    try {
      const request = await storage.getDocumentRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ error: "Document request not found" });
      }
      if (request.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const requiredDocs = await storage.getRequiredDocumentsByRequest(req.params.id);
      res.json(requiredDocs);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch required documents" });
    }
  });

  // Add a required document to a request
  app.post("/api/document-requests/:id/required-documents", requireAuth, requirePermission("documents.create"), async (req: AuthRequest, res: Response) => {
    try {
      const request = await storage.getDocumentRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ error: "Document request not found" });
      }
      if (request.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { name, description, category, isRequired, expectedQuantity } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Document name is required" });
      }

      const requiredDoc = await storage.createRequiredDocument({
        requestId: req.params.id,
        name,
        description: description || null,
        category: category || null,
        isRequired: isRequired !== false,
        expectedQuantity: expectedQuantity || 1,
        sortOrder: 0,
        status: "pending",
      });

      res.status(201).json(requiredDoc);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create required document" });
    }
  });

  // Update a required document
  app.put("/api/required-documents/:id", requireAuth, requirePermission("documents.edit"), async (req: AuthRequest, res: Response) => {
    try {
      const requiredDoc = await storage.getRequiredDocument(req.params.id);
      if (!requiredDoc) {
        return res.status(404).json({ error: "Required document not found" });
      }

      const request = await storage.getDocumentRequest(requiredDoc.requestId);
      if (!request || request.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { name, description, category, isRequired, expectedQuantity, status, sortOrder } = req.body;

      const updated = await storage.updateRequiredDocument(req.params.id, {
        name,
        description,
        category,
        isRequired,
        expectedQuantity,
        status,
        sortOrder,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update required document" });
    }
  });

  // Delete a required document
  app.delete("/api/required-documents/:id", requireAuth, requirePermission("documents.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const requiredDoc = await storage.getRequiredDocument(req.params.id);
      if (!requiredDoc) {
        return res.status(404).json({ error: "Required document not found" });
      }

      const request = await storage.getDocumentRequest(requiredDoc.requestId);
      if (!request || request.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteRequiredDocument(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete required document" });
    }
  });

  // Get document submissions for a required document
  app.get("/api/required-documents/:id/submissions", requireAuth, requirePermission("documents.view"), async (req: AuthRequest, res: Response) => {
    try {
      const requiredDoc = await storage.getRequiredDocument(req.params.id);
      if (!requiredDoc) {
        return res.status(404).json({ error: "Required document not found" });
      }

      const request = await storage.getDocumentRequest(requiredDoc.requestId);
      if (!request || request.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const submissions = await storage.getDocumentSubmissionsByRequiredDoc(req.params.id);
      res.json(submissions);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch document submissions" });
    }
  });

  // Submit a document for a required document
  app.post("/api/required-documents/:id/submissions", requireAuth, requirePermission("documents.upload"), async (req: AuthRequest, res: Response) => {
    try {
      const requiredDoc = await storage.getRequiredDocument(req.params.id);
      if (!requiredDoc) {
        return res.status(404).json({ error: "Required document not found" });
      }

      const request = await storage.getDocumentRequest(requiredDoc.requestId);
      if (!request || request.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { documentId } = req.body;

      if (!documentId) {
        return res.status(400).json({ error: "Document ID is required" });
      }

      // Verify document exists and belongs to organization
      const document = await storage.getDocument(documentId);
      if (!document || document.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const submission = await storage.createDocumentSubmission({
        requiredDocumentId: req.params.id,
        documentId,
        submittedBy: req.user!.id,
        status: "pending_review",
        reviewNotes: null,
      });

      // Update required document status
      await storage.updateRequiredDocument(req.params.id, { status: "submitted" });

      res.status(201).json(submission);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to submit document" });
    }
  });

  // Review a document submission
  app.put("/api/document-submissions/:id/review", requireAuth, requirePermission("documents.review"), async (req: AuthRequest, res: Response) => {
    try {
      const submission = await storage.getDocumentSubmission(req.params.id);
      if (!submission) {
        return res.status(404).json({ error: "Document submission not found" });
      }

      const requiredDoc = await storage.getRequiredDocument(submission.requiredDocumentId);
      if (!requiredDoc) {
        return res.status(404).json({ error: "Required document not found" });
      }

      const request = await storage.getDocumentRequest(requiredDoc.requestId);
      if (!request || request.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { status, reviewNotes } = req.body;

      if (!status || !["approved", "rejected", "pending_review"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const reviewed = await storage.reviewDocumentSubmission(
        req.params.id,
        req.user!.id,
        status,
        reviewNotes
      );

      // Update required document status
      if (status === "approved") {
        await storage.updateRequiredDocument(requiredDoc.id, { status: "approved" });
      } else if (status === "rejected") {
        await storage.updateRequiredDocument(requiredDoc.id, { status: "rejected" });
      }

      await logActivity(
        req.user!.id,
        req.user!.organizationId!,
        "review",
        "document_submission",
        req.params.id,
        { status, reviewNotes },
        req
      );

      res.json(reviewed);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to review document submission" });
    }
  });

  // ============================================
  // TAXDOME FEATURES - Practice Management
  // ============================================

  // Secure Messaging - Conversations
  app.get("/api/conversations", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const conversations = await storage.getConversationsByOrganization(req.user!.organizationId!);
      res.json(conversations);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", requireAuth, requirePermission("messaging.create"), async (req: AuthRequest, res: Response) => {
    try {
      const conversation = await storage.createConversation({
        ...req.body,
        organizationId: req.user!.organizationId!
      });
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "conversation", conversation.id, conversation, req);
      res.status(201).json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.get("/api/conversations/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation || conversation.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation || conversation.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await storage.getMessagesByConversation(req.params.id);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:id/messages", requireAuth, requirePermission("messaging.send"), async (req: AuthRequest, res: Response) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation || conversation.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const message = await storage.createMessage({
        conversationId: req.params.id,
        senderId: req.user!.id,
        senderType: req.body.senderType || "staff",
        content: req.body.content,
        attachments: req.body.attachments || []
      });
      res.status(201).json(message);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Time Tracking
  app.get("/api/time-entries", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const entries = await storage.getTimeEntriesByOrganization(req.user!.organizationId!);
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch time entries" });
    }
  });

  app.post("/api/time-entries", requireAuth, requirePermission("time.create"), async (req: AuthRequest, res: Response) => {
    try {
      const entry = await storage.createTimeEntry({
        ...req.body,
        organizationId: req.user!.organizationId!,
        userId: req.user!.id
      });
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "time_entry", entry.id, entry, req);
      res.status(201).json(entry);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create time entry" });
    }
  });

  app.put("/api/time-entries/:id", requireAuth, requirePermission("time.update"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getTimeEntry(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Time entry not found" });
      }
      const updated = await storage.updateTimeEntry(req.params.id, req.body);
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "time_entry", req.params.id, req.body, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update time entry" });
    }
  });

  app.delete("/api/time-entries/:id", requireAuth, requirePermission("time.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getTimeEntry(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Time entry not found" });
      }
      await storage.deleteTimeEntry(req.params.id);
      await logActivity(req.user!.id, req.user!.organizationId!, "delete", "time_entry", req.params.id, {}, req);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete time entry" });
    }
  });

  // Invoices
  app.get("/api/invoices", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const invoices = await storage.getInvoicesByOrganization(req.user!.organizationId!);
      res.json(invoices);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  app.post("/api/invoices", requireAuth, requirePermission("invoices.create"), async (req: AuthRequest, res: Response) => {
    try {
      const invoice = await storage.createInvoice({
        ...req.body,
        organizationId: req.user!.organizationId!,
        createdBy: req.user!.id
      });
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "invoice", invoice.id, invoice, req);
      res.status(201).json(invoice);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  app.get("/api/invoices/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice || invoice.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const items = await storage.getInvoiceItemsByInvoice(invoice.id);
      res.json({ ...invoice, items });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  app.put("/api/invoices/:id", requireAuth, requirePermission("invoices.update"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getInvoice(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const updated = await storage.updateInvoice(req.params.id, req.body);
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "invoice", req.params.id, req.body, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });

  app.post("/api/invoices/:id/items", requireAuth, requirePermission("invoices.update"), async (req: AuthRequest, res: Response) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice || invoice.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const item = await storage.createInvoiceItem({
        ...req.body,
        invoiceId: req.params.id
      });
      res.status(201).json(item);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to add invoice item" });
    }
  });

  // Payments
  app.get("/api/payments", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { clientId } = req.query;
      let payments;
      if (clientId) {
        payments = await storage.getPaymentsByClient(clientId as string);
      } else {
        const invoices = await storage.getInvoicesByOrganization(req.user!.organizationId!);
        const allPayments = await Promise.all(
          invoices.map(inv => storage.getPaymentsByInvoice(inv.id))
        );
        payments = allPayments.flat();
      }
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  app.post("/api/payments", requireAuth, requirePermission("payments.create"), async (req: AuthRequest, res: Response) => {
    try {
      const payment = await storage.createPayment({
        ...req.body,
        organizationId: req.user!.organizationId!,
        createdBy: req.user!.id
      });
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "payment", payment.id, payment, req);
      res.status(201).json(payment);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  // E-Signatures
  app.get("/api/signature-requests", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const requests = await storage.getSignatureRequestsByOrganization(req.user!.organizationId!);
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch signature requests" });
    }
  });

  app.post("/api/signature-requests", requireAuth, requirePermission("signatures.create"), async (req: AuthRequest, res: Response) => {
    try {
      const request = await storage.createSignatureRequest({
        ...req.body,
        organizationId: req.user!.organizationId!,
        requestedBy: req.user!.id
      });
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "signature_request", request.id, request, req);
      res.status(201).json(request);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create signature request" });
    }
  });

  app.post("/api/signature-requests/:id/sign", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const request = await storage.getSignatureRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ error: "Signature request not found" });
      }
      const signed = await storage.signDocument(
        req.params.id,
        req.user!.id,
        req.body.signatureData,
        req.ip || "",
        req.get("user-agent") || ""
      );
      await logActivity(req.user!.id, req.user!.organizationId!, "sign", "signature_request", req.params.id, {}, req);
      res.json(signed);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to sign document" });
    }
  });

  // Projects (Kanban)
  app.get("/api/projects", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const projects = await storage.getProjectsByOrganization(req.user!.organizationId!);
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", requireAuth, requirePermission("projects.create"), async (req: AuthRequest, res: Response) => {
    try {
      const project = await storage.createProject({
        ...req.body,
        organizationId: req.user!.organizationId!,
        createdBy: req.user!.id
      });
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "project", project.id, project, req);
      res.status(201).json(project);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Project not found" });
      }
      const tasks = await storage.getProjectTasksByProject(project.id);
      res.json({ ...project, tasks });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.put("/api/projects/:id", requireAuth, requirePermission("projects.update"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getProject(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Project not found" });
      }
      const updated = await storage.updateProject(req.params.id, req.body);
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "project", req.params.id, req.body, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.post("/api/projects/:id/tasks", requireAuth, requirePermission("tasks.create"), async (req: AuthRequest, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Project not found" });
      }
      const task = await storage.createProjectTask({
        ...req.body,
        projectId: req.params.id,
        createdBy: req.user!.id
      });
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "task", task.id, task, req);
      res.status(201).json(task);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.put("/api/tasks/:id", requireAuth, requirePermission("tasks.update"), async (req: AuthRequest, res: Response) => {
    try {
      const task = await storage.getProjectTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      const project = await storage.getProject(task.projectId);
      if (!project || project.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateProjectTask(req.params.id, req.body);
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "task", req.params.id, req.body, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Team Chat
  app.get("/api/chat/channels", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const channels = await storage.getChatChannelsByOrganization(req.user!.organizationId!);
      res.json(channels);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch chat channels" });
    }
  });

  app.post("/api/chat/channels", requireAuth, requirePermission("chat.create"), async (req: AuthRequest, res: Response) => {
    try {
      const channel = await storage.createChatChannel({
        ...req.body,
        organizationId: req.user!.organizationId!,
        createdBy: req.user!.id
      });
      await storage.addChatMember({
        channelId: channel.id,
        userId: req.user!.id,
        role: "admin"
      });
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "chat_channel", channel.id, channel, req);
      res.status(201).json(channel);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create chat channel" });
    }
  });

  app.get("/api/chat/channels/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const channel = await storage.getChatChannel(req.params.id);
      if (!channel || channel.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Channel not found" });
      }
      const messages = await storage.getChatMessagesByChannel(req.params.id);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/chat/channels/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const channel = await storage.getChatChannel(req.params.id);
      if (!channel || channel.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Channel not found" });
      }
      const message = await storage.createChatMessage({
        channelId: req.params.id,
        senderId: req.user!.id,
        content: req.body.content,
        mentions: req.body.mentions || [],
        attachments: req.body.attachments || []
      });
      res.status(201).json(message);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Appointments
  app.get("/api/appointments", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const appointments = await storage.getAppointmentsByOrganization(req.user!.organizationId!);
      res.json(appointments);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  app.post("/api/appointments", requireAuth, requirePermission("appointments.create"), async (req: AuthRequest, res: Response) => {
    try {
      const appointment = await storage.createAppointment({
        ...req.body,
        organizationId: req.user!.organizationId!,
        createdBy: req.user!.id
      });
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "appointment", appointment.id, appointment, req);
      res.status(201).json(appointment);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  app.put("/api/appointments/:id", requireAuth, requirePermission("appointments.update"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getAppointment(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      const updated = await storage.updateAppointment(req.params.id, req.body);
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "appointment", req.params.id, req.body, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update appointment" });
    }
  });

  // Email Templates
  app.get("/api/email-templates", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const templates = await storage.getEmailTemplatesByOrganization(req.user!.organizationId!);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch email templates" });
    }
  });

  app.post("/api/email-templates", requireAuth, requirePermission("templates.create"), async (req: AuthRequest, res: Response) => {
    try {
      const template = await storage.createEmailTemplate({
        ...req.body,
        organizationId: req.user!.organizationId!,
        createdBy: req.user!.id
      });
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "email_template", template.id, template, req);
      res.status(201).json(template);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create email template" });
    }
  });

  app.put("/api/email-templates/:id", requireAuth, requirePermission("templates.update"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getEmailTemplate(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Email template not found" });
      }
      const updated = await storage.updateEmailTemplate(req.params.id, req.body);
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "email_template", req.params.id, req.body, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update email template" });
    }
  });

  // PDF Annotations
  app.get("/api/documents/:id/annotations", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document || document.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Document not found" });
      }
      const annotations = await storage.getDocumentAnnotationsByDocument(req.params.id);
      res.json(annotations);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch annotations" });
    }
  });

  app.post("/api/documents/:id/annotations", requireAuth, requirePermission("documents.annotate"), async (req: AuthRequest, res: Response) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document || document.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Document not found" });
      }
      const annotation = await storage.createDocumentAnnotation({
        ...req.body,
        documentId: req.params.id,
        userId: req.user!.id
      });
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "annotation", annotation.id, annotation, req);
      res.status(201).json(annotation);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create annotation" });
    }
  });

  app.put("/api/annotations/:id", requireAuth, requirePermission("documents.annotate"), async (req: AuthRequest, res: Response) => {
    try {
      const annotation = await storage.getDocumentAnnotation(req.params.id);
      if (!annotation) {
        return res.status(404).json({ error: "Annotation not found" });
      }
      const document = await storage.getDocument(annotation.documentId);
      if (!document || document.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateDocumentAnnotation(req.params.id, req.body);
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "annotation", req.params.id, req.body, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update annotation" });
    }
  });

  app.post("/api/annotations/:id/resolve", requireAuth, requirePermission("documents.annotate"), async (req: AuthRequest, res: Response) => {
    try {
      const annotation = await storage.getDocumentAnnotation(req.params.id);
      if (!annotation) {
        return res.status(404).json({ error: "Annotation not found" });
      }
      const document = await storage.getDocument(annotation.documentId);
      if (!document || document.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const resolved = await storage.resolveAnnotation(req.params.id, req.user!.id);
      await logActivity(req.user!.id, req.user!.organizationId!, "resolve", "annotation", req.params.id, {}, req);
      res.json(resolved);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to resolve annotation" });
    }
  });

  // Expenses
  app.get("/api/expenses", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const expenses = await storage.getExpensesByOrganization(req.user!.organizationId!);
      res.json(expenses);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", requireAuth, requirePermission("expenses.create"), async (req: AuthRequest, res: Response) => {
    try {
      const expense = await storage.createExpense({
        ...req.body,
        organizationId: req.user!.organizationId!,
        userId: req.user!.id
      });
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "expense", expense.id, expense, req);
      res.status(201).json(expense);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.put("/api/expenses/:id", requireAuth, requirePermission("expenses.update"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getExpense(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Expense not found" });
      }
      const updated = await storage.updateExpense(req.params.id, req.body);
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "expense", req.params.id, req.body, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update expense" });
    }
  });

  // ========================================
  // WORKFLOW HIERARCHY - Stages, Steps, Tasks
  // ========================================

  // Workflow Stages
  app.get("/api/workflows/:workflowId/stages", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow || workflow.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      const stages = await storage.getStagesByWorkflow(req.params.workflowId);
      res.json(stages);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch stages" });
    }
  });

  app.post("/api/stages", requireAuth, requirePermission("workflows.create"), async (req: AuthRequest, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.body.workflowId);
      if (!workflow || workflow.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      const stage = await storage.createWorkflowStage(req.body);
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "workflow_stage", stage.id, stage, req);
      res.status(201).json(stage);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create stage" });
    }
  });

  app.put("/api/stages/:id", requireAuth, requirePermission("workflows.update"), async (req: AuthRequest, res: Response) => {
    try {
      const stage = await storage.getWorkflowStage(req.params.id);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }
      const workflow = await storage.getWorkflow(stage.workflowId);
      if (!workflow || workflow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateWorkflowStage(req.params.id, req.body);
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "workflow_stage", req.params.id, req.body, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update stage" });
    }
  });

  app.delete("/api/stages/:id", requireAuth, requirePermission("workflows.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const stage = await storage.getWorkflowStage(req.params.id);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }
      const workflow = await storage.getWorkflow(stage.workflowId);
      if (!workflow || workflow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteWorkflowStage(req.params.id);
      await logActivity(req.user!.id, req.user!.organizationId!, "delete", "workflow_stage", req.params.id, {}, req);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete stage" });
    }
  });

  // Workflow Steps
  app.get("/api/stages/:stageId/steps", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      const stage = await storage.getWorkflowStage(req.params.stageId);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }
      const workflow = await storage.getWorkflow(stage.workflowId);
      if (!workflow || workflow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const steps = await storage.getStepsByStage(req.params.stageId);
      res.json(steps);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch steps" });
    }
  });

  app.post("/api/steps", requireAuth, requirePermission("workflows.create"), async (req: AuthRequest, res: Response) => {
    try {
      const stage = await storage.getWorkflowStage(req.body.stageId);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }
      const workflow = await storage.getWorkflow(stage.workflowId);
      if (!workflow || workflow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const step = await storage.createWorkflowStep(req.body);
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "workflow_step", step.id, step, req);
      res.status(201).json(step);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create step" });
    }
  });

  app.put("/api/steps/:id", requireAuth, requirePermission("workflows.update"), async (req: AuthRequest, res: Response) => {
    try {
      const step = await storage.getWorkflowStep(req.params.id);
      if (!step) {
        return res.status(404).json({ error: "Step not found" });
      }
      const stage = await storage.getWorkflowStage(step.stageId);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }
      const workflow = await storage.getWorkflow(stage.workflowId);
      if (!workflow || workflow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateWorkflowStep(req.params.id, req.body);
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "workflow_step", req.params.id, req.body, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update step" });
    }
  });

  app.delete("/api/steps/:id", requireAuth, requirePermission("workflows.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const step = await storage.getWorkflowStep(req.params.id);
      if (!step) {
        return res.status(404).json({ error: "Step not found" });
      }
      const stage = await storage.getWorkflowStage(step.stageId);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }
      const workflow = await storage.getWorkflow(stage.workflowId);
      if (!workflow || workflow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteWorkflowStep(req.params.id);
      await logActivity(req.user!.id, req.user!.organizationId!, "delete", "workflow_step", req.params.id, {}, req);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete step" });
    }
  });

  // Pipeline Tasks
  app.get("/api/steps/:stepId/tasks", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      const step = await storage.getWorkflowStep(req.params.stepId);
      if (!step) {
        return res.status(404).json({ error: "Step not found" });
      }
      const stage = await storage.getWorkflowStage(step.stageId);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }
      const pipeline = await storage.getWorkflow(stage.workflowId);
      if (!pipeline || pipeline.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const tasks = await storage.getTasksByStep(req.params.stepId);
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", requireAuth, requirePermission("workflows.create"), async (req: AuthRequest, res: Response) => {
    try {
      const step = await storage.getWorkflowStep(req.body.stepId);
      if (!step) {
        return res.status(404).json({ error: "Step not found" });
      }
      const stage = await storage.getWorkflowStage(step.stageId);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }
      const pipeline = await storage.getWorkflow(stage.workflowId);
      if (!pipeline || pipeline.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const task = await storage.createWorkflowTask(req.body);
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "workflow_task", task.id, task, req);
      res.status(201).json(task);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.put("/api/tasks/:id", requireAuth, requirePermission("workflows.update"), async (req: AuthRequest, res: Response) => {
    try {
      const task = await storage.getWorkflowTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      const step = await storage.getWorkflowStep(task.stepId);
      if (!step) {
        return res.status(404).json({ error: "Step not found" });
      }
      const stage = await storage.getWorkflowStage(step.stageId);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }
      const pipeline = await storage.getWorkflow(stage.workflowId);
      if (!pipeline || pipeline.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateWorkflowTask(req.params.id, req.body);
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "workflow_task", req.params.id, req.body, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.post("/api/tasks/:id/assign", requireAuth, requirePermission("workflows.update"), async (req: AuthRequest, res: Response) => {
    try {
      const task = await storage.getWorkflowTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      const updated = await storage.assignTask(req.params.id, req.body.userId);
      await logActivity(req.user!.id, req.user!.organizationId!, "assign", "workflow_task", req.params.id, { userId: req.body.userId }, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to assign task" });
    }
  });

  app.post("/api/tasks/:id/complete", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const task = await storage.getWorkflowTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      const updated = await storage.completeTask(req.params.id, req.user!.id);
      await logActivity(req.user!.id, req.user!.organizationId!, "complete", "workflow_task", req.params.id, {}, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to complete task" });
    }
  });

  app.post("/api/tasks/:id/execute-ai", requireAuth, requirePermission("workflows.update"), async (req: AuthRequest, res: Response) => {
    try {
      const task = await storage.getWorkflowTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      if (task.type !== 'automated') {
        return res.status(400).json({ error: "Task is not automated" });
      }
      
      // Update task status to in_progress
      await storage.updateWorkflowTask(req.params.id, { status: 'in_progress' });
      
      // In a real implementation, this would trigger AI agent execution
      // For now, we'll simulate AI execution and auto-complete the task
      // This is a placeholder for actual AI agent integration
      
      await logActivity(req.user!.id, req.user!.organizationId!, "execute_ai", "workflow_task", req.params.id, {}, req);
      
      // Auto-complete after simulation (in production, this would be done by the AI agent upon completion)
      setTimeout(async () => {
        try {
          await storage.completeTask(req.params.id, req.user!.id);
          await logActivity(req.user!.id, req.user!.organizationId!, "ai_complete", "workflow_task", req.params.id, {}, req);
        } catch (error) {
          console.error("Failed to auto-complete AI task:", error);
        }
      }, 2000);
      
      res.json({ message: "AI agent execution started", taskId: req.params.id });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to execute AI agent" });
    }
  });

  // Check and send task reminders
  app.post("/api/tasks/process-reminders", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Strictly scope to authenticated user's organization only
      const organizationId = req.user!.organizationId!;
      const organizationPipelines = await storage.getWorkflowsByOrganization(organizationId);
      const tasksNeedingReminders: any[] = [];
      const now = new Date();
      
      // Get all tasks from all pipelines within this organization (flatten the hierarchy)
      for (const pipeline of organizationPipelines) {
        const stages = await storage.getStagesByWorkflow(pipeline.id);
        for (const stage of stages) {
          const steps = await storage.getStepsByStage(stage.id);
          for (const step of steps) {
            const tasks = await storage.getTasksByStep(step.id);
            for (const task of tasks) {
              // Check if task needs a reminder
              if (
                task.reminderEnabled &&
                task.dueDate &&
                task.reminderDuration &&
                task.status !== 'completed' &&
                (!task.lastReminderSent || 
                  (now.getTime() - new Date(task.lastReminderSent).getTime()) > 24 * 60 * 60 * 1000) // Only send once per day
              ) {
                const dueDate = new Date(task.dueDate);
                const reminderTime = new Date(dueDate.getTime() - task.reminderDuration * 60 * 1000);
                
                // Check if it's time to send the reminder (within the next hour)
                if (now >= reminderTime && now < new Date(reminderTime.getTime() + 60 * 60 * 1000)) {
                  tasksNeedingReminders.push({ task, pipeline, stage, step });
                }
              }
            }
          }
        }
      }
      
      // Send notifications for tasks needing reminders
      const notificationsSent = [];
      for (const { task, pipeline, stage, step } of tasksNeedingReminders) {
        const recipientIds: string[] = [];
        
        // Notify assigned user
        if (task.notifyAssignee && task.assignedTo) {
          recipientIds.push(task.assignedTo);
        }
        
        // Notify managers/admins
        if (task.notifyManager) {
          const admins = await storage.getUsersByOrganization(req.user!.organizationId!);
          const adminUsers = admins.filter(u => 
            u.roleId && (u.roleId.includes('admin') || u.roleId.includes('manager'))
          );
          recipientIds.push(...adminUsers.map(u => u.id));
        }
        
        // Notify client (if assigned user is a client)
        if (task.notifyClient && task.assignedTo) {
          const orgUsers = await storage.getUsersByOrganization(organizationId);
          const assignedUser = orgUsers.find(u => u.id === task.assignedTo);
          if (assignedUser && assignedUser.roleId && assignedUser.roleId.includes('client')) {
            recipientIds.push(task.assignedTo);
          }
        }
        
        // Create notifications
        const uniqueRecipients = Array.from(new Set(recipientIds));
        for (const userId of uniqueRecipients) {
          const notification = await storage.createNotification({
            userId,
            type: 'task_reminder',
            title: `Task Reminder: ${task.name}`,
            message: `Task "${task.name}" in workflow "${pipeline.name}" is due soon (${new Date(task.dueDate!).toLocaleString()})`,
            metadata: {
              relatedEntityType: 'workflow_task',
              relatedEntityId: task.id,
              pipelineId: pipeline.id,
              pipelineName: pipeline.name,
              dueDate: task.dueDate
            },
            isRead: false,
          });
          notificationsSent.push(notification);
        }
        
        // Update lastReminderSent
        await storage.updateWorkflowTask(task.id, { lastReminderSent: now });
      }
      
      res.json({ 
        message: "Reminders processed successfully", 
        tasksProcessed: tasksNeedingReminders.length,
        notificationsSent: notificationsSent.length 
      });
    } catch (error: any) {
      console.error("Error processing reminders:", error);
      res.status(500).json({ error: "Failed to process reminders" });
    }
  });

  // ==================== Workflow Automation Execution Routes ====================

  // Execute task automation
  app.post("/api/tasks/:id/execute-automation", requireAuth, requirePermission("workflows.update"), async (req: AuthRequest, res: Response) => {
    try {
      const { AutomationEngine } = await import('./automation-engine');
      const automationEngine = new AutomationEngine(storage);
      
      const task = await storage.getWorkflowTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Resolve hierarchy for complete context
      const step = await storage.getWorkflowStep(task.stepId);
      if (!step) {
        return res.status(404).json({ error: "Step not found" });
      }

      const stage = await storage.getWorkflowStage(step.stageId);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }

      const workflow = await storage.getWorkflow(stage.workflowId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      // Security: Verify user owns this workflow
      if (workflow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Execute task automation with complete context
      const results = await automationEngine.executeActions(
        (task.automationActions as any) || [],
        {
          taskId: task.id,
          stepId: task.stepId,
          stageId: stage.id,
          workflowId: workflow.id,
          organizationId: workflow.organizationId,
          userId: req.user!.id,
          data: task.automationInput as any,
        }
      );

      // Update automation output
      await storage.updateWorkflowTask(task.id, {
        automationOutput: results as any,
        status: results.every((r: any) => r.success) ? 'completed' : 'in_progress',
      } as any);

      await logActivity(req.user!.id, req.user!.organizationId!, "execute_automation", "workflow_task", task.id, {}, req);
      res.json({ success: true, results });
    } catch (error: any) {
      console.error("Automation execution error:", error);
      res.status(500).json({ error: "Failed to execute automation", details: error.message });
    }
  });

  // Test automation conditions
  app.post("/api/automation/test-conditions", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { AutomationEngine } = await import('./automation-engine');
      const automationEngine = new AutomationEngine(storage);
      
      const { conditions, testData } = req.body;
      const result = automationEngine.evaluateConditions(conditions, testData);
      
      res.json({ conditionsMet: result });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to test conditions", details: error.message });
    }
  });

  // Manually trigger workflow automation
  app.post("/api/workflows/:id/trigger-automation", requireAuth, requirePermission("workflows.update"), async (req: AuthRequest, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.params.id);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      if (!workflow.isAutomated) {
        return res.status(400).json({ error: "Workflow does not have automation enabled" });
      }

      // Log automation trigger
      // Note: Workflow execution metadata tracking would go here if needed

      await logActivity(req.user!.id, req.user!.organizationId!, "trigger_automation", "workflow", workflow.id, {}, req);
      res.json({ success: true, message: "Workflow automation triggered" });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to trigger automation" });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, requirePermission("workflows.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const task = await storage.getWorkflowTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      await storage.deleteWorkflowTask(req.params.id);
      await logActivity(req.user!.id, req.user!.organizationId!, "delete", "workflow_task", req.params.id, {}, req);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Task Subtasks
  app.get("/api/tasks/:taskId/subtasks", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      const task = await storage.getWorkflowTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      const subtasks = await storage.getSubtasksByTask(req.params.taskId);
      res.json(subtasks);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch subtasks" });
    }
  });

  app.post("/api/subtasks", requireAuth, requirePermission("workflows.create"), async (req: AuthRequest, res: Response) => {
    try {
      const task = await storage.getWorkflowTask(req.body.taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      const subtask = await storage.createTaskSubtask(req.body);
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "task_subtask", subtask.id, subtask, req);
      res.status(201).json(subtask);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create subtask" });
    }
  });

  app.put("/api/subtasks/:id", requireAuth, requirePermission("workflows.update"), async (req: AuthRequest, res: Response) => {
    try {
      const subtask = await storage.getTaskSubtask(req.params.id);
      if (!subtask) {
        return res.status(404).json({ error: "Subtask not found" });
      }
      const updated = await storage.updateTaskSubtask(req.params.id, req.body);
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "task_subtask", req.params.id, req.body, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update subtask" });
    }
  });

  app.post("/api/subtasks/:id/complete", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const subtask = await storage.getTaskSubtask(req.params.id);
      if (!subtask) {
        return res.status(404).json({ error: "Subtask not found" });
      }
      const updated = await storage.completeSubtask(req.params.id, req.user!.id);
      await logActivity(req.user!.id, req.user!.organizationId!, "complete", "task_subtask", req.params.id, {}, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to complete subtask" });
    }
  });

  app.delete("/api/subtasks/:id", requireAuth, requirePermission("workflows.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const subtask = await storage.getTaskSubtask(req.params.id);
      if (!subtask) {
        return res.status(404).json({ error: "Subtask not found" });
      }
      await storage.deleteTaskSubtask(req.params.id);
      await logActivity(req.user!.id, req.user!.organizationId!, "delete", "task_subtask", req.params.id, {}, req);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete subtask" });
    }
  });

  // Task Checklists
  app.get("/api/tasks/:taskId/checklists", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      const task = await storage.getWorkflowTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      const checklists = await storage.getChecklistsByTask(req.params.taskId);
      res.json(checklists);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch checklists" });
    }
  });

  app.post("/api/checklists", requireAuth, requirePermission("workflows.create"), async (req: AuthRequest, res: Response) => {
    try {
      const task = await storage.getWorkflowTask(req.body.taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      const checklist = await storage.createTaskChecklist(req.body);
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "task_checklist", checklist.id, checklist, req);
      res.status(201).json(checklist);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create checklist item" });
    }
  });

  app.post("/api/checklists/:id/toggle", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const checklist = await storage.getTaskChecklist(req.params.id);
      if (!checklist) {
        return res.status(404).json({ error: "Checklist item not found" });
      }
      const updated = await storage.toggleChecklistItem(req.params.id, req.user!.id);
      await logActivity(req.user!.id, req.user!.organizationId!, "toggle", "task_checklist", req.params.id, {}, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to toggle checklist item" });
    }
  });

  app.delete("/api/checklists/:id", requireAuth, requirePermission("workflows.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const checklist = await storage.getTaskChecklist(req.params.id);
      if (!checklist) {
        return res.status(404).json({ error: "Checklist item not found" });
      }
      await storage.deleteTaskChecklist(req.params.id);
      await logActivity(req.user!.id, req.user!.organizationId!, "delete", "task_checklist", req.params.id, {}, req);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete checklist item" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
