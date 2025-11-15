# Accute - AI-Native Accounting Workflow Automation Platform

## Overview
Accute is an AI-native accounting workflow automation platform designed to revolutionize accounting workflows for modern firms using specialized AI agents. It aims to automate tasks, enhance efficiency, ensure compliance, and improve overall accounting practices. Key capabilities include multi-agent orchestration, a comprehensive template library, multi-provider AI support, an AI agent marketplace, global payment coverage, native mobile apps, multi-role authentication, custom workflow building, and secure document management. The platform seeks to transform the accounting industry through intelligent automation, offering significant market potential.

## User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance
- ENCRYPTION_KEY environment variable must be stable across deployments to prevent LLM credential decryption failures
- Luca Agent Personality: Luca now asks follow-up questions BEFORE answering to narrow down exact requirements
- Luca Agent Approach: Luca asks 2-3 targeted clarifying questions to understand context
- Strict Agent Role Boundaries: All 10 AI agents enforce strict domain boundaries with polite refusals for out-of-scope questions. Each agent's system prompt includes STRICT ROLE BOUNDARIES section listing allowed/prohibited topics and standardized refusal templates that redirect users to appropriate specialists. Luca explicitly includes IRS, tax authorities, and tax law as core allowed topics (NOT prohibited).
- Email Sanitization: All email fields (fromEmail, subject, organizationName, roleName, inviteUrl) sanitized using `sanitizeForEmail()` to replace Unicode smart quotes and special characters with ASCII equivalents, preventing Resend ByteString conversion errors.
- Error Handling: Team creation and other endpoints use `instanceof ZodError` for reliable validation error detection, returning 400 status with detailed validation messages.
- Duplicate Relationship Prevention: Supervision endpoint includes pre-flight duplicate check, returning 409 Conflict for existing relationships instead of 500 database constraint errors.
- Workspace Creation: Full workspace creation flow with dialog UI, auto-slug generation, and organization setup. ALWAYS updates creator's organizationId and defaultOrganizationId to new workspace (not just for first workspace), unsets isDefault flag on other memberships, and requires re-authentication at /auth/login to access new workspace.
- Server Initialization Performance: RBAC seeding uses bulk upsert operations (chunks of 50) with `onConflictDoUpdate` for permissions and in-memory diffing for role-permission assignments, reducing 600+ serial DB operations to ~10 bulk operations for sub-second initialization.
- Automatic LLM Configuration: OrganizationOnboardingService ensures every organization gets a default LLM configuration. Existing organizations backfilled via `tsx server/backfill-llm-configs.ts`. Uses environment API keys when available, creates placeholder configs otherwise.
- Secure Registration Flow (Option B): Users register with ONLY email/username (no password during registration). After submitting registration, users receive verification email. Clicking verification link redirects to set-password page where they create their password. This ensures email ownership is verified before password creation, preventing account creation with fake emails. Flow: Register → Verify Email → Set Password → Login. Legacy users (registered before email verification) auto-verified on first login to prevent lockouts.
- Email Verification System: Comprehensive email verification for new user registrations. All registration endpoints (/api/auth/register, /api/auth/register-admin, /api/super-admin/register) do NOT require password field. Shared sendVerificationEmail() helper centralizes token generation and Mailgun email delivery. Verification endpoint returns token for password setup. /api/auth/set-password endpoint allows users to set password after verification. Login endpoint blocks unverified NEW users only (legacy users with passwords auto-allowed). Invitation-based registrations auto-verify (proves mailbox access).
- Error Handling Enhancement: API error responses properly parsed as JSON with clean error messages. The throwIfResNotOk() function extracts error details from JSON responses and attaches them to Error objects for proper frontend display.
- Resource Management RBAC: 14 new permissions added (resource_allocations.*, skills.*, user_skills.*, task_matching.suggest) with role-based access. Admin: full CRUD; Employee: self-service skills + taxonomy read; Client: none. Gated via resource_management feature identifier. Database migration completed via manual SQL (featureIdentifiers jsonb column added to subscription_plans).
- AI Personality Profiling & Performance Monitoring: Revolutionary multi-framework personality assessment system combining Big Five (OCEAN), DISC, MBTI, Emotional Intelligence, and Hofstede Cultural Dimensions. Includes database-backed ML job queue, hybrid ML analysis, admin dashboard for batch analysis and monitoring, employee/client UI for self-service profiles, and statistical correlation analysis with performance metrics.
- Security & Startup Architecture: Vite middleware initializes immediately after server.listen() to prevent routing gaps. Environment variable validation in `server/index.ts` with fail-fast for missing secrets (`ENCRYPTION_KEY` validation supports base64, hex, or legacy strings). No `dotenv` dependency. `JWT_SECRET` and `ENCRYPTION_KEY` have no `crypto.randomBytes()` fallbacks. Startup log order guarantees routing health before heavy initialization.
- IDOR Protection: Fixed critical Insecure Direct Object Reference vulnerabilities in workflow endpoints by verifying `organizationId` and ownership before returning, updating, or deleting resources. All fixes return 404 to prevent information disclosure. Super admins can access all resources.
- Personalized Welcome Messages: Login system tracks `lastLoginAt` to distinguish first-time vs. returning users. First-time users see "Welcome!" while returning users see "Welcome back!" for a more personalized experience. Both regular and MFA login flows support this feature.
- Country Code Phone Field: Users table includes mandatory `countryCode` field (default "+1") with dropdown UI containing 30 common country codes. Employee profile form validates and combines countryCode + phone before OTP verification. Backend API whitelists countryCode for profile updates.
- LLM Auto-Selection Fix: Luca chat widget properly auto-selects LLM configuration on load. Fixed bug where empty string initial state prevented auto-selection useEffect from running. Now correctly prioritizes workspace default configs over user configs, with fallback to first available config.
- Luca Chat Widget UI Enhancements: Added tooltip to floating button showing "Ask Luca - AI Accounting Expert" on hover. Palm leaf preview state now includes a close button positioned above the stack. Fixed overlapping X icons in full chat dialog by hiding Dialog's default close button with `[&>button]:hidden` CSS selector. All buttons comply with Shadcn guidelines (no custom height/width overrides or hover colors).
- Contact Creation Bug Fix: Fixed 500 error when creating contacts during client onboarding. Issue was insertContactSchema requiring organizationId and createdBy fields that are added by backend from auth context. Schema now omits these fields (marked with "Added by backend from auth context" comments), allowing validation to pass before backend enrichment.
- Workspace Settings Save Fix: Fixed critical bug where workspace settings API calls used wrong endpoint (`/api/organizations/${orgId}/settings` vs correct `/api/organizations/${orgId}`), causing settings to not save and users to get logged out. Updated all query keys and mutations in organization-settings.tsx to use correct endpoint.
- LLM Configuration Form UX: Enhanced workspace LLM configuration form with comprehensive validation feedback. All required fields marked with * suffix, optional fields clearly labeled. Added FormDescription help text for every field explaining purpose, format requirements, and examples. Azure-specific fields conditionally shown with clear "(Required for Azure)" labels.

## System Architecture

### UI/UX Decisions
The UI/UX is inspired by Linear and Notion, utilizing the Carbon Design System. It features a Porsche-to-Pink gradient, specific fonts (Orbitron, Inter, Fira Code), a collapsible sidebar, top navigation, card-based dashboards, and data tables. The platform is implemented as a responsive Progressive Web App (PWA).

### Technical Implementations
The frontend uses React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend is built with Node.js, Express, and TypeScript, storing data in PostgreSQL (Neon) via Drizzle ORM. Authentication relies on JWT and bcrypt, with AES-256 encryption, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude. The platform is optimized for Replit's Cloud Run/Autoscale.

### Feature Specifications
Accute features a multi-tenant architecture with a four-tier Role-Based Access Control (Super Admin, Admin, Employee, Client) and a Client Portal. Core features include an AI Client Onboarding System, conversational AI agent interfaces, a unified workflows system with visual automation, and an AI Agent Marketplace. Secure LLM Configuration Management with AES-256-GCM encryption, PKI Digital Signatures for document verification, and Secure Document Management with encrypted storage are provided.

Additional features include a Marketplace System for templates, hierarchical folder structure, Projects Management, an AI Agent Foundry, Template Scoping (global/organization-specific), and a Subscription Management System with regional pricing, automated billing, and Invoice Generation. Security is enhanced with HTTPS, rate limiting, audit logging for payments, and TOTP-based Multi-Factor Authentication (MFA). A comprehensive Pricing & Subscription Management system supports product families, SKUs, add-ons, volume tiers, and Multi-Gateway Payment Processing.

The Service Plans Marketplace allows admins to create offerings with various pricing models, supported by a Multi-Tier Authorization System for purchases and Subscription-Based Feature Gating. A Task Dependencies System supports all four dependency types with lag/lead time, circular dependency detection, and critical path calculation. A Document Version Control System offers enterprise-grade versioning with SHA-256 hash integrity and optional PKI digital signatures. Visualizations include Gantt Chart and Timeline Views. An Enhanced Report Builder provides analytics with templates and custom queries. The Workload View offers capacity planning with team totals, distribution charts, and over-allocation warnings.

A Unified Inbox consolidates Email, Team Chat, and Live Chat. Calendar & Event Management aggregates events and manages time-off requests. The Cadence Workflow Builder extracts hierarchies from documents and supports conversational building. AI Agent Pricing supports various models, and a Recurring Scheduler processes assignments every 5 minutes. Collaboration features include @Mention Collaboration, Tag-Based Routing, Conditional Automations, and Auto-Advance Triggers. Enhanced Automation Actions include 13 types. Workload Insights provide per-user metrics.

Luca Chat features include File Attachments (PDF, DOCX, XLSX, XLS, CSV, TXT), Automatic Chat Title Generation, and Search & Archive capabilities. Idempotent Automatic Day 1 Task Creation and Admin Template Deletion are implemented. A 21-Day Onboarding Journey gamifies user adoption, and Profile Picture Upload provides user avatar management. A Two-Level LLM Configuration System supports user and workspace-level settings. A Client Payment Collection System offers full payment workflows with Razorpay integration. An Email Integration System provides OAuth-based Gmail and Outlook integration. SSO/SAML Enterprise Authentication supports various IdPs. Proposals & Quotes Management handles the full lifecycle of proposals. Chat Threading Extension provides production-ready threading for Team and Live Chat.

The Resource Management Suite includes a comprehensive resource allocation planner with real-time conflict detection, a Skills Management System with taxonomy CRUD, and a Skill Matching Engine. A User Skill Profile UI enables self-service, and a `task_matching` endpoint provides ranked skill suggestions. A WebRTC Voice/Video Calling System provides production-ready in-app calling for Team Chat and Live Chat with peer-to-peer WebRTC, server-side signaling, and zero per-minute costs, including backend signaling, a frontend WebRTC core, WebSocket integration, and UI components.

### System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. Security is a core focus, with robust authentication, encryption, and multi-tenancy. The Automation Engine supports various action types with context propagation. AI agents are accessed via dynamic routing with lazy-loaded components. A centralized `LLMConfigService` manages all LLM configurations. File attachments for AI agents are handled by a `FileParserService` supporting PDF, DOCX, XLSX/XLS, CSV, and TXT formats. WebSocket management is lazy-loaded on-demand for chat sessions.

## External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration.
- **Anthropic Claude API**: AI model integration.
- **Mailgun**: Transactional email service.
- **MSG91**: SMS service for OTP verification.
- **Razorpay**: Payment gateway.
- **Stripe**: Payment gateway.
- **PayU**: Payment gateway.
- **Payoneer**: Payment gateway.
- **Gmail API**: Per-user OAuth integration.
- **Multer**: For file uploads.
- **expr-eval**: For secure expression evaluation.
- **Recharts**: Frontend library for data visualizations.
- **pdf-parse**: PDF text extraction.
- **mammoth**: DOCX text extraction.
- **xlsx**: Excel file parsing (XLSX, XLS).