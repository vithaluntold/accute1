# Accute - AI-Native Accounting Workflow Automation Platform

## Overview
Accute is an AI-native accounting workflow automation platform designed to revolutionize accounting workflows for modern firms using specialized AI agents. It automates tasks, enhances efficiency, ensures compliance, and improves accounting practices. Key capabilities include multi-agent orchestration, a comprehensive template library, multi-provider AI support, an AI agent marketplace, global payment coverage, native mobile apps, multi-role authentication, custom workflow building, and secure document management. The platform aims to transform the accounting industry through intelligent automation.

## User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance
- **CRITICAL**: ENCRYPTION_KEY environment variable must be stable across deployments to prevent LLM credential decryption failures
- Luca Agent Personality: Luca now asks follow-up questions BEFORE answering to narrow down exact requirements
- Luca Agent Approach: Luca asks 2-3 targeted clarifying questions to understand context
- Strict Agent Role Boundaries: All 10 AI agents enforce strict domain boundaries with polite refusals for out-of-scope questions. Each agent's system prompt includes STRICT ROLE BOUNDARIES section listing allowed/prohibited topics and standardized refusal templates that redirect users to appropriate specialists. Luca explicitly includes IRS, tax authorities, and tax law as core allowed topics (NOT prohibited).
- Email Sanitization: All email fields (fromEmail, subject, organizationName, roleName, inviteUrl) sanitized using `sanitizeForEmail()` to replace Unicode smart quotes and special characters with ASCII equivalents, preventing Resend ByteString conversion errors.
- Error Handling: Team creation and other endpoints use `instanceof ZodError` for reliable validation error detection, returning 400 status with detailed validation messages.
- Duplicate Relationship Prevention: Supervision endpoint includes pre-flight duplicate check, returning 409 Conflict for existing relationships instead of 500 database constraint errors.
- Workspace Creation: Full workspace creation flow with dialog UI, auto-slug generation, and organization setup. ALWAYS updates creator's organizationId and defaultOrganizationId to new workspace (not just for first workspace), unsets isDefault flag on other memberships, and requires re-authentication at /auth/login to access new workspace.
- **Server Initialization Performance**: RBAC seeding uses bulk upsert operations (chunks of 50) with `onConflictDoUpdate` for permissions and in-memory diffing for role-permission assignments, reducing 600+ serial DB operations to ~10 bulk operations for sub-second initialization.
- **Automatic LLM Configuration**: OrganizationOnboardingService ensures every organization gets a default LLM configuration. Existing organizations backfilled via `tsx server/backfill-llm-configs.ts`. Uses environment API keys when available, creates placeholder configs otherwise.
- **Email Verification System**: Comprehensive email verification for new user registrations. All registration endpoints (/api/auth/register, /api/auth/register-admin, /api/super-admin/register) require email verification before login. Shared sendVerificationEmail() helper centralizes token generation and Mailgun email delivery. Login endpoint blocks unverified accounts at lines 518-524. Invitation-based registrations auto-verify (proves mailbox access). Frontend redirects to login with guidance messages.
- **Resource Management RBAC**: 14 new permissions added (resource_allocations.*, skills.*, user_skills.*, task_matching.suggest) with role-based access. Admin: full CRUD; Employee: self-service skills + taxonomy read; Client: none. Gated via resource_management feature identifier. Database migration completed via manual SQL (featureIdentifiers jsonb column added to subscription_plans).
- **AI Personality Profiling & Performance Monitoring**: Revolutionary multi-framework personality assessment system combining Big Five (OCEAN), DISC, MBTI, Emotional Intelligence, and Hofstede Cultural Dimensions. Includes database-backed ML job queue, hybrid ML analysis, admin dashboard for batch analysis and monitoring, employee/client UI for self-service profiles, and statistical correlation analysis with performance metrics.
- **Security & Startup Architecture**: Vite middleware initializes immediately after server.listen() to prevent routing gaps. Environment variable validation in `server/index.ts` with fail-fast for missing secrets (`ENCRYPTION_KEY` validation supports base64, hex, or legacy strings). No `dotenv` dependency. `JWT_SECRET` and `ENCRYPTION_KEY` have no `crypto.randomBytes()` fallbacks. Startup log order guarantees routing health before heavy initialization.
- **IDOR Protection**: Fixed critical Insecure Direct Object Reference vulnerabilities in workflow endpoints by verifying `organizationId` and ownership before returning, updating, or deleting resources. All fixes return 404 to prevent information disclosure. Super admins can access all resources.

## System Architecture

### UI/UX Decisions
The UI/UX draws inspiration from Linear and Notion, leveraging the Carbon Design System. It features a Porsche-to-Pink gradient, specific fonts (Orbitron, Inter, Fira Code), a collapsible sidebar, top navigation, card-based dashboards, and data tables. The platform is implemented as a responsive Progressive Web App (PWA).

### Technical Implementations
The frontend is built with React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend utilizes Node.js, Express, and TypeScript, with PostgreSQL (Neon) for data storage managed by Drizzle ORM. Authentication employs JWT and bcrypt, complemented by AES-256 encryption, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude. The platform is optimized for Replit's Cloud Run/Autoscale.

### Feature Specifications
Accute features a multi-tenant architecture with a four-tier Role-Based Access Control (Super Admin, Admin, Employee, Client) and a dedicated Client Portal. Key features include an AI Client Onboarding System, conversational AI agent interfaces, a unified workflows system with visual automation, and an AI Agent Marketplace. Secure LLM Configuration Management with AES-256-GCM encryption, PKI Digital Signatures for document verification, and Secure Document Management with encrypted storage are provided.

Additional features include a Marketplace System for templates, a hierarchical folder structure, Projects Management, and an AI Agent Foundry. A Template Scoping System supports global and organization-specific templates, alongside a Subscription Management System with regional pricing and automated billing via an Invoice Generation System.

Security is enhanced with AES-256-GCM encryption, HTTPS, rate limiting, audit logging for payments, and TOTP-based Multi-Factor Authentication (MFA). A comprehensive Pricing & Subscription Management system supports product families, SKUs, add-ons, volume tiers, and Multi-Gateway Payment Processing.

The Service Plans Marketplace allows admins to create offerings with various pricing models, supported by a Multi-Tier Authorization System for purchases and Subscription-Based Feature Gating. A Task Dependencies System supports all four dependency types with lag/lead time, circular dependency detection, and critical path calculation.

A Document Version Control System offers enterprise-grade versioning with SHA-256 hash integrity and optional PKI digital signatures. Visualizations include Gantt Chart and Timeline Views. An Enhanced Report Builder provides analytics with templates and custom queries. The Workload View offers capacity planning with team totals, distribution charts, and over-allocation warnings.

A Unified Inbox consolidates Email, Team Chat, and Live Chat. Calendar & Event Management aggregates events and manages time-off requests. The Cadence Workflow Builder extracts hierarchies from documents and supports conversational building. AI Agent Pricing supports various models, and a Recurring Scheduler processes assignments every 5 minutes. Collaboration features include @Mention Collaboration, Tag-Based Routing, Conditional Automations, and Auto-Advance Triggers. Enhanced Automation Actions include 13 types. Workload Insights provide per-user metrics.

Luca Chat features include File Attachments (PDF, DOCX, XLSX, XLS, CSV, TXT), Automatic Chat Title Generation, and Search & Archive capabilities. Idempotent Automatic Day 1 Task Creation and Admin Template Deletion are implemented. A 21-Day Onboarding Journey gamifies user adoption, and Profile Picture Upload provides user avatar management. A Two-Level LLM Configuration System supports user and workspace-level settings.

A Client Payment Collection System offers full payment workflows with Razorpay integration. An Email Integration System provides OAuth-based Gmail and Outlook integration. SSO/SAML Enterprise Authentication supports various IdPs. Proposals & Quotes Management handles the full lifecycle of proposals. Chat Threading Extension provides production-ready threading for Team and Live Chat.

The Resource Management Suite includes a comprehensive resource allocation planner with real-time conflict detection, a Skills Management System with taxonomy CRUD, and a Skill Matching Engine. A User Skill Profile UI enables self-service, and a `task_matching` endpoint provides ranked skill suggestions.

A WebRTC Voice/Video Calling System provides production-ready in-app calling for Team Chat and Live Chat with peer-to-peer WebRTC, server-side signaling, and zero per-minute costs. This includes a backend signaling infrastructure, a frontend WebRTC core (`useWebRTC` hook), WebSocket integration (`useTeamChatWebSocket` hook), and UI components for calls.

### System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. Security is a core focus, with robust authentication, encryption, and multi-tenancy. The Automation Engine supports various action types with context propagation. AI agents are accessed via dynamic routing with lazy-loaded components. A centralized `LLMConfigService` manages all LLM configurations. File attachments for AI agents are handled by a `FileParserService` supporting PDF, DOCX, XLSX/XLS, CSV, and TXT formats. WebSocket management is lazy-loaded on-demand for chat sessions.

## External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration.
- **Anthropic Claude API**: AI model integration.
- **Mailgun**: Transactional email service for verification emails.
- **MSG91**: SMS service for OTP verification.
- **Razorpay**: Payment gateway.
- **Stripe**: Payment gateway.
- **PayU**: Payment gateway.
- **Payoneer**: Payment gateway.
- **Gmail API**: Per-user OAuth integration for email account connectivity.
- **Multer**: For file uploads.
- **expr-eval**: For secure expression evaluation.
- **Recharts**: Frontend library for data visualizations.
- **pdf-parse**: PDF text extraction.
- **mammoth**: DOCX text extraction.
- **xlsx**: Excel file parsing (XLSX, XLS).