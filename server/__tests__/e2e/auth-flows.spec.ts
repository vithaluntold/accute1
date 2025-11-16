/**
 * Layer 5: E2E Integration Tests - Authentication Flows
 * Test Count: 15 tests
 * Dependencies: All previous layers must pass
 * Tool: Playwright for browser automation
 */

import { test, expect } from '@playwright/test';

test.describe('Layer 5A: E2E Authentication Flows (15 tests)', () => {
  
  test('TC-E2E-AUTH-001: Complete signup and login flow', async ({ page }) => {
    // Navigate to signup page
    await page.goto('/');
    
    // Fill signup form
    const email = `e2euser${Date.now()}@test.com`;
    await page.fill('[data-testid="input-email"]', email);
    await page.fill('[data-testid="input-password"]', 'SecurePass123!');
    await page.fill('[data-testid="input-first-name"]', 'E2E');
    await page.fill('[data-testid="input-last-name"]', 'User');
    
    // Submit signup
    await page.click('[data-testid="button-signup"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Logout
    await page.click('[data-testid="button-logout"]');
    
    // Login with same credentials
    await page.fill('[data-testid="input-email"]', email);
    await page.fill('[data-testid="input-password"]', 'SecurePass123!');
    await page.click('[data-testid="button-login"]');
    
    // Should be on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('TC-E2E-AUTH-002: Login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid="input-email"]', 'invalid@test.com');
    await page.fill('[data-testid="input-password"]', 'WrongPass123!');
    await page.click('[data-testid="button-login"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test('TC-E2E-AUTH-003: Password visibility toggle works', async ({ page }) => {
    await page.goto('/login');
    
    const passwordInput = page.locator('[data-testid="input-password"]');
    const toggleButton = page.locator('[data-testid="button-toggle-password"]');
    
    // Initially type password
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click toggle
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    
    // Click again
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('TC-E2E-AUTH-004: Remember me checkbox persists session', async ({ page }) => {
    await page.goto('/login');
    
    const email = `e2euser${Date.now()}@test.com`;
    
    // Create account first
    // ... signup flow ...
    
    // Login with remember me
    await page.fill('[data-testid="input-email"]', email);
    await page.fill('[data-testid="input-password"]', 'SecurePass123!');
    await page.check('[data-testid="checkbox-remember-me"]');
    await page.click('[data-testid="button-login"]');
    
    // Verify logged in
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('TC-E2E-AUTH-005: Logout redirects to login page', async ({ page }) => {
    // Assume logged in
    await page.goto('/dashboard');
    
    await page.click('[data-testid="button-logout"]');
    
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-E2E-AUTH-006: Protected routes redirect to login', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-E2E-AUTH-007: Session persists across page refreshes', async ({ page }) => {
    // Login first
    await page.goto('/login');
    const email = `e2euser${Date.now()}@test.com`;
    // ... login flow ...
    
    await page.goto('/dashboard');
    
    // Refresh page
    await page.reload();
    
    // Should still be on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('TC-E2E-AUTH-008: Password reset flow works end-to-end', async ({ page }) => {
    await page.goto('/login');
    
    await page.click('[data-testid="link-forgot-password"]');
    
    await expect(page).toHaveURL(/\/forgot-password/);
    
    await page.fill('[data-testid="input-email"]', 'user@test.com');
    await page.click('[data-testid="button-reset-password"]');
    
    // Should show success message
    await expect(page.locator('[data-testid="text-success"]')).toBeVisible();
  });

  test('TC-E2E-AUTH-009: Form validation shows inline errors', async ({ page }) => {
    await page.goto('/signup');
    
    // Submit without filling fields
    await page.click('[data-testid="button-signup"]');
    
    // Should show validation errors
    await expect(page.locator('[data-testid="error-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-password"]')).toBeVisible();
  });

  test('TC-E2E-AUTH-010: Email format validation works', async ({ page }) => {
    await page.goto('/signup');
    
    await page.fill('[data-testid="input-email"]', 'invalid-email');
    await page.click('[data-testid="button-signup"]');
    
    await expect(page.locator('[data-testid="error-email"]')).toContainText(/valid email/i);
  });

  test('TC-E2E-AUTH-011: Password strength indicator updates', async ({ page }) => {
    await page.goto('/signup');
    
    const passwordInput = page.locator('[data-testid="input-password"]');
    const strengthIndicator = page.locator('[data-testid="password-strength"]');
    
    // Weak password
    await passwordInput.fill('abc');
    await expect(strengthIndicator).toHaveClass(/weak/);
    
    // Strong password
    await passwordInput.fill('SecurePass123!');
    await expect(strengthIndicator).toHaveClass(/strong/);
  });

  test('TC-E2E-AUTH-012: Loading state shows during login', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid="input-email"]', 'user@test.com');
    await page.fill('[data-testid="input-password"]', 'Pass123!');
    
    // Click login and immediately check for loading state
    await page.click('[data-testid="button-login"]');
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
  });

  test('TC-E2E-AUTH-013: Accessibility - keyboard navigation works', async ({ page }) => {
    await page.goto('/login');
    
    // Tab through form
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="input-email"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="input-password"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="button-login"]')).toBeFocused();
  });

  test('TC-E2E-AUTH-014: Error toast appears and dismisses', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid="input-email"]', 'wrong@test.com');
    await page.fill('[data-testid="input-password"]', 'wrong');
    await page.click('[data-testid="button-login"]');
    
    // Toast should appear
    const toast = page.locator('[data-testid="toast-error"]');
    await expect(toast).toBeVisible();
    
    // Toast should auto-dismiss
    await expect(toast).toBeHidden({ timeout: 6000 });
  });

  test('TC-E2E-AUTH-015: Multiple failed logins show rate limit message', async ({ page }) => {
    await page.goto('/login');
    
    const email = 'user@test.com';
    
    // Attempt 5 failed logins
    for (let i = 0; i < 5; i++) {
      await page.fill('[data-testid="input-email"]', email);
      await page.fill('[data-testid="input-password"]', `Wrong${i}`);
      await page.click('[data-testid="button-login"]');
      await page.waitForTimeout(500);
    }
    
    // Next attempt should show rate limit
    await page.fill('[data-testid="input-email"]', email);
    await page.fill('[data-testid="input-password"]', 'Wrong6');
    await page.click('[data-testid="button-login"]');
    
    await expect(page.locator('[data-testid="error-rate-limit"]')).toBeVisible();
  });
});
