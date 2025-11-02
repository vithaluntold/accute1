# Accute - AI-Powered Accounting Workflow Automation Platform

## Overview
Accute is an enterprise-grade AI-powered accounting workflow automation platform designed to streamline financial operations. It provides multi-role authentication, custom workflow building, an AI agent marketplace, and secure document management. The platform aims to be an "AI-first" solution that enhances efficiency, ensures compliance, and significantly improves modern accounting practices.

## User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance

## System Architecture

### UI/UX Decisions
The UI is inspired by applications like Linear and Notion, using the Carbon Design System. It features a Porsche-to-Pink gradient, specific font usage (Orbitron, Inter, Fira Code), a collapsible sidebar, top navigation, card-based dashboards, and data tables. The platform is a responsive PWA, ensuring cross-browser, cross-device compatibility, and native-like experience with offline support.

### Technical Implementations
The frontend uses React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend is built with Node.js, Express, and TypeScript. Data persistence is handled by PostgreSQL (Neon) with Drizzle ORM. Authentication relies on JWT and bcrypt, complemented by AES-256 encryption, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude.

### Feature Specifications
- **Multi-tenant Architecture**: Provides isolated data and distinct SaaS/tenant-level roles.
- **SaaS Platform Administration (Super Admin)**: Offers platform-level management including user/subscription management, support ticket system, marketplace publishing, platform analytics, and specialized access control.
- **Role-Based Access Control**: A four-tier system (Super Admin, Admin, Employee, Client) with UI separation and route protection via `RoleGuard` and `OrganizationRoute` components, ensuring secure and role-aware navigation.
- **Client Portal**: Dedicated client-facing interface with pages for dashboard, documents, tasks, forms, signatures, and messages, offering simplified UI/UX.
- **AI Client Onboarding System**: A privacy-first conversational interface for onboarding, including AI-driven validation and automatic provisioning.
- **AI Agent Chat Interface & Luca AI Chatbot Widget**: Real-time WebSocket streaming for interactive AI agents and a floating, branded chatbot widget.
- **Conversational AI Agent Interfaces**: Full-screen Replit Agent-style conversational UIs for all agents with split-screen layout (chat on left, live preview on right). Agents are accessed via `/ai-agents/:slug` route with dynamic lazy loading. Users chat to build workflows, forms, and documents with real-time artifact preview.
  - **Parity AI**: Legal document creation specialist - drafts legal documents, contracts, compliance forms, and agreements. Like having the world's best lawyer panel. Focus: Document drafting only.
  - **Cadence AI**: Workflow automation builder - creates and manages operational workflows, processes, and automations. God of operations. Focus: Workflow building only.
  - **Forma AI**: Form builder specialist - designs dynamic forms with validation, conditional logic, and field types. OG of Organizers. Focus: Form building only.
- **Unified Workflows System**: Visual automation with hierarchical project management (Stages → Steps → Tasks), supporting hybrid execution, triggers, conditions, and automated actions.
- **AI Agent Marketplace & Execution System**: Enables browsing, installation, and management of AI agents with secure LLM credential storage and a comprehensive pricing model (free, per month, per year, per instance, per token, one-time, hybrid).
- **LLM Configuration Management**: CRUD operations for AI provider credentials using AES-256-GCM encryption.
- **PKI Digital Signatures**: Tamper-proof document verification using RSA-2048.
- **Secure Document Management**: Encrypted storage, authenticated downloads, and access control.
- **User & Client Management**: Tools for managing users, roles, and client profiles.
- **Audit Trails**: Comprehensive logging of all activities.
- **Form Builder & Renderer**: Dynamic form creation with 22 field types and conditional logic.
- **Polymorphic Tagging System**: Flexible organization of resources.
- **Marketplace System**: Provides templates (Documents, Forms, Workflows) with pricing models. **Critical Logic**: Super Admin creates global templates → Marketplace. Admin/users adopt templates → Get organization-scoped COPY (independent instance). Admin can freely delete their organization's copies (does NOT affect marketplace or other organizations). Data isolation: Firm X and Firm Y using same template have completely isolated data (submissions, edits, instances).
- **Workflow Assignment System**: Manages client assignments, tracks progress, and status lifecycles.
- **Hierarchical Folder Structure**: Self-referencing folder tree with unlimited nesting, content categorization, and sharing permissions.
- **Auto-Progression Engine**: Cascading automation for workflow progression.
- **Analytics Dashboard**: Comprehensive analytics with backend APIs and interactive frontend visualizations.
- **Email Template Management**: System for creating, managing, and customizing email templates with organization-scoped isolation and dynamic placeholders.
- **Automation Configuration UI**: Visual workflow task automation with 10 action types.
- **Email Inbox Integration & AI Email Processor**: OAuth/IMAP email account management with AI processing to convert emails to tasks.
- **Assignment Detail Page & Kanban Board**: Hierarchical workflow progress tracking and drag-and-drop assignment management.
- **Assignment Status Bot**: AI-powered conversational assistant for assignment queries.
- **Task Ingestion System**: Multi-source task creation with organization-scoped security.
- **Projects Management**: Comprehensive client engagement tracking for ad-hoc work, distinct from workflow-based assignments, featuring budget tracking, timeline management, priority/status management, team assignment, and a task Kanban board.
- **AI Agent Foundry**: A system for onboarding, dynamic registration, and deployment of custom AI agents via a manifest-driven architecture, supporting various pricing models and multi-tenant/user-level access control.
- **Template Scoping System**: Dual-scope template architecture with global (super admin, visible to all) and organization (admin, internal only) templates for workflows, forms, email templates, message templates, and document templates, with explicit scope field in database schema and UI badges for visual identification.

### System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. Security is a core principle, implemented through robust authentication, encryption, and access control, with distinct SaaS-level and tenant-level role separation for multi-tenancy. The Automation Engine supports various action types (create_task, send_notification, run_ai_agent, update_field, wait_delay) with context propagation and multi-tenant security.

**Agent Routing Architecture**: Individual AI agents are accessed via dynamic routing at `/ai-agents/:slug`. The `AgentDetail` page (`client/src/pages/agent-detail.tsx`) lazy-loads agent components on-demand and provides loading/error states. Navigation from Documents/Workflows/Forms pages to their respective agents (Parity, Cadence, Forma) uses `setLocation('/ai-agents/:slug')` for full-screen conversational interfaces, replacing modal dialogs.

## External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration.
- **Anthropic Claude API**: AI model integration.
- **Resend**: Transactional email service for user invitations and notifications. Configured via Replit connector integration.
- **Twilio**: SMS service for mobile verification and regular notifications with branded sender ID "Accute". Configured with manual API key setup.
- **Multer**: For file uploads.
- **expr-eval**: For secure expression evaluation.
- **Recharts**: Frontend library for data visualizations.

## Communication Services

### Email Service (`server/email.ts`)
The platform uses Resend for sending transactional emails, including user invitations. The email service is integrated via Replit's connector system for secure API key management.

**Key Features:**
- Automatic invitation email sending when users are invited
- Professional HTML email templates with gradient branding
- Secure API key management via Replit connectors
- Error handling and logging for failed email deliveries

**Configuration:**
- Email service is configured via the Resend connector in Replit
- The connector manages API keys and from email address automatically
- No manual environment variable configuration needed

**Usage:**
When an invitation is created via `/api/invitations`, the system automatically:
1. Creates the invitation record in the database
2. Generates a secure invitation URL with token
3. Sends a branded email to the recipient with the invitation link
4. Returns success/failure status in the API response

### SMS Service (`server/sms.ts`)
SMS functionality for sending invitation texts via Twilio with branded sender ID "Accute".

**Key Features:**
- Branded sender ID "Accute" for international messages (works in 100+ countries)
- Automatic fallback to phone number for USA/Canada (where alphanumeric IDs are prohibited)
- One-way messaging (recipients cannot reply to branded sender IDs)
- Secure credential management via Replit Secrets

**Configuration:**
- **Required:** `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` stored in Replit Secrets
- **Optional:** `TWILIO_PHONE_NUMBER` for USA/Canada support
- Sender ID "Accute" is hard-coded in the application
- Must register "Accute" as alphanumeric sender ID in Twilio console for international use

**Usage:**
Currently implemented for invitation SMS only. The system automatically:
1. Detects if recipient is in USA/Canada
2. Uses "Accute" branded sender for international numbers
3. Falls back to `TWILIO_PHONE_NUMBER` for USA/Canada numbers (if configured)
4. Returns clear error if USA/Canada number is sent without phone number configured

**Important Notes:**
- USA/Canada: Requires `TWILIO_PHONE_NUMBER` to be configured or SMS will fail
- International: Uses branded sender ID "Accute" automatically
- Future features (mobile verification, notifications) are documented but not yet implemented