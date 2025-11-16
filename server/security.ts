/**
 * Security Utilities - XSS Prevention, Input Sanitization, Password Validation
 * 
 * P0 Security Controls Implementation:
 * - XSS output sanitization using sanitize-html
 * - Password complexity enforcement
 * - Input validation and normalization
 */

import sanitizeHtml from 'sanitize-html';

// ==================== XSS PREVENTION ====================

/**
 * Strict sanitization for user text input (names, descriptions, etc.)
 * Removes ALL HTML tags and dangerous characters
 */
export function sanitizeTextInput(input: string): string {
  if (!input) return input;
  
  return sanitizeHtml(input, {
    allowedTags: [], // No HTML tags allowed
    allowedAttributes: {}, // No attributes allowed
    disallowedTagsMode: 'recursiveEscape', // Escape instead of strip
  });
}

/**
 * Sanitize rich text content (if needed for future features)
 * Allows safe HTML tags only (p, br, b, i, u, a, ul, ol, li)
 */
export function sanitizeRichText(input: string): string {
  if (!input) return input;
  
  return sanitizeHtml(input, {
    allowedTags: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'ul', 'ol', 'li'],
    allowedAttributes: {
      'a': ['href', 'title', 'target'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      'a': (tagName, attribs) => {
        return {
          tagName: 'a',
          attribs: {
            ...attribs,
            rel: 'noopener noreferrer', // Security: prevent window.opener access
            target: attribs.target || '_blank',
          },
        };
      },
    },
  });
}

/**
 * Sanitize user object - applies sanitization to all user text fields
 */
export function sanitizeUser(user: any): any {
  if (!user) return user;
  
  return {
    ...user,
    email: user.email, // Email already validated by Zod
    firstName: user.firstName ? sanitizeTextInput(user.firstName) : user.firstName,
    lastName: user.lastName ? sanitizeTextInput(user.lastName) : user.lastName,
    phone: user.phone ? sanitizeTextInput(user.phone) : user.phone,
  };
}

/**
 * Sanitize organization object
 */
export function sanitizeOrganization(org: any): any {
  if (!org) return org;
  
  return {
    ...org,
    name: org.name ? sanitizeTextInput(org.name) : org.name,
  };
}

// ==================== PASSWORD VALIDATION ====================

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate password complexity
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
 */
export function validatePasswordComplexity(password: string): PasswordValidationResult {
  const errors: string[] = [];
  
  if (!password) {
    return { isValid: false, errors: ['Password is required'] };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if password is in common password list (basic implementation)
 * In production, this should check against a comprehensive database
 */
export function isCommonPassword(password: string): boolean {
  const commonPasswords = [
    'password', 'password123', '123456', '123456789', 'qwerty',
    'abc123', 'monkey', '1234567', 'letmein', 'trustno1',
    'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
    'ashley', 'bailey', 'passw0rd', 'shadow', '123123',
    '654321', 'superman', 'qazwsx', 'michael', 'football',
  ];
  
  return commonPasswords.includes(password.toLowerCase());
}

// ==================== INPUT VALIDATION ====================

/**
 * Validate and sanitize email
 * Additional layer on top of Zod validation
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

/**
 * Validate UUID format
 */
export function validateUuid(uuid: string): boolean {
  if (!uuid) return false;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Sanitize search query parameter
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query) return '';
  
  // Remove SQL wildcards and dangerous characters
  return sanitizeTextInput(query)
    .replace(/[%_]/g, '') // Remove SQL LIKE wildcards
    .trim()
    .substring(0, 100); // Limit length
}

// ==================== TIMING ATTACK PREVENTION ====================

/**
 * Constant-time string comparison
 * Prevents timing attacks for password/token comparison
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Add artificial delay to prevent timing attacks
 * Use for failed login attempts
 */
export async function preventTimingAttack(minDelayMs: number = 100, maxDelayMs: number = 300): Promise<void> {
  const delay = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
  await new Promise(resolve => setTimeout(resolve, delay));
}

// ==================== RATE LIMITING HELPERS ====================

/**
 * Generate rate limit key for IP + endpoint
 */
export function getRateLimitKey(ip: string, endpoint: string): string {
  return `ratelimit:${endpoint}:${ip}`;
}

/**
 * Generate rate limit key for user ID + endpoint
 */
export function getUserRateLimitKey(userId: string, endpoint: string): string {
  return `ratelimit:${endpoint}:user:${userId}`;
}

// ==================== SECURITY HEADERS ====================

/**
 * Content Security Policy configuration
 */
export const CSP_HEADER = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Needed for React
    "style-src 'self' 'unsafe-inline'", // Needed for styled components
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
};

/**
 * Security headers to add to all responses
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  ...CSP_HEADER,
};
