# Accute - AI-Powered Accounting Workflow Automation Platform

## Overview
Accute is an enterprise-grade AI-powered accounting workflow automation platform designed to streamline financial operations. It offers multi-role authentication, custom workflow building, an AI agent marketplace, and secure document management. The platform aims to be an "AI-first" solution, leveraging advanced AI capabilities for automation and insights to provide significant advantages over traditional accounting software. Its business vision is to provide a comprehensive, secure, and intelligent platform for modern accounting practices, enhancing efficiency and compliance.

## User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance

## System Architecture

### UI/UX Decisions
The platform features a clean, modern UI inspired by productivity applications like Linear and Notion, utilizing the Carbon Design System. It uses a primary color gradient from Porsche (#e5a660) to Pink (#d76082), with Orbitron (display) and Exo 2 (body) fonts. Key UI components include a collapsible sidebar, top navigation with workspace switcher, card-based dashboards, and data tables with sorting and pagination.

### Technical Implementations
Accute is built with React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui for the frontend; Node.js, Express, and TypeScript for the backend. PostgreSQL (Neon) with Drizzle ORM is used for the database. Authentication is handled via JWT and bcrypt, with AES-256 encryption for sensitive data, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude.

### Feature Specifications
- **Multi-tenant Architecture**: Isolated data for multiple organizations with distinct SaaS-level (Super Admin) and tenant-level (Admin, Employee, Client) role separation and permission namespaces.
- **Role-Based Access Control**: Granular permissions for platform and tenant roles, preventing privilege escalation.
- **AI Agent Chat Interface with WebSocket Streaming**: Interactive chat for AI agents (Parity, Cadence, Forma) with real-time bidirectional streaming, supporting OpenAI, Azure OpenAI, and Anthropic. Features include word-by-word text appearance, context-aware conversations, and robust error handling.
- **Unified Workflows System**: Combines node-based visual automation with hierarchical project management (Stages → Steps → Tasks). Supports hybrid execution (manual and automated tasks), triggers, conditions, automated actions, and multi-tenant RBAC. Includes a task reminder system.
- **AI Agent Marketplace & Execution System**: Browse, install, and manage AI agents, supporting user-configured LLM credentials with AES-256 encrypted storage. Four production-ready agents (Kanban View, Cadence, Parity, Forma) are available.
- **LLM Configuration Management**: CRUD system for secure management of AI provider credentials (OpenAI, Anthropic, Azure OpenAI) with AES-256-GCM encryption and real-time connection health checks.
- **PKI Digital Signatures for Document Security**: Enterprise-grade tamper-proof document verification using RSA-2048 cryptographic signatures, with per-organization RSA key pair management encrypted at rest, meeting eIDAS and ESIGN Act requirements.
- **Secure Document Management**: Encrypted storage, authenticated downloads, organization/client-level access control, and tamper-proof verification with digital signatures.
- **User & Client Management**: Tools for managing users, roles, and client profiles, including invitation-based registration.
- **Audit Trails**: Comprehensive activity logging for compliance.
- **Super Admin Onboarding**: Secure, single-use key-based registration for initial setup.
- **Form Builder & Renderer**: Dynamic form creation with 22 field types and a comprehensive, secure conditional logic system using `expr-eval` for real-time field manipulation, dynamic Zod schema generation, and multi-tenant isolated backend submission.
- **Polymorphic Tagging System**: Organize resources with tags, including CRUD operations and permissions.
- **Contacts Management**: System for managing contacts associated with clients.
- **Clients Management**: Comprehensive CRUD operations for client profiles with multi-tenant security and permissions.
- **Marketplace System (TaxDome-style)**: Template marketplace with three categories (Documents, Forms, Pipelines). Supports pricing models (free, one-time, subscription), organization-scoped and public templates, installation tracking, and super admin template creation. API routes for CRUD, installation/uninstallation, and subscription management.
- **Workflow Assignment System**: Client-to-workflow assignment infrastructure where adding a client to a workflow creates an assignment. Tracks progress (current stage/step/task), employee assignment, client POC, status lifecycle (not_started → in_progress → review → completed), due dates, and priorities with complete multi-tenant security.
- **Hierarchical Folder Structure**: Self-referencing folder tree with parent/child navigation, content type categorization (documents, forms, workflows, clients, mixed), sharing permissions, color/icon support, and archive functionality. Supports unlimited nesting depth for organizational flexibility.
- **Auto-Progression Engine**: TaxDome-style cascade automation that automatically progresses through workflow hierarchy when conditions are met. Cascade logic: checklist complete → task complete → step complete → stage complete → assignment complete. Respects autoProgress toggles at task/step/stage levels, updates assignment progress percentages automatically, and supports on-complete actions (notifications, webhooks). Engine is implemented but requires integration into completion routes for full functionality.

### System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. The database schema includes core tables for users, organizations, roles (with `scope` for platform/tenant separation), permissions, sessions, and feature-specific tables. Security is a paramount design principle, implementing robust authentication, encryption, and access control with a complete SaaS-level vs tenant-level role separation for multi-tenant isolation. The Automation Engine supports various action types (create_task, send_notification, run_ai_agent, update_field, wait_delay) with context propagation and multi-tenant security enforced at every level. It includes auto-progression cascades for tasks, steps, and stages.

## External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration.
- **Anthropic Claude API**: AI model integration.
- **Multer**: Node.js middleware for file uploads.
- **expr-eval**: Secure expression evaluation for conditional logic.

## Recent Changes (October 29, 2025)

### Critical Bug Fixes - Workflow Hierarchy System
Fixed four critical bugs affecting the workflow hierarchy (Stages → Steps → Tasks) system:

**1. NaN Parsing Bug (Frontend)**
- **Issue**: Empty numeric input fields (order fields in Stage/Step/Task dialogs) caused `parseInt()` to return NaN, breaking form submissions and causing console errors.
- **Fix**: All three dialogs (StageDialog, StepDialog, TaskDialog) now use pattern: `field.onChange(val === "" ? 0 : parseInt(val, 10))` to default empty strings to 0.
- **Impact**: Forms submit cleanly with no NaN errors.

**2. Empty Due Date 500 Error (Backend)**
- **Issue**: Empty date strings from frontend caused 500 errors when Drizzle attempted to call `.toISOString()` on empty strings.
- **Fix**: Backend sanitizes empty date strings to `undefined` before database insertion using pattern: `dueDate: data.dueDate && data.dueDate.trim() ? data.dueDate : undefined`
- **Impact**: No more 500 errors when submitting forms with empty due dates.

**3. Workflow Hierarchy Not Appearing Without Reload (Backend + Frontend)**
- **Issue**: Creating steps or tasks required page reload to see them because frontend made separate API calls for stages, steps, and tasks instead of using nested data.
- **Fix**: 
  - **Backend**: GET `/api/workflows/:id/stages` now returns complete hierarchy in single optimized query with nested steps and tasks.
  - **Frontend**: workflow-detail.tsx uses nested data from stages query instead of making separate queries per stage/step.
- **Impact**: Complete hierarchy loads in single API call, eliminating N+1 query problem and improving performance.

**4. Cache Invalidation Not Working (Frontend)**
- **Issue**: Creating/updating stages, steps, or tasks didn't refresh UI because mutations invalidated obsolete query keys instead of parent stages query.
- **Fix**: All three dialogs now invalidate correct parent queries:
  ```typescript
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/workflows", workflowId, "stages"] });
    queryClient.invalidateQueries({ queryKey: ["/api/workflows", workflowId] });
  }
  ```
- **Impact**: UI updates immediately after any create/update operation. Zero page reloads needed.

**End-to-End Testing Results:** ✅ ALL PASSED
- Workflow → Stage → Step → Task creation: Working perfectly
- All items appear immediately without page reload
- Step progress badges update correctly
- No NaN errors, no 500 errors, complete cache coherence

**Files Modified:**
- `client/src/components/stage-dialog.tsx` - NaN fix
- `client/src/components/step-dialog.tsx` - NaN fix + cache invalidation fix
- `client/src/components/task-dialog.tsx` - NaN fix + cache invalidation fix + workflowId prop
- `client/src/pages/workflow-detail.tsx` - Nested data usage + workflowId passing to TaskDialog
- `server/routes.ts` - Nested API response + date sanitization