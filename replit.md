# Accute - AI-Native Accounting Workflow Automation Platform

### Overview
Accute is an AI-native accounting workflow automation platform for modern accounting firms. It leverages specialized AI agents to automate accounting tasks, boosting efficiency, ensuring compliance, and enhancing practices. Key features include multi-agent orchestration, a comprehensive template library, multi-provider AI support, an AI agent marketplace, global payment coverage, native mobile apps, multi-role authentication, custom workflow building, and secure document management. The platform aims to revolutionize accounting workflows through AI-driven automation, providing a significant market advantage.

### User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance
- **CRITICAL**: ENCRYPTION_KEY environment variable must be stable across deployments to prevent LLM credential decryption failures
- WebSocket Management: WebSockets now lazy-load on-demand when chat sessions start, not at server startup to prevent initialization errors
- Subscription System: Full subscription UI and routes now enabled for testing
- Luca Agent Personality: Luca now asks follow-up questions BEFORE answering to narrow down exact requirements
- Luca Agent Approach: Luca asks 2-3 targeted clarifying questions to understand context
- Cadence Workflow Builder: Now supports FULL hierarchy extraction (Stages → Steps → Tasks → Subtasks → Checklists) from uploaded documents and conversational building
- AI Agent Pricing: Support for multiple pricing models (free, subscription, per-instance, per-token, one-time). Free agents auto-install to all organizations.
- Recurring Scheduler: Service runs every 5 minutes to process recurring schedules and auto-create workflow assignments. Supports daily, weekly, monthly, quarterly, and annual frequencies.
- @Mention Collaboration: Users can @mention team members in chat messages and document annotations. Mentions use format @[userId] internally, display as @FullName. Automatic notifications created for mentioned users.
- Tag-Based Routing: Clients and organizations support tag arrays for segmentation. Tags enable conditional workflow automation (IF-THEN logic based on client tags).
- Conditional Automations: Workflow actions support conditional execution based on tags, fields, and other criteria. Implements TaxDome-style conditional logic.
- Auto-Advance Triggers: Event-driven workflow progression system automatically advances workflows based on events (payment_received, document_uploaded, organizer_submitted, invoice_paid).
- Enhanced Automation Actions: 13 total automation action types including create_invoice, request_documents, send_organizer, apply_tags, remove_tags, send_proposal, apply_folder_template.
- Workload Insights: Analytics endpoint providing per-user metrics (assignments, tasks, time tracking, completion rates, workload scores) with team totals and capacity planning.
- Organizations with isTestAccount=true bypass all subscription limits and feature gates for unlimited access.
- Subscription add-ons now fully integrated into feature gating. Features and resource limits from active add-ons merge with base plan entitlements.
- Dynamic permission filtering based on subscription features. Role permissions automatically restricted when organization lacks required subscription features.
- Email Sanitization: All email fields (fromEmail, subject, organizationName, roleName, inviteUrl) sanitized using `sanitizeForEmail()` to replace Unicode smart quotes and special characters with ASCII equivalents, preventing Resend ByteString conversion errors.
- Error Handling: Team creation and other endpoints use `instanceof ZodError` for reliable validation error detection, returning 400 status with detailed validation messages.
- Duplicate Relationship Prevention: Supervision endpoint includes pre-flight duplicate check, returning 409 Conflict for existing relationships instead of 500 database constraint errors.
- Manual Client Creation: Full client creation workflow with "Create Client" button, form validation, and primary contact creation. Includes atomic rollback on contact creation failure.
- Inline Tag Creation: TagSelector component supports on-the-fly tag creation with color picker dialog when no tags exist or when creating new tags from dropdown.
- Workspace Creation: Full workspace creation flow with dialog UI, auto-slug generation, and organization setup. ALWAYS updates creator's organizationId and defaultOrganizationId to new workspace (not just for first workspace), unsets isDefault flag on other memberships, and requires re-authentication at /auth/login to access new workspace.
- Multi-Workspace Architecture: Complete workspace management system allowing users to belong to multiple organizations simultaneously.
- Luca Chat File Attachments: Full file upload functionality in Luca chat widget supporting PDF, DOCX, XLSX, XLS, CSV, TXT files. FileParserService extracts text content, which is appended to messages. Includes attachment display, removal, and safe fallback handling.
- Automatic Chat Title Generation: Backend-driven auto-title generation happens immediately after first assistant message is saved. Titles generated via LLM using first user+assistant messages (3-6 words descriptive).
- Luca Chat Search & Archive: Full-text search across chat session titles and message content. Archive functionality hides chats from main list while keeping them searchable.
- Strict Agent Role Boundaries: All 10 AI agents enforce strict domain boundaries with polite refusals for out-of-scope questions. Each agent's system prompt includes STRICT ROLE BOUNDARIES section listing allowed/prohibited topics and standardized refusal templates that redirect users to appropriate specialists. Luca explicitly includes IRS, tax authorities, and tax law as core allowed topics (NOT prohibited).
- Automatic Day 1 Task Creation: When users start onboarding, the system automatically creates 3 Day 1 tasks with idempotency checks to prevent duplicates.
- Admin Template Deletion: Admin and Super Admin users have explicit bypass for ALL template deletion (workflows, email templates, message templates, document templates, forms) regardless of subscription-based permission filtering. Ownership checks still apply.
- 21-Day Onboarding Journey: Complete gamified onboarding system with 21 days of accounting workflow tasks. Each day includes 2 required tasks and 0-1 optional tasks. System features automatic day advancement, point accumulation, streak tracking, feature unlocking, and realistic accounting curriculum.
- Profile Picture Upload: Full user avatar upload system with multipart/form-data handling via multer. Backend validates image types (JPEG, PNG, GIF, WebP), enforces 5MB file size limit, and automatically deletes old avatars on replacement.
- Two-Level LLM Configuration System: Supports both user-level (shared across all user's workspaces) and workspace-level (workspace-specific) LLM configurations. User-level configs created in "My Settings" are portable across workspaces. Workspace-level configs created in "Workspace Settings" provide data residency isolation. AI agents check workspace-level configs first, falling back to user-level. Enables centralized LLM management for multi-branch firms while allowing workspace-specific overrides for data tenancy requirements.

### System Architecture

#### UI/UX Decisions
The UI/UX is inspired by Linear and Notion, using the Carbon Design System. It features a Porsche-to-Pink gradient, specific fonts (Orbitron, Inter, Fira Code), a collapsible sidebar, top navigation, card-based dashboards, and data tables. It is implemented as a responsive Progressive Web App (PWA).

#### Technical Implementations
The frontend uses React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend is built with Node.js, Express, and TypeScript, with PostgreSQL (Neon) for data storage via Drizzle ORM. Authentication uses JWT and bcrypt, complemented by AES-256 encryption, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude. The platform is optimized for Replit's Cloud Run/Autoscale.

#### Feature Specifications
- **Multi-tenant Architecture**: Isolated data and distinct roles.
- **Role-Based Access Control**: Four-tier system (Super Admin, Admin, Employee, Client).
- **Client Portal**: Dedicated interface for client interactions.
- **AI Client Onboarding System**: Privacy-first, conversational, AI-driven onboarding.
- **Conversational AI Agent Interfaces**: Dynamic, full-screen UIs for specialized agents.
- **Unified Workflows System**: Visual automation with hierarchical project management.
- **AI Agent Marketplace & Execution System**: For managing AI agents.
- **LLM Configuration Management**: Secure CRUD for AI provider credentials with AES-256-GCM encryption.
- **PKI Digital Signatures**: Tamper-proof document verification using RSA-2048.
- **Secure Document Management**: Encrypted storage, authenticated downloads, and access control.
- **Marketplace System**: Offers templates (Documents, Forms, Workflows) with pricing.
- **Hierarchical Folder Structure**: Unlimited nesting for content categorization.
- **Projects Management**: Comprehensive client engagement tracking.
- **AI Agent Foundry**: System for onboarding custom AI agents.
- **Template Scoping System**: Dual-scope architecture for global and organization-specific templates.
- **Subscription Management System**: Four-tier model with regional pricing and automated billing.
- **Invoice Generation System**: Auto-generates invoices for subscription events.
- **Payment Security**: AES-256-GCM encryption, HTTPS, rate limiting, and audit logging.
- **Multi-Factor Authentication (MFA)**: TOTP-based MFA with QR code setup, backup codes, trusted devices, and device fingerprinting.
- **Comprehensive Pricing & Subscription Management**: Enterprise-grade system with product families, SKU-based plans, add-ons, coupons, regional pricing, and volume tiers.
- **Multi-Gateway Payment Processing**: Organizations configure their own payment gateways (Razorpay, Stripe, PayU, Payoneer) with encrypted credentials.
- **Service Plans Marketplace**: Admins create service offerings with various pricing models, deliverables tracking, and client review systems.
- **Multi-Tier Authorization System**: 7-layer protection for service plan purchases.
- **Subscription-Based Feature Gating**: Production-ready feature visibility and quota enforcement via backend middleware and frontend hooks, with real-time usage tracking and a fail-closed security design.
- **Task Dependencies System**: Production-ready task dependency management supporting all 4 dependency types with lag/lead time support, circular dependency detection, and critical path calculation.
- **Document Version Control System**: Enterprise-grade document versioning with SHA-256 hash integrity, optional PKI digital signatures, and compliance-focused approval workflows.
- **Gantt Chart View**: Interactive Gantt chart visualization for workflow task management with dependency highlighting and critical path detection.
- **Timeline View**: Stage-level roadmap visualization with milestone tracking and progress monitoring.
- **Enhanced Report Builder**: Production-ready analytics system with 3 pre-built templates (task-progress, team-workload, time-tracking), custom query builder supporting 5 data sources (tasks, time entries, invoices, projects, clients), dynamic filtering with 6 operators, grouping by status/assignee/month/priority/tag, and bar/line chart visualization. Exports to CSV/Excel/PDF using shared export-utils pipeline with proper numeric type preservation, totals rows, template-aware filenames, and consistent formatting. Backend-backed ReportService with organization-scoped queries, RBAC enforcement, and generic groupBy fallback supporting arbitrary fields.

#### System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. Security is a core focus, with robust authentication, encryption, and multi-tenancy support. The Automation Engine supports various action types (e.g., create_task, run_ai_agent) with context propagation. AI agents are accessed via dynamic routing with lazy-loaded components. A centralized `LLMConfigService` manages all LLM configurations, providing a single source of truth with caching and cache invalidation. File attachments for AI agents are handled by a `FileParserService` supporting PDF, DOCX, XLSX/XLS, CSV, and TXT formats, with dedicated upload endpoints for each agent.

### External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration.
- **Anthropic Claude API**: AI model integration.
- **Resend**: Transactional email service.
- **MSG91**: SMS service for OTP verification.
- **Razorpay**: Payment gateway.
- **Gmail API**: Per-user OAuth integration for email account connectivity.
- **Multer**: For file uploads.
- **expr-eval**: For secure expression evaluation.
- **Recharts**: Frontend library for data visualizations.
- **pdf-parse**: PDF text extraction.
- **mammoth**: DOCX text extraction.
- **xlsx**: Excel file parsing (XLSX, XLS).