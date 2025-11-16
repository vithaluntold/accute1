/**
 * Layer 5: E2E Integration Tests - Complete User Journeys
 * Test Count: 10 tests
 * Dependencies: All previous layers must pass
 * Tool: Playwright for browser automation
 */

import { test, expect } from '@playwright/test';

test.describe('Layer 5D: E2E Complete User Journeys (10 tests)', () => {
  
  test('TC-E2E-JOURNEY-001: New organization setup journey', async ({ page }) => {
    // 1. Signup
    await page.goto('/signup');
    const email = `org${Date.now()}@test.com`;
    
    await page.fill('[data-testid="input-email"]', email);
    await page.fill('[data-testid="input-password"]', 'SecurePass123!');
    await page.fill('[data-testid="input-first-name"]', 'Owner');
    await page.fill('[data-testid="input-last-name"]', 'User');
    await page.click('[data-testid="button-signup"]');
    
    // 2. Create organization
    await expect(page).toHaveURL(/\/onboarding/);
    
    await page.fill('[data-testid="input-org-name"]', 'Test Accounting Firm');
    await page.selectOption('[data-testid="select-industry"]', 'accounting');
    await page.selectOption('[data-testid="select-size"]', '1-10');
    await page.click('[data-testid="button-create-org"]');
    
    // 3. Should land on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // 4. Add first team member
    await page.goto('/users');
    await page.click('[data-testid="button-add-user"]');
    
    await page.fill('[data-testid="input-email"]', `staff${Date.now()}@test.com`);
    await page.fill('[data-testid="input-first-name"]', 'Staff');
    await page.fill('[data-testid="input-last-name"]', 'Member');
    await page.selectOption('[data-testid="select-role"]', 'staff');
    await page.fill('[data-testid="input-password"]', 'StaffPass123!');
    await page.click('[data-testid="button-save-user"]');
    
    // Success
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  });

  test('TC-E2E-JOURNEY-002: Client onboarding workflow', async ({ page }) => {
    // Login as owner
    await page.goto('/login');
    // ... login ...
    
    // Navigate to clients
    await page.goto('/clients');
    await page.click('[data-testid="button-add-client"]');
    
    // Fill client information
    await page.fill('[data-testid="input-client-name"]', 'Acme Corp');
    await page.fill('[data-testid="input-client-email"]', 'contact@acme.com');
    await page.fill('[data-testid="input-client-phone"]', '555-1234');
    await page.fill('[data-testid="input-client-address"]', '123 Main St');
    
    await page.click('[data-testid="button-save-client"]');
    
    // Client should appear in list
    await expect(page.locator('[data-testid^="row-client-"]')).toContainText('Acme Corp');
    
    // Create first project for client
    await page.click('[data-testid^="row-client-"]:first-child');
    await page.click('[data-testid="button-add-project"]');
    
    await page.fill('[data-testid="input-project-name"]', 'Annual Tax Return');
    await page.selectOption('[data-testid="select-service-type"]', 'tax-return');
    await page.click('[data-testid="button-create-project"]');
    
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  });

  test('TC-E2E-JOURNEY-003: Document upload and processing', async ({ page }) => {
    await page.goto('/clients');
    
    // Select client
    await page.click('[data-testid^="row-client-"]:first-child');
    
    // Upload document
    await page.click('[data-testid="button-upload-document"]');
    
    const fileInput = page.locator('[data-testid="input-file"]');
    await fileInput.setInputFiles({
      name: 'tax-form.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Mock PDF content')
    });
    
    await page.click('[data-testid="button-upload"]');
    
    // Wait for processing
    await expect(page.locator('[data-testid="status-processing"]')).toBeVisible();
    
    // Document should appear in list
    await expect(page.locator('[data-testid^="doc-"]')).toContainText('tax-form.pdf');
  });

  test('TC-E2E-JOURNEY-004: Complete billing workflow', async ({ page }) => {
    // Login as owner
    await page.goto('/billing');
    
    // View subscription
    await expect(page.locator('[data-testid="text-current-plan"]')).toBeVisible();
    
    // Upgrade plan
    await page.click('[data-testid="button-upgrade"]');
    
    await page.click('[data-testid="button-select-pro-plan"]');
    
    // Enter payment information
    await page.fill('[data-testid="input-card-number"]', '4242424242424242');
    await page.fill('[data-testid="input-expiry"]', '12/25');
    await page.fill('[data-testid="input-cvc"]', '123');
    
    await page.click('[data-testid="button-confirm-upgrade"]');
    
    // Success message
    await expect(page.locator('[data-testid="toast-success"]')).toContainText(/upgraded/i);
  });

  test('TC-E2E-JOURNEY-005: AI agent consultation workflow', async ({ page }) => {
    await page.goto('/ai-agents');
    
    // Select Luca agent
    await page.click('[data-testid="card-agent-luca"]');
    
    // Start conversation
    await page.fill('[data-testid="input-message"]', 'What tax deductions are available?');
    await page.click('[data-testid="button-send"]');
    
    // Wait for response
    await expect(page.locator('[data-testid^="message-ai-"]')).toBeVisible();
    
    // Continue conversation
    await page.fill('[data-testid="input-message"]', 'Tell me more about home office deductions');
    await page.click('[data-testid="button-send"]');
    
    await expect(page.locator('[data-testid^="message-ai-"]:nth-child(2)')).toBeVisible();
  });

  test('TC-E2E-JOURNEY-006: Team collaboration workflow', async ({ page }) => {
    // Login as admin
    await page.goto('/projects');
    
    // Open project
    await page.click('[data-testid^="card-project-"]:first-child');
    
    // Assign task to team member
    await page.click('[data-testid="button-add-task"]');
    
    await page.fill('[data-testid="input-task-title"]', 'Review financials');
    await page.fill('[data-testid="input-task-description"]', 'Review Q4 financials');
    await page.selectOption('[data-testid="select-assignee"]', 'Staff Member');
    await page.click('[data-testid="button-create-task"]');
    
    // Add comment
    await page.fill('[data-testid="input-comment"]', 'Please complete by Friday');
    await page.click('[data-testid="button-add-comment"]');
    
    await expect(page.locator('[data-testid^="comment-"]')).toBeVisible();
  });

  test('TC-E2E-JOURNEY-007: Report generation workflow', async ({ page }) => {
    await page.goto('/reports');
    
    await page.click('[data-testid="button-create-report"]');
    
    // Select report type
    await page.selectOption('[data-testid="select-report-type"]', 'financial-summary');
    
    // Set date range
    await page.fill('[data-testid="input-start-date"]', '2025-01-01');
    await page.fill('[data-testid="input-end-date"]', '2025-12-31');
    
    // Select format
    await page.selectOption('[data-testid="select-format"]', 'pdf');
    
    await page.click('[data-testid="button-generate"]');
    
    // Wait for generation
    await expect(page.locator('[data-testid="status-generating"]')).toBeVisible();
    
    // Download should be available
    await expect(page.locator('[data-testid="button-download"]')).toBeVisible();
  });

  test('TC-E2E-JOURNEY-008: Profile and settings update', async ({ page }) => {
    await page.goto('/profile');
    
    // Update profile picture
    const fileInput = page.locator('[data-testid="input-profile-picture"]');
    await fileInput.setInputFiles({
      name: 'avatar.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('Mock image')
    });
    
    // Update name
    await page.fill('[data-testid="input-first-name"]', 'Updated');
    await page.click('[data-testid="button-save-profile"]');
    
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    
    // Change password
    await page.click('[data-testid="tab-security"]');
    
    await page.fill('[data-testid="input-current-password"]', 'OldPass123!');
    await page.fill('[data-testid="input-new-password"]', 'NewPass456!');
    await page.fill('[data-testid="input-confirm-password"]', 'NewPass456!');
    await page.click('[data-testid="button-change-password"]');
    
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  });

  test('TC-E2E-JOURNEY-009: Notification center workflow', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Open notification center
    await page.click('[data-testid="button-notifications"]');
    
    // Should show notifications
    await expect(page.locator('[data-testid="panel-notifications"]')).toBeVisible();
    
    // Mark as read
    await page.click('[data-testid^="notification-"]:first-child');
    
    await expect(page.locator('[data-testid^="notification-"]:first-child')).toHaveClass(/read/);
    
    // Clear all
    await page.click('[data-testid="button-clear-all"]');
    
    await expect(page.locator('[data-testid="text-no-notifications"]')).toBeVisible();
  });

  test('TC-E2E-JOURNEY-010: Search functionality across modules', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Global search
    await page.fill('[data-testid="input-global-search"]', 'tax');
    
    // Wait for results
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    
    // Should show results from multiple categories
    await expect(page.locator('[data-testid="results-clients"]')).toBeVisible();
    await expect(page.locator('[data-testid="results-projects"]')).toBeVisible();
    await expect(page.locator('[data-testid="results-documents"]')).toBeVisible();
    
    // Click result
    await page.click('[data-testid^="result-"]:first-child');
    
    // Should navigate to result page
    await expect(page).toHaveURL(/\/(clients|projects|documents)/);
  });
});
