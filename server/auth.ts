import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
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
const ENCRYPTION_KEY = process.env.SESSION_SECRET 
  ? crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest()
  : crypto.randomBytes(32);
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
    if (!session || session.expiresAt < new Date()) {
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

// Permission check middleware
export function requirePermission(permission: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userPermissions = await storage.getPermissionsByRole(req.user.roleId);
    const hasPermission = userPermissions.some(p => p.name === permission);

    if (!hasPermission) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
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
