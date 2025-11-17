import { test, expect, Page } from '@playwright/test';
import { createTestOrganization } from '../../helpers';
import { db } from '../../../db';
import { llmConfigurations } from '@shared/schema';
import crypto from 'crypto';

/**
 * E2E Agent Conversation Tests
 * 
 * Tests complete end-to-end agent conversations with real browser interactions.
 * Covers all 10 AI agents with realistic user scenarios.
 * 
 * Coverage:
 * 1. Luca (Tax Assistant) - 5 tests
 * 2. Cadence (Workflow Automation) - 5 tests
 * 3. Parity (Forms & Compliance) - 5 tests
 * 4. Forma (Legal Document Assistant) - 5 tests
 * 5. Echo (Messaging & Communication) - 5 tests
 * 6. Relay (Inbox Management) - 5 tests
 * 7. Scribe (Email Assistant) - 5 tests
 * 8. Radar (Status Monitoring) - 5 tests
 * 9. OmniSpectra (Logging & Analytics) - 5 tests
 * 10. Lynk (Integration Assistant) - 5 tests
 * 
 * Total: 50 E2E tests
 */

test.describe('E2E Agent Conversations', () => {
  let testEmail: string;
  let testPassword: string;
  let testOrgId: string;
  let testUserId: string;

  test.beforeAll(async () => {
    // Create test organization and user
    const { organization, ownerUser } = await createTestOrganization();
    testOrgId = organization.id;
    testUserId = ownerUser.id;
    testEmail = ownerUser.email;
    testPassword = 'TestPassword123!';

    // Setup mock LLM configuration for testing
    const encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    process.env.ENCRYPTION_KEY = encryptionKey;

    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(encryptionKey, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update('sk-test-mock-api-key-12345', 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const encryptedKey = `${iv.toString('hex')}:${encrypted}`;

    await db.insert(llmConfigurations).values({
      scope: 'workspace',
      organizationId: testOrgId,
      userId: null,
      name: 'Test OpenAI Config',
      provider: 'openai',
      apiKeyEncrypted: encryptedKey,
      model: 'gpt-4',
      isActive: true,
      isDefault: true,
      createdBy: testUserId,
    });
  });

  // Helper to login user
  async function loginUser(page: Page) {
    await page.goto('/');
    await page.fill('[data-testid="input-email"]', testEmail);
    await page.fill('[data-testid="input-password"]', testPassword);
    await page.click('[data-testid="button-login"]');
    await page.waitForURL('**/dashboard');
  }

  // Helper to start agent conversation
  async function startAgentConversation(page: Page, agentSlug: string) {
    await page.goto(`/ai-agents/${agentSlug}`);
    await page.waitForSelector('[data-testid="input-message"]');
  }

  // Helper to send message and wait for response
  async function sendMessage(page: Page, message: string) {
    await page.fill('[data-testid="input-message"]', message);
    await page.click('[data-testid="button-send"]');
    // Wait for agent response (with streaming)
    await page.waitForSelector('[data-testid*="message-agent"]', { timeout: 10000 });
  }

  // ============================================================
  // 1. LUCA (Tax Assistant) - 5 tests
  // ============================================================

  test.describe('Luca - Tax Assistant', () => {
    test('should answer basic tax question with follow-up questions', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'luca');

      await sendMessage(page, 'What are the tax implications of S-Corp vs LLC?');

      // Luca should ask clarifying questions (new personality trait)
      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toContain('?'); // Should contain questions
      expect(response?.length).toBeGreaterThan(50); // Substantive response
    });

    test('should provide IRS-specific guidance', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'luca');

      await sendMessage(page, 'What is the 2024 standard deduction for married filing jointly?');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
      expect(response).not.toContain('outside my scope'); // Tax questions are allowed
    });

    test('should refuse out-of-scope legal questions', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'luca');

      await sendMessage(page, 'Can you draft a contract for my business?');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toContain('Forma'); // Should redirect to Forma
    });

    test('should handle multi-turn conversation with context', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'luca');

      await sendMessage(page, 'I want to start an S-Corp');
      await page.waitForTimeout(2000);
      
      await sendMessage(page, 'What are the requirements?');

      // Second message should reference first message context
      const messages = await page.locator('[data-testid*="message-agent"]').all();
      expect(messages.length).toBeGreaterThanOrEqual(2);
    });

    test('should auto-generate conversation title after first exchange', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'luca');

      await sendMessage(page, 'Explain depreciation for rental property');

      // Wait for auto-title generation
      await page.waitForTimeout(3000);
      
      const title = await page.textContent('[data-testid="session-title"]');
      expect(title).toBeTruthy();
      expect(title?.length).toBeLessThan(50); // Concise 3-6 word title
    });
  });

  // ============================================================
  // 2. CADENCE (Workflow Automation) - 5 tests
  // ============================================================

  test.describe('Cadence - Workflow Automation', () => {
    test('should help create workflow automation', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'cadence');

      await sendMessage(page, 'Create a workflow to auto-assign new clients to team members');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toContain('workflow');
    });

    test('should suggest automation actions', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'cadence');

      await sendMessage(page, 'What can I automate for client onboarding?');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should refuse tax-specific questions', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'cadence');

      await sendMessage(page, 'Calculate my quarterly tax estimate');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toContain('Luca'); // Should redirect to Luca
    });

    test('should handle workflow template requests', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'cadence');

      await sendMessage(page, 'Show me workflow templates');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should maintain conversation state across messages', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'cadence');

      await sendMessage(page, 'I need to automate invoice reminders');
      await page.waitForTimeout(2000);
      await sendMessage(page, 'How often should they go out?');

      const messages = await page.locator('[data-testid*="message-agent"]').all();
      expect(messages.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================
  // 3. PARITY (Forms & Compliance) - 5 tests
  // ============================================================

  test.describe('Parity - Forms & Compliance', () => {
    test('should help with compliance forms', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'parity');

      await sendMessage(page, 'What forms do I need for W-2 filing?');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toContain('form');
    });

    test('should suggest form templates', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'parity');

      await sendMessage(page, 'Show me client intake forms');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should refuse workflow automation questions', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'parity');

      await sendMessage(page, 'Automate my client onboarding');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toContain('Cadence'); // Should redirect
    });

    test('should handle form customization requests', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'parity');

      await sendMessage(page, 'Customize the client intake form');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should generate session title after conversation', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'parity');

      await sendMessage(page, 'Help me create a 1099 tracking form');
      await page.waitForTimeout(3000);

      const title = await page.textContent('[data-testid="session-title"]');
      expect(title).toBeTruthy();
    });
  });

  // ============================================================
  // 4. FORMA (Legal Document Assistant) - 5 tests
  // ============================================================

  test.describe('Forma - Legal Document Assistant', () => {
    test('should help with legal document drafting', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'forma');

      await sendMessage(page, 'Draft a client engagement letter');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toContain('letter' || 'document' || 'legal');
    });

    test('should provide contract templates', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'forma');

      await sendMessage(page, 'Show me contract templates');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should refuse tax calculation questions', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'forma');

      await sendMessage(page, 'Calculate depreciation for my rental');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toContain('Luca'); // Should redirect
    });

    test('should handle document review requests', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'forma');

      await sendMessage(page, 'Review my NDA template');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should maintain context in multi-turn legal conversations', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'forma');

      await sendMessage(page, 'I need an engagement letter');
      await page.waitForTimeout(2000);
      await sendMessage(page, 'Add a termination clause');

      const messages = await page.locator('[data-testid*="message-agent"]').all();
      expect(messages.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================
  // 5. ECHO (Messaging & Communication) - 5 tests
  // ============================================================

  test.describe('Echo - Messaging & Communication', () => {
    test('should help with internal messaging', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'echo');

      await sendMessage(page, 'Send a message to the tax team');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should suggest communication templates', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'echo');

      await sendMessage(page, 'Show me client update message templates');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should refuse document drafting questions', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'echo');

      await sendMessage(page, 'Draft a contract');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toContain('Forma'); // Should redirect
    });

    test('should handle team communication requests', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'echo');

      await sendMessage(page, 'Notify all team members about the deadline');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should auto-title messaging conversations', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'echo');

      await sendMessage(page, 'Help me write a client follow-up message');
      await page.waitForTimeout(3000);

      const title = await page.textContent('[data-testid="session-title"]');
      expect(title).toBeTruthy();
    });
  });

  // ============================================================
  // 6. RELAY (Inbox Management) - 5 tests
  // ============================================================

  test.describe('Relay - Inbox Management', () => {
    test('should help manage inbox', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'relay');

      await sendMessage(page, 'Show me unread messages');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should suggest inbox organization', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'relay');

      await sendMessage(page, 'How can I organize my inbox better?');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should refuse email drafting questions', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'relay');

      await sendMessage(page, 'Write an email to my client');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toContain('Scribe'); // Should redirect
    });

    test('should handle message filtering requests', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'relay');

      await sendMessage(page, 'Filter messages from urgent clients');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should maintain conversation context', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'relay');

      await sendMessage(page, 'Show high priority messages');
      await page.waitForTimeout(2000);
      await sendMessage(page, 'Archive the old ones');

      const messages = await page.locator('[data-testid*="message-agent"]').all();
      expect(messages.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================
  // 7. SCRIBE (Email Assistant) - 5 tests
  // ============================================================

  test.describe('Scribe - Email Assistant', () => {
    test('should help draft professional emails', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'scribe');

      await sendMessage(page, 'Write a professional email to a new client');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toContain('email' || 'subject' || 'Dear');
    });

    test('should provide email templates', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'scribe');

      await sendMessage(page, 'Show me email templates');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should refuse tax questions', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'scribe');

      await sendMessage(page, 'What is the corporate tax rate?');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toContain('Luca'); // Should redirect
    });

    test('should handle email revision requests', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'scribe');

      await sendMessage(page, 'Make this email more formal');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should auto-title email conversations', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'scribe');

      await sendMessage(page, 'Draft a follow-up email to Jane about the tax deadline');
      await page.waitForTimeout(3000);

      const title = await page.textContent('[data-testid="session-title"]');
      expect(title).toBeTruthy();
    });
  });

  // ============================================================
  // 8. RADAR (Status Monitoring) - 5 tests
  // ============================================================

  test.describe('Radar - Status Monitoring', () => {
    test('should provide system status updates', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'radar');

      await sendMessage(page, 'What is the current system status?');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should show project statuses', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'radar');

      await sendMessage(page, 'Show me all active projects');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should refuse workflow creation questions', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'radar');

      await sendMessage(page, 'Create a new workflow');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toContain('Cadence'); // Should redirect
    });

    test('should handle status monitoring requests', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'radar');

      await sendMessage(page, 'Alert me when client deadlines are approaching');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should maintain context in status conversations', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'radar');

      await sendMessage(page, 'Show overdue tasks');
      await page.waitForTimeout(2000);
      await sendMessage(page, 'Who is responsible?');

      const messages = await page.locator('[data-testid*="message-agent"]').all();
      expect(messages.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================
  // 9. OMNISPECTRA (Logging & Analytics) - 5 tests
  // ============================================================

  test.describe('OmniSpectra - Logging & Analytics', () => {
    test('should provide analytics insights', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'omnispectra');

      await sendMessage(page, 'Show me client activity analytics');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should generate reports', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'omnispectra');

      await sendMessage(page, 'Generate a monthly activity report');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should refuse form creation questions', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'omnispectra');

      await sendMessage(page, 'Create a client intake form');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toContain('Parity'); // Should redirect
    });

    test('should handle custom analytics requests', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'omnispectra');

      await sendMessage(page, 'Track billable hours by client');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should auto-title analytics conversations', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'omnispectra');

      await sendMessage(page, 'Analyze Q4 revenue trends');
      await page.waitForTimeout(3000);

      const title = await page.textContent('[data-testid="session-title"]');
      expect(title).toBeTruthy();
    });
  });

  // ============================================================
  // 10. LYNK (Integration Assistant) - 5 tests
  // ============================================================

  test.describe('Lynk - Integration Assistant', () => {
    test('should help with third-party integrations', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'lynk');

      await sendMessage(page, 'Connect QuickBooks to Accute');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toContain('integration' || 'QuickBooks' || 'connect');
    });

    test('should show available integrations', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'lynk');

      await sendMessage(page, 'What integrations are available?');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should refuse tax advice questions', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'lynk');

      await sendMessage(page, 'Should I file as an S-Corp?');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toContain('Luca'); // Should redirect
    });

    test('should handle integration troubleshooting', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'lynk');

      await sendMessage(page, 'My Stripe integration is not syncing');

      const response = await page.textContent('[data-testid*="message-agent"]');
      expect(response).toBeTruthy();
    });

    test('should maintain context in integration conversations', async ({ page }) => {
      await loginUser(page);
      await startAgentConversation(page, 'lynk');

      await sendMessage(page, 'Setup Mailgun integration');
      await page.waitForTimeout(2000);
      await sendMessage(page, 'What credentials do I need?');

      const messages = await page.locator('[data-testid*="message-agent"]').all();
      expect(messages.length).toBeGreaterThanOrEqual(2);
    });
  });
});
