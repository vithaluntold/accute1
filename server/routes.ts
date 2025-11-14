import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z, ZodError } from "zod";
import { storage } from "./storage";
import { db } from "./db";
import { setupWebSocket } from "./websocket";
import * as schema from "@shared/schema";
import { registerPricingRoutes } from "./pricing-routes";
import { registerSubscriptionRoutes } from "./subscription-routes";
import { eq, sql, and, desc } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  requireAuth,
  requireAdmin,
  requirePermission,
  requirePlatform,
  requireKyc,
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
  insertEmailTemplateSchema,
  insertMessageTemplateSchema,
  insertPlatformSubscriptionSchema,
  insertSupportTicketSchema,
  insertProposalSchema,
  insertResourceAllocationSchema,
  insertSkillSchema,
  insertUserSkillSchema,
  insertTaskSkillRequirementSchema,
} from "@shared/schema";
import bcrypt from "bcrypt";
import crypto from "crypto";
import * as cryptoUtils from "./crypto-utils";
import { autoProgressionEngine } from "./auto-progression";
import Stripe from "stripe";
import { PricingService } from "@shared/pricing-service";
import { getLLMConfigService } from "./llm-config-service";
import { mfaService } from "./services/mfaService";
import { unifiedInboxService } from "./services/unifiedInboxService";
import { TaskDependenciesService } from "./services/taskDependenciesService";
import { DocumentVersionsService } from "./services/documentVersionsService";
import { workflowStagesService } from "./services/workflowStagesService";
import { samlService } from "./services/SamlService";
import { ResourceAllocationService } from "./services/ResourceAllocationService";
import { SkillService } from "./services/SkillService";
import passport from "passport";
import { MultiSamlStrategy } from "@node-saml/passport-saml";

// Import foundry tables
const { aiAgents, organizationAgents, userAgentAccess, platformSubscriptions } = schema;

// SECURITY: Whitelist of allowed MIME types for document uploads
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
];

// SECURITY: Whitelist of allowed file extensions
const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.png', '.jpg', '.jpeg', '.gif', '.webp'
];

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
      // SECURITY: Sanitize filename - remove any path traversal attempts
      const sanitizedOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = path.extname(sanitizedOriginalName).toLowerCase();
      const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(16).toString('hex');
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // SECURITY: Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error(`Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`));
    }
    
    // SECURITY: Validate file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error(`Invalid file extension. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
    
    cb(null, true);
  }
});

// Global initialization status for health checks
let initializationComplete = false;
let initializationError: string | null = null;

export function setInitializationStatus(complete: boolean, error: string | null = null) {
  initializationComplete = complete;
  initializationError = error;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check - ALWAYS responds immediately regardless of initialization status
  app.get("/api/health", (req, res) => {
    res.status(200).json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      initialized: initializationComplete,
      initError: initializationError
    });
  });

  // Deployment diagnostics endpoint
  app.get("/api/diagnostics", (req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "unknown",
      initialization: {
        complete: initializationComplete,
        error: initializationError,
      },
      services: {
        database: !!process.env.DATABASE_URL,
        encryption: !!process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 32,
        twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
        twilioPhone: !!process.env.TWILIO_PHONE_NUMBER,
      },
      server: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
      }
    });
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
          roleName: role?.name, // Add role name to user object
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

      // Check if MFA is enabled for this user
      const mfaEnabled = await mfaService.isMFAEnabled(user.id);
      
      if (mfaEnabled) {
        // Generate device fingerprint
        const userAgent = req.headers['user-agent'] || '';
        const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || '';
        const deviceId = mfaService.generateDeviceFingerprint(userAgent, ipAddress);

        // Check if device is trusted
        const isTrusted = await mfaService.isDeviceTrusted(user.id, deviceId);

        if (!isTrusted) {
          // MFA verification required - don't create session yet
          return res.json({
            mfaRequired: true,
            userId: user.id,
            deviceId, // Send back for trust-device option
          });
        }
      }

      // Create session (password verified, MFA not required or device trusted)
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
          roleName: role?.name, // Add role name to user object
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

  // Complete login after MFA verification
  app.post("/api/auth/login/mfa", rateLimit(10, 15 * 60 * 1000), async (req: Request, res: Response) => {
    try {
      const { userId, token, trustDevice, deviceId, deviceName } = req.body;

      if (!userId || !token) {
        return res.status(400).json({ error: "User ID and MFA token are required" });
      }

      // Verify TOTP token
      const isValid = await mfaService.verifyToken(userId, token);

      if (!isValid) {
        return res.status(401).json({ error: "Invalid MFA token" });
      }

      // Get user details
      const user = await storage.getUser(userId);
      if (!user || !user.isActive) {
        return res.status(403).json({ error: "Account is inactive or not found" });
      }

      // Trust device if requested
      if (trustDevice && deviceId && deviceName) {
        const userAgent = req.headers['user-agent'] || '';
        const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || '';
        await mfaService.trustDevice(userId, deviceId, deviceName, ipAddress, userAgent);
      }

      // Create session
      const sessionToken = generateToken(user.id);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await storage.createSession(user.id, sessionToken, expiresAt);

      // Get role and permissions
      const role = await storage.getRole(user.roleId);
      const permissions = await storage.getPermissionsByRole(user.roleId);

      // Log activity
      await logActivity(user.id, user.organizationId || undefined, "login_mfa", "user", user.id, {}, req);

      // Set session cookie
      res.cookie('session_token', sessionToken, {
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
          roleName: role?.name,
          organizationId: user.organizationId,
          permissions: permissions.map(p => p.name),
        },
        role,
        token: sessionToken,
      });
    } catch (error: any) {
      console.error("MFA login completion error:", error);
      res.status(500).json({ error: "MFA login failed" });
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

  // ==================== MFA (Multi-Factor Authentication) Routes ====================

  // Setup MFA - Generate TOTP secret and QR code
  app.post("/api/mfa/setup", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const { secret, qrCodeUrl, backupCodes } = await mfaService.setupMFA(userId);

      res.json({
        success: true,
        secret, // For manual entry in authenticator apps
        qrCodeUrl, // For scanning with authenticator apps
        backupCodes // Save these securely!
      });
    } catch (error: any) {
      console.error("MFA setup error:", error);
      res.status(500).json({ error: error.message || "Failed to setup MFA" });
    }
  });

  // Verify TOTP token and enable MFA
  app.post("/api/mfa/verify-setup", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: "TOTP token is required" });
      }

      const isValid = await mfaService.verifyAndEnableMFA(userId, token);

      if (!isValid) {
        return res.status(400).json({ error: "Invalid TOTP token" });
      }

      // Log activity
      await logActivity(userId, req.user!.organizationId || undefined, "enable_mfa", "user", userId, {}, req);

      res.json({ success: true, message: "MFA enabled successfully" });
    } catch (error: any) {
      console.error("MFA verification error:", error);
      res.status(500).json({ error: error.message || "Failed to verify MFA" });
    }
  });

  // Verify TOTP token (during login)
  app.post("/api/mfa/verify", async (req: Request, res: Response) => {
    try {
      const { userId, token, deviceId } = req.body;

      if (!userId || !token) {
        return res.status(400).json({ error: "User ID and token are required" });
      }

      const isValid = await mfaService.verifyToken(userId, token);

      if (!isValid) {
        return res.status(400).json({ error: "Invalid TOTP token" });
      }

      res.json({ success: true, verified: true });
    } catch (error: any) {
      console.error("MFA token verification error:", error);
      res.status(500).json({ error: "Failed to verify token" });
    }
  });

  // Verify backup code and complete login (during login)
  app.post("/api/mfa/verify-backup-code", rateLimit(5, 15 * 60 * 1000), async (req: Request, res: Response) => {
    try {
      const { userId, backupCode, deviceId, deviceName } = req.body;

      if (!userId || !backupCode) {
        return res.status(400).json({ error: "User ID and backup code are required" });
      }

      // Verify backup code
      const isValid = await mfaService.verifyBackupCode(userId, backupCode);

      if (!isValid) {
        return res.status(400).json({ error: "Invalid or already used backup code" });
      }

      // Backup code verified - complete login (similar to login/mfa endpoint)
      const user = await storage.getUser(userId);
      if (!user || !user.isActive) {
        return res.status(403).json({ error: "Account is inactive or not found" });
      }

      // SECURITY: Never trust device with backup codes (they're for emergencies)
      // Users should re-enable MFA with authenticator app after using backup code

      // Create session
      const token = generateToken(user.id);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await storage.createSession(user.id, token, expiresAt);

      // Get role and permissions
      const role = await storage.getRole(user.roleId);
      const permissions = await storage.getPermissionsByRole(user.roleId);

      // Log activity
      await logActivity(user.id, user.organizationId || undefined, "login_backup_code", "user", user.id, {}, req);

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
          roleName: role?.name,
          organizationId: user.organizationId,
          permissions: permissions.map(p => p.name),
        },
        role,
        token,
      });
    } catch (error: any) {
      console.error("Backup code verification error:", error);
      res.status(500).json({ error: "Failed to verify backup code" });
    }
  });

  // Disable MFA
  app.post("/api/mfa/disable", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ error: "Password is required to disable MFA" });
      }

      // Verify password before disabling MFA
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid password" });
      }

      await mfaService.disableMFA(userId);

      // Log activity
      await logActivity(userId, req.user!.organizationId || undefined, "disable_mfa", "user", userId, {}, req);

      res.json({ success: true, message: "MFA disabled successfully" });
    } catch (error: any) {
      console.error("MFA disable error:", error);
      res.status(500).json({ error: "Failed to disable MFA" });
    }
  });

  // Get MFA status
  app.get("/api/mfa/status", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const status = await mfaService.getMFAStatus(userId);

      res.json(status);
    } catch (error: any) {
      console.error("MFA status error:", error);
      res.status(500).json({ error: "Failed to fetch MFA status" });
    }
  });

  // ==================== TEST/DEVELOPMENT ONLY ====================
  // Generate TOTP token for automated testing
  // SECURITY: This endpoint is ONLY available in development/test environments.
  // It is enabled by default when NODE_ENV !== 'production', but can be explicitly
  // disabled by setting ENABLE_TEST_TOTP_ENDPOINT=false
  app.post("/api/mfa/test/generate-totp", async (req: Request, res: Response) => {
    // Production safety check (highest priority)
    if (process.env.NODE_ENV === 'production') {
      console.error('⛔ CRITICAL: /api/mfa/test/generate-totp accessed in production!');
      return res.status(403).json({ error: "This endpoint is not available in production" });
    }

    // Check if explicitly disabled in dev/test
    if (process.env.ENABLE_TEST_TOTP_ENDPOINT === 'false') {
      return res.status(403).json({ error: "Test TOTP endpoint is disabled" });
    }

    // Allow in development/test by default

    try {
      const { secret } = req.body;

      if (!secret) {
        return res.status(400).json({ error: "TOTP secret is required" });
      }

      // Generate current TOTP token
      const token = mfaService.getCurrentToken(secret);

      // Audit log for security monitoring
      console.log(`[TEST] TOTP generated for secret: ${secret.substring(0, 4)}...`);

      res.json({ token });
    } catch (error: any) {
      console.error("Test TOTP generation error:", error);
      res.status(500).json({ error: "Failed to generate TOTP" });
    }
  });

  // Regenerate backup codes
  app.post("/api/mfa/regenerate-backup-codes", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ error: "Password is required to regenerate backup codes" });
      }

      // Verify password
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid password" });
      }

      const backupCodes = await mfaService.regenerateBackupCodes(userId);

      // Log activity
      await logActivity(userId, req.user!.organizationId || undefined, "regenerate_backup_codes", "user", userId, {}, req);

      res.json({
        success: true,
        backupCodes // Save these securely!
      });
    } catch (error: any) {
      console.error("Backup codes regeneration error:", error);
      res.status(500).json({ error: error.message || "Failed to regenerate backup codes" });
    }
  });

  // Trust a device (skip MFA for 30 days)
  app.post("/api/mfa/trust-device", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { deviceId, deviceName } = req.body;

      if (!deviceId || !deviceName) {
        return res.status(400).json({ error: "Device ID and name are required" });
      }

      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      await mfaService.trustDevice(userId, deviceId, deviceName, ipAddress, userAgent);

      res.json({ success: true, message: "Device trusted for 30 days" });
    } catch (error: any) {
      console.error("Trust device error:", error);
      res.status(500).json({ error: "Failed to trust device" });
    }
  });

  // Check if device is trusted
  app.post("/api/mfa/check-trusted-device", async (req: Request, res: Response) => {
    try {
      const { userId, deviceId } = req.body;

      if (!userId || !deviceId) {
        return res.status(400).json({ error: "User ID and device ID are required" });
      }

      const isTrusted = await mfaService.isDeviceTrusted(userId, deviceId);

      res.json({ trusted: isTrusted });
    } catch (error: any) {
      console.error("Check trusted device error:", error);
      res.status(500).json({ error: "Failed to check device trust status" });
    }
  });

  // Get all trusted devices
  app.get("/api/mfa/trusted-devices", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const devices = await mfaService.getTrustedDevices(userId);

      res.json({ devices });
    } catch (error: any) {
      console.error("Get trusted devices error:", error);
      res.status(500).json({ error: "Failed to fetch trusted devices" });
    }
  });

  // Remove a trusted device
  app.delete("/api/mfa/trusted-devices/:deviceId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { deviceId } = req.params;

      await mfaService.removeTrustedDevice(userId, deviceId);

      res.json({ success: true, message: "Device removed from trusted devices" });
    } catch (error: any) {
      console.error("Remove trusted device error:", error);
      res.status(500).json({ error: "Failed to remove trusted device" });
    }
  });

  // ==================== OTP Verification Routes ====================
  
  // Send OTP to phone number
  app.post("/api/auth/send-otp", rateLimit(5, 15 * 60 * 1000), async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      // Validate phone format (E.164 international format)
      // Accepts: +<country code><number> where total digits can be 7-15
      // Examples: +919876543210 (India), +14155551234 (USA), +442071234567 (UK)
      const phoneRegex = /^\+?[1-9]\d{6,14}$/; // E.164 format: + followed by 7-15 digits
      const cleanedPhone = phone.replace(/[\s()-]/g, '');
      if (!phoneRegex.test(cleanedPhone)) {
        return res.status(400).json({ error: "Invalid phone number format. Please include country code (e.g., +91 for India, +1 for USA)" });
      }

      // Import SMS utilities
      const { sendOTP, generateOTP, getOTPExpiry } = await import('./sms');

      // Generate OTP
      const otp = generateOTP();
      const expiresAt = getOTPExpiry();

      // Clean up expired OTPs first
      await storage.deleteExpiredOtps();

      // Store OTP in database
      const otpRecord = await storage.createOtpVerification({
        phone,
        otp,
        expiresAt,
        userId: null,
        verified: false,
      });

      // Try to send OTP via SMS (non-blocking for testing/development)
      const smsResult = await sendOTP(phone, otp);

      if (!smsResult.success) {
        console.warn(`SMS not sent to ${phone}: ${smsResult.error}`);
        // In development/testing, return success even if SMS fails (OTP is in DB for testing)
        // In production, Twilio should be configured
        if (process.env.NODE_ENV === 'development') {
          return res.json({ 
            success: true,
            message: "OTP generated (SMS not configured - check database)",
            expiresAt,
            developmentOnly: { otpId: otpRecord.id }
          });
        }
        return res.status(500).json({ 
          error: smsResult.error || "Failed to send OTP SMS" 
        });
      }

      res.json({ 
        success: true,
        message: "OTP sent successfully",
        expiresAt 
      });
    } catch (error: any) {
      console.error("Send OTP error:", error);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  // Verify OTP code
  app.post("/api/auth/verify-otp", rateLimit(10, 15 * 60 * 1000), async (req: Request, res: Response) => {
    try {
      const { phone, otp } = req.body;

      if (!phone || !otp) {
        return res.status(400).json({ error: "Phone number and OTP are required" });
      }

      // Get latest OTP for this phone number
      const otpRecord = await storage.getLatestOtpByPhone(phone);

      if (!otpRecord) {
        return res.status(400).json({ error: "No OTP found for this phone number" });
      }

      // Check if OTP is expired
      if (new Date() > otpRecord.expiresAt) {
        return res.status(400).json({ error: "OTP has expired" });
      }

      // Check if OTP is already verified
      if (otpRecord.verified) {
        return res.status(400).json({ error: "OTP has already been used" });
      }

      // Verify OTP code
      if (otpRecord.otp !== otp) {
        return res.status(400).json({ error: "Invalid OTP code" });
      }

      // Mark OTP as verified
      await storage.verifyOtp(otpRecord.id);

      // CRITICAL: Update user's phoneVerified status
      // Find user by phone number and update their phoneVerified field
      const user = await storage.getUserByPhone(phone);
      if (user) {
        await storage.updateUser(user.id, { 
          phoneVerified: true,
          phoneVerifiedAt: new Date()
        });
      }

      res.json({ 
        success: true,
        message: "Phone number verified successfully",
        otpId: otpRecord.id
      });
    } catch (error: any) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ error: "Failed to verify OTP" });
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
          roleName: role?.name, // Add role name to user object
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
          roleName: role?.name, // Add role name to user object
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

      // Get organization name for the email/SMS
      const organization = await storage.getOrganization(req.user!.organizationId!);
      const organizationName = organization?.name || "Accute";

      // Send invitation automatically based on type
      let sendResult: { success: boolean; error?: string } = { success: false };
      
      if (type === 'email' && email) {
        const { sendInvitationEmail } = await import('./email');
        sendResult = await sendInvitationEmail(email, inviteUrl, organizationName, role.name);
        
        if (sendResult.success) {
          console.log(`✓ Invitation email sent to ${email}`);
        } else {
          console.error(`✗ Failed to send invitation email to ${email}:`, sendResult.error);
        }
      } else if (type === 'sms' && phone) {
        // SMS is only for OTP verification, not for invitations
        // Return the invite URL for manual sharing
        console.log(`⚠️  SMS invitations not supported. SMS is only for OTP verification.`);
        sendResult = { 
          success: false, 
          error: 'SMS invitations not supported. Please share the invite link manually or use email invitations.' 
        };
      }

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
        sent: sendResult.success,
        sendError: sendResult.error,
        message: sendResult.success 
          ? `Invitation ${type === 'sms' ? 'SMS' : 'email'} sent successfully!`
          : sendResult.error || `Failed to send invitation ${type === 'sms' ? 'SMS' : 'email'}. Please share the link manually.`
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
          roleName: role?.name, // Add role name to user object
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

  // ==================== SSO/SAML Routes ====================
  
  // SECURITY: Get trusted base URL from environment (prevents host header injection)
  function getTrustedBaseUrl(): string {
    // Use REPLIT_DOMAINS in production (Replit standard env var)
    if (process.env.REPLIT_DOMAINS) {
      const domains = process.env.REPLIT_DOMAINS.split(',');
      return `https://${domains[0]}`;
    }
    
    // Fallback to localhost for development
    if (process.env.NODE_ENV !== 'production') {
      return 'http://localhost:5000';
    }
    
    // Production fallback - should be set explicitly
    throw new Error('REPLIT_DOMAINS environment variable not set in production');
  }
  
  // Configure Passport SAML strategy (multi-tenant)
  passport.use('saml', new MultiSamlStrategy(
    {
      passReqToCallback: true,
      getSamlOptions: async (req, done) => {
        try {
          const orgSlug = req.params.orgSlug || req.query.orgSlug as string || req.body?.RelayState;
          if (!orgSlug) {
            return done(new Error('Organization slug is required'));
          }

          // Get organization by slug
          const org = await db.select().from(schema.organizations)
            .where(eq(schema.organizations.slug, orgSlug))
            .limit(1);

          if (!org[0]) {
            return done(new Error('Organization not found'));
          }

          const baseUrl = getTrustedBaseUrl();
          const callbackUrl = `${baseUrl}/auth/saml/${orgSlug}/callback`;
          const options = await samlService.getSamlOptions(org[0].id, callbackUrl);
          done(null, options);
        } catch (error: any) {
          done(error);
        }
      }
    },
    async (req: any, profile: any, done: any) => {
      try {
        const orgSlug = req.params.orgSlug;
        const org = await db.select().from(schema.organizations)
          .where(eq(schema.organizations.slug, orgSlug))
          .limit(1);

        if (!org[0]) {
          return done(new Error('Organization not found'));
        }

        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('user-agent') || '';
        const sessionIndex = profile.sessionIndex;

        const user = await samlService.processProfile(
          org[0].id,
          profile,
          sessionIndex,
          ipAddress,
          userAgent
        );

        done(null, user);
      } catch (error: any) {
        done(error);
      }
    }
  ));

  // Get SSO configuration for organization
  app.get("/api/sso/connections", requireAuth, requirePermission("settings.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const connection = await samlService.getSsoConnection(req.user!.organizationId!);
      
      if (!connection) {
        return res.json(null);
      }

      // Don't expose the certificate to the frontend
      res.json({
        ...connection,
        certificate: connection.certificate ? '***REDACTED***' : null
      });
    } catch (error: any) {
      console.error("Get SSO connection error:", error);
      res.status(500).json({ error: "Failed to fetch SSO configuration" });
    }
  });

  // Create SSO configuration
  app.post("/api/sso/connections", requireAuth, requirePermission("settings.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const insertSchema = schema.insertSsoConnectionSchema.extend({
        organizationId: z.string().optional(),
        createdBy: z.string().optional(),
      });

      const data = insertSchema.parse(req.body);

      // Set organizationId and createdBy from authenticated user
      data.organizationId = req.user!.organizationId!;
      data.createdBy = req.userId!;

      const [connection] = await db.insert(schema.ssoConnections)
        .values(data as any)
        .returning();

      await logActivity(req.userId, req.user!.organizationId, "create", "sso_connection", connection.id, data, req);

      res.json({
        ...connection,
        certificate: connection.certificate ? '***REDACTED***' : null
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Create SSO connection error:", error);
      res.status(500).json({ error: "Failed to create SSO configuration" });
    }
  });

  // Update SSO configuration
  app.put("/api/sso/connections/:id", requireAuth, requirePermission("settings.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Verify connection belongs to user's organization
      const existing = await db.select().from(schema.ssoConnections)
        .where(and(
          eq(schema.ssoConnections.id, id),
          eq(schema.ssoConnections.organizationId, req.user!.organizationId!)
        ))
        .limit(1);

      if (!existing[0]) {
        return res.status(404).json({ error: "SSO configuration not found" });
      }

      const updateSchema = schema.insertSsoConnectionSchema.partial();
      const data = updateSchema.parse(req.body);

      const [updated] = await db.update(schema.ssoConnections)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.ssoConnections.id, id))
        .returning();

      await logActivity(req.userId, req.user!.organizationId, "update", "sso_connection", id, data, req);

      res.json({
        ...updated,
        certificate: updated.certificate ? '***REDACTED***' : null
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Update SSO connection error:", error);
      res.status(500).json({ error: "Failed to update SSO configuration" });
    }
  });

  // Delete SSO configuration
  app.delete("/api/sso/connections/:id", requireAuth, requirePermission("settings.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Verify connection belongs to user's organization
      const existing = await db.select().from(schema.ssoConnections)
        .where(and(
          eq(schema.ssoConnections.id, id),
          eq(schema.ssoConnections.organizationId, req.user!.organizationId!)
        ))
        .limit(1);

      if (!existing[0]) {
        return res.status(404).json({ error: "SSO configuration not found" });
      }

      await db.delete(schema.ssoConnections)
        .where(eq(schema.ssoConnections.id, id));

      await logActivity(req.userId, req.user!.organizationId, "delete", "sso_connection", id, {}, req);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete SSO connection error:", error);
      res.status(500).json({ error: "Failed to delete SSO configuration" });
    }
  });

  // SAML login endpoint (SP-initiated flow)
  app.get("/auth/saml/:orgSlug/login", passport.authenticate('saml', { failureRedirect: '/login' }));

  // SAML callback endpoint (receives SAML response from IdP)
  app.post("/auth/saml/:orgSlug/callback",
    passport.authenticate('saml', { session: false, failureRedirect: '/login' }),
    async (req: any, res: Response) => {
      try {
        const user = req.user as any;

        // Generate session token
        const token = generateToken(user.id);
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        await db.insert(schema.sessions).values({
          userId: user.id,
          token,
          expiresAt,
        });

        // Set cookie and redirect to dashboard
        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        res.redirect('/dashboard');
      } catch (error: any) {
        console.error('SAML callback error:', error);
        res.redirect('/login?error=saml_auth_failed');
      }
    }
  );

  // SP metadata endpoint (provide to IdP for configuration)
  app.get("/auth/saml/:orgSlug/metadata", async (req: Request, res: Response) => {
    try {
      const { orgSlug } = req.params;

      const org = await db.select().from(schema.organizations)
        .where(eq(schema.organizations.slug, orgSlug))
        .limit(1);

      if (!org[0]) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const connection = await samlService.getSsoConnection(org[0].id);
      
      if (!connection) {
        return res.status(404).json({ error: "SSO not configured for this organization" });
      }

      const baseUrl = getTrustedBaseUrl();
      const acsUrl = `${baseUrl}/auth/saml/${orgSlug}/callback`;
      const metadata = samlService.generateMetadata(connection.entityId, acsUrl);

      res.type('application/xml');
      res.send(metadata);
    } catch (error: any) {
      console.error("Generate metadata error:", error);
      res.status(500).json({ error: "Failed to generate metadata" });
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

  // Get current user's profile
  app.get("/api/users/me", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  });

  // Update current user's profile (self-service)
  app.patch("/api/users/me", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      // Whitelist of allowed fields for self-service update
      // Users CANNOT change: roleId, organizationId, isActive, phoneVerified, phoneVerifiedAt, kycStatus, kycVerifiedAt
      const allowedFields = [
        'firstName',
        'lastName',
        'phone',
        'dateOfBirth',
        'nationalId',
        'nationalIdType',
        'address',
        'city',
        'state',
        'zipCode',
        'country',
        'emergencyContactName',
        'emergencyContactPhone',
        'emergencyContactRelation',
        'idDocumentUrl',
        'addressProofUrl',
      ];

      // Filter request body to only include allowed fields
      const updateData: any = {};
      for (const field of allowedFields) {
        if (req.body.hasOwnProperty(field)) {
          updateData[field] = req.body[field];
        }
      }

      // Convert dateOfBirth string to Date object if provided
      if (updateData.dateOfBirth && typeof updateData.dateOfBirth === 'string') {
        updateData.dateOfBirth = new Date(updateData.dateOfBirth);
      }

      // Handle password update separately with hashing
      if (req.body.password) {
        updateData.password = await hashPassword(req.body.password);
      }

      // Ensure there's something to update
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const user = await storage.updateUser(req.userId!, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "user", user.id, { action: "self_update", fields: Object.keys(updateData) }, req);
      res.json({ ...user, password: undefined });
    } catch (error: any) {
      console.error("Failed to update user profile:", error);
      res.status(500).json({ error: "Failed to update user profile" });
    }
  });

  // Upload profile picture
  app.post("/api/users/me/avatar", requireAuth, (req: AuthRequest, res: Response) => {
    upload.single('avatar')(req, res, async (err) => {
      try {
        if (err) {
          console.error("Avatar upload error:", err);
          return res.status(400).json({ error: err.message || "File upload failed" });
        }

        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        // Validate file type (images only)
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: "Invalid file type. Only images (JPEG, PNG, GIF, WebP) are allowed" });
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (req.file.size > maxSize) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: "File too large. Maximum size is 5MB" });
        }

        // Build relative file path for database storage
        const relativePath = `/uploads/${req.file.filename}`;

        // Get current user to delete old avatar if it exists
        const currentUser = await storage.getUser(req.userId!);
        if (!currentUser) {
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: "User not found" });
        }

        // Delete old avatar file if it exists
        if (currentUser.avatarUrl && currentUser.avatarUrl.startsWith('/uploads/')) {
          // Normalize path: remove leading slash and resolve from cwd
          const oldAvatarPath = path.join(process.cwd(), currentUser.avatarUrl.replace(/^\//, ''));
          if (fs.existsSync(oldAvatarPath)) {
            try {
              fs.unlinkSync(oldAvatarPath);
            } catch (error) {
              console.error('Failed to delete old avatar:', error);
              // Continue with upload even if old file deletion fails
            }
          }
        }

        // Update user with new avatar URL
        const updatedUser = await storage.updateUser(req.userId!, { avatarUrl: relativePath });
        if (!updatedUser) {
          fs.unlinkSync(req.file.path);
          return res.status(500).json({ error: "Failed to update user profile" });
        }

        await logActivity(req.userId, req.user!.organizationId || undefined, "update", "user", updatedUser.id, { action: "avatar_upload" }, req);

        res.json({ 
          success: true,
          avatarUrl: relativePath,
          user: { ...updatedUser, password: undefined }
        });
      } catch (error: any) {
        console.error("Avatar upload error:", error);
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: "Failed to upload avatar" });
      }
    });
  });

  // Upload KYC documents (ID proof and Address proof)
  app.post("/api/users/me/kyc/documents", requireAuth, (req: AuthRequest, res: Response) => {
    upload.single('document')(req, res, async (err) => {
      try {
        if (err) {
          console.error("KYC document upload error:", err);
          return res.status(400).json({ error: err.message || "File upload failed" });
        }

        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        const documentType = req.body.documentType; // 'idDocument' or 'addressProof'
        
        if (!documentType || !['idDocument', 'addressProof'].includes(documentType)) {
          // Clean up uploaded file if validation fails
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: "Invalid document type. Must be 'idDocument' or 'addressProof'" });
        }

        // Get current user to check existing documents
        const currentUser = await storage.getUser(req.userId!);
        if (!currentUser) {
          fs.unlinkSync(req.file.path);
          return res.status(404).json({ error: "User not found" });
        }

        // Build relative file path for database storage
        const relativePath = `/uploads/${req.file.filename}`;

        // Update the appropriate field based on document type
        const updateData: any = {};
        if (documentType === 'idDocument') {
          updateData.idDocumentUrl = relativePath;
        } else {
          updateData.addressProofUrl = relativePath;
        }

        // Update user with new document URL
        const updatedUser = await storage.updateUser(req.userId!, updateData);
        if (!updatedUser) {
          fs.unlinkSync(req.file.path);
          return res.status(500).json({ error: "Failed to update user profile" });
        }

        // CRITICAL: Fetch fresh user data to verify BOTH documents actually exist
        // This prevents race conditions and ensures we validate against actual DB state
        const freshUser = await storage.getUser(req.userId!);
        if (!freshUser) {
          return res.status(500).json({ error: "Failed to verify document status" });
        }

        // Check if both documents are now uploaded and auto-update kycStatus to "submitted"
        // Only transition if BOTH URLs are present in the database AND status is still pending
        const hasIdDocument = !!freshUser.idDocumentUrl;
        const hasAddressProof = !!freshUser.addressProofUrl;

        if (hasIdDocument && hasAddressProof && freshUser.kycStatus === 'pending') {
          const finalUser = await storage.updateUser(req.userId!, { kycStatus: 'submitted' });
          if (finalUser) {
            freshUser.kycStatus = 'submitted';
          }
        }

        await logActivity(
          req.userId,
          req.user!.organizationId || undefined,
          "update",
          "user",
          updatedUser.id,
          { action: "kyc_document_upload", documentType, filename: req.file.filename },
          req
        );

        res.json({
          success: true,
          message: "Document uploaded successfully",
          documentType,
          user: { ...updatedUser, password: undefined }
        });
      } catch (error: any) {
        // Clean up uploaded file on error
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.error("Failed to clean up file:", cleanupError);
          }
        }
        console.error("KYC document upload error:", error);
        res.status(500).json({ error: "Failed to upload document" });
      }
    });
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

      // Prevent self-deletion
      if (id === req.userId) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      // Get the user to be deleted
      const userToDelete = await storage.getUser(id);
      if (!userToDelete) {
        return res.status(404).json({ error: "User not found" });
      }

      // Ensure user is in the same organization (tenant isolation)
      // Super Admins can delete users across organizations
      const requesterRole = await storage.getRole(req.user!.roleId);
      const isSuperAdmin = requesterRole?.scope === "platform" && requesterRole?.isSystemRole === true;
      
      if (!isSuperAdmin && userToDelete.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Cannot delete users from other organizations" });
      }

      // Get the role of the user being deleted
      const roleToDelete = await storage.getRole(userToDelete.roleId);
      
      // Prevent deleting Super Admins unless requester is also Super Admin
      if (roleToDelete?.scope === "platform" && roleToDelete?.isSystemRole === true) {
        if (!isSuperAdmin) {
          return res.status(403).json({ error: "Only Super Admins can delete platform administrators" });
        }
      }

      // Prevent deleting the last ACTIVE admin in an organization
      // This ensures organizations always have at least one active user who can manage the team
      // Check if the user being deleted has admin-level permissions (permission-based detection)
      // Skip this check if the user being deleted is already inactive
      if (roleToDelete && userToDelete.organizationId && userToDelete.isActive) {
        // Get permissions for the role being deleted
        const rolePermissions = await storage.getPermissionsByRole(roleToDelete.id);
        const hasAdminPermissions = rolePermissions.some(p => 
          p.name === "users.delete" || p.name === "users.create"
        );
        
        // Only check if this is an ACTIVE admin-capable role
        if (hasAdminPermissions) {
          const orgUsers = await storage.getUsersByOrganization(userToDelete.organizationId);
          
          // Find all users with admin-level permissions in this organization
          const userRoleChecks = await Promise.all(
            orgUsers
              .filter(u => u.id !== id && u.isActive === true)
              .map(async (u) => {
                const uRole = await storage.getRole(u.roleId);
                if (!uRole) return { userId: u.id, isAdmin: false };
                
                const uPerms = await storage.getPermissionsByRole(uRole.id);
                const isAdmin = uPerms.some(p => 
                  p.name === "users.delete" || p.name === "users.create"
                );
                return { userId: u.id, isAdmin };
              })
          );
          
          const remainingActiveAdmins = userRoleChecks.filter(u => u.isAdmin);
          
          if (remainingActiveAdmins.length === 0) {
            return res.status(400).json({ 
              error: "Cannot delete the last active administrator in the organization. At least one active admin must remain to manage the team." 
            });
          }
        }
      }

      // Perform the deletion
      await storage.deleteUser(id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "user", id, { 
        deletedUser: {
          username: userToDelete.username,
          email: userToDelete.email,
          role: roleToDelete?.name,
        }
      }, req);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // ==================== Organization Routes ====================

  app.post("/api/organizations", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { name, slug: providedSlug } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Organization name is required" });
      }

      // Auto-generate slug from name if not provided
      let slug = providedSlug?.trim();
      if (!slug) {
        slug = name.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      // Check slug uniqueness
      const existing = await storage.getOrganizationBySlug(slug);
      if (existing) {
        return res.status(409).json({ error: "Organization slug already exists. Please choose a different name." });
      }

      // Create organization
      const organization = await storage.createOrganization({
        name: name.trim(),
        slug,
        tags: [],
        isTestAccount: false,
      });

      // Get creator's role (should be Admin for new workspace)
      const user = await storage.getUser(req.userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Check if user has existing workspace memberships
      const existingMemberships = await storage.getUserOrganizations(req.userId);
      const isFirstWorkspace = existingMemberships.length === 0;

      // Create userOrganizations membership entry for the creator
      await storage.createUserOrganization({
        userId: req.userId,
        organizationId: organization.id,
        roleId: user.roleId, // Use their existing role (typically Admin)
        status: 'active',
        isDefault: true, // Always set new workspace as default
        joinedAt: new Date(),
      });

      // CRITICAL: Always update user's organizationId and defaultOrganizationId to new workspace
      // This ensures they're switched to the new workspace after re-authentication
      await storage.updateUser(req.userId, {
        organizationId: organization.id,
        defaultOrganizationId: organization.id,
      });
      
      // If user has other workspaces, unset their isDefault flag
      if (!isFirstWorkspace) {
        for (const membership of existingMemberships) {
          if (membership.organizationId !== organization.id) {
            await storage.updateUserOrganization(membership.id, {
              isDefault: false,
            });
          }
        }
      }

      await logActivity(req.userId, organization.id, "create", "organization", organization.id, { name: organization.name }, req);

      res.status(201).json(organization);
    } catch (error: any) {
      console.error("Failed to create organization:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      res.status(500).json({ error: "Failed to create organization" });
    }
  });

  // Get organization by ID
  app.get("/api/organizations/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const organization = await storage.getOrganization(req.params.id);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      // Users can only view their own organization (unless they're super admin)
      const isSuperAdmin = !req.user!.organizationId;
      if (!isSuperAdmin && organization.id !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(organization);
    } catch (error: any) {
      console.error("Failed to fetch organization:", error);
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  // Update organization settings (Company Profile, Branding, etc.)
  app.patch("/api/organizations/:id", requireAuth, requirePermission("organization.edit"), async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const organization = await storage.getOrganization(id);
      
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }

      // Verify user has access to this organization
      const membership = await storage.getUserOrganizationMembership(req.userId, id);
      const isSuperAdmin = !req.user!.organizationId; // Super Admin has no org
      
      // Only members of this organization or Super Admins can update settings
      if (!membership && !isSuperAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Ensure membership is active (if not Super Admin)
      if (membership && membership.status !== 'active') {
        return res.status(403).json({ error: "Organization membership is not active" });
      }

      // Validate the update payload
      const updateSchema = insertOrganizationSchema.partial();
      const validatedData = updateSchema.parse(req.body);

      const updated = await storage.updateOrganization(id, validatedData);
      await logActivity(req.userId, id, "update", "organization", id, validatedData, req);

      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update organization:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      res.status(500).json({ error: "Failed to update organization" });
    }
  });

  // Get user's workspaces (multi-workspace memberships)
  app.get("/api/user/workspaces", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const memberships = await storage.getUserOrganizations(req.userId);
      
      // Enrich with organization details
      const workspaces = await Promise.all(
        memberships.map(async (membership) => {
          const org = await storage.getOrganization(membership.organizationId);
          const role = await storage.getRole(membership.roleId);
          return {
            ...membership,
            organization: org,
            role: role
          };
        })
      );

      res.json(workspaces);
    } catch (error: any) {
      console.error("Failed to fetch user workspaces:", error);
      res.status(500).json({ error: "Failed to fetch workspaces" });
    }
  });

  // Switch to a different workspace (set as default)
  app.post("/api/user/workspaces/:organizationId/switch", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { organizationId } = req.params;

      // Verify membership
      const membership = await storage.getUserOrganizationMembership(req.userId, organizationId);
      if (!membership) {
        return res.status(403).json({ error: "You are not a member of this workspace" });
      }

      if (membership.status !== 'active') {
        return res.status(403).json({ error: "Workspace membership is not active" });
      }

      // Set as default workspace
      await storage.setDefaultWorkspace(req.userId, organizationId);

      await logActivity(req.userId, organizationId, "switch", "workspace", organizationId, {}, req);

      res.json({ success: true, organizationId });
    } catch (error: any) {
      console.error("Failed to switch workspace:", error);
      res.status(500).json({ error: "Failed to switch workspace" });
    }
  });

  // Get organization members (via userOrganizations join table)
  app.get("/api/organizations/:id/members", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      // Verify user has access to this organization
      const membership = await storage.getUserOrganizationMembership(req.userId, id);
      const isSuperAdmin = !req.user!.organizationId;
      
      // Only active members or Super Admins can view organization members
      if (!isSuperAdmin) {
        if (!membership) {
          return res.status(403).json({ error: "Access denied" });
        }
        if (membership.status !== 'active') {
          return res.status(403).json({ error: "Organization membership is not active" });
        }
      }

      // Get all memberships for this organization
      const memberships = await db.select()
        .from(schema.userOrganizations)
        .where(eq(schema.userOrganizations.organizationId, id));

      // Enrich with user and role details
      const members = await Promise.all(
        memberships.map(async (membership) => {
          const user = await storage.getUser(membership.userId);
          const role = await storage.getRole(membership.roleId);
          return {
            ...membership,
            user,
            role
          };
        })
      );

      res.json(members);
    } catch (error: any) {
      console.error("Failed to fetch organization members:", error);
      res.status(500).json({ error: "Failed to fetch members" });
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
      // Super admin (platform-scoped) can see all workflows
      if (!req.user!.organizationId) {
        const allWorkflows = await db.select().from(schema.workflows).orderBy(schema.workflows.name);
        return res.json(allWorkflows);
      }
      const workflows = await storage.getWorkflowsByOrganization(req.user!.organizationId);
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
        scope: req.user!.organizationId ? 'organization' : 'global', // Super admin creates global templates
        organizationId: req.user!.organizationId || null, // Allow null for super admin
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

  app.delete("/api/workflows/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const role = await storage.getRole(req.user!.roleId);
      const isAdmin = role?.name === 'Admin' || role?.scope === 'platform';
      
      // Admins and Super Admins can ALWAYS delete workflows (with ownership checks below)
      if (!isAdmin) {
        // Non-admins need workflows.delete permission
        const { getEffectivePermissions } = await import('./rbac-subscription-bridge');
        const effectivePermissions = await getEffectivePermissions(
          req.user!.id,
          req.user!.roleId,
          req.user!.organizationId
        );
        const hasPermission = effectivePermissions.some(p => p.name === 'workflows.delete');
        
        if (!hasPermission) {
          return res.status(403).json({ 
            error: "Insufficient permissions", 
            required: "workflows.delete" 
          });
        }
      }
      
      const existing = await storage.getWorkflow(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      
      // Check ownership:
      // - Admin and Super Admin can delete ANY workflow (global or organization-specific)
      // - Regular users can only delete their own organization's workflows
      if (!isAdmin) {
        const isOwnOrganizationWorkflow = existing.organizationId === req.user!.organizationId;
        if (!isOwnOrganizationWorkflow) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      await storage.deleteWorkflow(req.params.id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "workflow", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete workflow" });
    }
  });

  // Get workflow stages with computed metrics (for Timeline View)
  app.get("/api/workflows/:workflowId/stages", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      // Verify workflow exists and user has access
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      // Security: Check organization access (unless super admin)
      if (req.user!.organizationId && workflow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Unauthorized access to workflow" });
      }

      // Parse optional includeSteps query parameter (default to true for Timeline View)
      const includeSteps = req.query.includeSteps !== 'false'; // Include steps by default

      // Fetch stages with computed metrics
      const stages = await workflowStagesService.getStagesWithMetrics(
        req.params.workflowId,
        includeSteps
      );

      res.json(stages);
    } catch (error: any) {
      console.error("Failed to fetch workflow stages:", error);
      res.status(500).json({ error: "Failed to fetch workflow stages", details: error.message });
    }
  });

  // ==================== LLM Configuration Routes ====================
  
  app.get("/api/llm-configurations", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const scope = req.query.scope as string; // 'user' | 'workspace' | undefined
      const isSuperAdmin = !req.user!.organizationId;
      
      let configs: any[] = [];
      
      if (scope === 'user') {
        // Get user-level configurations
        configs = await storage.getLlmConfigurationsByUser(req.user!.id);
      } else if (scope === 'workspace') {
        // Get workspace-level configurations
        if (isSuperAdmin) {
          // Super Admin: see all workspace configs
          configs = (await storage.getAllLlmConfigurations()).filter(c => c.scope === 'workspace');
        } else {
          configs = await storage.getLlmConfigurationsByOrganization(req.user!.organizationId!);
        }
      } else {
        // No scope specified: return appropriate configs based on user type
        if (isSuperAdmin) {
          // Super Admin: see all configs
          configs = await storage.getAllLlmConfigurations();
        } else {
          // Regular user: return BOTH user-level and workspace-level configs
          const userConfigs = await storage.getLlmConfigurationsByUser(req.user!.id);
          const workspaceConfigs = await storage.getLlmConfigurationsByOrganization(req.user!.organizationId!);
          configs = [...workspaceConfigs, ...userConfigs]; // Workspace configs first (higher priority)
        }
      }
      
      // Don't send back the encrypted API keys in the list
      // Map modelVersion → azureApiVersion for UI compatibility
      const sanitized = configs.map(c => ({
        ...c,
        azureApiVersion: c.modelVersion, // Map DB field to UI field
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
      const { apiKey, azureApiVersion, scope, ...rest } = req.body;
      
      // Validate scope
      if (!scope || (scope !== 'user' && scope !== 'workspace')) {
        return res.status(400).json({ error: "Invalid scope. Must be 'user' or 'workspace'" });
      }
      
      // Encrypt the API key before storing
      const encryptedKey = encrypt(apiKey);
      
      // Prepare config data based on scope
      const configData: any = {
        ...rest,
        scope,
        modelVersion: azureApiVersion, // Map UI field to DB field
        apiKeyEncrypted: encryptedKey,
        createdBy: req.user!.id
      };
      
      if (scope === 'workspace') {
        // Workspace-level config
        if (!req.user!.organizationId) {
          return res.status(400).json({ error: "Workspace-level config requires an organization" });
        }
        configData.organizationId = req.user!.organizationId;
        configData.userId = null;
      } else {
        // User-level config
        configData.userId = req.user!.id;
        configData.organizationId = null;
      }
      
      // Auto-set as default if this is the first config in this scope
      const existingConfigs = scope === 'workspace'
        ? await storage.getLlmConfigurationsByOrganization(req.user!.organizationId!)
        : await storage.getLlmConfigurationsByUser(req.user!.id);
      
      const isFirstConfig = existingConfigs.length === 0;
      const shouldBeDefault = configData.isDefault === true || isFirstConfig;
      
      // If setting as default, unset all other defaults in this scope
      if (shouldBeDefault) {
        for (const existingConfig of existingConfigs) {
          if (existingConfig.isDefault) {
            await storage.updateLlmConfiguration(existingConfig.id, { isDefault: false });
          }
        }
        configData.isDefault = true;
      } else {
        configData.isDefault = false;
      }
      
      const config = await storage.createLlmConfiguration(configData);
      
      // Clear cache so new/updated default configs are picked up immediately
      const llmConfigService = getLLMConfigService();
      llmConfigService.clearCache({ 
        organizationId: scope === 'workspace' ? req.user!.organizationId : undefined,
        userId: scope === 'user' ? req.user!.id : undefined
      });
      
      await logActivity(req.user!.id, req.user!.organizationId || undefined, "create", "llm_configuration", config.id, { scope }, req);
      
      // Don't send back the encrypted key
      res.json({ ...config, apiKeyEncrypted: '[ENCRYPTED]' });
    } catch (error: any) {
      console.error('Failed to create LLM configuration:', error);
      res.status(500).json({ error: "Failed to create LLM configuration" });
    }
  });

  app.patch("/api/llm-configurations/:id", requireAuth, requirePermission("settings.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { encrypt } = await import('./llm-service');
      const existing = await storage.getLlmConfiguration(req.params.id);
      
      // Validate ownership based on scope
      if (!existing) {
        return res.status(404).json({ error: "LLM configuration not found" });
      }
      
      if (existing.scope === 'workspace' && existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "LLM configuration not found" });
      }
      
      if (existing.scope === 'user' && existing.userId !== req.user!.id) {
        return res.status(404).json({ error: "LLM configuration not found" });
      }
      
      const { apiKey, azureApiVersion, ...rest } = req.body;
      const updates: any = rest;
      
      // Map azureApiVersion → modelVersion for database storage
      if (azureApiVersion !== undefined) {
        updates.modelVersion = azureApiVersion;
      }
      
      // If a new API key is provided, encrypt it
      if (apiKey && apiKey !== '[ENCRYPTED]') {
        updates.apiKeyEncrypted = encrypt(apiKey);
      }
      
      // If setting as default, unset all other defaults in this scope
      if (updates.isDefault === true) {
        const existingConfigs = existing.scope === 'workspace'
          ? await storage.getLlmConfigurationsByOrganization(existing.organizationId!)
          : await storage.getLlmConfigurationsByUser(existing.userId!);
        
        for (const existingConfig of existingConfigs) {
          if (existingConfig.id !== req.params.id && existingConfig.isDefault) {
            await storage.updateLlmConfiguration(existingConfig.id, { isDefault: false });
          }
        }
      }
      
      const config = await storage.updateLlmConfiguration(req.params.id, updates);
      
      // Clear cache so updated configs are picked up immediately
      const llmConfigService = getLLMConfigService();
      llmConfigService.clearCache({ 
        organizationId: existing.scope === 'workspace' ? req.user!.organizationId : undefined,
        userId: existing.scope === 'user' ? req.user!.id : undefined
      });
      
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "llm_configuration", req.params.id, {}, req);
      
      res.json({ ...config, apiKeyEncrypted: '[ENCRYPTED]' });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update LLM configuration" });
    }
  });

  app.delete("/api/llm-configurations/:id", requireAuth, requirePermission("settings.manage"), async (req: AuthRequest, res: Response) => {
    try {
      console.log(`🔧 [LLM DELETE] User ${req.user!.email} attempting to delete LLM config ${req.params.id}`);
      
      const existing = await storage.getLlmConfiguration(req.params.id);
      
      if (!existing) {
        console.log(`❌ [LLM DELETE] Config ${req.params.id} not found`);
        return res.status(404).json({ error: "LLM configuration not found" });
      }
      
      // Check ownership based on scope
      if (existing.scope === 'workspace') {
        // Workspace-level config: must match user's organization
        if (existing.organizationId !== req.user!.organizationId) {
          console.log(`❌ [LLM DELETE] Organization mismatch: config org ${existing.organizationId}, user org ${req.user!.organizationId}`);
          return res.status(404).json({ error: "LLM configuration not found" });
        }
      } else if (existing.scope === 'user') {
        // User-level config: must match user's ID
        if (existing.userId !== req.user!.id) {
          console.log(`❌ [LLM DELETE] User mismatch: config user ${existing.userId}, current user ${req.user!.id}`);
          return res.status(404).json({ error: "LLM configuration not found" });
        }
      }
      
      console.log(`🗑️  [LLM DELETE] Deleting ${existing.scope}-level config ${req.params.id}`);
      await storage.deleteLlmConfiguration(req.params.id);
      
      // Clear cache so deletions are reflected immediately
      const llmConfigService = getLLMConfigService();
      llmConfigService.clearCache({ 
        organizationId: existing.scope === 'workspace' ? req.user!.organizationId : undefined,
        userId: existing.scope === 'user' ? req.user!.id : undefined
      });
      
      await logActivity(req.user!.id, req.user!.organizationId || undefined, "delete", "llm_configuration", req.params.id, { scope: existing.scope }, req);
      
      console.log(`✅ [LLM DELETE] Successfully deleted ${existing.scope}-level config ${req.params.id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error(`❌ [LLM DELETE] Failed to delete LLM configuration:`, error);
      res.status(500).json({ error: "Failed to delete LLM configuration", details: error.message });
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

  // ==================== Luca Chat Session Routes ====================

  // Get all chat sessions for current user (excluding archived by default)
  app.get("/api/luca-chat-sessions", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const includeArchived = req.query.includeArchived === 'true';
      const sessions = await storage.getLucaChatSessionsByUser(req.user!.id);
      
      // Filter out archived sessions unless explicitly requested
      const filteredSessions = includeArchived 
        ? sessions 
        : sessions.filter((s: any) => !s.isArchived);
      
      res.json(filteredSessions);
    } catch (error: any) {
      console.error('[Luca Chat] Error fetching sessions:', error);
      res.status(500).json({ error: "Failed to fetch chat sessions" });
    }
  });

  // Search chat sessions by title and content (must be before /:id route)
  app.get("/api/luca-chat-sessions/search", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const query = (req.query.q as string || '').trim();
      
      if (!query || query.length < 2) {
        return res.json([]);
      }

      // Get all sessions (including archived for search)
      const sessions = await storage.getLucaChatSessionsByUser(req.user!.id);
      
      // Search in titles first
      const titleMatches = sessions.filter((s: any) => 
        s.title.toLowerCase().includes(query.toLowerCase())
      );

      // Also search in message content for deeper search
      const sessionIds = sessions.map((s: any) => s.id);
      const contentMatches: any[] = [];

      for (const sessionId of sessionIds) {
        const messages = await storage.getLucaChatMessagesBySession(sessionId);
        const hasContentMatch = messages.some((m: any) =>
          m.content.toLowerCase().includes(query.toLowerCase())
        );

        if (hasContentMatch) {
          const session = sessions.find((s: any) => s.id === sessionId);
          if (session && !titleMatches.find((t: any) => t.id === sessionId)) {
            contentMatches.push(session);
          }
        }
      }

      // Combine and sort results (title matches first)
      const results = [...titleMatches, ...contentMatches]
        .sort((a: any, b: any) => 
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
        );

      res.json(results);
    } catch (error: any) {
      console.error('[Luca Chat] Error searching sessions:', error);
      res.status(500).json({ error: "Failed to search chat sessions" });
    }
  });

  // Get a specific chat session with messages
  app.get("/api/luca-chat-sessions/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const session = await storage.getLucaChatSession(req.params.id);
      
      if (!session || session.userId !== req.user!.id) {
        return res.status(404).json({ error: "Chat session not found" });
      }
      
      const messages = await storage.getLucaChatMessagesBySession(session.id);
      
      res.json({ ...session, messages });
    } catch (error: any) {
      console.error('[Luca Chat] Error fetching session:', error);
      res.status(500).json({ error: "Failed to fetch chat session" });
    }
  });

  // Create a new chat session
  app.post("/api/luca-chat-sessions", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { title, llmConfigId } = req.body;
      
      const session = await storage.createLucaChatSession({
        userId: req.user!.id,
        organizationId: req.user!.organizationId || undefined,
        title: title || "New Chat",
        llmConfigId,
      });
      
      res.json(session);
    } catch (error: any) {
      console.error('[Luca Chat] Error creating session:', error);
      res.status(500).json({ error: "Failed to create chat session" });
    }
  });

  // Generate title for a chat session based on conversation content
  app.post("/api/luca-chat-sessions/:id/generate-title", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getLucaChatSession(req.params.id);
      
      if (!existing || existing.userId !== req.user!.id) {
        return res.status(404).json({ error: "Chat session not found" });
      }

      // Get messages from the session
      const messages = await storage.getLucaChatMessagesBySession(req.params.id);
      
      if (messages.length < 2) {
        return res.status(400).json({ error: "Not enough messages to generate title" });
      }

      // Get first user message and assistant response
      const firstUserMessage = messages.find(m => m.role === 'user')?.content || '';
      const firstAssistantMessage = messages.find(m => m.role === 'assistant')?.content || '';

      // Get LLM config
      const llmConfig = existing.llmConfigId 
        ? await storage.getLlmConfiguration(existing.llmConfigId)
        : await storage.getDefaultLlmConfiguration(req.user!.organizationId!);

      if (!llmConfig) {
        return res.status(400).json({ error: "No LLM configuration available" });
      }

      // Generate title using LLM
      const { LLMService } = await import('./llm-service');
      const llmService = new LLMService(llmConfig);
      
      const titlePrompt = `Generate a short, descriptive title (3-6 words max) for this conversation. Return ONLY the title, nothing else.

User: ${firstUserMessage.substring(0, 500)}
Assistant: ${firstAssistantMessage.substring(0, 500)}

Title:`;

      const generatedTitle = await llmService.generateCompletion(titlePrompt, {
        maxTokens: 20,
        temperature: 0.7,
      });

      // Clean up title - remove quotes, extra whitespace, etc.
      let title = generatedTitle.trim()
        .replace(/^["']|["']$/g, '')  // Remove surrounding quotes
        .replace(/\n.*/g, '')  // Take only first line
        .substring(0, 100);  // Max 100 chars

      // Update session with generated title
      const updated = await storage.updateLucaChatSession(req.params.id, { title });
      res.json({ title: updated.title });
    } catch (error: any) {
      console.error('[Luca Chat] Error generating title:', error);
      res.status(500).json({ error: "Failed to generate title" });
    }
  });

  // Update a chat session (rename, pin, archive, etc.)
  app.patch("/api/luca-chat-sessions/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getLucaChatSession(req.params.id);
      
      if (!existing || existing.userId !== req.user!.id) {
        return res.status(404).json({ error: "Chat session not found" });
      }
      
      const { title, isPinned, isActive, isArchived } = req.body;
      const updates: any = {};
      
      if (title !== undefined) updates.title = title;
      if (isPinned !== undefined) updates.isPinned = isPinned;
      if (isActive !== undefined) updates.isActive = isActive;
      if (isArchived !== undefined) updates.isArchived = isArchived;
      
      const session = await storage.updateLucaChatSession(req.params.id, updates);
      res.json(session);
    } catch (error: any) {
      console.error('[Luca Chat] Error updating session:', error);
      res.status(500).json({ error: "Failed to update chat session" });
    }
  });

  // Delete a chat session
  app.delete("/api/luca-chat-sessions/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getLucaChatSession(req.params.id);
      
      if (!existing || existing.userId !== req.user!.id) {
        return res.status(404).json({ error: "Chat session not found" });
      }
      
      await storage.deleteLucaChatSession(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Luca Chat] Error deleting session:', error);
      res.status(500).json({ error: "Failed to delete chat session" });
    }
  });

  // Archive/Unarchive a chat session
  app.patch("/api/luca-chat-sessions/:id/archive", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getLucaChatSession(req.params.id);
      
      if (!existing || existing.userId !== req.user!.id) {
        return res.status(404).json({ error: "Chat session not found" });
      }

      const { isArchived } = req.body;

      if (typeof isArchived !== 'boolean') {
        return res.status(400).json({ error: "isArchived must be a boolean" });
      }

      const updated = await storage.updateLucaChatSession(req.params.id, { isArchived });
      res.json(updated);
    } catch (error: any) {
      console.error('[Luca Chat] Error archiving session:', error);
      res.status(500).json({ error: "Failed to archive chat session" });
    }
  });

  // Get messages for a chat session
  app.get("/api/luca-chat-sessions/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const session = await storage.getLucaChatSession(req.params.id);
      
      if (!session || session.userId !== req.user!.id) {
        return res.status(404).json({ error: "Chat session not found" });
      }
      
      const messages = await storage.getLucaChatMessagesBySession(session.id);
      res.json(messages);
    } catch (error: any) {
      console.error('[Luca Chat] Error fetching messages:', error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Add a message to a session
  app.post("/api/luca-chat-sessions/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const session = await storage.getLucaChatSession(req.params.id);
      
      if (!session || session.userId !== req.user!.id) {
        return res.status(404).json({ error: "Chat session not found" });
      }
      
      const { role, content, metadata } = req.body;
      
      const message = await storage.createLucaChatMessage({
        sessionId: session.id,
        role,
        content,
        metadata: metadata || {},
      });
      
      // Update session's lastMessageAt
      await storage.updateLucaChatSession(session.id, {
        lastMessageAt: new Date(),
      });
      
      res.json(message);
    } catch (error: any) {
      console.error('[Luca Chat] Error creating message:', error);
      res.status(500).json({ error: "Failed to create message" });
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

  app.delete("/api/ai-agents/install/:installationId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await storage.uninstallAiAgent(
        req.params.installationId,
        req.user!.organizationId!
      );
      await logActivity(req.userId, req.user!.organizationId || undefined, "uninstall", "ai_agent", req.params.installationId, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to uninstall AI agent" });
    }
  });

  // Execute AI Agent with conversation persistence and function calling
  app.post("/api/ai-agents/execute", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { agentName, input, llmConfigId, conversationId, contextType, contextId, contextData } = req.body;
      const startTime = Date.now();
      
      // Get LLM configuration - use specified or default
      const llmConfigService = getLLMConfigService();
      const llmConfig = await llmConfigService.getConfig({ 
        organizationId: req.user!.organizationId,
        userId: req.user!.id,
        configId: llmConfigId 
      });
      
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

  // ==================== AI Roundtable Routes ====================

  // Get all Roundtable sessions for organization
  app.get("/api/roundtable/sessions", requireAuth, requirePermission("roundtable.access"), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.json([]);
      }

      const sessions = await storage.getRoundtableSessionsByOrganization(req.user!.organizationId);
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  // Create a new Roundtable session
  app.post("/api/roundtable/sessions", requireAuth, requirePermission("roundtable.create"), rateLimit(10, 60 * 1000), async (req: AuthRequest, res: Response) => {
    try {
      const { objective, initialAgents = [] } = req.body;
      
      // Input validation
      if (!objective || typeof objective !== 'string' || objective.trim().length === 0) {
        return res.status(400).json({ error: "Valid objective is required" });
      }

      if (objective.length > 1000) {
        return res.status(400).json({ error: "Objective must be 1000 characters or less" });
      }

      if (!Array.isArray(initialAgents)) {
        return res.status(400).json({ error: "Initial agents must be an array" });
      }

      if (initialAgents.length > 10) {
        return res.status(400).json({ error: "Maximum 10 initial agents allowed" });
      }

      // Validate agent slugs
      const validAgentSlugs = ['luca', 'cadence', 'forma', 'parity', 'email', 'messages'];
      for (const slug of initialAgents) {
        if (typeof slug !== 'string' || !validAgentSlugs.includes(slug.toLowerCase())) {
          return res.status(400).json({ error: `Invalid agent slug: ${slug}` });
        }
      }
      
      if (!req.user!.organizationId) {
        return res.status(400).json({ error: "Organization required" });
      }

      // Create session
      const session = await storage.createRoundtableSession({
        organizationId: req.user!.organizationId,
        userId: req.userId,
        objective: objective.trim(),
        status: 'active',
      });

      // Add initial agents if specified
      if (initialAgents.length > 0) {
        const { RoundtableOrchestrator } = await import('./roundtable-orchestrator');
        const orchestrator = new RoundtableOrchestrator(storage);
        
        for (const agentSlug of initialAgents) {
          await orchestrator.addAgentToSession(session.id, agentSlug);
        }
      }

      await logActivity(req.userId, req.user!.organizationId, "create", "roundtable_session", session.id, { objective }, req);
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create Roundtable session" });
    }
  });

  // Get Roundtable session details with full context
  app.get("/api/roundtable/sessions/:id", requireAuth, requirePermission("roundtable.access"), async (req: AuthRequest, res: Response) => {
    try {
      const session = await storage.getRoundtableSession(req.params.id);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Verify access
      if (session.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get full session context
      const { RoundtableOrchestrator } = await import('./roundtable-orchestrator');
      const orchestrator = new RoundtableOrchestrator(storage);
      const context = await orchestrator.getSessionContext(req.params.id);

      // Get messages and participants
      const messages = await storage.getRoundtableMessagesBySession(req.params.id);
      const participants = await storage.getRoundtableParticipantsBySession(req.params.id);

      // Return structure that frontend expects
      res.json({
        session,
        messages,
        participants,
        context,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch session details" });
    }
  });

  // Update Roundtable session
  app.patch("/api/roundtable/sessions/:id", requireAuth, rateLimit(30, 60 * 1000), async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Validate input
      const updateSchema = z.object({
        objective: z.string().max(1000).optional(),
        status: z.enum(['active', 'completed', 'cancelled']).optional(),
      });
      
      const validation = updateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid input", details: validation.error.errors });
      }

      const session = await storage.getRoundtableSession(req.params.id);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updates = req.body;
      const updated = await storage.updateRoundtableSession(req.params.id, updates);
      
      await logActivity(req.userId, req.user!.organizationId!, "update", "roundtable_session", req.params.id, updates, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  // Delete Roundtable session
  app.delete("/api/roundtable/sessions/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const session = await storage.getRoundtableSession(req.params.id);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteRoundtableSession(req.params.id);
      await logActivity(req.userId, req.user!.organizationId!, "delete", "roundtable_session", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  // Add agent to session
  app.post("/api/roundtable/sessions/:id/participants", requireAuth, rateLimit(15, 60 * 1000), async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Validate agent slug with whitelist
      const participantSchema = z.object({
        agentSlug: z.enum(['luca', 'cadence', 'forma', 'parity', 'email', 'messages']),
      });
      
      const validation = participantSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid agent slug", details: validation.error.errors });
      }

      const { agentSlug } = validation.data;

      const session = await storage.getRoundtableSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { RoundtableOrchestrator } = await import('./roundtable-orchestrator');
      const orchestrator = new RoundtableOrchestrator(storage);
      const participant = await orchestrator.addAgentToSession(req.params.id, agentSlug, req.userId!);

      await logActivity(req.userId, req.user!.organizationId!, "add_agent", "roundtable_session", req.params.id, { agentSlug }, req);
      res.json(participant);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to add agent" });
    }
  });

  // Remove agent from session
  app.delete("/api/roundtable/sessions/:id/participants/:participantId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const session = await storage.getRoundtableSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { RoundtableOrchestrator } = await import('./roundtable-orchestrator');
      const orchestrator = new RoundtableOrchestrator(storage);
      await orchestrator.removeAgentFromSession(req.params.id, req.params.participantId);

      await logActivity(req.userId, req.user!.organizationId!, "remove_agent", "roundtable_session", req.params.id, { participantId: req.params.participantId }, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to remove agent" });
    }
  });

  // Get deliverables for session
  app.get("/api/roundtable/sessions/:id/deliverables", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const session = await storage.getRoundtableSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const deliverables = await storage.getRoundtableDeliverablesBySession(req.params.id);
      res.json(deliverables);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch deliverables" });
    }
  });

  // Approve deliverable
  app.post("/api/roundtable/deliverables/:id/approve", requireAuth, rateLimit(20, 60 * 1000), async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Validate input with Zod schema
      const approvalSchema = z.object({
        feedback: z.string().max(5000).optional().nullable(),
      });
      
      const validation = approvalSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid input", details: validation.error.errors });
      }

      const { feedback } = validation.data;
      
      const deliverable = await storage.getRoundtableDeliverable(req.params.id);
      if (!deliverable) {
        return res.status(404).json({ error: "Deliverable not found" });
      }

      // Get session to verify access
      const session = await storage.getRoundtableSession(deliverable.sessionId);
      if (!session || session.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Create approval record
      const approval = await storage.createRoundtableApproval({
        deliverableId: req.params.id,
        sessionId: deliverable.sessionId,
        userId: req.userId!,
        decision: 'approved',
        feedback: feedback || null,
        savedToTemplateId: null,
        autoSaved: false,
      });

      // Update deliverable status
      await storage.updateRoundtableDeliverable(req.params.id, {
        status: 'approved',
      });

      // Use orchestrator to handle auto-save logic
      const { RoundtableOrchestrator } = await import('./roundtable-orchestrator');
      const orchestrator = new RoundtableOrchestrator(storage);
      await orchestrator.approveDeliverable(req.params.id, req.userId!, feedback);

      await logActivity(req.userId, req.user!.organizationId!, "approve", "roundtable_deliverable", req.params.id, { feedback }, req);
      res.json({ approval, deliverable: await storage.getRoundtableDeliverable(req.params.id) });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to approve deliverable" });
    }
  });

  // Reject deliverable
  app.post("/api/roundtable/deliverables/:id/reject", requireAuth, rateLimit(20, 60 * 1000), async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Validate input with Zod schema
      const rejectionSchema = z.object({
        feedback: z.string().min(1).max(5000),
      });
      
      const validation = rejectionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid input. Feedback is required for rejections.", details: validation.error.errors });
      }

      const { feedback } = validation.data;
      
      const deliverable = await storage.getRoundtableDeliverable(req.params.id);
      if (!deliverable) {
        return res.status(404).json({ error: "Deliverable not found" });
      }

      // Get session to verify access
      const session = await storage.getRoundtableSession(deliverable.sessionId);
      if (!session || session.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Create rejection record
      const approval = await storage.createRoundtableApproval({
        deliverableId: req.params.id,
        sessionId: deliverable.sessionId,
        userId: req.userId!,
        decision: 'rejected',
        feedback: feedback || 'Deliverable rejected',
        savedToTemplateId: null,
        autoSaved: false,
      });

      // Update deliverable status
      await storage.updateRoundtableDeliverable(req.params.id, {
        status: 'rejected',
      });

      await logActivity(req.userId, req.user!.organizationId!, "reject", "roundtable_deliverable", req.params.id, { feedback }, req);
      res.json({ approval, deliverable: await storage.getRoundtableDeliverable(req.params.id) });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to reject deliverable" });
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

      // Fetch assignment-specific workflow structure with stages, steps, and tasks
      const stages = await storage.getAssignmentStagesByAssignment(assignment.id);
      const stagesWithStepsAndTasks = await Promise.all(
        stages.map(async (stage) => {
          const steps = await storage.getAssignmentStepsByStage(stage.id);
          const stepsWithTasks = await Promise.all(
            steps.map(async (step) => {
              const tasks = await storage.getAssignmentTasksByStep(step.id);
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

      // Clone workflow structure to assignment
      await storage.cloneWorkflowToAssignment(assignment.id, validated.workflowId, req.user!.organizationId!);

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

  // ==================== Recurring Schedules Routes ====================

  app.get("/api/recurring-schedules", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      const schedules = await db
        .select()
        .from(schema.recurringSchedules)
        .where(eq(schema.recurringSchedules.organizationId, req.user!.organizationId!))
        .orderBy(schema.recurringSchedules.nextRunAt);
      res.json(schedules);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch recurring schedules" });
    }
  });

  app.get("/api/recurring-schedules/:id", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      const schedule = await db
        .select()
        .from(schema.recurringSchedules)
        .where(
          and(
            eq(schema.recurringSchedules.id, req.params.id),
            eq(schema.recurringSchedules.organizationId, req.user!.organizationId!)
          )
        )
        .limit(1);

      if (schedule.length === 0) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      res.json(schedule[0]);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch schedule" });
    }
  });

  app.post("/api/recurring-schedules", requireAuth, requirePermission("workflows.create"), async (req: AuthRequest, res: Response) => {
    try {
      const { workflowId, name, description, frequency, interval, dayOfWeek, dayOfMonth, monthOfYear, timeOfDay, startDate, endDate, assignmentTemplate } = req.body;

      const workflow = await storage.getWorkflow(workflowId);
      if (!workflow || workflow.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      const { getRecurringSchedulerService } = await import("./services/recurringSchedulerService");
      const scheduler = getRecurringSchedulerService();
      
      const now = new Date();
      const firstRun = startDate ? new Date(startDate) : now;
      
      const nextRunAt = scheduler['calculateNextRun'](
        firstRun < now ? now : firstRun,
        frequency,
        interval || 1,
        dayOfWeek || null,
        dayOfMonth || null,
        monthOfYear || null,
        timeOfDay || null
      );

      const inserted = await db.insert(schema.recurringSchedules).values({
        organizationId: req.user!.organizationId!,
        workflowId,
        name,
        description,
        frequency,
        interval: interval || 1,
        dayOfWeek,
        dayOfMonth,
        monthOfYear,
        timeOfDay,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        assignmentTemplate: assignmentTemplate || {},
        nextRunAt,
        createdBy: req.userId!,
      }).returning();

      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "recurring_schedule", inserted[0].id, { name, workflow: workflow.name }, req);
      res.json(inserted[0]);
    } catch (error: any) {
      console.error("Failed to create recurring schedule:", error);
      res.status(500).json({ error: "Failed to create recurring schedule" });
    }
  });

  app.patch("/api/recurring-schedules/:id", requireAuth, requirePermission("workflows.edit"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await db
        .select()
        .from(schema.recurringSchedules)
        .where(
          and(
            eq(schema.recurringSchedules.id, req.params.id),
            eq(schema.recurringSchedules.organizationId, req.user!.organizationId!)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      const updated = await db
        .update(schema.recurringSchedules)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(schema.recurringSchedules.id, req.params.id))
        .returning();

      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "recurring_schedule", req.params.id, {}, req);
      res.json(updated[0]);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update recurring schedule" });
    }
  });

  app.delete("/api/recurring-schedules/:id", requireAuth, requirePermission("workflows.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await db
        .select()
        .from(schema.recurringSchedules)
        .where(
          and(
            eq(schema.recurringSchedules.id, req.params.id),
            eq(schema.recurringSchedules.organizationId, req.user!.organizationId!)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      await db.delete(schema.recurringSchedules).where(eq(schema.recurringSchedules.id, req.params.id));
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "recurring_schedule", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete recurring schedule" });
    }
  });

  app.post("/api/recurring-schedules/:id/trigger", requireAuth, requirePermission("workflows.create"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await db
        .select()
        .from(schema.recurringSchedules)
        .where(
          and(
            eq(schema.recurringSchedules.id, req.params.id),
            eq(schema.recurringSchedules.organizationId, req.user!.organizationId!)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: "Schedule not found" });
      }

      const { getRecurringSchedulerService } = await import("./services/recurringSchedulerService");
      const scheduler = getRecurringSchedulerService();
      
      await scheduler.manualTrigger(req.params.id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "trigger", "recurring_schedule", req.params.id, {}, req);
      
      res.json({ success: true, message: "Schedule triggered successfully" });
    } catch (error: any) {
      console.error("Failed to trigger recurring schedule:", error);
      res.status(500).json({ error: error.message || "Failed to trigger recurring schedule" });
    }
  });

  // ==================== Client Portal Task Routes ====================

  // Get all tasks for a client
  app.get("/api/client-portal-tasks/client/:clientId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const tasks = await storage.getClientPortalTasksByClient(
        req.params.clientId,
        req.user!.organizationId!
      );
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch client tasks" });
    }
  });

  // Get all tasks for an assignment
  app.get("/api/client-portal-tasks/assignment/:assignmentId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const tasks = await storage.getClientPortalTasksByAssignment(
        req.params.assignmentId,
        req.user!.organizationId!
      );
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch assignment tasks" });
    }
  });

  // Get all tasks assigned to a contact
  app.get("/api/client-portal-tasks/contact/:contactId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const tasks = await storage.getClientPortalTasksByContact(
        req.params.contactId,
        req.user!.organizationId!
      );
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch contact tasks" });
    }
  });

  // Get single task
  app.get("/api/client-portal-tasks/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const task = await storage.getClientPortalTask(req.params.id, req.user!.organizationId!);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  // Create task from workflow task
  app.post("/api/client-portal-tasks/from-workflow-task", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { assignmentTaskId } = req.body;
      if (!assignmentTaskId) {
        return res.status(400).json({ error: "assignmentTaskId is required" });
      }

      const task = await storage.createTaskFromWorkflowTask(
        assignmentTaskId,
        req.user!.organizationId!,
        req.userId!
      );

      if (!task) {
        return res.status(400).json({ error: "Task not created - workflow task may not be assigned to client" });
      }

      await logActivity(req.userId, req.user!.organizationId, "create", "client_portal_task", task.id, { source: "workflow_task" }, req);
      res.json(task);
    } catch (error: any) {
      console.error("Failed to create task from workflow task:", error);
      res.status(500).json({ error: "Failed to create task from workflow task" });
    }
  });

  // Create task from message
  app.post("/api/client-portal-tasks/from-message", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { conversationId, messageId, title, description, clientId, assignedTo, dueDate } = req.body;
      
      if (!conversationId || !messageId || !title || !clientId) {
        return res.status(400).json({ error: "conversationId, messageId, title, and clientId are required" });
      }

      const task = await storage.createTaskFromMessage(
        conversationId,
        messageId,
        title,
        description || "",
        req.user!.organizationId!,
        clientId,
        assignedTo,
        req.userId!,
        dueDate ? new Date(dueDate) : undefined
      );

      await logActivity(req.userId, req.user!.organizationId, "create", "client_portal_task", task.id, { source: "message" }, req);
      res.json(task);
    } catch (error: any) {
      console.error("Failed to create task from message:", error);
      res.status(500).json({ error: "Failed to create task from message" });
    }
  });

  // Create task from form request
  app.post("/api/client-portal-tasks/from-form-request", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { formTemplateId, title, description, clientId, assignmentId, assignedTo, dueDate } = req.body;
      
      if (!formTemplateId || !title || !clientId) {
        return res.status(400).json({ error: "formTemplateId, title, and clientId are required" });
      }

      const task = await storage.createTaskFromFormRequest(
        formTemplateId,
        title,
        description || "",
        req.user!.organizationId!,
        clientId,
        assignmentId,
        assignedTo,
        req.userId!,
        dueDate ? new Date(dueDate) : undefined
      );

      await logActivity(req.userId, req.user!.organizationId, "create", "client_portal_task", task.id, { source: "form_request" }, req);
      res.json(task);
    } catch (error: any) {
      console.error("Failed to create task from form request:", error);
      res.status(500).json({ error: "Failed to create task from form request" });
    }
  });

  // Update task status
  app.patch("/api/client-portal-tasks/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getClientPortalTask(req.params.id, req.user!.organizationId!);
      if (!existing) {
        return res.status(404).json({ error: "Task not found" });
      }

      const updates: Partial<schema.InsertClientPortalTask> = {};
      
      if (req.body.status) {
        updates.status = req.body.status;
        if (req.body.status === 'in_progress' && !existing.startedAt) {
          updates.startedAt = new Date();
        } else if (req.body.status === 'completed' && !existing.completedAt) {
          updates.completedAt = new Date();
          updates.completedBy = req.userId!;
        }
      }

      if (req.body.priority) updates.priority = req.body.priority;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      if (req.body.metadata) updates.metadata = req.body.metadata;

      const task = await storage.updateClientPortalTask(req.params.id, updates);
      await logActivity(req.userId, req.user!.organizationId, "update", "client_portal_task", req.params.id, updates, req);
      res.json(task);
    } catch (error: any) {
      console.error("Failed to update task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // Delete task
  app.delete("/api/client-portal-tasks/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getClientPortalTask(req.params.id, req.user!.organizationId!);
      if (!existing) {
        return res.status(404).json({ error: "Task not found" });
      }

      await storage.deleteClientPortalTask(req.params.id);
      await logActivity(req.userId, req.user!.organizationId, "delete", "client_portal_task", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete task" });
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
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Check if user is trying to delete a global document
      if (document.organizationId === null) {
        // Only admins can delete global documents
        const user = await storage.getUser(req.user!.id);
        const isAdmin = user?.role?.name === "Admin" || user?.role?.name === "Super Admin";
        
        if (!isAdmin) {
          return res.status(403).json({ error: "Only admins can delete global documents" });
        }
      } else if (document.organizationId !== req.user!.organizationId) {
        // Users can only delete documents from their own organization
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Delete physical file
      const filePath = path.join(process.cwd(), document.url.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
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
        scope: req.user!.organizationId ? 'organization' : 'global', // Super admin creates global templates
        organizationId: req.user!.organizationId || null, // Allow null for super admin
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

  // ==================== Document Versions Routes ====================
  
  // Create a new version of a document
  app.post("/api/documents/:id/versions", requireAuth, requirePermission("documents.upload"), upload.single('file'), async (req: AuthRequest, res: Response) => {
    try {
      const { id: documentId } = req.params;
      const { changeDescription, changeType } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      // Calculate hash of uploaded file
      const crypto = await import('crypto');
      const documentHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      
      // Optional: Calculate digital signature (if PKI service available)
      let digitalSignature: string | undefined;
      try {
        const cryptoUtils = await import('./crypto-utils');
        digitalSignature = await cryptoUtils.signDocumentHash(documentHash, req.user!.organizationId!);
      } catch (error) {
        // PKI not available, continue without signature
        console.warn("Digital signature not available:", error);
      }
      
      // Save file
      const filename = `${Date.now()}-${req.file.originalname}`;
      const filepath = path.join(process.cwd(), 'uploads', filename);
      fs.writeFileSync(filepath, req.file.buffer);
      
      // Create version
      const version = await DocumentVersionsService.createVersion(
        documentId,
        req.user!.organizationId!,
        {
          name: req.file.originalname,
          type: req.file.mimetype,
          size: req.file.size,
          url: `/uploads/${filename}`,
          uploadedBy: req.userId!,
          documentHash,
          digitalSignature,
          changeDescription,
          changeType: changeType || 'minor',
        }
      );
      
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "document_version", version.id, { documentId, versionNumber: version.versionNumber }, req);
      res.json(version);
    } catch (error: any) {
      console.error("Failed to create document version:", error);
      res.status(500).json({ error: error.message || "Failed to create document version" });
    }
  });
  
  // Get version history for a document
  app.get("/api/documents/:id/versions", requireAuth, requirePermission("documents.view"), async (req: AuthRequest, res: Response) => {
    try {
      const { id: documentId } = req.params;
      const versions = await DocumentVersionsService.getVersionHistory(documentId, req.user!.organizationId!);
      res.json(versions);
    } catch (error: any) {
      console.error("Failed to get version history:", error);
      res.status(500).json({ error: error.message || "Failed to get version history" });
    }
  });
  
  // Get a specific version
  app.get("/api/document-versions/:versionId", requireAuth, requirePermission("documents.view"), async (req: AuthRequest, res: Response) => {
    try {
      const { versionId } = req.params;
      const version = await DocumentVersionsService.getVersion(versionId, req.user!.organizationId!);
      res.json(version);
    } catch (error: any) {
      console.error("Failed to get version:", error);
      res.status(500).json({ error: error.message || "Failed to get version" });
    }
  });
  
  // Rollback to a previous version
  app.post("/api/documents/:id/versions/:versionNumber/rollback", requireAuth, requirePermission("documents.upload"), async (req: AuthRequest, res: Response) => {
    try {
      const { id: documentId, versionNumber } = req.params;
      const version = await DocumentVersionsService.rollbackToVersion(
        documentId,
        parseInt(versionNumber),
        req.user!.organizationId!,
        req.userId!
      );
      
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "document", documentId, { action: "rollback", targetVersion: versionNumber }, req);
      res.json(version);
    } catch (error: any) {
      console.error("Failed to rollback version:", error);
      res.status(500).json({ error: error.message || "Failed to rollback version" });
    }
  });
  
  // Approve a version (compliance workflow)
  app.post("/api/document-versions/:versionId/approve", requireAuth, requirePermission("documents.upload"), async (req: AuthRequest, res: Response) => {
    try {
      const { versionId } = req.params;
      const version = await DocumentVersionsService.approveVersion(
        versionId,
        req.user!.organizationId!,
        req.userId!
      );
      
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "document_version", versionId, { action: "approve" }, req);
      res.json(version);
    } catch (error: any) {
      console.error("Failed to approve version:", error);
      res.status(500).json({ error: error.message || "Failed to approve version" });
    }
  });
  
  // Reject a version (compliance workflow)
  app.post("/api/document-versions/:versionId/reject", requireAuth, requirePermission("documents.upload"), async (req: AuthRequest, res: Response) => {
    try {
      const { versionId } = req.params;
      const { rejectionReason } = req.body;
      
      if (!rejectionReason) {
        return res.status(400).json({ error: "Rejection reason is required" });
      }
      
      const version = await DocumentVersionsService.rejectVersion(
        versionId,
        req.user!.organizationId!,
        req.userId!,
        rejectionReason
      );
      
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "document_version", versionId, { action: "reject", reason: rejectionReason }, req);
      res.json(version);
    } catch (error: any) {
      console.error("Failed to reject version:", error);
      res.status(500).json({ error: error.message || "Failed to reject version" });
    }
  });
  
  // Compare two versions
  app.get("/api/documents/:id/versions/:version1/compare/:version2", requireAuth, requirePermission("documents.view"), async (req: AuthRequest, res: Response) => {
    try {
      const { id: documentId, version1, version2 } = req.params;
      const comparison = await DocumentVersionsService.compareVersions(
        documentId,
        parseInt(version1),
        parseInt(version2),
        req.user!.organizationId!
      );
      res.json(comparison);
    } catch (error: any) {
      console.error("Failed to compare versions:", error);
      res.status(500).json({ error: error.message || "Failed to compare versions" });
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
      console.error("❌ Failed to delete client:", error);
      console.error("  Client ID:", req.params.id);
      console.error("  Error message:", error.message);
      console.error("  Error code:", error.code);
      res.status(500).json({ error: error.message || "Failed to delete client" });
    }
  });

  // ==================== Tag Management Routes ====================

  // Apply tags to a client
  app.post("/api/clients/:id/tags", requireAuth, requirePermission("clients.edit"), async (req: AuthRequest, res: Response) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client || client.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Client not found" });
      }

      const { tags } = req.body;
      if (!Array.isArray(tags) || tags.length === 0) {
        return res.status(400).json({ error: "tags must be a non-empty array" });
      }

      const existingTags = client.tags || [];
      const newTags = [...new Set([...existingTags, ...tags])];
      
      const updated = await storage.updateClient(req.params.id, { tags: newTags });
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "client", req.params.id, { action: "add_tags", tags }, req);
      
      res.json({ ...updated, tagsAdded: tags.filter(t => !existingTags.includes(t)) });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to add tags to client" });
    }
  });

  // Remove tags from a client
  app.delete("/api/clients/:id/tags", requireAuth, requirePermission("clients.edit"), async (req: AuthRequest, res: Response) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client || client.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Client not found" });
      }

      const { tags, clearAll } = req.body;
      
      if (!clearAll && (!Array.isArray(tags) || tags.length === 0)) {
        return res.status(400).json({ error: "tags must be a non-empty array or clearAll must be true" });
      }

      const existingTags = client.tags || [];
      const newTags = clearAll ? [] : existingTags.filter((tag: string) => !tags.includes(tag));
      
      const updated = await storage.updateClient(req.params.id, { tags: newTags });
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "client", req.params.id, { action: "remove_tags", tags: clearAll ? existingTags : tags }, req);
      
      res.json({ ...updated, tagsRemoved: clearAll ? existingTags : tags });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to remove tags from client" });
    }
  });

  // Apply tags to organization
  app.post("/api/organization/tags", requireAuth, requirePermission("organization.edit"), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const organization = await storage.getOrganization(req.user!.organizationId);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const { tags } = req.body;
      if (!Array.isArray(tags) || tags.length === 0) {
        return res.status(400).json({ error: "tags must be a non-empty array" });
      }

      const existingTags = organization.tags || [];
      const newTags = [...new Set([...existingTags, ...tags])];
      
      const updated = await storage.updateOrganization(req.user!.organizationId, { tags: newTags });
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "organization", req.user!.organizationId, { action: "add_tags", tags }, req);
      
      res.json({ ...updated, tagsAdded: tags.filter(t => !existingTags.includes(t)) });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to add tags to organization" });
    }
  });

  // Remove tags from organization
  app.delete("/api/organization/tags", requireAuth, requirePermission("organization.edit"), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const organization = await storage.getOrganization(req.user!.organizationId);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const { tags, clearAll } = req.body;
      
      if (!clearAll && (!Array.isArray(tags) || tags.length === 0)) {
        return res.status(400).json({ error: "tags must be a non-empty array or clearAll must be true" });
      }

      const existingTags = organization.tags || [];
      const newTags = clearAll ? [] : existingTags.filter((tag: string) => !tags.includes(tag));
      
      const updated = await storage.updateOrganization(req.user!.organizationId, { tags: newTags });
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "organization", req.user!.organizationId, { action: "remove_tags", tags: clearAll ? existingTags : tags }, req);
      
      res.json({ ...updated, tagsRemoved: clearAll ? existingTags : tags });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to remove tags from organization" });
    }
  });

  // Get all unique tags used in organization (for autocomplete)
  app.get("/api/tags/all", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const clients = await storage.getClientsByOrganization(req.user!.organizationId!);
      const organization = await storage.getOrganization(req.user!.organizationId!);
      
      const allTags = new Set<string>();
      
      clients.forEach(client => {
        (client.tags || []).forEach((tag: string) => allTags.add(tag));
      });
      
      (organization?.tags || []).forEach((tag: string) => allTags.add(tag));
      
      res.json(Array.from(allTags).sort());
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch tags" });
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

  // ==================== Team Management Routes ====================

  // Teams CRUD
  app.get("/api/teams", requireAuth, requirePermission("teams.view"), async (req: AuthRequest, res: Response) => {
    try {
      const teams = await storage.getTeamsByOrganization(req.user!.organizationId!);
      res.json(teams);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  app.post("/api/teams", requireAuth, requirePermission("teams.create"), async (req: AuthRequest, res: Response) => {
    try {
      const validated = schema.insertTeamSchema.parse(req.body);
      const team = await storage.createTeam({
        ...validated,
        organizationId: req.user!.organizationId!,
      });
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "team", team.id, { name: team.name }, req);
      res.json(team);
    } catch (error: any) {
      console.error("Failed to create team:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      res.status(500).json({ error: "Failed to create team" });
    }
  });

  app.get("/api/teams/:id", requireAuth, requirePermission("teams.view"), async (req: AuthRequest, res: Response) => {
    try {
      const team = await storage.getTeamById(req.params.id);
      if (!team || team.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Team not found" });
      }
      res.json(team);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch team" });
    }
  });

  app.patch("/api/teams/:id", requireAuth, requirePermission("teams.update"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getTeamById(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      const validated = schema.insertTeamSchema.partial().parse(req.body);
      const { organizationId, ...safeData } = validated as any;
      
      const team = await storage.updateTeam(req.params.id, safeData);
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "team", req.params.id, {}, req);
      res.json(team);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update team" });
    }
  });

  app.delete("/api/teams/:id", requireAuth, requirePermission("teams.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getTeamById(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      await storage.deleteTeam(req.params.id);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "team", req.params.id, {}, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete team" });
    }
  });

  // Team Members
  app.get("/api/teams/:id/members", requireAuth, requirePermission("teams.view"), async (req: AuthRequest, res: Response) => {
    try {
      const team = await storage.getTeamById(req.params.id);
      if (!team || team.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      const members = await storage.getTeamMembers(req.params.id);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  app.post("/api/teams/:id/members", requireAuth, requirePermission("teams.update"), async (req: AuthRequest, res: Response) => {
    try {
      const team = await storage.getTeamById(req.params.id);
      if (!team || team.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      const { userId, role } = req.body;
      if (!userId || !role) {
        return res.status(400).json({ error: "userId and role are required" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || user.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const member = await storage.addTeamMember({
        teamId: req.params.id,
        userId,
        role,
      });
      
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "team_member", member.id, { team: team.name, user: `${user.firstName} ${user.lastName}` }, req);
      res.json(member);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to add team member" });
    }
  });

  app.delete("/api/teams/:teamId/members/:userId", requireAuth, requirePermission("teams.update"), async (req: AuthRequest, res: Response) => {
    try {
      const team = await storage.getTeamById(req.params.teamId);
      if (!team || team.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      await storage.removeTeamMember(req.params.teamId, req.params.userId);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "team_member", "", { teamId: req.params.teamId, userId: req.params.userId }, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to remove team member" });
    }
  });

  app.patch("/api/teams/:teamId/members/:userId/role", requireAuth, requirePermission("teams.update"), async (req: AuthRequest, res: Response) => {
    try {
      const team = await storage.getTeamById(req.params.teamId);
      if (!team || team.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      const { role } = req.body;
      if (!role) {
        return res.status(400).json({ error: "role is required" });
      }
      
      await storage.updateTeamMemberRole(req.params.teamId, req.params.userId, role);
      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "team_member", "", { teamId: req.params.teamId, userId: req.params.userId, role }, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update team member role" });
    }
  });

  // Supervision Hierarchy
  app.post("/api/supervision", requireAuth, requirePermission("teams.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { supervisorId, reporteeId, level } = req.body;
      
      if (!supervisorId || !reporteeId) {
        return res.status(400).json({ error: "supervisorId and reporteeId are required" });
      }
      
      if (supervisorId === reporteeId) {
        return res.status(400).json({ error: "A user cannot supervise themselves" });
      }
      
      const supervisor = await storage.getUser(supervisorId);
      const reportee = await storage.getUser(reporteeId);
      
      if (!supervisor || supervisor.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Supervisor not found" });
      }
      
      if (!reportee || reportee.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Reportee not found" });
      }
      
      // Check if relationship already exists
      const existingRelationships = await db.select()
        .from(schema.supervisorRelationships)
        .where(and(
          eq(schema.supervisorRelationships.supervisorId, supervisorId),
          eq(schema.supervisorRelationships.reporteeId, reporteeId)
        ))
        .limit(1);
      
      if (existingRelationships.length > 0) {
        return res.status(409).json({ error: "Supervision relationship already exists" });
      }
      
      const relationship = await storage.createSupervisorRelationship({
        organizationId: req.user!.organizationId!,
        supervisorId,
        reporteeId,
        level: level || 1,
      });
      
      await logActivity(req.userId, req.user!.organizationId || undefined, "create", "supervision", relationship.id, { supervisor: `${supervisor.firstName} ${supervisor.lastName}`, reportee: `${reportee.firstName} ${reportee.lastName}` }, req);
      res.json(relationship);
    } catch (error: any) {
      console.error("Failed to create supervision relationship:", error);
      res.status(500).json({ error: "Failed to create supervision relationship" });
    }
  });

  app.delete("/api/supervision/:supervisorId/:reporteeId", requireAuth, requirePermission("teams.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const supervisor = await storage.getUser(req.params.supervisorId);
      const reportee = await storage.getUser(req.params.reporteeId);
      
      if (!supervisor || supervisor.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Supervisor not found" });
      }
      
      if (!reportee || reportee.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Reportee not found" });
      }
      
      await storage.deleteSupervisorRelationship(req.params.supervisorId, req.params.reporteeId);
      await logActivity(req.userId, req.user!.organizationId || undefined, "delete", "supervision", "", { supervisorId: req.params.supervisorId, reporteeId: req.params.reporteeId }, req);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete supervision relationship" });
    }
  });

  app.get("/api/users/:id/reportees", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user || user.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const reportees = await storage.getReportees(req.params.id);
      res.json(reportees);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch reportees" });
    }
  });

  app.get("/api/users/:id/supervisors", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user || user.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const supervisors = await storage.getSupervisors(req.params.id);
      res.json(supervisors);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch supervisors" });
    }
  });

  // Team Chat Routes
  app.get("/api/teams/:teamId/messages", requireAuth, requirePermission("teams.view"), async (req: AuthRequest, res: Response) => {
    try {
      const team = await storage.getTeamById(req.params.teamId);
      if (!team || team.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      // Verify user is a team member
      const members = await storage.getTeamMembers(req.params.teamId);
      const isMember = members.some(m => m.userId === req.userId);
      if (!isMember) {
        return res.status(403).json({ error: "You are not a member of this team" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const messages = await storage.getTeamChatMessages(req.params.teamId, limit);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch team chat messages" });
    }
  });

  // ==================== Unified Inbox Routes ====================
  
  // Get all conversations across email, team chat, and live chat
  app.get("/api/unified-inbox/conversations", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(400).json({ error: "Organization ID required" });
      }

      const filters = {
        type: req.query.type as string | undefined,
        search: req.query.search as string | undefined,
        unreadOnly: req.query.unreadOnly === 'true',
        starredOnly: req.query.starredOnly === 'true',
      };

      const conversations = await unifiedInboxService.getConversations(
        req.user!.organizationId,
        filters
      );

      res.json(conversations);
    } catch (error: any) {
      console.error("Failed to fetch unified inbox conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get messages for a specific conversation
  app.get("/api/unified-inbox/conversations/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { type } = req.query;
      if (!type || !['email', 'team_chat', 'live_chat'].includes(type as string)) {
        return res.status(400).json({ error: "Valid conversation type required" });
      }

      const messages = await unifiedInboxService.getMessages(
        req.params.id,
        type as 'email' | 'team_chat' | 'live_chat'
      );

      res.json(messages);
    } catch (error: any) {
      console.error("Failed to fetch conversation messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Mark conversation as read
  app.patch("/api/unified-inbox/conversations/:id/read", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { type } = req.body;
      if (!type || !['email', 'live_chat'].includes(type)) {
        return res.status(400).json({ error: "Valid conversation type required (email or live_chat)" });
      }

      await unifiedInboxService.markAsRead(req.params.id, type);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to mark conversation as read:", error);
      res.status(500).json({ error: "Failed to mark as read" });
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
      const llmConfigService = getLLMConfigService();
      const llmConfig = await llmConfigService.getDefaultConfig(req.user!.organizationId!);

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

1. **Ask MANDATORY qualifying questions** in this order (one at a time):
   a) "Is this client an individual or a business entity?"
   b) "Which country does the client operate in?"
   c) **MANDATORY FOR BUSINESSES**: "Is the business registered for VAT/GST/sales tax?" (adapt based on country)
      - India: "Is the business GST registered?"
      - UK/EU: "Is the business VAT registered?"
      - USA: "Does the business have an EIN?"
      - Always ask this question for businesses - NEVER skip it
   d) "What industry is the business in?" (optional, for context)
   e) For applicable countries: "Which state/province is the business located in?"

   **CRITICAL**: You MUST ask about registration status before providing field requirements. This determines which tax IDs to collect.

2. **Provide guidance** on what information will be needed:
   - Explain which tax IDs are required for their country/type
   - Describe the format and purpose of each tax ID
   - Guide them through the requirements
   - **For UNREGISTERED businesses**: Explain they need fewer tax IDs
   
   Examples:
   - "For a GST-registered business in India, you'll need PAN and GSTIN. For unregistered businesses, only PAN is required."
   - "For a VAT-registered business in UK, you'll need UTR and VAT number. For unregistered businesses, only UTR is required."
   - "For a business in USA, you'll need an EIN (Employer Identification Number)."

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
     "phoneCode": {
       "code": "+91", // Country calling code
       "placeholder": "9876543210",
       "pattern": "^[0-9]{10}$", // Pattern for phone number (after country code)
       "format": "10 digit mobile number",
       "rules": ["Must be 10 digits", "No leading zero"]
     },
     "postalCode": {
       "label": "PIN Code", // "ZIP Code", "Postal Code", "PIN Code", etc.
       "placeholder": "110001",
       "pattern": "^[0-9]{6}$",
       "format": "6 digits",
       "rules": ["Must be exactly 6 digits"]
     },
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
   
   **Example for India Business (GST Registered):**
   \`METADATA: {"country": "India", "clientType": "business", "gstRegistered": true, "requiredFields": ["pan", "gstin"], "phoneCode": {"code": "+91", "placeholder": "9876543210", "pattern": "^[6-9][0-9]{9}$", "format": "10 digit mobile number", "rules": ["Must be 10 digits", "Must start with 6, 7, 8, or 9"]}, "postalCode": {"label": "PIN Code", "placeholder": "110001", "pattern": "^[0-9]{6}$", "format": "6 digits", "rules": ["Must be exactly 6 digits"]}, "validations": {"pan": {"placeholder": "AAAPL1234C", "format": "10 alphanumeric characters", "pattern": "^[A-Z]{5}[0-9]{4}[A-Z]{1}$", "length": 10, "rules": ["First 5 characters: Alphabetic uppercase", "Next 4 digits: Numeric", "4th character must be 'C' for company (or 'P' for individual)", "5th character matches first letter of entity name", "Last character: Alphabetic check digit"]}, "gstin": {"placeholder": "27AAAPL1234C1Z5", "format": "15 characters", "pattern": "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", "length": 15, "rules": ["First 2 digits: State code (e.g., 27 for Maharashtra)", "Characters 3-12: Must match the PAN number exactly", "13th character: Entity number (1-9, A-Z)", "14th character: Always 'Z'", "15th character: Check digit"], "crossFieldValidation": {"contains": "pan", "expectedPrefix": "27", "derivedFrom": "state", "message": "GSTIN must contain the PAN and start with state code (e.g., 27 for Maharashtra)"}}}}\`
   
   **Example for India Business (NOT GST Registered - Unregistered):**
   \`METADATA: {"country": "India", "clientType": "business", "gstRegistered": false, "requiredFields": ["pan"], "phoneCode": {"code": "+91", "placeholder": "9876543210", "pattern": "^[6-9][0-9]{9}$", "format": "10 digit mobile number", "rules": ["Must be 10 digits", "Must start with 6, 7, 8, or 9"]}, "postalCode": {"label": "PIN Code", "placeholder": "110001", "pattern": "^[0-9]{6}$", "format": "6 digits", "rules": ["Must be exactly 6 digits"]}, "validations": {"pan": {"placeholder": "AAAPL1234C", "format": "10 alphanumeric characters", "pattern": "^[A-Z]{5}[0-9]{4}[A-Z]{1}$", "length": 10, "rules": ["First 5 characters: Alphabetic uppercase", "Next 4 digits: Numeric", "4th character must be 'C' for company", "Last character: Alphabetic check digit"]}}}\`
   
   **IMPORTANT**: When user provides their state/address, calculate the state code and include \`expectedPrefix\` in the validation. For India states:
   - Maharashtra = 27, Gujarat = 24, Karnataka = 29, Tamil Nadu = 33, Delhi = 07, etc.
   - Include the calculated prefix in the validation metadata so the system can enforce it
   
   **Example for USA Business (with EIN):**
   \`METADATA: {"country": "USA", "clientType": "business", "requiredFields": ["ein"], "phoneCode": {"code": "+1", "placeholder": "2025551234", "pattern": "^[2-9][0-9]{9}$", "format": "10 digit number", "rules": ["Must be 10 digits", "Area code cannot start with 0 or 1"]}, "postalCode": {"label": "ZIP Code", "placeholder": "12345", "pattern": "^[0-9]{5}(-[0-9]{4})?$", "format": "5 digits or 5+4 format", "rules": ["Must be 5 digits", "Optional: dash and 4 more digits (ZIP+4)"]}, "validations": {"ein": {"placeholder": "12-3456789", "format": "9 digits in XX-XXXXXXX format", "pattern": "^[0-9]{2}-[0-9]{7}$", "length": 10, "rules": ["2 digits, hyphen, 7 digits", "Format: XX-XXXXXXX"]}}}\`
   
   **Example for USA Individual (SSN only - no business registration):**
   \`METADATA: {"country": "USA", "clientType": "individual", "requiredFields": ["ssn"], "phoneCode": {"code": "+1", "placeholder": "2025551234", "pattern": "^[2-9][0-9]{9}$", "format": "10 digit number", "rules": ["Must be 10 digits", "Area code cannot start with 0 or 1"]}, "postalCode": {"label": "ZIP Code", "placeholder": "12345", "pattern": "^[0-9]{5}(-[0-9]{4})?$", "format": "5 digits or 5+4 format", "rules": ["Must be 5 digits", "Optional: dash and 4 more digits (ZIP+4)"]}, "validations": {"ssn": {"placeholder": "123-45-6789", "format": "9 digits in XXX-XX-XXXX format", "pattern": "^[0-9]{3}-[0-9]{2}-[0-9]{4}$", "length": 11, "rules": ["3 digits, hyphen, 2 digits, hyphen, 4 digits", "Format: XXX-XX-XXXX"]}}}\`
   
   **Example for UK Business (VAT Registered):**
   \`METADATA: {"country": "UK", "clientType": "business", "vatRegistered": true, "requiredFields": ["utr", "vat"], "phoneCode": {"code": "+44", "placeholder": "7911123456", "pattern": "^[1-9][0-9]{9}$", "format": "10 digit number", "rules": ["Must be 10 digits", "Cannot start with 0"]}, "postalCode": {"label": "Postcode", "placeholder": "SW1A 1AA", "pattern": "^[A-Z]{1,2}[0-9]{1,2}[A-Z]?\\s?[0-9][A-Z]{2}$", "format": "UK postcode format", "rules": ["1-2 letters, 1-2 numbers, optional letter, space, 1 number, 2 letters"]}, "validations": {"utr": {"placeholder": "1234567890", "format": "10 digits", "pattern": "^[0-9]{10}$", "length": 10, "rules": ["Exactly 10 numeric digits"]}, "vat": {"placeholder": "GB123456789", "format": "GB followed by 9 digits", "pattern": "^GB[0-9]{9}$", "length": 12, "rules": ["Starts with 'GB'", "Followed by 9 numeric digits"]}}}\`
   
   **Example for UK Business (NOT VAT Registered - Unregistered):**
   \`METADATA: {"country": "UK", "clientType": "business", "vatRegistered": false, "requiredFields": ["utr"], "phoneCode": {"code": "+44", "placeholder": "7911123456", "pattern": "^[1-9][0-9]{9}$", "format": "10 digit number", "rules": ["Must be 10 digits", "Cannot start with 0"]}, "postalCode": {"label": "Postcode", "placeholder": "SW1A 1AA", "pattern": "^[A-Z]{1,2}[0-9]{1,2}[A-Z]?\\s?[0-9][A-Z]{2}$", "format": "UK postcode format", "rules": ["1-2 letters, 1-2 numbers, optional letter, space, 1 number, 2 letters"]}, "validations": {"utr": {"placeholder": "1234567890", "format": "10 digits", "pattern": "^[0-9]{10}$", "length": 10, "rules": ["Exactly 10 numeric digits"]}}}\`

5. **Keep it conversational** - Be helpful, friendly, and progressive. Ask 1-2 questions at a time.

Current session context:
${JSON.stringify((session.collectedData as Record<string, any>) || {}, null, 2)}

Remember: You are a guide, not a data collector. All sensitive information goes into the secure form, never into our chat. Use your deep knowledge of global tax systems to provide accurate, country-specific validation rules.`;

      // Decrypt API key
      const { decrypt } = await import('./llm-service');
      const apiKey = decrypt(llmConfig.apiKeyEncrypted);

      // Call LLM
      let answer;

      if (llmConfig.provider === 'openai' || llmConfig.provider === 'azure' || llmConfig.provider === 'azure_openai') {
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({
          apiKey: apiKey,
          ...((llmConfig.provider === 'azure' || llmConfig.provider === 'azure_openai') && llmConfig.azureEndpoint && {
            baseURL: `${llmConfig.azureEndpoint}/openai/deployments/${llmConfig.model}`,
            defaultQuery: { 'api-version': llmConfig.modelVersion || '2024-12-01-preview' },
            defaultHeaders: { 'api-key': apiKey },
          })
        });

        const completion = await openai.chat.completions.create({
          model: llmConfig.model || 'gpt-4',
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
        const anthropic = new Anthropic({ apiKey: apiKey });

        const message = await anthropic.messages.create({
          model: llmConfig.model || 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          system: systemPrompt,
          messages: conversationHistory.filter(m => m.role !== 'system') as Array<{role: "user" | "assistant"; content: string}>,
        });

        answer = message.content[0].type === 'text' ? message.content[0].text : "I couldn't generate a response.";
      } else {
        return res.status(400).json({ error: `Unsupported LLM provider: ${llmConfig.provider}. Supported providers: openai, azure, azure_openai, anthropic` });
      }

      // Extract metadata from AI response (if present)
      let aiMetadata = {};
      let cleanAnswer = answer;
      const metadataMatch = answer.match(/METADATA:\s*(\{[\s\S]*\})/);
      if (metadataMatch) {
        try {
          aiMetadata = JSON.parse(metadataMatch[1]);
          console.log("✅ Extracted AI metadata:", JSON.stringify(aiMetadata, null, 2));
          // Remove metadata from visible response
          cleanAnswer = answer.replace(/METADATA:\s*\{[\s\S]*\}/, '').trim();
        } catch (e) {
          console.error("❌ Failed to parse AI metadata:", e);
          console.error("Raw metadata string:", metadataMatch[1]);
        }
      } else {
        console.log("⚠️  No metadata found in AI response");
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
      const { sessionId, sensitiveData: requestSensitiveData, existingContactId } = req.body;
      
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

      // Extract data from session and merge with request data
      const collectedData = (session.collectedData as Record<string, any>) || {};
      const sessionSensitiveData = (session.sensitiveData as Record<string, any>) || {};
      // Prioritize request data over session data (request is more current)
      const sensitiveData = { ...sessionSensitiveData, ...(requestSensitiveData || {}) };

      console.log("📊 Onboarding completion data:");
      console.log("  - Collected (from AI):", Object.keys(collectedData));
      console.log("  - Sensitive (from form):", Object.keys(sensitiveData));
      console.log("  - Company Name:", sensitiveData.companyName);
      console.log("  - Contact:", sensitiveData.contactFirstName, sensitiveData.contactLastName);
      console.log("  - Existing Contact ID:", existingContactId);

      // Save the final sensitive data to session for audit trail
      if (requestSensitiveData && Object.keys(requestSensitiveData).length > 0) {
        await storage.updateOnboardingSession(sessionId, {
          sensitiveData: sensitiveData as any,
        });
      }

      // Merge tax IDs from both collectedData (AI) and sensitiveData (form)
      const country = collectedData.country || "US";
      const clientType = collectedData.clientType || "business";
      const taxIds: Record<string, string> = { ...(collectedData.taxIds || {}) };
      
      // Add/override with form-collected tax IDs (trimmed)
      const taxFields = ["pan", "gstin", "ein", "ssn", "vat", "utr", "trn", "abn", "gst", "sin", "bn"];
      for (const field of taxFields) {
        const value = sensitiveData[field]?.trim();
        if (value) {
          taxIds[field.toUpperCase()] = value;
        }
      }
      
      // Determine primary tax ID based on country and client type
      let primaryTaxId = collectedData.primaryTaxId || ""; // Start with AI-provided primary
      
      // Override with form data if available, prioritizing based on country and client type
      if (country === "IN") {
        if (clientType === "business") {
          primaryTaxId = taxIds.GSTIN || taxIds.PAN || primaryTaxId;
        } else {
          primaryTaxId = taxIds.PAN || taxIds.GSTIN || primaryTaxId;
        }
      } else if (country === "US") {
        if (clientType === "business") {
          primaryTaxId = taxIds.EIN || taxIds.SSN || primaryTaxId;
        } else {
          primaryTaxId = taxIds.SSN || taxIds.EIN || primaryTaxId;
        }
      } else if (country === "GB") {
        primaryTaxId = taxIds.VAT || taxIds.UTR || primaryTaxId;
      } else if (country === "AE") {
        primaryTaxId = taxIds.TRN || primaryTaxId;
      } else if (country === "AU") {
        primaryTaxId = taxIds.ABN || taxIds.GST || primaryTaxId;
      } else if (country === "CA") {
        if (clientType === "business") {
          primaryTaxId = taxIds.BN || taxIds.SIN || primaryTaxId;
        } else {
          primaryTaxId = taxIds.SIN || taxIds.BN || primaryTaxId;
        }
      }
      
      // Fallback: if still no primary ID, use the first available tax ID
      if (!primaryTaxId && Object.keys(taxIds).length > 0) {
        primaryTaxId = Object.values(taxIds)[0];
      }
      
      console.log("  - Primary Tax ID:", primaryTaxId);
      console.log("  - All Tax IDs:", taxIds);

      // Build contact name for legacy field (handle partial names)
      const contactName = [
        sensitiveData.contactFirstName?.trim(),
        sensitiveData.contactLastName?.trim()
      ].filter(Boolean).join(" ") || "";

      // Create client in inactive state - will be activated when contact verifies their account
      const client = await storage.createClient({
        companyName: sensitiveData.companyName || collectedData.companyName || "Unknown Company",
        contactName: contactName, // Legacy field for backward compatibility
        email: sensitiveData.email || "",
        phone: sensitiveData.phone || "",
        address: sensitiveData.address || "",
        city: sensitiveData.city || "",
        state: sensitiveData.state || "",
        zipCode: sensitiveData.zipCode || "",
        country: country,
        taxId: primaryTaxId,
        industry: collectedData.industry || "",
        notes: collectedData.notes || "",
        metadata: {
          taxIds: taxIds, // Store all tax IDs
          clientType: collectedData.clientType || "business",
          onboardingSessionId: sessionId,
        },
        status: "inactive", // Client starts as inactive until contact activates
        organizationId: req.user!.organizationId!,
        createdBy: req.userId!,
      });

      // Handle contact - either link to existing or create new
      let portalInvitation: {
        invitationToken: string;
        invitationUrl: string;
        contactEmail: string;
        tempPassword?: string;
        expiresAt: Date;
        welcomeEmail?: { subject: string; body: string; recipientEmail: string };
      } | null = null;
      if (existingContactId) {
        // Link existing contact to this client
        const existingContact = await storage.getContact(existingContactId);
        if (existingContact && existingContact.organizationId === req.user!.organizationId) {
          await storage.updateContact(existingContactId, {
            clientId: client.id,
            isPrimary: true,
          });
          console.log("✅ Linked existing contact", existingContactId, "to client", client.id);
        } else {
          console.warn("⚠️ Existing contact not found or unauthorized:", existingContactId);
        }
      } else if (sensitiveData.contactFirstName && sensitiveData.contactLastName && sensitiveData.contactEmail) {
        // Get Client role
        const clientRole = await db.select().from(schema.roles)
          .where(eq(schema.roles.name, "Client"))
          .limit(1);
        
        if (clientRole.length === 0) {
          return res.status(500).json({ error: "Client role not found. Please contact system administrator." });
        }

        // Check for email conflicts BEFORE starting transaction
        const existingUsers = await db.select().from(schema.users)
          .where(eq(schema.users.email, sensitiveData.contactEmail.toLowerCase()))
          .limit(1);

        let contactUser;
        let shouldCreateUser = true;

        if (existingUsers.length > 0) {
          const existingUser = existingUsers[0];
          
          // Check if existing user belongs to same org and has Client role
          if (existingUser.organizationId === req.user!.organizationId && 
              existingUser.roleId === clientRole[0].id) {
            // Perfect match - can reuse the existing Client user
            contactUser = existingUser;
            shouldCreateUser = false;
            console.log("✅ Will reuse existing client user account for contact:", contactUser.id);
          } else if (existingUser.organizationId === req.user!.organizationId) {
            // User exists in same org but with different role - conflict
            return res.status(409).json({ 
              error: `Email ${sensitiveData.contactEmail} is already registered in your organization with a different role. Please use a different email address for this contact.`
            });
          } else {
            // User exists in different organization - conflict
            return res.status(409).json({ 
              error: `Email ${sensitiveData.contactEmail} is already registered by another organization. Please use a different email address for this contact.`
            });
          }
        }

        // Use a transaction to ensure complete atomicity
        await db.transaction(async (tx) => {
          let tempPassword: string | null = null;
          let isNewUser = false;

          if (shouldCreateUser) {
            // Create new user in inactive state - will be activated after email and phone verification
            tempPassword = crypto.randomBytes(16).toString('base64').slice(0, 16);
            const hashedPassword = await hashPassword(tempPassword);

            // Create user account for the contact within the transaction
            const [newUser] = await tx.insert(schema.users).values({
              username: sensitiveData.contactEmail.toLowerCase(),
              email: sensitiveData.contactEmail.toLowerCase(),
              password: hashedPassword,
              firstName: sensitiveData.contactFirstName,
              lastName: sensitiveData.contactLastName,
              roleId: clientRole[0].id,
              organizationId: req.user!.organizationId!,
              isActive: false, // Contact user starts inactive until they verify email and phone
            }).returning();

            contactUser = newUser;
            isNewUser = true;
            console.log("✅ Created new user account for contact (inactive):", contactUser.id);
          }

          // Create new contact and link to user
          const [contact] = await tx.insert(schema.contacts).values({
            clientId: client.id,
            userId: contactUser.id,
            firstName: sensitiveData.contactFirstName,
            lastName: sensitiveData.contactLastName,
            email: sensitiveData.contactEmail,
            phone: sensitiveData.contactPhone || "",
            title: sensitiveData.contactTitle || "",
            isPrimary: true,
            organizationId: req.user!.organizationId!,
            createdBy: req.userId!,
          }).returning();
          console.log("✅ Created new contact for client", client.id);

          // Only create portal invitation for new users
          if (isNewUser && tempPassword) {
            // Create portal invitation
            const invitationToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

            await tx.insert(schema.portalInvitations).values({
              contactId: contact.id,
              userId: contactUser.id,
              invitationToken,
              status: "pending",
              expiresAt,
              organizationId: req.user!.organizationId!,
            });

            portalInvitation = {
              invitationToken,
              invitationUrl: `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/portal-setup/${invitationToken}`,
              contactEmail: sensitiveData.contactEmail,
              tempPassword,
              expiresAt,
              // welcomeEmail will be populated after transaction
            };

            console.log("✅ Created portal invitation for contact:", contact.id);
          }
        });
      }

      // If portal invitation was created, prepare the welcome email
      if (portalInvitation && portalInvitation.invitationToken) {
        try {
          // Get the organization
          const organization = await storage.getOrganization(req.user!.organizationId!);
          if (organization) {
            // Get the welcome email template (organization-specific or default)
            const template = await storage.getEmailTemplateByCategory(req.user!.organizationId!, 'welcome');
            
            if (template) {
              const { preparePortalWelcomeEmail } = await import('./services/portalInvitationService');
              
              // Get the contact that was just created
              const contacts = await storage.getContactsByClient(client.id);
              const primaryContact = contacts.find(c => c.isPrimary);
              
              if (primaryContact) {
                // Prepare the welcome email
                const welcomeEmail = preparePortalWelcomeEmail(template, {
                  contact: primaryContact,
                  organization,
                  client: {
                    id: client.id,
                    companyName: client.companyName,
                  },
                  invitationToken: portalInvitation.invitationToken,
                  invitationUrl: portalInvitation.invitationUrl,
                  tempPassword: portalInvitation.tempPassword,
                });
                
                // Add the rendered email to the portal invitation response
                portalInvitation.welcomeEmail = welcomeEmail;
                
                console.log("✅ Prepared welcome email for:", primaryContact.email);
                console.log("📧 Email subject:", welcomeEmail.subject);
              }
            } else {
              console.log("⚠️ No welcome email template found");
            }
          }
        } catch (emailError: any) {
          console.error("Failed to prepare welcome email:", emailError);
          // Don't fail the whole request if email preparation fails
        }
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

      res.json({ 
        client, 
        success: true,
        portalInvitation, // Include invitation details so they can be shared with the contact
      });
    } catch (error: any) {
      console.error("Failed to complete onboarding:", error);
      res.status(500).json({ error: "Failed to complete onboarding" });
    }
  });

  // ==================== Portal Activation Routes ====================
  
  // Validate portal invitation token and get contact details
  app.get("/api/portal/validate/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ error: "Invitation token is required" });
      }

      // Find the portal invitation
      const invitation = await db.select()
        .from(schema.portalInvitations)
        .where(eq(schema.portalInvitations.invitationToken, token))
        .limit(1);

      if (invitation.length === 0) {
        return res.status(404).json({ error: "Invalid or expired invitation" });
      }

      const portalInvite = invitation[0];

      // Check if expired
      if (new Date() > portalInvite.expiresAt) {
        return res.status(400).json({ error: "Invitation has expired" });
      }

      // Check if already accepted
      if (portalInvite.status === "accepted") {
        return res.status(400).json({ error: "Invitation has already been used" });
      }

      // Get contact and user details
      const contact = await storage.getContact(portalInvite.contactId);
      const user = await storage.getUser(portalInvite.userId);

      if (!contact || !user) {
        return res.status(404).json({ error: "Contact or user not found" });
      }

      res.json({
        valid: true,
        contact: {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
        },
        user: {
          username: user.username,
          isActive: user.isActive,
          phoneVerified: user.phoneVerified,
        }
      });
    } catch (error: any) {
      console.error("Portal validation error:", error);
      res.status(500).json({ error: "Failed to validate invitation" });
    }
  });

  // Complete portal activation after phone verification
  app.post("/api/portal/activate", async (req: Request, res: Response) => {
    try {
      const { invitationToken, password, otpId } = req.body;

      if (!invitationToken || !password) {
        return res.status(400).json({ error: "Invitation token and password are required" });
      }

      if (!otpId) {
        return res.status(400).json({ error: "Phone verification (OTP) is required to activate your account" });
      }

      // Find the portal invitation
      const invitation = await db.select()
        .from(schema.portalInvitations)
        .where(eq(schema.portalInvitations.invitationToken, invitationToken))
        .limit(1);

      if (invitation.length === 0) {
        return res.status(404).json({ error: "Invalid or expired invitation" });
      }

      const portalInvite = invitation[0];

      // Check if expired
      if (new Date() > portalInvite.expiresAt) {
        return res.status(400).json({ error: "Invitation has expired" });
      }

      // Check if already accepted
      if (portalInvite.status === "accepted") {
        return res.status(400).json({ error: "Invitation has already been used" });
      }

      // Get contact and user
      const contact = await storage.getContact(portalInvite.contactId);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      const user = await storage.getUser(portalInvite.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify the OTP record exists, is verified, and matches the contact's phone
      const otpRecord = await db.select()
        .from(schema.otpVerifications)
        .where(eq(schema.otpVerifications.id, otpId))
        .limit(1);

      if (otpRecord.length === 0) {
        return res.status(400).json({ error: "Invalid OTP verification" });
      }

      const otp = otpRecord[0];

      // Validate OTP is verified and not expired
      if (!otp.verified) {
        return res.status(400).json({ error: "Phone number not verified. Please complete OTP verification first." });
      }

      if (new Date() > otp.expiresAt) {
        return res.status(400).json({ error: "OTP verification has expired. Please request a new code." });
      }

      // Validate OTP phone matches contact phone
      if (otp.phone !== contact.phone) {
        return res.status(400).json({ error: "Phone verification does not match contact phone number" });
      }

      // Hash the new password
      const hashedPassword = await hashPassword(password);

      // Use a transaction to ensure atomicity
      await db.transaction(async (tx) => {
        // Update user with new password and activate
        await tx.update(schema.users)
          .set({
            password: hashedPassword,
            isActive: true,
            phoneVerified: true,
            phoneVerifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, portalInvite.userId));

        // Activate the client
        if (contact.clientId) {
          await tx.update(schema.clients)
            .set({
              status: "active",
              updatedAt: new Date(),
            })
            .where(eq(schema.clients.id, contact.clientId));
          console.log("✅ Activated client:", contact.clientId);
        }

        // Mark invitation as accepted
        await tx.update(schema.portalInvitations)
          .set({
            status: "accepted",
            acceptedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.portalInvitations.id, portalInvite.id));
      });

      console.log("✅ Portal activation completed for user:", portalInvite.userId, "with verified OTP:", otpId);

      res.json({
        success: true,
        message: "Account activated successfully",
        activated: true,
      });
    } catch (error: any) {
      console.error("Portal activation error:", error);
      res.status(500).json({ error: "Failed to activate portal account" });
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

  // ==================== Mention System Routes ====================

  app.get("/api/mentions/users", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { MentionService } = await import("./services/mentionService");
      const searchQuery = req.query.q as string | undefined;
      const users = await MentionService.getOrganizationUsers(
        req.user!.organizationId!,
        searchQuery
      );
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch users for mentions" });
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

  // ==================== Report Builder Routes ====================

  // Get available report templates
  app.get("/api/reports/templates", requireAuth, requirePermission("analytics.view"), async (req: AuthRequest, res: Response) => {
    try {
      const { ReportService } = await import("./services/reportService");
      const templates = ReportService.getTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error("Failed to fetch report templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  // Execute pre-built template report
  app.post("/api/reports/run-template/:templateId", requireAuth, requirePermission("analytics.view"), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization required" });
      }

      const { ReportService } = await import("./services/reportService");
      const { templateId } = req.params;
      const overrides = req.body; // Optional parameter overrides

      const result = await ReportService.executeTemplateReport(
        req.user!.organizationId,
        templateId,
        overrides
      );

      res.json(result);
    } catch (error: any) {
      console.error("Template report execution error:", error);
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to execute template report" });
    }
  });

  // Execute custom report (existing endpoint - refactored to use ReportService)
  app.post("/api/reports/execute", requireAuth, requirePermission("analytics.view"), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization required" });
      }

      const { dataSource, filters, groupBy } = req.body;

      if (!dataSource) {
        return res.status(400).json({ error: "Data source required" });
      }

      const { ReportService } = await import("./services/reportService");
      
      const result = await ReportService.executeCustomReport(
        req.user!.organizationId,
        {
          dataSource,
          filters: filters || [],
          groupBy,
        }
      );

      res.json(result);
    } catch (error: any) {
      console.error("Report execution error:", error);
      if (error.message?.includes("Invalid data source")) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to execute report" });
    }
  });

  // ==================== Form Template Routes ====================
  
  app.get("/api/forms", requireAuth, requirePermission("forms.view"), async (req: AuthRequest, res: Response) => {
    try {
      // Super admin (platform-scoped) can see all forms
      if (!req.user!.organizationId) {
        const allForms = await db.select().from(schema.formTemplates).orderBy(schema.formTemplates.name);
        return res.json(allForms);
      }
      const forms = await storage.getFormTemplatesByOrganization(req.user!.organizationId);
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
        scope: req.user!.organizationId ? 'organization' : 'global', // Super admin creates global templates
        organizationId: req.user!.organizationId || null, // Allow null for super admin
        createdBy: req.user!.id,
      });
      
      await logActivity(
        req.user!.id,
        req.user!.organizationId || undefined,
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
      
      // Check ownership: Super Admin can delete global forms, regular users can delete their org's forms
      const isSuperAdmin = !req.user!.organizationId;
      const isOwnOrganizationForm = existing.organizationId === req.user!.organizationId;
      
      if (!isSuperAdmin && !isOwnOrganizationForm) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.deleteFormTemplate(req.params.id);
      
      await logActivity(
        req.user!.id,
        req.user!.organizationId || undefined,
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

  // ==================== Client Portal Messaging Routes ====================

  // Get client portal stats (dashboard)
  app.get("/api/client-portal/stats", requireAuth, async (req: AuthRequest, res: Response) => {
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

      // TODO: Calculate actual stats from database
      // For now, returning mock stats structure
      const stats = {
        documents: {
          total: 0,
          pending: 0
        },
        tasks: {
          pending: 0,
          overdue: 0
        },
        signatures: {
          pending: 0
        },
        forms: {
          total: 0
        }
      };

      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch client portal stats" });
    }
  });

  // Get all conversations for client
  app.get("/api/client-portal/conversations", requireAuth, async (req: AuthRequest, res: Response) => {
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

      const conversations = await storage.getConversationsByClient(client.id);
      res.json(conversations);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Create new conversation (client initiates)
  app.post("/api/client-portal/conversations", requireAuth, async (req: AuthRequest, res: Response) => {
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

      const { subject } = req.body;

      if (!subject || subject.trim().length === 0) {
        return res.status(400).json({ error: "Subject is required" });
      }

      const conversation = await storage.createConversation({
        organizationId: req.user!.organizationId!,
        clientId: client.id,
        subject,
        status: "active"
      });

      res.status(201).json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Get messages for a conversation (client view)
  app.get("/api/client-portal/conversations/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
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

      // Verify conversation belongs to this client
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation || conversation.clientId !== client.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const messages = await storage.getMessagesByConversation(req.params.id);
      
      // Enrich messages with sender information
      const enrichedMessages = await Promise.all(messages.map(async (msg: any) => {
        const sender = await storage.getUser(msg.senderId);
        return {
          ...msg,
          sender: {
            id: sender?.id,
            firstName: sender?.firstName,
            lastName: sender?.lastName,
            email: sender?.email
          }
        };
      }));

      res.json(enrichedMessages);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Send message in conversation (client)
  app.post("/api/client-portal/conversations/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
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

      // Verify conversation belongs to this client
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation || conversation.clientId !== client.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Message content is required" });
      }

      const message = await storage.createMessage({
        conversationId: req.params.id,
        senderId: req.user!.id,
        senderType: "client",
        content: content.trim(),
        attachments: []
      });

      res.status(201).json(message);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Get client portal documents
  app.get("/api/client-portal/documents", requireAuth, requirePermission("documents.view"), async (req: AuthRequest, res: Response) => {
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

      // TODO: Get documents shared with this client
      // For now returning empty array
      res.json([]);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Upload client portal documents
  app.post("/api/client-portal/documents/upload", requireAuth, requirePermission("documents.upload"), upload.array("files", 10), async (req: AuthRequest, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files provided" });
      }

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

      // Process uploaded files
      const uploadedDocs = files.map(file => ({
        id: Math.random().toString(36).substring(7),
        name: file.originalname,
        fileUrl: `/uploads/${file.filename}`,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        status: "uploaded"
      }));

      res.json({ success: true, documents: uploadedDocs });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to upload documents" });
    }
  });

  // Get client portal tasks
  app.get("/api/client-portal/tasks", requireAuth, requirePermission("tasks.view"), async (req: AuthRequest, res: Response) => {
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

      // TODO: Get tasks assigned to this client
      // For now returning empty array
      res.json([]);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // Get client portal forms
  app.get("/api/client-portal/forms", requireAuth, requirePermission("forms.view"), async (req: AuthRequest, res: Response) => {
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

      // TODO: Get forms assigned to this client
      // For now returning empty array
      res.json([]);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch forms" });
    }
  });

  // Get client portal signature requests
  app.get("/api/client-portal/signatures", requireAuth, requirePermission("signatures.view"), async (req: AuthRequest, res: Response) => {
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

      // TODO: Get signature requests for this client
      // For now returning empty array
      res.json([]);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch signature requests" });
    }
  });

  // ==================== Action Center & Notifications Routes ====================

  // Get Action Center - Unified pending items dashboard
  app.get("/api/client-portal/action-center", requireAuth, requirePermission("action_center.view"), async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const filter = req.query.filter as string || 'all'; // 'waiting_on_me', 'waiting_on_firm', 'all'

      // Find client by email
      const clients = await storage.getClientsByOrganization(req.user!.organizationId!);
      const client = clients.find((c: any) => c.email.toLowerCase() === user.email.toLowerCase());

      if (!client) {
        return res.status(404).json({ error: "No client profile found for this user" });
      }

      // Aggregate all pending items
      const actionItems: any[] = [];

      // TODO: Implement real data fetching
      // For now, return structure for frontend development
      const actionCenter = {
        summary: {
          totalPending: 0,
          waitingOnMe: 0,
          waitingOnFirm: 0,
          overdueCount: 0,
        },
        items: actionItems,
        filter: filter,
      };

      res.json(actionCenter);
    } catch (error: any) {
      console.error("[ACTION CENTER ERROR]", error);
      res.status(500).json({ error: "Failed to fetch action center data" });
    }
  });

  // Get all notifications for current user
  app.get("/api/notifications", requireAuth, requirePermission("notifications.view"), async (req: AuthRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const unreadOnly = req.query.unreadOnly === 'true';

      const result = await db.select()
        .from(notifications)
        .where(and(
          eq(notifications.userId, req.user!.id),
          unreadOnly ? eq(notifications.isRead, false) : sql`true`
        ))
        .orderBy(sql`${notifications.createdAt} DESC`)
        .limit(limit)
        .offset(offset);

      res.json(result);
    } catch (error: any) {
      console.error("[NOTIFICATIONS GET ERROR]", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Get unread notification count
  app.get("/api/notifications/unread-count", requireAuth, requirePermission("notifications.view"), async (req: AuthRequest, res: Response) => {
    try {
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(and(
          eq(notifications.userId, req.user!.id),
          eq(notifications.isRead, false)
        ));

      res.json({ count: result[0]?.count || 0 });
    } catch (error: any) {
      console.error("[UNREAD COUNT ERROR]", error);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  // Mark notification as read
  app.patch("/api/notifications/:id/read", requireAuth, requirePermission("notifications.read"), async (req: AuthRequest, res: Response) => {
    try {
      // Verify notification belongs to user
      const notification = await db.select()
        .from(notifications)
        .where(eq(notifications.id, req.params.id))
        .limit(1);

      if (!notification.length || notification[0].userId !== req.user!.id) {
        return res.status(404).json({ error: "Notification not found" });
      }

      await db.update(notifications)
        .set({ 
          isRead: true,
          readAt: sql`now()`
        })
        .where(eq(notifications.id, req.params.id));

      res.json({ success: true });
    } catch (error: any) {
      console.error("[MARK READ ERROR]", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/mark-all-read", requireAuth, requirePermission("notifications.read"), async (req: AuthRequest, res: Response) => {
    try {
      await db.update(notifications)
        .set({ 
          isRead: true,
          readAt: sql`now()`
        })
        .where(and(
          eq(notifications.userId, req.user!.id),
          eq(notifications.isRead, false)
        ));

      res.json({ success: true });
    } catch (error: any) {
      console.error("[MARK ALL READ ERROR]", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
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

  // ==================== Proposals Routes ====================
  
  // data-testid: GET /api/proposals - List proposals for organization
  app.get("/api/proposals", requireAuth, requirePermission("proposals.view"), async (req: AuthRequest, res: Response) => {
    try {
      const { clientId } = req.query;

      let proposals;
      if (clientId && typeof clientId === 'string') {
        // Verify client belongs to user's organization
        const client = await storage.getClient(clientId);
        if (!client || client.organizationId !== req.user!.organizationId) {
          return res.status(403).json({ error: "Access denied" });
        }
        proposals = await storage.getProposalsByClient(clientId);
      } else {
        proposals = await storage.getProposalsByOrganization(req.user!.organizationId!);
      }

      res.json(proposals);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Failed to fetch proposals:", error);
      res.status(500).json({ error: "Failed to fetch proposals" });
    }
  });

  // data-testid: GET /api/proposals/:id - Get single proposal
  app.get("/api/proposals/:id", requireAuth, requirePermission("proposals.view"), async (req: AuthRequest, res: Response) => {
    try {
      const proposal = await storage.getProposal(req.params.id);

      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      // Verify proposal belongs to user's organization
      if (proposal.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(proposal);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Failed to fetch proposal:", error);
      res.status(500).json({ error: "Failed to fetch proposal" });
    }
  });

  // data-testid: POST /api/proposals - Create new proposal
  app.post("/api/proposals", requireAuth, requirePermission("proposals.create"), async (req: AuthRequest, res: Response) => {
    try {
      // Validate request body
      const validated = insertProposalSchema.omit({ 
        organizationId: true, 
        createdBy: true,
        proposalNumber: true,
      }).parse(req.body);

      // Verify client belongs to user's organization if clientId is provided
      if (validated.clientId) {
        const client = await storage.getClient(validated.clientId);
        if (!client || client.organizationId !== req.user!.defaultOrganizationId) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      // Generate proposal number
      const proposalNumber = await storage.generateProposalNumber(req.user!.defaultOrganizationId!);

      // Create proposal
      const proposal = await storage.createProposal({
        ...validated,
        proposalNumber,
        organizationId: req.user!.defaultOrganizationId!,
        createdBy: req.userId!,
      });

      await logActivity(
        req.userId,
        req.user!.defaultOrganizationId!,
        "create",
        "proposal",
        proposal.id,
        { proposalNumber, clientId: validated.clientId },
        req
      );

      res.status(201).json(proposal);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Failed to create proposal:", error);
      res.status(500).json({ error: "Failed to create proposal" });
    }
  });

  // data-testid: PUT /api/proposals/:id - Update proposal
  app.put("/api/proposals/:id", requireAuth, requirePermission("proposals.edit"), async (req: AuthRequest, res: Response) => {
    try {
      // Check if proposal exists
      const existing = await storage.getProposal(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      // Verify proposal belongs to user's organization
      if (existing.organizationId !== req.user!.defaultOrganizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Validate request body (partial update)
      const validated = insertProposalSchema.partial().omit({
        organizationId: true,
        createdBy: true,
        proposalNumber: true,
      }).parse(req.body);

      // Verify client belongs to user's organization if clientId is being updated
      if (validated.clientId) {
        const client = await storage.getClient(validated.clientId);
        if (!client || client.organizationId !== req.user!.defaultOrganizationId) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      // Update proposal
      const updated = await storage.updateProposal(req.params.id, validated);

      if (!updated) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      await logActivity(
        req.userId,
        req.user!.defaultOrganizationId!,
        "update",
        "proposal",
        req.params.id,
        {},
        req
      );

      res.json(updated);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Failed to update proposal:", error);
      res.status(500).json({ error: "Failed to update proposal" });
    }
  });

  // data-testid: DELETE /api/proposals/:id - Delete proposal
  app.delete("/api/proposals/:id", requireAuth, requirePermission("proposals.delete"), async (req: AuthRequest, res: Response) => {
    try {
      // Check if proposal exists
      const existing = await storage.getProposal(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      // Verify proposal belongs to user's organization
      if (existing.organizationId !== req.user!.defaultOrganizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Delete proposal
      await storage.deleteProposal(req.params.id);

      await logActivity(
        req.userId,
        req.user!.defaultOrganizationId!,
        "delete",
        "proposal",
        req.params.id,
        { proposalNumber: existing.proposalNumber },
        req
      );

      res.status(204).send();
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Failed to delete proposal:", error);
      res.status(500).json({ error: "Failed to delete proposal" });
    }
  });

  // data-testid: POST /api/proposals/:id/send - Send proposal to client
  app.post("/api/proposals/:id/send", requireAuth, requirePermission("proposals.send"), async (req: AuthRequest, res: Response) => {
    try {
      // Check if proposal exists
      const existing = await storage.getProposal(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      // Verify proposal belongs to user's organization
      if (existing.organizationId !== req.user!.defaultOrganizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Update proposal status to 'sent'
      const updated = await storage.updateProposal(req.params.id, {
        status: 'sent',
        sentAt: new Date(),
        sentBy: req.userId!,
      });

      if (!updated) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      // Create notification for client if clientId exists
      if (existing.clientId) {
        const client = await storage.getClient(existing.clientId);
        if (client && client.userId) {
          await storage.createNotification({
            userId: client.userId,
            title: "New Proposal Received",
            message: `You have received a new proposal: ${existing.title || existing.proposalNumber}`,
            type: "info",
            relatedResource: "proposal",
            relatedResourceId: existing.id,
          });
        }
      }

      await logActivity(
        req.userId,
        req.user!.defaultOrganizationId!,
        "send",
        "proposal",
        req.params.id,
        { proposalNumber: existing.proposalNumber, clientId: existing.clientId },
        req
      );

      res.json(updated);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Failed to send proposal:", error);
      res.status(500).json({ error: "Failed to send proposal" });
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

  app.post("/api/conversations", requireAuth, requirePermission("conversations.create"), async (req: AuthRequest, res: Response) => {
    try {
      const { clientId, subject, status } = req.body;

      if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
        return res.status(400).json({ error: "Subject is required" });
      }

      let validatedClientId = null;
      if (clientId && typeof clientId === 'string' && clientId.trim().length > 0) {
        const client = await storage.getClient(clientId);
        if (!client || client.organizationId !== req.user!.organizationId) {
          return res.status(404).json({ error: "Client not found" });
        }
        validatedClientId = clientId;
      }

      const conversation = await storage.createConversation({
        organizationId: req.user!.organizationId!,
        clientId: validatedClientId,
        subject: subject.trim(),
        status: status || "active"
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

  app.post("/api/conversations/:id/messages", requireAuth, requirePermission("conversations.send"), async (req: AuthRequest, res: Response) => {
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
      const { items, ...invoiceData } = req.body;
      
      const invoice = await storage.createInvoice({
        ...invoiceData,
        organizationId: req.user!.organizationId!,
        createdBy: req.user!.id
      });
      
      // Create invoice items if provided
      if (items && Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          await storage.createInvoiceItem({
            ...item,
            invoiceId: invoice.id
          });
        }
      }
      
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "invoice", invoice.id, invoice, req);
      res.status(201).json(invoice);
    } catch (error: any) {
      console.error("[INVOICE CREATION ERROR]", error);
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

  // Public invoice access (no auth required) - for client payment portal
  app.get("/api/invoices/:id/public", async (req: Request, res: Response) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const items = await storage.getInvoiceItemsByInvoice(invoice.id);
      const client = await storage.getClientById(invoice.clientId);
      const organization = await storage.getOrganization(invoice.organizationId);
      
      res.json({ 
        ...invoice, 
        items,
        client: client ? {
          name: client.name,
          email: client.email,
          phone: client.phone,
        } : null,
        organization: organization ? {
          name: organization.name,
        } : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  // Send invoice email to client
  app.post("/api/invoices/:id/send", requireAuth, requirePermission("invoices.update"), async (req: AuthRequest, res: Response) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice || invoice.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      const client = await storage.getClientById(invoice.clientId);
      if (!client || !client.email) {
        return res.status(400).json({ error: "Client email not found" });
      }

      const organization = await storage.getOrganization(invoice.organizationId);
      const paymentLink = `${req.protocol}://${req.get('host')}/pay/${invoice.id}`;

      // TODO: Integrate with email service (Resend)
      // For now, just return success with the payment link
      console.log(`[INVOICE EMAIL] Would send to ${client.email}: ${paymentLink}`);
      
      res.json({ 
        success: true, 
        message: "Invoice email sent successfully",
        paymentLink 
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to send invoice" });
    }
  });

  // Initiate payment for invoice
  app.post("/api/invoices/:id/pay", async (req: Request, res: Response) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      if (invoice.status === "paid") {
        return res.status(400).json({ error: "Invoice already paid" });
      }

      // Get organization's payment gateway configuration
      const paymentGateways = await storage.getPaymentGatewayConfigsByOrganization(invoice.organizationId);
      const defaultGateway = paymentGateways.find(g => g.isDefault);
      
      if (!defaultGateway) {
        return res.status(400).json({ error: "No payment gateway configured" });
      }

      // For Razorpay
      if (defaultGateway.gateway === "razorpay") {
        const crypto = await import("crypto");
        const Razorpay = (await import("razorpay")).default;
        
        // Decrypt credentials
        const decryptedKey = decrypt(defaultGateway.encryptedKeyId);
        const decryptedSecret = decrypt(defaultGateway.encryptedKeySecret);
        
        const razorpay = new Razorpay({
          key_id: decryptedKey,
          key_secret: decryptedSecret,
        });

        const orderOptions = {
          amount: Math.round(parseFloat(invoice.total) * 100), // Convert to paise
          currency: defaultGateway.currency || "INR",
          receipt: invoice.invoiceNumber,
        };

        const order = await razorpay.orders.create(orderOptions);

        res.json({
          razorpayOrderId: order.id,
          razorpayKeyId: decryptedKey,
          amount: orderOptions.amount,
          currency: orderOptions.currency,
        });
      } else {
        res.status(400).json({ error: "Payment gateway not supported yet" });
      }
    } catch (error: any) {
      console.error("[PAYMENT INITIATION ERROR]", error);
      res.status(500).json({ error: "Failed to initiate payment" });
    }
  });

  // Verify payment and update invoice status
  app.post("/api/invoices/:id/verify-payment", async (req: Request, res: Response) => {
    try {
      const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
      
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Get payment gateway configuration
      const paymentGateways = await storage.getPaymentGatewayConfigsByOrganization(invoice.organizationId);
      const defaultGateway = paymentGateways.find(g => g.isDefault);
      
      if (!defaultGateway || defaultGateway.gateway !== "razorpay") {
        return res.status(400).json({ error: "Invalid payment gateway" });
      }

      // Decrypt credentials and verify signature
      const crypto = await import("crypto");
      const decryptedSecret = decrypt(defaultGateway.encryptedKeySecret);
      
      const generatedSignature = crypto
        .createHmac("sha256", decryptedSecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (generatedSignature !== razorpaySignature) {
        return res.status(400).json({ error: "Invalid payment signature" });
      }

      // Payment verified - update invoice and create payment record
      await storage.updateInvoice(invoice.id, {
        status: "paid",
        amountPaid: invoice.total,
      });

      const payment = await storage.createPayment({
        organizationId: invoice.organizationId,
        clientId: invoice.clientId,
        invoiceId: invoice.id,
        amount: invoice.total,
        currency: defaultGateway.currency || "INR",
        paymentMethod: "online",
        status: "completed",
        razorpayPaymentId,
        paymentDate: new Date().toISOString(),
        createdBy: invoice.createdBy, // Use invoice creator as payment creator
      });

      res.json({ 
        success: true, 
        message: "Payment verified successfully",
        payment 
      });
    } catch (error: any) {
      console.error("[PAYMENT VERIFICATION ERROR]", error);
      res.status(500).json({ error: "Failed to verify payment" });
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

  app.delete("/api/projects/:id", requireAuth, requirePermission("projects.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getProject(req.params.id);
      if (!existing || existing.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Project not found" });
      }
      await storage.deleteProject(req.params.id);
      await logActivity(req.user!.id, req.user!.organizationId!, "delete", "project", req.params.id, {}, req);
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  app.get("/api/projects/:id/tasks", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Project not found" });
      }
      const tasks = await storage.getProjectTasksByProject(req.params.id);
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch tasks" });
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

  // Project Workflows - Projects as combinations of 2+ workflows
  app.get("/api/projects/:id/workflows", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Project not found" });
      }
      const workflows = await storage.getProjectWorkflows(req.params.id);
      res.json(workflows);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch project workflows" });
    }
  });

  app.post("/api/projects/:id/workflows", requireAuth, requirePermission("projects.update"), async (req: AuthRequest, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Project not found" });
      }
      const workflow = await storage.getWorkflow(req.body.workflowId);
      if (!workflow || workflow.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      const projectWorkflow = await storage.addWorkflowToProject({
        projectId: req.params.id,
        workflowId: req.body.workflowId,
        order: req.body.order || 0
      });
      await logActivity(req.user!.id, req.user!.organizationId!, "add_workflow", "project", req.params.id, { workflowId: req.body.workflowId }, req);
      res.status(201).json(projectWorkflow);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to add workflow to project" });
    }
  });

  app.delete("/api/projects/:id/workflows/:workflowId", requireAuth, requirePermission("projects.update"), async (req: AuthRequest, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Project not found" });
      }
      await storage.removeWorkflowFromProject(req.params.id, req.params.workflowId);
      await logActivity(req.user!.id, req.user!.organizationId!, "remove_workflow", "project", req.params.id, { workflowId: req.params.workflowId }, req);
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to remove workflow from project" });
    }
  });

  // Move assignment between workflows (within a project)
  app.post("/api/assignments/:id/move-workflow", requireAuth, requirePermission("assignments.update"), async (req: AuthRequest, res: Response) => {
    try {
      const assignment = await storage.getWorkflowAssignment(req.params.id);
      if (!assignment || assignment.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      const { targetWorkflowId, projectId } = req.body;
      
      if (!targetWorkflowId) {
        return res.status(400).json({ error: "targetWorkflowId is required" });
      }

      const targetWorkflow = await storage.getWorkflow(targetWorkflowId);
      if (!targetWorkflow || targetWorkflow.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Target workflow not found" });
      }

      if (projectId) {
        const isWorkflowInProject = await storage.isWorkflowInProject(projectId, targetWorkflowId);
        if (!isWorkflowInProject) {
          return res.status(400).json({ error: "Target workflow is not part of this project" });
        }
      }

      const updatedAssignment = await storage.updateWorkflowAssignment(req.params.id, {
        workflowId: targetWorkflowId,
        currentStageId: null,
        currentStepId: null,
        currentTaskId: null,
        status: 'not_started'
      });

      await logActivity(req.user!.id, req.user!.organizationId!, "move_workflow", "assignment", req.params.id, { 
        fromWorkflowId: assignment.workflowId, 
        toWorkflowId: targetWorkflowId, 
        projectId 
      }, req);

      res.json(updatedAssignment);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to move assignment to different workflow" });
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

      const { MentionService } = await import("./services/mentionService");
      const mentionedUserIds = MentionService.extractMentions(req.body.content);

      const message = await storage.createChatMessage({
        channelId: req.params.id,
        senderId: req.user!.id,
        content: req.body.content,
        mentions: mentionedUserIds,
        attachments: req.body.attachments || []
      });

      if (mentionedUserIds.length > 0) {
        await MentionService.createMentionNotifications({
          resourceType: 'comment',
          resourceId: message.id,
          resourceTitle: channel.name,
          organizationId: channel.organizationId,
          mentionedBy: req.user!.id,
          content: req.body.content,
        });
      }

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
      const { title, description, clientId, startTime, endTime, location, status } = req.body;

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: "Title is required" });
      }

      if (!startTime || !endTime) {
        return res.status(400).json({ error: "Start time and end time are required" });
      }

      const start = new Date(startTime);
      const end = new Date(endTime);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: "Invalid date/time format" });
      }

      if (end <= start) {
        return res.status(400).json({ error: "End time must be after start time" });
      }

      let validatedClientId = null;
      if (clientId && clientId !== "none" && typeof clientId === 'string' && clientId.trim().length > 0) {
        const client = await storage.getClient(clientId);
        if (!client || client.organizationId !== req.user!.organizationId) {
          return res.status(404).json({ error: "Client not found" });
        }
        validatedClientId = clientId;
      }

      const appointment = await storage.createAppointment({
        organizationId: req.user!.organizationId!,
        title: String(title).trim(),
        description: description && typeof description === 'string' ? description.trim() : null,
        clientId: validatedClientId,
        startTime: start,
        endTime: end,
        location: location && typeof location === 'string' ? location.trim() : null,
        status: status || "scheduled",
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

  // ==================== Calendar Events ====================
  
  // Get all events for organization (meetings, PTO, block time, task deadlines)
  app.get("/api/events", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { startDate, endDate, type } = req.query;
      
      // Build WHERE conditions
      const conditions: any[] = [eq(schema.events.organizationId, req.user!.organizationId!)];
      
      if (startDate) {
        conditions.push(sql`${schema.events.startTime} >= ${new Date(startDate as string)}`);
      }
      if (endDate) {
        conditions.push(sql`${schema.events.endTime} <= ${new Date(endDate as string)}`);
      }
      if (type && type !== 'all') {
        conditions.push(eq(schema.events.type, type as string));
      }
      
      const events = await db.select().from(schema.events)
        .where(and(...conditions))
        .orderBy(schema.events.startTime);
      
      res.json(events);
    } catch (error: any) {
      console.error("Failed to fetch events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  // Get single event with attendees
  app.get("/api/events/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const event = await db.select().from(schema.events)
        .where(and(
          eq(schema.events.id, req.params.id),
          eq(schema.events.organizationId, req.user!.organizationId!)
        ))
        .limit(1);
      
      if (!event.length) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      // Fetch attendees
      const attendees = await db.select().from(schema.eventAttendees)
        .where(eq(schema.eventAttendees.eventId, req.params.id));
      
      res.json({ ...event[0], attendees });
    } catch (error: any) {
      console.error("Failed to fetch event:", error);
      res.status(500).json({ error: "Failed to fetch event" });
    }
  });

  // Create new event
  app.post("/api/events", requireAuth, requirePermission("calendar.create"), async (req: AuthRequest, res: Response) => {
    try {
      const { title, description, type, startTime, endTime, allDay, location, meetingUrl, 
              clientId, projectId, assignedTo, attendees, reminderMinutes, color } = req.body;
      
      if (!title || !startTime || !endTime) {
        return res.status(400).json({ error: "Title, start time, and end time are required" });
      }
      
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: "Invalid date/time format" });
      }
      
      if (end <= start) {
        return res.status(400).json({ error: "End time must be after start time" });
      }
      
      // Validate attendees if provided
      const attendeeSchema = z.object({
        userId: z.string().optional(),
        email: z.string().email().optional(),
        name: z.string().optional(),
        isOptional: z.boolean().optional(),
      }).refine(data => data.userId || data.email, {
        message: "Attendee must have either userId or email",
      });
      
      if (attendees && Array.isArray(attendees)) {
        try {
          attendees.forEach((a: any) => attendeeSchema.parse(a));
        } catch (validationError: any) {
          return res.status(400).json({ 
            error: "Invalid attendee data", 
            details: validationError.errors 
          });
        }
      }
      
      // Create event
      const [event] = await db.insert(schema.events).values({
        organizationId: req.user!.organizationId!,
        title: String(title).trim(),
        description: description || null,
        type: type || 'meeting',
        startTime: start,
        endTime: end,
        allDay: allDay || false,
        location: location || null,
        meetingUrl: meetingUrl || null,
        clientId: clientId || null,
        projectId: projectId || null,
        assignedTo: assignedTo || null,
        organizerId: req.user!.id,
        reminderMinutes: reminderMinutes || [15],
        color: color || null,
        createdBy: req.user!.id,
      }).returning();
      
      // Add attendees if provided
      if (attendees && Array.isArray(attendees) && attendees.length > 0) {
        const attendeeRecords = attendees.map((a: any) => ({
          eventId: event.id,
          userId: a.userId || null,
          email: a.email || null,
          name: a.name || null,
          isOptional: a.isOptional || false,
          isOrganizer: a.userId === req.user!.id,
        }));
        
        await db.insert(schema.eventAttendees).values(attendeeRecords);
      }
      
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "event", event.id, event, req);
      res.status(201).json(event);
    } catch (error: any) {
      console.error("Failed to create event:", error);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  // Update event
  app.patch("/api/events/:id", requireAuth, requirePermission("calendar.update"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await db.select().from(schema.events)
        .where(and(
          eq(schema.events.id, req.params.id),
          eq(schema.events.organizationId, req.user!.organizationId!)
        ))
        .limit(1);
      
      if (!existing.length) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      const [updated] = await db.update(schema.events)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(eq(schema.events.id, req.params.id))
        .returning();
      
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "event", req.params.id, req.body, req);
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update event:", error);
      res.status(500).json({ error: "Failed to update event" });
    }
  });

  // Delete event
  app.delete("/api/events/:id", requireAuth, requirePermission("calendar.delete"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await db.select().from(schema.events)
        .where(and(
          eq(schema.events.id, req.params.id),
          eq(schema.events.organizationId, req.user!.organizationId!)
        ))
        .limit(1);
      
      if (!existing.length) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      await db.delete(schema.events).where(eq(schema.events.id, req.params.id));
      await logActivity(req.user!.id, req.user!.organizationId!, "delete", "event", req.params.id, null, req);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete event:", error);
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  // RSVP to event
  app.post("/api/events/:id/rsvp", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { rsvpStatus } = req.body; // 'accepted', 'declined', 'tentative'
      
      if (!['accepted', 'declined', 'tentative'].includes(rsvpStatus)) {
        return res.status(400).json({ error: "Invalid RSVP status" });
      }
      
      // Check if attendee record exists
      const existing = await db.select().from(schema.eventAttendees)
        .where(and(
          eq(schema.eventAttendees.eventId, req.params.id),
          eq(schema.eventAttendees.userId, req.user!.id)
        ))
        .limit(1);
      
      if (!existing.length) {
        return res.status(404).json({ error: "You are not invited to this event" });
      }
      
      const [updated] = await db.update(schema.eventAttendees)
        .set({
          rsvpStatus,
          rsvpAt: new Date(),
        })
        .where(and(
          eq(schema.eventAttendees.eventId, req.params.id),
          eq(schema.eventAttendees.userId, req.user!.id)
        ))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to RSVP:", error);
      res.status(500).json({ error: "Failed to RSVP" });
    }
  });

  // ==================== Time Off Requests ====================
  
  // Get all time-off requests for organization
  app.get("/api/time-off", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { status, userId } = req.query;
      
      // Build WHERE conditions
      const conditions: any[] = [eq(schema.timeOffRequests.organizationId, req.user!.organizationId!)];
      
      if (status && status !== 'all') {
        conditions.push(eq(schema.timeOffRequests.status, status as string));
      }
      if (userId) {
        conditions.push(eq(schema.timeOffRequests.userId, userId as string));
      }
      
      const requests = await db.select().from(schema.timeOffRequests)
        .where(and(...conditions))
        .orderBy(desc(schema.timeOffRequests.createdAt));
      
      res.json(requests);
    } catch (error: any) {
      console.error("Failed to fetch time-off requests:", error);
      res.status(500).json({ error: "Failed to fetch time-off requests" });
    }
  });

  // Create time-off request
  app.post("/api/time-off", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { type, reason, startDate, endDate, isHalfDay, halfDayPeriod } = req.body;
      
      if (!type || !startDate || !endDate) {
        return res.status(400).json({ error: "Type, start date, and end date are required" });
      }
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      if (end < start) {
        return res.status(400).json({ error: "End date must be on or after start date" });
      }
      
      // Calculate total days
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const totalDays = isHalfDay ? 0.5 : daysDiff;
      
      const [request] = await db.insert(schema.timeOffRequests).values({
        organizationId: req.user!.organizationId!,
        userId: req.user!.id,
        type,
        reason: reason || null,
        startDate: start,
        endDate: end,
        isHalfDay: isHalfDay || false,
        halfDayPeriod: halfDayPeriod || null,
        totalDays,
      }).returning();
      
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "time_off_request", request.id, request, req);
      res.status(201).json(request);
    } catch (error: any) {
      console.error("Failed to create time-off request:", error);
      res.status(500).json({ error: "Failed to create time-off request" });
    }
  });

  // Approve/deny time-off request
  app.patch("/api/time-off/:id/status", requireAuth, requirePermission("time_off.approve"), async (req: AuthRequest, res: Response) => {
    try {
      const { status, denialReason } = req.body;
      
      if (!['approved', 'denied'].includes(status)) {
        return res.status(400).json({ error: "Status must be 'approved' or 'denied'" });
      }
      
      const existing = await db.select().from(schema.timeOffRequests)
        .where(and(
          eq(schema.timeOffRequests.id, req.params.id),
          eq(schema.timeOffRequests.organizationId, req.user!.organizationId!)
        ))
        .limit(1);
      
      if (!existing.length) {
        return res.status(404).json({ error: "Time-off request not found" });
      }
      
      const updateData: any = {
        status,
        approvedBy: req.user!.id,
        approvedAt: new Date(),
      };
      
      if (status === 'denied' && denialReason) {
        updateData.denialReason = denialReason;
      }
      
      // If approved, create calendar event
      if (status === 'approved') {
        const [event] = await db.insert(schema.events).values({
          organizationId: req.user!.organizationId!,
          title: `${existing[0].type.toUpperCase()} - Time Off`,
          description: existing[0].reason,
          type: 'pto',
          startTime: existing[0].startDate,
          endTime: existing[0].endDate,
          allDay: !existing[0].isHalfDay,
          organizerId: existing[0].userId,
          assignedTo: existing[0].userId,
          createdBy: req.user!.id,
        }).returning();
        
        updateData.eventId = event.id;
      }
      
      const [updated] = await db.update(schema.timeOffRequests)
        .set(updateData)
        .where(eq(schema.timeOffRequests.id, req.params.id))
        .returning();
      
      await logActivity(req.user!.id, req.user!.organizationId!, status === 'approved' ? "approve" : "deny", "time_off_request", req.params.id, updateData, req);
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update time-off request:", error);
      res.status(500).json({ error: "Failed to update time-off request" });
    }
  });

  // Email Templates
  app.get("/api/email-templates", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      // Super admin (platform-scoped) can see all templates
      if (!req.user!.organizationId) {
        const allTemplates = await db.select().from(schema.emailTemplates).orderBy(schema.emailTemplates.category, schema.emailTemplates.name);
        return res.json(allTemplates);
      }
      const templates = await storage.getEmailTemplatesByOrganization(req.user!.organizationId);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch email templates" });
    }
  });

  app.get("/api/email-templates/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const template = await storage.getEmailTemplate(req.params.id, req.user!.organizationId!);
      if (!template) {
        return res.status(404).json({ error: "Email template not found" });
      }
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch email template" });
    }
  });

  app.post("/api/email-templates", requireAuth, requirePermission("templates.create"), async (req: AuthRequest, res: Response) => {
    try {
      // Prepare data with defaults and user context for validation
      const dataToValidate = {
        ...req.body,
        variables: req.body.variables || [],
        isDefault: false,
        usageCount: 0,
        scope: req.user!.organizationId ? 'organization' : 'global', // Super admin creates global templates
        organizationId: req.user!.organizationId || null, // Allow null for super admin
        createdBy: req.user!.id,
      };
      
      // Validate request body
      const validatedData = insertEmailTemplateSchema.parse(dataToValidate);
      
      const template = await storage.createEmailTemplate(validatedData);
      await logActivity(req.user!.id, req.user!.organizationId || undefined, "create", "email_template", template.id, template, req);
      res.status(201).json(template);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        console.error("Email template validation error:", error.errors);
        return res.status(400).json({ error: "Invalid template data", details: error.errors });
      }
      console.error("Email template creation error:", error);
      res.status(500).json({ error: "Failed to create email template" });
    }
  });

  app.patch("/api/email-templates/:id", requireAuth, requirePermission("templates.update"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getEmailTemplate(req.params.id, req.user!.organizationId!);
      
      if (!existing) {
        return res.status(404).json({ error: "Email template not found" });
      }
      
      // Check if user is trying to edit a global template
      if (existing.organizationId === null) {
        // Only admins can modify global templates
        const user = await storage.getUser(req.user!.id);
        const isAdmin = user?.role?.name === "Admin" || user?.role?.name === "Super Admin";
        
        if (!isAdmin) {
          return res.status(403).json({ error: "Only admins can modify global templates" });
        }
      }

      // Validate partial update
      const validatedData = insertEmailTemplateSchema.partial().parse(req.body);
      
      const updated = await storage.updateEmailTemplate(req.params.id, req.user!.organizationId!, validatedData);
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "email_template", req.params.id, validatedData, req);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid template data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update email template" });
    }
  });

  app.delete("/api/email-templates/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      // Get user to check role
      const user = await storage.getUser(req.user!.id);
      const isAdmin = user?.role?.name === "Admin" || user?.role?.name === "Super Admin";
      
      // Admins and Super Admins can ALWAYS delete templates
      if (!isAdmin) {
        // Non-admins need templates.delete permission
        const { getEffectivePermissions } = await import('./rbac-subscription-bridge');
        const effectivePermissions = await getEffectivePermissions(
          req.user!.id,
          req.user!.roleId,
          req.user!.organizationId
        );
        const hasPermission = effectivePermissions.some(p => p.name === 'templates.delete');
        
        if (!hasPermission) {
          return res.status(403).json({ 
            error: "Insufficient permissions", 
            required: "templates.delete" 
          });
        }
      }
      
      const existing = await storage.getEmailTemplate(req.params.id, req.user!.organizationId!);
      if (!existing) {
        return res.status(404).json({ error: "Email template not found" });
      }
      
      // Only admins can delete global templates (organizationId === null)
      if (existing.organizationId === null && !isAdmin) {
        return res.status(403).json({ error: "Only admins can delete global templates" });
      }

      await storage.deleteEmailTemplate(req.params.id, req.user!.organizationId!);
      await logActivity(req.user!.id, req.user!.organizationId!, "delete", "email_template", req.params.id, {}, req);
      res.json({ success: true, message: "Email template deleted successfully" });
    } catch (error: any) {
      console.error('Delete email template error:', error);
      res.status(500).json({ error: "Failed to delete email template" });
    }
  });

  // Message Templates
  app.get("/api/message-templates", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        const allTemplates = await db.select().from(schema.messageTemplates).orderBy(schema.messageTemplates.category, schema.messageTemplates.name);
        return res.json(allTemplates);
      }
      const templates = await storage.getMessageTemplatesByOrganization(req.user!.organizationId);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch message templates" });
    }
  });

  app.get("/api/message-templates/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const template = await storage.getMessageTemplate(req.params.id, req.user!.organizationId!);
      if (!template) {
        return res.status(404).json({ error: "Message template not found" });
      }
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch message template" });
    }
  });

  app.post("/api/message-templates", requireAuth, requirePermission("templates.create"), async (req: AuthRequest, res: Response) => {
    try {
      const dataToValidate = {
        ...req.body,
        variables: req.body.variables || [],
        isDefault: false,
        usageCount: 0,
        scope: req.user!.organizationId ? 'organization' : 'global', // Super admin creates global templates
        organizationId: req.user!.organizationId || null,
        createdBy: req.user!.id,
      };
      
      const validatedData = insertMessageTemplateSchema.parse(dataToValidate);
      
      const template = await storage.createMessageTemplate(validatedData);
      await logActivity(req.user!.id, req.user!.organizationId || undefined, "create", "message_template", template.id, template, req);
      res.status(201).json(template);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        console.error("Message template validation error:", error.errors);
        return res.status(400).json({ error: "Invalid template data", details: error.errors });
      }
      console.error("Message template creation error:", error);
      res.status(500).json({ error: "Failed to create message template" });
    }
  });

  app.patch("/api/message-templates/:id", requireAuth, requirePermission("templates.update"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getMessageTemplate(req.params.id, req.user!.organizationId!);
      
      if (!existing) {
        return res.status(404).json({ error: "Message template not found" });
      }
      
      // Check if user is trying to edit a global template
      if (existing.organizationId === null) {
        // Only admins can edit global templates
        const user = await storage.getUser(req.user!.id);
        const isAdmin = user?.role?.name === "Admin" || user?.role?.name === "Super Admin";
        
        if (!isAdmin) {
          return res.status(403).json({ error: "Only admins can modify global templates" });
        }
      }

      const validatedData = insertMessageTemplateSchema.partial().parse(req.body);
      
      const updated = await storage.updateMessageTemplate(req.params.id, req.user!.organizationId!, validatedData);
      await logActivity(req.user!.id, req.user!.organizationId!, "update", "message_template", req.params.id, validatedData, req);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid template data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update message template" });
    }
  });

  app.delete("/api/message-templates/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      // Get user to check role
      const user = await storage.getUser(req.user!.id);
      const isAdmin = user?.role?.name === "Admin" || user?.role?.name === "Super Admin";
      
      // Admins and Super Admins can ALWAYS delete templates
      if (!isAdmin) {
        // Non-admins need templates.delete permission
        const { getEffectivePermissions } = await import('./rbac-subscription-bridge');
        const effectivePermissions = await getEffectivePermissions(
          req.user!.id,
          req.user!.roleId,
          req.user!.organizationId
        );
        const hasPermission = effectivePermissions.some(p => p.name === 'templates.delete');
        
        if (!hasPermission) {
          return res.status(403).json({ 
            error: "Insufficient permissions", 
            required: "templates.delete" 
          });
        }
      }
      
      const existing = await storage.getMessageTemplate(req.params.id, req.user!.organizationId!);
      if (!existing) {
        return res.status(404).json({ error: "Message template not found" });
      }
      
      // Only admins can delete global templates (organizationId === null)
      if (existing.organizationId === null && !isAdmin) {
        return res.status(403).json({ error: "Only admins can delete global templates" });
      }

      await storage.deleteMessageTemplate(req.params.id, req.user!.organizationId!);
      await logActivity(req.user!.id, req.user!.organizationId!, "delete", "message_template", req.params.id, {}, req);
      res.json({ success: true, message: "Message template deleted successfully" });
    } catch (error: any) {
      console.error('Delete message template error:', error);
      res.status(500).json({ error: "Failed to delete message template" });
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
      
      // Enrich each task with subtasks and checklists
      const enrichedTasks = await Promise.all(tasks.map(async (task) => {
        const [subtasks, checklists] = await Promise.all([
          storage.getSubtasksByTask(task.id),
          storage.getChecklistsByTask(task.id)
        ]);
        return {
          ...task,
          subtasks,
          checklists
        };
      }));
      
      res.json(enrichedTasks);
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
      
      // Create subtasks if provided
      if (req.body.subtasks && Array.isArray(req.body.subtasks)) {
        for (const subtask of req.body.subtasks) {
          await storage.createTaskSubtask({
            taskId: task.id,
            name: subtask.name,
            order: subtask.order || 0,
            status: subtask.status || "pending",
          });
        }
      }
      
      // Create checklists if provided
      if (req.body.checklists && Array.isArray(req.body.checklists)) {
        for (const checklist of req.body.checklists) {
          await storage.createTaskChecklist({
            taskId: task.id,
            item: checklist.item,
            order: checklist.order || 0,
            isChecked: checklist.isChecked || false,
          });
        }
      }
      
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
      const llmConfigService = getLLMConfigService();
      const llmConfig = await llmConfigService.getDefaultConfig(req.user!.organizationId!);
      
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

  // Create workflow task
  app.post("/api/workflow-tasks", requireAuth, requirePermission("workflows.edit"), async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = schema.insertWorkflowTaskSchema.parse(req.body);
      
      // Verify the step exists and belongs to user's organization
      const step = await storage.getWorkflowStep(validatedData.stepId);
      if (!step) {
        return res.status(404).json({ error: "Step not found" });
      }
      
      const stage = await storage.getWorkflowStage(step.stageId);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }
      
      const workflow = await storage.getWorkflow(stage.workflowId);
      if (!workflow || workflow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Unauthorized access to workflow" });
      }
      
      const task = await storage.createWorkflowTask(validatedData);
      await logActivity(req.user!.id, req.user!.organizationId!, "create", "workflow_task", task.id, task, req);
      res.status(201).json(task);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid task data", details: error.errors });
      }
      console.error('Error creating workflow task:', error);
      res.status(500).json({ error: "Failed to create workflow task" });
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

  // ==================== Task Dependencies Routes ====================

  // Create a task dependency
  app.post("/api/tasks/:taskId/dependencies", requireAuth, requirePermission("workflows.update"), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const { dependsOnTaskId, dependencyType, lag } = req.body;
      
      if (!dependsOnTaskId) {
        return res.status(400).json({ error: "dependsOnTaskId is required" });
      }

      const dependency = await TaskDependenciesService.createDependency(
        req.params.taskId,
        dependsOnTaskId,
        req.user!.organizationId,
        dependencyType || "finish-to-start",
        lag || 0
      );

      res.status(201).json(dependency);
    } catch (error: any) {
      if (error.message.includes("Unauthorized") || error.message.includes("same workflow")) {
        return res.status(403).json({ error: error.message });
      }
      res.status(400).json({ error: error.message || "Failed to create dependency" });
    }
  });

  // Delete a task dependency
  app.delete("/api/task-dependencies/:id", requireAuth, requirePermission("workflows.update"), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      await TaskDependenciesService.deleteDependency(req.params.id, req.user!.organizationId);
      res.status(204).send();
    } catch (error: any) {
      res.status(404).json({ error: error.message || "Dependency not found" });
    }
  });

  // Get dependencies for a specific task
  app.get("/api/tasks/:taskId/dependencies", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const dependencies = await TaskDependenciesService.getTaskDependencies(
        req.params.taskId,
        req.user!.organizationId
      );

      res.json(dependencies);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch dependencies" });
    }
  });

  // Get all dependencies in a workflow
  app.get("/api/workflows/:workflowId/dependencies", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      // Get all tasks in the workflow
      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      if (workflow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Unauthorized access to workflow" });
      }

      // Get all task IDs in this workflow
      const stages = await storage.getWorkflowStages(req.params.workflowId);
      const taskIds: string[] = [];
      
      for (const stage of stages) {
        const steps = await storage.getWorkflowSteps(stage.id);
        for (const step of steps) {
          const tasks = await storage.getWorkflowTasks(step.id);
          taskIds.push(...tasks.map(t => t.id));
        }
      }

      const dependencies = await TaskDependenciesService.getWorkflowDependencies(
        taskIds,
        req.user!.organizationId
      );

      res.json(dependencies);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch workflow dependencies" });
    }
  });

  // Calculate critical path for a workflow
  app.post("/api/workflows/:workflowId/critical-path", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      if (workflow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Unauthorized access to workflow" });
      }

      // Get all task IDs in this workflow
      const stages = await storage.getWorkflowStages(req.params.workflowId);
      const taskIds: string[] = [];
      
      for (const stage of stages) {
        const steps = await storage.getWorkflowSteps(stage.id);
        for (const step of steps) {
          const tasks = await storage.getWorkflowTasks(step.id);
          taskIds.push(...tasks.map(t => t.id));
        }
      }

      const result = await TaskDependenciesService.calculateCriticalPath(
        taskIds,
        req.user!.organizationId
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to calculate critical path" });
    }
  });

  // Validate workflow dependencies (check for cycles)
  app.post("/api/workflows/:workflowId/validate-dependencies", requireAuth, requirePermission("workflows.view"), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const workflow = await storage.getWorkflow(req.params.workflowId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      if (workflow.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ error: "Unauthorized access to workflow" });
      }

      // Get all task IDs in this workflow
      const stages = await storage.getWorkflowStages(req.params.workflowId);
      const taskIds: string[] = [];
      
      for (const stage of stages) {
        const steps = await storage.getWorkflowSteps(stage.id);
        for (const step of steps) {
          const tasks = await storage.getWorkflowTasks(step.id);
          taskIds.push(...tasks.map(t => t.id));
        }
      }

      const validation = await TaskDependenciesService.validateWorkflowDependencies(
        taskIds,
        req.user!.organizationId
      );

      res.json(validation);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to validate dependencies" });
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

  // Get workload insights for team members
  app.get("/api/analytics/workload-insights", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const [users, assignments, tasks, timeEntries] = await Promise.all([
        storage.getUsersByOrganization(req.user!.organizationId),
        storage.getWorkflowAssignmentsByOrganization(req.user!.organizationId),
        db.select().from(schema.assignmentTasks).where(eq(schema.assignmentTasks.organizationId, req.user!.organizationId)),
        db.select().from(schema.timeEntries).where(eq(schema.timeEntries.organizationId, req.user!.organizationId))
      ]);

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const workloadData = users.map(user => {
        const userAssignments = assignments.filter(a => a.assignedTo === user.id);
        const userTasks = tasks.filter((t: any) => t.assignedTo === user.id);
        const userTimeEntries = timeEntries.filter(t => t.userId === user.id);

        const activeAssignments = userAssignments.filter(a => a.status === 'active' || a.status === 'not-started');
        const completedAssignments = userAssignments.filter(a => a.status === 'completed');
        
        const activeTasks = userTasks.filter((t: any) => t.status !== 'done' && t.status !== 'cancelled');
        const overdueTasks = activeTasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < now);
        const completedTasks = userTasks.filter((t: any) => t.status === 'done');

        const recentTimeEntries = userTimeEntries.filter(t => new Date(t.date) >= thirtyDaysAgo);
        const totalHours = recentTimeEntries.reduce((sum, t) => sum + parseFloat(t.hours || '0'), 0);
        const billableHours = recentTimeEntries.filter(t => t.isBillable).reduce((sum, t) => sum + parseFloat(t.hours || '0'), 0);

        const avgTasksPerAssignment = userAssignments.length > 0 
          ? userTasks.length / userAssignments.length 
          : 0;

        const completionRate = (completedTasks.length + completedAssignments.length) > 0
          ? ((completedTasks.length + completedAssignments.length) / (userTasks.length + userAssignments.length)) * 100
          : 0;

        return {
          userId: user.id,
          userName: user.fullName,
          userEmail: user.email,
          role: user.role,
          workload: {
            activeAssignments: activeAssignments.length,
            completedAssignments: completedAssignments.length,
            activeTasks: activeTasks.length,
            overdueTasks: overdueTasks.length,
            completedTasks: completedTasks.length,
            totalTasks: userTasks.length,
          },
          hours: {
            total: parseFloat(totalHours.toFixed(2)),
            billable: parseFloat(billableHours.toFixed(2)),
            nonBillable: parseFloat((totalHours - billableHours).toFixed(2)),
            billablePercentage: totalHours > 0 ? parseFloat((billableHours / totalHours * 100).toFixed(1)) : 0,
          },
          metrics: {
            avgTasksPerAssignment: parseFloat(avgTasksPerAssignment.toFixed(1)),
            completionRate: parseFloat(completionRate.toFixed(1)),
            workloadScore: activeAssignments.length * 10 + activeTasks.length * 2 + overdueTasks.length * 5,
          }
        };
      });

      const sortedByWorkload = workloadData.sort((a, b) => b.metrics.workloadScore - a.metrics.workloadScore);

      const teamTotals = {
        activeAssignments: sortedByWorkload.reduce((sum, u) => sum + u.workload.activeAssignments, 0),
        activeTasks: sortedByWorkload.reduce((sum, u) => sum + u.workload.activeTasks, 0),
        overdueTasks: sortedByWorkload.reduce((sum, u) => sum + u.workload.overdueTasks, 0),
        totalHours: parseFloat(sortedByWorkload.reduce((sum, u) => sum + u.hours.total, 0).toFixed(2)),
        avgCompletionRate: parseFloat((sortedByWorkload.reduce((sum, u) => sum + u.metrics.completionRate, 0) / sortedByWorkload.length).toFixed(1)),
      };

      res.json({
        teamMembers: sortedByWorkload,
        teamTotals,
        timestamp: now.toISOString(),
      });
    } catch (error: any) {
      console.error("Workload insights error:", error);
      res.status(500).json({ error: "Failed to fetch workload insights" });
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
      const llmConfigService = getLLMConfigService();
      const llmConfig = await llmConfigService.getDefaultConfig(req.user!.organizationId!);

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

      const isAzure = llmConfig.provider === 'azure_openai' || llmConfig.provider === 'azure';
      if (llmConfig.provider === 'openai' || isAzure) {
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({
          apiKey: decryptedCredentials.apiKey,
          ...(isAzure && {
            baseURL: `${decryptedCredentials.endpoint}/openai/deployments/${decryptedCredentials.deploymentName}`,
            defaultQuery: { 'api-version': decryptedCredentials.apiVersion || '2024-02-15-preview' },
            defaultHeaders: { 'api-key': decryptedCredentials.apiKey },
          })
        });

        const completion = await openai.chat.completions.create({
          model: isAzure ? decryptedCredentials.deploymentName : (llmConfig.modelName || 'gpt-4'),
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
      const { password, ...restBody } = req.body;
      
      // Schema without server-controlled fields
      const clientSchema = schema.insertEmailAccountSchema.omit({
        organizationId: true,
        userId: true,
      });
      
      let accountData: any = { ...restBody };
      
      // SECURITY: Encrypt IMAP password server-side using AES-256-GCM
      if (restBody.provider === 'imap' && password) {
        const imapCredentials = JSON.stringify({
          user: restBody.email,
          pass: password
        });
        accountData.encryptedCredentials = cryptoUtils.encrypt(imapCredentials);
      }
      
      const validatedData = clientSchema.parse(accountData);
      
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

  // Test IMAP connection
  app.post("/api/email-accounts/test-imap", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { host, port, secure, user, password } = req.body;
      
      if (!host || !port || !user || !password) {
        return res.status(400).json({ error: "Missing required IMAP configuration" });
      }

      const { ImapEmailService } = await import('./email-sync/imap-service');
      const service = new ImapEmailService();
      
      const isValid = await service.testConnection({
        host,
        port: parseInt(port),
        secure: secure !== false,
        auth: { user, pass: password }
      });

      if (isValid) {
        res.json({ success: true, message: "IMAP connection successful" });
      } else {
        res.status(400).json({ error: "IMAP connection failed" });
      }
    } catch (error: any) {
      console.error('IMAP test error:', error);
      res.status(500).json({ error: "Failed to test IMAP connection: " + error.message });
    }
  });

  // Sync emails for an account
  app.post("/api/email-accounts/:id/sync", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const account = await storage.getEmailAccount(req.params.id);
      if (!account || account.organizationId !== req.user!.organizationId) {
        return res.status(404).json({ error: "Email account not found" });
      }

      let emails: any[] = [];

      if (account.provider === 'gmail') {
        const { GmailOAuthService } = await import('./email-sync/gmail-oauth');
        const service = new GmailOAuthService({
          redirectUri: `${req.protocol}://${req.get('host')}/api/email-accounts/oauth/gmail/callback`
        });
        
        const gmailMessages = await service.fetchEmails(account.encryptedCredentials, 50);
        
        emails = gmailMessages.map((msg: any) => {
          const headers = msg.payload?.headers || [];
          const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value || '';
          
          return {
            messageId: msg.id,
            from: getHeader('From'),
            to: [getHeader('To')],
            subject: getHeader('Subject'),
            body: msg.snippet || '',
            sentAt: new Date(parseInt(msg.internalDate)),
            isRead: !msg.labelIds?.includes('UNREAD')
          };
        });
      } else if (account.provider === 'outlook') {
        const { OutlookOAuthService } = await import('./email-sync/outlook-oauth');
        const service = new OutlookOAuthService({
          redirectUri: `${req.protocol}://${req.get('host')}/api/email-accounts/oauth/outlook/callback`
        });
        
        const outlookMessages = await service.fetchEmails(account.encryptedCredentials, 50);
        
        emails = outlookMessages.map((msg: any) => ({
          messageId: msg.id,
          from: msg.from?.emailAddress?.address || '',
          to: msg.toRecipients?.map((r: any) => r.emailAddress.address) || [],
          cc: msg.ccRecipients?.map((r: any) => r.emailAddress.address) || [],
          subject: msg.subject || '',
          body: msg.bodyPreview || '',
          bodyHtml: msg.body?.content || '',
          sentAt: new Date(msg.sentDateTime),
          isRead: msg.isRead
        }));
      } else if (account.provider === 'imap' || account.provider === 'exchange') {
        const { ImapEmailService } = await import('./email-sync/imap-service');
        const service = new ImapEmailService();
        
        emails = await service.fetchEmails(
          account.encryptedCredentials,
          account.imapHost!,
          account.imapPort!,
          account.useSsl !== false,
          50
        );
      }

      for (const email of emails) {
        const existing = await storage.getEmailMessageByExternalId(email.messageId);
        if (!existing) {
          await storage.createEmailMessage({
            emailAccountId: account.id,
            organizationId: account.organizationId,
            messageId: email.messageId,
            from: email.from,
            to: email.to,
            cc: email.cc || [],
            bcc: email.bcc || [],
            subject: email.subject,
            body: email.body,
            bodyHtml: email.bodyHtml,
            sentAt: email.sentAt,
            isRead: email.isRead
          });
        }
      }

      await storage.updateEmailAccount(account.id, {
        lastSyncAt: new Date(),
        status: 'active'
      });

      res.json({ 
        success: true, 
        synced: emails.length,
        message: `Successfully synced ${emails.length} emails` 
      });
    } catch (error: any) {
      console.error('Email sync error:', error);
      
      await storage.updateEmailAccount(req.params.id, {
        status: 'error',
        lastSyncError: error.message
      });
      
      res.status(500).json({ error: "Failed to sync emails: " + error.message });
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
      const llmConfigService = getLLMConfigService();
      const defaultConfig = await llmConfigService.getDefaultConfig(req.user!.organizationId!);

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
          const llmConfigService = getLLMConfigService();
          const defaultConfig = await llmConfigService.getDefaultConfig(req.user!.organizationId!);

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

  // ==================== 21-DAY ONBOARDING SYSTEM ====================
  
  // Get current user's onboarding progress
  app.get("/api/onboarding/progress", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const progress = await storage.getOnboardingProgressByUser(req.userId!);
      
      if (!progress) {
        return res.status(404).json({ error: "Onboarding progress not found" });
      }
      
      // Get all tasks for this progress
      const tasks = await storage.getOnboardingTasksByProgress(progress.id);
      
      // Transform tasks to match frontend interface (requiredForDay → isRequired)
      const transformedTasks = tasks.map(task => ({
        ...task,
        isRequired: task.requiredForDay,
      }));
      
      // Get active nudges (not dismissed)
      const nudges = await storage.getOnboardingNudgesByProgress(progress.id);
      const activeNudges = nudges.filter(n => !n.isDismissed);
      
      res.json({
        progress,
        tasks: transformedTasks,
        activeNudges,
      });
    } catch (error: any) {
      console.error('Get onboarding progress error:', error);
      res.status(500).json({ error: "Failed to fetch onboarding progress" });
    }
  });
  
  // Initialize onboarding progress for current user
  app.post("/api/onboarding/progress", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user!.organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }
      
      // Check if progress already exists
      const existing = await storage.getOnboardingProgressByUser(req.userId!);
      if (existing) {
        return res.status(400).json({ error: "Onboarding progress already exists for this user" });
      }
      
      // Get organization to determine region
      const org = await storage.getOrganization(req.user!.organizationId);
      const region = org?.region || 'USA';
      
      const validationSchema = schema.insertOnboardingProgressSchema.omit({
        userId: true,
        organizationId: true,
      });
      
      const validatedData = validationSchema.parse({
        region,
        ...req.body,
      });
      
      const progress = await storage.createOnboardingProgress({
        ...validatedData,
        userId: req.userId!,
        organizationId: req.user!.organizationId,
      });
      
      // Check if Day 1 tasks already exist (idempotency)
      const existingTasks = await storage.getOnboardingTasksByDay(progress.id, 1);
      
      if (existingTasks.length === 0) {
        // Create Day 1 tasks automatically (only schema-compliant fields)
        const day1Tasks = [
          {
            progressId: progress.id,
            day: 1,
            taskId: 'view-client-overview',
            taskType: 'exploration',
            title: 'Explore Client Management',
            description: 'Take a tour of the Clients page to understand how to manage your client relationships',
            requiredForDay: true,
            points: 50,
          },
          {
            progressId: progress.id,
            day: 1,
            taskId: 'complete-profile',
            taskType: 'profile',
            title: 'Complete Your Profile',
            description: 'Add your personal details and preferences to personalize your experience',
            requiredForDay: true,
            points: 100,
          },
          {
            progressId: progress.id,
            day: 1,
            taskId: 'explore-dashboard',
            taskType: 'exploration',
            title: 'Explore Your Dashboard',
            description: 'Get familiar with your dashboard and understand key metrics',
            requiredForDay: false,
            points: 30,
          },
        ];
        
        // Create all Day 1 tasks
        for (const task of day1Tasks) {
          await storage.createOnboardingTask(task);
        }
        
        await logActivity(req.userId, req.user!.organizationId, "create", "onboarding_progress", progress.id, { day: 1, tasksCreated: day1Tasks.length }, req);
      } else {
        await logActivity(req.userId, req.user!.organizationId, "create", "onboarding_progress", progress.id, { day: 1, tasksCreated: 0, note: 'Tasks already exist' }, req);
      }
      
      res.status(201).json(progress);
    } catch (error: any) {
      console.error('Create onboarding progress error:', error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid onboarding data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to initialize onboarding" });
    }
  });
  
  // Update onboarding progress (advance day, update streaks, unlock features, etc.)
  app.patch("/api/onboarding/progress/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const existing = await storage.getOnboardingProgressByUser(req.userId!);
      
      if (!existing || existing.id !== req.params.id) {
        return res.status(404).json({ error: "Onboarding progress not found" });
      }
      
      const updateSchema = z.object({
        currentDay: z.number().min(1).max(21).optional(),
        isCompleted: z.boolean().optional(),
        totalScore: z.number().optional(),
        currentStreak: z.number().optional(),
        longestStreak: z.number().optional(),
        completedSteps: z.array(z.string()).optional(),
        unlockedFeatures: z.array(z.string()).optional(),
        badges: z.any().optional(),
        lastActivityAt: z.coerce.date().optional(),
        lastLoginAt: z.coerce.date().optional(),
        loginDates: z.array(z.string()).optional(),
        skipWalkthroughs: z.boolean().optional(),
        enableNudges: z.boolean().optional(),
        metadata: z.any().optional(),
      });
      
      const validatedUpdates = updateSchema.parse(req.body);
      
      const progress = await storage.updateOnboardingProgress(req.params.id, validatedUpdates);
      
      await logActivity(req.userId, req.user!.organizationId, "update", "onboarding_progress", req.params.id, validatedUpdates, req);
      res.json(progress);
    } catch (error: any) {
      console.error('Update onboarding progress error:', error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update onboarding progress" });
    }
  });
  
  // Get tasks for current day
  app.get("/api/onboarding/tasks/day/:day", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const progress = await storage.getOnboardingProgressByUser(req.userId!);
      
      if (!progress) {
        return res.status(404).json({ error: "Onboarding progress not found" });
      }
      
      const day = parseInt(req.params.day);
      if (isNaN(day) || day < 1 || day > 21) {
        return res.status(400).json({ error: "Invalid day number (must be 1-21)" });
      }
      
      const tasks = await storage.getOnboardingTasksByDay(progress.id, day);
      res.json(tasks);
    } catch (error: any) {
      console.error('Get onboarding tasks error:', error);
      res.status(500).json({ error: "Failed to fetch onboarding tasks" });
    }
  });
  
  // Create a new onboarding task (typically done programmatically)
  // SECURITY: Only authenticated user can create tasks for their own progress
  app.post("/api/onboarding/tasks", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Always use authenticated user's progress, never trust client-supplied progressId
      const progress = await storage.getOnboardingProgressByUser(req.userId!);
      
      if (!progress) {
        return res.status(404).json({ error: "Onboarding progress not found" });
      }
      
      const validationSchema = schema.insertOnboardingTaskSchema.omit({
        progressId: true, // SECURITY: Server-controlled, never from client
      });
      
      const validatedData = validationSchema.parse(req.body);
      
      const task = await storage.createOnboardingTask({
        ...validatedData,
        progressId: progress.id, // SECURITY: Force user's own progress
      });
      
      await logActivity(req.userId, req.user!.organizationId, "create", "onboarding_task", task.id, { day: task.day, title: task.title }, req);
      res.status(201).json(task);
    } catch (error: any) {
      console.error('Create onboarding task error:', error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid task data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create onboarding task" });
    }
  });
  
  // Complete an onboarding task (awards points, updates progress, checks day advancement)
  // SECURITY: Verify task belongs to authenticated user's progress
  // RATE LIMIT: Prevent abuse and race conditions (20 completions per minute)
  app.post("/api/onboarding/tasks/:taskId/complete", requireAuth, rateLimit(20, 60 * 1000), async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Get authenticated user's progress
      const progress = await storage.getOnboardingProgressByUser(req.userId!);
      
      if (!progress) {
        return res.status(404).json({ error: "Onboarding progress not found" });
      }
      
      // SECURITY: Verify task belongs to this user's progress (ownership check)
      const tasks = await storage.getOnboardingTasksByProgress(progress.id);
      const task = tasks.find(t => t.id === req.params.taskId);
      
      if (!task) {
        // SECURITY: Task either doesn't exist or belongs to another user - return 403
        return res.status(403).json({ error: "Access denied: Task not found or does not belong to your account" });
      }
      
      if (task.isCompleted) {
        return res.status(400).json({ error: "Task already completed" });
      }
      
      // Complete the task
      const completedTask = await storage.completeOnboardingTask(req.params.taskId);
      
      // Update progress: award points
      const newScore = progress.totalScore + task.points;
      await storage.updateOnboardingProgress(progress.id, {
        totalScore: newScore,
        lastActivityAt: new Date(),
      });
      
      await logActivity(req.userId, req.user!.organizationId, "complete", "onboarding_task", task.id, { points: task.points }, req);
      
      // Check if all required tasks for current day are complete and advance if needed
      const { OnboardingProgressService } = await import('./onboardingProgressService');
      const progressService = new OnboardingProgressService(storage);
      const advanceResult = await progressService.checkAndAdvance(progress.id);
      
      res.json({ 
        task: completedTask, 
        newScore,
        dayAdvancement: advanceResult.advanced ? {
          newDay: advanceResult.newDay,
          tasksCreated: advanceResult.tasksCreated,
        } : undefined,
      });
    } catch (error: any) {
      console.error('Complete onboarding task error:', error);
      res.status(500).json({ error: "Failed to complete task" });
    }
  });
  
  // Create a contextual nudge
  // SECURITY: Only authenticated user can create nudges for their own progress
  app.post("/api/onboarding/nudges", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Always use authenticated user's progress, never trust client-supplied progressId
      const progress = await storage.getOnboardingProgressByUser(req.userId!);
      
      if (!progress) {
        return res.status(404).json({ error: "Onboarding progress not found" });
      }
      
      const validationSchema = schema.insertOnboardingNudgeSchema.omit({
        progressId: true, // SECURITY: Server-controlled, never from client
      });
      
      const validatedData = validationSchema.parse(req.body);
      
      const nudge = await storage.createOnboardingNudge({
        ...validatedData,
        progressId: progress.id, // SECURITY: Force user's own progress
      });
      
      res.status(201).json(nudge);
    } catch (error: any) {
      console.error('Create onboarding nudge error:', error);
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid nudge data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create nudge" });
    }
  });
  
  // Dismiss a nudge
  // SECURITY: Verify nudge belongs to authenticated user's progress
  app.post("/api/onboarding/nudges/:nudgeId/dismiss", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      // SECURITY: Get authenticated user's progress
      const progress = await storage.getOnboardingProgressByUser(req.userId!);
      
      if (!progress) {
        return res.status(404).json({ error: "Onboarding progress not found" });
      }
      
      // SECURITY: Verify nudge belongs to this user's progress (ownership check)
      const nudges = await storage.getOnboardingNudgesByProgress(progress.id);
      const nudge = nudges.find(n => n.id === req.params.nudgeId);
      
      if (!nudge) {
        // SECURITY: Nudge either doesn't exist or belongs to another user - return 403
        return res.status(403).json({ error: "Access denied: Nudge not found or does not belong to your account" });
      }
      
      const dismissedNudge = await storage.dismissOnboardingNudge(req.params.nudgeId);
      res.json(dismissedNudge);
    } catch (error: any) {
      console.error('Dismiss nudge error:', error);
      res.status(500).json({ error: "Failed to dismiss nudge" });
    }
  });
  
  // Track nudge interaction (shown, dismissed, action_taken)
  // SECURITY: Tracks analytics only, no sensitive operations
  app.post("/api/onboarding/nudges/track", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { nudgeId, action, trigger } = req.body;
      
      if (!nudgeId || !action) {
        return res.status(400).json({ error: "Missing required fields: nudgeId, action" });
      }
      
      // Log for analytics (you can extend this to store in a tracking table)
      await logActivity(
        req.userId, 
        req.user!.organizationId, 
        action, 
        "onboarding_nudge", 
        nudgeId, 
        { trigger }, 
        req
      );
      
      res.json({ success: true, tracked: { nudgeId, action, trigger } });
    } catch (error: any) {
      console.error('Track nudge error:', error);
      res.status(500).json({ error: "Failed to track nudge" });
    }
  });
  
  // ==================== SUPER ADMIN ROUTES ====================
  // These routes are only accessible to platform-scoped Super Admins (organizationId is null)

  // Get dashboard metrics (real-time data)
  app.get("/api/admin/dashboard/metrics", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      // Organizations metrics
      const totalOrganizations = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.organizations)
        .then(r => r[0]?.count || 0);

      // Users metrics
      const totalUsers = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.users)
        .then(r => r[0]?.count || 0);

      const activeUsers = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.users)
        .where(eq(schema.users.isActive, true))
        .then(r => r[0]?.count || 0);

      // Marketplace metrics
      const totalMarketplaceItems = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.marketplaceItems)
        .then(r => r[0]?.count || 0);

      const publishedTemplates = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.marketplaceItems)
        .where(eq(schema.marketplaceItems.status, 'published'))
        .then(r => r[0]?.count || 0);

      const totalInstallations = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.marketplaceInstallations)
        .then(r => r[0]?.count || 0);

      // Support tickets metrics
      const totalTickets = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.supportTickets)
        .then(r => r[0]?.count || 0);

      const openTickets = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.supportTickets)
        .where(eq(schema.supportTickets.status, 'open'))
        .then(r => r[0]?.count || 0);

      const urgentTickets = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.supportTickets)
        .where(sql`${schema.supportTickets.priority} = 'urgent' AND ${schema.supportTickets.status} IN ('open', 'in_progress')`)
        .then(r => r[0]?.count || 0);

      // Subscriptions metrics
      const totalSubscriptions = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.platformSubscriptions)
        .then(r => r[0]?.count || 0);

      const activeSubscriptions = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.platformSubscriptions)
        .where(eq(schema.platformSubscriptions.status, 'active'))
        .then(r => r[0]?.count || 0);

      const trialSubscriptions = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.platformSubscriptions)
        .where(eq(schema.platformSubscriptions.status, 'trial'))
        .then(r => r[0]?.count || 0);

      // Calculate MRR (Monthly Recurring Revenue)
      const mrrResult = await db
        .select({ total: sql<string>`COALESCE(SUM(mrr), 0)` })
        .from(schema.platformSubscriptions)
        .where(eq(schema.platformSubscriptions.status, 'active'))
        .then(r => r[0]?.total || '0');

      res.json({
        organizations: {
          total: totalOrganizations,
        },
        users: {
          total: totalUsers,
          active: activeUsers,
        },
        marketplace: {
          totalItems: totalMarketplaceItems,
          published: publishedTemplates,
          installations: totalInstallations,
        },
        support: {
          total: totalTickets,
          open: openTickets,
          urgent: urgentTickets,
        },
        subscriptions: {
          total: totalSubscriptions,
          active: activeSubscriptions,
          trial: trialSubscriptions,
          mrr: parseFloat(mrrResult),
        },
      });
    } catch (error: any) {
      console.error('Get dashboard metrics error:', error);
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  // Get all organizations with subscription details
  app.get("/api/admin/organizations", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const orgs = await storage.getAllOrganizations();
      const orgsWithDetails = await Promise.all(
        orgs.map(async (org) => {
          const subscription = await storage.getPlatformSubscriptionByOrganization(org.id);
          return {
            ...org,
            subscription,
          };
        })
      );

      res.json(orgsWithDetails);
    } catch (error: any) {
      console.error('Get organizations error:', error);
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  });

  // Get all subscriptions
  app.get("/api/admin/subscriptions", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const subscriptions = await storage.getAllPlatformSubscriptions();
      const subscriptionsWithOrgs = await Promise.all(
        subscriptions.map(async (sub) => {
          const org = await storage.getOrganization(sub.organizationId);
          return {
            ...sub,
            organization: org,
          };
        })
      );

      res.json(subscriptionsWithOrgs);
    } catch (error: any) {
      console.error('Get subscriptions error:', error);
      res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });

  // Get subscription details by ID
  app.get("/api/admin/subscriptions/:id", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const [subscription] = await db
        .select()
        .from(schema.platformSubscriptions)
        .where(eq(schema.platformSubscriptions.id, id))
        .limit(1);
      
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }
      
      const org = await storage.getOrganization(subscription.organizationId);
      const plan = await db
        .select()
        .from(schema.subscriptionPlans)
        .where(eq(schema.subscriptionPlans.id, subscription.planId))
        .limit(1)
        .then(r => r[0] || null);
      
      const events = await db
        .select()
        .from(schema.subscriptionEvents)
        .where(eq(schema.subscriptionEvents.subscriptionId, id))
        .orderBy(desc(schema.subscriptionEvents.createdAt))
        .limit(50);
      
      res.json({
        ...subscription,
        organization: org,
        plan,
        events,
      });
    } catch (error: any) {
      console.error('Get subscription details error:', error);
      res.status(500).json({ error: "Failed to fetch subscription details" });
    }
  });

  // Update subscription status (manual override for Super Admin)
  app.patch("/api/admin/subscriptions/:id/status", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;
      
      if (!status || !['active', 'trial', 'past_due', 'canceled', 'paused'].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      
      const [subscription] = await db
        .select()
        .from(schema.platformSubscriptions)
        .where(eq(schema.platformSubscriptions.id, id))
        .limit(1);
      
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }
      
      await db
        .update(schema.platformSubscriptions)
        .set({
          status,
          updatedAt: new Date(),
          ...(status === 'canceled' ? { canceledAt: new Date() } : {}),
        })
        .where(eq(schema.platformSubscriptions.id, id));
      
      // Log subscription event
      await db.insert(schema.subscriptionEvents).values({
        id: crypto.randomUUID(),
        subscriptionId: id,
        eventType: 'status_updated',
        eventData: { oldStatus: subscription.status, newStatus: status, reason, updatedBy: req.user!.id },
        createdAt: new Date(),
      });
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user!.id,
        organizationId: subscription.organizationId,
        action: 'subscription.status_updated',
        entityType: 'subscription',
        entityId: id,
        metadata: { oldStatus: subscription.status, newStatus: status, reason },
      });
      
      res.json({ message: "Subscription status updated successfully" });
    } catch (error: any) {
      console.error('Update subscription status error:', error);
      res.status(500).json({ error: "Failed to update subscription status" });
    }
  });

  // Cancel subscription (manual cancellation by Super Admin)
  app.post("/api/admin/subscriptions/:id/cancel", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason, immediate } = req.body;
      
      const [subscription] = await db
        .select()
        .from(schema.platformSubscriptions)
        .where(eq(schema.platformSubscriptions.id, id))
        .limit(1);
      
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }
      
      if (subscription.status === 'canceled') {
        return res.status(400).json({ error: "Subscription is already canceled" });
      }
      
      const updateData: any = {
        updatedAt: new Date(),
      };
      
      if (immediate) {
        updateData.status = 'canceled';
        updateData.canceledAt = new Date();
      } else {
        // Schedule cancellation at end of current period
        updateData.cancelAtPeriodEnd = true;
      }
      
      await db
        .update(schema.platformSubscriptions)
        .set(updateData)
        .where(eq(schema.platformSubscriptions.id, id));
      
      // Cancel Stripe subscription if exists
      if (subscription.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
        try {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2024-11-20.acacia'
          });
          
          await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: !immediate,
          });
          
          if (immediate) {
            await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
          }
        } catch (stripeError: any) {
          console.error('Stripe cancellation error:', stripeError);
          // Continue even if Stripe fails - we've updated our database
        }
      }
      
      // Log subscription event
      await db.insert(schema.subscriptionEvents).values({
        id: crypto.randomUUID(),
        subscriptionId: id,
        eventType: 'subscription_canceled',
        eventData: { reason, immediate, canceledBy: req.user!.id },
        createdAt: new Date(),
      });
      
      // Log activity
      await storage.createActivityLog({
        userId: req.user!.id,
        organizationId: subscription.organizationId,
        action: 'subscription.canceled',
        entityType: 'subscription',
        entityId: id,
        metadata: { reason, immediate },
      });
      
      res.json({ 
        message: immediate 
          ? "Subscription canceled immediately" 
          : "Subscription will be canceled at the end of the current billing period" 
      });
    } catch (error: any) {
      console.error('Cancel subscription error:', error);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // Subscription analytics endpoints
  app.get("/api/admin/analytics/subscription-metrics", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      // Get all active subscriptions
      const activeSubscriptions = await db
        .select()
        .from(schema.platformSubscriptions)
        .where(eq(schema.platformSubscriptions.status, 'active'));
      
      // Calculate MRR (Monthly Recurring Revenue)
      const mrr = activeSubscriptions.reduce((sum, sub) => sum + parseFloat(sub.mrr || '0'), 0);
      
      // Calculate ARR (Annual Recurring Revenue)
      const arr = mrr * 12;
      
      // Total active subscriptions
      const totalActive = activeSubscriptions.length;
      
      // Trial subscriptions
      const trialCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.platformSubscriptions)
        .where(eq(schema.platformSubscriptions.status, 'trial'))
        .then(r => r[0]?.count || 0);
      
      // Past due subscriptions
      const pastDueCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.platformSubscriptions)
        .where(eq(schema.platformSubscriptions.status, 'past_due'))
        .then(r => r[0]?.count || 0);
      
      // Canceled this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const canceledThisMonth = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.platformSubscriptions)
        .where(sql`${schema.platformSubscriptions.status} = 'canceled' AND ${schema.platformSubscriptions.canceledAt} >= ${startOfMonth}`)
        .then(r => r[0]?.count || 0);
      
      // New subscriptions this month
      const newThisMonth = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.platformSubscriptions)
        .where(sql`${schema.platformSubscriptions.createdAt} >= ${startOfMonth}`)
        .then(r => r[0]?.count || 0);
      
      // Churn rate (canceled / (active + canceled) this month)
      const churnRate = totalActive > 0 
        ? (canceledThisMonth / (totalActive + canceledThisMonth)) * 100 
        : 0;
      
      // Subscription distribution by plan
      const planDistribution = await db
        .select({
          planId: schema.platformSubscriptions.planId,
          planSlug: schema.platformSubscriptions.planSlug,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.platformSubscriptions)
        .where(eq(schema.platformSubscriptions.status, 'active'))
        .groupBy(schema.platformSubscriptions.planId, schema.platformSubscriptions.planSlug);
      
      // Get plan names
      const planDistributionWithNames = await Promise.all(
        planDistribution.map(async (dist) => {
          const plan = await db
            .select()
            .from(schema.subscriptionPlans)
            .where(eq(schema.subscriptionPlans.id, dist.planId))
            .limit(1)
            .then(r => r[0] || null);
          
          return {
            planName: plan?.name || dist.planSlug,
            count: dist.count,
          };
        })
      );
      
      res.json({
        mrr: parseFloat(mrr.toFixed(2)),
        arr: parseFloat(arr.toFixed(2)),
        activeSubscriptions: totalActive,
        trialSubscriptions: trialCount,
        pastDueSubscriptions: pastDueCount,
        newThisMonth,
        canceledThisMonth,
        churnRate: parseFloat(churnRate.toFixed(2)),
        planDistribution: planDistributionWithNames,
      });
    } catch (error: any) {
      console.error('Get subscription metrics error:', error);
      res.status(500).json({ error: "Failed to fetch subscription metrics" });
    }
  });

  // Revenue trends over time
  app.get("/api/admin/analytics/revenue-trends", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { months = 12 } = req.query;
      const monthsNum = parseInt(months as string) || 12;
      
      // Get subscription events for the period
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsNum);
      
      const subscriptions = await db
        .select()
        .from(schema.platformSubscriptions)
        .where(sql`${schema.platformSubscriptions.createdAt} >= ${startDate}`);
      
      // Group by month
      const monthlyData = new Map<string, { month: string; mrr: number; newSubs: number; canceledSubs: number; }>();
      
      // Initialize all months
      for (let i = monthsNum - 1; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
        monthlyData.set(monthKey, { month: monthKey, mrr: 0, newSubs: 0, canceledSubs: 0 });
      }
      
      // Calculate MRR snapshots and subscription counts
      for (const sub of subscriptions) {
        const createdMonth = new Date(sub.createdAt).toISOString().slice(0, 7);
        if (monthlyData.has(createdMonth)) {
          monthlyData.get(createdMonth)!.newSubs++;
        }
        
        if (sub.canceledAt) {
          const canceledMonth = new Date(sub.canceledAt).toISOString().slice(0, 7);
          if (monthlyData.has(canceledMonth)) {
            monthlyData.get(canceledMonth)!.canceledSubs++;
          }
        }
      }
      
      // Calculate cumulative MRR for each month
      const allActiveByMonth = await Promise.all(
        Array.from(monthlyData.keys()).map(async (monthKey) => {
          const endOfMonth = new Date(monthKey + '-01');
          endOfMonth.setMonth(endOfMonth.getMonth() + 1);
          
          const activeSubs = await db
            .select()
            .from(schema.platformSubscriptions)
            .where(sql`
              ${schema.platformSubscriptions.status} = 'active' 
              AND ${schema.platformSubscriptions.createdAt} < ${endOfMonth}
              AND (${schema.platformSubscriptions.canceledAt} IS NULL OR ${schema.platformSubscriptions.canceledAt} >= ${endOfMonth})
            `);
          
          const mrr = activeSubs.reduce((sum, sub) => sum + parseFloat(sub.mrr || '0'), 0);
          return { monthKey, mrr };
        })
      );
      
      // Update monthly data with MRR
      for (const { monthKey, mrr } of allActiveByMonth) {
        if (monthlyData.has(monthKey)) {
          monthlyData.get(monthKey)!.mrr = parseFloat(mrr.toFixed(2));
        }
      }
      
      res.json(Array.from(monthlyData.values()).sort((a, b) => a.month.localeCompare(b.month)));
    } catch (error: any) {
      console.error('Get revenue trends error:', error);
      res.status(500).json({ error: "Failed to fetch revenue trends" });
    }
  });

  // Subscription lifecycle analytics
  app.get("/api/admin/analytics/subscription-lifecycle", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      // Get all subscriptions
      const allSubscriptions = await db
        .select()
        .from(schema.platformSubscriptions);
      
      // Calculate lifecycle metrics
      const statusDistribution = {
        active: allSubscriptions.filter(s => s.status === 'active').length,
        trial: allSubscriptions.filter(s => s.status === 'trial').length,
        past_due: allSubscriptions.filter(s => s.status === 'past_due').length,
        canceled: allSubscriptions.filter(s => s.status === 'canceled').length,
        paused: allSubscriptions.filter(s => s.status === 'paused').length,
      };
      
      // Billing cycle distribution
      const billingCycleDistribution = {
        monthly: allSubscriptions.filter(s => s.status === 'active' && s.billingCycle === 'monthly').length,
        annual: allSubscriptions.filter(s => s.status === 'active' && s.billingCycle === 'annual').length,
      };
      
      // Average subscription value
      const activeSubs = allSubscriptions.filter(s => s.status === 'active');
      const avgMonthlyValue = activeSubs.length > 0
        ? activeSubs.reduce((sum, s) => sum + parseFloat(s.mrr || '0'), 0) / activeSubs.length
        : 0;
      
      const avgAnnualValue = activeSubs.filter(s => s.billingCycle === 'annual').length > 0
        ? activeSubs.filter(s => s.billingCycle === 'annual').reduce((sum, s) => sum + parseFloat(s.mrr || '0'), 0) * 12 / activeSubs.filter(s => s.billingCycle === 'annual').length
        : 0;
      
      // Trial to paid conversion rate
      const totalTrials = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.subscriptionEvents)
        .where(sql`${schema.subscriptionEvents.eventType} = 'trial_started'`)
        .then(r => r[0]?.count || 0);
      
      const convertedTrials = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.subscriptionEvents)
        .where(sql`${schema.subscriptionEvents.eventType} = 'trial_converted'`)
        .then(r => r[0]?.count || 0);
      
      const trialConversionRate = totalTrials > 0 ? (convertedTrials / totalTrials) * 100 : 0;
      
      res.json({
        statusDistribution,
        billingCycleDistribution,
        avgMonthlyValue: parseFloat(avgMonthlyValue.toFixed(2)),
        avgAnnualValue: parseFloat(avgAnnualValue.toFixed(2)),
        trialConversionRate: parseFloat(trialConversionRate.toFixed(2)),
        totalSubscriptions: allSubscriptions.length,
      });
    } catch (error: any) {
      console.error('Get subscription lifecycle error:', error);
      res.status(500).json({ error: "Failed to fetch subscription lifecycle analytics" });
    }
  });

  // Get all platform users
  app.get("/api/admin/users", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithDetails = await Promise.all(
        users.map(async (user) => {
          const role = await storage.getRole(user.roleId);
          const org = user.organizationId ? await storage.getOrganization(user.organizationId) : null;
          return {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            isActive: user.isActive,
            roleName: role?.name || "Unknown",
            organization: org,
            createdAt: user.createdAt,
          };
        })
      );

      res.json(usersWithDetails);
    } catch (error: any) {
      console.error('Get all users error:', error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Get all users with KYC information (admin only)
  app.get("/api/admin/kyc/users", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      // Explicitly whitelist safe fields to prevent leaking sensitive data (password hashes, tokens, etc.)
      const usersWithDetails = await Promise.all(
        users.map(async (user) => {
          const role = await storage.getRole(user.roleId);
          const org = user.organizationId ? await storage.getOrganization(user.organizationId) : null;
          
          // SECURITY: Explicitly return only non-sensitive fields
          return {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            phoneVerified: user.phoneVerified,
            dateOfBirth: user.dateOfBirth,
            nationalId: user.nationalId,
            nationalIdType: user.nationalIdType,
            address: user.address,
            city: user.city,
            state: user.state,
            zipCode: user.zipCode,
            country: user.country,
            emergencyContactName: user.emergencyContactName,
            emergencyContactPhone: user.emergencyContactPhone,
            emergencyContactRelation: user.emergencyContactRelation,
            idDocumentUrl: user.idDocumentUrl,
            addressProofUrl: user.addressProofUrl,
            kycStatus: user.kycStatus,
            kycVerifiedAt: user.kycVerifiedAt,
            kycRejectionReason: user.kycRejectionReason,
            roleName: role?.name || "Unknown",
            organization: org ? {
              id: org.id,
              name: org.name,
              slug: org.slug,
            } : null,
          };
        })
      );

      res.json(usersWithDetails);
    } catch (error: any) {
      console.error('Get KYC users error:', error);
      res.status(500).json({ error: "Failed to fetch KYC users" });
    }
  });

  // Update user KYC status (admin only)
  app.patch("/api/admin/users/:id/kyc-status", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      // Validate status
      const validStatuses = ["pending", "in_review", "verified", "rejected"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid KYC status" });
      }

      // If rejecting, require a reason
      if (status === "rejected" && !reason) {
        return res.status(400).json({ error: "Rejection reason is required" });
      }

      const updateData: any = {
        kycStatus: status,
      };

      // Set verification timestamp for verified status
      if (status === "verified") {
        updateData.kycVerifiedAt = new Date();
        updateData.kycRejectionReason = null; // Clear any previous rejection reason
      }

      // Set rejection reason for rejected status
      if (status === "rejected") {
        updateData.kycRejectionReason = reason;
        updateData.kycVerifiedAt = null; // Clear verification timestamp
      }

      // Clear rejection reason if status is not rejected
      if (status !== "rejected") {
        updateData.kycRejectionReason = null;
      }

      const user = await storage.updateUser(id, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await logActivity(req.userId, req.user!.organizationId || undefined, "update", "user", id, { 
        action: "kyc_status_update", 
        newStatus: status,
        reason: reason || undefined
      }, req);

      res.json({ ...user, password: undefined });
    } catch (error: any) {
      console.error('Update KYC status error:', error);
      res.status(500).json({ error: "Failed to update KYC status" });
    }
  });

  // Get all support tickets (across all organizations)
  app.get("/api/admin/tickets", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const tickets = await storage.getAllSupportTickets();
      const ticketsWithDetails = await Promise.all(
        tickets.map(async (ticket) => {
          const org = await storage.getOrganization(ticket.organizationId);
          const createdBy = await storage.getUser(ticket.createdBy);
          const assignedTo = ticket.assignedTo ? await storage.getUser(ticket.assignedTo) : null;
          return {
            ...ticket,
            organization: org,
            createdBy: createdBy ? {
              id: createdBy.id,
              firstName: createdBy.firstName,
              lastName: createdBy.lastName,
              email: createdBy.email,
            } : null,
            assignedTo: assignedTo ? {
              id: assignedTo.id,
              firstName: assignedTo.firstName,
              lastName: assignedTo.lastName,
            } : null,
          };
        })
      );

      res.json(ticketsWithDetails);
    } catch (error: any) {
      console.error('Get tickets error:', error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  // Get single admin ticket with details
  app.get("/api/admin/tickets/:id", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const ticket = await storage.getSupportTicket(id);
      
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const org = await storage.getOrganization(ticket.organizationId);
      const createdBy = await storage.getUser(ticket.createdBy);
      const assignedTo = ticket.assignedTo ? await storage.getUser(ticket.assignedTo) : null;
      const resolvedBy = ticket.resolvedBy ? await storage.getUser(ticket.resolvedBy) : null;

      const ticketWithDetails = {
        ...ticket,
        organization: org,
        createdBy: createdBy ? {
          id: createdBy.id,
          firstName: createdBy.firstName,
          lastName: createdBy.lastName,
          email: createdBy.email,
        } : null,
        assignedTo: assignedTo ? {
          id: assignedTo.id,
          firstName: assignedTo.firstName,
          lastName: assignedTo.lastName,
          email: assignedTo.email,
        } : null,
        resolvedBy: resolvedBy ? {
          id: resolvedBy.id,
          firstName: resolvedBy.firstName,
          lastName: resolvedBy.lastName,
        } : null,
      };

      res.json(ticketWithDetails);
    } catch (error: any) {
      console.error('Get ticket error:', error);
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  // Get comments for admin ticket
  app.get("/api/admin/tickets/:id/comments", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const ticket = await storage.getSupportTicket(id);
      
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const comments = await storage.getTicketComments(id);
      const commentsWithDetails = await Promise.all(
        comments.map(async (comment) => {
          const createdBy = await storage.getUser(comment.createdBy);
          return {
            ...comment,
            createdBy: createdBy ? {
              id: createdBy.id,
              firstName: createdBy.firstName,
              lastName: createdBy.lastName,
              email: createdBy.email,
            } : null,
          };
        })
      );

      res.json(commentsWithDetails);
    } catch (error: any) {
      console.error('Get ticket comments error:', error);
      res.status(500).json({ error: "Failed to fetch ticket comments" });
    }
  });

  // Add comment to admin ticket
  app.post("/api/admin/tickets/:id/comments", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const ticket = await storage.getSupportTicket(id);
      
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      const comment = await storage.createSupportTicketComment({
        ticketId: id,
        content: req.body.content,
        createdBy: req.userId!,
        isInternal: req.body.isInternal || false,
        attachments: req.body.attachments || []
      });

      await logActivity(req.userId, req.user!.organizationId || undefined, "comment", "support_ticket", id, {}, req);
      res.status(201).json(comment);
    } catch (error: any) {
      console.error('Add comment error:', error);
      res.status(500).json({ error: "Failed to add comment" });
    }
  });

  // Create platform subscription
  app.post("/api/admin/subscriptions", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const subscriptionData = insertPlatformSubscriptionSchema.parse(req.body);
      const subscription = await storage.createPlatformSubscription(subscriptionData);
      res.status(201).json(subscription);
    } catch (error: any) {
      console.error('Create subscription error:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid subscription data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create subscription" });
    }
  });

  // Update platform subscription
  app.patch("/api/admin/subscriptions/:id", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = insertPlatformSubscriptionSchema.partial().parse(req.body);
      const subscription = await storage.updatePlatformSubscription(id, updates);
      
      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }
      
      res.json(subscription);
    } catch (error: any) {
      console.error('Update subscription error:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid subscription data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update subscription" });
    }
  });

  // Update support ticket
  app.patch("/api/admin/tickets/:id", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = insertSupportTicketSchema.partial().parse(req.body);
      const ticket = await storage.updateSupportTicket(id, updates);
      
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      
      res.json(ticket);
    } catch (error: any) {
      console.error('Update ticket error:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid ticket data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update ticket" });
    }
  });

  // Create organization
  app.post("/api/admin/organizations", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const orgData = insertOrganizationSchema.parse(req.body);
      const organization = await storage.createOrganization(orgData);
      res.status(201).json(organization);
    } catch (error: any) {
      console.error('Create organization error:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid organization data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create organization" });
    }
  });

  // Update organization
  app.patch("/api/admin/organizations/:id", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = insertOrganizationSchema.partial().parse(req.body);
      const organization = await storage.updateOrganization(id, updates);
      
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      res.json(organization);
    } catch (error: any) {
      console.error('Update organization error:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid organization data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update organization" });
    }
  });

  // ============================================================================
  // Live Chat Support Routes (Edge Subscription)
  // ============================================================================

  // Get all live chat conversations for the current user
  app.get("/api/live-chat/conversations", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Fetch subscription data
      let subscription = null;
      if (user.organizationId) {
        subscription = await storage.getPlatformSubscriptionByOrganization(user.organizationId);
      }
      
      // Check access using shared utility
      const { canAccessLiveChat } = await import("../shared/accessControl");
      const accessCheck = canAccessLiveChat({
        id: user.id,
        isActive: user.isActive,
        createdAt: user.createdAt,
        kycStatus: user.kycStatus,
        subscription: subscription ? { plan: subscription.plan, status: subscription.status } : null
      });
      
      // Agents always have access
      const isAgent = user.role === 'superadmin' || user.role === 'admin';
      
      if (!accessCheck.allowed && !isAgent) {
        return res.status(403).json({ error: accessCheck.reason || "Access denied" });
      }
      
      // Get conversations based on user role
      let conversations;
      if (isAgent) {
        // Agents can see conversations they're assigned to or all from their org
        if (user.organizationId) {
          conversations = await storage.getLiveChatConversationsByOrganization(user.organizationId);
        } else {
          conversations = await storage.getLiveChatConversationsByAgent(userId);
        }
      } else {
        // Regular users can only see their own conversations
        conversations = await storage.getLiveChatConversationsByUser(userId);
      }
      
      res.json({ conversations });
    } catch (error: any) {
      console.error('Get live chat conversations error:', error);
      res.status(500).json({ error: "Failed to get conversations" });
    }
  });

  // Create a new live chat conversation
  app.post("/api/live-chat/conversations", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user || !user.organizationId) {
        return res.status(404).json({ error: "User or organization not found" });
      }
      
      // Agents always have access
      const isAgent = user.role === 'superadmin' || user.role === 'admin';
      
      if (!isAgent) {
        // Fetch subscription data for non-agents
        let subscription = null;
        if (user.organizationId) {
          subscription = await storage.getPlatformSubscriptionByOrganization(user.organizationId);
        }
        
        // Check access
        const { canAccessLiveChat } = await import("../shared/accessControl");
        const accessCheck = canAccessLiveChat({
          id: user.id,
          isActive: user.isActive,
          createdAt: user.createdAt,
          kycStatus: user.kycStatus,
          subscription: subscription ? { plan: subscription.plan, status: subscription.status } : null
        });
        
        if (!accessCheck.allowed) {
          return res.status(403).json({ error: accessCheck.reason || "Access denied" });
        }
      }
      
      const { subject, priority } = req.body;
      
      // Find an available agent
      const availableAgents = await storage.getAvailableAgents();
      const assignedAgent = availableAgents.length > 0 ? availableAgents[0] : null;
      
      const conversation = await storage.createLiveChatConversation({
        organizationId: user.organizationId,
        userId,
        subject: subject || "Support Request",
        status: "active",
        priority: priority || "normal",
        assignedAgentId: assignedAgent?.userId || null,
        assignedAt: assignedAgent ? new Date() : null,
        messageCount: 0,
        tags: [],
        metadata: {}
      });
      
      // Update agent availability if assigned
      if (assignedAgent) {
        await storage.updateAgentAvailability(assignedAgent.userId, {
          currentChatCount: assignedAgent.currentChatCount + 1
        });
      }
      
      res.json({ conversation });
    } catch (error: any) {
      console.error('Create live chat conversation error:', error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Get messages for a conversation
  app.get("/api/live-chat/conversations/:id/messages", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Fetch subscription data
      let subscription = null;
      if (user.organizationId) {
        subscription = await storage.getPlatformSubscriptionByOrganization(user.organizationId);
      }
      
      // Check access to live chat
      const { canAccessLiveChat } = await import("../shared/accessControl");
      const accessCheck = canAccessLiveChat({
        id: user.id,
        isActive: user.isActive,
        createdAt: user.createdAt,
        kycStatus: user.kycStatus,
        subscription: subscription ? { plan: subscription.plan, status: subscription.status } : null
      });
      
      const isAgent = user.role === 'superadmin' || user.role === 'admin';
      
      if (!accessCheck.allowed && !isAgent) {
        return res.status(403).json({ error: accessCheck.reason || "Access denied" });
      }
      
      // Verify user has access to this conversation
      const conversation = await storage.getLiveChatConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const canAccess = conversation.userId === userId || 
                       conversation.assignedAgentId === userId || 
                       isAgent;
      
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied to this conversation" });
      }
      
      const messages = await storage.getLiveChatMessages(id);
      res.json({ messages });
    } catch (error: any) {
      console.error('Get live chat messages error:', error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  // Get agent availability status
  app.get("/api/live-chat/agents/availability", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const isAgent = user.role === 'admin' || user.role === 'superadmin';
      
      if (!isAgent) {
        return res.status(403).json({ error: "Access denied - agents only" });
      }
      
      const availability = await storage.getAllAgentAvailability();
      res.json({ availability });
    } catch (error: any) {
      console.error('Get agent availability error:', error);
      res.status(500).json({ error: "Failed to get agent availability" });
    }
  });

  // Update conversation status (assign, resolve, close)
  app.patch("/api/live-chat/conversations/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const isAgent = user.role === 'admin' || user.role === 'superadmin';
      
      if (!isAgent) {
        return res.status(403).json({ error: "Only agents can update conversations" });
      }
      
      const { status, assignedAgentId, priority } = req.body;
      const updates: any = {};
      
      if (status) updates.status = status;
      if (priority) updates.priority = priority;
      if (assignedAgentId !== undefined) {
        updates.assignedAgentId = assignedAgentId;
        updates.assignedAt = assignedAgentId ? new Date() : null;
      }
      
      if (status === 'resolved') {
        updates.resolvedAt = new Date();
      } else if (status === 'closed') {
        updates.closedAt = new Date();
      }
      
      const conversation = await storage.updateLiveChatConversation(id, updates);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      res.json({ conversation });
    } catch (error: any) {
      console.error('Update live chat conversation error:', error);
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  // ============================================================================
  // AI Agent Foundry Routes
  // ============================================================================

  // Get available agents for current user
  app.get("/api/agents/available", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const organizationId = req.user!.organizationId;
      const userRole = req.user!.role?.name?.toLowerCase() || "user";
      
      // Get user's organization to check subscription plan
      let subscriptionPlan = "free";
      if (organizationId) {
        const org = await storage.getOrganizationById(organizationId);
        if (org) {
          // Get organization's subscription
          const subscription = await db
            .select()
            .from(platformSubscriptions)
            .where(eq(platformSubscriptions.organizationId, organizationId))
            .limit(1);
          
          if (subscription.length > 0) {
            subscriptionPlan = subscription[0].plan;
          }
        }
      }
      
      const { agentRegistry } = await import("./agent-registry");
      const agents = await agentRegistry.getAvailableAgents(userId, organizationId, userRole, subscriptionPlan);
      
      res.json({ agents });
    } catch (error: any) {
      console.error('Get available agents error:', error);
      res.status(500).json({ error: "Failed to get available agents" });
    }
  });

  // Get all agents (Super Admin only)
  app.get("/api/admin/agents", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { agentRegistry } = await import("./agent-registry");
      const agents = agentRegistry.getAllAgents();
      
      // Also get database info for each agent
      const agentsWithDb = await Promise.all(
        agents.map(async (agent) => {
          const dbAgent = await db
            .select()
            .from(aiAgents)
            .where(eq(aiAgents.slug, agent.slug))
            .limit(1);
          
          return {
            ...agent,
            isPublished: dbAgent.length > 0 ? dbAgent[0].isPublished : false,
            publishedAt: dbAgent.length > 0 ? dbAgent[0].publishedAt : null,
          };
        })
      );
      
      res.json({ agents: agentsWithDb });
    } catch (error: any) {
      console.error('Get all agents error:', error);
      res.status(500).json({ error: "Failed to get agents" });
    }
  });

  // Publish agent (Super Admin only)
  app.post("/api/admin/agents/:slug/publish", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { slug } = req.params;
      
      const agent = await db
        .select()
        .from(aiAgents)
        .where(eq(aiAgents.slug, slug))
        .limit(1);
      
      if (agent.length === 0) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      const updated = await db
        .update(aiAgents)
        .set({
          isPublished: true,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(aiAgents.id, agent[0].id))
        .returning();
      
      res.json({ agent: updated[0] });
    } catch (error: any) {
      console.error('Publish agent error:', error);
      res.status(500).json({ error: "Failed to publish agent" });
    }
  });

  // Unpublish agent (Super Admin only)
  app.post("/api/admin/agents/:slug/unpublish", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { slug } = req.params;
      
      const agent = await db
        .select()
        .from(aiAgents)
        .where(eq(aiAgents.slug, slug))
        .limit(1);
      
      if (agent.length === 0) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      const updated = await db
        .update(aiAgents)
        .set({
          isPublished: false,
          updatedAt: new Date(),
        })
        .where(eq(aiAgents.id, agent[0].id))
        .returning();
      
      res.json({ agent: updated[0] });
    } catch (error: any) {
      console.error('Unpublish agent error:', error);
      res.status(500).json({ error: "Failed to unpublish agent" });
    }
  });

  // Enable agent for organization (Admin only)
  app.post("/api/agents/:slug/enable", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { slug } = req.params;
      const organizationId = req.user!.organizationId;
      
      if (!organizationId) {
        return res.status(403).json({ error: "Platform admins cannot enable agents for organizations" });
      }
      
      // Validate agent exists and is published
      const agent = await db
        .select()
        .from(aiAgents)
        .where(eq(aiAgents.slug, slug))
        .limit(1);
      
      if (agent.length === 0) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      if (!agent[0].isPublished) {
        return res.status(403).json({ error: "Agent is not published" });
      }
      
      // Validate manifest exists
      const { agentRegistry } = await import("./agent-registry");
      const manifest = agentRegistry.getAgent(slug);
      if (!manifest) {
        return res.status(404).json({ error: "Agent manifest not found" });
      }
      
      // Check subscription requirement - bypass for cadence, forma, and parity (always free)
      const freeAgents = ['cadence', 'forma', 'parity'];
      const isFreeAgent = freeAgents.includes(slug);
      
      if (!isFreeAgent) {
        const subscription = await db
          .select()
          .from(platformSubscriptions)
          .where(eq(platformSubscriptions.organizationId, organizationId))
          .limit(1);
        
        const currentPlan = subscription.length > 0 ? subscription[0].plan : "free";
        const planHierarchy = ["free", "starter", "professional", "enterprise"];
        const userLevel = planHierarchy.indexOf(currentPlan);
        const requiredLevel = planHierarchy.indexOf(agent[0].subscriptionMinPlan || "free");
        
        if (userLevel < requiredLevel) {
          return res.status(403).json({ 
            error: `Agent requires ${agent[0].subscriptionMinPlan} plan or higher. Your organization has ${currentPlan} plan.` 
          });
        }
      }
      
      await agentRegistry.enableAgentForOrganization(slug, organizationId, req.user!.id);
      
      res.json({ success: true, message: "Agent enabled for organization" });
    } catch (error: any) {
      console.error('Enable agent error:', error);
      res.status(500).json({ error: error.message || "Failed to enable agent" });
    }
  });

  // Disable agent for organization (Admin only)
  app.post("/api/agents/:slug/disable", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { slug } = req.params;
      const organizationId = req.user!.organizationId;
      
      if (!organizationId) {
        return res.status(403).json({ error: "Platform admins cannot disable agents for organizations" });
      }
      
      const agent = await db
        .select()
        .from(aiAgents)
        .where(eq(aiAgents.slug, slug))
        .limit(1);
      
      if (agent.length === 0) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      await db
        .update(organizationAgents)
        .set({
          status: "disabled",
          disabledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(organizationAgents.organizationId, organizationId),
            eq(organizationAgents.agentId, agent[0].id)
          )
        );
      
      res.json({ success: true, message: "Agent disabled for organization" });
    } catch (error: any) {
      console.error('Disable agent error:', error);
      res.status(500).json({ error: "Failed to disable agent" });
    }
  });

  // Grant user access to agent (Admin only)
  app.post("/api/users/:userId/agents/:slug/grant", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { userId, slug } = req.params;
      const { accessLevel = "use" } = req.body;
      const organizationId = req.user!.organizationId;
      
      if (!organizationId) {
        return res.status(403).json({ error: "Platform admins cannot grant user agent access" });
      }
      
      // Validate agent exists and is published
      const agent = await db
        .select()
        .from(aiAgents)
        .where(eq(aiAgents.slug, slug))
        .limit(1);
      
      if (agent.length === 0) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      if (!agent[0].isPublished) {
        return res.status(403).json({ error: "Agent is not published" });
      }
      
      // Validate manifest exists
      const { agentRegistry } = await import("./agent-registry");
      const manifest = agentRegistry.getAgent(slug);
      if (!manifest) {
        return res.status(404).json({ error: "Agent manifest not found" });
      }
      
      // Check if organization has agent enabled
      const orgAgent = await db
        .select()
        .from(organizationAgents)
        .where(
          and(
            eq(organizationAgents.organizationId, organizationId),
            eq(organizationAgents.agentId, agent[0].id),
            eq(organizationAgents.status, "enabled")
          )
        )
        .limit(1);
      
      if (orgAgent.length === 0) {
        return res.status(403).json({ error: "Agent not enabled for your organization. Please enable it first." });
      }
      
      // Verify user belongs to same organization
      const userRecord = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      
      if (userRecord.length === 0 || userRecord[0].organizationId !== organizationId) {
        return res.status(403).json({ error: "User not in your organization" });
      }
      
      await agentRegistry.grantUserAccess(slug, userId, organizationId, req.user!.id, accessLevel);
      
      res.json({ success: true, message: "User access granted" });
    } catch (error: any) {
      console.error('Grant user access error:', error);
      res.status(500).json({ error: error.message || "Failed to grant access" });
    }
  });

  // Revoke user access to agent (Admin only)
  app.post("/api/users/:userId/agents/:slug/revoke", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { userId, slug } = req.params;
      const organizationId = req.user!.organizationId;
      
      if (!organizationId) {
        return res.status(403).json({ error: "Platform admins cannot revoke user agent access" });
      }
      
      // Verify user belongs to same organization
      const user = await storage.getUserById(userId);
      if (!user || user.organizationId !== organizationId) {
        return res.status(403).json({ error: "User not in your organization" });
      }
      
      const agent = await db
        .select()
        .from(aiAgents)
        .where(eq(aiAgents.slug, slug))
        .limit(1);
      
      if (agent.length === 0) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      await db
        .update(userAgentAccess)
        .set({
          revokedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userAgentAccess.userId, userId),
            eq(userAgentAccess.agentId, agent[0].id),
            eq(userAgentAccess.organizationId, organizationId)
          )
        );
      
      res.json({ success: true, message: "User access revoked" });
    } catch (error: any) {
      console.error('Revoke user access error:', error);
      res.status(500).json({ error: "Failed to revoke access" });
    }
  });

  // NOTE: Agent routes are now registered in server/init.ts AFTER the agent registry is initialized
  // This ensures all agents are loaded before route registration

  // ==================== Subscription Management Routes ====================
  // Note: These routes are for managing subscription plans, pricing regions, and coupons
  // They are separate from the user subscription assignment routes

  // Import pricing service
  const { PricingService } = await import("@shared/pricing-service");

  // Get all subscription plans (public)
  app.get("/api/subscription-plans", async (req: Request, res: Response) => {
    try {
      const { includeInactive } = req.query;
      
      const plans = await db
        .select()
        .from(schema.subscriptionPlans)
        .where(includeInactive === 'true' ? sql`true` : eq(schema.subscriptionPlans.isActive, true))
        .orderBy(schema.subscriptionPlans.displayOrder);
      
      res.json(plans);
    } catch (error: any) {
      console.error('Get subscription plans error:', error);
      res.status(500).json({ error: "Failed to fetch subscription plans" });
    }
  });

  // Get subscription plan by ID or slug
  app.get("/api/subscription-plans/:idOrSlug", async (req: Request, res: Response) => {
    try {
      const { idOrSlug } = req.params;
      
      const plans = await db
        .select()
        .from(schema.subscriptionPlans)
        .where(
          sql`${schema.subscriptionPlans.id} = ${idOrSlug} OR ${schema.subscriptionPlans.slug} = ${idOrSlug}`
        )
        .limit(1);
      
      if (plans.length === 0) {
        return res.status(404).json({ error: "Subscription plan not found" });
      }
      
      // Get volume tiers for this plan
      const volumeTiers = await db
        .select()
        .from(schema.planVolumeTiers)
        .where(eq(schema.planVolumeTiers.planId, plans[0].id))
        .orderBy(schema.planVolumeTiers.minSeats);
      
      res.json({ ...plans[0], volumeTiers });
    } catch (error: any) {
      console.error('Get subscription plan error:', error);
      res.status(500).json({ error: "Failed to fetch subscription plan" });
    }
  });

  // Create subscription plan (Super Admin only)
  app.post("/api/subscription-plans", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const planData = schema.insertSubscriptionPlanSchema.parse(req.body);
      
      const [newPlan] = await db
        .insert(schema.subscriptionPlans)
        .values(planData)
        .returning();
      
      await logActivity(req.user!.id, undefined, 'subscription_plan_created', 'subscription_plan', newPlan.id, { planName: newPlan.name }, req);
      
      res.json(newPlan);
    } catch (error: any) {
      console.error('Create subscription plan error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: "Plan with this name or slug already exists" });
      }
      res.status(500).json({ error: "Failed to create subscription plan" });
    }
  });

  // Update subscription plan (Super Admin only)
  app.patch("/api/subscription-plans/:id", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const [updatedPlan] = await db
        .update(schema.subscriptionPlans)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.subscriptionPlans.id, id))
        .returning();
      
      if (!updatedPlan) {
        return res.status(404).json({ error: "Subscription plan not found" });
      }
      
      await logActivity(req.user!.id, undefined, 'subscription_plan_updated', 'subscription_plan', id, updates, req);
      
      res.json(updatedPlan);
    } catch (error: any) {
      console.error('Update subscription plan error:', error);
      res.status(500).json({ error: "Failed to update subscription plan" });
    }
  });

  // Delete subscription plan (Super Admin only)
  app.delete("/api/subscription-plans/:id", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      // Check if any subscriptions are using this plan
      const activeSubscriptions = await db
        .select()
        .from(schema.platformSubscriptions)
        .where(eq(schema.platformSubscriptions.planId, id))
        .limit(1);
      
      if (activeSubscriptions.length > 0) {
        return res.status(400).json({ error: "Cannot delete plan with active subscriptions" });
      }
      
      await db
        .delete(schema.subscriptionPlans)
        .where(eq(schema.subscriptionPlans.id, id));
      
      await logActivity(req.user!.id, undefined, 'subscription_plan_deleted', 'subscription_plan', id, {}, req);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete subscription plan error:', error);
      res.status(500).json({ error: "Failed to delete subscription plan" });
    }
  });

  // Get all pricing regions (public)
  app.get("/api/pricing-regions", async (req: Request, res: Response) => {
    try {
      const { includeInactive } = req.query;
      
      const regions = await db
        .select()
        .from(schema.pricingRegions)
        .where(includeInactive === 'true' ? sql`true` : eq(schema.pricingRegions.isActive, true))
        .orderBy(schema.pricingRegions.displayOrder);
      
      res.json(regions);
    } catch (error: any) {
      console.error('Get pricing regions error:', error);
      res.status(500).json({ error: "Failed to fetch pricing regions" });
    }
  });

  // Create pricing region (Super Admin only)
  app.post("/api/pricing-regions", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const regionData = schema.insertPricingRegionSchema.parse(req.body);
      
      const [newRegion] = await db
        .insert(schema.pricingRegions)
        .values(regionData)
        .returning();
      
      await logActivity(req.user!.id, undefined, 'pricing_region_created', 'pricing_region', newRegion.id, { regionName: newRegion.name }, req);
      
      res.json(newRegion);
    } catch (error: any) {
      console.error('Create pricing region error:', error);
      res.status(500).json({ error: "Failed to create pricing region" });
    }
  });

  // Update pricing region (Super Admin only)
  app.patch("/api/pricing-regions/:id", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const [updatedRegion] = await db
        .update(schema.pricingRegions)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.pricingRegions.id, id))
        .returning();
      
      if (!updatedRegion) {
        return res.status(404).json({ error: "Pricing region not found" });
      }
      
      await logActivity(req.user!.id, undefined, 'pricing_region_updated', 'pricing_region', id, updates, req);
      
      res.json(updatedRegion);
    } catch (error: any) {
      console.error('Update pricing region error:', error);
      res.status(500).json({ error: "Failed to update pricing region" });
    }
  });

  // Delete pricing region (Super Admin only)
  app.delete("/api/pricing-regions/:id", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      await db
        .delete(schema.pricingRegions)
        .where(eq(schema.pricingRegions.id, id));
      
      await logActivity(req.user!.id, undefined, 'pricing_region_deleted', 'pricing_region', id, {}, req);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete pricing region error:', error);
      res.status(500).json({ error: "Failed to delete pricing region" });
    }
  });

  // Get all coupons (Super Admin only)
  app.get("/api/coupons", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { includeInactive } = req.query;
      
      const coupons = await db
        .select()
        .from(schema.coupons)
        .where(includeInactive === 'true' ? sql`true` : eq(schema.coupons.isActive, true))
        .orderBy(sql`${schema.coupons.createdAt} DESC`);
      
      res.json(coupons);
    } catch (error: any) {
      console.error('Get coupons error:', error);
      res.status(500).json({ error: "Failed to fetch coupons" });
    }
  });

  // Validate coupon code (public)
  app.post("/api/coupons/validate", async (req: Request, res: Response) => {
    try {
      const { code, planId, seatCount } = req.body;
      
      if (!code || !planId || !seatCount) {
        return res.status(400).json({ error: "Code, planId, and seatCount are required" });
      }
      
      const [coupon] = await db
        .select()
        .from(schema.coupons)
        .where(eq(schema.coupons.code, code.toUpperCase()))
        .limit(1);
      
      const validation = PricingService.validateCoupon(coupon || null, planId, seatCount);
      
      res.json(validation);
    } catch (error: any) {
      console.error('Validate coupon error:', error);
      res.status(500).json({ error: "Failed to validate coupon" });
    }
  });

  // Create coupon (Super Admin only)
  app.post("/api/coupons", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const couponData = schema.insertCouponSchema.parse({
        ...req.body,
        code: req.body.code.toUpperCase(),
        createdBy: req.user!.id,
      });
      
      const [newCoupon] = await db
        .insert(schema.coupons)
        .values(couponData)
        .returning();
      
      await logActivity(req.user!.id, undefined, 'coupon_created', 'coupon', newCoupon.id, { code: newCoupon.code }, req);
      
      res.json(newCoupon);
    } catch (error: any) {
      console.error('Create coupon error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: "Coupon code already exists" });
      }
      res.status(500).json({ error: "Failed to create coupon" });
    }
  });

  // Update coupon (Super Admin only)
  app.patch("/api/coupons/:id", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      if (updates.code) {
        updates.code = updates.code.toUpperCase();
      }
      
      const [updatedCoupon] = await db
        .update(schema.coupons)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.coupons.id, id))
        .returning();
      
      if (!updatedCoupon) {
        return res.status(404).json({ error: "Coupon not found" });
      }
      
      await logActivity(req.user!.id, undefined, 'coupon_updated', 'coupon', id, updates, req);
      
      res.json(updatedCoupon);
    } catch (error: any) {
      console.error('Update coupon error:', error);
      res.status(500).json({ error: "Failed to update coupon" });
    }
  });

  // Delete coupon (Super Admin only)
  app.delete("/api/coupons/:id", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      await db
        .delete(schema.coupons)
        .where(eq(schema.coupons.id, id));
      
      await logActivity(req.user!.id, undefined, 'coupon_deleted', 'coupon', id, {}, req);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete coupon error:', error);
      res.status(500).json({ error: "Failed to delete coupon" });
    }
  });

  // ==================== Platform Settings Routes ====================
  
  // In-memory store for platform settings (will be replaced with database or env vars)
  let platformSettings = {
    stripePublicKey: process.env.VITE_STRIPE_PUBLIC_KEY || "",
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  };

  // Get platform settings (Super Admin only)
  app.get("/api/platform-settings", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      // Mask secret keys for display
      res.json({
        stripePublicKey: platformSettings.stripePublicKey,
        stripeSecretKey: platformSettings.stripeSecretKey ? "***" + platformSettings.stripeSecretKey.slice(-4) : "",
        stripeWebhookSecret: platformSettings.stripeWebhookSecret ? "***" + platformSettings.stripeWebhookSecret.slice(-4) : "",
        razorpayKeyId: platformSettings.razorpayKeyId,
        razorpayKeySecret: platformSettings.razorpayKeySecret ? "***" + platformSettings.razorpayKeySecret.slice(-4) : "",
        razorpayWebhookSecret: platformSettings.razorpayWebhookSecret ? "***" + platformSettings.razorpayWebhookSecret.slice(-4) : "",
      });
    } catch (error: any) {
      console.error("Error fetching platform settings:", error);
      res.status(500).json({ error: "Failed to fetch platform settings" });
    }
  });

  // Update platform settings (Super Admin only)
  app.patch("/api/platform-settings", requireAuth, requirePlatform, async (req: AuthRequest, res: Response) => {
    try {
      const { 
        stripePublicKey, 
        stripeSecretKey, 
        stripeWebhookSecret,
        razorpayKeyId,
        razorpayKeySecret,
        razorpayWebhookSecret
      } = req.body;

      // Update Stripe settings only if provided
      if (stripePublicKey !== undefined) {
        platformSettings.stripePublicKey = stripePublicKey;
      }
      if (stripeSecretKey !== undefined && !stripeSecretKey.startsWith("***")) {
        platformSettings.stripeSecretKey = stripeSecretKey;
      }
      if (stripeWebhookSecret !== undefined && !stripeWebhookSecret.startsWith("***")) {
        platformSettings.stripeWebhookSecret = stripeWebhookSecret;
      }

      // Update Razorpay settings only if provided
      if (razorpayKeyId !== undefined) {
        platformSettings.razorpayKeyId = razorpayKeyId;
      }
      if (razorpayKeySecret !== undefined && !razorpayKeySecret.startsWith("***")) {
        platformSettings.razorpayKeySecret = razorpayKeySecret;
      }
      if (razorpayWebhookSecret !== undefined && !razorpayWebhookSecret.startsWith("***")) {
        platformSettings.razorpayWebhookSecret = razorpayWebhookSecret;
      }

      res.json({ success: true, message: "Settings updated successfully" });
    } catch (error: any) {
      console.error("Error updating platform settings:", error);
      res.status(500).json({ error: "Failed to update platform settings" });
    }
  });

  // ==================== Stripe Checkout Routes ====================

  // Create Stripe checkout session for subscription
  app.post("/api/subscription/checkout", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { planId, billingCycle, seatCount, regionId, couponCode } = req.body;

      // Validate inputs
      if (!planId || !billingCycle || !seatCount) {
        return res.status(400).json({ error: "planId, billingCycle, and seatCount are required" });
      }

      // Check if Stripe is configured
      const stripeSecretKey = platformSettings.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        return res.status(500).json({ error: "Stripe is not configured. Please contact support." });
      }

      // Initialize Stripe
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: "2024-11-20.acacia",
      });

      // Get plan
      const [plan] = await db
        .select()
        .from(schema.subscriptionPlans)
        .where(and(
          eq(schema.subscriptionPlans.id, planId),
          eq(schema.subscriptionPlans.isActive, true)
        ))
        .limit(1);

      if (!plan) {
        return res.status(404).json({ error: "Subscription plan not found or inactive" });
      }

      // Get region
      let region = undefined;
      if (regionId) {
        const [regionData] = await db
          .select()
          .from(schema.pricingRegions)
          .where(and(
            eq(schema.pricingRegions.id, regionId),
            eq(schema.pricingRegions.isActive, true)
          ))
          .limit(1);
        
        if (!regionData) {
          return res.status(404).json({ error: "Pricing region not found or inactive" });
        }
        region = regionData;
      }

      // Get volume tiers
      const volumeTiers = await db
        .select()
        .from(schema.planVolumeTiers)
        .where(eq(schema.planVolumeTiers.planId, planId));

      // Get coupon if provided
      let coupon = undefined;
      if (couponCode) {
        const [couponData] = await db
          .select()
          .from(schema.coupons)
          .where(and(
            eq(schema.coupons.code, couponCode.toUpperCase()),
            eq(schema.coupons.isActive, true)
          ))
          .limit(1);

        if (couponData) {
          // Validate coupon
          const now = new Date();
          if (couponData.expiresAt && new Date(couponData.expiresAt) < now) {
            return res.status(400).json({ error: "Coupon has expired" });
          }
          if (couponData.usageLimit && couponData.timesUsed >= couponData.usageLimit) {
            return res.status(400).json({ error: "Coupon usage limit reached" });
          }
          if (couponData.applicablePlans && couponData.applicablePlans.length > 0) {
            if (!couponData.applicablePlans.includes(planId)) {
              return res.status(400).json({ error: "Coupon not valid for this plan" });
            }
          }
          if (couponData.minimumSeats && seatCount < couponData.minimumSeats) {
            return res.status(400).json({ error: `Coupon requires at least ${couponData.minimumSeats} seats` });
          }

          coupon = couponData;
        }
      }

      // SERVER-SIDE PRICE VERIFICATION (anti-tampering)
      const priceCalculation = PricingService.calculatePrice({
        plan,
        billingCycle,
        seatCount,
        region,
        volumeTiers,
        coupon,
      });

      // Create Stripe checkout session
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: user.email || undefined,
        client_reference_id: user.id.toString(),
        line_items: [
          {
            price_data: {
              currency: (region?.currencyCode || 'USD').toLowerCase(),
              product_data: {
                name: `${plan.name} - ${plan.tier} Plan`,
                description: `${seatCount} seat${seatCount > 1 ? 's' : ''} • ${billingCycle === 'monthly' ? 'Monthly' : 'Yearly'} billing`,
              },
              recurring: {
                interval: billingCycle === 'monthly' ? 'month' : 'year',
              },
              unit_amount: Math.round(priceCalculation.finalPrice * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId: user.id.toString(),
          organizationId: user.organizationId?.toString() || '',
          planId: plan.id,
          planName: plan.name,
          planTier: plan.slug,
          billingCycle,
          seatCount: seatCount.toString(),
          regionId: region?.id || '',
          couponCode: coupon?.code || '',
          basePrice: (billingCycle === 'monthly' ? priceCalculation.basePriceMonthly : priceCalculation.basePriceYearly).toString(),
          regionalMultiplier: priceCalculation.regionMultiplier.toString(),
          volumeDiscount: priceCalculation.volumeDiscount.toString(),
          couponDiscount: priceCalculation.couponDiscount.toString(),
          finalPrice: priceCalculation.finalPrice.toString(),
          priceSnapshotJson: JSON.stringify(priceCalculation.snapshot),
        },
        success_url: `${baseUrl}/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/subscription?canceled=true`,
        allow_promotion_codes: false, // We handle coupons internally
      });

      // Log activity
      await logActivity(
        user.id,
        'subscription_checkout_initiated',
        user.organizationId || undefined,
        { planId, seatCount, amount: priceCalculation.finalPrice }
      );

      res.json({
        sessionId: session.id,
        url: session.url,
        priceSnapshot: priceCalculation,
      });
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: error.message || "Failed to create checkout session" });
    }
  });

  // Stripe webhook handler (requires raw body)
  app.post("/api/webhooks/stripe", async (req: Request, res: Response) => {
    try {
      const stripeSecretKey = platformSettings.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
      const webhookSecret = platformSettings.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET;

      if (!stripeSecretKey || !webhookSecret) {
        console.error("Stripe webhook: Missing configuration");
        return res.status(500).json({ error: "Stripe not configured" });
      }

      // Initialize Stripe
      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: "2024-11-20.acacia" as any,
      });

      const sig = req.headers['stripe-signature'];
      if (!sig) {
        console.error("Stripe webhook: Missing signature");
        return res.status(400).json({ error: "Missing signature" });
      }

      let event: Stripe.Event;

      try {
        // Verify webhook signature using raw body
        const rawBody = (req as any).rawBody;
        if (!rawBody) {
          console.error("Stripe webhook: Raw body not available");
          return res.status(400).json({ error: "Raw body required for signature verification" });
        }

        event = stripe.webhooks.constructEvent(
          rawBody,
          sig,
          webhookSecret
        );
      } catch (err: any) {
        console.error("Stripe webhook: Signature verification failed:", err.message);
        return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
      }

      console.log(`Stripe webhook received: ${event.type}`);

      // Handle different event types
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          
          // Extract metadata
          const metadata = session.metadata;
          if (!metadata || !metadata.organizationId || !metadata.planId || !metadata.userId) {
            console.error("Stripe webhook: Missing metadata in checkout session");
            break;
          }

          const userId = metadata.userId; // UUID string
          const organizationId = metadata.organizationId; // UUID string

          // Create subscription record
          const subscriptionData = {
            organizationId,
            planId: metadata.planId,
            plan: metadata.planTier || 'professional',
            status: 'active',
            seatCount: parseInt(metadata.seatCount),
            billingCycle: metadata.billingCycle as 'monthly' | 'yearly',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + (metadata.billingCycle === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000),
            priceSnapshot: metadata.priceSnapshotJson ? JSON.parse(metadata.priceSnapshotJson) : {},
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
          };

          await db.insert(schema.platformSubscriptions).values(subscriptionData);

          // Increment coupon usage if applicable
          if (metadata.couponCode) {
            await db
              .update(schema.coupons)
              .set({ 
                currentRedemptions: sql`${schema.coupons.currentRedemptions} + 1`,
                updatedAt: new Date(),
              })
              .where(eq(schema.coupons.code, metadata.couponCode.toUpperCase()));

            // Record redemption
            await db.insert(schema.couponRedemptions).values({
              couponId: metadata.couponCode,
              organizationId,
              subscriptionId: session.id,
              discountSnapshot: metadata.priceSnapshotJson ? JSON.parse(metadata.priceSnapshotJson) : {},
              redeemedBy: metadata.userId,
            });
          }

          // Log activity
          await logActivity(
            userId,
            'subscription_activated',
            organizationId,
            { 
              planId: metadata.planId, 
              seatCount: metadata.seatCount,
              amount: metadata.finalPrice,
              stripeSubscriptionId: session.subscription,
            }
          );

          console.log(`Subscription created for organization ${organizationId}, plan ${metadata.planId}`);
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          
          // Update subscription status
          await db
            .update(schema.platformSubscriptions)
            .set({
              status: subscription.status,
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              updatedAt: new Date(),
            })
            .where(eq(schema.platformSubscriptions.stripeSubscriptionId, subscription.id));

          console.log(`Subscription ${subscription.id} updated to status: ${subscription.status}`);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          
          // Mark subscription as canceled
          await db
            .update(schema.platformSubscriptions)
            .set({
              status: 'canceled',
              canceledAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(schema.platformSubscriptions.stripeSubscriptionId, subscription.id));

          // Log activity - fetch user from organization
          const [sub] = await db
            .select()
            .from(schema.platformSubscriptions)
            .where(eq(schema.platformSubscriptions.stripeSubscriptionId, subscription.id))
            .limit(1);

          if (sub) {
            // Get a user from the organization to log activity
            const [orgUser] = await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.organizationId, sub.organizationId))
              .limit(1);

            if (orgUser) {
              await logActivity(
                parseInt(orgUser.id),
                'subscription_canceled',
                sub.organizationId,
                { stripeSubscriptionId: subscription.id }
              );
            }
          }

          console.log(`Subscription ${subscription.id} canceled`);
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          
          if (invoice.subscription) {
            // Update subscription status to past_due
            await db
              .update(schema.platformSubscriptions)
              .set({
                status: 'past_due',
                updatedAt: new Date(),
              })
              .where(eq(schema.platformSubscriptions.stripeSubscriptionId, invoice.subscription as string));

            // Log event
            await db.insert(schema.subscriptionEvents).values({
              id: crypto.randomUUID(),
              subscriptionId: invoice.subscription as string,
              eventType: 'payment_failed',
              eventData: {
                invoiceId: invoice.id,
                amountDue: invoice.amount_due,
                attemptCount: invoice.attempt_count,
              },
              createdAt: new Date(),
            });

            console.log(`Payment failed for subscription ${invoice.subscription}`);
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          
          if (invoice.subscription) {
            // Ensure subscription is active
            await db
              .update(schema.platformSubscriptions)
              .set({
                status: 'active',
                updatedAt: new Date(),
              })
              .where(eq(schema.platformSubscriptions.stripeSubscriptionId, invoice.subscription as string));

            // Log event
            await db.insert(schema.subscriptionEvents).values({
              id: crypto.randomUUID(),
              subscriptionId: invoice.subscription as string,
              eventType: 'payment_succeeded',
              eventData: {
                invoiceId: invoice.id,
                amountPaid: invoice.amount_paid,
              },
              createdAt: new Date(),
            });

            console.log(`Payment succeeded for subscription ${invoice.subscription}`);
          }
          break;
        }

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      // Return 200 to acknowledge receipt
      res.json({ received: true });
    } catch (error: any) {
      console.error("Stripe webhook error:", error);
      res.status(500).json({ error: error.message || "Webhook processing failed" });
    }
  });

  // Calculate subscription price (public)
  app.post("/api/subscription-price/calculate", async (req: Request, res: Response) => {
    try {
      const { planId, billingCycle, seatCount, regionId, couponCode } = req.body;
      
      if (!planId || !billingCycle || !seatCount) {
        return res.status(400).json({ error: "planId, billingCycle, and seatCount are required" });
      }
      
      // Get plan
      const [plan] = await db
        .select()
        .from(schema.subscriptionPlans)
        .where(eq(schema.subscriptionPlans.id, planId))
        .limit(1);
      
      if (!plan) {
        return res.status(404).json({ error: "Subscription plan not found" });
      }
      
      // Get region (if specified)
      let region = undefined;
      if (regionId) {
        const [regionData] = await db
          .select()
          .from(schema.pricingRegions)
          .where(eq(schema.pricingRegions.id, regionId))
          .limit(1);
        region = regionData;
      }
      
      // Get volume tiers for plan
      const volumeTiers = await db
        .select()
        .from(schema.planVolumeTiers)
        .where(eq(schema.planVolumeTiers.planId, planId));
      
      // Get coupon (if specified)
      let coupon = undefined;
      if (couponCode) {
        const [couponData] = await db
          .select()
          .from(schema.coupons)
          .where(eq(schema.coupons.code, couponCode.toUpperCase()))
          .limit(1);
        coupon = couponData;
      }
      
      // Calculate price
      const calculation = PricingService.calculatePrice({
        plan,
        billingCycle,
        seatCount,
        region,
        volumeTiers,
        coupon,
      });
      
      res.json(calculation);
    } catch (error: any) {
      console.error('Calculate price error:', error);
      res.status(500).json({ error: error.message || "Failed to calculate price" });
    }
  });

  // ==================== PLATFORM SUBSCRIPTION MANAGEMENT ====================

  // Get current platform subscription
  app.get("/api/platform-subscriptions/current", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const organizationId = user.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      // Get active subscription
      const [subscription] = await db
        .select()
        .from(schema.platformSubscriptions)
        .where(
          and(
            eq(schema.platformSubscriptions.organizationId, organizationId),
            eq(schema.platformSubscriptions.status, "active")
          )
        )
        .limit(1);

      if (!subscription) {
        return res.status(404).json({ error: "No active subscription found" });
      }

      // Get user and client counts
      const usersCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.users)
        .where(eq(schema.users.organizationId, organizationId));

      const clientsCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.clients)
        .where(eq(schema.clients.organizationId, organizationId));

      // Calculate storage usage (simple count for now)
      const storageUsage = 0; // TODO: Implement actual storage calculation

      res.json({
        ...subscription,
        currentUsers: usersCount[0]?.count || 0,
        currentClients: clientsCount[0]?.count || 0,
        currentStorage: storageUsage.toString(),
      });
    } catch (error: any) {
      console.error("Get current subscription error:", error);
      res.status(500).json({ error: "Failed to fetch subscription" });
    }
  });

  // Switch subscription plan
  app.post("/api/platform-subscriptions/switch-plan", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { planSlug, billingCycle } = req.body;
      const organizationId = user.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      if (!planSlug || !billingCycle) {
        return res.status(400).json({ error: "planSlug and billingCycle are required" });
      }

      // Validate billing cycle
      const validBillingCycles = ["monthly", "yearly", "3year"];
      if (!validBillingCycles.includes(billingCycle)) {
        return res.status(400).json({ 
          error: `Invalid billing cycle. Must be one of: ${validBillingCycles.join(", ")}` 
        });
      }

      // Check if user has permission to switch plans (admin or super admin)
      if (user.role !== "admin" && user.role !== "superadmin") {
        return res.status(403).json({ error: "Only admins can switch subscription plans" });
      }

      // Get new plan
      const [newPlan] = await db
        .select()
        .from(schema.subscriptionPlans)
        .where(
          and(
            eq(schema.subscriptionPlans.slug, planSlug),
            eq(schema.subscriptionPlans.isActive, true)
          )
        )
        .limit(1);

      if (!newPlan) {
        return res.status(404).json({ error: "Subscription plan not found or inactive" });
      }

      // Get current subscription
      const [currentSubscription] = await db
        .select()
        .from(schema.platformSubscriptions)
        .where(
          and(
            eq(schema.platformSubscriptions.organizationId, organizationId),
            eq(schema.platformSubscriptions.status, "active")
          )
        )
        .limit(1);

      if (!currentSubscription) {
        return res.status(404).json({ error: "No active subscription found to switch from" });
      }

      // Prevent no-op plan switches
      if (currentSubscription.plan === newPlan.slug && currentSubscription.billingCycle === billingCycle) {
        return res.status(400).json({ 
          error: "You are already on this plan and billing cycle. Please select a different plan or billing cycle." 
        });
      }

      // Calculate new pricing
      const basePrice = billingCycle === "monthly"
        ? parseFloat(newPlan.basePriceMonthly)
        : parseFloat(newPlan.basePriceYearly);

      const newMRR = billingCycle === "monthly"
        ? basePrice
        : basePrice / 12; // Yearly price converted to monthly for MRR

      // Determine if this is an upgrade or downgrade
      const planOrder = { free: 0, core: 1, ai: 2, edge: 3 };
      const currentPlanOrder = planOrder[currentSubscription.plan as keyof typeof planOrder] || 0;
      const newPlanOrder = planOrder[newPlan.slug as keyof typeof planOrder] || 0;
      const isUpgrade = newPlanOrder > currentPlanOrder;

      // Calculate new period dates
      const currentPeriodStart = new Date();
      const currentPeriodEnd = new Date(currentPeriodStart);
      if (billingCycle === "monthly") {
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
      } else {
        currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
      }

      // Update subscription
      const [updatedSubscription] = await db
        .update(schema.platformSubscriptions)
        .set({
          plan: newPlan.slug,
          billingCycle,
          monthlyPrice: newPlan.basePriceMonthly,
          yearlyPrice: newPlan.basePriceYearly,
          mrr: newMRR.toString(),
          maxUsers: newPlan.maxUsers,
          maxClients: newPlan.maxClients,
          maxStorage: newPlan.maxStorage || 10,
          currentPeriodStart: isUpgrade ? currentPeriodStart : currentSubscription.currentPeriodStart,
          currentPeriodEnd: isUpgrade ? currentPeriodEnd : currentSubscription.currentPeriodEnd,
          nextBillingDate: isUpgrade ? currentPeriodEnd : currentSubscription.nextBillingDate,
          updatedAt: new Date(),
        })
        .where(eq(schema.platformSubscriptions.id, currentSubscription.id))
        .returning();

      // Log the plan change event
      await db.insert(schema.subscriptionEvents).values({
        subscriptionId: currentSubscription.id,
        eventType: isUpgrade ? "plan_upgraded" : "plan_downgraded",
        eventData: {
          oldPlan: currentSubscription.plan,
          newPlan: newPlan.slug,
          oldMRR: currentSubscription.mrr,
          newMRR: newMRR.toString(),
        },
        createdAt: new Date(),
      });

      // Log activity
      await db.insert(schema.activityLogs).values({
        userId: user.id,
        organizationId,
        action: `subscription_${isUpgrade ? 'upgraded' : 'downgraded'}`,
        entity: "platform_subscription",
        entityId: currentSubscription.id,
        details: `Switched from ${currentSubscription.plan} to ${newPlan.slug}`,
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: `Successfully ${isUpgrade ? 'upgraded' : 'downgraded'} to ${newPlan.name} plan`,
        subscription: updatedSubscription,
      });
    } catch (error: any) {
      console.error("Switch plan error:", error);
      res.status(500).json({ error: "Failed to switch subscription plan" });
    }
  });

  // ==================== SUBSCRIPTION INVOICE MANAGEMENT ====================

  // Helper function to generate invoice number
  const generateInvoiceNumber = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get last invoice number for this month
    const lastInvoice = await db
      .select()
      .from(schema.subscriptionInvoices)
      .where(sql`${schema.subscriptionInvoices.invoiceNumber} LIKE ${`INV-${year}${month}-%`}`)
      .orderBy(desc(schema.subscriptionInvoices.invoiceNumber))
      .limit(1);

    let sequence = 1;
    if (lastInvoice.length > 0) {
      const lastNumber = lastInvoice[0].invoiceNumber.split('-')[2];
      sequence = parseInt(lastNumber) + 1;
    }

    return `INV-${year}${month}-${String(sequence).padStart(4, '0')}`;
  };

  // Helper function to generate subscription invoice
  const generateSubscriptionInvoice = async (subscriptionId: string): Promise<schema.SubscriptionInvoice> => {
    // Get subscription details
    const [subscription] = await db
      .select()
      .from(schema.platformSubscriptions)
      .where(eq(schema.platformSubscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Calculate billing period
    const billingPeriodStart = subscription.currentPeriodStart || new Date();
    const billingPeriodEnd = subscription.currentPeriodEnd || new Date();

    // IDEMPOTENCY CHECK: Check if invoice already exists for this billing period
    const existingInvoice = await db
      .select()
      .from(schema.subscriptionInvoices)
      .where(
        and(
          eq(schema.subscriptionInvoices.subscriptionId, subscriptionId),
          eq(schema.subscriptionInvoices.billingPeriodStart, billingPeriodStart),
          eq(schema.subscriptionInvoices.billingPeriodEnd, billingPeriodEnd)
        )
      )
      .limit(1);

    if (existingInvoice.length > 0) {
      return existingInvoice[0];
    }

    // Get plan details
    const [plan] = await db
      .select()
      .from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.slug, subscription.plan))
      .limit(1);

    if (!plan) {
      throw new Error("Plan not found");
    }

    // Calculate amounts using actual subscription pricing fields
    let subtotal = 0;
    const lineItems: Array<{ description: string; quantity: number; unitPrice: number; amount: number }> = [];

    // Use basePrice if available (already includes regional multiplier)
    if (subscription.basePrice) {
      const baseAmount = parseFloat(subscription.basePrice);
      subtotal += baseAmount;
      lineItems.push({
        description: `${plan.name} Plan - ${subscription.billingCycle} billing (base)`,
        quantity: 1,
        unitPrice: baseAmount,
        amount: baseAmount,
      });
    } else {
      // Fallback to monthlyPrice/yearlyPrice
      const baseAmount = subscription.billingCycle === "monthly"
        ? parseFloat(subscription.monthlyPrice || "0")
        : parseFloat(subscription.yearlyPrice || "0");
      subtotal += baseAmount;
      lineItems.push({
        description: `${plan.name} Plan - ${subscription.billingCycle} billing`,
        quantity: 1,
        unitPrice: baseAmount,
        amount: baseAmount,
      });
    }

    // Add per-seat pricing if applicable
    if (subscription.perSeatPrice && subscription.seatCount > 1) {
      const perSeatAmount = parseFloat(subscription.perSeatPrice);
      const additionalSeats = subscription.seatCount - (plan.includedSeats || 1);
      
      if (additionalSeats > 0) {
        const seatTotal = perSeatAmount * additionalSeats;
        subtotal += seatTotal;
        lineItems.push({
          description: `Additional seats (${additionalSeats} × ${subscription.currency} ${perSeatAmount.toFixed(2)})`,
          quantity: additionalSeats,
          unitPrice: perSeatAmount,
          amount: seatTotal,
        });
      }
    }

    // Apply discount if available
    let totalDiscount = 0;
    if (subscription.totalDiscount) {
      totalDiscount = parseFloat(subscription.totalDiscount);
      if (totalDiscount > 0) {
        lineItems.push({
          description: `Discount applied`,
          quantity: 1,
          unitPrice: -totalDiscount,
          amount: -totalDiscount,
        });
        subtotal -= totalDiscount;
      }
    }

    const taxRate = 0; // TODO: Get tax rate based on organization location
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Set due date (7 days from issue date)
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 7);

    // Set grace period (2 days after due date)
    const gracePeriodEndsAt = new Date(dueDate);
    gracePeriodEndsAt.setDate(gracePeriodEndsAt.getDate() + 2);

    // Create invoice
    const invoice = await storage.createSubscriptionInvoice({
      organizationId: subscription.organizationId,
      subscriptionId: subscription.id,
      invoiceNumber,
      status: "pending",
      billingPeriodStart,
      billingPeriodEnd,
      subtotal: subtotal.toString(),
      taxRate: taxRate.toString(),
      taxAmount: taxAmount.toString(),
      total: total.toString(),
      currency: subscription.currency || "USD",
      issueDate,
      dueDate,
      gracePeriodEndsAt,
      lineItems: lineItems as any,
      metadata: {
        plan: plan.slug,
        billingCycle: subscription.billingCycle,
        seatCount: subscription.seatCount,
        regionCode: subscription.regionCode,
        couponId: subscription.couponId,
      },
    });

    // Log invoice generation
    await db.insert(schema.subscriptionEvents).values({
      subscriptionId: subscription.id,
      eventType: "invoice_generated",
      eventData: {
        invoiceId: invoice.id,
        invoiceNumber,
        amount: total,
        currency: subscription.currency || "USD",
      },
      createdAt: new Date(),
    });

    return invoice;
  };

  // Get all subscription invoices for the organization
  app.get("/api/subscription-invoices", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const organizationId = user.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      const invoices = await storage.getSubscriptionInvoicesByOrganization(organizationId);
      res.json(invoices);
    } catch (error: any) {
      console.error("Get subscription invoices error:", error);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  // Get a specific subscription invoice
  app.get("/api/subscription-invoices/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;

      const invoice = await storage.getSubscriptionInvoice(id);

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Check if user has access to this invoice
      if (invoice.organizationId !== user.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(invoice);
    } catch (error: any) {
      console.error("Get subscription invoice error:", error);
      res.status(500).json({ error: "Failed to fetch invoice" });
    }
  });

  // Manually generate an invoice for the current subscription
  app.post("/api/subscription-invoices/generate", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const organizationId = user.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      // Check if user is admin
      if (user.role !== "admin" && user.role !== "superadmin") {
        return res.status(403).json({ error: "Only admins can generate invoices" });
      }

      // Get active subscription
      const [subscription] = await db
        .select()
        .from(schema.platformSubscriptions)
        .where(
          and(
            eq(schema.platformSubscriptions.organizationId, organizationId),
            eq(schema.platformSubscriptions.status, "active")
          )
        )
        .limit(1);

      if (!subscription) {
        return res.status(404).json({ error: "No active subscription found" });
      }

      // Generate invoice
      const invoice = await generateSubscriptionInvoice(subscription.id);

      res.json({
        success: true,
        message: "Invoice generated successfully",
        invoice,
      });
    } catch (error: any) {
      console.error("Generate invoice error:", error);
      res.status(500).json({ error: error.message || "Failed to generate invoice" });
    }
  });

  // ==================== SERVICE PAUSE ON PAYMENT FAILURE ====================

  // Helper function to attempt auto-payment for an invoice
  const attemptAutoPayment = async (invoiceId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Get invoice
      const invoice = await storage.getSubscriptionInvoice(invoiceId);
      if (!invoice) {
        return { success: false, error: "Invoice not found" };
      }

      // Skip if already paid
      if (invoice.status === "paid") {
        return { success: true };
      }

      // Get subscription
      const [subscription] = await db
        .select()
        .from(schema.platformSubscriptions)
        .where(eq(schema.platformSubscriptions.id, invoice.subscriptionId))
        .limit(1);

      if (!subscription) {
        return { success: false, error: "Subscription not found" };
      }

      // Check if there's a default payment method
      if (!subscription.defaultPaymentMethodId) {
        return { success: false, error: "No default payment method configured" };
      }

      // Get default payment method
      const [paymentMethod] = await db
        .select()
        .from(schema.paymentMethods)
        .where(
          and(
            eq(schema.paymentMethods.id, subscription.defaultPaymentMethodId),
            eq(schema.paymentMethods.status, "active")
          )
        )
        .limit(1);

      if (!paymentMethod) {
        return { success: false, error: "Default payment method not found or inactive" };
      }

      // Import Razorpay service dynamically
      const { razorpayService } = await import("./razorpay-service");

      try {
        // Create Razorpay order
        const orderAmount = Math.round(parseFloat(invoice.total) * 100); // Convert to paise
        const order = await razorpayService.createOrder({
          amount: orderAmount,
          currency: invoice.currency,
          receipt: invoice.invoiceNumber,
          notes: {
            invoiceId: invoice.id,
            subscriptionId: subscription.id,
            organizationId: subscription.organizationId,
          },
        });

        // In production, this would use Razorpay's recurring payment API
        // to actually charge the saved payment method
        // For now, we simulate a successful payment

        const now = new Date();
        
        // Mark invoice as paid
        await storage.updateSubscriptionInvoice(invoiceId, {
          status: "paid",
          attemptCount: (invoice.attemptCount || 0) + 1,
          lastAttemptAt: now,
          razorpayOrderId: order.id,
          amountPaid: invoice.total,
          paidAt: now,
          paymentMethod: paymentMethod.type,
        });

        // Create payment record
        await db.insert(schema.payments).values({
          organizationId: subscription.organizationId,
          subscriptionInvoiceId: invoice.id,
          amount: invoice.total,
          method: paymentMethod.type,
          status: "completed",
          razorpayOrderId: order.id,
          transactionDate: now,
          notes: `Auto-payment for invoice ${invoice.invoiceNumber}`,
        });

        // Log successful payment
        await db.insert(schema.subscriptionEvents).values({
          subscriptionId: subscription.id,
          eventType: "payment_successful",
          eventData: {
            invoiceId: invoice.id,
            amount: parseFloat(invoice.total),
            paymentMethod: paymentMethod.type,
          },
          createdAt: now,
        });

        return { success: true };

      } catch (paymentError: any) {
        // Payment failed - update attempt count but keep status as pending/overdue
        // to allow retries during grace period
        await storage.updateSubscriptionInvoice(invoiceId, {
          attemptCount: (invoice.attemptCount || 0) + 1,
          lastAttemptAt: new Date(),
          // Don't change status here - let the grace period processor handle it
        });

        // Log failed payment attempt
        await db.insert(schema.subscriptionEvents).values({
          subscriptionId: subscription.id,
          eventType: "payment_failed",
          eventData: {
            invoiceId: invoice.id,
            attemptNumber: (invoice.attemptCount || 0) + 1,
            error: paymentError.message,
          },
          createdAt: new Date(),
        });

        return { success: false, error: paymentError.message };
      }
    } catch (error: any) {
      console.error("Auto-payment error:", error);
      return { success: false, error: error.message };
    }
  };

  // Process overdue invoices and suspend services if needed
  app.post("/api/subscription-invoices/process-overdue", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;

      // Only super admins can run this
      if (user.role !== "superadmin") {
        return res.status(403).json({ error: "Only super admins can process overdue invoices" });
      }

      const now = new Date();
      const results = {
        processed: 0,
        paymentsAttempted: 0,
        paymentsFailed: 0,
        servicesSuspended: 0,
      };

      // Get all pending invoices that are past due date
      const overdueInvoices = await db
        .select()
        .from(schema.subscriptionInvoices)
        .where(
          and(
            eq(schema.subscriptionInvoices.status, "pending"),
            sql`${schema.subscriptionInvoices.dueDate} <= ${now}`
          )
        );

      for (const invoice of overdueInvoices) {
        results.processed++;

        // Skip if already paid (might have been paid during this run)
        if (invoice.status === "paid") {
          continue;
        }

        // Check if we're still within grace period
        const gracePeriodEnded = invoice.gracePeriodEndsAt && new Date(invoice.gracePeriodEndsAt) < now;

        if (!gracePeriodEnded) {
          // Still in grace period - attempt auto-payment
          const paymentResult = await attemptAutoPayment(invoice.id);
          results.paymentsAttempted++;

          if (paymentResult.success) {
            // Payment succeeded - invoice was marked as paid in attemptAutoPayment
            continue;
          } else {
            results.paymentsFailed++;
            
            // Update invoice status to overdue (still retrying)
            await storage.updateSubscriptionInvoice(invoice.id, {
              status: "overdue",
            });
          }
        } else {
          // Grace period ended - mark as failed and suspend services
          const [subscription] = await db
            .select()
            .from(schema.platformSubscriptions)
            .where(eq(schema.platformSubscriptions.id, invoice.subscriptionId))
            .limit(1);

          if (subscription && subscription.status === "active") {
            // Suspend subscription
            await db
              .update(schema.platformSubscriptions)
              .set({
                status: "suspended",
                updatedAt: new Date(),
              })
              .where(eq(schema.platformSubscriptions.id, subscription.id));

            // Mark invoice as failed (grace period exhausted)
            await storage.updateSubscriptionInvoice(invoice.id, {
              status: "failed",
              servicesDisabledAt: now,
            });

            // Log event
            await db.insert(schema.subscriptionEvents).values({
              subscriptionId: subscription.id,
              eventType: "subscription_suspended",
              eventData: {
                reason: "payment_failure",
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                attemptCount: invoice.attemptCount || 0,
              },
              createdAt: new Date(),
            });

            results.servicesSuspended++;
          }
        }
      }

      res.json({
        success: true,
        message: `Processed ${results.processed} overdue invoices`,
        results,
      });
    } catch (error: any) {
      console.error("Process overdue invoices error:", error);
      res.status(500).json({ error: "Failed to process overdue invoices" });
    }
  });

  // Resume service after payment (admin action)
  app.post("/api/platform-subscriptions/:id/resume", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;

      // Get subscription
      const [subscription] = await db
        .select()
        .from(schema.platformSubscriptions)
        .where(eq(schema.platformSubscriptions.id, id))
        .limit(1);

      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Check permissions - must be admin of the organization or super admin
      if (user.role !== "superadmin" && user.organizationId !== subscription.organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (user.role !== "admin" && user.role !== "superadmin") {
        return res.status(403).json({ error: "Only admins can resume subscriptions" });
      }

      // Only resume if suspended
      if (subscription.status !== "suspended") {
        return res.status(400).json({ error: "Subscription is not suspended" });
      }

      // Resume subscription
      await db
        .update(schema.platformSubscriptions)
        .set({
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(schema.platformSubscriptions.id, id));

      // Log event
      await db.insert(schema.subscriptionEvents).values({
        subscriptionId: id,
        eventType: "subscription_resumed",
        eventData: {
          resumedBy: user.id,
        },
        createdAt: new Date(),
      });

      // Log activity
      await db.insert(schema.activityLogs).values({
        userId: user.id,
        organizationId: subscription.organizationId,
        action: "subscription_resumed",
        entity: "platform_subscription",
        entityId: id,
        details: "Subscription services resumed after payment",
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: "Subscription services resumed successfully",
      });
    } catch (error: any) {
      console.error("Resume subscription error:", error);
      res.status(500).json({ error: "Failed to resume subscription" });
    }
  });

  // ==================== RAZORPAY INTEGRATION ====================
  
  // Import Razorpay service
  const { razorpayService } = await import("./razorpay-service");

  // Create Razorpay subscription
  app.post("/api/razorpay/subscriptions/create", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { razorpayPlanId, subscriptionPlanId, billingCycle, quantity, notes } = req.body;
      
      if (!razorpayPlanId || !subscriptionPlanId || !billingCycle) {
        return res.status(400).json({ error: "razorpayPlanId, subscriptionPlanId, and billingCycle are required" });
      }

      const userId = req.user!.id;
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      // Get user details
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get organization
      const [org] = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, organizationId))
        .limit(1);

      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      // Get subscription plan details
      const [plan] = await db
        .select()
        .from(schema.subscriptionPlans)
        .where(eq(schema.subscriptionPlans.id, subscriptionPlanId))
        .limit(1);

      if (!plan) {
        return res.status(404).json({ error: "Subscription plan not found" });
      }

      // Check if organization already has an active subscription
      const [existingSubscription] = await db
        .select()
        .from(schema.platformSubscriptions)
        .where(
          and(
            eq(schema.platformSubscriptions.organizationId, organizationId),
            eq(schema.platformSubscriptions.status, "active")
          )
        )
        .limit(1);

      if (existingSubscription) {
        return res.status(400).json({ error: "Organization already has an active subscription" });
      }

      // Create or get Razorpay customer
      let razorpayCustomerId = existingSubscription?.razorpayCustomerId;
      
      if (!razorpayCustomerId) {
        const customer = await razorpayService.createCustomer({
          name: org.name,
          email: user.email,
          contact: user.phone || undefined,
          notes: {
            organizationId: org.id,
            userId: user.id,
          },
        });
        razorpayCustomerId = customer.id;
      }

      // Create Razorpay subscription
      const subscription = await razorpayService.createSubscription({
        planId: razorpayPlanId,
        quantity: quantity || 1,
        customerId: razorpayCustomerId,
        notes: notes || {
          organizationId: org.id,
          createdBy: user.id,
          subscriptionPlanId,
          billingCycle,
        },
        notify: 1,
      });

      // Calculate period dates based on billing cycle
      const currentPeriodStart = new Date();
      const currentPeriodEnd = new Date(currentPeriodStart);
      if (billingCycle === "monthly") {
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
      } else if (billingCycle === "yearly") {
        currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
      }

      // Calculate MRR (Monthly Recurring Revenue)
      const basePrice = billingCycle === "monthly" 
        ? parseFloat(plan.basePriceMonthly.toString())
        : parseFloat(plan.basePriceYearly.toString()) / 12;
      
      const perSeatPrice = billingCycle === "monthly"
        ? parseFloat(plan.perSeatPriceMonthly.toString())
        : parseFloat(plan.perSeatPriceYearly.toString()) / 12;

      const totalSeats = Math.max(quantity || 1, plan.includedSeats);
      const additionalSeats = Math.max(0, totalSeats - plan.includedSeats);
      const mrr = basePrice + (additionalSeats * perSeatPrice);

      // Create platform subscription record
      // SECURITY: Encrypt Razorpay customer ID before storing
      const [platformSubscription] = await db
        .insert(schema.platformSubscriptions)
        .values({
          id: crypto.randomUUID(),
          organizationId,
          planId: plan.id,
          plan: plan.slug,
          status: subscription.status === "authenticated" ? "active" : "pending",
          billingCycle,
          monthlyPrice: billingCycle === "monthly" ? plan.basePriceMonthly : null,
          yearlyPrice: billingCycle === "yearly" ? plan.basePriceYearly : null,
          mrr: mrr.toString(),
          maxUsers: plan.maxUsers,
          maxClients: plan.maxClients,
          maxStorage: plan.maxStorage,
          seatCount: totalSeats,
          paymentGateway: "razorpay",
          razorpayCustomerId: cryptoUtils.encrypt(razorpayCustomerId),
          razorpaySubscriptionId: subscription.id,
          currentPeriodStart,
          currentPeriodEnd,
          nextBillingDate: currentPeriodEnd,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.json({
        subscription: platformSubscription,
        razorpaySubscription: subscription,
      });
    } catch (error: any) {
      console.error("Create Razorpay subscription error:", error);
      res.status(500).json({ error: error.message || "Failed to create subscription" });
    }
  });

  // Get Razorpay subscription
  app.get("/api/razorpay/subscriptions/:subscriptionId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { subscriptionId } = req.params;
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      // Verify the subscription belongs to this organization
      const [platformSubscription] = await db
        .select()
        .from(schema.platformSubscriptions)
        .where(
          and(
            eq(schema.platformSubscriptions.organizationId, organizationId),
            eq(schema.platformSubscriptions.razorpaySubscriptionId, subscriptionId)
          )
        )
        .limit(1);

      if (!platformSubscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Fetch from Razorpay
      const razorpaySubscription = await razorpayService.fetchSubscription(subscriptionId);

      res.json({
        subscription: platformSubscription,
        razorpaySubscription,
      });
    } catch (error: any) {
      console.error("Fetch Razorpay subscription error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch subscription" });
    }
  });

  // Cancel Razorpay subscription
  app.post("/api/razorpay/subscriptions/:subscriptionId/cancel", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { subscriptionId } = req.params;
      const { cancelAtCycleEnd } = req.body;
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      // Verify the subscription belongs to this organization
      const [platformSubscription] = await db
        .select()
        .from(schema.platformSubscriptions)
        .where(
          and(
            eq(schema.platformSubscriptions.organizationId, organizationId),
            eq(schema.platformSubscriptions.razorpaySubscriptionId, subscriptionId)
          )
        )
        .limit(1);

      if (!platformSubscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Cancel in Razorpay
      const canceledSubscription = await razorpayService.cancelSubscription(
        subscriptionId,
        cancelAtCycleEnd || false
      );

      // Update platform subscription
      await db
        .update(schema.platformSubscriptions)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.platformSubscriptions.id, platformSubscription.id));

      res.json({
        message: "Subscription cancelled successfully",
        subscription: canceledSubscription,
      });
    } catch (error: any) {
      console.error("Cancel Razorpay subscription error:", error);
      res.status(500).json({ error: error.message || "Failed to cancel subscription" });
    }
  });

  // Razorpay webhook handler
  app.post("/api/razorpay/webhook", async (req: Request, res: Response) => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        console.error("RAZORPAY_WEBHOOK_SECRET is not configured");
        return res.status(500).json({ error: "Webhook secret not configured" });
      }

      const webhookSignature = req.headers['x-razorpay-signature'] as string;
      const webhookBody = JSON.stringify(req.body);

      // Verify webhook signature
      const isValid = razorpayService.verifyWebhookSignature(
        webhookBody,
        webhookSignature,
        webhookSecret
      );

      if (!isValid) {
        console.error("Invalid webhook signature");
        return res.status(400).json({ error: "Invalid signature" });
      }

      const event = req.body;

      // Handle different webhook events
      switch (event.event) {
        case 'subscription.activated': {
          const subscription = event.payload.subscription.entity;
          
          // Update platform subscription status
          await db
            .update(schema.platformSubscriptions)
            .set({
              status: 'active',
              updatedAt: new Date(),
            })
            .where(eq(schema.platformSubscriptions.razorpaySubscriptionId, subscription.id));

          console.log(`Subscription activated: ${subscription.id}`);
          break;
        }

        case 'subscription.charged': {
          const payment = event.payload.payment.entity;
          const subscription = event.payload.subscription.entity;
          
          // Log successful payment
          await db.insert(schema.subscriptionEvents).values({
            id: crypto.randomUUID(),
            subscriptionId: subscription.id,
            eventType: 'payment_succeeded',
            eventSource: 'razorpay',
            externalEventId: event.event,
            eventData: {
              paymentId: payment.id,
              amount: payment.amount,
              currency: payment.currency,
            },
            processed: true,
            processedAt: new Date(),
            createdAt: new Date(),
          });

          console.log(`Payment succeeded for subscription ${subscription.id}`);
          break;
        }

        case 'subscription.cancelled': {
          const subscription = event.payload.subscription.entity;
          
          // Update platform subscription status
          await db
            .update(schema.platformSubscriptions)
            .set({
              status: 'cancelled',
              cancelledAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(schema.platformSubscriptions.razorpaySubscriptionId, subscription.id));

          console.log(`Subscription cancelled: ${subscription.id}`);
          break;
        }

        case 'subscription.paused': {
          const subscription = event.payload.subscription.entity;
          
          await db
            .update(schema.platformSubscriptions)
            .set({
              status: 'suspended',
              updatedAt: new Date(),
            })
            .where(eq(schema.platformSubscriptions.razorpaySubscriptionId, subscription.id));

          console.log(`Subscription paused: ${subscription.id}`);
          break;
        }

        case 'subscription.resumed': {
          const subscription = event.payload.subscription.entity;
          
          await db
            .update(schema.platformSubscriptions)
            .set({
              status: 'active',
              updatedAt: new Date(),
            })
            .where(eq(schema.platformSubscriptions.razorpaySubscriptionId, subscription.id));

          console.log(`Subscription resumed: ${subscription.id}`);
          break;
        }

        case 'payment.failed': {
          const payment = event.payload.payment.entity;
          
          // Log failed payment
          if (payment.subscription_id) {
            await db.insert(schema.subscriptionEvents).values({
              id: crypto.randomUUID(),
              subscriptionId: payment.subscription_id,
              eventType: 'payment_failed',
              eventSource: 'razorpay',
              externalEventId: event.event,
              eventData: {
                paymentId: payment.id,
                amount: payment.amount,
                errorDescription: payment.error_description,
              },
              processed: true,
              processedAt: new Date(),
              createdAt: new Date(),
            });

            console.log(`Payment failed for subscription ${payment.subscription_id}`);
          }
          break;
        }

        default:
          console.log(`Unhandled Razorpay webhook event: ${event.event}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("Razorpay webhook error:", error);
      res.status(500).json({ error: error.message || "Webhook processing failed" });
    }
  });

  // Verify Razorpay payment signature (for checkout flow)
  app.post("/api/razorpay/verify-payment", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: "Missing required payment verification fields" });
      }

      const isValid = razorpayService.verifyPaymentSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });

      if (!isValid) {
        return res.status(400).json({ error: "Invalid payment signature" });
      }

      res.json({ valid: true, message: "Payment verified successfully" });
    } catch (error: any) {
      console.error("Verify payment error:", error);
      res.status(500).json({ error: error.message || "Failed to verify payment" });
    }
  });

  // Create Razorpay order (for one-time payments)
  app.post("/api/razorpay/orders/create", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { amount, currency, receipt, notes } = req.body;

      if (!amount || !currency) {
        return res.status(400).json({ error: "amount and currency are required" });
      }

      const order = await razorpayService.createOrder({
        amount,
        currency,
        receipt,
        notes,
      });

      res.json(order);
    } catch (error: any) {
      console.error("Create Razorpay order error:", error);
      res.status(500).json({ error: error.message || "Failed to create order" });
    }
  });

  // ==================== Subscription Invoices (Platform Billing) ====================

  // Get subscription invoices for current organization
  app.get("/api/subscription-invoices", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      const invoices = await db
        .select()
        .from(schema.subscriptionInvoices)
        .where(eq(schema.subscriptionInvoices.organizationId, organizationId))
        .orderBy(desc(schema.subscriptionInvoices.issueDate));

      res.json(invoices);
    } catch (error: any) {
      console.error("Get subscription invoices error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch invoices" });
    }
  });

  // Get specific subscription invoice
  app.get("/api/subscription-invoices/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      const [invoice] = await db
        .select()
        .from(schema.subscriptionInvoices)
        .where(
          and(
            eq(schema.subscriptionInvoices.id, id),
            eq(schema.subscriptionInvoices.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      res.json(invoice);
    } catch (error: any) {
      console.error("Get subscription invoice error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch invoice" });
    }
  });

  // Generate invoice for subscription (manual trigger or auto-generation)
  app.post("/api/subscription-invoices/generate", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { subscriptionId } = req.body;
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      if (!subscriptionId) {
        return res.status(400).json({ error: "subscriptionId is required" });
      }

      // Get subscription details
      const [subscription] = await db
        .select()
        .from(schema.platformSubscriptions)
        .where(
          and(
            eq(schema.platformSubscriptions.id, subscriptionId),
            eq(schema.platformSubscriptions.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!subscription) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Get subscription plan details
      let planDetails = null;
      if (subscription.planId) {
        [planDetails] = await db
          .select()
          .from(schema.subscriptionPlans)
          .where(eq(schema.subscriptionPlans.id, subscription.planId))
          .limit(1);
      }

      // Calculate billing period
      const billingPeriodStart = subscription.currentPeriodStart;
      const billingPeriodEnd = subscription.currentPeriodEnd;
      const issueDate = new Date();
      const dueDate = new Date(issueDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from issue
      const gracePeriodEnds = new Date(dueDate.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days after due date

      // Calculate pricing
      let subtotal = 0;
      const billingCycle = subscription.billingCycle || 'monthly';

      if (billingCycle === 'monthly') {
        subtotal = parseFloat(subscription.basePrice || subscription.monthlyPrice || '0');
      } else if (billingCycle === 'yearly') {
        subtotal = parseFloat(subscription.basePrice || subscription.yearlyPrice || '0');
      }

      const taxRate = 0; // TODO: Add tax calculation based on region
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;

      // Generate invoice number
      const invoiceCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.subscriptionInvoices)
        .where(eq(schema.subscriptionInvoices.organizationId, organizationId));

      const invoiceNumber = `INV-${organizationId.substring(0, 8).toUpperCase()}-${String(Number(invoiceCount[0].count) + 1).padStart(6, '0')}`;

      // Create line items
      const lineItems = [
        {
          description: `${planDetails?.name || subscription.plan} Plan - ${billingCycle === 'monthly' ? 'Monthly' : billingCycle === 'yearly' ? 'Yearly' : '3-Year'} Subscription`,
          quantity: 1,
          unitPrice: subtotal,
          amount: subtotal,
        }
      ];

      if (subscription.seatCount && subscription.seatCount > 1 && subscription.perSeatPrice) {
        const additionalSeats = subscription.seatCount - (planDetails?.includedSeats || 1);
        if (additionalSeats > 0) {
          const seatPrice = parseFloat(subscription.perSeatPrice);
          lineItems.push({
            description: `Additional Seats (${additionalSeats} seats)`,
            quantity: additionalSeats,
            unitPrice: seatPrice,
            amount: additionalSeats * seatPrice,
          });
        }
      }

      // Create invoice
      const [invoice] = await db
        .insert(schema.subscriptionInvoices)
        .values({
          id: crypto.randomUUID(),
          organizationId,
          subscriptionId,
          invoiceNumber,
          status: 'pending',
          billingPeriodStart,
          billingPeriodEnd,
          subtotal: String(subtotal),
          taxRate: String(taxRate),
          taxAmount: String(taxAmount),
          total: String(total),
          currency: subscription.currency || 'USD',
          amountPaid: '0',
          issueDate,
          dueDate,
          gracePeriodEndsAt: gracePeriodEnds,
          attemptCount: 0,
          lineItems: lineItems as any,
          metadata: {
            billingCycle,
            planName: planDetails?.name || subscription.plan,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.json({ 
        message: "Invoice generated successfully",
        invoice 
      });
    } catch (error: any) {
      console.error("Generate subscription invoice error:", error);
      res.status(500).json({ error: error.message || "Failed to generate invoice" });
    }
  });

  // Pay subscription invoice via Razorpay
  app.post("/api/subscription-invoices/:id/pay", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      // Get invoice
      const [invoice] = await db
        .select()
        .from(schema.subscriptionInvoices)
        .where(
          and(
            eq(schema.subscriptionInvoices.id, id),
            eq(schema.subscriptionInvoices.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      if (invoice.status === 'paid') {
        return res.status(400).json({ error: "Invoice already paid" });
      }

      // Create Razorpay order
      const amountInPaise = Math.round(parseFloat(invoice.total) * 100);

      const order = await razorpayService.createOrder({
        amount: amountInPaise,
        currency: invoice.currency,
        receipt: invoice.invoiceNumber,
        notes: {
          invoice_id: invoice.id,
          invoice_number: invoice.invoiceNumber,
          subscription_id: invoice.subscriptionId,
        },
      });

      // Update invoice with Razorpay order ID
      await db
        .update(schema.subscriptionInvoices)
        .set({
          razorpayOrderId: order.id,
          lastAttemptAt: new Date(),
          attemptCount: invoice.attemptCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.subscriptionInvoices.id, id));

      res.json({
        message: "Payment order created successfully",
        order,
        invoice,
      });
    } catch (error: any) {
      console.error("Pay subscription invoice error:", error);
      res.status(500).json({ error: error.message || "Failed to create payment order" });
    }
  });

  // Complete payment for subscription invoice (after Razorpay verification)
  app.post("/api/subscription-invoices/:id/complete-payment", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
      const organizationId = req.user!.organizationId;
      const userId = req.user!.id;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      // Verify payment signature
      const isValid = razorpayService.verifyPaymentSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });

      if (!isValid) {
        return res.status(400).json({ error: "Invalid payment signature" });
      }

      // Fetch payment details from Razorpay to get actual payment method
      const paymentDetails = await razorpayService.fetchPayment(razorpay_payment_id);
      
      // Map Razorpay payment method to our schema
      // Razorpay returns: "card", "netbanking", "wallet", "upi", "emi", etc.
      let paymentMethod = paymentDetails.method || 'other';
      
      // More specific mapping for cards
      if (paymentMethod === 'card') {
        // Check if it's credit or debit card based on card type
        if (paymentDetails.card && paymentDetails.card.type) {
          paymentMethod = paymentDetails.card.type === 'credit' ? 'credit_card' : 'debit_card';
        } else {
          paymentMethod = 'card'; // Fallback if type not available
        }
      }

      // Get invoice
      const [invoice] = await db
        .select()
        .from(schema.subscriptionInvoices)
        .where(
          and(
            eq(schema.subscriptionInvoices.id, id),
            eq(schema.subscriptionInvoices.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Update invoice as paid with actual payment method from Razorpay
      await db
        .update(schema.subscriptionInvoices)
        .set({
          status: 'paid',
          amountPaid: invoice.total,
          paidAt: new Date(),
          paymentMethod: paymentMethod,
          razorpayPaymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          updatedAt: new Date(),
        })
        .where(eq(schema.subscriptionInvoices.id, id));

      // Create payment record with actual payment method
      await db
        .insert(schema.payments)
        .values({
          id: crypto.randomUUID(),
          organizationId,
          subscriptionInvoiceId: invoice.id,
          amount: invoice.total,
          method: paymentMethod,
          status: 'completed',
          razorpayPaymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          transactionDate: new Date(),
          notes: `Payment for invoice ${invoice.invoiceNumber} via ${paymentMethod}`,
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      // Update subscription last payment
      await db
        .update(schema.platformSubscriptions)
        .set({
          lastPaymentDate: new Date(),
          lastPaymentAmount: invoice.total,
          updatedAt: new Date(),
        })
        .where(eq(schema.platformSubscriptions.id, invoice.subscriptionId));

      res.json({
        message: "Payment completed successfully",
        invoice_id: invoice.id,
        invoice_number: invoice.invoiceNumber,
        payment_method: paymentMethod,
      });
    } catch (error: any) {
      console.error("Complete payment error:", error);
      res.status(500).json({ error: error.message || "Failed to complete payment" });
    }
  });

  // Mark invoice as failed (after payment failure)
  app.post("/api/subscription-invoices/:id/mark-failed", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      const [invoice] = await db
        .select()
        .from(schema.subscriptionInvoices)
        .where(
          and(
            eq(schema.subscriptionInvoices.id, id),
            eq(schema.subscriptionInvoices.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      await db
        .update(schema.subscriptionInvoices)
        .set({
          status: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(schema.subscriptionInvoices.id, id));

      // Check if grace period expired - disable services
      const now = new Date();
      if (invoice.gracePeriodEndsAt && now > invoice.gracePeriodEndsAt) {
        await db
          .update(schema.platformSubscriptions)
          .set({
            status: 'suspended',
            updatedAt: new Date(),
          })
          .where(eq(schema.platformSubscriptions.id, invoice.subscriptionId));

        await db
          .update(schema.subscriptionInvoices)
          .set({
            servicesDisabledAt: now,
            updatedAt: new Date(),
          })
          .where(eq(schema.subscriptionInvoices.id, id));

        res.json({
          message: "Invoice marked as failed and services suspended",
          services_suspended: true,
        });
      } else {
        res.json({
          message: "Invoice marked as failed - grace period active",
          services_suspended: false,
          grace_period_ends: invoice.gracePeriodEndsAt,
        });
      }
    } catch (error: any) {
      console.error("Mark invoice failed error:", error);
      res.status(500).json({ error: error.message || "Failed to mark invoice as failed" });
    }
  });

  // ==================== Payment Methods Routes (Auto-Sweep) ====================

  // List all payment methods for organization
  app.get("/api/payment-methods", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      const methods = await db
        .select()
        .from(schema.paymentMethods)
        .where(eq(schema.paymentMethods.organizationId, organizationId))
        .orderBy(desc(schema.paymentMethods.isDefault), desc(schema.paymentMethods.createdAt));

      res.json(methods);
    } catch (error: any) {
      console.error("List payment methods error:", error);
      res.status(500).json({ error: error.message || "Failed to list payment methods" });
    }
  });

  // Get a single payment method
  app.get("/api/payment-methods/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      const [method] = await db
        .select()
        .from(schema.paymentMethods)
        .where(
          and(
            eq(schema.paymentMethods.id, id),
            eq(schema.paymentMethods.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!method) {
        return res.status(404).json({ error: "Payment method not found" });
      }

      res.json(method);
    } catch (error: any) {
      console.error("Get payment method error:", error);
      res.status(500).json({ error: error.message || "Failed to get payment method" });
    }
  });

  // Setup payment method (initiate Razorpay token creation)
  app.post("/api/payment-methods/setup", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { amount } = req.body; // Small amount for verification (e.g., ₹1)
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      // Get organization and subscription
      const [org] = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, organizationId))
        .limit(1);

      const [subscription] = await db
        .select()
        .from(schema.platformSubscriptions)
        .where(eq(schema.platformSubscriptions.organizationId, organizationId))
        .limit(1);

      if (!org || !subscription) {
        return res.status(404).json({ error: "Organization or subscription not found" });
      }

      // Create or get Razorpay customer
      // SECURITY: Safely decrypt customer ID (handles both encrypted and legacy plaintext)
      let razorpayCustomerId = cryptoUtils.safeDecryptRazorpay(subscription.razorpayCustomerId);
      
      // EFFICIENCY: Lazy re-encryption - automatically upgrade plaintext to encrypted
      // Check if the stored value is plaintext (needs re-encryption)
      const isPlaintext = subscription.razorpayCustomerId && 
                         subscription.razorpayCustomerId.split(':').length !== 3;
      
      if (razorpayCustomerId && isPlaintext) {
        console.info('🔄 LAZY RE-ENCRYPTION: Upgrading plaintext Razorpay customer ID to encrypted format');
        await db
          .update(schema.platformSubscriptions)
          .set({
            razorpayCustomerId: cryptoUtils.encrypt(razorpayCustomerId),
            updatedAt: new Date(),
          })
          .where(eq(schema.platformSubscriptions.id, subscription.id));
      }
      
      if (!razorpayCustomerId) {
        const customer = await razorpayService.createCustomer({
          name: org.name,
          email: req.user!.email,
          contact: req.user!.phone || '',
          notes: {
            organization_id: organizationId,
            organization_slug: org.slug,
          },
        });
        
        razorpayCustomerId = customer.id;
        
        // SECURITY: Encrypt customer ID before storing in database
        await db
          .update(schema.platformSubscriptions)
          .set({
            razorpayCustomerId: cryptoUtils.encrypt(customer.id),
            updatedAt: new Date(),
          })
          .where(eq(schema.platformSubscriptions.id, subscription.id));
      }

      // Create a small verification order
      const order = await razorpayService.createOrder({
        amount: amount || 100, // ₹1 for verification
        currency: subscription.currency || 'INR',
        receipt: `setup_${organizationId}_${Date.now()}`,
        notes: {
          type: 'payment_method_setup',
          organization_id: organizationId,
        },
      });

      res.json({
        message: "Payment setup initiated",
        order,
        customer_id: razorpayCustomerId,
      });
    } catch (error: any) {
      console.error("Setup payment method error:", error);
      res.status(500).json({ error: error.message || "Failed to setup payment method" });
    }
  });

  // Save payment method after successful verification
  app.post("/api/payment-methods/save", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature, nickname } = req.body;
      const organizationId = req.user!.organizationId;
      const userId = req.user!.id;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      // Verify payment signature
      const isValid = razorpayService.verifyPaymentSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });

      if (!isValid) {
        return res.status(400).json({ error: "Invalid payment signature" });
      }

      // Fetch payment details from Razorpay
      const paymentDetails = await razorpayService.fetchPayment(razorpay_payment_id);

      // Extract payment method details
      const type = paymentDetails.method || 'other';
      let cardLast4, cardBrand, cardExpMonth, cardExpYear, cardholderName, upiId;

      if (type === 'card' && paymentDetails.card) {
        cardLast4 = paymentDetails.card.last4;
        cardBrand = paymentDetails.card.network; // visa, mastercard, etc.
        cardExpMonth = parseInt(paymentDetails.card.exp_month);
        cardExpYear = parseInt(paymentDetails.card.exp_year);
        cardholderName = paymentDetails.card.name;
      } else if (type === 'upi' && paymentDetails.vpa) {
        upiId = paymentDetails.vpa; // Masked UPI ID
      }

      // Create payment method record
      // SECURITY: Encrypt sensitive Razorpay tokens before storing in database
      const [paymentMethod] = await db
        .insert(schema.paymentMethods)
        .values({
          id: crypto.randomUUID(),
          organizationId,
          type,
          nickname: nickname || `${cardBrand || type} ending in ${cardLast4 || '****'}`,
          isDefault: false, // Will be set separately
          cardLast4,
          cardBrand,
          cardExpMonth,
          cardExpYear,
          cardholderName,
          upiId,
          razorpayTokenId: cryptoUtils.encrypt(razorpay_payment_id), // Encrypted token
          razorpayCustomerId: cryptoUtils.encrypt(paymentDetails.customer_id), // Encrypted customer ID
          status: 'active',
          lastUsedAt: new Date(),
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Audit log for payment method addition
      await logActivity(
        userId, 
        organizationId, 
        "create", 
        "payment_method", 
        paymentMethod.id, 
        { type, last4: cardLast4 || upiId }, 
        req
      );

      res.json({
        message: "Payment method saved successfully",
        payment_method: paymentMethod,
      });
    } catch (error: any) {
      console.error("Save payment method error:", error);
      res.status(500).json({ error: error.message || "Failed to save payment method" });
    }
  });

  // Set payment method as default
  app.post("/api/payment-methods/:id/set-default", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      // Verify payment method exists and belongs to organization
      const [method] = await db
        .select()
        .from(schema.paymentMethods)
        .where(
          and(
            eq(schema.paymentMethods.id, id),
            eq(schema.paymentMethods.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!method) {
        return res.status(404).json({ error: "Payment method not found" });
      }

      // Remove default from all other methods
      await db
        .update(schema.paymentMethods)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(schema.paymentMethods.organizationId, organizationId));

      // Set this method as default
      await db
        .update(schema.paymentMethods)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(schema.paymentMethods.id, id));

      // Update subscription with default payment method
      await db
        .update(schema.platformSubscriptions)
        .set({
          defaultPaymentMethodId: id,
          updatedAt: new Date(),
        })
        .where(eq(schema.platformSubscriptions.organizationId, organizationId));

      // Audit log for setting default payment method
      await logActivity(
        req.user!.id, 
        organizationId, 
        "update", 
        "payment_method", 
        id, 
        { action: "set_default", type: method.type }, 
        req
      );

      res.json({
        message: "Payment method set as default",
        payment_method_id: id,
      });
    } catch (error: any) {
      console.error("Set default payment method error:", error);
      res.status(500).json({ error: error.message || "Failed to set default payment method" });
    }
  });

  // Delete payment method
  app.delete("/api/payment-methods/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: "User must belong to an organization" });
      }

      // Get payment method
      const [method] = await db
        .select()
        .from(schema.paymentMethods)
        .where(
          and(
            eq(schema.paymentMethods.id, id),
            eq(schema.paymentMethods.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!method) {
        return res.status(404).json({ error: "Payment method not found" });
      }

      // If this was the default, clear it from subscription
      if (method.isDefault) {
        await db
          .update(schema.platformSubscriptions)
          .set({
            defaultPaymentMethodId: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.platformSubscriptions.organizationId, organizationId));
      }

      // Delete payment method
      await db
        .delete(schema.paymentMethods)
        .where(eq(schema.paymentMethods.id, id));

      // Optionally delete token from Razorpay if we have customer ID and token ID
      // SECURITY: Safely decrypt tokens (handles both encrypted and legacy plaintext)
      if (method.razorpayCustomerId && method.razorpayTokenId) {
        try {
          const decryptedCustomerId = cryptoUtils.safeDecryptRazorpay(method.razorpayCustomerId);
          const decryptedTokenId = cryptoUtils.safeDecryptRazorpay(method.razorpayTokenId);
          await razorpayService.deleteToken(decryptedCustomerId!, decryptedTokenId!);
        } catch (error) {
          console.error("Error deleting Razorpay token:", error);
          // Don't fail the whole request if Razorpay deletion fails
        }
      }

      // Audit log for payment method deletion
      await logActivity(
        req.user!.id, 
        organizationId, 
        "delete", 
        "payment_method", 
        id, 
        { type: method.type, was_default: method.isDefault }, 
        req
      );

      res.json({
        message: "Payment method deleted successfully",
        payment_method_id: id,
      });
    } catch (error: any) {
      console.error("Delete payment method error:", error);
      res.status(500).json({ error: error.message || "Failed to delete payment method" });
    }
  });

  // ==================== Mobile App Download Routes ====================

  // Get mobile app download info
  app.get("/api/mobile-apps/info", async (req: Request, res: Response) => {
    try {
      const downloadsDir = path.join(process.cwd(), "public", "downloads");
      const apkPath = path.join(downloadsDir, "accute-mobile.apk");
      const ipaPath = path.join(downloadsDir, "accute-mobile.ipa");

      const apkExists = fs.existsSync(apkPath);
      const ipaExists = fs.existsSync(ipaPath);

      let apkInfo = null;
      let ipaInfo = null;

      if (apkExists) {
        const stats = fs.statSync(apkPath);
        apkInfo = {
          available: true,
          filename: "accute-mobile.apk",
          size: stats.size,
          sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          lastModified: stats.mtime,
          downloadUrl: "/downloads/accute-mobile.apk",
        };
      }

      if (ipaExists) {
        const stats = fs.statSync(ipaPath);
        ipaInfo = {
          available: true,
          filename: "accute-mobile.ipa",
          size: stats.size,
          sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          lastModified: stats.mtime,
          downloadUrl: "/downloads/accute-mobile.ipa",
        };
      }

      res.json({
        android: apkInfo || { available: false },
        ios: ipaInfo || { available: false },
        buildInstructions: "/downloads/BUILD_INSTRUCTIONS.md",
      });
    } catch (error: any) {
      console.error("Mobile app info error:", error);
      res.status(500).json({ error: "Failed to get mobile app info" });
    }
  });

  // Download APK with proper headers and CSP
  app.get("/downloads/accute-mobile.apk", (req: Request, res: Response) => {
    try {
      const apkPath = path.join(process.cwd(), "public", "downloads", "accute-mobile.apk");

      if (!fs.existsSync(apkPath)) {
        return res.status(404).json({ 
          error: "APK not available. Build the app first using: eas build --platform android --profile production" 
        });
      }

      // SECURITY: Set proper headers for APK download
      res.setHeader("Content-Type", "application/vnd.android.package-archive");
      res.setHeader("Content-Disposition", "attachment; filename=accute-mobile.apk");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day cache
      
      // CSP headers for downloads
      res.setHeader("Content-Security-Policy", "default-src 'none'; object-src 'none'; base-uri 'none';");

      // Stream the file
      const fileStream = fs.createReadStream(apkPath);
      fileStream.pipe(res);

      fileStream.on("error", (error) => {
        console.error("APK download error:", error);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to download APK" });
        }
      });
    } catch (error: any) {
      console.error("APK download error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to download APK" });
      }
    }
  });

  // Download IPA with proper headers and CSP
  app.get("/downloads/accute-mobile.ipa", (req: Request, res: Response) => {
    try {
      const ipaPath = path.join(process.cwd(), "public", "downloads", "accute-mobile.ipa");

      if (!fs.existsSync(ipaPath)) {
        return res.status(404).json({ 
          error: "IPA not available. Build the app first using: eas build --platform ios --profile production" 
        });
      }

      // SECURITY: Set proper headers for IPA download
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", "attachment; filename=accute-mobile.ipa");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=86400"); // 1 day cache
      
      // CSP headers for downloads
      res.setHeader("Content-Security-Policy", "default-src 'none'; object-src 'none'; base-uri 'none';");

      // Stream the file
      const fileStream = fs.createReadStream(ipaPath);
      fileStream.pipe(res);

      fileStream.on("error", (error) => {
        console.error("IPA download error:", error);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to download IPA" });
        }
      });
    } catch (error: any) {
      console.error("IPA download error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to download IPA" });
      }
    }
  });

  // ==================== Email Integration Routes ====================
  
  // ====== OAuth State Helpers (HMAC-based CSRF protection) ======
  
  // Derive dedicated HMAC key from ENCRYPTION_KEY to avoid key reuse
  const OAUTH_HMAC_KEY = crypto.createHash('sha256')
    .update(process.env.ENCRYPTION_KEY! + ':oauth_state_hmac')
    .digest();
  
  function generateOAuthState(userId: number, organizationId: number): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const payload = JSON.stringify({ userId, organizationId, nonce, timestamp });
    
    // Sign with HMAC-SHA256 using dedicated OAuth HMAC key
    const hmac = crypto.createHmac('sha256', OAUTH_HMAC_KEY);
    hmac.update(payload);
    const signature = hmac.digest('hex');
    
    // Combine payload and signature
    const state = JSON.stringify({ payload, signature });
    return Buffer.from(state).toString('base64');
  }
  
  function verifyOAuthState(encodedState: string): { userId: number; organizationId: number; nonce: string; timestamp: number } | null {
    try {
      const state = JSON.parse(Buffer.from(encodedState, 'base64').toString());
      const { payload, signature } = state;
      
      // Verify HMAC signature using constant-time comparison
      const hmac = crypto.createHmac('sha256', OAUTH_HMAC_KEY);
      hmac.update(payload);
      const expectedSignature = hmac.digest('hex');
      
      // Use timing-safe comparison to prevent timing attacks
      const signatureBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      
      if (signatureBuffer.length !== expectedBuffer.length || 
          !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        console.error('[OAuth] State signature verification failed');
        return null;
      }
      
      const data = JSON.parse(payload);
      const { userId, organizationId, nonce, timestamp } = data;
      
      // Verify state is not too old (15 minutes max)
      const maxAge = 15 * 60 * 1000;
      if (Date.now() - timestamp > maxAge) {
        console.error('[OAuth] State has expired');
        return null;
      }
      
      return { userId, organizationId, nonce, timestamp };
    } catch (error) {
      console.error('[OAuth] State verification failed:', error);
      return null;
    }
  }
  
  // ====== Gmail OAuth Flow ======
  
  // Initiate Gmail OAuth flow (UI expects /api/email-accounts/oauth/gmail/start)
  app.get("/api/email-accounts/oauth/gmail/start", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { google } = await import('googleapis');
      const redirectUri = `${process.env.REPLIT_DOMAINS?.split(',')[0]}/api/email-accounts/oauth/gmail/callback`;
      
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        redirectUri
      );

      const state = generateOAuthState(userId, organizationId);

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify'
        ],
        state,
        prompt: 'consent'
      });

      res.json({ authUrl });
    } catch (error: any) {
      console.error("[OAuth] Gmail initiation failed:", error);
      res.status(500).json({ error: "Failed to initiate Gmail OAuth" });
    }
  });

  // Gmail OAuth callback
  app.get("/api/email-accounts/oauth/gmail/callback", async (req: Request, res: Response) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        return res.redirect(`/?error=gmail_oauth_${error}`);
      }

      if (!code || !state) {
        return res.redirect('/?error=invalid_oauth_response');
      }

      // CRITICAL: Verify HMAC-signed state to prevent CSRF attacks
      const stateData = verifyOAuthState(state as string);
      
      if (!stateData) {
        console.error('[OAuth] Gmail callback: invalid or forged state');
        return res.redirect('/?error=invalid_state');
      }

      const { userId, organizationId } = stateData;

      const { google } = await import('googleapis');
      const redirectUri = `${process.env.REPLIT_DOMAINS?.split(',')[0]}/api/email-accounts/oauth/gmail/callback`;
      
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        redirectUri
      );

      const { tokens } = await oauth2Client.getToken(code as string);

      if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
        return res.redirect('/?error=invalid_tokens');
      }

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      oauth2Client.setCredentials(tokens);
      
      const profile = await gmail.users.getProfile({ userId: 'me' });
      const emailAddress = profile.data.emailAddress;

      if (!emailAddress) {
        return res.redirect('/?error=no_email_found');
      }

      const { emailOAuthService } = await import('./services/EmailOAuthService');
      const encryptedCredentials = emailOAuthService.encryptCredentials({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(tokens.expiry_date)
      });

      const existingAccount = await db.query.emailAccounts.findFirst({
        where: and(
          eq(schema.emailAccounts.email, emailAddress),
          eq(schema.emailAccounts.userId, userId),
          eq(schema.emailAccounts.organizationId, organizationId)
        )
      });

      if (existingAccount) {
        await db.update(schema.emailAccounts)
          .set({
            encryptedCredentials,
            status: 'active',
            lastSyncError: null,
            updatedAt: new Date()
          })
          .where(eq(schema.emailAccounts.id, existingAccount.id));
      } else {
        await db.insert(schema.emailAccounts).values({
          userId,
          organizationId,
          email: emailAddress,
          displayName: emailAddress,
          provider: 'gmail',
          authType: 'oauth',
          encryptedCredentials,
          status: 'active',
          syncInterval: 300000
        });
      }

      res.redirect('/inbox?success=gmail_connected');
    } catch (error: any) {
      console.error("[OAuth] Gmail callback failed:", error);
      res.redirect(`/?error=gmail_oauth_failed`);
    }
  });

  // ====== Outlook OAuth Flow ======
  
  // Initiate Outlook OAuth flow (UI expects /api/email-accounts/oauth/outlook/start)
  app.get("/api/email-accounts/oauth/outlook/start", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const redirectUri = `${process.env.REPLIT_DOMAINS?.split(',')[0]}/api/email-accounts/oauth/outlook/callback`;
      
      const state = generateOAuthState(userId, organizationId);

      const params = new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID || '',
        response_type: 'code',
        redirect_uri: redirectUri,
        response_mode: 'query',
        scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access',
        state,
        prompt: 'consent'
      });

      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;

      res.json({ authUrl });
    } catch (error: any) {
      console.error("[OAuth] Outlook initiation failed:", error);
      res.status(500).json({ error: "Failed to initiate Outlook OAuth" });
    }
  });

  // Outlook OAuth callback
  app.get("/api/email-accounts/oauth/outlook/callback", async (req: Request, res: Response) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        return res.redirect(`/?error=outlook_oauth_${error}`);
      }

      if (!code || !state) {
        return res.redirect('/?error=invalid_oauth_response');
      }

      // CRITICAL: Verify HMAC-signed state to prevent CSRF attacks
      const stateData = verifyOAuthState(state as string);
      
      if (!stateData) {
        console.error('[OAuth] Outlook callback: invalid or forged state');
        return res.redirect('/?error=invalid_state');
      }

      const { userId, organizationId } = stateData;

      const redirectUri = `${process.env.REPLIT_DOMAINS?.split(',')[0]}/api/email-accounts/oauth/outlook/callback`;
      
      const params = new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID || '',
        client_secret: process.env.AZURE_CLIENT_SECRET || '',
        code: code as string,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access'
      });

      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange authorization code');
      }

      const tokens = await tokenResponse.json();

      if (!tokens.access_token || !tokens.refresh_token || !tokens.expires_in) {
        return res.redirect('/?error=invalid_tokens');
      }

      const { Client } = await import('@microsoft/microsoft-graph-client');
      const client = Client.init({
        authProvider: (done) => {
          done(null, tokens.access_token);
        }
      });

      const user = await client.api('/me').get();
      const emailAddress = user.mail || user.userPrincipalName;

      if (!emailAddress) {
        return res.redirect('/?error=no_email_found');
      }

      const { emailOAuthService } = await import('./services/EmailOAuthService');
      const encryptedCredentials = emailOAuthService.encryptCredentials({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000)
      });

      const existingAccount = await db.query.emailAccounts.findFirst({
        where: and(
          eq(schema.emailAccounts.email, emailAddress),
          eq(schema.emailAccounts.userId, userId),
          eq(schema.emailAccounts.organizationId, organizationId)
        )
      });

      if (existingAccount) {
        await db.update(schema.emailAccounts)
          .set({
            encryptedCredentials,
            status: 'active',
            lastSyncError: null,
            updatedAt: new Date()
          })
          .where(eq(schema.emailAccounts.id, existingAccount.id));
      } else {
        await db.insert(schema.emailAccounts).values({
          userId,
          organizationId,
          email: emailAddress,
          displayName: user.displayName || emailAddress,
          provider: 'outlook',
          authType: 'oauth',
          encryptedCredentials,
          status: 'active',
          syncInterval: 300000
        });
      }

      res.redirect('/inbox?success=outlook_connected');
    } catch (error: any) {
      console.error("[OAuth] Outlook callback failed:", error);
      res.redirect(`/?error=outlook_oauth_failed`);
    }
  });

  // Get all email accounts for current user
  app.get("/api/email/accounts", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const accounts = await db.query.emailAccounts.findMany({
        where: and(
          eq(schema.emailAccounts.userId, userId),
          eq(schema.emailAccounts.organizationId, organizationId)
        ),
        columns: {
          id: true,
          email: true,
          displayName: true,
          provider: true,
          status: true,
          lastSyncAt: true,
          lastSyncError: true,
          syncInterval: true,
          autoCreateTasks: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      res.json(accounts);
    } catch (error: any) {
      console.error("[Email] Failed to fetch email accounts:", error);
      res.status(500).json({ error: "Failed to fetch email accounts" });
    }
  });

  // Get email account by ID
  app.get("/api/email/accounts/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const account = await db.query.emailAccounts.findFirst({
        where: and(
          eq(schema.emailAccounts.id, id),
          eq(schema.emailAccounts.userId, userId),
          eq(schema.emailAccounts.organizationId, organizationId)
        ),
        columns: {
          id: true,
          email: true,
          displayName: true,
          provider: true,
          status: true,
          lastSyncAt: true,
          lastSyncError: true,
          syncInterval: true,
          autoCreateTasks: true,
          defaultWorkflowId: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      if (!account) {
        return res.status(404).json({ error: "Email account not found" });
      }

      res.json(account);
    } catch (error: any) {
      console.error("[Email] Failed to fetch email account:", error);
      res.status(500).json({ error: "Failed to fetch email account" });
    }
  });

  // Update email account settings
  app.patch("/api/email/accounts/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify ownership
      const account = await db.query.emailAccounts.findFirst({
        where: and(
          eq(schema.emailAccounts.id, id),
          eq(schema.emailAccounts.userId, userId),
          eq(schema.emailAccounts.organizationId, organizationId)
        )
      });

      if (!account) {
        return res.status(404).json({ error: "Email account not found" });
      }

      const updateSchema = z.object({
        displayName: z.string().optional(),
        syncInterval: z.number().min(60000).max(3600000).optional(),
        autoCreateTasks: z.boolean().optional(),
        defaultWorkflowId: z.string().nullable().optional(),
      });

      const data = updateSchema.parse(req.body);

      const [updated] = await db.update(schema.emailAccounts)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(schema.emailAccounts.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("[Email] Failed to update email account:", error);
      res.status(500).json({ error: "Failed to update email account" });
    }
  });

  // Delete email account
  app.delete("/api/email/accounts/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify ownership
      const account = await db.query.emailAccounts.findFirst({
        where: and(
          eq(schema.emailAccounts.id, id),
          eq(schema.emailAccounts.userId, userId),
          eq(schema.emailAccounts.organizationId, organizationId)
        )
      });

      if (!account) {
        return res.status(404).json({ error: "Email account not found" });
      }

      await db.delete(schema.emailAccounts)
        .where(eq(schema.emailAccounts.id, id));

      res.json({ success: true, message: "Email account deleted successfully" });
    } catch (error: any) {
      console.error("[Email] Failed to delete email account:", error);
      res.status(500).json({ error: "Failed to delete email account" });
    }
  });

  // Trigger manual sync for email account
  app.post("/api/email/accounts/:id/sync", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify ownership
      const account = await db.query.emailAccounts.findFirst({
        where: and(
          eq(schema.emailAccounts.id, id),
          eq(schema.emailAccounts.userId, userId),
          eq(schema.emailAccounts.organizationId, organizationId)
        )
      });

      if (!account) {
        return res.status(404).json({ error: "Email account not found" });
      }

      // Import sync service dynamically
      const { emailSyncService } = await import('./services/EmailSyncService');
      const result = await emailSyncService.syncAccount(id);

      res.json({
        success: true,
        message: `Sync complete: ${result.newCount} new messages`,
        ...result
      });
    } catch (error: any) {
      console.error("[Email] Sync failed:", error);
      res.status(500).json({ error: error.message || "Failed to sync emails" });
    }
  });

  // Get emails for an account
  app.get("/api/email/accounts/:accountId/messages", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { accountId } = req.params;
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;
      
      const { limit = '50', offset = '0', isRead, isStarred, labels } = req.query;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Verify account ownership
      const account = await db.query.emailAccounts.findFirst({
        where: and(
          eq(schema.emailAccounts.id, accountId),
          eq(schema.emailAccounts.userId, userId),
          eq(schema.emailAccounts.organizationId, organizationId)
        )
      });

      if (!account) {
        return res.status(404).json({ error: "Email account not found" });
      }

      const conditions = [eq(schema.emailMessages.emailAccountId, accountId)];
      
      if (isRead !== undefined) {
        conditions.push(eq(schema.emailMessages.isRead, isRead === 'true'));
      }
      
      if (isStarred !== undefined) {
        conditions.push(eq(schema.emailMessages.isStarred, isStarred === 'true'));
      }

      const messages = await db.query.emailMessages.findMany({
        where: and(...conditions),
        orderBy: desc(schema.emailMessages.receivedAt),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      res.json(messages);
    } catch (error: any) {
      console.error("[Email] Failed to fetch messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Get single email message
  app.get("/api/email/messages/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const message = await db.query.emailMessages.findFirst({
        where: eq(schema.emailMessages.id, id),
        with: {
          emailAccount: true,
        }
      });

      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Verify user has access to this message's account
      if (message.emailAccount.userId !== userId || message.emailAccount.organizationId !== organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(message);
    } catch (error: any) {
      console.error("[Email] Failed to fetch message:", error);
      res.status(500).json({ error: "Failed to fetch message" });
    }
  });

  // Update email message (mark as read/starred, etc.)
  app.patch("/api/email/messages/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const message = await db.query.emailMessages.findFirst({
        where: eq(schema.emailMessages.id, id),
        with: {
          emailAccount: true,
        }
      });

      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Verify ownership
      if (message.emailAccount.userId !== userId || message.emailAccount.organizationId !== organizationId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updateSchema = z.object({
        isRead: z.boolean().optional(),
        isStarred: z.boolean().optional(),
        labels: z.array(z.string()).optional(),
      });

      const data = updateSchema.parse(req.body);

      const [updated] = await db.update(schema.emailMessages)
        .set(data)
        .where(eq(schema.emailMessages.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("[Email] Failed to update message:", error);
      res.status(500).json({ error: "Failed to update message" });
    }
  });

  // Search emails
  app.get("/api/email/search", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId;
      const { q, accountId, from, to, subject } = req.query;

      if (!userId || !organizationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get user's email accounts
      const userAccounts = await db.query.emailAccounts.findMany({
        where: and(
          eq(schema.emailAccounts.userId, userId),
          eq(schema.emailAccounts.organizationId, organizationId)
        ),
        columns: { id: true }
      });

      const accountIds = userAccounts.map(a => a.id);

      if (accountIds.length === 0) {
        return res.json([]);
      }

      // Build search conditions
      const conditions = [
        sql`${schema.emailMessages.emailAccountId} IN ${accountIds}`
      ];

      if (accountId && typeof accountId === 'string') {
        conditions.push(eq(schema.emailMessages.emailAccountId, accountId));
      }

      if (from && typeof from === 'string') {
        conditions.push(sql`${schema.emailMessages.from} ILIKE ${'%' + from + '%'}`);
      }

      if (subject && typeof subject === 'string') {
        conditions.push(sql`${schema.emailMessages.subject} ILIKE ${'%' + subject + '%'}`);
      }

      if (q && typeof q === 'string') {
        conditions.push(sql`(
          ${schema.emailMessages.subject} ILIKE ${'%' + q + '%'} OR
          ${schema.emailMessages.body} ILIKE ${'%' + q + '%'} OR
          ${schema.emailMessages.from} ILIKE ${'%' + q + '%'}
        )`);
      }

      const messages = await db.query.emailMessages.findMany({
        where: and(...conditions),
        orderBy: desc(schema.emailMessages.receivedAt),
        limit: 100,
      });

      res.json(messages);
    } catch (error: any) {
      console.error("[Email] Search failed:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // ==================== Email Threading Routes ====================

  const { EmailThreadingService } = await import('./services/EmailThreadingService');
  const emailThreadingService = new EmailThreadingService();

  // List all email threads for organization
  app.get("/api/email/threads", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const threads = await emailThreadingService.getThreadsForOrganization(
        organizationId,
        limit,
        offset
      );

      res.json(threads);
    } catch (error: any) {
      console.error("[Email Threading] Failed to list threads:", error);
      res.status(500).json({ error: "Failed to fetch email threads" });
    }
  });

  // Get thread detail with all messages
  app.get("/api/email/threads/:threadId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { threadId } = req.params;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const messages = await emailThreadingService.getThreadMessages(threadId, organizationId);

      if (messages.length === 0) {
        return res.status(404).json({ error: "Thread not found" });
      }

      const summary = await emailThreadingService.getThreadSummary(threadId, organizationId);

      res.json({
        threadId,
        summary,
        messages
      });
    } catch (error: any) {
      console.error("[Email Threading] Failed to get thread:", error);
      res.status(500).json({ error: "Failed to fetch thread" });
    }
  });

  // Mark thread as read
  app.patch("/api/email/threads/:threadId/read", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { threadId } = req.params;
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      await emailThreadingService.markThreadAsRead(threadId, organizationId);

      res.json({ success: true, message: "Thread marked as read" });
    } catch (error: any) {
      console.error("[Email Threading] Failed to mark thread as read:", error);
      res.status(500).json({ error: "Failed to mark thread as read" });
    }
  });

  // Register pricing management routes (product families, SKUs, add-ons, gateways, service plans)
  registerPricingRoutes(app);

  // Register subscription & feature gating routes
  registerSubscriptionRoutes(app);

  // ==================== FORECASTING SYSTEM ====================
  
  // List forecasting models
  app.get("/api/forecasting/models", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const models = await db.query.forecastingModels.findMany({
        where: eq(schema.forecastingModels.organizationId, organizationId),
        orderBy: desc(schema.forecastingModels.createdAt),
      });

      res.json(models);
    } catch (error: any) {
      console.error("[Forecasting] Failed to list models:", error);
      res.status(500).json({ error: "Failed to fetch forecasting models" });
    }
  });

  // Create forecasting model
  app.post("/api/forecasting/models", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;
      
      if (!organizationId || !userId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const validated = schema.insertForecastingModelSchema.parse({
        ...req.body,
        organizationId,
        createdBy: userId,
      });

      const [model] = await db.insert(schema.forecastingModels).values(validated).returning();
      res.json(model);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[Forecasting] Failed to create model:", error);
      res.status(500).json({ error: "Failed to create forecasting model" });
    }
  });

  // Run forecast
  app.post("/api/forecasting/runs", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;
      
      if (!organizationId || !userId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const validated = schema.insertForecastingRunSchema.parse({
        ...req.body,
        organizationId,
        runBy: userId,
      });

      const [run] = await db.insert(schema.forecastingRuns).values(validated).returning();
      
      // Generate scenarios and predictions asynchronously
      setTimeout(async () => {
        try {
          const scenarios = [
            { label: 'best_case', growthRate: '15%' },
            { label: 'expected', growthRate: '5%' },
            { label: 'worst_case', growthRate: '-10%' },
          ];

          for (const scenarioData of scenarios) {
            const [scenario] = await db.insert(schema.forecastingScenarios).values({
              runId: run.id,
              ...scenarioData,
            }).returning();

            // Generate sample predictions
            const startDate = new Date(validated.startDate);
            const endDate = new Date(validated.endDate);
            const predictions = [];

            for (let date = new Date(startDate); date <= endDate; date.setMonth(date.getMonth() + 1)) {
              const periodEnd = new Date(date);
              periodEnd.setMonth(periodEnd.getMonth() + 1);

              predictions.push({
                runId: run.id,
                scenarioId: scenario.id,
                periodStart: new Date(date),
                periodEnd,
                metrics: {
                  predicted_revenue: Math.floor(Math.random() * 100000) + 50000,
                  confidence: 0.75 + Math.random() * 0.2,
                },
                confidenceScore: (0.75 + Math.random() * 0.2).toFixed(2),
              });
            }

            await db.insert(schema.forecastingPredictions).values(predictions);
          }

          await db.update(schema.forecastingRuns).set({
            status: 'completed',
            completedAt: new Date(),
          }).where(eq(schema.forecastingRuns.id, run.id));
        } catch (error) {
          console.error("[Forecasting] Failed to generate predictions:", error);
          await db.update(schema.forecastingRuns).set({
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          }).where(eq(schema.forecastingRuns.id, run.id));
        }
      }, 0);

      res.json(run);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[Forecasting] Failed to create run:", error);
      res.status(500).json({ error: "Failed to create forecast run" });
    }
  });

  // Get forecast results
  app.get("/api/forecasting/runs/:runId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { runId } = req.params;
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const run = await db.query.forecastingRuns.findFirst({
        where: and(
          eq(schema.forecastingRuns.id, runId),
          eq(schema.forecastingRuns.organizationId, organizationId)
        ),
      });

      if (!run) {
        return res.status(404).json({ error: "Forecast run not found" });
      }

      const scenarios = await db.query.forecastingScenarios.findMany({
        where: eq(schema.forecastingScenarios.runId, runId),
      });

      const predictions = await db.query.forecastingPredictions.findMany({
        where: eq(schema.forecastingPredictions.runId, runId),
        orderBy: schema.forecastingPredictions.periodStart,
      });

      res.json({
        ...run,
        scenarios,
        predictions,
      });
    } catch (error: any) {
      console.error("[Forecasting] Failed to fetch run:", error);
      res.status(500).json({ error: "Failed to fetch forecast run" });
    }
  });

  // ==================== SCHEDULED REPORTS ====================
  
  // List scheduled reports
  app.get("/api/scheduled-reports", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const reports = await db.query.scheduledReports.findMany({
        where: eq(schema.scheduledReports.organizationId, organizationId),
        orderBy: desc(schema.scheduledReports.createdAt),
      });

      res.json(reports);
    } catch (error: any) {
      console.error("[Scheduled Reports] Failed to list reports:", error);
      res.status(500).json({ error: "Failed to fetch scheduled reports" });
    }
  });

  // Create scheduled report
  app.post("/api/scheduled-reports", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;
      
      if (!organizationId || !userId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const validated = schema.insertScheduledReportSchema.parse({
        ...req.body,
        organizationId,
        createdBy: userId,
      });

      const [report] = await db.insert(schema.scheduledReports).values(validated).returning();
      res.json(report);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[Scheduled Reports] Failed to create report:", error);
      res.status(500).json({ error: "Failed to create scheduled report" });
    }
  });

  // Update scheduled report
  app.patch("/api/scheduled-reports/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const [updated] = await db.update(schema.scheduledReports)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(
          eq(schema.scheduledReports.id, id),
          eq(schema.scheduledReports.organizationId, organizationId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Scheduled report not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("[Scheduled Reports] Failed to update report:", error);
      res.status(500).json({ error: "Failed to update scheduled report" });
    }
  });

  // Delete scheduled report
  app.delete("/api/scheduled-reports/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const [deleted] = await db.delete(schema.scheduledReports)
        .where(and(
          eq(schema.scheduledReports.id, id),
          eq(schema.scheduledReports.organizationId, organizationId)
        ))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: "Scheduled report not found" });
      }

      res.json({ success: true, message: "Scheduled report deleted" });
    } catch (error: any) {
      console.error("[Scheduled Reports] Failed to delete report:", error);
      res.status(500).json({ error: "Failed to delete scheduled report" });
    }
  });

  // ==================== VIDEO CONFERENCING ====================
  
  // List OAuth connections
  app.get("/api/oauth/connections", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;
      
      if (!organizationId || !userId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const connections = await db.query.oauthConnections.findMany({
        where: and(
          eq(schema.oauthConnections.organizationId, organizationId),
          eq(schema.oauthConnections.userId, userId)
        ),
        orderBy: desc(schema.oauthConnections.createdAt),
      });

      // Don't expose encrypted credentials
      const sanitized = connections.map(conn => ({
        ...conn,
        encryptedCredentials: undefined,
      }));

      res.json(sanitized);
    } catch (error: any) {
      console.error("[OAuth] Failed to list connections:", error);
      res.status(500).json({ error: "Failed to fetch OAuth connections" });
    }
  });

  // Create meeting
  app.post("/api/meetings", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;
      
      if (!organizationId || !userId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const validated = schema.insertMeetingRecordSchema.parse({
        ...req.body,
        organizationId,
        hostId: userId,
      });

      const [meeting] = await db.insert(schema.meetingRecords).values(validated).returning();
      res.json(meeting);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[Meetings] Failed to create meeting:", error);
      res.status(500).json({ error: "Failed to create meeting" });
    }
  });

  // List meetings
  app.get("/api/meetings", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const meetings = await db.query.meetingRecords.findMany({
        where: eq(schema.meetingRecords.organizationId, organizationId),
        orderBy: desc(schema.meetingRecords.startTime),
        limit: 100,
      });

      res.json(meetings);
    } catch (error: any) {
      console.error("[Meetings] Failed to list meetings:", error);
      res.status(500).json({ error: "Failed to fetch meetings" });
    }
  });

  // Update meeting
  app.patch("/api/meetings/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const [updated] = await db.update(schema.meetingRecords)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(
          eq(schema.meetingRecords.id, id),
          eq(schema.meetingRecords.organizationId, organizationId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Meeting not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("[Meetings] Failed to update meeting:", error);
      res.status(500).json({ error: "Failed to update meeting" });
    }
  });

  // ==================== RESOURCE ALLOCATION ROUTES ====================

  // Create resource allocation
  app.post("/api/resource-allocations", requireAuth, requirePermission("projects.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      const currentUserId = req.user?.id;
      
      if (!organizationId || !currentUserId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      // Validate input schema - parse first, then override organizationId
      const parsed = insertResourceAllocationSchema.omit({ organizationId: true }).parse(req.body);
      const validated = { ...parsed, organizationId };

      // SECURITY: Verify user belongs to organization
      const user = await db.query.users.findFirst({
        where: and(
          eq(schema.users.id, validated.userId),
          or(
            eq(schema.users.organizationId, organizationId),
            eq(schema.users.defaultOrganizationId, organizationId)
          )
        ),
      });

      if (!user) {
        return res.status(403).json({ error: "User does not belong to organization" });
      }

      // SECURITY: Verify project belongs to organization
      const project = await db.query.projects.findFirst({
        where: and(
          eq(schema.projects.id, validated.projectId),
          eq(schema.projects.organizationId, organizationId)
        ),
      });

      if (!project) {
        return res.status(403).json({ error: "Project does not belong to organization" });
      }

      const allocation = await ResourceAllocationService.createAllocation(validated);

      // Log activity AFTER successful creation
      await logActivity(currentUserId, organizationId, "create", "resource_allocation", allocation.id, {}, req);
      res.status(201).json(allocation);
    } catch (error: any) {
      if (error.message?.includes("conflict") || error.message?.includes("Conflict")) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message?.includes("exceeds 100%")) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[Resource Allocations] Failed to create allocation:", error);
      res.status(500).json({ error: "Failed to create resource allocation" });
    }
  });

  // Update resource allocation
  app.patch("/api/resource-allocations/:id", requireAuth, requirePermission("projects.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;
      const currentUserId = req.user?.id;
      
      if (!organizationId || !currentUserId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      // Create partial update schema that validates types/ranges
      const updateSchema = insertResourceAllocationSchema.partial().omit({ 
        id: true, 
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      });

      // Validate all incoming fields
      const validated = updateSchema.parse(req.body);

      // If userId is being updated, verify it belongs to organization
      if (validated.userId) {
        const user = await db.query.users.findFirst({
          where: and(
            eq(schema.users.id, validated.userId),
            or(
              eq(schema.users.organizationId, organizationId),
              eq(schema.users.defaultOrganizationId, organizationId)
            )
          ),
        });

        if (!user) {
          return res.status(403).json({ error: "User does not belong to organization" });
        }
      }

      // If projectId is being updated, verify it belongs to organization
      if (validated.projectId) {
        const project = await db.query.projects.findFirst({
          where: and(
            eq(schema.projects.id, validated.projectId),
            eq(schema.projects.organizationId, organizationId)
          ),
        });

        if (!project) {
          return res.status(403).json({ error: "Project does not belong to organization" });
        }
      }

      const allocation = await ResourceAllocationService.updateAllocation(
        id,
        organizationId,
        validated
      );

      // Log activity AFTER successful update
      await logActivity(currentUserId, organizationId, "update", "resource_allocation", allocation.id, {}, req);
      res.json(allocation);
    } catch (error: any) {
      if (error.message === "Allocation not found") {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("conflict") || error.message?.includes("Conflict")) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message?.includes("exceeds 100%")) {
        return res.status(400).json({ error: error.message });
      }
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[Resource Allocations] Failed to update allocation:", error);
      res.status(500).json({ error: "Failed to update resource allocation" });
    }
  });

  // Delete resource allocation
  app.delete("/api/resource-allocations/:id", requireAuth, requirePermission("projects.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;
      const currentUserId = req.user?.id;
      
      if (!organizationId || !currentUserId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const allocation = await ResourceAllocationService.deleteAllocation(id, organizationId);

      // Log activity AFTER successful deletion
      await logActivity(currentUserId, organizationId, "delete", "resource_allocation", allocation.id, {}, req);
      res.json(allocation);
    } catch (error: any) {
      if (error.message === "Allocation not found") {
        return res.status(404).json({ error: "Allocation not found" });
      }
      console.error("[Resource Allocations] Failed to delete allocation:", error);
      res.status(500).json({ error: "Failed to delete resource allocation" });
    }
  });

  // Get allocations by user
  app.get("/api/resource-allocations/user/:userId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const allocations = await ResourceAllocationService.getAllocationsByUser(userId, organizationId);
      res.json(allocations);
    } catch (error: any) {
      console.error("[Resource Allocations] Failed to fetch user allocations:", error);
      res.status(500).json({ error: "Failed to fetch user allocations" });
    }
  });

  // Get allocations by project
  app.get("/api/resource-allocations/project/:projectId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const allocations = await ResourceAllocationService.getAllocationsByProject(projectId, organizationId);
      res.json(allocations);
    } catch (error: any) {
      console.error("[Resource Allocations] Failed to fetch project allocations:", error);
      res.status(500).json({ error: "Failed to fetch project allocations" });
    }
  });

  // Get utilization summary
  app.get("/api/resource-allocations/utilization-summary", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const summary = await ResourceAllocationService.getUtilizationSummary(organizationId);
      res.json(summary);
    } catch (error: any) {
      console.error("[Resource Allocations] Failed to fetch utilization summary:", error);
      res.status(500).json({ error: "Failed to fetch utilization summary" });
    }
  });

  // ==================== SKILLS MANAGEMENT ROUTES ====================

  // Create skill
  app.post("/api/skills", requireAuth, requirePermission("settings.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      const currentUserId = req.user?.id;
      
      if (!organizationId || !currentUserId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const parsed = insertSkillSchema.omit({ organizationId: true }).parse(req.body);
      const skill = await SkillService.createSkill({
        ...parsed,
        organizationId,
      });

      await logActivity(currentUserId, organizationId, "create", "skill", skill.id, {}, req);
      res.status(201).json(skill);
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        return res.status(409).json({ error: error.message });
      }
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[Skills] Failed to create skill:", error);
      res.status(500).json({ error: "Failed to create skill" });
    }
  });

  // Update skill
  app.patch("/api/skills/:id", requireAuth, requirePermission("settings.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;
      const currentUserId = req.user?.id;
      
      if (!organizationId || !currentUserId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const updateSchema = insertSkillSchema.partial().omit({ 
        id: true, 
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      });

      const validated = updateSchema.parse(req.body);
      const skill = await SkillService.updateSkill(id, organizationId, validated);

      await logActivity(currentUserId, organizationId, "update", "skill", skill.id, {}, req);
      res.json(skill);
    } catch (error: any) {
      if (error.message === "Skill not found") {
        return res.status(404).json({ error: error.message });
      }
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[Skills] Failed to update skill:", error);
      res.status(500).json({ error: "Failed to update skill" });
    }
  });

  // Delete skill
  app.delete("/api/skills/:id", requireAuth, requirePermission("settings.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organizationId;
      const currentUserId = req.user?.id;
      
      if (!organizationId || !currentUserId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const skill = await SkillService.deleteSkill(id, organizationId);

      await logActivity(currentUserId, organizationId, "delete", "skill", skill.id, {}, req);
      res.json(skill);
    } catch (error: any) {
      if (error.message === "Skill not found") {
        return res.status(404).json({ error: error.message });
      }
      console.error("[Skills] Failed to delete skill:", error);
      res.status(500).json({ error: "Failed to delete skill" });
    }
  });

  // List organization skills
  app.get("/api/skills", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const skills = await SkillService.getOrganizationSkills(organizationId);
      res.json(skills);
    } catch (error: any) {
      console.error("[Skills] Failed to fetch skills:", error);
      res.status(500).json({ error: "Failed to fetch skills" });
    }
  });

  // Get skill statistics
  app.get("/api/skills/stats", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const stats = await SkillService.getOrganizationSkillStats(organizationId);
      res.json(stats);
    } catch (error: any) {
      console.error("[Skills] Failed to fetch skill stats:", error);
      res.status(500).json({ error: "Failed to fetch skill statistics" });
    }
  });

  // ==================== USER SKILLS ROUTES ====================

  // Add skill to user
  app.post("/api/users/:userId/skills", requireAuth, requirePermission("team.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const organizationId = req.user?.organizationId;
      const currentUserId = req.user?.id;
      
      if (!organizationId || !currentUserId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const parsed = insertUserSkillSchema.omit({ userId: true }).parse(req.body);
      const userSkill = await SkillService.addUserSkill({
        ...parsed,
        userId,
      });

      await logActivity(currentUserId, organizationId, "create", "user_skill", userSkill.id, {}, req);
      res.status(201).json(userSkill);
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message?.includes("not found in organization") || error.message?.includes("not belong")) {
        return res.status(403).json({ error: error.message });
      }
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[User Skills] Failed to add user skill:", error);
      res.status(500).json({ error: "Failed to add skill to user" });
    }
  });

  // Update user skill
  app.patch("/api/users/:userId/skills/:userSkillId", requireAuth, requirePermission("team.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { userId, userSkillId } = req.params;
      const organizationId = req.user?.organizationId;
      const currentUserId = req.user?.id;
      
      if (!organizationId || !currentUserId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const updateSchema = insertUserSkillSchema.partial().omit({ 
        id: true, 
        userId: true,
        skillId: true,
        createdAt: true,
        updatedAt: true,
      });

      const validated = updateSchema.parse(req.body);
      const userSkill = await SkillService.updateUserSkill(userSkillId, userId, organizationId, validated);

      await logActivity(currentUserId, organizationId, "update", "user_skill", userSkill.id, {}, req);
      res.json(userSkill);
    } catch (error: any) {
      if (error.message === "User skill not found") {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("Unauthorized")) {
        return res.status(403).json({ error: error.message });
      }
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[User Skills] Failed to update user skill:", error);
      res.status(500).json({ error: "Failed to update user skill" });
    }
  });

  // Remove skill from user
  app.delete("/api/users/:userId/skills/:userSkillId", requireAuth, requirePermission("team.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { userId, userSkillId } = req.params;
      const organizationId = req.user?.organizationId;
      const currentUserId = req.user?.id;
      
      if (!organizationId || !currentUserId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const userSkill = await SkillService.removeUserSkill(userSkillId, userId, organizationId);

      await logActivity(currentUserId, organizationId, "delete", "user_skill", userSkill.id, {}, req);
      res.json(userSkill);
    } catch (error: any) {
      if (error.message === "User skill not found") {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("Unauthorized")) {
        return res.status(403).json({ error: error.message });
      }
      console.error("[User Skills] Failed to remove user skill:", error);
      res.status(500).json({ error: "Failed to remove user skill" });
    }
  });

  // Get user's skills
  app.get("/api/users/:userId/skills", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const skills = await SkillService.getUserSkills(userId, organizationId);
      res.json(skills);
    } catch (error: any) {
      if (error.message?.includes("not found in organization")) {
        return res.status(403).json({ error: error.message });
      }
      console.error("[User Skills] Failed to fetch user skills:", error);
      res.status(500).json({ error: "Failed to fetch user skills" });
    }
  });

  // Endorse user skill
  app.post("/api/users/:userId/skills/:userSkillId/endorse", requireAuth, requirePermission("team.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { userSkillId } = req.params;
      const organizationId = req.user?.organizationId;
      const currentUserId = req.user?.id;
      
      if (!organizationId || !currentUserId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const userSkill = await SkillService.endorseUserSkill(userSkillId, organizationId);

      // Log endorsement activity
      await logActivity(currentUserId, organizationId, "endorse", "user_skill", userSkill.id, {}, req);
      res.json(userSkill);
    } catch (error: any) {
      if (error.message === "User skill not found") {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("Unauthorized")) {
        return res.status(403).json({ error: error.message });
      }
      console.error("[User Skills] Failed to endorse user skill:", error);
      res.status(500).json({ error: "Failed to endorse skill" });
    }
  });

  // ==================== TASK SKILL REQUIREMENTS ROUTES ====================

  // Add skill requirement to task
  app.post("/api/tasks/:taskId/skills", requireAuth, requirePermission("workflows.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { taskId } = req.params;
      const organizationId = req.user?.organizationId;
      const currentUserId = req.user?.id;
      
      if (!organizationId || !currentUserId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const parsed = insertTaskSkillRequirementSchema.omit({ taskId: true }).parse(req.body);
      const requirement = await SkillService.addTaskSkillRequirement({
        ...parsed,
        taskId,
        organizationId,
      });

      await logActivity(currentUserId, organizationId, "create", "task_skill_requirement", requirement.id, {}, req);
      res.status(201).json(requirement);
    } catch (error: any) {
      if (error.message?.includes("already exists")) {
        return res.status(409).json({ error: error.message });
      }
      if (error.message?.includes("not found") || error.message?.includes("not belong")) {
        return res.status(403).json({ error: error.message });
      }
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[Task Skills] Failed to add task skill requirement:", error);
      res.status(500).json({ error: "Failed to add skill requirement to task" });
    }
  });

  // Update task skill requirement
  app.patch("/api/tasks/:taskId/skills/:requirementId", requireAuth, requirePermission("workflows.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { requirementId } = req.params;
      const organizationId = req.user?.organizationId;
      const currentUserId = req.user?.id;
      
      if (!organizationId || !currentUserId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const updateSchema = insertTaskSkillRequirementSchema.partial().omit({ 
        id: true, 
        taskId: true,
        skillId: true,
      });

      const validated = updateSchema.parse(req.body);
      const requirement = await SkillService.updateTaskSkillRequirement(requirementId, organizationId, validated);

      await logActivity(currentUserId, organizationId, "update", "task_skill_requirement", requirement.id, {}, req);
      res.json(requirement);
    } catch (error: any) {
      if (error.message === "Task skill requirement not found") {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("Unauthorized")) {
        return res.status(403).json({ error: error.message });
      }
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[Task Skills] Failed to update task skill requirement:", error);
      res.status(500).json({ error: "Failed to update task skill requirement" });
    }
  });

  // Remove skill requirement from task
  app.delete("/api/tasks/:taskId/skills/:requirementId", requireAuth, requirePermission("workflows.manage"), async (req: AuthRequest, res: Response) => {
    try {
      const { requirementId } = req.params;
      const organizationId = req.user?.organizationId;
      const currentUserId = req.user?.id;
      
      if (!organizationId || !currentUserId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const requirement = await SkillService.removeTaskSkillRequirement(requirementId, organizationId);

      await logActivity(currentUserId, organizationId, "delete", "task_skill_requirement", requirement.id, {}, req);
      res.json(requirement);
    } catch (error: any) {
      if (error.message === "Task skill requirement not found") {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("Unauthorized")) {
        return res.status(403).json({ error: error.message });
      }
      console.error("[Task Skills] Failed to remove task skill requirement:", error);
      res.status(500).json({ error: "Failed to remove task skill requirement" });
    }
  });

  // Get task skill requirements
  app.get("/api/tasks/:taskId/skills", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { taskId } = req.params;
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const requirements = await SkillService.getTaskSkillRequirements(taskId, organizationId);
      res.json(requirements);
    } catch (error: any) {
      if (error.message?.includes("not found") || error.message?.includes("Unauthorized")) {
        return res.status(403).json({ error: error.message });
      }
      console.error("[Task Skills] Failed to fetch task skill requirements:", error);
      res.status(500).json({ error: "Failed to fetch task skill requirements" });
    }
  });

  // Find matching users for task
  app.get("/api/tasks/:taskId/matches", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { taskId } = req.params;
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        return res.status(403).json({ error: "Organization access required" });
      }

      const matches = await SkillService.findMatchingUsers(taskId, organizationId);
      res.json(matches);
    } catch (error: any) {
      if (error.message?.includes("not found") || error.message?.includes("Unauthorized")) {
        return res.status(403).json({ error: error.message });
      }
      console.error("[Task Skills] Failed to find matching users:", error);
      res.status(500).json({ error: "Failed to find matching users for task" });
    }
  });

  const httpServer = createServer(app);
  
  // Setup lazy WebSocket initialization - will initialize on first upgrade request
  setupWebSocket(httpServer);
  
  return httpServer;
}
