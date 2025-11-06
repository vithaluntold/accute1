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

- **AI Agent Database Cleanup** (November 6, 2025):
  - **Removed duplicate/unneeded agents from database**: Deleted 7 agents from `ai_agents` table:
    - Invoice Processor (invoice-processor-58e45b3d)
    - OmniSpectra (omnispectra)
    - Parity duplicate with empty slug
    - Parity AI Accountant Example (parity-example)
    - Reconciliation Assistant (reconciliation-assistant-9a18b77f)
    - Tax Compliance Advisor (tax-compliance-advisor-bf82a991)
    - Work Status Bot (work-status-bot)
  - **8 Active Agents**: Cadence, Scribe, Forma, Echo, Parity AI, Luca, Relay, Radar
  - **No orphaned installations**: Verified no broken references in `ai_agent_installations` table
  - **Result**: Agent Marketplace now displays only functional, production-ready agents
- **AI Roundtable WebSocket Fix** (November 6, 2025):
  - **Fixed layout overflow**: Changed roundtable page from `h-screen` to `h-full` to properly fit within app layout
  - **Added footer clearance**: Main content area now has `pb-20` padding on desktop to prevent overlap with FinACEverse footer
  - **Enabled Roundtable WebSocket**: Uncommented and initialized `setupRoundtableWebSocket` in server startup
  - **Implemented agent responses**: Added `processUserMessage` method to orchestrator to queue agent tasks when users send messages
  - **Added agent execution**: Created `executeAgentTasks` function in WebSocket handler to run agents and broadcast responses
  - **Connection status**: WebSocket now properly shows "Connected" status instead of "Disconnected"
  - **Message triggering**: User messages now trigger active agents to respond in the roundtable conversation
  - **Agent integration**: Uses existing agent-loader to execute agents (Luca, Cadence, Forma, Parity) with roundtable context

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