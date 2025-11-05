# Accute - AI-Native Accounting Workflow Automation Platform

### Overview
Accute is an AI-native accounting workflow automation platform for modern accounting firms. It leverages specialized AI agents to automate tasks, enhancing efficiency, ensuring compliance, and improving accounting practices. Key capabilities include multi-agent orchestration, six specialized AI agents (Cadence, Forma, Relay, Parity, Echo, Scribe), an extensive template library, multi-provider AI support, an AI agent marketplace, global payment coverage, and native mobile apps. The platform offers multi-role authentication, forms, workflows, email integration, calendar scheduling, custom workflow building, and secure document management.

### User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance
- **WebSocket Management**: WebSockets now lazy-load on-demand when chat sessions start, not at server startup to prevent initialization errors
- **Subscription System**: Subscription pricing UI and routes disabled per user request

### Recent Changes (November 2025)
- **WebSocket Initialization**: Implemented true lazy-loading for WebSockets. Server attaches an upgrade event listener but only initializes the WebSocketServer on the first `/ws/ai-stream` connection. The first upgrade request is properly handled via `handleUpgrade()` to ensure immediate connection success.
- **Luca Document Access**: Luca agent now loads all organization documents and includes them in its system prompt. When users ask about documents, Luca can reference the available files by name, upload date, and category (up to 50 documents displayed, with indication if more exist).
- **Agent Context Propagation**: WebSocket handler now passes organizationId, userId, and conversationId context to all agents via structured input, enabling document access and context-aware responses.
- **Circular Dependency Fix**: Resolved circular import in Luca backend by using `export * from './handler'` instead of named export, allowing registerRoutes to be properly exported without hanging.
- **Subscription Features Disabled**: All subscription-related UI routes and pages removed from App.tsx per user request:
  - `/subscription-pricing` route removed
  - `/subscription` (select plan) route removed  
  - `/admin/subscriptions` admin pages removed
  - `/admin/subscription-analytics` removed
  - `/admin/subscription-plans` removed
  - `/admin/pricing-regions` removed
  - `/admin/coupons` removed
  - Backend API endpoints remain for future use if needed
- **Message Templates Sidebar Navigation**: Added "Message Templates" to the Communication section of sidebar navigation for easier access to the message template workspace.
- **AI Agent Installation Flow**: Fixed "Install Echo AI" button on Message Templates page to correctly redirect to `/ai-agents` page instead of `/marketplace`.
- **AI Agent Footer Overlap Fix**: Added bottom padding (`pb-20`) to all AI agent interfaces (Echo, Cadence, Forma, Parity, Scribe, Relay, Radar, OmniSpectra) to prevent the "Powered by FinACEverse" footer from covering the chat input box.
- **Template & Document List View with Preview Panel** (November 2025):
  - Converted Message Templates, Documents, and Email Templates from card view to Windows/macOS-style list view
  - Implemented reusable DataTable component with sortable columns, search, and collapsible preview panel
  - Preview panel toggle button (Show/Hide Preview) similar to Windows File Explorer
  - **Preview content only shows in side panel** - removed Preview column from main table
  - Simplified preview panel shows full content details without view mode complexity
  - List views include: sortable columns, search functionality, row selection, and action buttons
  - Empty states provide helpful guidance and quick actions
- **Admin RBAC Enhancement**:
  - Admin and Super Admin users can now edit/delete ALL templates and documents, including global ones
  - **Frontend**: Role-based permission checks added to Message Templates, Documents, and Email Templates pages
    - Edit/Delete buttons only show for: Admins (all items) or non-admins (organization-scoped items only)
    - Preview/Download buttons always visible for all users
  - **Backend**: Server-side authorization enforces admin-only access to global resources
    - Updated `getUser()` method to include role relation via LEFT JOIN
    - Added admin checks on PATCH/DELETE endpoints for message templates, email templates, and documents
    - Non-admin users receive 403 error when attempting to modify global templates/documents via API

### System Architecture

#### UI/UX Decisions
The UI is inspired by Linear and Notion, using the Carbon Design System. It features a Porsche-to-Pink gradient, specific font usage (Orbitron, Inter, Fira Code), a collapsible sidebar, top navigation, card-based dashboards, and data tables. The platform is a responsive Progressive Web App (PWA) for cross-browser and cross-device compatibility, offering a native-like experience with offline support.

#### Technical Implementations
The frontend uses React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend is built with Node.js, Express, and TypeScript. Data persistence is handled by PostgreSQL (Neon) with Drizzle ORM. Authentication uses JWT and bcrypt, with AES-256 encryption, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude. The platform is optimized for Replit's Cloud Run/Autoscale deployment.

#### Feature Specifications
- **Multi-tenant Architecture**: Isolated data and distinct roles for SaaS and tenant levels.
- **Role-Based Access Control**: Four-tier system (Super Admin, Admin, Employee, Client).
- **Client Portal**: Dedicated interface for client-facing interactions.
- **AI Client Onboarding System**: Privacy-first, conversational, AI-driven onboarding.
- **Conversational AI Agent Interfaces**: Full-screen, dynamic conversational UIs for specialized agents.
- **Unified Workflows System**: Visual automation with hierarchical project management and hybrid execution.
- **AI Agent Marketplace & Execution System**: For browsing, installing, and managing AI agents.
- **LLM Configuration Management**: CRUD for AI provider credentials with AES-256-GCM encryption.
- **PKI Digital Signatures**: Tamper-proof document verification using RSA-2048.
- **Secure Document Management**: Encrypted storage, authenticated downloads, and access control.
- **Marketplace System**: Provides templates (Documents, Forms, Workflows) with pricing models.
- **Hierarchical Folder Structure**: Unlimited nesting for content categorization.
- **Projects Management**: Comprehensive client engagement tracking.
- **AI Agent Foundry**: System for onboarding and deployment of custom AI agents.
- **Template Scoping System**: Dual-scope architecture for global and organization-specific templates.
- **Subscription Management System**: Four-tier subscription model (FREE, CORE, AI, EDGE) with regional pricing, prorated upgrades/downgrades, auto-payment, and service pause on payment failure. **User Counting**: Employees (Admin, Employee roles) count toward maxUsers subscription limits. Clients do NOT count toward maxUsers limits.
- **Invoice Generation System**: Auto-generates invoices for subscription events with detailed breakdowns and status tracking.
- **Payment Security**: AES-256-GCM encryption for credentials, HTTPS enforcement, rate limiting, comprehensive security headers, and payment audit logging.

#### System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. Security is paramount, with robust authentication, encryption, and access control, supporting multi-tenancy. The Automation Engine supports various action types (create_task, send_notification, run_ai_agent, update_field, wait_delay) with context propagation and multi-tenant security. AI agents are accessed via dynamic routing with lazy-loaded components.

### External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration (default for AI agents).
- **Anthropic Claude API**: AI model integration.
- **Resend**: Transactional email service.
- **MSG91**: SMS service for OTP verification (India-optimized, supports international).
- **Razorpay**: Payment gateway for subscription billing and one-time payments (India, UAE, Turkey, USA).
- **Gmail API**: Per-user OAuth integration for email account connectivity. System-wide OAuth app credentials (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`) enable each user to connect their own Gmail account. User tokens encrypted with AES-256-GCM. Redirect URI: `https://accute.io/api/email-accounts/oauth/gmail/callback`.
- **Multer**: For file uploads.
- **expr-eval**: For secure expression evaluation.
- **Recharts**: Frontend library for data visualizations.

### AI Agent Configuration
- **Default LLM Provider**: Azure OpenAI configured per organization
- **AI Agents**: All 9 agents (Forma, Cadence, Parity, Echo, Relay, Scribe, Luca, OmniSpectra, Radar) use organization's default LLM configuration
- **Setup**: Run `tsx server/seed-default-llm.ts` to create default Azure OpenAI config for Sterling organization
- **Management**: Admins can configure multiple LLM providers in Settings, set one as default per organization
- **Session Management**: All agents support persistent chat sessions with conversation history
- **Agent Details**:
  - **Forma**: Intelligent form builder for client intake and data collection
    - Supports 30+ field types (text, select, multi-select, radio, email, phone, date, currency, signature, etc.)
    - Smart field type selection based on data requirements
    - Single choice lists → dropdown, Multiple choices → multi-select, Yes/No/NA → radio buttons
    - Never defaults to text fields when more specific types are appropriate
  - **Cadence**: Workflow automation designer
  - **Parity**: Document generation specialist
  - **Echo**: Message template creator
  - **Relay**: Inbox intelligence for email-to-task conversion
  - **Scribe**: Writing and content creation assistant
  - **Luca**: Accounting, finance & taxation expert
  - **OmniSpectra**: Work status tracking and team availability
  - **Radar**: Comprehensive activity logger for legal evidence and client accountability