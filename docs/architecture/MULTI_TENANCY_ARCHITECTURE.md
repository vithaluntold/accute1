# Accute Multi-Tenancy & Access Control Architecture

## Overview
Accute uses a **3-tier access control system**: Organizations → Roles → Permissions

## Data Structure

### 1. Organizations (Multi-Tenant Isolation)
```
organizations
├── id (primary key)
├── name
├── slug
└── ... metadata
```

**Key Concept**: Almost ALL data in Accute is scoped to an organization via `organization_id` foreign key.

### 2. Users
```
users
├── id
├── email
├── organization_id  ← NULL for Super Admin, otherwise required
├── role_id         ← Points to roles table
└── ...
```

**User Types**:
- **Super Admin**: `organization_id = NULL` (platform-wide access)
- **Organization Users**: `organization_id = <specific org>` (scoped access)

### 3. Roles (4 System Roles)
```
roles
├── id
├── name ("Super Admin", "Admin", "Employee", "Client")
├── is_system_role
└── ...
```

### 4. Permissions
```
permissions
├── id
├── name (e.g., "settings.manage", "clients.delete")
├── resource
└── action
```

### 5. Role-Permission Mapping
```
role_permissions
├── role_id
└── permission_id
```

## Access Control Flow

### Authentication Flow
```
1. User logs in → JWT token issued
2. requireAuth middleware:
   - Validates JWT
   - Loads user from database
   - Attaches req.user (includes organizationId!)
```

### Permission Check Flow
```
1. requirePermission("settings.manage") middleware runs
2. Queries: SELECT permissions WHERE role_id = user.role_id
3. Checks if "settings.manage" exists in user's permissions
4. If yes → next(), if no → 403 Forbidden
```

### Data Isolation Flow
```
1. User authenticated ✅
2. Permission checked ✅  
3. Resource access check:
   - Fetch resource from database
   - Compare resource.organizationId === user.organizationId
   - If mismatch → 404 Not Found (for security - don't reveal existence)
```

## Current Database State

### Organizations
| ID | Name | Users |
|---|---|---|
| fc619bd5... | Sterling Accounting Firm | admin@sterling.com (Admin), employee@sterling.com, david@technova.com (Client) |
| 79f190d7... | Futurus FinACE Consulting | vithal@finacegroup.com (Admin) |
| 03cd6aab... | SWIFTAX PRO | (none yet) |
| fa952a8c... | BSTL Global Solutions | (none yet) |
| NULL | Platform | superadmin@accute.com (Super Admin) |

### LLM Configurations (Organization-Scoped)
| ID | Name | Provider | Organization | Default |
|---|---|---|---|---|
| 61ef3009... | Azure Main | azure | Sterling Accounting (fc619bd5...) | Yes |
| c59e9eeb... | Azure Main | azure | Futurus FinACE (79f190d7...) | Yes |

## Permission Assignments

### Super Admin (superadmin@accute.com)
- **ALL** permissions (no restrictions)
- `organizationId = NULL` (can access any organization's data)

### Admin Role (admin@sterling.com, vithal@finacegroup.com)
- **ALL** permissions EXCEPT:
  - ❌ `organizations.view` (cannot see other organizations)
  - ❌ `organizations.edit` (cannot modify organization settings)
- ✅ `settings.manage` (CAN manage LLM configurations)
- ✅ `clients.delete`, `users.delete`, `workflows.delete`, etc.
- **BUT**: Can only access resources within their own organization

### Employee Role
- Limited permissions (view documents, execute workflows, etc.)
- Cannot manage settings, users, or clients

### Client Role
- Minimal permissions (view documents only)

## The LLM Deletion Flow

When vithal@finacegroup.com tries to delete LLM config `c59e9eeb...`:

```
1. ✅ Authentication
   - User logged in
   - JWT valid
   - req.user.organizationId = "79f190d7..." (Futurus FinACE)

2. ✅ Permission Check (requirePermission("settings.manage"))
   - Admin role has "settings.manage" permission
   - Permission granted

3. ❓ Data Access Check
   DELETE /api/llm-configurations/c59e9eeb...
   
   Step A: Fetch existing config
   - organizationId: "79f190d7..." ✅
   
   Step B: Compare organizations
   - existing.organizationId (79f190d7...) 
   - user.organizationId (79f190d7...)
   - Match? ✅ YES
   
   Step C: Delete from database
   - ??? SOMETHING FAILS HERE → 500 Error
```

## Why It Might Be Failing

### Possible Causes:
1. **Database Constraint**: Foreign key constraint preventing deletion
2. **Encryption Service**: LLMConfigService cache clearing fails
3. **Activity Logging**: logActivity() throws error
4. **Permission Not Assigned**: Role-permission mapping missing in database

## Investigation Needed

With the detailed logging I just added, when vithal tries to delete again, we'll see:

```
🔐 [PERMISSION] User vithal@finacegroup.com checking for "settings.manage"
   Available permissions: [list of all permissions]
   Has permission: true/false  ← KEY DIAGNOSTIC
   
🔧 [LLM DELETE] User attempting to delete config...
🗑️  [LLM DELETE] Deleting config from org...
✅ [LLM DELETE] Successfully deleted
   OR
❌ [LLM DELETE] Failed: [exact error message]
```

## Global vs Organization Settings

### Global (Platform-Wide):
- System Roles
- System Permissions  
- AI Agent Marketplace (public agents)
- Product Catalog (SKUs, Plans)
- Coupons (platform-wide)

### Organization-Scoped:
- ✅ LLM Configurations (each org has their own)
- ✅ Users
- ✅ Clients
- ✅ Workflows
- ✅ Documents
- ✅ Invoices
- ✅ Payment Gateway Configs
- ✅ Service Plans
- ✅ Subscriptions (org subscribes to platform)

## Key Takeaway

**The system IS designed to let Admins delete LLM configurations within their own organization.**

The bug is NOT in the permissions system. Something else is blocking the actual delete operation. The detailed logs will reveal the exact error.
