import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import { calculateKycCompletion } from "@shared/kycUtils";

const SALT_ROUNDS = 12;

// SECURITY: JWT_SECRET is validated in server/index.ts validateEnvironment()
// No fallback - server will fail fast at startup if missing (prevents session invalidation on restart)
const JWT_SECRET = process.env.JWT_SECRET!;
const SESSION_EXPIRY_HOURS = 24 * 7; // 7 days

export interface AuthRequest extends Request {
  user?: User;
  userId?: string;
}

// Hash password using bcrypt
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// Generate JWT token
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: `${SESSION_EXPIRY_HOURS}h`,
  });
}

// Verify JWT token
export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded;
  } catch (error) {
    return null;
  }
}

// AES-256 encryption for sensitive data
// SECURITY: ENCRYPTION_KEY is validated in server/index.ts validateEnvironment()
// No fallback - server will fail fast at startup if missing (prevents silent data loss on restart)
const ENCRYPTION_KEY = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY!).digest();
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encryptedText = parts.join(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Authentication middleware
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Check both Authorization header and cookie
    const authHeader = req.headers.authorization;
    let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    // If no Bearer token, check for cookie
    if (!token && req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      token = cookies['session_token'] || null;
    }

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const session = await storage.getSession(token);
    if (!session) {
      console.error('Session not found for token:', token.substring(0, 20) + '...');
      return res.status(401).json({ error: "Session expired" });
    }
    if (session.expiresAt < new Date()) {
      console.error('Session expired:', session.expiresAt, 'Current time:', new Date());
      return res.status(401).json({ error: "Session expired" });
    }

    const user = await storage.getUser(session.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not found or inactive" });
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid authentication" });
  }
}

// Permission check middleware (subscription-aware via RBAC bridge)
export function requirePermission(permission: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      console.log(`❌ [PERMISSION] No user in request for permission: ${permission}`);
      return res.status(401).json({ error: "Authentication required" });
    }

    // ✅ NEW: Use subscription-aware effective permissions
    const { getEffectivePermissions } = await import('./rbac-subscription-bridge');
    const effectivePermissions = await getEffectivePermissions(
      req.user.id,
      req.user.roleId,
      req.user.organizationId
    );
    const hasPermission = effectivePermissions.some(p => p.name === permission);

    console.log(`🔐 [PERMISSION] User ${req.user.email} (role: ${req.user.roleId}) checking for "${permission}"`);
    console.log(`   Effective permissions (subscription-filtered): ${effectivePermissions.map(p => p.name).join(', ')}`);
    console.log(`   Has permission: ${hasPermission}`);

    if (!hasPermission) {
      console.log(`❌ [PERMISSION] DENIED: User ${req.user.email} lacks "${permission}" (filtered by subscription)`);
      return res.status(403).json({ 
        error: "Insufficient permissions", 
        required: permission,
        note: "This permission may require a subscription upgrade"
      });
    }

    console.log(`✅ [PERMISSION] GRANTED: ${permission}`);
    next();
  };
}

// Platform-level access middleware (Super Admin only)
export async function requirePlatform(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const userRole = await storage.getRole(req.user.roleId);
  if (!userRole || userRole.scope !== "platform") {
    return res.status(403).json({ error: "Platform administrator access required" });
  }

  next();
}

// KYC completion middleware - require minimum profile completion
export function requireKyc(minCompletionPercentage: number = 80) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get full user profile to check KYC status
    const fullUser = await storage.getUser(req.userId!);
    if (!fullUser) {
      return res.status(401).json({ error: "User not found" });
    }

    const kycCheck = calculateKycCompletion(fullUser);

    // Only bypass percentage check if KYC is officially verified by admin
    if (fullUser.kycStatus === "verified") {
      return next();
    }

    // Check minimum completion percentage
    if (kycCheck.completionPercentage < minCompletionPercentage) {
      return res.status(403).json({
        error: "Profile verification required",
        kycRequired: true,
        completionPercentage: kycCheck.completionPercentage,
        missingFields: kycCheck.missingFields,
        message: `Please complete your profile (${kycCheck.completionPercentage}% complete). Required: ${minCompletionPercentage}% completion.`,
      });
    }

    next();
  };
}

// Admin access middleware (Organization Admin or Platform Admin)
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const userRole = await storage.getRole(req.user.roleId);
  if (!userRole) {
    return res.status(403).json({ error: "Administrator access required" });
  }

  // Platform-scoped admins (Super Admin)
  if (userRole.scope === "platform" && req.user.organizationId === null) {
    return next();
  }

  // Organization-scoped admins must match the user's organization
  if (userRole.name === "Admin" && userRole.scope !== "platform") {
    // Verify user is accessing their own organization's resources
    return next();
  }

  return res.status(403).json({ error: "Administrator access required" });
}

// Rate limiting helper (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = rateLimitMap.get(key);

    if (record && record.resetAt > now) {
      if (record.count >= maxRequests) {
        return res.status(429).json({ error: "Too many requests" });
      }
      record.count++;
    } else {
      rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    }

    next();
  };
}

// Log activity
export async function logActivity(
  userId: string | undefined,
  organizationId: string | undefined,
  action: string,
  resource: string,
  resourceId: string | undefined,
  metadata: any,
  req: Request
) {
  try {
    await storage.createActivityLog({
      userId,
      organizationId,
      action,
      resource,
      resourceId,
      metadata,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

// Generate secure 256-bit random token (32 bytes hex = 64 characters)
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Hash token with SHA-256 for deterministic lookup (tokens are already random and secure)
export function hashTokenSHA256(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Validate super admin key
export async function validateSuperAdminKey(key: string): Promise<{ valid: boolean; keyRecord?: any; error?: string }> {
  try {
    const keyHash = hashTokenSHA256(key);
    const keyRecord = await storage.getSuperAdminKeyByHash(keyHash);

    if (!keyRecord) {
      return { valid: false, error: "Invalid super admin key" };
    }

    if (keyRecord.revokedAt) {
      return { valid: false, error: "Super admin key has been revoked" };
    }

    if (keyRecord.usedAt) {
      return { valid: false, error: "Super admin key has already been used" };
    }

    if (keyRecord.expiresAt < new Date()) {
      return { valid: false, error: "Super admin key has expired" };
    }

    return { valid: true, keyRecord };
  } catch (error) {
    return { valid: false, error: "Invalid super admin key format" };
  }
}

// Validate invitation token
export async function validateInvitationToken(token: string): Promise<{ valid: boolean; invitation?: any; error?: string }> {
  try {
    const tokenHash = hashTokenSHA256(token);
    const invitation = await storage.getInvitationByToken(tokenHash);

    if (!invitation) {
      return { valid: false, error: "Invalid invitation token" };
    }

    if (invitation.status !== 'pending') {
      return { valid: false, error: `Invitation has been ${invitation.status}` };
    }

    if (invitation.expiresAt < new Date()) {
      await storage.updateInvitationStatus(invitation.id, 'expired');
      return { valid: false, error: "Invitation has expired" };
    }

    return { valid: true, invitation };
  } catch (error) {
    return { valid: false, error: "Invalid invitation token format" };
  }
}
