# Accute - AI-Native Accounting Workflow Automation Platform

### Overview
Accute is an AI-native accounting workflow automation platform designed for modern accounting firms. It automates tasks, enhances efficiency, ensures compliance, and improves accounting practices through specialized AI agents. Key features include multi-agent orchestration, a library of templates, multi-provider AI support, an AI agent marketplace, global payment coverage, and native mobile apps. The platform also offers multi-role authentication, custom workflow building, secure document management, and integrations for email and calendar scheduling.

### User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance
- **WebSocket Management**: WebSockets now lazy-load on-demand when chat sessions start, not at server startup to prevent initialization errors
- **Subscription System**: Subscription pricing UI and routes disabled per user request

### Recent Changes

- **AI Agent Cleanup** (November 6, 2025):
  - Removed non-functional/duplicate agents from the system:
    - **OmniSpectra** (Work Status Bot) - removed agent directory and registrations
    - **Parity AI Accountant (Example)** - removed duplicate example agent
    - **Invoice Processor** - removed from seed data
    - **Tax Compliance Advisor** - removed from seed data
    - **Reconciliation Assistant** - removed from seed data
  - **Active agents**: Only functional agents remain (Cadence, Scribe, Forma, Echo, Parity AI, Luca, Relay, Radar)
  - Single Parity agent maintained: "Parity AI" is the only working Parity variant
- **Profile Verification Banner Removed** (November 6, 2025):
  - Removed KYC/profile verification banner from dashboard to reduce user friction
  - Banner was showing completion percentage and missing requirements on main dashboard
  - Users can still access profile completion via their profile settings if needed
- **Email Template Default Attachments** (November 6, 2025):
  - Email templates now support default attachments that are automatically included when template is used
  - **Database**: Added `attachments` JSONB column to `email_templates` table storing file metadata array
  - **Component**: Created `TemplateAttachments` component for upload/preview/removal of default attachments
  - **Integration**: Available in both Scribe agent preview panel and manual email template creation form
  - **Backend**: Generic `/api/upload` endpoint handles file uploads with multer (50MB limit, MIME type validation)
  - **File Storage**: Files stored in `/uploads` directory with sanitized, unique filenames
  - **User Experience**: Drag & drop or click to upload files, preview with file icons, remove individual attachments
  - **Bug Fix**: Fixed Scribe save-template endpoint to include signature and attachments fields when saving templates
  - **Validation**: Both signature and attachments are optional (not required) when creating email templates

### System Architecture

#### UI/UX Decisions
The UI/UX is inspired by Linear and Notion, utilizing the Carbon Design System. It features a Porsche-to-Pink gradient, specific typography (Orbitron, Inter, Fira Code), a collapsible sidebar, top navigation, card-based dashboards, and data tables. The platform is implemented as a responsive Progressive Web App (PWA) for cross-device compatibility and native-like experience with offline support.

#### Technical Implementations
The frontend uses React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend is built with Node.js, Express, and TypeScript. Data is persisted in PostgreSQL (Neon) with Drizzle ORM. Authentication relies on JWT and bcrypt, complemented by AES-256 encryption, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude. The platform is optimized for Replit's Cloud Run/Autoscale deployment.

#### Feature Specifications
- **Multi-tenant Architecture**: Provides isolated data and distinct roles for SaaS and tenant levels.
- **Role-Based Access Control**: A four-tier system comprising Super Admin, Admin, Employee, and Client roles.
- **Client Portal**: A dedicated interface for client interactions.
- **AI Client Onboarding System**: A privacy-first, conversational, AI-driven onboarding process.
- **Conversational AI Agent Interfaces**: Full-screen, dynamic UIs for specialized AI agents.
- **Unified Workflows System**: Offers visual automation with hierarchical project management and hybrid execution capabilities.
- **AI Agent Marketplace & Execution System**: For discovering, installing, and managing AI agents.
- **LLM Configuration Management**: CRUD operations for AI provider credentials with AES-256-GCM encryption.
- **PKI Digital Signatures**: Ensures tamper-proof document verification using RSA-2048.
- **Secure Document Management**: Provides encrypted storage, authenticated downloads, and access control.
- **Marketplace System**: Offers templates (Documents, Forms, Workflows) with pricing models.
- **Hierarchical Folder Structure**: Supports unlimited nesting for content categorization.
- **Projects Management**: Comprehensive tracking of client engagements.
- **AI Agent Foundry**: A system for onboarding and deploying custom AI agents.
- **Template Scoping System**: Dual-scope architecture for global and organization-specific templates.
- **Subscription Management System**: A four-tier subscription model (FREE, CORE, AI, EDGE) including regional pricing, prorated upgrades/downgrades, auto-payment, and service pause on payment failure. Employee roles count towards maxUsers limits; clients do not.
- **Invoice Generation System**: Automatically generates invoices for subscription events with detailed breakdowns and status tracking.
- **Payment Security**: Implements AES-256-GCM encryption for credentials, HTTPS enforcement, rate limiting, comprehensive security headers, and payment audit logging.

#### System Design Choices
The project is organized into `client/`, `server/`, and `shared/` directories. Security is a core focus, incorporating robust authentication, encryption, and access control, alongside multi-tenancy support. The Automation Engine supports various action types (create_task, send_notification, run_ai_agent, update_field, wait_delay) with context propagation and multi-tenant security. AI agents are accessed via dynamic routing with lazy-loaded components.

### External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration (default for AI agents).
- **Anthropic Claude API**: AI model integration.
- **Resend**: Transactional email service.
- **MSG91**: SMS service for OTP verification.
- **Razorpay**: Payment gateway for subscription billing and one-time payments.
- **Gmail API**: Per-user OAuth integration for email account connectivity.
- **Multer**: For file uploads.
- **expr-eval**: For secure expression evaluation.
- **Recharts**: Frontend library for data visualizations.