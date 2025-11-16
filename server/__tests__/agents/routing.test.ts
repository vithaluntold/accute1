/**
 * AI Agent System - Routing & Initialization Unit Tests
 * 
 * Tests agent registry, route registration, and access control.
 * Target: 40 unit tests
 * Coverage: Agent routing, slug validation, initialization, RBAC
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { testDb as db } from '../../test-db';
import {
  agentRegistry,
  getAgentConfig,
  getAllAgentsLegacy,
  isAgentRegistered,
  getAgentsByCategory,
  type AgentManifest,
} from '../../agent-registry';
import { getAvailableAgents } from '../../agents-static';
import { users, organizations, aiAgents, organizationAgents, userAgentAccess } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createUser, createTestOrganization } from '../helpers';

describe('AI Agent System - Routing & Initialization', () => {
  let testOrgId: string;
  let testUserId: string;
  let superAdminId: string;

  beforeAll(async () => {
    // Create test organization using helper (includes owner user)
    const { organization } = await createTestOrganization();
    testOrgId = organization.id;

    // Create super admin using helper (no organization)
    const timestamp = Date.now();
    const superAdmin = await createUser({
      email: `superadmin-${timestamp}@accute.ai`,
      password: 'password123',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'admin', // Use 'admin' role (helpers don't support 'Super Admin')
      organizationId: undefined, // No org = acts like super admin for tests
    });
    superAdminId = superAdmin.id;

    // Create test user in organization using helper
    const testUser = await createUser({
      email: `user-${timestamp}@testagentorg.com`,
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      role: 'admin',
      organizationId: testOrgId,
    });
    testUserId = testUser.id;
  });

  afterEach(async () => {
    // Cleanup test data (but keep org and users for all tests)
    await db.delete(userAgentAccess);
    await db.delete(organizationAgents);
  });

  // ==================== SECTION 1: Agent Registry (15 tests) ====================

  describe('Agent Registry', () => {
    it('should load all 10 agents from static registry', () => {
      const agents = getAvailableAgents();
      expect(agents).toHaveLength(10);
      expect(agents).toEqual(
        expect.arrayContaining([
          'luca',
          'cadence',
          'parity',
          'forma',
          'echo',
          'relay',
          'scribe',
          'radar',
          'omnispectra',
          'lynk',
        ])
      );
    });

    it('should verify all agent slugs match expected names', () => {
      const expectedAgents = [
        'luca',
        'cadence',
        'parity',
        'forma',
        'echo',
        'relay',
        'scribe',
        'radar',
        'omnispectra',
        'lynk',
      ];

      expectedAgents.forEach((slug) => {
        const config = getAgentConfig(slug);
        expect(config).toBeTruthy();
        expect(config?.name).toBe(slug);
      });
    });

    it('should verify agent configs contain required fields', () => {
      const config = getAgentConfig('luca');
      expect(config).toHaveProperty('name');
      expect(config).toHaveProperty('displayName');
      expect(config).toHaveProperty('category');
      expect(config).toHaveProperty('path');
      expect(config).toHaveProperty('className');
      expect(config).toHaveProperty('capabilities');
      expect(Array.isArray(config?.capabilities)).toBe(true);
    });

    it('should return null for invalid agent slug', () => {
      const config = getAgentConfig('nonexistent-agent');
      expect(config).toBeNull();
    });

    it('should verify all agents have non-empty capabilities array', () => {
      const agents = getAllAgentsLegacy();
      agents.forEach((agent) => {
        expect(agent.capabilities).toBeTruthy();
        expect(agent.capabilities.length).toBeGreaterThan(0);
      });
    });

    it('should verify agent categories are valid', () => {
      const validCategories = [
        'assistant',
        'workflow',
        'forms',
        'legal',
        'messaging',
        'inbox',
        'email',
        'status',
        'logging',
        'integration',
      ];

      const agents = getAllAgentsLegacy();
      agents.forEach((agent) => {
        expect(validCategories).toContain(agent.category);
      });
    });

    it('should get agent config by name (case-insensitive)', () => {
      const config1 = getAgentConfig('luca');
      const config2 = getAgentConfig('LUCA');
      const config3 = getAgentConfig('Luca');
      expect(config1).toEqual(config2);
      expect(config2).toEqual(config3);
    });

    it('should get agent config by display name', () => {
      const config = getAgentConfig('Parity AI');
      expect(config).toBeTruthy();
      expect(config?.name).toBe('parity');
    });

    it('should return all agents with getAllAgentsLegacy()', () => {
      const agents = getAllAgentsLegacy();
      expect(agents.length).toBe(10);
      expect(Array.isArray(agents)).toBe(true);
    });

    it('should check if agent is registered', () => {
      expect(isAgentRegistered('luca')).toBe(true);
      expect(isAgentRegistered('cadence')).toBe(true);
      expect(isAgentRegistered('nonexistent')).toBe(false);
    });

    it('should get agents by category - assistant', () => {
      const agents = getAgentsByCategory('assistant');
      expect(agents.length).toBeGreaterThan(0);
      expect(agents.every((a) => a.category === 'assistant')).toBe(true);
    });

    it('should get agents by category - workflow', () => {
      const agents = getAgentsByCategory('workflow');
      expect(agents.length).toBeGreaterThan(0);
      expect(agents.every((a) => a.category === 'workflow')).toBe(true);
    });

    it('should get agents by category - legal', () => {
      const agents = getAgentsByCategory('legal');
      expect(agents.length).toBeGreaterThan(0);
      expect(agents.every((a) => a.category === 'legal')).toBe(true);
    });

    it('should verify Luca agent has required capabilities', () => {
      const config = getAgentConfig('luca');
      expect(config?.capabilities).toContain('accounting');
      expect(config?.capabilities).toContain('taxation');
      expect(config?.capabilities).toContain('conversational');
    });

    it('should verify Cadence agent has workflow capabilities', () => {
      const config = getAgentConfig('cadence');
      expect(config?.capabilities).toContain('workflow_generation');
      expect(config?.capabilities).toContain('process_automation');
    });
  });

  // ==================== SECTION 2: Agent Route Registration (15 tests) ====================

  describe('Agent Route Registration', () => {
    it('should verify static agent loader has all 10 agents', () => {
      const agents = getAvailableAgents();
      expect(agents).toHaveLength(10);
    });

    it('should verify agent slugs follow lowercase naming convention', () => {
      const agents = getAvailableAgents();
      agents.forEach((slug) => {
        expect(slug).toBe(slug.toLowerCase());
        expect(slug).not.toContain(' ');
        expect(slug).not.toContain('_'); // kebab-case not snake_case
      });
    });

    it('should verify Luca agent can be retrieved', () => {
      const config = getAgentConfig('luca');
      expect(config).toBeTruthy();
      expect(config?.name).toBe('luca');
      expect(config?.displayName).toBe('Luca');
    });

    it('should verify Cadence agent can be retrieved', () => {
      const config = getAgentConfig('cadence');
      expect(config).toBeTruthy();
      expect(config?.name).toBe('cadence');
      expect(config?.displayName).toBe('Cadence');
    });

    it('should verify Parity agent can be retrieved', () => {
      const config = getAgentConfig('parity');
      expect(config).toBeTruthy();
      expect(config?.name).toBe('parity');
      expect(config?.displayName).toBe('Parity');
    });

    it('should verify Forma agent can be retrieved', () => {
      const config = getAgentConfig('forma');
      expect(config).toBeTruthy();
      expect(config?.name).toBe('forma');
      expect(config?.displayName).toBe('Forma');
    });

    it('should verify Echo agent can be retrieved', () => {
      const config = getAgentConfig('echo');
      expect(config).toBeTruthy();
      expect(config?.name).toBe('echo');
      expect(config?.displayName).toBe('Echo');
    });

    it('should verify Relay agent can be retrieved', () => {
      const config = getAgentConfig('relay');
      expect(config).toBeTruthy();
      expect(config?.name).toBe('relay');
      expect(config?.displayName).toBe('Relay');
    });

    it('should verify Scribe agent can be retrieved', () => {
      const config = getAgentConfig('scribe');
      expect(config).toBeTruthy();
      expect(config?.name).toBe('scribe');
      expect(config?.displayName).toBe('Scribe');
    });

    it('should verify Radar agent can be retrieved', () => {
      const config = getAgentConfig('radar');
      expect(config).toBeTruthy();
      expect(config?.name).toBe('radar');
      expect(config?.displayName).toBe('Radar');
    });

    it('should verify Omnispectra agent can be retrieved', () => {
      const config = getAgentConfig('omnispectra');
      expect(config).toBeTruthy();
      expect(config?.name).toBe('omnispectra');
      expect(config?.displayName).toBe('OmniSpectra');
    });

    it('should verify Lynk agent can be retrieved', () => {
      const config = getAgentConfig('lynk');
      expect(config).toBeTruthy();
      expect(config?.name).toBe('lynk');
      expect(config?.displayName).toBe('Lynk');
    });

    it('should verify all agents have streaming support', () => {
      const agents = getAllAgentsLegacy();
      agents.forEach((agent) => {
        expect(agent.supportsStreaming).toBe(true);
      });
    });

    it('should verify Luca requires tool execution', () => {
      const config = getAgentConfig('luca');
      expect(config?.requiresToolExecution).toBe(true);
    });

    it('should verify most agents do not require tool execution', () => {
      const agents = getAllAgentsLegacy().filter((a) => a.name !== 'luca');
      agents.forEach((agent) => {
        expect(agent.requiresToolExecution).toBe(false);
      });
    });
  });

  // ==================== SECTION 3: Agent Access Control (10 tests) ====================

  describe('Agent Access Control', () => {
    let testAgentId: string;

    beforeEach(async () => {
      // Create test agent in database
      const [agent] = await db
        .insert(aiAgents)
        .values({
          slug: 'test-agent',
          name: 'Test Agent',
          description: 'Test agent for access control',
          category: 'testing',
          provider: 'internal',
          frontendPath: '/test/frontend',
          backendPath: '/test/backend',
          subscriptionMinPlan: 'free',
          isPublished: true,
        })
        .returning();
      testAgentId = agent.id;
    });

    afterEach(async () => {
      // Clean up test agent
      await db.delete(aiAgents).where(eq(aiAgents.id, testAgentId));
    });

    it('should allow Super Admin to access all published agents', async () => {
      const hasAccess = await agentRegistry.checkUserAccess(
        superAdminId,
        'test-agent',
        null, // Super admin has no org
        'Super Admin'
      );
      expect(hasAccess).toBe(true);
    });

    it('should allow Org Admin to access organization-enabled agents', async () => {
      // Enable agent for organization
      await db.insert(organizationAgents).values({
        organizationId: testOrgId,
        agentId: testAgentId,
        status: 'enabled',
        grantedBy: testUserId,
      });

      const hasAccess = await agentRegistry.checkUserAccess(
        testUserId,
        'test-agent',
        testOrgId,
        'Admin'
      );
      expect(hasAccess).toBe(true);
    });

    it('should deny access to disabled agents', async () => {
      // Enable then disable agent
      await db.insert(organizationAgents).values({
        organizationId: testOrgId,
        agentId: testAgentId,
        status: 'disabled',
        grantedBy: testUserId,
      });

      const hasAccess = await agentRegistry.checkUserAccess(
        testUserId,
        'test-agent',
        testOrgId,
        'Admin'
      );
      expect(hasAccess).toBe(false);
    });

    it('should deny access to unpublished agents for non-Super Admins', async () => {
      // Mark agent as unpublished
      await db.update(aiAgents).set({ isPublished: false }).where(eq(aiAgents.id, testAgentId));

      const hasAccess = await agentRegistry.checkUserAccess(
        testUserId,
        'test-agent',
        testOrgId,
        'Admin'
      );
      expect(hasAccess).toBe(false);
    });

    it('should allow Manager with explicit user-agent permission', async () => {
      // Enable agent for org
      await db.insert(organizationAgents).values({
        organizationId: testOrgId,
        agentId: testAgentId,
        status: 'enabled',
        grantedBy: testUserId,
      });

      // Grant explicit permission to manager
      await db.insert(userAgentAccess).values({
        userId: testUserId,
        agentId: testAgentId,
        organizationId: testOrgId,
        accessLevel: 'use',
        grantedBy: testUserId,
      });

      const hasAccess = await agentRegistry.checkUserAccess(
        testUserId,
        'test-agent',
        testOrgId,
        'Manager'
      );
      expect(hasAccess).toBe(true);
    });

    it('should deny Manager without explicit permission', async () => {
      // Enable agent for org but no user permission
      await db.insert(organizationAgents).values({
        organizationId: testOrgId,
        agentId: testAgentId,
        status: 'enabled',
        grantedBy: testUserId,
      });

      const hasAccess = await agentRegistry.checkUserAccess(
        testUserId,
        'test-agent',
        testOrgId,
        'Manager'
      );
      expect(hasAccess).toBe(false);
    });

    it('should deny access to revoked user permissions', async () => {
      // Enable agent and grant permission
      await db.insert(organizationAgents).values({
        organizationId: testOrgId,
        agentId: testAgentId,
        status: 'enabled',
        grantedBy: testUserId,
      });

      const [access] = await db
        .insert(userAgentAccess)
        .values({
          userId: testUserId,
          agentId: testAgentId,
          organizationId: testOrgId,
          accessLevel: 'use',
          grantedBy: testUserId,
          revokedAt: new Date(), // Revoked immediately
        })
        .returning();

      const hasAccess = await agentRegistry.checkUserAccess(
        testUserId,
        'test-agent',
        testOrgId,
        'Manager'
      );
      expect(hasAccess).toBe(false);
    });

    it('should return available agents filtered by user role', async () => {
      // Enable agent for org
      await db.insert(organizationAgents).values({
        organizationId: testOrgId,
        agentId: testAgentId,
        status: 'enabled',
        grantedBy: testUserId,
      });

      const available = await agentRegistry.getAvailableAgents(
        testUserId,
        testOrgId,
        'Admin',
        'free'
      );

      // Admin should see enabled agents
      const testAgent = available.find((a) => a.slug === 'test-agent');
      expect(testAgent).toBeTruthy();
    });

    it('should filter agents by subscription plan', async () => {
      // Create premium agent
      const [premiumAgent] = await db
        .insert(aiAgents)
        .values({
          slug: 'premium-agent',
          name: 'Premium Agent',
          description: 'Premium tier agent',
          category: 'premium',
          provider: 'internal',
          frontendPath: '/premium/frontend',
          backendPath: '/premium/backend',
          subscriptionMinPlan: 'professional', // Requires pro plan
          isPublished: true,
        })
        .returning();

      await db.insert(organizationAgents).values({
        organizationId: testOrgId,
        agentId: premiumAgent.id,
        status: 'enabled',
        grantedBy: testUserId,
      });

      // User with free plan should NOT see premium agent
      const freeAvailable = await agentRegistry.getAvailableAgents(
        testUserId,
        testOrgId,
        'Admin',
        'free'
      );
      expect(freeAvailable.find((a) => a.slug === 'premium-agent')).toBeUndefined();

      // User with professional plan SHOULD see premium agent
      const proAvailable = await agentRegistry.getAvailableAgents(
        testUserId,
        testOrgId,
        'Admin',
        'professional'
      );
      expect(proAvailable.find((a) => a.slug === 'premium-agent')).toBeTruthy();

      // Cleanup
      await db.delete(aiAgents).where(eq(aiAgents.id, premiumAgent.id));
    });

    it('should deny access to non-existent agents', async () => {
      const hasAccess = await agentRegistry.checkUserAccess(
        testUserId,
        'nonexistent-agent',
        testOrgId,
        'Admin'
      );
      expect(hasAccess).toBe(false);
    });
  });
});
