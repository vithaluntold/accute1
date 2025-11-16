/**
 * Rate Limiting Configuration
 * 
 * P0 Security Control: Brute Force Protection
 * Implements express-rate-limit for authentication endpoints
 */

import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

// ==================== CONFIGURATION ====================

/**
 * Login endpoint rate limiting
 * - 5 attempts per 15 minutes per IP
 * - Prevents brute force password attacks
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts. Please try again in 15 minutes.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests
  skipFailedRequests: false, // Count failed requests
  keyGenerator: (req: Request) => {
    // Use IP address as key
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    console.log(`❌ [RATE LIMIT] Login attempt blocked for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many login attempts. Please try again in 15 minutes.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() - Date.now()) / 1000),
    });
  },
});

/**
 * Organization creation rate limiting
 * - 3 attempts per hour per IP
 * - Prevents spam account creation
 */
export const organizationCreationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per window
  message: 'Too many organization creation attempts. Please try again in 1 hour.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip || 'unknown',
  handler: (req: Request, res: Response) => {
    console.log(`❌ [RATE LIMIT] Organization creation blocked for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many organization creation attempts. Please try again in 1 hour.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() - Date.now()) / 1000),
    });
  },
});

/**
 * User creation rate limiting
 * - 10 attempts per hour per authenticated user
 * - Prevents spam user creation
 */
export const userCreationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per window
  message: 'Too many user creation attempts. Please try again in 1 hour.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    // Use user ID if authenticated, otherwise IP
    return req.userId || req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    console.log(`❌ [RATE LIMIT] User creation blocked for user/IP: ${(req as any).userId || req.ip}`);
    res.status(429).json({
      error: 'Too many user creation attempts. Please try again in 1 hour.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() - Date.now()) / 1000),
    });
  },
});

/**
 * Password reset rate limiting (future implementation)
 * - 3 attempts per hour per IP
 * - Prevents password reset spam
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per window
  message: 'Too many password reset attempts. Please try again in 1 hour.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip || 'unknown',
  handler: (req: Request, res: Response) => {
    console.log(`❌ [RATE LIMIT] Password reset blocked for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many password reset attempts. Please try again in 1 hour.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() - Date.now()) / 1000),
    });
  },
});

/**
 * General API rate limiting (applied to all routes)
 * - 100 requests per 15 minutes per IP
 * - Prevents API abuse
 */
export const generalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip || 'unknown',
  skip: (req: Request) => {
    // Skip rate limiting for health checks and static assets
    return req.path === '/health' || req.path.startsWith('/assets/');
  },
  handler: (req: Request, res: Response) => {
    console.log(`❌ [RATE LIMIT] General API limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
    res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() - Date.now()) / 1000),
    });
  },
});

// ==================== FAILED LOGIN TRACKING ====================

// In-memory failed login tracking (in production, use Redis)
const failedLoginAttempts = new Map<string, { count: number; firstAttempt: Date; lockUntil?: Date }>();

/**
 * Track failed login attempts
 * Returns true if account should be locked
 */
export function trackFailedLogin(identifier: string): { isLocked: boolean; attemptsRemaining: number; lockUntil?: Date } {
  const key = `failed_login:${identifier}`;
  const now = new Date();
  const maxAttempts = 10;
  const lockoutDuration = 30 * 60 * 1000; // 30 minutes
  const resetWindow = 15 * 60 * 1000; // 15 minutes
  
  let record = failedLoginAttempts.get(key);
  
  // Check if locked
  if (record?.lockUntil && record.lockUntil > now) {
    return {
      isLocked: true,
      attemptsRemaining: 0,
      lockUntil: record.lockUntil,
    };
  }
  
  // Reset if window expired
  if (record && (now.getTime() - record.firstAttempt.getTime()) > resetWindow) {
    record = undefined;
  }
  
  if (!record) {
    record = { count: 1, firstAttempt: now };
  } else {
    record.count++;
  }
  
  // Lock account if max attempts reached
  if (record.count >= maxAttempts) {
    record.lockUntil = new Date(now.getTime() + lockoutDuration);
    failedLoginAttempts.set(key, record);
    
    console.log(`🔒 [ACCOUNT LOCK] Account locked: ${identifier}, unlock at: ${record.lockUntil}`);
    
    return {
      isLocked: true,
      attemptsRemaining: 0,
      lockUntil: record.lockUntil,
    };
  }
  
  failedLoginAttempts.set(key, record);
  
  return {
    isLocked: false,
    attemptsRemaining: maxAttempts - record.count,
  };
}

/**
 * Clear failed login attempts on successful login
 */
export function clearFailedLogins(identifier: string): void {
  const key = `failed_login:${identifier}`;
  failedLoginAttempts.delete(key);
}

/**
 * Check if account is locked
 */
export function isAccountLocked(identifier: string): { isLocked: boolean; lockUntil?: Date } {
  const key = `failed_login:${identifier}`;
  const record = failedLoginAttempts.get(key);
  const now = new Date();
  
  if (record?.lockUntil && record.lockUntil > now) {
    return {
      isLocked: true,
      lockUntil: record.lockUntil,
    };
  }
  
  return { isLocked: false };
}
