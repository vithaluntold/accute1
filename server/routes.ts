import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { storage } from "./storage";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  requireAuth,
  requirePermission,
  requirePlatform,
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
  insertMarketplaceItemSchema,
  insertMarketplaceInstallationSchema,
  insertWorkflowAssignmentSchema,
  insertFolderSchema,
} from "@shared/schema";
import bcrypt from "bcrypt";
import crypto from "crypto";
import * as cryptoUtils from "./crypto-utils";
import { autoProgressionEngine } from "./auto-progression";

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

      // Get role and permissions
      const role = await storage.getRole(user.roleId);
      const permissions = await storage.getPermissionsByRole(user.roleId);

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
          permissions: permissions.map(p => p.name),
        },
        role,
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

      // Get role and permissions
      const role = await storage.getRole(user.roleId);
      const permissions = await storage.getPermissionsByRole(user.roleId);

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
          permissions: permissions.map(p => p.name),
        },
        role,
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

  // Get super admin keys (requires platform admin)
  app.get("/api/super-admin/keys", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const keys = await storage.getSuperAdminKeysByUser(req.userId!);
      res.json(keys);
    } catch (error: any) {
      console.error("Get super admin keys error:", error);
      res.status(500).json({ error: "Failed to fetch super admin keys" });
    }
  });

  // Generate super admin key (requires platform admin)
  app.post("/api/super-admin/keys", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
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

      // Get role and permissions
      const role = await storage.getRole(user.roleId);
      const permissions = await storage.getPermissionsByRole(user.roleId);

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
          permissions: permissions.map(p => p.name),
        },
        role,
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

      // Get role and permissions
      const role = await storage.getRole(user.roleId);
      const permissions = await storage.getPermissionsByRole(user.roleId);

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
          permissions: permissions.map(p => p.name),
        },
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        },
        role,
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

      // Get role and permissions
      const role = await storage.getRole(user.roleId);
      const permissions = await storage.getPermissionsByRole(user.roleId);

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
          permissions: permissions.map(p => p.name),
        },
        role,
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
      const { password, roleId, ...userData } = req.body;
      
      // Prevent assigning users to platform roles
      if (roleId) {
        const role = await storage.getRole(roleId);
        if (role && role.scope === "platform") {
          return res.status(403).json({ error: "Cannot assign users to platform roles" });
        }
      }
      
      const hashedPassword = await hashPassword(password);
      
      const user = await storage.createUser({
        ...userData,
        roleId,
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
      const { password, roleId, ...userData } = req.body;
      
      // Prevent assigning users to platform roles
      if (roleId) {
        const role = await storage.getRole(roleId);
        if (role && role.scope === "platform") {
          return res.status(403).json({ error: "Cannot assign users to platform roles" });
        }
      }
      
      const updateData = password 
        ? { ...userData, roleId, password: await hashPassword(password) }
        : { ...userData, roleId };

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
      // Only return tenant-scoped roles (never show platform roles like Super Admin)
      const roles = await storage.getTenantRoles(req.user!.organizationId || undefined);
      res.json(roles);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  app.post("/api/roles", requireAuth, requirePermission("roles.create"), async (req: AuthRequest, res: Response) => {
    try {
      const role = await storage.createRole({
        ...req.body,
        scope: "tenant", // Always create tenant-scoped roles (never platform)
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
      
      // Prevent assigning platform permissions to tenant roles
      const permission = await storage.getPermission(permissionId);
      if (permission && permission.resource === "platform") {
        return res.status(403).json({ error: "Cannot assign platform permissions to tenant roles" });
      }
      
      // Prevent modifying platform roles
      const role = await storage.getRole(roleId);
      if (role && role.scope === "platform") {
        return res.status(403).json({ error: "Cannot modify platform roles" });
      }
      
      await storage.assignPermissionToRole(roleId, permissionId);
      await logActivity(req.userId, req.user!.organizationId || undefined, "assign_permission", "role", roleId, { permissionId }, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to assign permission" });
    }
  });

  app.delete("/api/roles/:roleId/permissions/:permissionId", requireAuth, requirePermission("roles.edit"), async (req: AuthRequest, res: Response) => {
    try {
      const { roleId, permissionId } = req.params;
      
      // Prevent modifying platform roles
      const role = await storage.getRole(roleId);
      if (role && role.scope === "platform") {
        return res.status(403).json({ error: "Cannot modify platform roles" });
      }
      
      await storage.removePermissionFromRole(roleId, permissionId);
      await logActivity(req.userId, req.user!.organizationId || undefined, "remove_permission", "role", roleId, { permissionId }, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to remove permission" });
    }
  });

  app.delete("/api/roles/:id", requireAuth, requirePermission("roles.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const role = await storage.getRole(req.params.id);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      if (role.scope === "platform") {
        return res.status(403).json({ error: "Cannot delete platform roles" });
      }
      if (role.isSystemRole) {
        return res.status(403).json({ error: "Cannot delete system roles" });
      }
      if (role.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteRole(req.params.id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "role", req.params.id, { name: role.name }, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete role" });
    }
  });

  // ==================== Permission Routes ====================
  
  app.get("/api/permissions", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const allPermissions = await storage.getAllPermissions();
      // Filter out platform permissions for tenant users
      const permissions = allPermissions.filter(p => p.resource !== "platform");
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
      const { provider, apiKey, endpoint, apiVersion, model } = req.body;
      
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
          
          if (!model) {
            return res.status(400).json({ 
              success: false, 
              message: "Model/Deployment name is required for Azure OpenAI" 
            });
          }
          
          // Remove trailing slash from endpoint if present
          const cleanEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
          
          // Use provided API version or default to latest
          const azureApiVersion = apiVersion || '2025-01-01-preview';
          
          // Use minimal chat completion as health check (like the user's Python code)
          const testUrl = `${cleanEndpoint}/openai/deployments/${model}/chat/completions?api-version=${azureApiVersion}`;
          
          console.log('[Azure Health Check] Testing URL:', testUrl);
          
          const response = await fetch(testUrl, {
            method: 'POST',
            headers: {
              'api-key': apiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messages: [{ role: 'user', content: 'Hi' }],
              max_tokens: 5
            }),
            signal: AbortSignal.timeout(10000)
          });
          
          console.log('[Azure Health Check] Response status:', response.status);
          
          if (response.ok) {
            const data = await response.json();
            console.log('[Azure Health Check] Success:', data);
            testResult = { success: true, message: "Azure OpenAI connection successful" };
          } else {
            let errorMessage = `HTTP ${response.status}`;
            try {
              const errorJson = await response.json();
              console.error('[Azure Health Check] Error JSON:', errorJson);
              errorMessage = errorJson.error?.message || errorJson.message || JSON.stringify(errorJson);
            } catch {
              const errorText = await response.text();
              console.error('[Azure Health Check] Error text:', errorText);
              errorMessage = errorText || errorMessage;
            }
            testResult = { 
              success: false, 
              message: errorMessage
            };
          }
        } catch (error: any) {
          console.error('[Azure Health Check] Exception:', error);
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

  // Execute AI Agent with conversation persistence and function calling
  app.post("/api/ai-agents/execute", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { agentName, input, llmConfigId, conversationId, contextType, contextId, contextData } = req.body;
      const startTime = Date.now();
      
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
      
      // Find or create conversation
      let conversation;
      if (conversationId) {
        conversation = await storage.getAiConversation(conversationId);
        if (!conversation || conversation.userId !== req.user!.id) {
          return res.status(404).json({ error: "Conversation not found" });
        }
      } else if (contextType && contextId) {
        // Try to find existing conversation for this context
        conversation = await storage.getAiConversationByContext(
          contextType,
          contextId,
          req.user!.id,
          agentName
        );
      }
      
      // Create new conversation if none exists
      if (!conversation) {
        conversation = await storage.createAiConversation({
          agentName,
          organizationId: req.user!.organizationId!,
          userId: req.user!.id,
          contextType: contextType || null,
          contextId: contextId || null,
          contextData: contextData || {}
        });
      }
      
      // Save user message
      const userMessage = await storage.createAiMessage({
        conversationId: conversation.id,
        role: "user",
        content: input,
        llmConfigId: llmConfig.id
      });
      
      // Load and execute the appropriate agent
      // Normalize agent name to lowercase and remove spaces for matching
      const normalizedAgentName = agentName.toLowerCase().replace(/\s+/g, '');
      
      let result;
      switch (normalizedAgentName) {
        case 'kanban':
        case 'kanbanview': {
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
      
      // TODO: Parse result for function/tool calls and execute them
      // For now, just save the agent's response
      const executionTime = Date.now() - startTime;
      
      // Create response message
      const assistantMessage = await storage.createAiMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: typeof result === 'string' ? result : JSON.stringify(result),
        llmConfigId: llmConfig.id,
        executionTimeMs: executionTime
      });
      
      await logActivity(req.user!.id, req.user!.organizationId!, "execute", "ai_agent", agentName, { input }, req);
      
      res.json({ 
        success: true, 
        result,
        conversationId: conversation.id,
        messageId: assistantMessage.id
      });
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

  // ==================== Marketplace Routes ====================
  
  // Get all published marketplace items (public view)
  app.get("/api/marketplace/items", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { category } = req.query;
      const items = req.user!.organizationId
        ? await storage.getMarketplaceItemsForOrganization(req.user!.organizationId, category as string)
        : await storage.getAllPublishedMarketplaceItems();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch marketplace items" });
    }
  });

  // Get single marketplace item
  app.get("/api/marketplace/items/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const item = await storage.getMarketplaceItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Marketplace item not found" });
      }
      
      // Check access: public items or org-owned items
      if (!item.isPublic && item.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch marketplace item" });
    }
  });

  // Create marketplace item (Super Admin only)
  app.post("/api/marketplace/items", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const validated = insertMarketplaceItemSchema.parse(req.body);
      const item = await storage.createMarketplaceItem({
        ...validated,
        createdBy: req.userId!,
      });
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "marketplace_item", item.id, { name: item.name, category: item.category }, req);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create marketplace item" });
    }
  });

  // Update marketplace item (Super Admin or item creator)
  app.patch("/api/marketplace/items/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getMarketplaceItem(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Marketplace item not found" });
      }

      // Check permission: Super Admin or org-owned item
      const role = await storage.getRole(req.user!.roleId);
      if (role?.scope !== 'platform' && existing.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const validated = insertMarketplaceItemSchema.partial().parse(req.body);
      const item = await storage.updateMarketplaceItem(req.params.id, validated);
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "marketplace_item", req.params.id, {}, req);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update marketplace item" });
    }
  });

  // Delete marketplace item (Super Admin only)
  app.delete("/api/marketplace/items/:id", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      await storage.deleteMarketplaceItem(req.params.id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "marketplace_item", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete marketplace item" });
    }
  });

  // Install marketplace item
  app.post("/api/marketplace/install/:itemId", requireAuth, requirePermission("marketplace.install"), async (req: AuthRequest, res: Response) => {
    try {
      const item = await storage.getMarketplaceItem(req.params.itemId);
      if (!item || item.status !== 'published') {
        return res.status(404).json({ error: "Marketplace item not found or not published" });
      }

      // Check if already installed
      const existing = await storage.getMarketplaceInstallationByItemAndOrg(req.params.itemId, req.user!.organizationId!);
      if (existing) {
        return res.status(400).json({ error: "Item already installed" });
      }

      const installation = await storage.createMarketplaceInstallation({
        itemId: req.params.itemId,
        organizationId: req.user!.organizationId!,
        installedBy: req.userId!,
        purchasePrice: item.pricingModel !== 'free' ? item.price : null,
      });

      // Increment install count
      await storage.incrementMarketplaceInstallCount(req.params.itemId);

      await logActivity(req.userId, req.user!.organizationId || undefined, "install", "marketplace_item", req.params.itemId, { name: item.name }, req);
      res.json(installation);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to install marketplace item" });
    }
  });

  // Uninstall marketplace item
  app.delete("/api/marketplace/install/:installationId", requireAuth, requirePermission("marketplace.install"), async (req: AuthRequest, res: Response) => {
    try {
      const installation = await storage.getMarketplaceInstallation(req.params.installationId);
      if (!installation || installation.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Installation not found" });
      }

      await storage.deleteMarketplaceInstallation(req.params.installationId);
      await logActivity(req.userId, req.user!.organizationId || undefined, "uninstall", "marketplace_item", installation.itemId, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to uninstall marketplace item" });
    }
  });

  // Get organization's installed items
  app.get("/api/marketplace/installations", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const installations = req.user!.organizationId
        ? await storage.getMarketplaceInstallationsByOrganization(req.user!.organizationId)
        : [];
      res.json(installations);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch installations" });
    }
  });

  // Create workflow from installed template
  app.post("/api/marketplace/create-from-template/:itemId", requireAuth, requirePermission("workflows.create"), async (req: AuthRequest, res: Response) => {
    let workflowId: string | null = null;
    
    try {
      // Verify user has installed the template
      const installation = await storage.getMarketplaceInstallationByItemAndOrg(req.params.itemId, req.user!.organizationId!);
      if (!installation) {
        return res.status(403).json({ error: "Template not installed. Please install it from the marketplace first." });
      }

      // Get the marketplace item
      const item = await storage.getMarketplaceItem(req.params.itemId);
      if (!item || item.category !== 'pipeline_template') {
        return res.status(400).json({ error: "This item is not a pipeline template" });
      }

      // Extract template content
      const templateContent = item.content as any;
      if (!templateContent || !templateContent.name) {
        return res.status(400).json({ error: "Invalid template structure" });
      }

      // Create workflow from template
      const workflow = await storage.createWorkflow({
        name: req.body.name || `${templateContent.name} (from template)`,
        description: req.body.description || templateContent.description || `Created from marketplace template: ${item.name}`,
        organizationId: req.user!.organizationId!,
        createdBy: req.userId!,
        category: templateContent.category || 'general',
        status: 'draft',
        nodes: [],  // Don't copy nodes/edges yet - they need ID remapping
        edges: [],
      });
      
      workflowId = workflow.id;

      // Map old IDs to new IDs for remapping nodes/edges later
      const stageIdMap = new Map<string, string>();
      const stepIdMap = new Map<string, string>();
      const taskIdMap = new Map<string, string>();

      // Create stages from template
      if (templateContent.stages && Array.isArray(templateContent.stages)) {
        for (const stageData of templateContent.stages) {
          const stage = await storage.createWorkflowStage({
            workflowId: workflow.id,
            name: stageData.name,
            description: stageData.description,
            order: stageData.order || 0,
            autoProgress: stageData.autoProgress !== undefined ? stageData.autoProgress : true,
          });
          
          if (stageData.id) {
            stageIdMap.set(stageData.id, stage.id);
          }

          // Create steps for this stage
          if (stageData.steps && Array.isArray(stageData.steps)) {
            for (const stepData of stageData.steps) {
              const step = await storage.createWorkflowStep({
                stageId: stage.id,
                name: stepData.name,
                description: stepData.description,
                order: stepData.order || 0,
                autoProgress: stepData.autoProgress !== undefined ? stepData.autoProgress : true,
              });
              
              if (stepData.id) {
                stepIdMap.set(stepData.id, step.id);
              }

              // Create tasks for this step
              if (stepData.tasks && Array.isArray(stepData.tasks)) {
                for (const taskData of stepData.tasks) {
                  const task = await storage.createWorkflowTask({
                    stepId: step.id,
                    name: taskData.name,
                    description: taskData.description,
                    order: taskData.order || 0,
                    type: taskData.type || taskData.taskType || 'manual',  // Fixed: use 'type' instead of 'taskType'
                    assignedTo: null, // Not assigned yet
                    autoProgress: taskData.autoProgress !== undefined ? taskData.autoProgress : false,
                  });
                  
                  if (taskData.id) {
                    taskIdMap.set(taskData.id, task.id);
                  }
                }
              }
            }
          }
        }
      }

      // Remap nodes and edges with new IDs
      let remappedNodes = [];
      let remappedEdges = [];
      
      if (templateContent.nodes && Array.isArray(templateContent.nodes)) {
        remappedNodes = templateContent.nodes.map((node: any) => {
          const newNode = { ...node };
          
          // Remap node ID if it references a stage/step/task
          if (node.data?.stageId && stageIdMap.has(node.data.stageId)) {
            newNode.data = { ...newNode.data, stageId: stageIdMap.get(node.data.stageId) };
          }
          if (node.data?.stepId && stepIdMap.has(node.data.stepId)) {
            newNode.data = { ...newNode.data, stepId: stepIdMap.get(node.data.stepId) };
          }
          if (node.data?.taskId && taskIdMap.has(node.data.taskId)) {
            newNode.data = { ...newNode.data, taskId: taskIdMap.get(node.data.taskId) };
          }
          
          return newNode;
        });
      }
      
      if (templateContent.edges && Array.isArray(templateContent.edges)) {
        remappedEdges = templateContent.edges;
      }

      // Update workflow with remapped nodes/edges
      await storage.updateWorkflow(workflow.id, {
        nodes: remappedNodes,
        edges: remappedEdges,
      });

      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "workflow", workflow.id, { name: workflow.name, fromTemplate: item.name }, req);
      
      // Fetch updated workflow with all data
      const updatedWorkflow = await storage.getWorkflow(workflow.id);
      res.json(updatedWorkflow);
    } catch (error: any) {
      console.error('Failed to create workflow from template:', error);
      
      // Cleanup: Delete the workflow if it was created
      if (workflowId) {
        try {
          await storage.deleteWorkflow(workflowId);
          console.log(`Cleaned up orphaned workflow ${workflowId} after template creation failure`);
        } catch (cleanupError) {
          console.error('Failed to cleanup workflow:', cleanupError);
        }
      }
      
      res.status(500).json({ error: "Failed to create workflow from template: " + error.message });
    }
  });

  // ==================== Workflow Assignment Routes ====================
  
  // Get all assignments for organization
  app.get("/api/assignments", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      const assignments = req.user!.organizationId
        ? await storage.getWorkflowAssignmentsByOrganization(req.user!.organizationId)
        : [];
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch assignments" });
    }
  });

  // Get assignments for a specific client
  app.get("/api/assignments/client/:clientId", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      const assignments = await storage.getWorkflowAssignmentsByClient(req.params.clientId);
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch client assignments" });
    }
  });

  // Get assignments for logged-in employee
  app.get("/api/assignments/my-tasks", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const assignments = await storage.getWorkflowAssignmentsByEmployee(req.userId!);
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch your assignments" });
    }
  });

  // Get single assignment with full details (stages, steps, tasks, client, workflow)
  app.get("/api/assignments/:id", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      const assignment = await storage.getWorkflowAssignment(req.params.id);
      if (!assignment || assignment.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      // Fetch related data
      const [client, workflow, assignee] = await Promise.all([
        storage.getClient(assignment.clientId),
        storage.getWorkflow(assignment.workflowId),
        assignment.assignedTo ? storage.getUser(assignment.assignedTo) : null,
      ]);

      // Fetch workflow structure with stages, steps, and tasks
      const stages = await storage.getStagesByWorkflow(assignment.workflowId);
      const stagesWithStepsAndTasks = await Promise.all(
        stages.map(async (stage) => {
          const steps = await storage.getStepsByStage(stage.id);
          const stepsWithTasks = await Promise.all(
            steps.map(async (step) => {
              const tasks = await storage.getTasksByStep(step.id);
              return { ...step, tasks };
            })
          );
          return { ...stage, steps: stepsWithTasks };
        })
      );

      res.json({
        ...assignment,
        client,
        workflow,
        assignee,
        stages: stagesWithStepsAndTasks,
      });
    } catch (error: any) {
      console.error('Failed to fetch assignment details:', error);
      res.status(500).json({ error: "Failed to fetch assignment details" });
    }
  });

  // Create workflow assignment (Client + Workflow = Assignment)
  app.post("/api/assignments", requireAuth, requirePermission("workflows.create"), async (req: AuthRequest, res: Response) => {
    try {
      const validated = insertWorkflowAssignmentSchema.parse(req.body);
      
      // Verify workflow belongs to org
      const workflow = await storage.getWorkflow(validated.workflowId);
      if (!workflow || workflow.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      // Verify client belongs to org
      const client = await storage.getClient(validated.clientId);
      if (!client || client.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Count stages in workflow
      const stages = await storage.getStagesByWorkflow(validated.workflowId);

      const assignment = await storage.createWorkflowAssignment({
        ...validated,
        organizationId: req.user!.organizationId!,
        assignedBy: req.userId!,
        totalStages: stages.length,
      });

      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "workflow_assignment", assignment.id, { client: client.companyName, workflow: workflow.name }, req);
      res.json(assignment);
    } catch (error: any) {
      console.error('Assignment creation error:', error);
      res.status(500).json({ error: "Failed to create assignment" });
    }
  });

  // Update assignment
  app.patch("/api/assignments/:id", requireAuth, requirePermission("workflows.edit"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getWorkflowAssignment(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      const validated = insertWorkflowAssignmentSchema.partial().parse(req.body);
      const assignment = await storage.updateWorkflowAssignment(req.params.id, validated);
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "workflow_assignment", req.params.id, {}, req);
      res.json(assignment);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update assignment" });
    }
  });

  // Delete assignment
  app.delete("/api/assignments/:id", requireAuth, requirePermission("workflows.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getWorkflowAssignment(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      await storage.deleteWorkflowAssignment(req.params.id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "workflow_assignment", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete assignment" });
    }
  });

  // ==================== Folder Routes ====================
  
  // Get all folders for organization
  app.get("/api/folders", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const folders = req.user!.organizationId
        ? await storage.getFoldersByOrganization(req.user!.organizationId)
        : [];
      res.json(folders);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch folders" });
    }
  });

  // Get folders by parent (for hierarchical navigation)
  app.get("/api/folders/parent/:parentId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const parentId = req.params.parentId === 'null' ? null : req.params.parentId;
      const folders = req.user!.organizationId
        ? await storage.getFoldersByParent(parentId, req.user!.organizationId)
        : [];
      res.json(folders);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch folders" });
    }
  });

  // Create folder
  app.post("/api/folders", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const validated = insertFolderSchema.omit({ organizationId: true, createdBy: true }).parse(req.body);
      const folder = await storage.createFolder({
        ...validated,
        organizationId: req.user!.organizationId!,
        createdBy: req.userId!,
      });
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "folder", folder.id, { name: folder.name }, req);
      res.json(folder);
    } catch (error: any) {
      console.error("Failed to create folder:", error);
      res.status(500).json({ error: "Failed to create folder", details: error.message });
    }
  });

  // Update folder
  app.patch("/api/folders/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getFolder(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Folder not found" });
      }

      const validated = insertFolderSchema.partial().parse(req.body);
      const folder = await storage.updateFolder(req.params.id, validated);
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "folder", req.params.id, {}, req);
      res.json(folder);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update folder" });
    }
  });

  // Delete folder
  app.delete("/api/folders/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getFolder(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Folder not found" });
      }

      await storage.deleteFolder(req.params.id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "folder", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete folder" });
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

      // Generate cryptographic hash and digital signature for tamper-proof security
      const fileBuffer = fs.readFileSync(req.file.path);
      const documentHash = cryptoUtils.generateDocumentHash(fileBuffer);
      const digitalSignature = await cryptoUtils.signDocumentHash(documentHash, req.user!.organizationId!);
      const signedAt = new Date();

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
        // PKI Digital Signature fields
        documentHash,
        digitalSignature,
        signatureAlgorithm: "RSA-SHA256",
        signedAt,
        signedBy: req.userId!,
        verificationStatus: "verified",
      };

      const document = await storage.createDocument(documentData);
      await logActivity(req.userId, req.user!.organizationId || undefined, "upload", "document", document.id, { 
        name: document.name,
        hash: documentHash.substring(0, 16) + "...", // Log partial hash for audit trail
        signed: true 
      }, req);
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

  // Verify document integrity and digital signature
  app.post("/api/documents/:id/verify", requireAuth, requirePermission("documents.view"), async (req: AuthRequest, res: Response) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Check organization access
      if (document.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check if document has been signed
      if (!document.documentHash || !document.digitalSignature) {
        return res.json({
          verified: false,
          status: "unsigned",
          message: "Document was not digitally signed during upload",
        });
      }

      const filePath = path.join(process.cwd(), document.url.replace(/^\//, ''));
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }

      // Read current file and verify integrity
      const currentFileBuffer = fs.readFileSync(filePath);
      const isIntegrityValid = cryptoUtils.verifyDocumentIntegrity(document.documentHash, currentFileBuffer);

      // Verify digital signature
      const isSignatureValid = await cryptoUtils.verifySignature(
        document.documentHash,
        document.digitalSignature,
        document.organizationId
      );

      const verified = isIntegrityValid && isSignatureValid;

      // Update verification status in database
      if (verified && document.verificationStatus !== "verified") {
        await storage.updateDocument(document.id, { verificationStatus: "verified" });
      } else if (!verified && document.verificationStatus !== "tampered") {
        await storage.updateDocument(document.id, { verificationStatus: "tampered" });
      }

      res.json({
        verified,
        status: verified ? "verified" : "tampered",
        integrity: isIntegrityValid ? "valid" : "invalid",
        signature: isSignatureValid ? "valid" : "invalid",
        algorithm: document.signatureAlgorithm,
        signedAt: document.signedAt,
        signedBy: document.signedBy,
        message: verified 
          ? "Document is authentic and has not been tampered with" 
          : "CRITICAL: Document has been modified or signature is invalid",
      });
    } catch (error: any) {
      console.error("Document verification error:", error);
      res.status(500).json({ error: "Failed to verify document" });
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

  // Generate Engagement Letter PDF
  app.post("/api/documents/generate-engagement-letter", requireAuth, requirePermission("documents.upload"), async (req: AuthRequest, res: Response) => {
    try {
      const { content, clientName, title } = req.body;

      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      // Import jsPDF dynamically
      const { default: jsPDF } = await import('jspdf');
      
      const doc = new jsPDF();
      
      // Set up document styling
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);
      let y = margin;

      // Add title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      const docTitle = title || 'Engagement Letter';
      doc.text(docTitle, margin, y);
      y += 15;

      // Add content
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      
      // Split content into lines and paragraphs
      const paragraphs = content.split('\n\n');
      
      for (const paragraph of paragraphs) {
        if (y > pageHeight - 30) {
          doc.addPage();
          y = margin;
        }

        const lines = doc.splitTextToSize(paragraph, maxWidth);
        for (const line of lines) {
          if (y > pageHeight - 20) {
            doc.addPage();
            y = margin;
          }
          doc.text(line, margin, y);
          y += 6;
        }
        y += 4; // Extra space between paragraphs
      }

      // Generate filename
      const timestamp = Date.now();
      const filename = `engagement-letter-${timestamp}.pdf`;
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const filepath = path.join(uploadDir, filename);
      
      // Save PDF
      const pdfBuffer = doc.output('arraybuffer');
      fs.writeFileSync(filepath, Buffer.from(pdfBuffer));

      // Generate hash and signature
      const pdfBufferForHash = fs.readFileSync(filepath);
      const documentHash = cryptoUtils.generateDocumentHash(pdfBufferForHash);
      const signature = await cryptoUtils.signDocumentHash(documentHash, req.user!.organizationId!);

      // Save to database
      const document = await storage.createDocument({
        name: filename,
        url: `/uploads/${filename}`,
        type: 'application/pdf',
        size: fs.statSync(filepath).size,
        uploadedBy: req.userId!,
        organizationId: req.user!.organizationId!,
        documentHash,
        digitalSignature: signature,
        signatureAlgorithm: 'RSA-SHA256',
        signedAt: new Date(),
        signedBy: req.userId!,
        verificationStatus: 'verified',
      });

      // Save as reusable template (similar to TaxDome's engagement letter templates)
      const templateName = title || clientName 
        ? `${title || 'Engagement Letter'}${clientName ? ` - ${clientName}` : ''}`
        : 'AI-Generated Engagement Letter';
      
      const template = await storage.createDocumentTemplate({
        name: templateName,
        category: 'engagement_letter',
        content: content,
        description: 'AI-generated engagement letter template created by Parity',
        organizationId: req.user!.organizationId!,
        createdBy: req.userId!,
        isDefault: false,
        isActive: true,
      });

      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "document", document.id, { name: filename, type: 'engagement_letter', templateId: template.id }, req);

      res.json({ ...document, templateId: template.id });
    } catch (error: any) {
      console.error("Failed to generate engagement letter:", error);
      res.status(500).json({ error: "Failed to generate engagement letter PDF" });
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
      const validated = insertClientSchema.omit({ organizationId: true, createdBy: true }).parse(req.body);
      const client = await storage.createClient({
        ...validated,
        organizationId: req.user!.organizationId!,
        createdBy: req.userId!,
      });
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "client", client.id, { name: client.companyName }, req);
      res.json(client);
    } catch (error: any) {
      console.error("[ERROR] Failed to create client:", error);
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

  // ==================== AI Client Onboarding Routes ====================
  
  // Start a new AI-assisted client onboarding session
  app.post("/api/client-onboarding/start", requireAuth, requirePermission("clients.create"), async (req: AuthRequest, res: Response) => {
    try {
      const session = await storage.createOnboardingSession({
        organizationId: req.user!.organizationId!,
        createdBy: req.userId!,
        status: "in_progress",
        collectedData: {},
        sensitiveData: {},
      });

      // Create initial system message
      await storage.createOnboardingMessage({
        sessionId: session.id,
        role: "assistant",
        content: "Hello! I'm here to help you onboard a new client. Let's start by understanding your client better. Is this client an individual or a business entity?",
        metadata: {},
      });

      const messages = await storage.getOnboardingMessages(session.id);
      res.json({ session, messages });
    } catch (error: any) {
      console.error("Failed to start onboarding session:", error);
      res.status(500).json({ error: "Failed to start onboarding session" });
    }
  });

  // Get session details (for fetching AI metadata)
  app.get("/api/client-onboarding/session/:sessionId", requireAuth, requirePermission("clients.create"), async (req: AuthRequest, res: Response) => {
    try {
      const session = await storage.getOnboardingSession(req.params.sessionId);
      if (!session || session.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  // Send message to AI and get response with privacy filtering
  app.post("/api/client-onboarding/chat", requireAuth, requirePermission("clients.create"), async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId, message, sensitiveData } = req.body;
      
      if (!sessionId || !message) {
        return res.status(400).json({ error: "Session ID and message are required" });
      }

      // Verify session ownership
      const session = await storage.getOnboardingSession(sessionId);
      if (!session || session.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Store user message
      await storage.createOnboardingMessage({
        sessionId,
        role: "user",
        content: message,
        metadata: {},
      });

      // Update sensitive data if provided (never sent to AI)
      if (sensitiveData) {
        const currentSensitive = (session.sensitiveData as Record<string, any>) || {};
        await storage.updateOnboardingSession(sessionId, {
          sensitiveData: {
            ...currentSensitive,
            ...sensitiveData,
          } as any,
        });
      }

      // Get default LLM configuration
      const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId);
      if (!llmConfig) {
        return res.status(400).json({ error: "No default LLM configuration found. Please configure an LLM provider first." });
      }

      // Build conversation history with privacy filtering
      const allMessages = await storage.getOnboardingMessages(sessionId);
      const conversationHistory = allMessages.map(msg => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      }));

      // Build AI system prompt
      const systemPrompt = `You are an expert AI assistant helping to guide client onboarding for an accounting/finance firm. 

**CRITICAL PRIVACY RULE**: You are a GUIDE ONLY. You NEVER collect, see, or process ANY sensitive data including:
- Names, emails, phone numbers, addresses (contact information)
- Tax IDs (SSN, PAN, GST, EIN, VAT, UTR, TRN, etc.)
- Any personally identifiable or confidential business information

**Your Role:**

1. **Ask qualifying questions** to understand the client's situation:
   - "Is this client an individual or a business entity?"
   - "Which country does the client operate in?"
   - "What industry is the business in?"
   - "Is the business registered for VAT/GST?"

2. **Provide guidance** on what information will be needed:
   - Explain which tax IDs are required for their country/type
   - Describe the format and purpose of each tax ID
   - Guide them through the requirements
   
   Example: "For a business in India, you'll need to provide a PAN (Permanent Account Number - 10 characters in format AAAPL1234C) and if GST-registered, the GSTIN number."

3. **Inform the user** when to fill the secure form:
   - Tell them: "Please fill out the Contact & Company Information form below with the company name, contact details, and tax identification numbers."
   - Never ask them to tell you these values in chat

4. **Track requirements with DETAILED VALIDATION** - As you learn about their situation, respond with JSON metadata including:
   - Required fields for their geography/type
   - Validation rules (format, pattern, length, cross-field dependencies)
   - Helpful placeholders showing the exact format
   - Human-readable validation descriptions
   
   At the end of each response, include on a new line: \`METADATA: {...}\`
   
   **Metadata Structure:**
   \`\`\`json
   {
     "country": "string",
     "clientType": "individual|business",
     "industry": "string (optional)",
     "gstRegistered": boolean (optional),
     "vatRegistered": boolean (optional),
     "requiredFields": ["field1", "field2"], // Tax ID field names only (contact fields always shown)
     "validations": {
       "fieldName": {
         "placeholder": "Example format",
         "format": "Human-readable format description",
         "pattern": "regex pattern (optional)",
         "length": number or "min-max",
         "rules": ["Rule 1", "Rule 2"],
         "crossFieldValidation": {
           "contains": "otherField", // This field should contain another field's value
           "derivedFrom": "otherField", // This field is derived from another field
           "message": "Validation hint"
         }
       }
     }
   }
   \`\`\`
   
   **Example for India Business (with state code logic):**
   \`METADATA: {"country": "India", "clientType": "business", "gstRegistered": true, "requiredFields": ["pan", "gstin"], "validations": {"pan": {"placeholder": "AAAPL1234C", "format": "10 alphanumeric characters", "pattern": "^[A-Z]{5}[0-9]{4}[A-Z]{1}$", "length": 10, "rules": ["First 5 characters: Alphabetic uppercase", "Next 4 digits: Numeric", "4th character must be 'C' for company (or 'P' for individual)", "5th character matches first letter of entity name", "Last character: Alphabetic check digit"]}, "gstin": {"placeholder": "27AAAPL1234C1Z5", "format": "15 characters", "pattern": "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", "length": 15, "rules": ["First 2 digits: State code (e.g., 27 for Maharashtra)", "Characters 3-12: Must match the PAN number exactly", "13th character: Entity number (1-9, A-Z)", "14th character: Always 'Z'", "15th character: Check digit"], "crossFieldValidation": {"contains": "pan", "expectedPrefix": "27", "derivedFrom": "state", "message": "GSTIN must contain the PAN and start with state code (e.g., 27 for Maharashtra)"}}}}\`
   
   **IMPORTANT**: When user provides their state/address, calculate the state code and include \`expectedPrefix\` in the validation. For India states:
   - Maharashtra = 27, Gujarat = 24, Karnataka = 29, Tamil Nadu = 33, Delhi = 07, etc.
   - Include the calculated prefix in the validation metadata so the system can enforce it
   
   **Example for USA Business:**
   \`METADATA: {"country": "USA", "clientType": "business", "requiredFields": ["ein"], "validations": {"ein": {"placeholder": "12-3456789", "format": "9 digits in XX-XXXXXXX format", "pattern": "^[0-9]{2}-[0-9]{7}$", "length": 10, "rules": ["2 digits, hyphen, 7 digits", "Format: XX-XXXXXXX"]}}}\`
   
   **Example for UK Business:**
   \`METADATA: {"country": "UK", "clientType": "business", "vatRegistered": true, "requiredFields": ["utr", "vat"], "validations": {"utr": {"placeholder": "1234567890", "format": "10 digits", "pattern": "^[0-9]{10}$", "length": 10, "rules": ["Exactly 10 numeric digits"]}, "vat": {"placeholder": "GB123456789", "format": "GB followed by 9 digits", "pattern": "^GB[0-9]{9}$", "length": 12, "rules": ["Starts with 'GB'", "Followed by 9 numeric digits"]}}}\`

5. **Keep it conversational** - Be helpful, friendly, and progressive. Ask 1-2 questions at a time.

Current session context:
${JSON.stringify((session.collectedData as Record<string, any>) || {}, null, 2)}

Remember: You are a guide, not a data collector. All sensitive information goes into the secure form, never into our chat. Use your deep knowledge of global tax systems to provide accurate, country-specific validation rules.`;

      // Call LLM
      const { decryptedCredentials } = llmConfig;
      let answer;

      if (llmConfig.provider === 'openai' || llmConfig.provider === 'azure_openai') {
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({
          apiKey: llmConfig.provider === 'azure_openai' ? decryptedCredentials.apiKey : decryptedCredentials.apiKey,
          ...(llmConfig.provider === 'azure_openai' && {
            baseURL: `${decryptedCredentials.endpoint}/openai/deployments/${decryptedCredentials.deploymentName}`,
            defaultQuery: { 'api-version': decryptedCredentials.apiVersion || '2024-02-15-preview' },
            defaultHeaders: { 'api-key': decryptedCredentials.apiKey },
          })
        });

        const completion = await openai.chat.completions.create({
          model: llmConfig.provider === 'azure_openai' ? decryptedCredentials.deploymentName : (llmConfig.modelName || 'gpt-4'),
          messages: [
            { role: 'system', content: systemPrompt },
            ...conversationHistory
          ],
          temperature: 0.7,
          max_tokens: 1000
        });

        answer = completion.choices[0]?.message?.content || "I couldn't generate a response.";
      } else if (llmConfig.provider === 'anthropic') {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const anthropic = new Anthropic({ apiKey: decryptedCredentials.apiKey });

        const message = await anthropic.messages.create({
          model: llmConfig.model || 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          system: systemPrompt,
          messages: conversationHistory.filter(m => m.role !== 'system') as Array<{role: "user" | "assistant"; content: string}>,
        });

        answer = message.content[0].type === 'text' ? message.content[0].text : "I couldn't generate a response.";
      } else {
        return res.status(400).json({ error: "Unsupported LLM provider" });
      }

      // Extract metadata from AI response (if present)
      let aiMetadata = {};
      let cleanAnswer = answer;
      const metadataMatch = answer.match(/METADATA:\s*({.*})/);
      if (metadataMatch) {
        try {
          aiMetadata = JSON.parse(metadataMatch[1]);
          // Remove metadata from visible response
          cleanAnswer = answer.replace(/METADATA:\s*{.*}/, '').trim();
        } catch (e) {
          console.error("Failed to parse AI metadata:", e);
        }
      }

      // Store AI response (with metadata)
      await storage.createOnboardingMessage({
        sessionId,
        role: "assistant",
        content: cleanAnswer,
        metadata: aiMetadata,
      });

      // Update session with metadata from AI (guides form field visibility)
      if (Object.keys(aiMetadata).length > 0) {
        const currentCollected = (session.collectedData as Record<string, any>) || {};
        await storage.updateOnboardingSession(sessionId, {
          collectedData: {
            ...currentCollected,
            ...aiMetadata,
          } as any,
        });
      }

      // Also update with any user-provided context (country, clientType, etc.)
      if (req.body.collectedData) {
        const currentCollected = (session.collectedData as Record<string, any>) || {};
        await storage.updateOnboardingSession(sessionId, {
          collectedData: {
            ...currentCollected,
            ...req.body.collectedData,
          } as any,
        });
      }

      const updatedMessages = await storage.getOnboardingMessages(sessionId);
      res.json({ messages: updatedMessages });
    } catch (error: any) {
      console.error("Failed to process chat message:", error);
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  // Complete onboarding and create client
  app.post("/api/client-onboarding/complete", requireAuth, requirePermission("clients.create"), async (req: AuthRequest, res: Response) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      // Verify session ownership
      const session = await storage.getOnboardingSession(sessionId);
      if (!session || session.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.status === "completed") {
        return res.status(400).json({ error: "Session already completed" });
      }

      // Extract data from session
      const collectedData = (session.collectedData as Record<string, any>) || {};
      const sensitiveData = (session.sensitiveData as Record<string, any>) || {};

      // Create client
      const client = await storage.createClient({
        companyName: sensitiveData.companyName || collectedData.companyName || "Unknown Company",
        email: sensitiveData.email || "",
        phone: sensitiveData.phone || "",
        address: sensitiveData.address || "",
        city: sensitiveData.city || "",
        state: sensitiveData.state || "",
        zipCode: sensitiveData.zipCode || "",
        country: collectedData.country || "US",
        taxId: collectedData.primaryTaxId || "",
        industry: collectedData.industry || "",
        notes: collectedData.notes || "",
        metadata: {
          taxIds: collectedData.taxIds || {},
          clientType: collectedData.clientType || "business",
          onboardingSessionId: sessionId,
        },
        status: "active",
        organizationId: req.user!.organizationId!,
        createdBy: req.userId!,
      });

      // Create primary contact if provided
      if (sensitiveData.contactFirstName && sensitiveData.contactLastName && sensitiveData.contactEmail) {
        await storage.createContact({
          clientId: client.id,
          firstName: sensitiveData.contactFirstName,
          lastName: sensitiveData.contactLastName,
          email: sensitiveData.contactEmail,
          phone: sensitiveData.contactPhone || "",
          title: sensitiveData.contactTitle || "",
          isPrimary: true,
          organizationId: req.user!.organizationId!,
          createdBy: req.userId!,
        });
      }

      // Mark session as completed
      await storage.updateOnboardingSession(sessionId, {
        status: "completed",
        clientId: client.id,
      });

      // Update completedAt timestamp separately
      await db.update(schema.clientOnboardingSessions)
        .set({ completedAt: new Date() })
        .where(eq(schema.clientOnboardingSessions.id, sessionId));

      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "client", client.id, { via: "ai_onboarding" }, req);

      res.json({ client, success: true });
    } catch (error: any) {
      console.error("Failed to complete onboarding:", error);
      res.status(500).json({ error: "Failed to complete onboarding" });
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
      
      // Include steps for each stage, and tasks for each step
      const stagesWithStepsAndTasks = await Promise.all(
        stages.map(async (stage) => {
          const steps = await storage.getStepsByStage(stage.id);
          const stepsWithTasks = await Promise.all(
            steps.map(async (step) => {
              const tasks = await storage.getTasksByStep(step.id);
              return { ...step, tasks };
            })
          );
          return { ...stage, steps: stepsWithTasks };
        })
      );
      
      res.json(stagesWithStepsAndTasks);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch stages" });
    }
  });

  // POST with workflowId in URL path (used by frontend)
  app.post("/api/workflows/:workflowId/stages", requireAuth, requirePermission("workflows.create"), async (req: AuthRequest, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow || workflow.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      const stage = await storage.createWorkflowStage({
        ...req.body,
        workflowId: req.params.workflowId,
      });
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "workflow_stage", stage.id, { name: stage.name }, req);
      res.json(stage);
    } catch (error: any) {
      console.error("Failed to create workflow stage:", error);
      res.status(500).json({ error: "Failed to create stage", details: error.message });
    }
  });

  // Legacy POST with workflowId in body
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

  // PATCH route for stages (frontend uses this)
  app.patch("/api/workflows/stages/:id", requireAuth, requirePermission("workflows.update"), async (req: AuthRequest, res: Response) => {
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
      console.error("Failed to update workflow stage:", error);
      res.status(500).json({ error: "Failed to update stage", details: error.message });
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

  // POST with stageId in URL path (used by frontend)
  app.post("/api/workflows/stages/:stageId/steps", requireAuth, requirePermission("workflows.create"), async (req: AuthRequest, res: Response) => {
    try {
      const stage = await storage.getWorkflowStage(req.params.stageId);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }
      const workflow = await storage.getWorkflow(stage.workflowId);
      if (!workflow || workflow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const step = await storage.createWorkflowStep({
        ...req.body,
        stageId: req.params.stageId,
      });
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "workflow_step", step.id, { name: step.name }, req);
      res.status(201).json(step);
    } catch (error: any) {
      console.error("Failed to create workflow step:", error);
      res.status(500).json({ error: "Failed to create step", details: error.message });
    }
  });

  // Legacy POST with stageId in body
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

  // PATCH route for steps (frontend uses this)
  app.patch("/api/workflows/steps/:id", requireAuth, requirePermission("workflows.update"), async (req: AuthRequest, res: Response) => {
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
      console.error("Failed to update workflow step:", error);
      res.status(500).json({ error: "Failed to update step", details: error.message });
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

  // POST with stepId in URL path (used by frontend)
  app.post("/api/workflows/steps/:stepId/tasks", requireAuth, requirePermission("workflows.create"), async (req: AuthRequest, res: Response) => {
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
      
      // Validate automated tasks have required AI configuration
      if (req.body.type === "automated") {
        if (!req.body.aiAgentId || !req.body.automationInput?.trim()) {
          return res.status(400).json({ 
            error: "AI agent and automation prompt are required for automated tasks" 
          });
        }
      }
      
      // Sanitize dates - convert empty strings to undefined
      const sanitizedBody = {
        ...req.body,
        dueDate: req.body.dueDate && req.body.dueDate !== "" ? req.body.dueDate : undefined,
      };
      
      const task = await storage.createWorkflowTask({
        ...sanitizedBody,
        stepId: req.params.stepId,
        automationInput: req.body.automationInput?.trim(),
      });
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "workflow_task", task.id, { name: task.name }, req);
      res.status(201).json(task);
    } catch (error: any) {
      console.error("Failed to create workflow task:", error);
      res.status(500).json({ error: "Failed to create task", details: error.message });
    }
  });

  // Legacy POST with stepId in body
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
      
      // Validate automated tasks have required AI configuration
      if (req.body.type === "automated") {
        if (!req.body.aiAgentId || !req.body.automationInput?.trim()) {
          return res.status(400).json({ 
            error: "AI agent and automation prompt are required for automated tasks" 
          });
        }
      }
      
      // Sanitize dates - convert empty strings to undefined
      const sanitizedBody = {
        ...req.body,
        dueDate: req.body.dueDate && req.body.dueDate !== "" ? req.body.dueDate : undefined,
      };
      
      const task = await storage.createWorkflowTask({
        ...sanitizedBody,
        automationInput: req.body.automationInput?.trim(),
      });
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
      
      // Validate automated tasks have required AI configuration
      const taskType = req.body.type || task.type;
      if (taskType === "automated") {
        const aiAgentId = req.body.aiAgentId !== undefined ? req.body.aiAgentId : task.aiAgentId;
        const automationInput = req.body.automationInput !== undefined ? req.body.automationInput : task.automationInput;
        if (!aiAgentId || !automationInput?.trim()) {
          return res.status(400).json({ 
            error: "AI agent and automation prompt are required for automated tasks" 
          });
        }
      }
      
      // Build update payload - only include automationInput if provided to avoid wiping existing prompt
      const updatePayload: any = { ...req.body };
      if (req.body.automationInput !== undefined && req.body.automationInput !== null) {
        updatePayload.automationInput = req.body.automationInput.trim();
      }
      
      const updated = await storage.updateWorkflowTask(req.params.id, updatePayload);
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "workflow_task", req.params.id, req.body, req);
      
      // Trigger auto-progression if task status changed to completed
      if (req.body.status === 'completed' && task.status !== 'completed') {
        await autoProgressionEngine.tryAutoProgressStep(task.stepId);
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // PATCH route for tasks (frontend uses this)
  app.patch("/api/workflows/tasks/:id", requireAuth, requirePermission("workflows.update"), async (req: AuthRequest, res: Response) => {
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
      
      // Validate automated tasks have required AI configuration
      const taskType = req.body.type || task.type;
      if (taskType === "automated") {
        const aiAgentId = req.body.aiAgentId !== undefined ? req.body.aiAgentId : task.aiAgentId;
        const automationInput = req.body.automationInput !== undefined ? req.body.automationInput : task.automationInput;
        if (!aiAgentId || !automationInput?.trim()) {
          return res.status(400).json({ 
            error: "AI agent and automation prompt are required for automated tasks" 
          });
        }
      }
      
      // Build update payload - only include automationInput if provided to avoid wiping existing prompt
      const updatePayload: any = { ...req.body };
      if (req.body.automationInput !== undefined && req.body.automationInput !== null) {
        updatePayload.automationInput = req.body.automationInput.trim();
      }
      
      const updated = await storage.updateWorkflowTask(req.params.id, updatePayload);
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "workflow_task", req.params.id, req.body, req);
      
      // Trigger auto-progression if task status changed to completed
      if (req.body.status === 'completed' && task.status !== 'completed') {
        await autoProgressionEngine.tryAutoProgressStep(task.stepId);
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update workflow task:", error);
      res.status(500).json({ error: "Failed to update task", details: error.message });
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
      
      // Trigger auto-progression cascade
      await autoProgressionEngine.tryAutoProgressStep(task.stepId);
      
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
      if (!task.aiAgentId) {
        return res.status(400).json({ error: "Task does not have an AI agent assigned" });
      }
      
      // Verify AI agent is installed for this organization
      const agent = await storage.getAiAgent(task.aiAgentId);
      if (!agent) {
        return res.status(404).json({ error: "AI agent not found" });
      }
      
      const installation = await storage.getAiAgentInstallation(task.aiAgentId, req.user!.organizationId!);
      if (!installation) {
        return res.status(400).json({ error: "AI agent is not installed. Please install it from the marketplace first." });
      }
      
      // Get LLM configuration (use default for the organization)
      const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
      if (!llmConfig) {
        return res.status(400).json({ error: "No LLM configuration found. Please configure an LLM provider first." });
      }
      
      // Update task status to in_progress
      await storage.updateWorkflowTask(req.params.id, { status: 'in_progress' });
      
      // Execute the AI agent with task context
      const normalizedAgentName = agent.name.toLowerCase().replace(/\s+/g, '');
      let result;
      
      try {
        switch (normalizedAgentName) {
          case 'kanban':
          case 'kanbanview': {
            const { KanbanAgent } = await import('../agents/kanban/backend/index');
            const agentInstance = new KanbanAgent(llmConfig);
            result = await agentInstance.execute(task.automationInput as any || {});
            break;
          }
          case 'cadence': {
            const { CadenceAgent } = await import('../agents/cadence/backend/index');
            const agentInstance = new CadenceAgent(llmConfig);
            result = await agentInstance.execute(task.automationInput as any || {});
            break;
          }
          case 'parity': {
            const { ParityAgent } = await import('../agents/parity/backend/index');
            const agentInstance = new ParityAgent(llmConfig);
            result = await agentInstance.execute(task.automationInput as any || {});
            break;
          }
          case 'forma': {
            const { FormaAgent } = await import('../agents/forma/backend/index');
            const agentInstance = new FormaAgent(llmConfig);
            result = await agentInstance.execute(task.automationInput as any || {});
            break;
          }
          default:
            throw new Error(`Unknown AI agent: ${agent.name}`);
        }
        
        // Store the AI output
        await storage.updateWorkflowTask(req.params.id, {
          automationOutput: result as any,
        });
        
        // If review is required, set status to pending_review
        if (task.reviewRequired) {
          await storage.updateWorkflowTask(req.params.id, {
            reviewStatus: 'pending_review',
          });
          
          await logActivity(req.user!.id, req.user!.organizationId!, "ai_execute_pending_review", "workflow_task", req.params.id, {}, req);
          res.json({ 
            message: "AI agent execution completed. Awaiting human review.", 
            taskId: req.params.id,
            output: result,
            requiresReview: true
          });
        } else {
          // Auto-complete if no review needed
          await storage.completeTask(req.params.id, req.user!.id);
          
          await logActivity(req.user!.id, req.user!.organizationId!, "ai_execute_complete", "workflow_task", req.params.id, {}, req);
          
          // Trigger auto-progression
          await autoProgressionEngine.tryAutoProgressStep(task.stepId);
          
          res.json({ 
            message: "AI agent execution completed successfully.", 
            taskId: req.params.id,
            output: result,
            requiresReview: false
          });
        }
      } catch (error: any) {
        console.error("AI agent execution error:", error);
        await storage.updateWorkflowTask(req.params.id, { 
          status: 'pending',
          automationOutput: { error: error.message } as any 
        });
        throw error;
      }
    } catch (error: any) {
      res.status(500).json({ error: "Failed to execute AI agent", details: error.message });
    }
  });

  // Review AI agent output - Approve
  app.post("/api/tasks/:id/review/approve", requireAuth, requirePermission("workflows.update"), async (req: AuthRequest, res: Response) => {
    try {
      const task = await storage.getWorkflowTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      if (task.reviewStatus !== 'pending_review') {
        return res.status(400).json({ error: "Task is not pending review" });
      }
      
      const { reviewNotes } = req.body;
      
      // Approve the AI output and update review status
      await storage.updateWorkflowTask(req.params.id, {
        reviewStatus: 'approved',
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      });
      
      // Complete the task using the dedicated method
      await storage.completeTask(req.params.id, req.user!.id);
      
      await logActivity(req.user!.id, req.user!.organizationId!, "approve_ai_output", "workflow_task", req.params.id, { reviewNotes }, req);
      
      // Trigger auto-progression
      await autoProgressionEngine.tryAutoProgressStep(task.stepId);
      
      res.json({ message: "AI output approved and task completed", taskId: req.params.id });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to approve AI output" });
    }
  });

  // Review AI agent output - Reject
  app.post("/api/tasks/:id/review/reject", requireAuth, requirePermission("workflows.update"), async (req: AuthRequest, res: Response) => {
    try {
      const task = await storage.getWorkflowTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      if (task.reviewStatus !== 'pending_review') {
        return res.status(400).json({ error: "Task is not pending review" });
      }
      
      const { reviewNotes } = req.body;
      if (!reviewNotes) {
        return res.status(400).json({ error: "Review notes are required when rejecting" });
      }
      
      // Reject the AI output and reset task to pending
      await storage.updateWorkflowTask(req.params.id, {
        reviewStatus: 'rejected',
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
        reviewNotes,
        status: 'pending',
        automationOutput: {} as any, // Clear the rejected output
      });
      
      await logActivity(req.user!.id, req.user!.organizationId!, "reject_ai_output", "workflow_task", req.params.id, { reviewNotes }, req);
      
      res.json({ message: "AI output rejected. Task reset to pending.", taskId: req.params.id });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to reject AI output" });
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

  // ==================== Unified Workflow Builder Routes ====================

  // Get all steps for a workflow (flat list across all stages)
  app.get("/api/workflows/:workflowId/steps", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow || workflow.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      const stages = await storage.getStagesByWorkflow(req.params.workflowId);
      const allSteps = [];
      for (const stage of stages) {
        const steps = await storage.getStepsByStage(stage.id);
        allSteps.push(...steps);
      }
      res.json(allSteps);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch steps" });
    }
  });

  // Get all tasks for a workflow (flat list across all steps)
  app.get("/api/workflows/:workflowId/tasks", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow || workflow.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      const stages = await storage.getStagesByWorkflow(req.params.workflowId);
      const allTasks = [];
      for (const stage of stages) {
        const steps = await storage.getStepsByStage(stage.id);
        for (const step of steps) {
          const tasks = await storage.getTasksByStep(step.id);
          allTasks.push(...tasks);
        }
      }
      res.json(allTasks);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // Get subtasks for a task
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

  // Get checklists for a task
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

  // Save task automation (nodes/edges/viewport)
  app.patch("/api/tasks/:taskId/automation", requireAuth, requirePermission("workflows.update"), async (req: AuthRequest, res: Response) => {
    try {
      const task = await storage.getWorkflowTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      // Verify ownership
      const step = await storage.getWorkflowStep(task.stepId);
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

      // Update task with automation nodes/edges/viewport
      const updated = await storage.updateWorkflowTask(req.params.taskId, {
        nodes: req.body.nodes,
        edges: req.body.edges,
        viewport: req.body.viewport,
      });
      
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "workflow_task_automation", req.params.taskId, { nodes: req.body.nodes, edges: req.body.edges, viewport: req.body.viewport }, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to save automation" });
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
      const allSuccessful = results.every((r: any) => r.success);
      await storage.updateWorkflowTask(task.id, {
        automationOutput: results as any,
        status: allSuccessful ? 'completed' : 'in_progress',
      } as any);

      await logActivity(req.user!.id, req.user!.organizationId!, "execute_automation", "workflow_task", task.id, {}, req);
      
      // Trigger auto-progression if automation completed successfully
      if (allSuccessful) {
        await autoProgressionEngine.tryAutoProgressStep(task.stepId);
      }
      
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
      
      // Trigger auto-progression when subtask is completed
      await autoProgressionEngine.tryAutoProgressTask(subtask.taskId);
      
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
      if (!updated) {
        return res.status(404).json({ error: "Failed to toggle checklist item" });
      }
      
      await logActivity(req.user!.id, req.user!.organizationId!, "toggle", "task_checklist", req.params.id, {}, req);
      
      // Trigger auto-progression when checklist is completed
      if (updated.isChecked) {
        await autoProgressionEngine.tryAutoProgressStep(checklist.taskId);
      }
      
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

  // ==================== Dashboard Routes ====================
  
  // Employee/Client Dashboard - Get my tasks with status
  app.get("/api/my-tasks", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const tasks = await storage.getTasksByUser(req.userId!);
      const now = new Date();
      
      // Enrich tasks with status info (overdue/on-time)
      const enrichedTasks = tasks.map(task => ({
        ...task,
        isOverdue: task.dueDate && new Date(task.dueDate) < now && task.status !== 'completed',
        isOnTime: !task.dueDate || new Date(task.dueDate) >= now || task.status === 'completed'
      }));
      
      res.json(enrichedTasks);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // Employee/Client Dashboard Statistics
  app.get("/api/dashboard/my-stats", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const stats = await storage.getTaskStatsByUser(req.userId!);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  });

  // Manager Dashboard - Get team tasks (users in same organization)
  app.get("/api/team-tasks", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }
      
      // Get all tasks for the organization with workflow context
      const tasksData = await storage.getTasksByOrganization(req.user!.organizationId);
      const now = new Date();
      
      // Enrich with status
      const enrichedTasks = tasksData.map((item: any) => ({
        ...item.task,
        workflow: item.workflow,
        stage: item.stage,
        step: item.step,
        isOverdue: item.task.dueDate && new Date(item.task.dueDate) < now && item.task.status !== 'completed',
        isOnTime: !item.task.dueDate || new Date(item.task.dueDate) >= now || item.task.status === 'completed'
      }));
      
      res.json(enrichedTasks);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch team tasks" });
    }
  });

  // Manager Dashboard Statistics
  app.get("/api/dashboard/team-stats", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }
      
      const stats = await storage.getTaskStatsByOrganization(req.user!.organizationId);
      
      // Get team members
      const teamMembers = await storage.getUsersByOrganization(req.user!.organizationId);
      
      res.json({
        ...stats,
        teamSize: teamMembers.length
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch team statistics" });
    }
  });

  // Admin Dashboard - Practice-wide statistics
  app.get("/api/dashboard/practice-stats", requireAuth, requirePermission("reports.view"), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }
      
      const stats = await storage.getTaskStatsByOrganization(req.user!.organizationId);
      
      // Get workflows
      const workflows = await storage.getWorkflowsByOrganization(req.user!.organizationId);
      
      // Get clients
      const clients = await storage.getClientsByOrganization(req.user!.organizationId);
      
      // Get team members
      const teamMembers = await storage.getUsersByOrganization(req.user!.organizationId);
      
      res.json({
        taskStats: stats,
        workflows: {
          total: workflows.length,
          active: workflows.filter((w: any) => w.status === 'active').length,
          completed: workflows.filter((w: any) => w.status === 'completed').length
        },
        clients: {
          total: clients.length,
          active: clients.filter((c: any) => c.status === 'active').length
        },
        team: {
          total: teamMembers.length
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch practice statistics" });
    }
  });

  // Get overdue tasks (accessible to managers and admins)
  app.get("/api/tasks/overdue", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }
      
      const overdueTasks = await storage.getOverdueTasks(req.user!.organizationId);
      res.json(overdueTasks);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch overdue tasks" });
    }
  });

  // Get tasks due soon (accessible to all authenticated users)
  app.get("/api/tasks/due-soon", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }
      
      const daysAhead = parseInt(req.query.days as string) || 7;
      const tasksDueSoon = await storage.getTasksDueSoon(req.user!.organizationId, daysAhead);
      res.json(tasksDueSoon);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch tasks due soon" });
    }
  });

  // ==================== Analytics Routes ====================

  // Get overall analytics dashboard stats
  app.get("/api/analytics/overview", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const orgId = req.user!.organizationId;
      const { userId, role } = req.query;

      // Fetch all metrics in parallel
      const [
        users,
        clients,
        workflows,
        assignments,
        supportTickets,
        invoices,
        payments
      ] = await Promise.all([
        storage.getUsersByOrganization(orgId),
        storage.getClientsByOrganization(orgId),
        storage.getWorkflowsByOrganization(orgId),
        storage.getWorkflowAssignmentsByOrganization(orgId),
        storage.getSupportTickets(orgId),
        db.select().from(schema.invoices).where(eq(schema.invoices.organizationId, orgId)),
        db.select().from(schema.payments).where(eq(schema.payments.organizationId, orgId))
      ]);

      // Apply filters
      let filteredAssignments = assignments;
      let filteredUsers = users;
      let filteredTickets = supportTickets;

      if (userId) {
        filteredAssignments = assignments.filter((a: any) => a.assignedToId === userId);
        filteredTickets = supportTickets.filter((t: any) => t.assignedToId === userId);
        filteredUsers = users.filter((u: any) => u.id === userId);
      } else if (role) {
        const roleUsers = users.filter((u: any) => u.role === role);
        const roleUserIds = roleUsers.map((u: any) => u.id);
        filteredAssignments = assignments.filter((a: any) => roleUserIds.includes(a.assignedToId));
        filteredTickets = supportTickets.filter((t: any) => roleUserIds.includes(t.assignedToId));
        filteredUsers = roleUsers;
      }

      // Calculate metrics
      const totalRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.total as string || '0'), 0);
      const totalPaid = payments.reduce((sum, pay) => sum + parseFloat(pay.amount as string || '0'), 0);
      const activeAssignments = filteredAssignments.filter(a => a.status === 'active').length;
      const completedAssignments = filteredAssignments.filter(a => a.status === 'completed').length;
      const openTickets = filteredTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;

      res.json({
        users: {
          total: filteredUsers.length,
          active: filteredUsers.filter(u => u.isActive).length,
          inactive: filteredUsers.filter(u => !u.isActive).length
        },
        clients: {
          total: clients.length,
          active: clients.filter(c => c.status === 'active').length
        },
        workflows: {
          total: workflows.length,
          active: workflows.filter(w => w.status === 'active').length,
          draft: workflows.filter(w => w.status === 'draft').length
        },
        assignments: {
          total: filteredAssignments.length,
          active: activeAssignments,
          completed: completedAssignments,
          completionRate: filteredAssignments.length > 0 ? (completedAssignments / filteredAssignments.length * 100).toFixed(1) : '0'
        },
        revenue: {
          total: totalRevenue.toFixed(2),
          paid: totalPaid.toFixed(2),
          outstanding: (totalRevenue - totalPaid).toFixed(2)
        },
        support: {
          total: filteredTickets.length,
          open: openTickets,
          closed: filteredTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length
        }
      });
    } catch (error: any) {
      console.error('Analytics overview error:', error);
      res.status(500).json({ error: "Failed to fetch analytics overview" });
    }
  });

  // Get workflow completion metrics
  app.get("/api/analytics/workflow-completion", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const { userId, role } = req.query;
      let assignments = await storage.getWorkflowAssignmentsByOrganization(req.user!.organizationId);
      
      // Apply filters
      if (userId) {
        assignments = assignments.filter((a: any) => a.assignedToId === userId);
      } else if (role) {
        const users = await storage.getUsersByOrganization(req.user!.organizationId);
        const roleUserIds = users.filter((u: any) => u.role === role).map((u: any) => u.id);
        assignments = assignments.filter((a: any) => roleUserIds.includes(a.assignedToId));
      }
      
      // Group by workflow
      const workflowStats = new Map<string, { name: string; total: number; completed: number; inProgress: number; }>();
      
      for (const assignment of assignments) {
        const workflow = await storage.getWorkflow(assignment.workflowId);
        if (!workflow) continue;

        if (!workflowStats.has(workflow.id)) {
          workflowStats.set(workflow.id, {
            name: workflow.name,
            total: 0,
            completed: 0,
            inProgress: 0
          });
        }

        const stats = workflowStats.get(workflow.id)!;
        stats.total++;
        if (assignment.status === 'completed') stats.completed++;
        if (assignment.status === 'active') stats.inProgress++;
      }

      res.json(Array.from(workflowStats.values()));
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch workflow completion metrics" });
    }
  });

  // Get assignment status distribution over time
  app.get("/api/analytics/assignment-trends", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const { userId, role } = req.query;
      const days = parseInt(req.query.days as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let assignments = await storage.getWorkflowAssignmentsByOrganization(req.user!.organizationId);
      
      // Apply filters
      if (userId) {
        assignments = assignments.filter((a: any) => a.assignedToId === userId);
      } else if (role) {
        const users = await storage.getUsersByOrganization(req.user!.organizationId);
        const roleUserIds = users.filter((u: any) => u.role === role).map((u: any) => u.id);
        assignments = assignments.filter((a: any) => roleUserIds.includes(a.assignedToId));
      }
      
      // Group by date
      const trendData = new Map<string, { date: string; created: number; completed: number; }>();
      
      for (const assignment of assignments) {
        const createdDate = new Date(assignment.createdAt).toISOString().split('T')[0];
        
        if (!trendData.has(createdDate)) {
          trendData.set(createdDate, { date: createdDate, created: 0, completed: 0 });
        }
        
        trendData.get(createdDate)!.created++;
        
        if (assignment.status === 'completed' && assignment.completedAt) {
          const completedDate = new Date(assignment.completedAt).toISOString().split('T')[0];
          if (!trendData.has(completedDate)) {
            trendData.set(completedDate, { date: completedDate, created: 0, completed: 0 });
          }
          trendData.get(completedDate)!.completed++;
        }
      }

      res.json(Array.from(trendData.values()).sort((a, b) => a.date.localeCompare(b.date)));
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch assignment trends" });
    }
  });

  // Get revenue metrics over time
  app.get("/api/analytics/revenue-trends", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const { userId, role } = req.query;
      let invoices = await db.select().from(schema.invoices)
        .where(eq(schema.invoices.organizationId, req.user!.organizationId));
      
      let payments = await db.select().from(schema.payments)
        .where(eq(schema.payments.organizationId, req.user!.organizationId));
      
      // Apply filters
      if (userId) {
        invoices = invoices.filter((i: any) => i.createdBy === userId);
        payments = payments.filter((p: any) => p.createdBy === userId);
      } else if (role) {
        const users = await storage.getUsersByOrganization(req.user!.organizationId);
        const roleUserIds = users.filter((u: any) => u.role === role).map((u: any) => u.id);
        invoices = invoices.filter((i: any) => roleUserIds.includes(i.createdBy));
        payments = payments.filter((p: any) => p.createdBy && roleUserIds.includes(p.createdBy));
      }

      // Group by month
      const monthlyData = new Map<string, { month: string; invoiced: number; paid: number; }>();
      
      for (const invoice of invoices) {
        const month = new Date(invoice.createdAt).toISOString().slice(0, 7); // YYYY-MM
        if (!monthlyData.has(month)) {
          monthlyData.set(month, { month, invoiced: 0, paid: 0 });
        }
        monthlyData.get(month)!.invoiced += parseFloat(invoice.total as string || '0');
      }

      for (const payment of payments) {
        const month = new Date(payment.createdAt).toISOString().slice(0, 7);
        if (!monthlyData.has(month)) {
          monthlyData.set(month, { month, invoiced: 0, paid: 0 });
        }
        monthlyData.get(month)!.paid += parseFloat(payment.amount as string || '0');
      }

      res.json(Array.from(monthlyData.values()).sort((a, b) => a.month.localeCompare(b.month)));
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch revenue trends" });
    }
  });

  // Get support ticket metrics
  app.get("/api/analytics/support-metrics", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const { userId, role } = req.query;
      let tickets = await storage.getSupportTickets(req.user!.organizationId);
      
      // Apply filters
      if (userId) {
        tickets = tickets.filter((t: any) => t.assignedToId === userId);
      } else if (role) {
        const users = await storage.getUsersByOrganization(req.user!.organizationId);
        const roleUserIds = users.filter((u: any) => u.role === role).map((u: any) => u.id);
        tickets = tickets.filter((t: any) => roleUserIds.includes(t.assignedToId));
      }
      
      // Status distribution
      const statusCounts = {
        open: tickets.filter(t => t.status === 'open').length,
        in_progress: tickets.filter(t => t.status === 'in_progress').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        closed: tickets.filter(t => t.status === 'closed').length
      };

      // Priority distribution
      const priorityCounts = {
        low: tickets.filter(t => t.priority === 'low').length,
        medium: tickets.filter(t => t.priority === 'medium').length,
        high: tickets.filter(t => t.priority === 'high').length,
        urgent: tickets.filter(t => t.priority === 'urgent').length
      };

      // Category distribution
      const categoryCounts = new Map<string, number>();
      for (const ticket of tickets) {
        categoryCounts.set(ticket.category, (categoryCounts.get(ticket.category) || 0) + 1);
      }

      res.json({
        total: tickets.length,
        byStatus: statusCounts,
        byPriority: priorityCounts,
        byCategory: Object.fromEntries(categoryCounts)
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch support metrics" });
    }
  });

  // Get agent usage statistics
  app.get("/api/analytics/agent-usage", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const { userId, role } = req.query;
      let conversations = await db.select().from(schema.aiAgentConversations)
        .where(eq(schema.aiAgentConversations.organizationId, req.user!.organizationId));
      
      // Apply filters
      if (userId) {
        conversations = conversations.filter((c: any) => c.userId === userId);
      } else if (role) {
        const users = await storage.getUsersByOrganization(req.user!.organizationId);
        const roleUserIds = users.filter((u: any) => u.role === role).map((u: any) => u.id);
        conversations = conversations.filter((c: any) => roleUserIds.includes(c.userId));
      }

      // Group by agent
      const agentStats = new Map<string, { agent: string; conversations: number; messages: number; }>();
      
      for (const conv of conversations) {
        if (!agentStats.has(conv.agentName)) {
          agentStats.set(conv.agentName, {
            agent: conv.agentName,
            conversations: 0,
            messages: 0
          });
        }
        
        const stats = agentStats.get(conv.agentName)!;
        stats.conversations++;
        
        // Count messages in this conversation
        const messages = await db.select().from(schema.aiAgentMessages)
          .where(eq(schema.aiAgentMessages.conversationId, conv.id));
        stats.messages += messages.length;
      }

      res.json(Array.from(agentStats.values()));
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch agent usage statistics" });
    }
  });

  // Get time tracking metrics
  app.get("/api/analytics/time-tracking", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const { userId, role } = req.query;
      let timeEntries = await db.select().from(schema.timeEntries)
        .where(eq(schema.timeEntries.organizationId, req.user!.organizationId));
      
      // Apply filters
      if (userId) {
        timeEntries = timeEntries.filter((e: any) => e.userId === userId);
      } else if (role) {
        const users = await storage.getUsersByOrganization(req.user!.organizationId);
        const roleUserIds = users.filter((u: any) => u.role === role).map((u: any) => u.id);
        timeEntries = timeEntries.filter((e: any) => roleUserIds.includes(e.userId));
      }

      // Total hours
      const totalHours = timeEntries.reduce((sum, entry) => sum + parseFloat(entry.hours || '0'), 0);
      
      // Billable vs non-billable
      const billableHours = timeEntries.filter(e => e.isBillable).reduce((sum, e) => sum + parseFloat(e.hours || '0'), 0);
      const nonBillableHours = totalHours - billableHours;

      // By user
      const userHours = new Map<string, number>();
      for (const entry of timeEntries) {
        userHours.set(entry.userId, (userHours.get(entry.userId) || 0) + parseFloat(entry.hours || '0'));
      }

      res.json({
        totalHours: totalHours.toFixed(2),
        billableHours: billableHours.toFixed(2),
        nonBillableHours: nonBillableHours.toFixed(2),
        billablePercentage: totalHours > 0 ? (billableHours / totalHours * 100).toFixed(1) : '0',
        byUser: Object.fromEntries(userHours)
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch time tracking metrics" });
    }
  });

  // ==================== Assignment Status Bot Routes ====================

  // Query assignment status bot with natural language
  app.post("/api/assignment-bot/query", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const { question } = req.body;
      if (!question) {
        return res.status(400).json({ error: "Question is required" });
      }

      // Get default LLM configuration
      const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId);
      if (!llmConfig) {
        return res.status(400).json({ error: "No default LLM configuration found. Please configure an LLM provider first." });
      }

      // Gather assignment data for context
      const [assignments, workflows, users, clients] = await Promise.all([
        storage.getWorkflowAssignmentsByOrganization(req.user!.organizationId),
        storage.getWorkflowsByOrganization(req.user!.organizationId),
        storage.getUsersByOrganization(req.user!.organizationId),
        storage.getClientsByOrganization(req.user!.organizationId)
      ]);

      // Build context data
      const contextData = {
        totalAssignments: assignments.length,
        activeAssignments: assignments.filter(a => a.status === 'active').length,
        completedAssignments: assignments.filter(a => a.status === 'completed').length,
        overdueAssignments: assignments.filter(a => {
          if (!a.dueDate || a.status === 'completed') return false;
          return new Date(a.dueDate) < new Date();
        }).length,
        workflows: workflows.map(w => ({ id: w.id, name: w.name, status: w.status })),
        users: users.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, role: u.role })),
        clients: clients.map(c => ({ id: c.id, name: c.name, status: c.status, type: c.type })),
        assignments: assignments.map(a => ({
          id: a.id,
          workflowId: a.workflowId,
          clientId: a.clientId,
          assignedToId: a.assignedToId,
          status: a.status,
          currentStage: a.currentStage,
          dueDate: a.dueDate,
          completedAt: a.completedAt,
          createdAt: a.createdAt
        }))
      };

      // Prepare LLM prompt
      const systemPrompt = `You are an AI assistant that helps answer questions about workflow assignments and project progress. 
You have access to the following data about the organization:
- Total assignments: ${contextData.totalAssignments}
- Active assignments: ${contextData.activeAssignments}
- Completed assignments: ${contextData.completedAssignments}
- Overdue assignments: ${contextData.overdueAssignments}
- ${contextData.workflows.length} workflows
- ${contextData.users.length} team members
- ${contextData.clients.length} clients

Context Data:
${JSON.stringify(contextData, null, 2)}

Answer the user's question about assignments, progress, bottlenecks, team performance, or client-specific information based on this data. Be concise and helpful. If you cannot answer based on the available data, say so.`;

      // Call LLM
      const { decryptedCredentials } = llmConfig;
      let answer;

      if (llmConfig.provider === 'openai' || llmConfig.provider === 'azure_openai') {
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({
          apiKey: llmConfig.provider === 'azure_openai' ? decryptedCredentials.apiKey : decryptedCredentials.apiKey,
          ...(llmConfig.provider === 'azure_openai' && {
            baseURL: `${decryptedCredentials.endpoint}/openai/deployments/${decryptedCredentials.deploymentName}`,
            defaultQuery: { 'api-version': decryptedCredentials.apiVersion || '2024-02-15-preview' },
            defaultHeaders: { 'api-key': decryptedCredentials.apiKey },
          })
        });

        const completion = await openai.chat.completions.create({
          model: llmConfig.provider === 'azure_openai' ? decryptedCredentials.deploymentName : (llmConfig.modelName || 'gpt-4'),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question }
          ],
          temperature: 0.7,
          max_tokens: 1000
        });

        answer = completion.choices[0]?.message?.content || "I couldn't generate a response.";
      } else if (llmConfig.provider === 'anthropic') {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const anthropic = new Anthropic({ apiKey: decryptedCredentials.apiKey });

        const message = await anthropic.messages.create({
          model: llmConfig.modelName || 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: 'user', content: question }]
        });

        const firstContent = message.content[0];
        answer = firstContent.type === 'text' ? firstContent.text : "I couldn't generate a response.";
      } else {
        return res.status(400).json({ error: "Unsupported LLM provider" });
      }

      res.json({ answer, question });
    } catch (error: any) {
      console.error('Assignment bot error:', error);
      res.status(500).json({ error: "Failed to process query" });
    }
  });

  // ==================== Support Ticket Routes ====================

  // Get all support tickets for organization
  app.get("/api/support-tickets", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }
      
      const tickets = await storage.getSupportTickets(req.user!.organizationId);
      res.json(tickets);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch support tickets" });
    }
  });

  // Get single support ticket
  app.get("/api/support-tickets/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const ticket = await storage.getSupportTicket(req.params.id);
      if (!ticket || ticket.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Support ticket not found" });
      }
      res.json(ticket);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch support ticket" });
    }
  });

  // Create support ticket
  app.post("/api/support-tickets", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const ticket = await storage.createSupportTicket({
        ...req.body,
        organizationId: req.user!.organizationId!,
        createdBy: req.userId!
      });
      
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "support_ticket", ticket.id, { subject: ticket.subject }, req);
      res.status(201).json(ticket);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create support ticket" });
    }
  });

  // Update support ticket
  app.patch("/api/support-tickets/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getSupportTicket(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Support ticket not found" });
      }
      
      const ticket = await storage.updateSupportTicket(req.params.id, req.body);
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "support_ticket", req.params.id, {}, req);
      res.json(ticket);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update support ticket" });
    }
  });

  // Delete support ticket
  app.delete("/api/support-tickets/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getSupportTicket(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Support ticket not found" });
      }
      
      await storage.deleteSupportTicket(req.params.id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "support_ticket", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete support ticket" });
    }
  });

  // Get comments for a support ticket
  app.get("/api/support-tickets/:id/comments", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const ticket = await storage.getSupportTicket(req.params.id);
      if (!ticket || ticket.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Support ticket not found" });
      }
      
      const comments = await storage.getTicketComments(req.params.id);
      res.json(comments);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch ticket comments" });
    }
  });

  // Add comment to support ticket
  app.post("/api/support-tickets/:id/comments", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const ticket = await storage.getSupportTicket(req.params.id);
      if (!ticket || ticket.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Support ticket not found" });
      }
      
      const comment = await storage.createSupportTicketComment({
        ticketId: req.params.id,
        content: req.body.content,
        createdBy: req.userId!,
        isInternal: req.body.isInternal || false,
        attachments: req.body.attachments || []
      });
      
      await logActivity(req.userId, req.user!.organizationId || undefined, "comment", "support_ticket", req.params.id, {}, req);
      res.status(201).json(comment);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to add comment" });
    }
  });

  // ==================== Email Account Routes ====================

  // Get all email accounts for organization
  app.get("/api/email-accounts", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }
      
      const accounts = await storage.getEmailAccountsByOrganization(req.user!.organizationId);
      res.json(accounts);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch email accounts" });
    }
  });

  // Get single email account
  app.get("/api/email-accounts/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const account = await storage.getEmailAccount(req.params.id);
      if (!account || account.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Email account not found" });
      }
      res.json(account);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch email account" });
    }
  });

  // Create email account
  app.post("/api/email-accounts", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      // Schema without server-controlled fields
      const clientSchema = schema.insertEmailAccountSchema.omit({
        organizationId: true,
        userId: true,
      });
      
      const validatedData = clientSchema.parse(req.body);
      
      const account = await storage.createEmailAccount({
        ...validatedData,
        organizationId: req.user!.organizationId!,
        userId: req.userId!
      });
      
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "email_account", account.id, { email: account.email }, req);
      res.status(201).json(account);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid email account data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create email account" });
    }
  });

  // Update email account
  app.patch("/api/email-accounts/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getEmailAccount(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Email account not found" });
      }
      
      // Whitelist of fields allowed to be updated
      const updateSchema = z.object({
        displayName: z.string().optional(),
        encryptedCredentials: z.string().optional(),
        imapHost: z.string().optional(),
        imapPort: z.number().optional(),
        smtpHost: z.string().optional(),
        smtpPort: z.number().optional(),
        useSsl: z.boolean().optional(),
        status: z.enum(["active", "error", "disconnected"]).optional(),
        lastSyncAt: z.coerce.date().optional(),
        lastSyncError: z.string().optional(),
        syncInterval: z.number().optional(),
        autoCreateTasks: z.boolean().optional(),
        defaultWorkflowId: z.string().optional(),
      });
      
      const validatedUpdates = updateSchema.parse(req.body);
      
      const account = await storage.updateEmailAccount(req.params.id, validatedUpdates);
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "email_account", req.params.id, {}, req);
      res.json(account);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update email account" });
    }
  });

  // Delete email account
  app.delete("/api/email-accounts/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getEmailAccount(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Email account not found" });
      }
      
      await storage.deleteEmailAccount(req.params.id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "email_account", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete email account" });
    }
  });

  // ==================== Email Messages Routes ====================

  // Get all email messages for organization
  app.get("/api/email-messages", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }
      
      const messages = await storage.getEmailMessagesByOrganization(req.user!.organizationId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch email messages" });
    }
  });

  // Get email messages for specific account
  app.get("/api/email-accounts/:accountId/messages", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const account = await storage.getEmailAccount(req.params.accountId);
      if (!account || account.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Email account not found" });
      }
      
      const messages = await storage.getEmailMessagesByAccount(req.params.accountId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch email messages" });
    }
  });

  // Get single email message
  app.get("/api/email-messages/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const message = await storage.getEmailMessage(req.params.id);
      if (!message || message.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Email message not found" });
      }
      res.json(message);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch email message" });
    }
  });

  // Update email message (mark as read, starred, processed, etc.)
  app.patch("/api/email-messages/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getEmailMessage(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Email message not found" });
      }
      
      // Whitelist of fields allowed to be updated (user-facing updates only)
      const updateSchema = z.object({
        isRead: z.boolean().optional(),
        isStarred: z.boolean().optional(),
        labels: z.array(z.string()).optional(),
        aiProcessed: z.boolean().optional(),
        aiProcessedAt: z.coerce.date().optional(),
        aiExtractedData: z.record(z.any()).optional(),
        createdTaskId: z.string().optional(),
      });
      
      const validatedUpdates = updateSchema.parse(req.body);
      
      const message = await storage.updateEmailMessage(req.params.id, validatedUpdates);
      res.json(message);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update email message" });
    }
  });

  // Delete email message
  app.delete("/api/email-messages/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getEmailMessage(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Email message not found" });
      }
      
      await storage.deleteEmailMessage(req.params.id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "email_message", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete email message" });
    }
  });

  // AI Email Processor - Process single email with AI to create tasks
  app.post("/api/email-messages/:id/process-with-ai", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const message = await storage.getEmailMessage(req.params.id);
      if (!message || message.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Email message not found" });
      }

      if (message.aiProcessed) {
        return res.status(400).json({ error: "Email already processed" });
      }

      // Get default LLM configuration
      const llmConfigs = await storage.getLlmConfigurationsByOrganization(req.user!.organizationId!);
      const defaultConfig = llmConfigs.find(c => c.isDefault && c.isActive);
      
      if (!defaultConfig) {
        return res.status(400).json({ error: "No default LLM configuration found. Please configure AI settings first." });
      }

      // Decrypt the API key
      const { decrypt } = await import('./llm-service');
      const apiKey = decrypt(defaultConfig.apiKeyEncrypted);

      // Prepare email content for AI
      const emailContent = `
Subject: ${message.subject}
From: ${message.fromEmail} (${message.fromName || 'Unknown'})
Date: ${message.receivedAt}

${message.bodyText || message.bodyHtml || ''}
`.trim();

      let extractedData: any = {};
      let taskSummary = '';

      // Call LLM based on provider
      if (defaultConfig.provider === 'openai' || defaultConfig.provider === 'azure_openai') {
        const { OpenAI } = await import('openai');
        
        const clientConfig: any = { apiKey };
        if (defaultConfig.provider === 'azure_openai' && defaultConfig.azureEndpoint) {
          const cleanEndpoint = defaultConfig.azureEndpoint.endsWith('/') 
            ? defaultConfig.azureEndpoint.slice(0, -1) 
            : defaultConfig.azureEndpoint;
          clientConfig.baseURL = `${cleanEndpoint}/openai/deployments/${defaultConfig.model}`;
          clientConfig.defaultQuery = { 'api-version': '2025-01-01-preview' };
          clientConfig.defaultHeaders = { 'api-key': apiKey };
        }
        
        const client = new OpenAI(clientConfig);

        const prompt = `Analyze this email and extract task information in JSON format:

${emailContent}

Extract:
1. task_title: Brief title for the task (50 chars max)
2. task_description: Detailed description of what needs to be done
3. priority: low, medium, high, or urgent
4. category: accounting, tax, audit, advisory, compliance, or general
5. due_date: If mentioned, in ISO format, otherwise null
6. action_required: What specific action is needed

Return ONLY valid JSON, no additional text.`;

        const response = await client.chat.completions.create({
          model: defaultConfig.model, // Use model/deployment name for both OpenAI and Azure
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 500,
        });

        const content = response.choices[0]?.message?.content || '{}';
        try {
          extractedData = JSON.parse(content);
        } catch (e) {
          // Try to extract JSON from markdown code blocks
          const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          if (jsonMatch) {
            extractedData = JSON.parse(jsonMatch[1]);
          } else {
            extractedData = { task_title: message.subject, task_description: 'Failed to parse AI response' };
          }
        }
        taskSummary = extractedData.task_title || message.subject;

      } else if (defaultConfig.provider === 'anthropic') {
        const { Anthropic } = await import('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey });

        const prompt = `Analyze this email and extract task information in JSON format:

${emailContent}

Extract:
1. task_title: Brief title for the task (50 chars max)
2. task_description: Detailed description of what needs to be done
3. priority: low, medium, high, or urgent
4. category: accounting, tax, audit, advisory, compliance, or general
5. due_date: If mentioned, in ISO format, otherwise null
6. action_required: What specific action is needed

Return ONLY valid JSON, no additional text.`;

        const response = await client.messages.create({
          model: defaultConfig.model,
          max_tokens: 500,
          temperature: 0.3,
          messages: [{ role: 'user', content: prompt }],
        });

        const content = response.content[0];
        const textContent = content.type === 'text' ? content.text : '{}';
        
        try {
          extractedData = JSON.parse(textContent);
        } catch (e) {
          // Try to extract JSON from markdown code blocks
          const jsonMatch = textContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          if (jsonMatch) {
            extractedData = JSON.parse(jsonMatch[1]);
          } else {
            extractedData = { task_title: message.subject, task_description: 'Failed to parse AI response' };
          }
        }
        taskSummary = extractedData.task_title || message.subject;
      }

      // Get email account to check if autoCreateTasks is enabled
      const emailAccount = await storage.getEmailAccount(message.emailAccountId);
      let createdTaskId: string | undefined;

      // Auto-create task if enabled and workflow is configured
      if (emailAccount?.autoCreateTasks && emailAccount.defaultWorkflowId) {
        // Get the workflow to find the first step
        const workflow = await storage.getWorkflow(emailAccount.defaultWorkflowId);
        if (workflow) {
          const stages = await storage.getStagesByWorkflow(workflow.id);
          if (stages.length > 0) {
            const firstStage = stages[0];
            const steps = await storage.getStepsByStage(firstStage.id);
            if (steps.length > 0) {
              const firstStep = steps[0];
              
              // Create task
              const task = await storage.createWorkflowTask({
                stepId: firstStep.id,
                name: taskSummary,
                description: extractedData.task_description || message.bodyText?.substring(0, 500) || '',
                type: 'manual',
                order: (await storage.getTasksByStep(firstStep.id)).length + 1,
                status: 'pending',
                priority: extractedData.priority || 'medium',
                dueDate: extractedData.due_date ? new Date(extractedData.due_date) : null,
                assignedTo: emailAccount.userId,
                automationInput: { fromEmail: true, emailId: message.id },
              });
              
              createdTaskId = task.id;
              
              await logActivity(req.userId, req.user!.organizationId || undefined, "create", "task", task.id, 
                { source: "email_ai_processor", emailId: message.id }, req);
            }
          }
        }
      }

      // Update email with processing results
      const updatedMessage = await storage.updateEmailMessage(message.id, {
        aiProcessed: true,
        aiProcessedAt: new Date(),
        aiExtractedData: extractedData,
        createdTaskId: createdTaskId || null,
      });

      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "email_message", message.id, 
        { action: "ai_processed", taskCreated: !!createdTaskId }, req);

      res.json({
        success: true,
        extractedData,
        taskCreated: !!createdTaskId,
        taskId: createdTaskId,
        message: updatedMessage,
      });

    } catch (error: any) {
      console.error('AI email processing error:', error);
      res.status(500).json({ error: "Failed to process email with AI", details: error.message });
    }
  });

  // AI Email Batch Processor - Process multiple unprocessed emails
  app.post("/api/email-messages/batch-process-with-ai", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { emailAccountId, limit = 10 } = req.body;

      // Get unprocessed emails
      let messages: schema.EmailMessage[];
      if (emailAccountId) {
        const account = await storage.getEmailAccount(emailAccountId);
        if (!account || account.organizationId !== req.user!.organizationId) {
          return res.status(404).json({ error: "Email account not found" });
        }
        messages = await storage.getEmailMessagesByAccount(emailAccountId);
      } else {
        messages = await storage.getEmailMessagesByOrganization(req.user!.organizationId!);
      }

      // Filter to unprocessed messages
      const unprocessed = messages
        .filter(m => !m.aiProcessed)
        .slice(0, limit);

      if (unprocessed.length === 0) {
        return res.json({ success: true, processed: 0, message: "No unprocessed emails found" });
      }

      const results = [];
      
      for (const msg of unprocessed) {
        try {
          // Get default LLM configuration (reuse logic from single processor)
          const llmConfigs = await storage.getLlmConfigurationsByOrganization(req.user!.organizationId!);
          const defaultConfig = llmConfigs.find(c => c.isDefault && c.isActive);
          
          if (!defaultConfig) {
            results.push({ emailId: msg.id, success: false, error: "No default LLM configuration" });
            continue;
          }

          // Decrypt API key
          const { decrypt } = await import('./llm-service');
          const apiKey = decrypt(defaultConfig.apiKeyEncrypted);

          // Prepare email content
          const emailContent = `
Subject: ${msg.subject}
From: ${msg.fromEmail} (${msg.fromName || 'Unknown'})
Date: ${msg.receivedAt}

${msg.bodyText || msg.bodyHtml || ''}
`.trim();

          let extractedData: any = {};
          let taskSummary = '';

          // Call LLM
          if (defaultConfig.provider === 'openai' || defaultConfig.provider === 'azure_openai') {
            const { OpenAI } = await import('openai');
            const clientConfig: any = { apiKey };
            if (defaultConfig.provider === 'azure_openai' && defaultConfig.azureEndpoint) {
              const cleanEndpoint = defaultConfig.azureEndpoint.endsWith('/') 
                ? defaultConfig.azureEndpoint.slice(0, -1) 
                : defaultConfig.azureEndpoint;
              clientConfig.baseURL = `${cleanEndpoint}/openai/deployments/${defaultConfig.model}`;
              clientConfig.defaultQuery = { 'api-version': '2025-01-01-preview' };
              clientConfig.defaultHeaders = { 'api-key': apiKey };
            }
            
            const client = new OpenAI(clientConfig);
            const response = await client.chat.completions.create({
              model: defaultConfig.model, // Use model/deployment name for both OpenAI and Azure
              messages: [{
                role: 'user',
                content: `Analyze this email and extract task information in JSON format:\n\n${emailContent}\n\nExtract:\n1. task_title: Brief title for the task (50 chars max)\n2. task_description: Detailed description\n3. priority: low, medium, high, or urgent\n4. category: accounting, tax, audit, advisory, compliance, or general\n5. due_date: If mentioned, in ISO format, otherwise null\n6. action_required: What specific action is needed\n\nReturn ONLY valid JSON.`
              }],
              temperature: 0.3,
              max_tokens: 500,
            });

            const content = response.choices[0]?.message?.content || '{}';
            try {
              extractedData = JSON.parse(content);
            } catch (e) {
              const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
              if (jsonMatch) {
                extractedData = JSON.parse(jsonMatch[1]);
              } else {
                extractedData = { task_title: msg.subject, task_description: 'Failed to parse' };
              }
            }
            taskSummary = extractedData.task_title || msg.subject;

          } else if (defaultConfig.provider === 'anthropic') {
            const { Anthropic } = await import('@anthropic-ai/sdk');
            const client = new Anthropic({ apiKey });
            const response = await client.messages.create({
              model: defaultConfig.model,
              max_tokens: 500,
              temperature: 0.3,
              messages: [{
                role: 'user',
                content: `Analyze this email and extract task information in JSON format:\n\n${emailContent}\n\nExtract:\n1. task_title: Brief title for the task (50 chars max)\n2. task_description: Detailed description\n3. priority: low, medium, high, or urgent\n4. category: accounting, tax, audit, advisory, compliance, or general\n5. due_date: If mentioned, in ISO format, otherwise null\n6. action_required: What specific action is needed\n\nReturn ONLY valid JSON.`
              }],
            });

            const content = response.content[0];
            const textContent = content.type === 'text' ? content.text : '{}';
            try {
              extractedData = JSON.parse(textContent);
            } catch (e) {
              const jsonMatch = textContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
              if (jsonMatch) {
                extractedData = JSON.parse(jsonMatch[1]);
              } else {
                extractedData = { task_title: msg.subject, task_description: 'Failed to parse' };
              }
            }
            taskSummary = extractedData.task_title || msg.subject;
          }

          // Auto-create task if configured
          const emailAccount = await storage.getEmailAccount(msg.emailAccountId);
          let createdTaskId: string | undefined;

          if (emailAccount?.autoCreateTasks && emailAccount.defaultWorkflowId) {
            const workflow = await storage.getWorkflow(emailAccount.defaultWorkflowId);
            if (workflow) {
              const stages = await storage.getStagesByWorkflow(workflow.id);
              if (stages.length > 0) {
                const steps = await storage.getStepsByStage(stages[0].id);
                if (steps.length > 0) {
                  const task = await storage.createWorkflowTask({
                    stepId: steps[0].id,
                    name: taskSummary,
                    description: extractedData.task_description || msg.bodyText?.substring(0, 500) || '',
                    type: 'manual',
                    order: (await storage.getTasksByStep(steps[0].id)).length + 1,
                    status: 'pending',
                    priority: extractedData.priority || 'medium',
                    dueDate: extractedData.due_date ? new Date(extractedData.due_date) : null,
                    assignedTo: emailAccount.userId,
                    automationInput: { fromEmail: true, emailId: msg.id },
                  });
                  createdTaskId = task.id;
                }
              }
            }
          }

          // Update email
          await storage.updateEmailMessage(msg.id, {
            aiProcessed: true,
            aiProcessedAt: new Date(),
            aiExtractedData: extractedData,
            createdTaskId: createdTaskId || null,
          });

          results.push({ emailId: msg.id, success: true, taskId: createdTaskId });

        } catch (error: any) {
          results.push({ emailId: msg.id, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      
      await logActivity(req.userId, req.user!.organizationId || undefined, "batch_process", "email_messages", 
        '', { processed: successCount, total: unprocessed.length }, req);

      res.json({
        success: true,
        processed: successCount,
        total: unprocessed.length,
        results,
      });

    } catch (error: any) {
      console.error('Batch AI email processing error:', error);
      res.status(500).json({ error: "Failed to batch process emails", details: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
