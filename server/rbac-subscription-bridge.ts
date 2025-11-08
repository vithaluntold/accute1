/**
 * RBAC-Subscription Bridge
 * 
 * Dynamically restricts permissions based on active subscription features.
 * This ensures RBAC permissions align with subscription entitlements.
 * 
 * Architecture:
 * - Feature-to-Permission Mapping: Defines which permissions require which features
 * - Effective Permissions: Role permissions filtered by subscription features
 * - Test Account Bypass: Test accounts get all permissions unrestricted
 */

import type { FeatureIdentifier } from '@/shared/subscription-types';
import type { Permission } from '@/shared/schema';
import { storage } from './storage';
import { hasFeatureAccess } from './feature-gating';

/**
 * Map subscription features to permission patterns
 * Permissions matching these patterns require the corresponding feature
 */
const FEATURE_PERMISSION_MAP: Record<FeatureIdentifier, string[]> = {
  // Workflow features require workflow-related permissions
  workflows: [
    'workflows:create',
    'workflows:edit',
    'workflows:delete',
    'workflows:view',
    'workflows:assign',
    'workflow-templates:create',
    'workflow-templates:edit'
  ],
  
  // AI agents require agent-related permissions
  ai_agents: [
    'ai-agents:install',
    'ai-agents:uninstall',
    'ai-agents:configure',
    'ai-agents:chat',
    'ai-marketplace:view',
    'ai-marketplace:install'
  ],
  
  // Digital signatures require signature permissions
  signatures: [
    'signatures:create',
    'signatures:verify',
    'documents:sign'
  ],
  
  // Analytics require analytics/reporting permissions
  analytics: [
    'analytics:view',
    'reports:basic',
    'dashboards:view'
  ],
  
  // Advanced reporting requires advanced report permissions
  advanced_reporting: [
    'reports:advanced',
    'reports:custom',
    'reports:export',
    'analytics:export'
  ],
  
  // Custom branding requires branding permissions
  custom_branding: [
    'branding:edit',
    'branding:logo',
    'branding:colors'
  ],
  
  // API access requires API-related permissions
  api_access: [
    'api:access',
    'api:tokens',
    'webhooks:manage'
  ],
  
  // SSO requires SSO configuration permissions
  sso: [
    'sso:configure',
    'sso:manage'
  ],
  
  // White label requires white label permissions
  white_label: [
    'white-label:enable',
    'white-label:configure'
  ],
  
  // Priority support (doesn't restrict permissions, just service level)
  priority_support: [],
  
  // Automations require automation permissions
  automations: [
    'automations:create',
    'automations:edit',
    'automations:delete',
    'automations:view'
  ],
  
  // Integrations require integration permissions
  integrations: [
    'integrations:connect',
    'integrations:disconnect',
    'integrations:configure'
  ],
  
  // Team collaboration requires collaboration permissions
  team_collaboration: [
    'team:chat',
    'team:mentions',
    'team:share'
  ],
  
  // Time tracking requires time tracking permissions
  time_tracking: [
    'time-tracking:start',
    'time-tracking:stop',
    'time-tracking:edit',
    'time-tracking:view',
    'time-tracking:reports'
  ]
};

/**
 * Get effective permissions for a user, filtered by subscription features
 * 
 * Algorithm:
 * 1. Check if test account → return all permissions
 * 2. Get base permissions from role
 * 3. Filter out permissions requiring unavailable features
 * 4. Return filtered set of effective permissions
 */
export async function getEffectivePermissions(
  userId: string,
  roleId: string,
  organizationId: string | null
): Promise<Permission[]> {
  // Platform admins (no organization) get all permissions
  if (organizationId === null) {
    const user = await storage.getUser(userId);
    if (!user) return [];
    
    const role = await storage.getRole(user.roleId);
    if (role?.scope === 'platform') {
      console.info('[RBAC Bridge] Platform admin bypass - all permissions granted', { userId });
      return await storage.getPermissionsByRole(roleId);
    }
  }

  // Regular users must have organization
  if (!organizationId) {
    console.warn('[RBAC Bridge] No organization for user', { userId });
    return [];
  }

  // Check if test account (unlimited access)
  const organization = await storage.getOrganization(organizationId);
  if (organization?.isTestAccount) {
    console.info('[RBAC Bridge] Test account bypass - all permissions granted', {
      userId,
      organizationId
    });
    return await storage.getPermissionsByRole(roleId);
  }

  // Get base permissions from role
  const basePermissions = await storage.getPermissionsByRole(roleId);
  
  // Filter permissions based on subscription features
  const effectivePermissions: Permission[] = [];
  
  for (const permission of basePermissions) {
    // Check if permission requires a subscription feature
    let requiresFeature = false;
    let requiredFeature: FeatureIdentifier | null = null;
    
    // Check each feature's permission patterns
    for (const [feature, patterns] of Object.entries(FEATURE_PERMISSION_MAP)) {
      if (patterns.some(pattern => permission.name.startsWith(pattern.replace(':*', '')))) {
        requiresFeature = true;
        requiredFeature = feature as FeatureIdentifier;
        break;
      }
    }
    
    if (!requiresFeature) {
      // Permission doesn't require subscription feature - include it
      effectivePermissions.push(permission);
    } else if (requiredFeature) {
      // Check if organization has access to the required feature
      const hasAccess = await hasFeatureAccess(organizationId, requiredFeature);
      
      if (hasAccess) {
        effectivePermissions.push(permission);
      } else {
        // TELEMETRY: Permission filtered due to missing feature
        console.info('[RBAC Bridge] Permission filtered - feature not available', {
          userId,
          organizationId,
          permission: permission.name,
          requiredFeature
        });
      }
    }
  }
  
  // TELEMETRY: Log filtering results
  if (effectivePermissions.length < basePermissions.length) {
    console.info('[RBAC Bridge] Permissions filtered by subscription', {
      userId,
      organizationId,
      baseCount: basePermissions.length,
      effectiveCount: effectivePermissions.length,
      filtered: basePermissions.length - effectivePermissions.length
    });
  }
  
  return effectivePermissions;
}

/**
 * Check if user has effective permission (subscription-aware)
 */
export async function hasEffectivePermission(
  userId: string,
  roleId: string,
  organizationId: string | null,
  permissionName: string
): Promise<boolean> {
  const effectivePermissions = await getEffectivePermissions(userId, roleId, organizationId);
  return effectivePermissions.some(p => p.name === permissionName);
}
