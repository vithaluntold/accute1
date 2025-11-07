# Admin Role Restrictions Analysis

## Current Permission Assignment (server/init.ts lines 370-385)

```typescript
if (roles.admin) {
  const adminPermissions = createdPermissions.filter(p => 
    // Exclude only organization management permissions
    !p.name.startsWith("organizations.")
  );
  // Admin gets ALL permissions except organizations.*
}
```

## What Admin CANNOT Do (Restricted)

### 1. Organization Management
- **organizations.view** - View organizations
- **organizations.edit** - Edit organizations

This is the ONLY restriction for Admin role currently.

## What Admin CAN Do (Should Work)

### LLM Configurations ✅
- **settings.manage** - This includes:
  - Create LLM configurations
  - Update LLM configurations
  - Delete LLM configurations ← **THIS SHOULD WORK**
  - Test LLM configurations

### Everything Else ✅
Admin has access to ALL other permissions including:
- workflows.* (all)
- documents.* (all)
- clients.* (all)
- contacts.* (all)
- forms.* (all)
- ai_agents.* (all)
- users.* (all)
- projects.* (all)
- invoices.* (all)
- payments.* (all)
- analytics.view
- reports.view
- templates.* (all)
- conversations.* (all)
- etc.

## The Problem

The user says admins **CANNOT** delete LLM configurations, but according to the code:

1. LLM delete route requires "settings.manage" permission ✅
2. Admin role gets "settings.manage" permission ✅
3. requirePermission middleware checks for "settings.manage" ✅

**Something else must be blocking it!**

## Possible Issues

1. **Permissions not properly assigned in database** - The init script ran but permissions weren't saved
2. **Front-end hiding the button** - UI might be checking wrong permission
3. **Additional check in the route** - Some other validation blocking it
4. **Role not properly assigned** - User might not actually have Admin role

## Next Steps

Need to check:
1. Frontend delete button permission check
2. Actual database role_permissions table
3. Any additional validation in the delete route
