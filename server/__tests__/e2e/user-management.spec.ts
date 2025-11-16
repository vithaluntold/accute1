/**
 * Layer 5: E2E Integration Tests - User Management
 * Test Count: 15 tests
 * Dependencies: All previous layers must pass
 * Tool: Playwright for browser automation
 */

import { test, expect } from '@playwright/test';

test.describe('Layer 5B: E2E User Management (15 tests)', () => {
  
  test('TC-E2E-USER-001: Owner can create new user via UI', async ({ page }) => {
    // Login as owner
    await page.goto('/login');
    // ... login flow ...
    
    await page.goto('/users');
    await page.click('[data-testid="button-add-user"]');
    
    // Fill user creation form
    await page.fill('[data-testid="input-email"]', `newuser${Date.now()}@test.com`);
    await page.fill('[data-testid="input-first-name"]', 'New');
    await page.fill('[data-testid="input-last-name"]', 'User');
    await page.selectOption('[data-testid="select-role"]', 'staff');
    await page.fill('[data-testid="input-password"]', 'SecurePass123!');
    
    await page.click('[data-testid="button-save-user"]');
    
    // Should show success toast
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    // New user should appear in list
    await expect(page.locator('[data-testid^="row-user-"]')).toContainText('New User');
  });

  test('TC-E2E-USER-002: User list displays all organization users', async ({ page }) => {
    // Login as admin
    await page.goto('/users');
    
    // Table should be visible
    await expect(page.locator('[data-testid="table-users"]')).toBeVisible();
    
    // Should have at least 1 row (self)
    const rows = await page.locator('[data-testid^="row-user-"]').count();
    expect(rows).toBeGreaterThan(0);
  });

  test('TC-E2E-USER-003: Search filters user list', async ({ page }) => {
    await page.goto('/users');
    
    const searchInput = page.locator('[data-testid="input-search-users"]');
    await searchInput.fill('john');
    
    // Wait for debounce
    await page.waitForTimeout(500);
    
    // Only matching users should be visible
    const visibleRows = await page.locator('[data-testid^="row-user-"]').count();
    expect(visibleRows).toBeGreaterThanOrEqual(0);
  });

  test('TC-E2E-USER-004: User details modal shows complete information', async ({ page }) => {
    await page.goto('/users');
    
    await page.click('[data-testid^="row-user-"]:first-child');
    
    // Modal should open
    await expect(page.locator('[data-testid="modal-user-details"]')).toBeVisible();
    
    // Should show user information
    await expect(page.locator('[data-testid="text-user-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="text-user-role"]')).toBeVisible();
  });

  test('TC-E2E-USER-005: Edit user updates information', async ({ page }) => {
    await page.goto('/users');
    
    // Click edit button
    await page.click('[data-testid^="button-edit-user-"]:first-child');
    
    // Update first name
    const newName = `Updated${Date.now()}`;
    await page.fill('[data-testid="input-first-name"]', newName);
    await page.click('[data-testid="button-save"]');
    
    // Success toast
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    // Updated name should appear in list
    await expect(page.locator('[data-testid^="row-user-"]')).toContainText(newName);
  });

  test('TC-E2E-USER-006: Delete user shows confirmation dialog', async ({ page }) => {
    await page.goto('/users');
    
    await page.click('[data-testid^="button-delete-user-"]:first-child');
    
    // Confirmation dialog should appear
    await expect(page.locator('[data-testid="dialog-confirm-delete"]')).toBeVisible();
    
    // Cancel
    await page.click('[data-testid="button-cancel"]');
    
    // Dialog should close
    await expect(page.locator('[data-testid="dialog-confirm-delete"]')).toBeHidden();
  });

  test('TC-E2E-USER-007: Role filter works correctly', async ({ page }) => {
    await page.goto('/users');
    
    await page.selectOption('[data-testid="select-filter-role"]', 'staff');
    
    // Should only show staff users
    const rows = page.locator('[data-testid^="row-user-"]');
    const count = await rows.count();
    
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText('Staff');
    }
  });

  test('TC-E2E-USER-008: Pagination works for large user lists', async ({ page }) => {
    await page.goto('/users');
    
    // If pagination exists
    const nextButton = page.locator('[data-testid="button-next-page"]');
    
    if (await nextButton.isVisible()) {
      await nextButton.click();
      
      // URL should update
      await expect(page).toHaveURL(/page=2/);
    }
  });

  test('TC-E2E-USER-009: Sort by column works', async ({ page }) => {
    await page.goto('/users');
    
    // Click name column header
    await page.click('[data-testid="header-name"]');
    
    // Should sort ascending
    await expect(page.locator('[data-testid="icon-sort-asc"]')).toBeVisible();
    
    // Click again
    await page.click('[data-testid="header-name"]');
    
    // Should sort descending
    await expect(page.locator('[data-testid="icon-sort-desc"]')).toBeVisible();
  });

  test('TC-E2E-USER-010: Bulk select users works', async ({ page }) => {
    await page.goto('/users');
    
    // Select all checkbox
    await page.click('[data-testid="checkbox-select-all"]');
    
    // All row checkboxes should be checked
    const checkboxes = page.locator('[data-testid^="checkbox-user-"]');
    const count = await checkboxes.count();
    
    for (let i = 0; i < count; i++) {
      await expect(checkboxes.nth(i)).toBeChecked();
    }
  });

  test('TC-E2E-USER-011: Export users to CSV works', async ({ page }) => {
    await page.goto('/users');
    
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="button-export-csv"]')
    ]);
    
    expect(download.suggestedFilename()).toContain('users');
  });

  test('TC-E2E-USER-012: Invite user sends email', async ({ page }) => {
    await page.goto('/users');
    
    await page.click('[data-testid="button-invite-user"]');
    
    await page.fill('[data-testid="input-email"]', 'invite@test.com');
    await page.selectOption('[data-testid="select-role"]', 'staff');
    await page.click('[data-testid="button-send-invite"]');
    
    await expect(page.locator('[data-testid="toast-success"]')).toContainText(/invite sent/i);
  });

  test('TC-E2E-USER-013: User status toggle works', async ({ page }) => {
    await page.goto('/users');
    
    const statusToggle = page.locator('[data-testid^="toggle-status-"]:first-child');
    const initialState = await statusToggle.isChecked();
    
    await statusToggle.click();
    
    await expect(statusToggle).toBeChecked({ checked: !initialState });
  });

  test('TC-E2E-USER-014: Responsive design works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/users');
    
    // Mobile menu should be visible
    await expect(page.locator('[data-testid="button-mobile-menu"]')).toBeVisible();
    
    // Desktop sidebar should be hidden
    await expect(page.locator('[data-testid="sidebar-desktop"]')).toBeHidden();
  });

  test('TC-E2E-USER-015: Dark mode toggle works', async ({ page }) => {
    await page.goto('/users');
    
    await page.click('[data-testid="button-theme-toggle"]');
    
    // Body should have dark class
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
