/**
 * Security Integration - Patches routes with P0 security controls
 * 
 * This module integrates:
 * - Rate limiting on authentication endpoints
 * - Password complexity validation
 * - XSS sanitization
 * - CSRF protection
 * - Account lockout after failed attempts
 */

import type { Express } from 'express';
import { validatePasswordComplexity, isCommonPassword, preventTimingAttack } from './security';
import { 
  loginRateLimiter,
  organizationCreationRateLimiter,
  userCreationRateLimiter,
  trackFailedLogin,
  clearFailedLogins,
  isAccountLocked,
} from './rate-limit';
import {
  csrfProtection,
  xssSanitizationMiddleware,
  securityHeadersMiddleware,
  validateContentType,
  securityAuditLogger,
  blockMaliciousIPs,
} from './security-middleware';

/**
 * Apply global security middleware to all routes
 */
export function applyGlobalSecurityMiddleware(app: Express) {
  // Apply to all routes
  app.use(blockMaliciousIPs);
  app.use(securityAuditLogger);
  app.use(validateContentType);
  app.use(xssSanitizationMiddleware);
  
  // Apply to /api routes only (avoid interfering with Vite dev server)
  app.use('/api', securityHeadersMiddleware);
  app.use('/api', csrfProtection);
  
  console.log('✅ [SECURITY] Global security middleware applied');
}

/**
 * Apply rate limiting to authentication endpoints
 */
export function applyAuthRateLimiting(app: Express) {
  app.use('/api/auth/login', loginRateLimiter);
  app.use('/api/organizations', organizationCreationRateLimiter);
  app.use('/api/organizations/:id/users', userCreationRateLimiter);
  
  console.log('✅ [SECURITY] Authentication rate limiting applied');
}

// Export security functions for use in route handlers
export {
  validatePasswordComplexity,
  isCommonPassword,
  preventTimingAttack,
  trackFailedLogin,
  clearFailedLogins,
  isAccountLocked,
};
