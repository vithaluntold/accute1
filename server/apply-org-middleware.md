# Organization Middleware Application Guide

## Overview
The `requireAuthWithOrg` composed middleware provides defense-in-depth for multi-tenant routes.

## Usage Pattern

```typescript
import { requireAuthWithOrg } from "./routes";

// Single middleware
app.get("/api/clients", requireAuthWithOrg, async (req, res) => {
  // req.organizationId is validated and injected
  const clients = await db.query.clients.findMany({
    where: eq(schema.clients.organizationId, req.organizationId)
  });
  res.json(clients);
});

// With additional middleware
app.post("/api/documents", 
  requireAuthWithOrg, 
  requirePermission("documents.create"),
  upload.single('file'),
  async (req, res) => {
    // Implementation
  }
);
```

## Global Application (Recommended)

Add to server/routes.ts after route registration:

```typescript
// Apply organization scope enforcement globally to all authenticated routes
app.use('/api/*', enforceOrganizationScope);
```

## Critical Routes Requiring Middleware

### Already Protected by RLS (Database Level)
- All 87 multi-tenant tables automatically filter by organization_id
- RLS provides primary defense even if middleware is missing

### Recommended for Application-Level Defense
Apply `requireAuthWithOrg` to:
- `/api/clients/*` - Client management
- `/api/documents/*` - Document operations
- `/api/workflows/*` - Workflow management
- `/api/invoices/*` - Financial data
- `/api/ai-agent/*` - AI conversations
- `/api/projects/*` - Project management

## Middleware Chain Order

Correct order:
1. `requireAuth` (validates JWT, sets req.user)
2. `enforceOrganizationScope` (validates org membership)
3. `requirePermission` (checks RBAC permissions)
4. Route handler

Note: `requireAuthWithOrg = [requireAuth, enforceOrganizationScope]`

## Verification

```bash
# Search for routes that should use requireAuthWithOrg
grep -n "app\.\(get\|post\|put\|delete\).*requireAuth[^W]" server/routes.ts | head -20
```

