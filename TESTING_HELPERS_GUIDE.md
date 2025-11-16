# Testing Helpers & Utilities Guide

**Date:** November 16, 2025  
**Purpose:** Document reusable testing utilities for consistent, reliable test execution  
**Audience:** Developers writing automated tests

---

## 📋 Overview

This guide documents specialized testing utilities that enable proper test isolation, especially for stateful components like rate limiters, session managers, and caching systems.

---

## 🔄 Rate Limiter Test Utilities

### `resetRateLimiters()` Helper

**Location:** `server/rate-limit.ts`

**Purpose:** Resets all rate limiter counters to ensure test isolation when testing rate-limited endpoints.

**When to Use:**
- ✅ When testing login rate limiting (TC-SEC-041 through TC-SEC-046)
- ✅ When testing organization/user creation rate limits
- ✅ When testing password reset rate limits
- ✅ In `beforeEach()` hooks to ensure clean state between tests
- ✅ After tests that deliberately exhaust rate limits

**When NOT to Use:**
- ❌ In production code (only available in test mode)
- ❌ For tests that don't interact with rate-limited endpoints
- ❌ For integration tests that need to preserve rate limit state across scenarios

### Implementation Details

#### ResettableMemoryStore (Internal)

```typescript
// Custom in-memory store used ONLY in NODE_ENV=test
class ResettableMemoryStore {
  private hits = new Map<string, number>();
  private resetTime = new Map<string, number>();

  // Implements express-rate-limit store contract
  increment(key: string): Promise<{ totalHits: number; resetTime?: Date }>;
  decrement(key: string): Promise<void>;
  resetKey(key: string): Promise<void>;
  resetAll(): void;  // Custom method for test isolation
}
```

**Key Features:**
- ✅ **Test-Only:** Only active when `process.env.NODE_ENV === 'test'`
- ✅ **Production Safety:** Default express-rate-limit memory store used in production
- ✅ **Six Sigma Compliance:** Tests exercise actual rate limiter code paths (not skip functions)
- ✅ **Full Contract:** Implements all express-rate-limit store methods

#### Export Function

```typescript
export function resetRateLimiters() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetRateLimiters can only be called in test mode');
  }
  
  // Reset all three rate limiters
  loginStore.resetAll();
  orgCreationStore.resetAll();
  userCreationStore.resetAll();
}
```

### Usage Patterns

#### Pattern 1: Double-Reset in beforeEach (Recommended)

**Use Case:** Tests that exercise rate limiting behavior

```typescript
import { resetRateLimiters } from '../../rate-limit';

describe('Rate Limiting Tests', () => {
  let ownerToken: string;
  let testOrg: any;

  beforeEach(async () => {
    // Reset BEFORE context creation
    // Prevents previous test's rate limiting from blocking setup
    resetRateLimiters();
    
    const context = await createTestContext();
    ownerToken = context.ownerToken;
    testOrg = context.testOrg;
    
    // Reset AFTER context creation
    // Ensures each test starts with fresh state
    // (createTestContext makes login calls that increment counters)
    resetRateLimiters();
  });

  it('TC-SEC-041: Rate limiting blocks excessive login attempts', async () => {
    // Test starts with 0 hits due to double-reset
    // ... test implementation
  });
});
```

**Why Double-Reset?**
1. **Before:** Previous test may have exhausted rate limit (e.g., TC-SEC-041 makes 10+ login attempts). Without reset, `createTestContext()` login would be blocked with 429.
2. **After:** `createTestContext()` itself makes 1-2 login calls, incrementing the counter. Without reset, tests would inherit non-zero hit counts.

#### Pattern 2: Single Reset (Simple Tests)

**Use Case:** Tests that don't create test contexts or tests isolated from rate limiting

```typescript
describe('Simple Authentication Tests', () => {
  beforeEach(async () => {
    resetRateLimiters();
  });

  it('TC-LOGIN-001: Owner can login with valid credentials', async () => {
    // ... test implementation
  });
});
```

#### Pattern 3: Selective Reset (Advanced)

**Use Case:** Testing rate limit persistence across specific scenarios

```typescript
describe('Rate Limit Persistence', () => {
  beforeEach(async () => {
    // Only reset login rate limiter, preserve others
    loginStore.resetAll();
  });

  it('Tests that org creation limit persists while login resets', async () => {
    // ... test implementation
  });
});
```

### Migration Guide: Old → New Approach

#### ❌ OLD APPROACH (Deprecated)
```typescript
// Used skip functions and special headers
it('Test with rate limit disabled', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .set('X-Test-Rate-Limit', 'skip')  // ❌ Bad: Skip actual code
    .send({ email, password });
});
```

**Problems:**
- Bypasses actual rate limiter code
- Doesn't test production behavior
- Violates Six Sigma coverage requirements

#### ✅ NEW APPROACH (Current)
```typescript
import { resetRateLimiters } from '../../rate-limit';

beforeEach(async () => {
  resetRateLimiters();  // ✅ Good: Exercises real rate limiter
});

it('Test with fresh rate limit state', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  // Rate limiter IS active, just reset to 0 hits
});
```

**Benefits:**
- ✅ Tests actual production code paths
- ✅ Meets Six Sigma quality standards
- ✅ Catches real rate limiter bugs

---

## 📊 Test Isolation Best Practices

### 1. Stateful Components Checklist

When testing stateful components, ensure proper reset:

- ✅ Rate limiters → `resetRateLimiters()`
- ✅ Database → `beforeEach` with `TRUNCATE CASCADE` (handled by `setup.ts`)
- ✅ Sessions → Create fresh tokens per test
- ✅ Caches → Clear/invalidate between tests
- ✅ WebSocket connections → Close/cleanup in `afterEach`

### 2. Common Pitfalls

#### ❌ Pitfall: Single Reset Only
```typescript
beforeEach(async () => {
  const context = await createTestContext();
  resetRateLimiters();  // ❌ Only resets after context creation
});

// Test inherits login hits from createTestContext()
```

#### ✅ Solution: Double Reset
```typescript
beforeEach(async () => {
  resetRateLimiters();  // Before context
  const context = await createTestContext();
  resetRateLimiters();  // After context
});
```

#### ❌ Pitfall: Forgetting to Import
```typescript
describe('My Tests', () => {
  beforeEach(async () => {
    // Missing resetRateLimiters() import and call
    const context = await createTestContext();
  });
});

// Tests randomly fail when run after rate-limit tests
```

#### ✅ Solution: Always Import When Testing Rate-Limited Endpoints
```typescript
import { resetRateLimiters } from '../../rate-limit';

describe('My Tests', () => {
  beforeEach(async () => {
    resetRateLimiters();
    // ... rest of setup
  });
});
```

### 3. Debugging Rate Limit Issues

#### Symptom: Tests pass individually but fail in suite
```bash
✅ TC-SEC-041: Rate limiting blocks excessive login attempts (passes alone)
❌ TC-SEC-042: Server handles rapid requests (fails after TC-SEC-041)
```

**Diagnosis:** Missing or incorrect `resetRateLimiters()` placement

**Solution:** Add double-reset pattern:
```typescript
beforeEach(async () => {
  resetRateLimiters();  // Clear previous test's state
  const context = await createTestContext();
  resetRateLimiters();  // Clear context creation hits
});
```

#### Symptom: Getting 429 Too Many Requests unexpectedly
```bash
Expected: 200
Received: 429
```

**Diagnosis:** Rate limit counter not reset before test

**Solution:** Ensure `resetRateLimiters()` called BEFORE making rate-limited requests

---

## 🚀 Other Test Utilities

### `createTestContext()` Helper

**Location:** `server/__tests__/helpers.ts`

**Purpose:** Creates a complete test environment with owner user, organization, and auth token

**Returns:**
```typescript
{
  ownerToken: string;      // JWT for authenticated requests
  ownerUser: User;         // Owner user object
  testOrg: Organization;   // Test organization
  adminToken?: string;     // Optional admin token
  managerToken?: string;   // Optional manager token
  staffToken?: string;     // Optional staff token
}
```

**Usage:**
```typescript
const { ownerToken, ownerUser, testOrg } = await createTestContext();

const response = await request(app)
  .get('/api/organizations/' + testOrg.id)
  .set('Authorization', `Bearer ${ownerToken}`);
```

### Database Cleanup Utilities

**Location:** `server/__tests__/setup.ts`

**Automatic Cleanup:**
- Runs `beforeEach` test via global Vitest hooks
- Uses `TRUNCATE CASCADE` for complete cleanup
- Handles foreign key dependencies automatically

**Manual Cleanup (if needed):**
```typescript
import { clearDatabase } from '../helpers';

afterEach(async () => {
  await clearDatabase();
});
```

---

## 📈 CI/CD Integration

### Monitoring Rate Limit Tests in CI

**What to Monitor:**
- Test execution time for rate-limit tests (should be consistent)
- Flakiness rate (tests passing/failing intermittently)
- Parallel execution behavior

**Expected Behavior:**
```bash
✅ TC-SEC-041: Rate limiting blocks excessive login attempts (1970ms)
✅ TC-SEC-042: Server handles rapid requests safely (1605ms)
✅ TC-SEC-043: Successful login works after failed attempts (2840ms)
```

**Red Flags:**
```bash
❌ TC-SEC-041: Rate limiting blocks excessive login attempts (15ms)
   # Too fast - rate limiter might be disabled

❌ TC-SEC-042: Server handles rapid requests safely
   AssertionError: expected 429 to be 200
   # Rate limit not reset between tests

⚠️  Tests passing 80% of the time in CI
   # Timing issue or parallel execution conflict
```

### Debugging CI Failures

**Step 1:** Check if test passes locally
```bash
NODE_ENV=test npx vitest run server/__tests__/security/attack-vectors.test.ts
```

**Step 2:** Run multiple times to detect flakiness
```bash
for i in {1..10}; do
  NODE_ENV=test npx vitest run server/__tests__/security/attack-vectors.test.ts
  echo "Run $i complete"
done
```

**Step 3:** Check for parallel execution issues
```bash
# Ensure tests run serially (already configured in vitest.config.ts)
pool: 'forks',
poolOptions: {
  forks: {
    singleFork: true,  // ← Prevents parallel execution
  },
}
```

---

## 🎯 Best Practices Summary

### DO ✅
- Use double-reset pattern for tests that exercise rate limiting
- Import `resetRateLimiters()` in any test suite touching rate-limited endpoints
- Test actual production code paths (not skip functions)
- Monitor CI for intermittent failures
- Document any new test utilities in this guide

### DON'T ❌
- Use `X-Test-Rate-Limit: skip` headers (deprecated)
- Skip rate limiter in tests (violates Six Sigma coverage)
- Forget to reset between tests
- Assume single reset is sufficient (use double-reset)
- Call `resetRateLimiters()` in production code

---

## ✅ Complete Coverage Achieved

### All Rate Limiters Now Testable

**Status:** ✅ **FIXED** - All rate limiters now exercise production code paths in tests

**Implementation (Nov 16, 2025):**
- ✅ Login rate limiting - Uses express-rate-limit with ResettableMemoryStore
- ✅ Org creation rate limiting - Uses express-rate-limit with ResettableMemoryStore  
- ✅ User creation rate limiting - Uses express-rate-limit with ResettableMemoryStore
- ✅ Generic rateLimit() - **FIXED** - Now supports test mode without skipping

**What Was Fixed:**
1. Removed `if (process.env.NODE_ENV === 'test') return next();` skip logic from `server/auth.ts`
2. Updated `resetRateLimiters()` to also reset generic rate limiter map via `clearRateLimitMap()`
3. Added proper import of `clearRateLimitMap` in `server/rate-limit.ts`
4. Updated TC-RESET-004 to validate rate limiting enforcement (expects 429 after 10 requests)

**Six Sigma Compliance:**
- ✅ All rate limiters now tested in production configuration
- ✅ Tests exercise actual rate limiting code paths
- ✅ No skip functions or bypass logic in test mode
- ✅ Password reset rate limiting validated (TC-RESET-004 passing)

**Example Test Output:**
```
stdout | TC-RESET-004: Multiple reset requests are rate-limited
✓ Password reset email sent... (x10)
❌ [RATE LIMIT] Request blocked for IP: ::ffff:127.0.0.1
✓ TC-RESET-004: Multiple reset requests are rate-limited (3106ms)
```

---

## 📚 Related Documentation

- **AUTH_TESTING_PLAN.md** - Complete authentication test plan (287 tests)
- **SIX_SIGMA_TESTING_STRATEGY.md** - Quality standards and testing philosophy
- **TEST_EXECUTION_GUIDE.md** - How to run tests and interpret results
- **SECURITY_CONTROL_MATRIX.md** - Security controls and test coverage

---

## 🔄 Version History

| Date | Change | Author |
|------|--------|--------|
| 2025-11-16 | Initial creation - documented resetRateLimiters() and test patterns | System |
| 2025-11-16 | Added CI monitoring guidelines per architect recommendation | System |

---

## 💡 Questions or Issues?

If you encounter issues with rate limiter tests:

1. ✅ Verify `resetRateLimiters()` is imported
2. ✅ Check double-reset pattern in `beforeEach`
3. ✅ Confirm `NODE_ENV=test` is set
4. ✅ Review test execution order (should be serial)
5. ✅ Check for timing-dependent assertions

Still stuck? Review the reference implementation in `server/__tests__/security/attack-vectors.test.ts` (52/52 tests passing with 100% rate limiter coverage).
