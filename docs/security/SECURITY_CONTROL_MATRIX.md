# Security Control Matrix (Layer 4)
## Authentication & Authorization - Six Sigma Testing
**Last Updated:** November 16, 2025

## Overview
This document maps AUTH_TESTING_PLAN.md Layer 4 security requirements to implemented vs. missing controls in the Accute platform.

---

## Control Matrix

### ✅ IMPLEMENTED CONTROLS

#### 1. SQL Injection Protection
**Status:** ✅ Implemented via Drizzle ORM  
**Mechanism:** Parameterized queries, type-safe SQL generation  
**Testing Approach:**
- Verify malicious SQL strings are stored literally (not executed)
- Confirm parameterized queries prevent injection
- Assert database tables/data unchanged after injection attempts

**Test Coverage:** 10 tests (TC-SEC-001 to TC-SEC-010)

---

#### 2. Authentication & Session Management
**Status:** ✅ Implemented  
**Mechanism:**
- JWT tokens with HS256 signing
- Session storage in database
- Bcrypt password hashing (12 rounds)
- Token validation on protected routes

**Testing Approach:**
- Verify invalid tokens rejected (401)
- Confirm tokens invalidated after logout
- Test session isolation between users
- Validate token signature verification

**Test Coverage:** 10 tests (TC-SEC-031 to TC-SEC-040)

---

#### 3. RBAC Permission Enforcement
**Status:** ✅ Implemented (tested in Layer 3)  
**Mechanism:**
- Role-based permissions (owner, admin, manager, staff)
- Permission checks on all protected endpoints
- Subscription-aware effective permissions
- Cross-organization isolation

**Testing Approach:**
- Already tested comprehensively in Layer 3 (50/50 tests passing)
- Privilege escalation prevention (TC-SEC-051, TC-SEC-052)

**Test Coverage:** 2 additional tests in Layer 4 (privilege escalation)

---

#### 4. Input Validation
**Status:** ⚠️ Partially Implemented  
**Mechanism:**
- Zod schema validation for API payloads
- Email format validation
- Basic type checking

**Testing Approach:**
- Verify invalid email formats rejected
- Test empty/missing credentials rejected
- Confirm malformed requests return 400

**Test Coverage:** Included in CSRF and Brute Force tests

---

###❌ MISSING/UNIMPLEMENTED CONTROLS

#### 1. XSS Output Sanitization
**Status:** ❌ NOT Implemented  
**Gap:** No server-side output encoding or sanitization  
**Risk:** High - Stored XSS vulnerability  
**Recommended Solution:**
- Install `sanitize-html` or `DOMPurify` (server-side)
- Sanitize user input on write
- Encode output on read for HTML contexts
- Implement Content Security Policy (CSP) headers

**Testing Approach:**
- Tests marked as TODO.skip until implemented
- Should verify script tags are escaped/stripped on retrieval
- Should confirm CSP headers prevent inline script execution

**Test Coverage:** 10 tests marked as TODO (TC-SEC-011 to TC-SEC-020)

---

#### 2. CSRF Protection
**Status:** ❌ NOT Implemented  
**Gap:** No CSRF tokens, relying only on JWT auth  
**Risk:** Medium - CSRF attacks possible if JWT stored in localStorage  
**Recommended Solution:**
- Implement SameSite=Strict cookies for session tokens
- Add CSRF tokens for state-changing operations
- Enforce Origin/Referer header validation

**Testing Approach:**
- Tests currently only validate 401 on missing auth (already covered)
- Should add CSRF token validation tests after implementation

**Test Coverage:** 10 tests need redesign after CSRF implementation

---

#### 3. Rate Limiting / Brute Force Protection
**Status:** ❌ NOT Implemented  
**Gap:** No rate limiting on authentication endpoints  
**Risk:** High - Account enumeration, brute force attacks possible  
**Recommended Solution:**
- Install `express-rate-limit`
- Configure limits:
  - Login: 5 attempts per 15 minutes per IP
  - Password reset: 3 attempts per hour per IP
  - User creation: 10 per hour per authenticated user
- Implement account lockout after 10 failed login attempts

**Testing Approach:**
- Tests marked as TODO until implemented
- Should verify rate limit headers returned
- Should confirm 429 status after threshold
- Should test account lockout mechanics

**Test Coverage:** 10 tests marked as TODO (TC-SEC-041 to TC-SEC-050)

---

#### 4. Session Replay Detection
**Status:** ❌ NOT Implemented  
**Gap:** Tokens can be replayed until expiry  
**Risk:** Medium - Session hijacking via token theft  
**Recommended Solution:**
- Implement nonce/jti in JWT payloads
- Track used tokens in Redis/cache
- Add short token expiry (15 minutes) with refresh tokens

**Testing Approach:**
- Add test for token replay detection after implementation

**Test Coverage:** 1 additional test needed

---

#### 5. Password Complexity Enforcement
**Status:** ❌ NOT Implemented  
**Gap:** No password strength validation  
**Risk:** Medium - Weak passwords allowed  
**Recommended Solution:**
- Implement password strength validation
  - Minimum 8 characters
  - At least one uppercase, lowercase, number, special char
  - Check against common password lists

**Testing Approach:**
- Test weak password rejection (currently accepts any password)

**Test Coverage:** 1 test currently permissive (TC-SEC-048)

---

#### 6. Account Enumeration Prevention
**Status:** ⚠️ Partially Implemented  
**Current:** Generic error messages for login failures  
**Gap:** Timing attacks may still reveal user existence  
**Risk:** Low - Requires sophisticated timing analysis  
**Recommended Solution:**
- Add artificial delay to failed logins
- Ensure consistent response times (±50ms)

**Testing Approach:**
- Test timing consistency (TC-SEC-043, TC-SEC-049)

**Test Coverage:** 2 tests validate timing attacks

---

## Test Execution Summary

| Security Control | Status | Test Count | Passing | Blocked | TODO |
|-----------------|--------|-----------|---------|---------|------|
| SQL Injection | ✅ Implemented | 10 | TBD | 0 | 0 |
| XSS Prevention | ❌ Missing | 10 | 0 | 10 | 10 |
| CSRF Protection | ❌ Missing | 10 | TBD | 0 | 10 |
| Session Security | ✅ Implemented | 10 | TBD | 0 | 0 |
| Brute Force | ❌ Missing | 10 | 0 | 10 | 10 |
| Privilege Escalation | ✅ Implemented | 2 | TBD | 0 | 0 |
| **TOTAL** | - | **52** | **TBD** | **20** | **30** |

---

## Implementation Priority

### P0 (Critical - Implement ASAP)
1. ❌ XSS Output Sanitization (High risk, user data)
2. ❌ Rate Limiting on Auth Endpoints (High risk, brute force)
3. ❌ Password Complexity Enforcement (Medium risk, weak passwords)

### P1 (High Priority)
4. ❌ CSRF Token Protection (Medium risk, state changes)
5. ❌ Session Replay Detection (Medium risk, token theft)

### P2 (Medium Priority)
6. ⚠️ Account Enumeration Prevention (Low risk, timing attacks)

---

## Next Steps

1. **✅ Implement missing critical controls (P0)**
   - Add sanitize-html for XSS prevention
   - Add express-rate-limit for brute force protection
   - Add password complexity validation

2. **Write tests for implemented controls**
   - SQL Injection: 10 tests
   - Session Security: 10 tests
   - Privilege Escalation: 2 tests
   - Total: 22 tests (can be executed now)

3. **Mark unimplemented control tests as TODO**
   - XSS: 10 tests (TODO until sanitization added)
   - CSRF: 10 tests (TODO until CSRF tokens added)
   - Brute Force: 10 tests (TODO until rate limiting added)
   - Total: 30 tests (pending implementation)

4. **Update replit.md with security gap analysis**

---

## References
- AUTH_TESTING_PLAN.md (Layer 4: Security & Edge Cases)
- SIX_SIGMA_TESTING_STRATEGY.md
- RBAC tests: server/__tests__/rbac/ (50/50 passing)
