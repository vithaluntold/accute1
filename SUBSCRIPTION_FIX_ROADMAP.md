# 🚨 Subscription & Add-On Implementation Gap Analysis

**Status**: CRITICAL - Add-ons purchased but never applied  
**Impact**: Organizations pay for features they cannot use  
**Date**: November 2025

---

## 🔍 Problem Statement

The subscription system has a **critical implementation gap**: When organizations purchase add-ons (extra storage, API access, priority support), these add-ons are stored in the database but **completely ignored** by the feature gating and RBAC systems.

### Current Broken Flow:

```
Admin purchases "API Access" add-on
         ↓
Add-on saved to subscription_addons table ✅
         ↓
Feature gating checks subscription
         ↓
hasFeatureAccess(orgId, 'api_access')
         ↓
Returns FALSE ❌ (only checks base plan, ignores add-ons)
         ↓
Organization CANNOT use API despite paying for it
```

---

## 📊 Gap Analysis

### What EXISTS ✅

| Component | Status | Location |
|-----------|--------|----------|
| **Database Schema** | ✅ Complete | `shared/schema.ts` |
| - `subscriptionPlans` | ✅ | Plans with features & limits |
| - `planAddons` | ✅ | Available add-ons |
| - `subscriptionAddons` | ✅ | Purchased add-ons |
| **Feature Gating Middleware** | ⚠️ Partial | `server/feature-gating.ts` |
| - `hasFeatureAccess()` | ❌ Ignores add-ons | Only checks plan |
| - `checkResourceLimit()` | ❌ Ignores add-ons | Only checks plan limits |
| - `getOrganizationEntitlements()` | ❌ Ignores add-ons | Only returns plan data |
| **RBAC System** | ⚠️ Static | `server/auth.ts` |
| - Role permissions | ✅ Works | But not subscription-aware |
| **Frontend Hooks** | ⚠️ Partial | `client/src/hooks/use-subscription.ts` |
| - `useFeatureAccess()` | ❌ Ignores add-ons | Gets data from broken backend |

### What's MISSING ❌

1. **Storage methods** to retrieve active add-ons for an organization
2. **Feature aggregation** logic to merge plan + add-on features
3. **Limit aggregation** logic to add add-on increases to plan limits
4. **RBAC integration** to grant permissions based on subscription features
5. **Dynamic permission updates** when subscription changes

---

## 🏗️ Architecture Fix Required

### Current (Broken) Architecture

```
┌────────────────────────────────────────────────┐
│  Feature Gating System                         │
│  ┌─────────────────────────────┐              │
│  │ hasFeatureAccess(orgId, f)  │              │
│  └──────────────┬──────────────┘              │
│                 │                              │
│                 ▼                              │
│  ┌──────────────────────────────┐             │
│  │ Get active subscription      │             │
│  │ (platformSubscriptions)      │             │
│  └──────────────┬───────────────┘             │
│                 │                              │
│                 ▼                              │
│  ┌──────────────────────────────┐             │
│  │ Get plan features            │             │
│  │ (subscriptionPlans.features) │             │
│  └──────────────┬───────────────┘             │
│                 │                              │
│                 ▼                              │
│      ❌ STOP HERE - Never checks add-ons!     │
│                                                │
│  subscriptionAddons table = IGNORED            │
└────────────────────────────────────────────────┘
```

### Fixed Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Enhanced Feature Gating System                            │
│  ┌─────────────────────────────┐                          │
│  │ hasFeatureAccess(orgId, f)  │                          │
│  └──────────────┬──────────────┘                          │
│                 │                                          │
│                 ▼                                          │
│  ┌──────────────────────────────────────────┐             │
│  │ getEnhancedEntitlements(orgId)           │             │
│  │  1. Get active subscription              │             │
│  │  2. Get plan features & limits           │             │
│  │  3. Get active add-ons ✅ NEW            │             │
│  │  4. Merge features                       │             │
│  │  5. Aggregate limits                     │             │
│  └──────────────┬───────────────────────────┘             │
│                 │                                          │
│                 ▼                                          │
│  ┌──────────────────────────────────────────┐             │
│  │ Combined Features:                       │             │
│  │ [plan features] + [addon features]       │             │
│  │                                          │             │
│  │ Combined Limits:                         │             │
│  │ plan.maxUsers + addon.additionalUsers    │             │
│  │ plan.maxStorage + addon.additionalStorage│             │
│  └──────────────────────────────────────────┘             │
│                                                            │
│  ✅ Accurate feature access & limit checks                │
└────────────────────────────────────────────────────────────┘
```

---

## 🔧 Required Implementation

### Phase 1: Storage Layer Enhancement

**File**: `server/storage.ts`

#### New Methods Needed:

```typescript
// Get all active add-ons for a subscription
async getSubscriptionAddonsBySubscription(
  subscriptionId: string
): Promise<Array<{
  addon: SubscriptionAddon;
  details: PlanAddon;
}>> {
  // Join subscriptionAddons + planAddons
  // Filter: status = 'active'
  // Return addon purchase + full add-on details
}

// Get active add-ons for an organization (convenience method)
async getActiveAddonsForOrganization(
  organizationId: string
): Promise<Array<{
  addon: SubscriptionAddon;
  details: PlanAddon;
}>> {
  // Get active subscription
  // Get add-ons for that subscription
}

// Get aggregated features (plan + add-ons)
async getOrganizationFeatures(
  organizationId: string
): Promise<FeatureIdentifier[]> {
  // Get plan features
  // Get add-on features
  // Merge and deduplicate
}

// Get aggregated limits (plan + add-on boosts)
async getOrganizationLimits(
  organizationId: string
): Promise<{
  maxUsers: number;
  maxClients: number;
  maxStorage: number;
  maxWorkflows: number;
  maxAIAgents: number;
}> {
  // Get plan limits
  // Add add-on increases
  // Return totals
}
```

---

### Phase 2: Feature Gating Enhancement

**File**: `server/feature-gating.ts`

#### Update `hasFeatureAccess()`:

```typescript
export async function hasFeatureAccess(
  organizationId: string,
  feature: FeatureIdentifier
): Promise<boolean> {
  // Get base subscription
  const subscription = await storage.getActiveSubscriptionByOrganization(organizationId);
  
  if (!subscription) {
    // Free tier
    return FREE_TIER_ENTITLEMENTS.features.includes(feature);
  }

  // ✅ NEW: Get plan features
  let features: FeatureIdentifier[] = [];
  if (subscription.planId) {
    const plan = await storage.getSubscriptionPlan(subscription.planId);
    if (plan && plan.features) {
      features = plan.features as FeatureIdentifier[];
    }
  }

  // ✅ NEW: Get add-on features
  const addons = await storage.getActiveAddonsForOrganization(organizationId);
  for (const { details } of addons) {
    if (details.features) {
      const addonFeatures = details.features as FeatureIdentifier[];
      features = [...features, ...addonFeatures];
    }
  }

  // Deduplicate
  const uniqueFeatures = [...new Set(features)];
  
  return uniqueFeatures.includes(feature);
}
```

#### Update `checkResourceLimit()`:

```typescript
export async function checkResourceLimit(
  organizationId: string,
  resource: ResourceLimit,
  requestedAmount: number = 1
): Promise<{ allowed: boolean; limit: number; current: number; available: number }> {
  const subscription = await storage.getActiveSubscriptionByOrganization(organizationId);
  
  // Get base limit from plan
  let baseLimit = 0;
  if (subscription && subscription.planId) {
    const plan = await storage.getSubscriptionPlan(subscription.planId);
    if (plan) {
      baseLimit = plan[resource] || 0;
    }
  } else {
    // Free tier
    baseLimit = FREE_TIER_ENTITLEMENTS.limits[resource].limit;
  }

  // ✅ NEW: Add add-on increases
  let addonIncrease = 0;
  if (subscription) {
    const addons = await storage.getActiveAddonsForOrganization(organizationId);
    for (const { details } of addons) {
      switch (resource) {
        case 'maxUsers':
          addonIncrease += details.additionalUsers || 0;
          break;
        case 'maxClients':
          addonIncrease += details.additionalClients || 0;
          break;
        case 'maxStorage':
          addonIncrease += details.additionalStorage || 0;
          break;
        case 'maxWorkflows':
          addonIncrease += details.additionalWorkflows || 0;
          break;
        // Note: additionalAIAgents not in schema, may need to add
      }
    }
  }

  // ✅ NEW: Total limit = base + add-ons
  const totalLimit = baseLimit + addonIncrease;

  // Get current usage
  const usage = await UsageTrackingService.getOrganizationUsage(organizationId);
  const current = usage[resource] || 0;
  
  const available = Math.max(0, totalLimit - current);
  const allowed = current + requestedAmount <= totalLimit;
  
  return {
    allowed,
    limit: totalLimit,
    current,
    available
  };
}
```

#### Update `getOrganizationEntitlements()`:

```typescript
export async function getOrganizationEntitlements(
  organizationId: string
): Promise<SubscriptionEntitlements> {
  const subscription = await storage.getActiveSubscriptionByOrganization(organizationId);
  
  if (!subscription) {
    // Free tier (unchanged)
    const usage = await UsageTrackingService.getOrganizationUsage(organizationId);
    return normalizeEntitlements({
      plan: 'free',
      features: FREE_TIER_ENTITLEMENTS.features,
      rawLimits: FREE_TIER_ENTITLEMENTS.limits,
      usage
    });
  }

  // ✅ NEW: Get plan features
  let features: FeatureIdentifier[] = [];
  let baseLimits = {
    maxUsers: 0,
    maxClients: 0,
    maxStorage: 0,
    maxWorkflows: 0,
    maxAIAgents: 0
  };

  if (subscription.planId) {
    const plan = await storage.getSubscriptionPlan(subscription.planId);
    if (plan) {
      features = (plan.features as FeatureIdentifier[]) || [];
      baseLimits = {
        maxUsers: plan.maxUsers || 0,
        maxClients: plan.maxClients || 0,
        maxStorage: plan.maxStorage || 0,
        maxWorkflows: plan.maxWorkflows || 0,
        maxAIAgents: plan.maxAIAgents || 0
      };
    }
  }

  // ✅ NEW: Merge add-on features and limits
  const addons = await storage.getActiveAddonsForOrganization(organizationId);
  for (const { details } of addons) {
    // Add features
    if (details.features) {
      const addonFeatures = details.features as FeatureIdentifier[];
      features = [...features, ...addonFeatures];
    }
    
    // Add limit increases
    baseLimits.maxUsers += details.additionalUsers || 0;
    baseLimits.maxClients += details.additionalClients || 0;
    baseLimits.maxStorage += details.additionalStorage || 0;
    baseLimits.maxWorkflows += details.additionalWorkflows || 0;
    // Note: May need to add additionalAIAgents to schema
  }

  // Deduplicate features
  const uniqueFeatures = [...new Set(features)];

  const usage = await UsageTrackingService.getOrganizationUsage(organizationId);
  
  return normalizeEntitlements({
    plan: subscription.plan,
    features: uniqueFeatures,
    rawLimits: baseLimits,
    usage
  });
}
```

---

### Phase 3: RBAC Dynamic Permission Integration

**Problem**: Currently, permissions are static mappings in `shared/accessControl.ts`. They don't change based on subscription features.

**Solution**: Create a dynamic permission resolver that grants additional permissions when features are enabled.

#### Feature → Permission Mapping

**File**: `server/rbac-subscription-bridge.ts` (NEW FILE)

```typescript
import { FeatureIdentifier } from '@shared/subscription-types';

/**
 * Map subscription features to additional permissions
 */
export const FEATURE_PERMISSION_GRANTS: Record<FeatureIdentifier, string[]> = {
  'api_access': [
    'api_keys.create',
    'api_keys.read',
    'api_keys.update',
    'api_keys.delete',
    'webhooks.create',
    'webhooks.read'
  ],
  'signatures': [
    'signatures.create',
    'signatures.read',
    'signatures.verify'
  ],
  'analytics': [
    'analytics.read',
    'reports.advanced'
  ],
  'advanced_reporting': [
    'reports.custom',
    'reports.export',
    'reports.schedule'
  ],
  'custom_workflows': [
    'workflows.create_custom',
    'workflows.templates'
  ],
  'automations': [
    'automations.create',
    'automations.read',
    'automations.update',
    'automations.delete'
  ],
  'integrations': [
    'integrations.connect',
    'integrations.configure'
  ],
  'ai_agents': [
    'ai_agents.use',
    'ai_agents.configure'
  ],
  'sso': [
    'sso.configure',
    'saml.manage'
  ],
  'white_label': [
    'branding.customize',
    'branding.domain'
  ],
  'priority_support': [
    'support.priority_queue',
    'support.sla'
  ],
  'team_collaboration': [
    'mentions.create',
    'comments.create'
  ],
  'time_tracking': [
    'time_entries.create',
    'time_entries.report'
  ],
  // Features that don't grant specific permissions (just enable UI features)
  'workflows': [],
  'custom_branding': [],
  'document_management': [],
  'client_portal': []
};

/**
 * Get effective permissions for a user based on role + subscription
 */
export async function getEffectivePermissions(
  userId: string,
  roleId: string,
  organizationId: string | null
): Promise<string[]> {
  // 1. Get base role permissions
  const role = await storage.getRole(roleId);
  if (!role) return [];
  
  const rolePermissions = await storage.getRolePermissions(roleId);
  let allPermissions = rolePermissions.map(p => p.permission);
  
  // Platform admins get everything
  if (role.scope === 'platform' && organizationId === null) {
    return ['*']; // Wildcard = all permissions
  }
  
  // 2. Get subscription features
  if (organizationId) {
    const entitlements = await getOrganizationEntitlements(organizationId);
    
    // 3. Grant permissions for each enabled feature
    for (const feature of entitlements.features) {
      const grantedPermissions = FEATURE_PERMISSION_GRANTS[feature] || [];
      allPermissions = [...allPermissions, ...grantedPermissions];
    }
  }
  
  // 4. Deduplicate
  return [...new Set(allPermissions)];
}
```

#### Update Auth Middleware

**File**: `server/auth.ts`

```typescript
// Update requirePermission middleware
export function requirePermission(permission: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // ✅ NEW: Get effective permissions (role + subscription)
    const effectivePermissions = await getEffectivePermissions(
      req.user.id,
      req.user.roleId,
      req.user.organizationId
    );

    // Check wildcard (platform admin)
    if (effectivePermissions.includes('*')) {
      return next();
    }

    // Check specific permission
    if (effectivePermissions.includes(permission)) {
      return next();
    }

    // Denied
    await logActivity(
      req.user.id,
      req.user.organizationId,
      'permission_denied',
      'rbac',
      permission,
      { permission, effectivePermissions: effectivePermissions.length },
      req
    );

    return res.status(403).json({ 
      error: 'Insufficient permissions',
      required: permission
    });
  };
}
```

---

### Phase 4: Frontend Integration

**File**: `client/src/hooks/use-subscription.ts`

The frontend hooks already exist, but they need to receive the corrected data from the backend. Once the backend `getOrganizationEntitlements()` correctly includes add-ons, the frontend will automatically work.

**No frontend changes required** - the backend fix propagates automatically through the API.

---

## 📋 Implementation Checklist

### ✅ Phase 1: Storage Layer (Estimated: 4 hours)

- [ ] Add `getSubscriptionAddonsBySubscription()` method
- [ ] Add `getActiveAddonsForOrganization()` method  
- [ ] Add tests for add-on retrieval
- [ ] Verify add-on data structure includes all fields

### ✅ Phase 2: Feature Gating (Estimated: 6 hours)

- [ ] Update `hasFeatureAccess()` to include add-on features
- [ ] Update `checkResourceLimit()` to include add-on limit increases
- [ ] Update `getOrganizationEntitlements()` to merge plan + add-ons
- [ ] Add telemetry logging for add-on feature grants
- [ ] Add unit tests for add-on feature scenarios
- [ ] Test with multiple add-ons per organization

### ✅ Phase 3: RBAC Integration (Estimated: 8 hours)

- [ ] Create `server/rbac-subscription-bridge.ts`
- [ ] Define `FEATURE_PERMISSION_GRANTS` mapping
- [ ] Implement `getEffectivePermissions()` function
- [ ] Update `requirePermission()` middleware in `server/auth.ts`
- [ ] Update user context endpoint to return effective permissions
- [ ] Add audit logging for subscription-based permission grants
- [ ] Test permission changes when add-ons are added/removed

### ✅ Phase 4: Schema Updates (Estimated: 2 hours)

- [ ] Add `additionalAIAgents` field to `planAddons` table (if needed)
- [ ] Run `npm run db:push --force` to sync schema
- [ ] Verify all add-on limit fields exist

### ✅ Phase 5: Testing (Estimated: 8 hours)

#### Unit Tests
- [ ] Test feature access with 0 add-ons
- [ ] Test feature access with 1 add-on
- [ ] Test feature access with multiple add-ons
- [ ] Test limit checks with add-on increases
- [ ] Test permission grants from features

#### Integration Tests
- [ ] Create organization with base plan (no add-ons)
- [ ] Verify limited features
- [ ] Purchase "API Access" add-on
- [ ] Verify `api_access` feature enabled
- [ ] Verify API key creation allowed
- [ ] Cancel add-on
- [ ] Verify feature disabled again

#### E2E Tests
- [ ] Admin purchases "Extra Storage +50GB"
- [ ] Verify `maxStorage` limit increased
- [ ] Upload files up to new limit
- [ ] Verify cannot exceed new limit
- [ ] Check billing reflects add-on charge

### ✅ Phase 6: Documentation (Estimated: 2 hours)

- [ ] Update `replit.md` with add-on integration details
- [ ] Document feature → permission mapping
- [ ] Add troubleshooting guide for subscription issues
- [ ] Create admin guide for managing add-ons

---

## 🎯 Success Criteria

After implementation, the following should work:

### Scenario 1: API Access Add-On

```
1. Organization on "Starter" plan (no API access)
2. Admin purchases "API Access" add-on ($50/month)
3. ✅ hasFeatureAccess(orgId, 'api_access') returns TRUE
4. ✅ User can create API keys
5. ✅ API endpoints become accessible
6. ✅ Admin sees "API Keys" menu in sidebar
```

### Scenario 2: Extra Storage Add-On

```
1. Organization on "Professional" plan (100GB storage)
2. Admin purchases "Extra Storage +50GB" add-on
3. ✅ maxStorage limit = 150GB (100 + 50)
4. ✅ Can upload files up to 150GB
5. ✅ Storage meter shows 150GB limit
6. ✅ Blocks uploads at 150GB, not 100GB
```

### Scenario 3: Multiple Add-Ons

```
1. Organization on "Free" plan
2. Admin purchases:
   - "Priority Support" ($25/month)
   - "Extra Users +10" ($50/month)
   - "Advanced Reporting" ($30/month)
3. ✅ All 3 add-on features enabled
4. ✅ maxUsers = 5 (free) + 10 (addon) = 15
5. ✅ Can access priority support chat
6. ✅ Can generate advanced reports
```

---

## ⚠️ Critical Edge Cases

### 1. Add-On Expiration

**Scenario**: Add-on subscription expires

```typescript
// subscriptionAddons.status changes to 'expired'
// Feature gating must IMMEDIATELY revoke access
// User should see upgrade prompt
```

**Implementation**: 
- Add cron job to check expiring add-ons
- Set `status = 'expired'` when `currentPeriodEnd` passes
- Feature gating filters by `status = 'active'`

### 2. Plan Downgrade with Add-Ons

**Scenario**: Organization downgrades from Professional to Starter, but has add-ons

```
Professional plan: 50 users, 500GB storage
Add-on: +20 users

Downgrades to Starter: 10 users, 100GB storage
Add-on still active: +20 users

New limits: 10 + 20 = 30 users ✅
```

**Implementation**: Add-ons should stack on TOP of any plan, even if user downgrades.

### 3. Conflicting Features

**Scenario**: Plan includes feature, add-on also includes same feature

```
Plan features: ['workflows', 'ai_agents']
Add-on features: ['ai_agents', 'signatures']

Merged features: ['workflows', 'ai_agents', 'signatures']
✅ Deduplication handles this
```

### 4. Add-On Removal Mid-Billing Cycle

**Scenario**: User cancels add-on on day 15 of 30-day cycle

```
Option A: Immediate revocation (strict)
Option B: Grace period until end of billing cycle (customer-friendly)
```

**Recommendation**: Use Option B with `cancelledAt` field. Keep add-on active until `currentPeriodEnd`.

---

## 🔒 Security Considerations

### 1. Permission Escalation Prevention

```typescript
// WRONG: Allow users to modify their own add-ons
app.post('/api/subscription/addons', requireAuth, async (req, res) => {
  // ❌ User could grant themselves any feature
});

// RIGHT: Only super admin or payment gateway webhooks
app.post('/api/subscription/addons', requirePlatform, async (req, res) => {
  // ✅ Restricted to platform admins
});
```

### 2. Feature Gate Bypass Attempts

```typescript
// Attacker tries to access API without add-on
// Feature gating MUST check on EVERY request
app.get('/api/v1/data', requireFeature('api_access'), requirePermission('api.read'), getData);
// ✅ Two layers: feature gate + permission check
```

### 3. Audit Trail

```typescript
// Log all subscription changes
await logActivity(
  userId,
  organizationId,
  'addon_purchased',
  'subscription',
  addonId,
  {
    addonName: addon.name,
    price: addon.priceMonthly,
    features: addon.features,
    limits: {
      additionalUsers: addon.additionalUsers,
      additionalStorage: addon.additionalStorage
    }
  }
);
```

---

## 📈 Performance Considerations

### Caching Strategy

**Problem**: Calling `getOrganizationEntitlements()` on every request is expensive (3-4 DB queries).

**Solution**: Cache entitlements in memory with TTL.

```typescript
import NodeCache from 'node-cache';

const entitlementsCache = new NodeCache({ 
  stdTTL: 300, // 5 minutes
  checkperiod: 60 
});

export async function getCachedEntitlements(
  organizationId: string
): Promise<SubscriptionEntitlements> {
  const cacheKey = `entitlements:${organizationId}`;
  
  // Check cache first
  const cached = entitlementsCache.get<SubscriptionEntitlements>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Fetch from DB
  const entitlements = await getOrganizationEntitlements(organizationId);
  
  // Cache for 5 minutes
  entitlementsCache.set(cacheKey, entitlements);
  
  return entitlements;
}

// Invalidate cache when subscription changes
export function invalidateEntitlementsCache(organizationId: string): void {
  entitlementsCache.del(`entitlements:${organizationId}`);
}
```

**When to Invalidate**:
- Add-on purchased
- Add-on cancelled
- Plan upgraded/downgraded
- Subscription cancelled

---

## 🚀 Rollout Plan

### Phase 1: Backend Fix (Week 1)
- Day 1-2: Storage layer methods
- Day 3-4: Feature gating updates
- Day 5: Testing & validation

### Phase 2: RBAC Integration (Week 2)
- Day 1-2: Permission mapping
- Day 3-4: Middleware updates
- Day 5: Testing & validation

### Phase 3: Production Deployment (Week 3)
- Day 1: Deploy to staging
- Day 2-3: QA testing
- Day 4: Deploy to production
- Day 5: Monitor & fix issues

### Phase 4: Data Migration (Week 3)
- Audit existing add-on purchases
- Verify all are marked `status = 'active'`
- Send email to affected organizations: "Your purchased features are now active!"

---

## 📝 Example SQL to Verify Fix

### Before Fix:
```sql
-- Organization purchases API Access add-on
INSERT INTO subscription_addons (subscription_id, addon_id, quantity, status)
VALUES ('sub-123', 'addon-api-access', 1, 'active');

-- Check if feature is granted
SELECT * FROM subscription_plans 
WHERE id = (SELECT plan_id FROM platform_subscriptions WHERE id = 'sub-123');
-- features: ['workflows', 'ai_agents'] ❌ No api_access

-- Result: Organization CANNOT use API despite paying
```

### After Fix:
```sql
-- Same add-on purchase
INSERT INTO subscription_addons (subscription_id, addon_id, quantity, status)
VALUES ('sub-123', 'addon-api-access', 1, 'active');

-- Backend queries:
-- 1. Get plan features: ['workflows', 'ai_agents']
-- 2. Get add-on features: ['api_access']
-- 3. Merge: ['workflows', 'ai_agents', 'api_access'] ✅

-- Result: Organization CAN use API
```

---

## 🎓 Learning Points

### Why This Happened

1. **Schema first, logic later**: Database tables created before feature gating logic
2. **No integration tests**: Unit tests passed, but no E2E test covering "purchase add-on → use feature"
3. **Frontend-backend mismatch**: Frontend assumed backend would handle add-ons
4. **Missing requirements**: Initial spec didn't explicitly state "add-ons must grant features"

### How to Prevent

1. **Integration tests FIRST**: Write test "Purchase add-on → Access granted" before implementation
2. **E2E testing**: Test full user journey, not just individual functions
3. **Code reviews**: Check data flow from DB → API → Frontend
4. **Explicit documentation**: Document how each table relates to others

---

## 📞 Support & Rollback Plan

### If Things Break

**Rollback Strategy**:
```bash
# Revert to previous version
git revert <commit-hash>

# Or feature flag
ENABLE_ADDON_FEATURES=false npm run dev
```

**Emergency Contact**:
- Technical Lead: [Name]
- Database Admin: [Name]
- On-call Engineer: [Name]

### Monitoring Alerts

Set up alerts for:
- Feature access denials spike
- Permission errors increase
- Subscription query timeouts
- Cache hit rate drops

---

**Status**: Ready for Implementation  
**Estimated Total Time**: 30 hours (1 week sprint)  
**Risk Level**: Medium (database queries, caching, production impact)  
**Blocker**: None - All dependencies exist
