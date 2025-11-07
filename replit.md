# Accute - AI-Native Accounting Workflow Automation Platform

### Overview
Accute is an AI-native accounting workflow automation platform designed for modern accounting firms. It leverages specialized AI agents to automate tasks, enhancing efficiency, ensuring compliance, and improving accounting practices. The platform features multi-agent orchestration, six core specialized AI agents (Cadence, Forma, Relay, Parity, Echo, Scribe), an extensive template library, multi-provider AI support, and an AI agent marketplace. It offers global payment coverage, native mobile apps, multi-role authentication, custom workflow building, and secure document management. Accute aims to revolutionize accounting workflows through AI-driven automation.

### User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance
- WebSocket Management: WebSockets now lazy-load on-demand when chat sessions start, not at server startup to prevent initialization errors
- Subscription System: Subscription pricing UI and routes disabled per user request
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

### System Architecture

#### UI/UX Decisions
The UI draws inspiration from Linear and Notion, utilizing the Carbon Design System. It features a Porsche-to-Pink gradient, specific fonts (Orbitron, Inter, Fira Code), a collapsible sidebar, top navigation, card-based dashboards, and data tables. The platform is implemented as a responsive Progressive Web App (PWA) for broad compatibility and a native-like experience.

#### Technical Implementations
The frontend is built with React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend uses Node.js, Express, and TypeScript. Data is persisted in PostgreSQL (Neon) via Drizzle ORM. Authentication relies on JWT and bcrypt, complemented by AES-256 encryption, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude. The platform is optimized for Replit's Cloud Run/Autoscale.

#### Feature Specifications
- **Multi-tenant Architecture**: Provides isolated data and distinct roles.
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
- **Multi-Factor Authentication (MFA)**: TOTP-based MFA using Google Authenticator/Authy. Features include QR code setup, 10 backup codes (bcrypt hashed), trusted devices (30-day expiry), device fingerprinting, and AES-256-GCM encrypted TOTP secrets.
- **Comprehensive Pricing & Subscription Management**: Enterprise-grade pricing system with product families for feature bundling, SKU-based plans supporting fixed/usage-based/hybrid pricing models, add-ons with per-unit pricing, time-limited coupons and discounts, regional pricing multipliers, and volume-based tiers. Super admin manages global product catalog while organizations subscribe and purchase add-ons.
- **Multi-Gateway Payment Processing**: Organizations configure their own payment gateways (Razorpay, Stripe, PayU, Payoneer) with AES-256-GCM encrypted credentials. Supports auto-sweep, saved payment methods, and multi-currency processing. Platform subscriptions use Razorpay; organizations can use any configured gateway for client payments.
- **Service Plans Marketplace (Fiverr-style)**: Admins create service offerings with fixed/hourly/custom pricing, tiered packages (Basic/Standard/Premium), deliverables tracking, revision limits, client requirements, and review/rating system. Clients browse marketplace, purchase services, track progress, and leave reviews. Service plan purchases integrate with payment gateways and generate invoices.
- **Multi-Tier Authorization System**: Enterprise-grade security for service plan purchases with 7-layer protection: (1) JWT authentication, (2) RBAC permission checks, (3) client existence validation, (4) role verification, (5) platform admin bypass, (6) organization scoping, (7) user-client assignment gating. Prevents cross-organization data leakage and lateral movement within organizations.
- **Subscription-Based Feature Gating**: Comprehensive feature visibility control system with backend middleware (`requireFeature`, `requireResourceLimit`) and frontend hooks (`useFeatureAccess`, `useResourceLimit`, `useCanCreate`) to manage access to features and enforce resource quotas based on subscription plans. Includes `<FeatureGate>` and `<ResourceLimitBadge>` UI components for seamless user experience. Works alongside RBAC for multi-layered authorization. Platform admins bypass all gates. Features include: workflows, ai_agents, signatures, analytics, custom_branding, api_access, sso, advanced_reporting, white_label, priority_support, automations, integrations, team_collaboration, time_tracking. Resource limits: maxUsers, maxClients, maxStorage, maxWorkflows, maxAIAgents.

#### System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. Security is a core focus, with robust authentication, encryption, and multi-tenancy support. The Automation Engine supports various action types (e.g., create_task, run_ai_agent) with context propagation. AI agents are accessed via dynamic routing with lazy-loaded components. A centralized `LLMConfigService` manages all LLM configurations, providing a single source of truth with caching and cache invalidation.

### External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration (default for AI agents).
- **Anthropic Claude API**: AI model integration.
- **Resend**: Transactional email service.
- **MSG91**: SMS service for OTP verification.
- **Razorpay**: Payment gateway.
- **Gmail API**: Per-user OAuth integration for email account connectivity.
- **Multer**: For file uploads.
- **expr-eval**: For secure expression evaluation.
- **Recharts**: Frontend library for data visualizations.