# Accute - AI-Powered Accounting Workflow Automation Platform

## Overview
Accute is an enterprise-grade AI-powered accounting workflow automation platform designed to streamline financial operations. It offers multi-role authentication (Super Admin, Admin, Employee, Client), custom workflow building, an AI agent marketplace, and secure document management. The platform aims to be an "AI-first" solution, leveraging advanced AI capabilities for automation and insights to provide significant advantages over traditional accounting software.

## User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance

## System Architecture

### UI/UX Decisions
The platform features a clean, modern UI inspired by productivity applications like Linear and Notion, utilizing the Carbon Design System for data-heavy interfaces. It uses a primary color gradient from Porsche (#e5a660) to Pink (#d76082). Key UI components include a collapsible sidebar, a top navigation with workspace switcher, card-based dashboards, and data tables with sorting and pagination. Fonts are Orbitron (display) and Exo 2 (body).

### Technical Implementations
Accute is built with React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui for the frontend; Node.js, Express, and TypeScript for the backend. It uses PostgreSQL (Neon) with Drizzle ORM for the database. Authentication is handled via JWT and bcrypt, with AES-256 encryption for sensitive data, RBAC, rate limiting, and SQL injection prevention ensuring robust security. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude.

### Feature Specifications
- **Multi-tenant Architecture**: Isolated data for multiple organizations.
- **Role-Based Access Control**: Granular permissions for Super Admin, Admin, Employee, and Client roles.
- **AI Agent Chat Interface** (October 2025): Interactive chat dialog for Parity, Cadence, and Forma AI agents. Features include:
  - Real-time chat interface with message history
  - LLM provider selection (supports OpenAI, Anthropic, Azure OpenAI)
  - Context-aware conversations (passes relevant data to agents)
  - Available on Documents (Parity), Workflows (Cadence), and Forms (Forma) pages
  - Both dialog and popover modes for flexible UX
  - Integrated with existing LLM configuration management
- **Unified Workflows System** (October 2025 - Merged Pipelines into Workflows):
  - **TaxDome-Style Unified Interface**: Single "Workflows" feature combining visual automation (node-based canvas) AND hierarchical project management
  - **Dual Capabilities in ONE Feature**:
    - **Visual Automation**: Node-based workflow builder with triggers, conditions, and automated actions
    - **Hierarchical Project Management**: Stages → Steps → Tasks for structured project execution
  - **Automation at Every Level**: 
    - **Workflow Level**: Triggers (email, form submission, webhook, schedule) to start workflows automatically
    - **Stage/Step Level**: Auto-progression rules with conditions and completion actions
    - **Task Level**: Automated tasks with triggers, conditions, actions (API calls, notifications, AI agent execution)
  - **Hybrid Execution**: Mix manual (human-assigned) and automated (trigger-based) tasks in the same workflow
  - **Use Cases**: Client engagements, tax preparation, audits, automated workflows, or any project requiring both structure and automation
  - **Schema**: workflows, workflowStages, workflowSteps, workflowTasks tables (replaced old pipeline tables)
- **AI Agent Marketplace & Execution System**: Browse, install, and manage AI agents with defined directories and pricing. **Fully-functional AI Agents**: Four production-ready agents (Kanban View, Cadence, Parity, Forma) that work with user-configured LLM credentials (OpenAI, Anthropic, Azure OpenAI). Agents use AES-256 encrypted API key storage and support multiple LLM providers per organization. Execution endpoint: `POST /api/ai-agents/execute` with parameters `agentName`, `input`, and optional `llmConfigId`. Agents gracefully handle errors with fallback responses when API keys are invalid or LLM providers are unavailable.
- **LLM Configuration Management** (October 2025): Complete CRUD system for managing AI provider credentials through Settings page UI. Secure credential storage for multiple AI providers (OpenAI, Anthropic Claude, Azure OpenAI) with AES-256-GCM encryption using ENCRYPTION_KEY environment variable. Organizations can configure multiple LLM providers and set a default configuration. API keys are encrypted before storage and never exposed in API responses (masked as `[ENCRYPTED]`). **Health Check System**: Test Connection button validates credentials in real-time before saving with provider-specific validation (OpenAI: models list, Anthropic: minimal message, Azure: deployments list). Includes 10-second timeout protection, detailed error messages, and JSON error parsing. Endpoints: `POST /api/llm-configurations` (create), `GET /api/llm-configurations` (list), `PATCH /api/llm-configurations/:id` (update), `DELETE /api/llm-configurations/:id` (delete), `POST /api/llm-configurations/test` (health check). Requires `settings.manage` permission (assigned to Admin role by default).
- **Secure Document Management**: Encrypted storage, authenticated downloads, and organization/client-level access control.
- **User & Client Management**: Tools for managing users, roles, and client profiles, including invitation-based registration.
- **Audit Trails**: Comprehensive activity logging for compliance.
- **Super Admin Onboarding**: Secure, single-use key-based registration for initial setup.
- **Form Builder & Renderer**: Dynamic form creation with 22 field types including text, email, number, date, select, checkbox, radio, file upload, signature, rating, matrix, slider, and more. Features comprehensive conditional logic system that evaluates expressions safely using `expr-eval` library (no global scope access, no arbitrary code execution). Conditional rules support show/hide/require/disable actions on target fields based on real-time form value evaluation. Rules are configured via intuitive UI with live expression validation, stored in database, and evaluated reactively in form preview/submission. Includes dynamic Zod schema generation that adapts to conditional requirements and secure backend submission with multi-tenant isolation.
- **Polymorphic Tagging System**: Organize resources like documents, clients, and contacts with tags, including CRUD operations and permissions.
- **Contacts Management**: System for managing contacts associated with clients, including primary contact designation and permissions.
- **Clients Management**: Comprehensive CRUD operations for client profiles with multi-tenant security and permissions.
- **Unified Workflows Builder** (Replaces separate Pipeline feature): Sophisticated system combining **visual automation AND hierarchical project management** with **Stages → Steps → Tasks** hierarchy. Features include: user assignment to tasks, manual and automated (AI-powered) tasks, progression logic requiring completion of all tasks before advancing, priority levels, status tracking, and comprehensive CRUD operations at every level. Workflows support multi-tenant isolation with granular RBAC permissions (workflows.view, workflows.create, workflows.update, workflows.delete). **Task Reminder System**: Configure reminders for tasks with due dates. Features include: customizable reminder duration (15 minutes to 1 week before due date), granular notification settings to notify assigned user, manager/admin, and/or client (if client is assigned), automated reminder processing endpoint (`POST /api/tasks/process-reminders`), and notification creation for selected recipients. Reminders are sent once per day maximum and track last sent timestamp to prevent spam.

### System Design Choices
The project is structured into `client/` (frontend), `server/` (backend), and `shared/` (common types/schemas). The database schema includes core tables for users, organizations, roles, permissions, sessions, and feature-specific tables for workflows (combining visual automation and hierarchical project management with workflowStages, workflowSteps, workflowTasks), AI agents, documents, forms, tags, and contacts. Security is a paramount design principle, with robust authentication, encryption, and access control implemented throughout the system.

### Automation Engine Implementation
The unified workflow automation system is powered by `AutomationEngine` (`server/automation-engine.ts`) with the following capabilities:

**Action Types Supported:**
1. `create_task`: Creates new tasks in specified steps with multi-tenant validation
2. `send_notification`: Sends notifications to users within the organization
3. `run_ai_agent`: Executes AI agents using organization's LLM configuration
4. `update_field`: Updates fields on tasks, steps, stages, or pipelines
5. `wait_delay`: Introduces delays between automated actions

**Context Propagation & Security:**
- All automation execution paths resolve complete hierarchy (task → step → stage → workflow)
- Full context populated: `organizationId`, `workflowId`, `stageId`, `stepId`, `taskId`, `userId`
- Multi-tenant isolation enforced at every level via organizationId validation
- Ownership chain verification prevents cross-organization access
- Security-critical fix (Oct 2025): Added hierarchy resolution in execution routes and cascade methods
- Migration (Oct 2025): Merged Pipelines into Workflows - all pipeline references updated to workflow terminology

**Execution Endpoints:**
- `POST /api/tasks/:id/execute-automation`: Execute task-level automation
- `POST /api/workflows/:id/trigger-automation`: Manually trigger workflow automation
- `POST /api/automation/test-conditions`: Test condition expressions before deployment

**Auto-Progression Cascade:**
- Task completion triggers `processTaskCompletion()` → checks if step should auto-progress
- Step completion triggers `processStepCompletion()` → checks if stage should auto-progress
- Both cascades resolve full workflow hierarchy to populate secure context before executing completion actions

## External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration.
- **Anthropic Claude API**: AI model integration.
- **Multer**: Node.js middleware for `multipart/form-data` (file uploads).
- **expr-eval**: Secure expression evaluation for conditional logic.