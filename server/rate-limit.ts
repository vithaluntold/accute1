/**
 * Rate Limiting Configuration
 * 
 * P0 Security Control: Brute Force Protection
 * Implements express-rate-limit for authentication endpoints
 * 
 * TEST MODE: Uses custom resettable in-memory store to ensure
 * each test has isolated rate limiting state without interference.
 */

import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { clearRateLimitMap } from './auth';

// ==================== CUSTOM STORE FOR TESTING ====================

/**
 * Simple in-memory store with reset capability for testing
 */
class ResettableMemoryStore {
  private hits: Map<string, number> = new Map();
  private resetTime: Map<string, Date> = new Map();

  increment(key: string): { totalHits: number; resetTime: Date | undefined } {
    const current = this.hits.get(key) || 0;
    const newCount = current + 1;
    this.hits.set(key, newCount);
    
    if (!this.resetTime.has(key)) {
      const reset = new Date();
      reset.setTime(reset.getTime() + 15 * 60 * 1000); // 15 minutes
      this.resetTime.set(key, reset);
    }
    
    return {
      totalHits: newCount,
      resetTime: this.resetTime.get(key),
    };
  }

  decrement(key: string): void {
    const current = this.hits.get(key) || 0;
    if (current > 0) {
      this.hits.set(key, current - 1);
    }
  }

  resetKey(key: string): void {
    this.hits.delete(key);
    this.resetTime.delete(key);
  }

  resetAll(): void {
    this.hits.clear();
    this.resetTime.clear();
  }
}

// Create store instance for test mode
let testStore: ResettableMemoryStore | undefined;
if (process.env.NODE_ENV === 'test') {
  testStore = new ResettableMemoryStore();
}

/**
 * Reset rate limiter store (for testing)
 * This ensures each test has fresh rate limiting state
 * 
 * Resets:
 * - loginRateLimiter (express-rate-limit with ResettableMemoryStore)
 * - organizationCreationRateLimiter (express-rate-limit with ResettableMemoryStore)
 * - userCreationRateLimiter (express-rate-limit with ResettableMemoryStore)
 * - Generic rateLimit() map (from auth.ts - used by password reset, etc.)
 */
export function resetRateLimiters() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetRateLimiters can only be called in test mode');
  }
  
  // Reset express-rate-limit stores
  if (testStore) {
    testStore.resetAll();
  }
  
  // Reset generic rateLimit() map from auth.ts
  clearRateLimitMap();
}

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
  // Use custom resettable store in test mode
  store: testStore as any,
  // Default keyGenerator handles IPv6 properly
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
  // Default keyGenerator handles IPv6 properly
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
  // Default keyGenerator handles IPv6 properly (uses IP address)
  handler: (req: Request, res: Response) => {
    console.log(`❌ [RATE LIMIT] User creation blocked for IP: ${req.ip}`);
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
  // Default keyGenerator handles IPv6 properly
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
  // Default keyGenerator handles IPv6 properly
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

/**
 * Billing/Pricing endpoint rate limiting
 * - 20 requests per 15 minutes per IP
 * - Prevents price enumeration, coupon abuse, and billing system abuse
 * 
 * PRODUCTION NOTE: Uses default MemoryStore which works for single-instance deployments.
 * For horizontal scaling (multiple instances), implement Redis-backed store:
 * - Install: npm install rate-limit-redis redis
 * - Configure: store: new RedisStore({ client: redisClient })
 * 
 * KNOWN LIMITATIONS:
 * - Limits reset on process restart (acceptable for Replit single-instance)
 * - No cross-instance state sharing (implement Redis for production scale-out)
 */
export const billingRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  message: 'Too many pricing requests. Please try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  // NOTE: Uses default MemoryStore (works for single instance, use Redis for multi-instance)
  handler: (req: Request, res: Response) => {
    console.log(`❌ [RATE LIMIT] Billing API limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
    res.status(429).json({
      error: 'Too many pricing requests. Please try again in 15 minutes.',
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

// Aliases for better semantics in route handlers
export const checkAccountLockout = (identifier: string) => {
  const status = isAccountLocked(identifier);
  if (status.isLocked && status.lockUntil) {
    const minutesRemaining = Math.ceil((status.lockUntil.getTime() - Date.now()) / (60 * 1000));
    return { isLocked: true, minutesRemaining };
  }
  return { isLocked: false, minutesRemaining: 0 };
};

export const recordFailedLogin = trackFailedLogin;
