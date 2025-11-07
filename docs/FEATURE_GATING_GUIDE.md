# Feature Gating & Subscription Management Guide

## Overview

Accute implements a comprehensive subscription-based feature gating system that controls access to features based on organization subscription plans. This system works alongside RBAC to provide multi-layered authorization.

## Architecture

### Backend Components

1. **Feature Gating Middleware** (`server/feature-gating.ts`)
   - `requireFeature(feature)` - Middleware to gate routes by feature
   - `requireResourceLimit(resource, amount)` - Middleware to enforce quotas
   - `hasFeatureAccess()` - Check if organization has feature access
   - `checkResourceLimit()` - Check resource usage vs limits

2. **Subscription Routes** (`server/subscription-routes.ts`)
   - `GET /api/subscription/entitlements` - Get user's plan features and limits

3. **Storage Methods** (`server/storage.ts`)
   - `getActiveSubscriptionByOrganization()` - Get active subscription
   - `getSubscriptionPlan()` - Get plan details including features array

### Frontend Components

1. **Hooks** (`client/src/hooks/use-subscription.ts`)
   - `useSubscription()` - Get full subscription data
   - `useFeatureAccess(feature)` - Check single feature access
   - `useResourceLimit(resource)` - Check resource usage
   - `useCanCreate(resource, amount)` - Check if can create more resources

2. **Components**
   - `<FeatureGate>` - Conditionally render based on feature access
   - `<FeatureLock>` - Show locked state for unavailable features
   - `<ResourceLimitBadge>` - Display quota usage with visual indicators

## Feature Identifiers

Available feature flags:

```typescript
type FeatureIdentifier = 
  | 'workflows'           // Workflow automation
  | 'ai_agents'           // AI agent installation
  | 'signatures'          // Digital signatures
  | 'analytics'           // Analytics dashboards
  | 'custom_branding'     // White label / custom branding
  | 'api_access'          // REST API access
  | 'sso'                 // Single Sign-On
  | 'advanced_reporting'  // Advanced reports
  | 'white_label'         // Complete white labeling
  | 'priority_support'    // Priority customer support
  | 'custom_workflows'    // Custom workflow builder
  | 'automations'         // Workflow automations
  | 'integrations'        // Third-party integrations
  | 'document_management' // Document storage
  | 'client_portal'       // Client portal access
  | 'team_collaboration'  // Team features
  | 'time_tracking';      // Time tracking
```

## Resource Limits

Available resource quotas:

```typescript
type ResourceLimit = 
  | 'maxUsers'      // Maximum team members
  | 'maxClients'    // Maximum clients
  | 'maxStorage'    // Storage in GB
  | 'maxWorkflows'  // Maximum workflows
  | 'maxAIAgents';  // Maximum AI agent installations
```

## Usage Examples

### Backend: Gating API Routes

```typescript
import { requireFeature, requireResourceLimit } from './feature-gating';

// Require specific feature access
app.get('/api/analytics/dashboard', 
  requireAuth, 
  requireFeature('analytics'),
  async (req: AuthRequest, res: Response) => {
    // Only accessible if organization has 'analytics' feature
    const data = await getAnalytics(req.user!.organizationId);
    res.json(data);
  }
);

// Enforce resource limits
app.post('/api/workflows', 
  requireAuth, 
  requireResourceLimit('maxWorkflows', 1), // Check if can create 1 more workflow
  async (req: AuthRequest, res: Response) => {
    // Only proceeds if within workflow limit
    const workflow = await storage.createWorkflow(req.body);
    res.json(workflow);
  }
);

// Combine with RBAC
app.post('/api/ai-agents/install',
  requireAuth,
  requirePermission('ai_agents.install'),  // RBAC check
  requireFeature('ai_agents'),             // Subscription check
  requireResourceLimit('maxAIAgents', 1),  // Quota check
  async (req: AuthRequest, res: Response) => {
    // Triple-gated: RBAC + Feature + Quota
    const installation = await installAgent(req.body);
    res.json(installation);
  }
);
```

### Frontend: Conditional Rendering

```tsx
import { FeatureGate, FeatureLock } from '@/components/feature-gate';
import { useFeatureAccess, useCanCreate } from '@/hooks/use-subscription';

// Hide entire sections
export function AnalyticsPage() {
  return (
    <FeatureGate feature="analytics">
      <AnalyticsDashboard />
    </FeatureGate>
    // Shows upgrade prompt if no access
  );
}

// Lock specific buttons
export function WorkflowActions() {
  return (
    <FeatureLock feature="custom_workflows">
      <Button>Create Custom Workflow</Button>
    </FeatureLock>
    // Shows lock icon if no access
  );
}

// Programmatic checks
export function CreateClientButton() {
  const { hasAccess } = useFeatureAccess('client_portal');
  const { canCreate, limit, current } = useCanCreate('maxClients');

  if (!hasAccess) {
    return <Badge>Upgrade to add clients</Badge>;
  }

  if (!canCreate) {
    return (
      <Tooltip content={`Client limit reached (${current}/${limit})`}>
        <Button disabled>Create Client</Button>
      </Tooltip>
    );
  }

  return <Button onClick={createClient}>Create Client</Button>;
}
```

### Frontend: Resource Usage Display

```tsx
import { ResourceLimitBadge } from '@/components/resource-limit-badge';
import { useResourceLimit } from '@/hooks/use-subscription';

export function SettingsBilling() {
  const { limit, current, percentage } = useResourceLimit('maxClients');

  return (
    <div>
      <h2>Usage & Limits</h2>
      
      {/* Simple badge */}
      <ResourceLimitBadge resource="maxUsers" />
      
      {/* Badge with progress bar */}
      <ResourceLimitBadge resource="maxClients" showProgress />
      
      {/* Custom display */}
      <div>
        <p>Clients: {current}/{limit}</p>
        <Progress value={percentage} />
        {percentage >= 80 && (
          <Alert>Consider upgrading to add more clients</Alert>
        )}
      </div>
    </div>
  );
}
```

## Subscription Plan Configuration

Plans are defined in the `subscription_plans` table:

```sql
INSERT INTO subscription_plans (name, slug, features, max_users, max_clients) VALUES
('Free', 'free', 
  '["workflows", "client_portal", "document_management"]',
  5, 10
),
('Professional', 'professional', 
  '["workflows", "ai_agents", "signatures", "analytics", "client_portal", "document_management", "team_collaboration"]',
  25, 100
),
('Enterprise', 'enterprise',
  '["workflows", "ai_agents", "signatures", "analytics", "custom_branding", "api_access", "sso", "advanced_reporting", "priority_support", "client_portal", "document_management", "team_collaboration", "integrations"]',
  999, 9999
);
```

## Authorization Hierarchy

For maximum security, combine all authorization layers:

1. **Authentication** (`requireAuth`) - Verify user identity
2. **RBAC** (`requirePermission`) - Check role-based permissions
3. **Feature Gating** (`requireFeature`) - Verify subscription access
4. **Resource Limits** (`requireResourceLimit`) - Enforce quotas

```typescript
app.post('/api/advanced-reports',
  requireAuth,                              // Layer 1: Authentication
  requirePermission('reports.create'),      // Layer 2: RBAC
  requireFeature('advanced_reporting'),     // Layer 3: Subscription
  requireResourceLimit('maxReports', 1),    // Layer 4: Quotas
  async (req: AuthRequest, res: Response) => {
    // Fully protected endpoint
  }
);
```

## Platform Admins

Platform admins (Super Admins with `organizationId = null`) bypass all feature gates and resource limits automatically.

## Error Responses

Feature gating returns specific error responses:

```json
// Feature not available
{
  "error": "Feature not available in your current plan",
  "feature": "ai_agents",
  "upgradeRequired": true
}

// Resource limit exceeded
{
  "error": "maxClients limit exceeded",
  "resource": "maxClients",
  "limit": 10,
  "current": 10,
  "available": 0,
  "upgradeRequired": true
}
```

## Testing

```typescript
// Test feature access
const hasAnalytics = await hasFeatureAccess(orgId, 'analytics');

// Test resource limits
const clientLimit = await checkResourceLimit(orgId, 'maxClients', 5);
console.log(clientLimit.allowed); // true/false
console.log(clientLimit.available); // remaining quota

// Test entitlements
const entitlements = await getOrganizationEntitlements(orgId);
console.log(entitlements.features); // Array of enabled features
console.log(entitlements.limits); // All resource limits
console.log(entitlements.usage); // Current usage
```

## Best Practices

1. **Always combine with RBAC** - Feature gates don't replace permission checks
2. **Check limits before mutations** - Prevent failed operations
3. **Show clear upgrade paths** - Guide users to upgrade when needed
4. **Fail open for errors** - Don't break the app if subscription check fails
5. **Cache entitlements** - Frontend hook caches for 5 minutes
6. **Test all tiers** - Verify features work across all subscription plans

## Migration from Non-Gated System

To add feature gating to existing routes:

```typescript
// Before
app.get('/api/analytics', requireAuth, getAnalytics);

// After
app.get('/api/analytics', 
  requireAuth, 
  requireFeature('analytics'),  // Add this
  getAnalytics
);
```

Update frontend components:

```tsx
// Before
<AnalyticsPage />

// After
<FeatureGate feature="analytics">
  <AnalyticsPage />
</FeatureGate>
```
