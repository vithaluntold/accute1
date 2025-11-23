# Accute RBAC Features & Permissions Matrix

## Overview
Accute implements Role-Based Access Control (RBAC) with subscription-aware feature gating to ensure secure, compliant, and flexible access management across the platform.

## Permission Taxonomy & Naming Convention

### Standard Format
```
resource.operation[.scope]
```

**Examples:**
- `documents.view` - View documents
- `documents.view_own` - View only your own documents
- `documents.view_all` - View all organization documents
- `invoices.create` - Create invoices
- `payments.refund` - Process payment refunds

### Permission Hierarchy
Some permissions imply others through inheritance:
- `resource.manage` → implies `view`, `create`, `edit`, `delete`
- `resource.edit` → implies `view`
- `resource.delete` → implies `view`

## System Roles

### 1. Super Admin
- **Access Level**: Platform-wide, cross-organization
- **Permissions**: ALL (90+ permissions)
- **Use Case**: Platform administration, organization management, system configuration
- **Restrictions**: None

### 2. Admin
- **Access Level**: Organization-wide
- **Permissions**: All except `organizations.*` (80+ permissions)
- **Use Case**: Firm owners, practice managers, department heads
- **Restrictions**: Cannot create/delete organizations

### 3. Employee
- **Access Level**: Limited to assigned work
- **Permissions**: View-only + workflow execution (10-15 permissions)
- **Use Case**: Accountants, bookkeepers, tax preparers
- **Restrictions**: No team-wide visibility, no management functions

### 4. Client
- **Access Level**: Client portal only
- **Permissions**: Document access, form submissions, payments (5-10 permissions)
- **Use Case**: External clients accessing their data
- **Restrictions**: No admin functions, no team visibility

## Permission Categories

### 1. User & Team Management

#### Users
- `users.view` - View users in organization
- `users.create` - Create new users
- `users.edit` - Edit user profiles and settings
- `users.delete` - Delete users
- `users.invite` - Send user invitations

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ❌ Employee: NONE
- ❌ Client: NONE

#### Roles
- `roles.view` - View roles and permissions
- `roles.create` - Create custom roles
- `roles.edit` - Edit role permissions
- `roles.delete` - Delete custom roles

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ❌ Employee: NONE
- ❌ Client: NONE

#### Teams
- `teams.view` - View teams and hierarchy
- `teams.create` - Create teams
- `teams.update` - Update team membership
- `teams.delete` - Delete teams
- `teams.manage` - Manage hierarchical supervision

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ❌ Employee: NONE
- ❌ Client: NONE

### 2. Client & Contact Management

#### Clients
- `clients.view` - View client list and details
- `clients.create` - Create new clients
- `clients.edit` - Edit client information
- `clients.delete` - Delete clients

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ✅ Employee: view only
- ❌ Client: NONE

#### Contacts
- `contacts.view` - View client contacts
- `contacts.create` - Add new contacts
- `contacts.edit` - Edit contact information
- `contacts.delete` - Delete contacts

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ✅ Employee: view only
- ❌ Client: NONE

### 3. Workflow & Project Management

#### Workflows
- `workflows.view` - View all workflows (team-wide)
- `workflows.create` - Create workflow templates
- `workflows.edit` - Edit workflow definitions
- `workflows.delete` - Delete workflows
- `workflows.execute` - Execute assigned workflow tasks

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ✅ Employee: execute only (no team-wide view)
- ❌ Client: NONE

#### Projects
- `projects.view` - View projects
- `projects.create` - Create new projects
- `projects.update` - Update project details
- `projects.delete` - Delete projects

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ❌ Employee: NONE
- ❌ Client: NONE

#### Tasks
- `tasks.view` - View tasks
- `tasks.create` - Create tasks
- `tasks.update` - Update task status and details
- `tasks.delete` - Delete tasks

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ❌ Employee: NONE (see own via workflows.execute)
- ❌ Client: NONE (see own via client portal)

### 4. Document Management

#### Documents
- `documents.view` - View shared documents
- `documents.upload` - Upload documents
- `documents.delete` - Delete documents
- `documents.download` - Download documents
- **MISSING**: `documents.share` - Share documents with clients
- **MISSING**: `documents.sign` - Sign documents with PKI
- **MISSING**: `documents.verify` - Verify document signatures
- **MISSING**: `documents.version` - Manage document versions
- **MISSING**: `documents.approve` - Approve document versions

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ✅ Employee: view, upload
- ✅ Client: view, upload (own only)

#### Document Requests
- `documentRequests.view` - View document requests
- `documentRequests.create` - Create document requests
- `documentRequests.edit` - Edit document requests
- `documentRequests.delete` - Delete document requests
- `documentRequests.manage` - Manage document collection

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ❌ Employee: NONE
- ❌ Client: NONE (responds via portal)

#### Folders
- **MISSING**: `folders.view` - View folder structure
- **MISSING**: `folders.create` - Create folders
- **MISSING**: `folders.edit` - Rename/move folders
- **MISSING**: `folders.delete` - Delete folders
- **MISSING**: `folders.share` - Share folders with clients

### 5. Forms & Signatures

#### Forms
- `forms.view` - View forms
- `forms.create` - Create form templates
- `forms.edit` - Edit forms
- `forms.delete` - Delete forms
- `forms.publish` - Publish forms
- `forms.share` - Share forms with clients
- `forms.submit` - Submit form responses

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ✅ Employee: view only
- ✅ Client: submit only

#### Signatures
- `signatures.view` - View signature requests
- `signatures.create` - Create signature requests
- `signatures.sign` - Sign documents

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ❌ Employee: NONE
- ✅ Client: sign only (own requests)

### 6. Financial Management

#### Invoices
- `invoices.view` - View invoices
- `invoices.create` - Create invoices
- `invoices.update` - Update invoice details
- `invoices.delete` - Delete invoices
- **MISSING**: `invoices.send` - Send invoices to clients
- **MISSING**: `invoices.void` - Void invoices
- **MISSING**: `invoices.export` - Export invoice data

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ❌ Employee: NONE
- ❌ Client: NONE (view own via portal)

#### Payments
- `payments.view` - View payment records
- `payments.create` - Record payments
- `payments.update` - Update payment details
- **MISSING**: `payments.request` - Request payment from client
- **MISSING**: `payments.collect` - Access payment collection UI
- **MISSING**: `payments.refund` - Process refunds
- **MISSING**: `payments.reconcile` - Reconcile payments

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ❌ Employee: NONE
- ❌ Client: NONE (pay via portal)

#### Payment Gateways
- **MISSING**: `payment_gateways.view` - View configured gateways
- **MISSING**: `payment_gateways.create` - Add payment gateway
- **MISSING**: `payment_gateways.edit` - Update gateway credentials
- **MISSING**: `payment_gateways.delete` - Remove payment gateway
- **MISSING**: `payment_gateways.test` - Test gateway connection

### 7. Subscriptions & Marketplace

#### Subscriptions
- **MISSING**: `subscriptions.view` - View subscription plans
- **MISSING**: `subscriptions.create` - Create subscription plans
- **MISSING**: `subscriptions.edit` - Edit plan details
- **MISSING**: `subscriptions.delete` - Delete plans
- **MISSING**: `subscriptions.manage` - Manage organization subscription
- **MISSING**: `subscriptions.billing` - Access billing details

#### Service Plans
- **MISSING**: `service_plans.view` - View service marketplace
- **MISSING**: `service_plans.create` - Create service offerings
- **MISSING**: `service_plans.edit` - Edit service plans
- **MISSING**: `service_plans.delete` - Delete service plans
- **MISSING**: `service_plans.purchase` - Purchase services (client)

#### Add-ons
- **MISSING**: `addons.view` - View available add-ons
- **MISSING**: `addons.purchase` - Purchase add-ons
- **MISSING**: `addons.manage` - Manage add-on subscriptions

### 8. AI & Automation

#### AI Agents
- `ai_agents.view` - View AI agent marketplace
- `ai_agents.install` - Install AI agents
- `ai_agents.configure` - Configure agent settings
- `ai_agents.create` - Create custom agents
- **MISSING**: `ai_agents.uninstall` - Uninstall agents
- **MISSING**: `ai_agents.execute` - Execute agent tasks

#### Roundtable
- `roundtable.access` - Access AI Roundtable
- `roundtable.create` - Create Roundtable sessions
- `roundtable.manage` - Manage sessions

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ✅ Employee: view only
- ❌ Client: NONE

#### Automation
- **MISSING**: `automation.view` - View automation rules
- **MISSING**: `automation.create` - Create automation rules
- **MISSING**: `automation.edit` - Edit automation rules
- **MISSING**: `automation.delete` - Delete automation rules
- **MISSING**: `automation.execute` - Manually trigger automations

#### Recurring Schedules
- **MISSING**: `schedules.view` - View recurring schedules
- **MISSING**: `schedules.create` - Create recurring schedules
- **MISSING**: `schedules.edit` - Edit schedule frequency
- **MISSING**: `schedules.delete` - Delete schedules

### 9. Communication

#### Conversations/Messages
- `conversations.view` - View conversations
- `conversations.create` - Create conversations
- `conversations.send` - Send messages

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ❌ Employee: NONE
- ❌ Client: NONE

#### Team Chat
- `chat.view` - View team chat
- `chat.create` - Create chat channels
- `chat.send` - Send chat messages

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ❌ Employee: NONE
- ❌ Client: NONE

#### Email Integration
- **MISSING**: `email.view` - View connected email accounts
- **MISSING**: `email.connect` - Connect email account (OAuth)
- **MISSING**: `email.disconnect` - Disconnect email account
- **MISSING**: `email.send` - Send emails via integration

#### Unified Inbox
- **MISSING**: `inbox.view` - View unified inbox
- **MISSING**: `inbox.manage` - Manage inbox filters
- **MISSING**: `inbox.archive` - Archive conversations

### 10. Client Portal Features

#### Action Center
- **MISSING**: `action_center.view` - View action center dashboard
- **MISSING**: `action_center.filter` - Filter by responsibility

#### Notifications
- **MISSING**: `notifications.view` - View notifications
- **MISSING**: `notifications.create` - Create notifications (system)
- **MISSING**: `notifications.read` - Mark as read
- **MISSING**: `notifications.delete` - Delete notifications

#### Client Portal Access
- **MISSING**: `client_portal.access` - Access client portal
- **MISSING**: `client_portal.view_documents` - View shared documents
- **MISSING**: `client_portal.upload_documents` - Upload documents
- **MISSING**: `client_portal.view_tasks` - View assigned tasks
- **MISSING**: `client_portal.submit_forms` - Submit forms
- **MISSING**: `client_portal.pay_invoices` - Pay invoices
- **MISSING**: `client_portal.chat` - Chat with team

### 11. Analytics & Reporting

#### Analytics
- `analytics.view` - View practice analytics dashboard

#### Reports
- `reports.view` - View practice-wide reports
- **MISSING**: `reports.create` - Create custom reports
- **MISSING**: `reports.export` - Export report data
- **MISSING**: `reports.schedule` - Schedule recurring reports

#### Workload View
- **MISSING**: `workload.view` - View team workload
- **MISSING**: `workload.assign` - Assign capacity

#### Timeline View
- **MISSING**: `timeline.view` - View project timelines
- **MISSING**: `timeline.create_milestone` - Create milestones

#### Gantt Chart
- **MISSING**: `gantt.view` - View Gantt charts
- **MISSING**: `gantt.edit` - Edit task schedules

### 12. Time Tracking

#### Time Entries
- `timeEntries.view` - View time entries
- `timeEntries.create` - Create time entries
- `timeEntries.update` - Update time entries
- `timeEntries.delete` - Delete time entries
- **MISSING**: `timeEntries.approve` - Approve time entries
- **MISSING**: `timeEntries.export` - Export time data

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ❌ Employee: NONE
- ❌ Client: NONE

### 13. Settings & Configuration

#### Organization Settings
- `organizations.view` - View organization details
- `organizations.edit` - Edit organization settings
- **MISSING**: `organizations.delete` - Delete organization (Super Admin only)

#### General Settings
- `settings.manage` - Manage organization settings
- **MISSING**: `settings.view` - View settings
- **MISSING**: `settings.billing` - Manage billing settings
- **MISSING**: `settings.integrations` - Manage integrations

#### LLM Configurations
- `settings.manage` - (Currently covers LLM configs)
- **MISSING**: `llm_configs.view` - View LLM configurations
- **MISSING**: `llm_configs.create` - Create LLM configurations
- **MISSING**: `llm_configs.edit` - Edit LLM credentials
- **MISSING**: `llm_configs.delete` - Delete LLM configurations
- **MISSING**: `llm_configs.test` - Test LLM connections

#### MFA Management
- **MISSING**: `mfa.enable` - Enable MFA for account
- **MISSING**: `mfa.disable` - Disable MFA
- **MISSING**: `mfa.reset` - Reset MFA for users (Admin)
- **MISSING**: `mfa.enforce` - Enforce MFA org-wide (Admin)

#### Profile Management
- **MISSING**: `profile.view` - View own profile
- **MISSING**: `profile.edit` - Edit own profile
- **MISSING**: `profile.upload_avatar` - Upload profile picture
- **MISSING**: `profile.change_password` - Change password

### 14. Templates

#### Email Templates
- `templates.view` - View email templates
- `templates.create` - Create email templates
- `templates.update` - Update email templates
- `templates.delete` - Delete email templates

#### Workflow Templates
- (Covered by `workflows.*`)

#### Document Templates
- **MISSING**: `document_templates.view` - View document templates
- **MISSING**: `document_templates.create` - Create document templates
- **MISSING**: `document_templates.edit` - Edit templates
- **MISSING**: `document_templates.delete` - Delete templates

#### Form Templates
- (Covered by `forms.*`)

### 15. Tags & Organization

#### Tags
- `tags.view` - View tags
- `tags.create` - Create tags
- `tags.edit` - Edit tags
- `tags.delete` - Delete tags
- `tags.apply` - Apply tags to resources

**Role Coverage:**
- ✅ Super Admin: ALL
- ✅ Admin: ALL
- ✅ Employee: view only
- ❌ Client: NONE

### 16. Appointments & Calendar

#### Appointments
- `appointments.view` - View appointments
- `appointments.create` - Create appointments
- `appointments.update` - Update appointments
- `appointments.delete` - Delete appointments
- **MISSING**: `appointments.accept` - Accept appointment requests
- **MISSING**: `appointments.decline` - Decline appointments

#### Calendar
- **MISSING**: `calendar.view` - View calendar
- **MISSING**: `calendar.create_event` - Create calendar events
- **MISSING**: `calendar.sync` - Sync with external calendars

## Subscription-RBAC Integration

### Feature Gating Layers
1. **Role-Based Permissions** - User must have permission
2. **Subscription Plan Features** - Organization plan must include feature
3. **Add-on Access** - Organization must have add-on activated
4. **Usage Limits** - Within plan quota (users, storage, AI credits)

### Example Flow
```
User attempts: Create Custom AI Agent
1. Check: User has `ai_agents.create` permission? → Yes (Admin)
2. Check: Plan includes "custom_ai_agents" feature? → Yes (Professional+)
3. Check: Within AI agent quota? → Yes (2/10 agents)
4. Result: ✅ ALLOW
```

```
User attempts: View Workload Analytics
1. Check: User has `workload.view` permission? → Yes (Admin)
2. Check: Plan includes "workload_insights" feature? → No (Starter plan)
3. Result: ❌ DENY → Show upgrade prompt
```

## Permission Priority Matrix

### P0 - Critical (Implement Immediately)
1. `notifications.view` - Notification bell
2. `notifications.read` - Mark notifications read
3. `action_center.view` - Action center dashboard
4. `payments.request` - Payment collection UI
5. `payments.collect` - Process client payments
6. `client_portal.access` - Client portal access

### P1 - High Priority
1. `automation.view/create/edit/delete` - Automation rules
2. `payment_gateways.view/create/edit` - Payment gateway config
3. `documents.share/sign/verify` - Document advanced features
4. `reports.create/export` - Custom report builder
5. `workload.view` - Team workload analytics
6. `llm_configs.view/create/edit/delete` - LLM management

### P2 - Medium Priority
1. `email.view/connect/send` - Email integration
2. `inbox.view/manage` - Unified inbox
3. `timeline.view` - Timeline view
4. `gantt.view/edit` - Gantt chart
5. `schedules.view/create/edit` - Recurring schedules
6. `subscriptions.view/manage` - Subscription management

### P3 - Nice to Have
1. `calendar.view/sync` - Calendar integration
2. `profile.view/edit/upload_avatar` - Profile management
3. `mfa.enable/disable` - MFA self-service
4. `service_plans.view/purchase` - Service marketplace
5. `folders.view/create/share` - Folder management

## RBAC Matrix Summary

| Feature | Super Admin | Admin | Employee | Client |
|---------|------------|-------|----------|--------|
| User Management | ✅ ALL | ✅ ALL | ❌ NONE | ❌ NONE |
| Role Management | ✅ ALL | ✅ ALL | ❌ NONE | ❌ NONE |
| Client Management | ✅ ALL | ✅ ALL | 👁️ VIEW | ❌ NONE |
| Workflows | ✅ ALL | ✅ ALL | ⚡ EXECUTE | ❌ NONE |
| Documents | ✅ ALL | ✅ ALL | 👁️ VIEW/UPLOAD | 👁️ VIEW/UPLOAD (own) |
| Forms | ✅ ALL | ✅ ALL | 👁️ VIEW | ✍️ SUBMIT |
| Invoices | ✅ ALL | ✅ ALL | ❌ NONE | 👁️ VIEW (own) |
| Payments | ✅ ALL | ✅ ALL | ❌ NONE | 💳 PAY (own) |
| AI Agents | ✅ ALL | ✅ ALL | 👁️ VIEW | ❌ NONE |
| Analytics | ✅ ALL | ✅ ALL | ❌ NONE | ❌ NONE |
| Settings | ✅ ALL (incl. org) | ✅ ALL (no org) | ❌ NONE | ❌ NONE |
| Client Portal | ✅ ALL | ✅ ALL | ❌ NONE | ✅ ACCESS |
| Notifications | ✅ ALL | ✅ ALL | 👁️ OWN | 👁️ OWN |
| Action Center | ✅ ALL | ✅ ALL | ❌ NONE | ✅ OWN |

Legend:
- ✅ = Full access (view, create, edit, delete)
- 👁️ = View only
- ⚡ = Execute/use only
- ✍️ = Submit/respond only
- 💳 = Pay only
- ❌ = No access

## Testing Strategy

### 1. Permission Enforcement Tests
- Verify each endpoint requires correct permission
- Test permission denied returns 403
- Test missing auth returns 401

### 2. Role-Based Access Tests
- Test each role can access permitted features
- Test each role cannot access forbidden features
- Test role permission inheritance

### 3. Subscription Integration Tests
- Test permission granted + plan allows = access
- Test permission granted + plan denies = upgrade prompt
- Test no permission + plan allows = deny

### 4. Audit Logging Tests
- Verify permission changes logged
- Verify role assignments logged
- Verify access attempts logged

## Implementation Checklist

- [x] Define permission taxonomy and naming convention
- [x] Document existing 90+ permissions
- [ ] Identify 50+ missing permissions
- [ ] Add missing permissions to `server/init.ts`
- [ ] Update role assignments for new permissions
- [ ] Add permission checks to recent endpoints (notifications, action center, payments)
- [ ] Create admin UI for role-permission management
- [ ] Implement audit logging for permission changes
- [ ] Create automated RBAC tests
- [ ] Document subscription-RBAC integration patterns

## Related Files
- `server/init.ts` - Permission definitions and role assignments
- `server/auth.ts` - `requirePermission` middleware
- `server/routes.ts` - Endpoint permission enforcement
- `shared/schema.ts` - Database schema for roles/permissions
- `client/src/hooks/use-subscription.ts` - Subscription feature gating

## Change Log
- 2025-11-12: Initial comprehensive RBAC feature inventory created
- 2025-11-12: Identified 50+ missing permissions for recent features
- 2025-11-12: Documented subscription-RBAC integration patterns
