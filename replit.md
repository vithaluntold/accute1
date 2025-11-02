# Accute - AI-Powered Accounting Workflow Automation Platform

## Overview
Accute is an enterprise-grade AI-powered accounting workflow automation platform designed to streamline financial operations. It offers multi-role authentication, custom workflow building, an AI agent marketplace, and secure document management. The platform's core purpose is to be an "AI-first" solution, enhancing efficiency, ensuring compliance, and significantly improving modern accounting practices. It aims to provide an advanced, secure, and user-friendly environment for financial professionals to automate and manage their workflows effectively.

## Recent Changes (November 2025)
- **Client Onboarding Security**: Implemented secure portal activation with server-side OTP verification. Clients start inactive and are activated only after phone verification.
- **Admin Employee Management**: Added comprehensive safeguards for employee deletion (prevents self-deletion, enforces tenant isolation, blocks deleting last active admin, uses permission-based role detection).
- **Messages UI Fix**: Fixed client dropdown to use `companyName` field and filter to active clients only.
- **AI Agent Marketplace**: Marked Luca agent as pre-installed; removed duplicate Parity agent listing by moving `parity-example` to `_parity-example`.
- **Agent Integration**: Added AI agent buttons to Email Templates (Scribe), Message Templates (Echo), and Inbox (Relay) pages for easy access.

## TODO: Email Inbox Sync Implementation
The email accounts infrastructure exists (`/email-accounts` page, schema, routes) but requires:
1. **OAuth Implementation**: Implement Gmail OAuth 2.0 and Microsoft OAuth flows for secure authentication
2. **IMAP Service**: Build email sync service using nodemailer/imap-simple for IMAP/SMTP providers (GoDaddy, generic email)
3. **Sync Worker**: Create background job to periodically fetch emails from connected accounts
4. **Token Refresh**: Implement OAuth token refresh logic for Gmail/Outlook
5. **Email Parser**: Parse incoming emails and store in emailMessages table

NOTE: Gmail connector dismissed - each user connects their own accounts via OAuth, not platform-wide connection.

## User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance

## System Architecture

### UI/UX Decisions
The UI is inspired by applications like Linear and Notion, utilizing the Carbon Design System. It features a Porsche-to-Pink gradient, specific font usage (Orbitron, Inter, Fira Code), a collapsible sidebar, top navigation, card-based dashboards, and data tables. The platform is a responsive PWA, ensuring cross-browser, cross-device compatibility, and a native-like experience with offline support.

### Technical Implementations
The frontend uses React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend is built with Node.js, Express, and TypeScript. Data persistence is handled by PostgreSQL (Neon) with Drizzle ORM. Authentication relies on JWT and bcrypt, complemented by AES-256 encryption, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude. The platform is optimized for Replit's Cloud Run/Autoscale deployment, featuring lazy database initialization, immediate health check responses, and server listening before heavy initialization.

### Feature Specifications
- **Multi-tenant Architecture**: Isolated data and distinct SaaS/tenant-level roles.
- **Role-Based Access Control**: Four-tier system (Super Admin, Admin, Employee, Client) with UI separation and route protection.
- **Client Portal**: Dedicated client-facing interface for documents, tasks, forms, signatures, and messages.
- **AI Client Onboarding System**: Privacy-first conversational onboarding with AI-driven validation and provisioning.
- **Conversational AI Agent Interfaces**: Full-screen, Replit Agent-style conversational UIs for specialized agents (Parity AI for legal documents, Cadence AI for workflows, Forma AI for forms), accessed via dynamic routing with real-time artifact preview.
- **Unified Workflows System**: Visual automation with hierarchical project management (Stages → Steps → Tasks), supporting hybrid execution, triggers, conditions, and automated actions.
- **AI Agent Marketplace & Execution System**: Browsing, installation, and management of AI agents with secure LLM credential storage and flexible pricing models.
- **LLM Configuration Management**: CRUD for AI provider credentials using AES-256-GCM encryption.
- **PKI Digital Signatures**: Tamper-proof document verification using RSA-2048.
- **Secure Document Management**: Encrypted storage, authenticated downloads, and access control.
- **Marketplace System**: Provides templates (Documents, Forms, Workflows) with pricing models, supporting global (Super Admin) and organization-scoped copies.
- **Hierarchical Folder Structure**: Unlimited nesting for content categorization and sharing permissions.
- **Projects Management**: Comprehensive client engagement tracking for ad-hoc work, distinct from workflows, with budget, timeline, and task management.
- **AI Agent Foundry**: System for onboarding, dynamic registration, and deployment of custom AI agents via a manifest-driven architecture.
- **Template Scoping System**: Dual-scope architecture for global and organization-specific templates across various types.

### System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. Security is a core principle, implemented through robust authentication, encryption, and access control, with distinct SaaS-level and tenant-level role separation for multi-tenancy. The Automation Engine supports various action types (create_task, send_notification, run_ai_agent, update_field, wait_delay) with context propagation and multi-tenant security. Individual AI agents are accessed via dynamic routing, with lazy-loaded components for optimal performance.

## External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration.
- **Anthropic Claude API**: AI model integration.
- **Resend**: Transactional email service for user invitations and notifications.
- **Twilio**: SMS service for mobile verification (OTP) and notifications.
- **Multer**: For file uploads.
- **expr-eval**: For secure expression evaluation.
- **Recharts**: Frontend library for data visualizations.