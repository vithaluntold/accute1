# Accute - AI-Native Accounting Workflow Automation Platform

## Overview
Accute is an AI-native accounting workflow automation platform designed for modern accounting firms. Its primary purpose is to leverage specialized AI agents to automate accounting tasks, thereby boosting efficiency, ensuring compliance, and enhancing accounting practices. Key capabilities include multi-agent orchestration, a comprehensive template library, multi-provider AI support, an AI agent marketplace, global payment coverage, native mobile apps, multi-role authentication, custom workflow building, and secure document management. Accute aims to revolutionize accounting workflows through AI-driven automation, offering a significant market advantage.

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

## System Architecture

### UI/UX Decisions
The UI/UX draws inspiration from Linear and Notion, utilizing the Carbon Design System. It features a Porsche-to-Pink gradient, specific fonts (Orbitron, Inter, Fira Code), a collapsible sidebar, top navigation, card-based dashboards, and data tables. The platform is implemented as a responsive Progressive Web App (PWA).

### Technical Implementations
The frontend is built with React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend uses Node.js, Express, and TypeScript, with PostgreSQL (Neon) for data storage managed by Drizzle ORM. Authentication is handled via JWT and bcrypt, supplemented by AES-256 encryption, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude. The platform is optimized for Replit's Cloud Run/Autoscale.

### Feature Specifications
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
- **Subscription Management System**: Four-tier model with regional pricing and automated billing, including add-ons and dynamic permission filtering.
- **Invoice Generation System**: Auto-generates invoices for subscription events.
- **Payment Security**: AES-256-GCM encryption, HTTPS, rate limiting, and audit logging.
- **Multi-Factor Authentication (MFA)**: TOTP-based MFA with QR code setup, backup codes, trusted devices, and device fingerprinting.
- **Comprehensive Pricing & Subscription Management**: Enterprise-grade system with product families, SKU-based plans, add-ons, coupons, regional pricing, and volume tiers.
- **Multi-Gateway Payment Processing**: Organizations configure their own payment gateways with encrypted credentials.
- **Service Plans Marketplace**: Admins create service offerings with various pricing models, deliverables tracking, and client review systems.
- **Multi-Tier Authorization System**: 7-layer protection for service plan purchases.
- **Subscription-Based Feature Gating**: Production-ready feature visibility and quota enforcement via backend middleware and frontend hooks, with real-time usage tracking and a fail-closed security design.
- **Task Dependencies System**: Production-ready task dependency management supporting all 4 dependency types with lag/lead time support, circular dependency detection, and critical path calculation.
- **Document Version Control System**: Enterprise-grade document versioning with SHA-256 hash integrity, optional PKI digital signatures, and compliance-focused approval workflows.
- **Gantt Chart View**: Interactive Gantt chart visualization for workflow task management with dependency highlighting and critical path detection.
- **Timeline View**: Stage-level roadmap visualization with milestone tracking and progress monitoring.
- **Enhanced Report Builder**: Production-ready analytics system with pre-built templates and custom query builder.
- **Workload View**: Comprehensive capacity planning dashboard with team totals summary, workload distribution chart, and detailed team member cards.
- **Unified Inbox**: Consolidated communication hub aggregating Email, Team Chat, and Live Chat into a single interface.
- **Calendar & Event Management**: Multi-source calendar view aggregating events from dedicated events table, workflow tasks, project tasks, and assignments, including event creation, attendee management, and time-off requests.
- **Cadence Workflow Builder**: Supports full hierarchy extraction (Stages → Steps → Tasks → Subtasks → Checklists) from uploaded documents and conversational building.
- **AI Agent Pricing**: Support for multiple pricing models (free, subscription, per-instance, per-token, one-time).
- **Recurring Scheduler**: Service runs every 5 minutes to process recurring schedules and auto-create workflow assignments.
- **@Mention Collaboration**: Users can @mention team members in chat messages and document annotations with automatic notifications.
- **Tag-Based Routing**: Clients and organizations support tag arrays for segmentation and conditional workflow automation.
- **Conditional Automations**: Workflow actions support conditional execution based on tags, fields, and other criteria.
- **Auto-Advance Triggers**: Event-driven workflow progression system automatically advances workflows based on predefined events.
- **Enhanced Automation Actions**: 13 total automation action types including create_invoice, request_documents, send_organizer, apply_tags, remove_tags, send_proposal, apply_folder_template.
- **Workload Insights**: Analytics endpoint providing per-user metrics with team totals and capacity planning.
- **Luca Chat File Attachments**: Full file upload functionality in Luca chat widget supporting PDF, DOCX, XLSX, XLS, CSV, TXT files, with text extraction and safe fallback handling.
- **Automatic Chat Title Generation**: Backend-driven auto-title generation using LLM for descriptive titles.
- **Luca Chat Search & Archive**: Full-text search across chat session titles and message content, with archive functionality.
- **Automatic Day 1 Task Creation**: Idempotent creation of onboarding tasks.
- **Admin Template Deletion**: Admin and Super Admin users can bypass subscription-based permission filtering for template deletion.
- **21-Day Onboarding Journey**: Gamified onboarding system with daily tasks, point accumulation, streak tracking, and feature unlocking.
- **Profile Picture Upload**: Full user avatar upload system with image validation, size limits, and old avatar deletion.
- **Two-Level LLM Configuration System**: Supports user-level (portable) and workspace-level (isolated) LLM configurations with fallback logic.
- **Client Payment Collection System**: Full payment request and collection workflow with invoice generation, shareable payment links, Razorpay integration, and email notifications.
- **Email Integration System**: Production-ready OAuth-based email integration with Gmail and Outlook support. Features include:
  - **OAuth 2.0 Integration**: Secure Gmail and Outlook OAuth flows with HMAC-signed state verification, timing-safe comparisons, and dedicated HMAC key derivation to prevent CSRF attacks
  - **Token Management**: EmailOAuthService handles AES-256-GCM encrypted credential storage, automatic token refresh with immediate database persistence to prevent token rot, and provider-specific client factories
  - **Email Sync**: EmailSyncService fetches emails via Gmail API and Microsoft Graph, with incremental sync, message parsing, threading support, and duplicate detection
  - **API Routes**: Complete REST API for email account management (CRUD), manual sync triggering, message operations (read/star/archive), and full-text search across messages
  - **Security**: HMAC-SHA256 signed OAuth state with 15-minute TTL, crypto.timingSafeEqual for signature verification, segregated HMAC and encryption keys, and encrypted OAuth credentials at rest
  - **Multi-Account Support**: Users can connect multiple Gmail and Outlook accounts per organization with automatic account updates during re-authentication

### System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. Security is a core focus, with robust authentication, encryption, and multi-tenancy support. The Automation Engine supports various action types with context propagation. AI agents are accessed via dynamic routing with lazy-loaded components. A centralized `LLMConfigService` manages all LLM configurations, providing a single source of truth with caching and cache invalidation. File attachments for AI agents are handled by a `FileParserService` supporting PDF, DOCX, XLSX/XLS, CSV, and TXT formats, with dedicated upload endpoints for each agent. WebSocket management is lazy-loaded on-demand when chat sessions start.

## External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration.
- **Anthropic Claude API**: AI model integration.
- **Resend**: Transactional email service.
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