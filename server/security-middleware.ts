/**
 * Security Middleware - Global Security Controls
 * 
 * Applied to all routes to enforce:
 * - Security headers (CSP, X-Frame-Options, etc.)
 * - CSRF protection via Origin validation
 * - XSS sanitization for request/response data
 * - Request validation
 */

import type { Request, Response, NextFunction } from 'express';
import { SECURITY_HEADERS, sanitizeTextInput, sanitizeUser, sanitizeOrganization } from './security';

// ==================== SECURITY HEADERS MIDDLEWARE ====================

/**
 * Add security headers to all responses
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Add all security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  next();
}

// ==================== CSRF PROTECTION MIDDLEWARE ====================

/**
 * CSRF Protection via Origin/Referer validation
 * Validates that state-changing requests come from trusted origins
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Get allowed origins from environment
  const allowedOrigins = [
    process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost',
    'localhost',
    '127.0.0.1',
  ].filter(Boolean);
  
  // Check Origin header
  const origin = req.headers.origin || req.headers.referer;
  
  if (!origin) {
    // For API requests from server-side (no Origin header), check authentication
    // If authenticated via JWT, allow the request
    if (req.headers.authorization?.startsWith('Bearer ')) {
      return next();
    }
    
    console.log(`❌ [CSRF] Blocked request with no Origin: ${req.method} ${req.path}, IP: ${req.ip}`);
    return res.status(403).json({ 
      error: 'CSRF protection: Origin header required for state-changing requests' 
    });
  }
  
  // Parse origin
  let originHost: string;
  try {
    originHost = new URL(origin).hostname;
  } catch {
    console.log(`❌ [CSRF] Invalid origin: ${origin}`);
    return res.status(403).json({ error: 'CSRF protection: Invalid origin' });
  }
  
  // Check if origin is allowed
  const isAllowed = allowedOrigins.some(allowed => 
    originHost === allowed || 
    originHost.endsWith(`.${allowed}`) ||
    originHost.includes('replit.dev') ||
    originHost.includes('replit.app')
  );
  
  if (!isAllowed) {
    console.log(`❌ [CSRF] Blocked request from unauthorized origin: ${originHost}, Path: ${req.method} ${req.path}`);
    return res.status(403).json({ 
      error: 'CSRF protection: Unauthorized origin' 
    });
  }
  
  next();
}

// ==================== XSS SANITIZATION MIDDLEWARE ====================

/**
 * Sanitize request body to prevent XSS
 * Applied to POST/PATCH/PUT requests
 */
export function xssSanitizationMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.body || typeof req.body !== 'object') {
    return next();
  }
  
  // Recursively sanitize all string fields in request body
  req.body = sanitizeObject(req.body);
  
  next();
}

/**
 * Recursively sanitize all strings in an object
 */
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeTextInput(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Don't sanitize password fields
      if (key === 'password' || key === 'token' || key === 'secret') {
        sanitized[key] = value;
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Sanitize response data before sending to client
 * Ensures output encoding for user-generated content
 */
export function sanitizeResponse(data: any): any {
  if (!data) return data;
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeResponse(item));
  }
  
  // Handle objects
  if (typeof data === 'object') {
    // User object
    if (data.email && data.firstName !== undefined) {
      return sanitizeUser(data);
    }
    
    // Organization object
    if (data.name && data.subscription !== undefined) {
      return sanitizeOrganization(data);
    }
    
    // Generic object - recursively sanitize
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeResponse(value);
    }
    return sanitized;
  }
  
  return data;
}

// ==================== REQUEST VALIDATION MIDDLEWARE ====================

/**
 * Validate request content type
 * Only accept JSON for API endpoints
 */
export function validateContentType(req: Request, res: Response, next: NextFunction) {
  // Skip for GET requests and multipart uploads
  if (req.method === 'GET' || req.path.includes('/upload')) {
    return next();
  }
  
  const contentType = req.headers['content-type'];
  
  // Allow no content-type for DELETE requests
  if (req.method === 'DELETE') {
    return next();
  }
  
  // Require JSON content-type for POST/PATCH/PUT
  if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({ 
        error: 'Invalid Content-Type. Expected application/json' 
      });
    }
  }
  
  next();
}

/**
 * Validate UUID format in path parameters
 */
export function validateUuidParams(paramNames: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    for (const paramName of paramNames) {
      const value = req.params[paramName];
      if (value && !uuidRegex.test(value)) {
        return res.status(400).json({ 
          error: `Invalid ${paramName}: must be a valid UUID` 
        });
      }
    }
    
    next();
  };
}

// ==================== LOGGING MIDDLEWARE ====================

/**
 * Log security-relevant requests
 */
export function securityAuditLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // Log after response is sent
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const authHeader = req.headers.authorization;
    const hasAuth = !!authHeader;
    
    // Log security-sensitive operations
    const isSensitive = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/organizations',
      '/api/users',
      '/api/permissions',
      '/api/roles',
    ].some(path => req.path.startsWith(path));
    
    if (isSensitive || res.statusCode >= 400) {
      console.log(
        `[SECURITY AUDIT] ${req.method} ${req.path} - ` +
        `Status: ${res.statusCode}, ` +
        `Auth: ${hasAuth ? 'Yes' : 'No'}, ` +
        `IP: ${req.ip}, ` +
        `Duration: ${duration}ms, ` +
        `UA: ${req.headers['user-agent']?.substring(0, 50) || 'unknown'}`
      );
    }
  });
  
  next();
}

// ==================== IP FILTERING (OPTIONAL) ====================

/**
 * Block requests from known malicious IPs
 * In production, this would integrate with threat intelligence services
 */
const blockedIPs = new Set<string>();

export function blockMaliciousIPs(req: Request, res: Response, next: NextFunction) {
  const clientIP = req.ip || '';
  
  if (blockedIPs.has(clientIP)) {
    console.log(`🚫 [IP BLOCK] Blocked request from: ${clientIP}`);
    return res.status(403).json({ error: 'Access denied' });
  }
  
  next();
}

/**
 * Add IP to blocklist (called after detecting malicious behavior)
 */
export function blockIP(ip: string): void {
  blockedIPs.add(ip);
  console.log(`🚫 [IP BLOCK] Added to blocklist: ${ip}`);
}
