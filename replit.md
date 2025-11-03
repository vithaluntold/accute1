# Accute - AI-Native Accounting Workflow Automation Platform

### Overview
Accute is the world's first AI-native accounting workflow automation platform for modern accounting firms. Unlike legacy competitors (TaxDome, Karbon, Canopy) that have forms, workflows, and inbox features requiring **manual operation**, Accute has specialized AI agents that **AUTOMATE** these features.

**Core Differentiators:**
1. **Roundtable AI Multi-Agent Orchestration** (2 years ahead of market) - Coordinates multiple AI agents to complete complex tasks automatically
2. **Six Specialized AI Agents for Automation:**
   - **Cadence** - Automates workflow creation, assignment, and progression
   - **Forma** - Automates intelligent form generation and population
   - **Relay** - Automates email drafting, follow-ups, and communication
   - **Parity** - Automates data extraction from documents
   - **Echo** - Automates data validation and quality control
   - **Scribe** - Automates document drafting and content generation
3. **10,000+ Professional Templates** - Largest accounting template library covering questionnaires, engagement letters, email templates, message templates, and workflow templates across all entity types, industries, and jurisdictions
4. **Multi-Provider AI** - Never locked into single vendor (OpenAI, Anthropic, Azure)
5. **AI Agent Marketplace** - Install and customize specialized agents like apps
6. **Global Payment Coverage** - Razorpay for India, UAE, Turkey, USA markets
7. **Native Mobile Apps** - React Native + Expo for iOS and Android

**Platform Capabilities:**
Accute offers multi-role authentication, Forms (organizers), Workflows (pipelines), Email integration (inbox), Calendar scheduling, Mobile apps, custom workflow building, an AI agent marketplace, and secure document management. The platform's core purpose is to be an "AI-native" solution where AI agents automate features that competitors require manual operation, enhancing efficiency, ensuring compliance, and significantly improving modern accounting practices.

### User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance

### Persistent Seed Accounts (Roleplay Scenario)

#### Organization: Sterling Accounting Firm
- **Slug**: sterling-accounting
- **Description**: A professional accounting firm serving technology companies

#### Seed User Accounts

**Super Admin (Platform-level)**
- Email: superadmin@accute.com
- Password: SuperAdmin123!
- Name: Super Admin
- Role: Super Admin (platform management)
- Organization: None (platform-scoped)

**Admin (Organization Owner)**
- Email: admin@sterling.com
- Password: Admin123!
- Name: Sarah Sterling
- Role: Admin
- Organization: Sterling Accounting Firm
- Description: Firm owner and administrator

**Employee (Team Member)**
- Email: employee@sterling.com
- Password: Employee123!
- Name: John Matthews
- Role: Employee
- Organization: Sterling Accounting Firm
- Description: Senior accountant working at the firm

**Client User (Client Portal Access)**
- Email: david@technova.com
- Password: Client123!
- Name: David Chen
- Role: Client
- Organization: Sterling Accounting Firm
- Description: CFO of TechNova Solutions with portal access

#### Client Company
- **Company**: TechNova Solutions
- **Industry**: Technology
- **Status**: Active
- **Tax ID**: 94-7654321
- **Assigned To**: Sarah Sterling (Admin)
- **Description**: SaaS company requiring year-end tax preparation

#### Contact (Point of Contact)
- **Name**: David Chen
- **Title**: CFO
- **Email**: david@technova.com
- **Primary Contact**: Yes
- **Description**: Primary contact for all accounting matters

This realistic roleplay scenario demonstrates the complete multi-tenant workflow where:
1. Sarah Sterling (Admin) owns and manages Sterling Accounting Firm
2. John Matthews (Employee) works as a team member at the firm
3. TechNova Solutions is onboarded as a client of the firm
4. David Chen serves as both the company contact and has portal access to track work

### System Architecture

#### UI/UX Decisions
The UI is inspired by applications like Linear and Notion, utilizing the Carbon Design System. It features a Porsche-to-Pink gradient, specific font usage (Orbitron, Inter, Fira Code), a collapsible sidebar, top navigation, card-based dashboards, and data tables. The platform is a responsive PWA, ensuring cross-browser, cross-device compatibility, and a native-like experience with offline support.

#### Technical Implementations
The frontend uses React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend is built with Node.js, Express, and TypeScript. Data persistence is handled by PostgreSQL (Neon) with Drizzle ORM. Authentication relies on JWT and bcrypt, complemented by AES-256 encryption, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude. The platform is optimized for Replit's Cloud Run/Autoscale deployment, featuring lazy database initialization, immediate health check responses, and server listening before heavy initialization.

#### Feature Specifications
- **Multi-tenant Architecture**: Isolated data and distinct SaaS/tenant-level roles.
- **Role-Based Access Control**: Four-tier system (Super Admin, Admin, Employee, Client) with UI separation and route protection.
- **Client Portal**: Dedicated client-facing interface for documents, tasks, forms, signatures, and messages.
- **AI Client Onboarding System**: Privacy-first conversational onboarding with AI-driven validation and provisioning.
- **Conversational AI Agent Interfaces**: Full-screen, Replit Agent-style conversational UIs for specialized agents, accessed via dynamic routing with real-time artifact preview.
- **Unified Workflows System**: Visual automation with hierarchical project management, supporting hybrid execution, triggers, conditions, and automated actions.
- **AI Agent Marketplace & Execution System**: Browsing, installation, and management of AI agents with secure LLM credential storage and flexible pricing models.
- **LLM Configuration Management**: CRUD for AI provider credentials using AES-256-GCM encryption.
- **PKI Digital Signatures**: Tamper-proof document verification using RSA-2048.
- **Secure Document Management**: Encrypted storage, authenticated downloads, and access control.
- **Marketplace System**: Provides templates (Documents, Forms, Workflows) with pricing models, supporting global (Super Admin) and organization-scoped copies.
- **Hierarchical Folder Structure**: Unlimited nesting for content categorization and sharing permissions.
- **Projects Management**: Comprehensive client engagement tracking for ad-hoc work, distinct from workflows, with budget, timeline, and task management.
- **AI Agent Foundry**: System for onboarding, dynamic registration, and deployment of custom AI agents via a manifest-driven architecture.
- **Template Scoping System**: Dual-scope architecture for global and organization-specific templates across various types.

#### System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. Security is a core principle, implemented through robust authentication, encryption, and access control, with distinct SaaS-level and tenant-level role separation for multi-tenancy. The Automation Engine supports various action types (create_task, send_notification, run_ai_agent, update_field, wait_delay) with context propagation and multi-tenant security. Individual AI agents are accessed via dynamic routing, with lazy-loaded components for optimal performance.

### External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration.
- **Anthropic Claude API**: AI model integration.
- **Resend**: Transactional email service for user invitations and notifications.
- **Twilio**: SMS service for mobile verification (OTP) and notifications.
- **Razorpay**: Payment gateway for subscription billing and one-time payments (India, UAE, Turkey, USA).
- **Multer**: For file uploads.
- **expr-eval**: For secure expression evaluation.
- **Recharts**: Frontend library for data visualizations.

### Payment Integration
- **Payment Gateway**: Razorpay
  - Supports India, UAE, Turkey, and USA markets
  - Handles subscription billing (monthly/yearly)
  - One-time payment support for invoices
  - Secure webhook verification for payment events
  - PCI-compliant payment processing
  - Environment Variables Required:
    - `RAZORPAY_KEY_ID`: Razorpay API Key ID
    - `RAZORPAY_KEY_SECRET`: Razorpay API Key Secret
    - `RAZORPAY_WEBHOOK_SECRET`: Webhook signature verification secret (optional)
  - Key Features:
    - Customer creation and management
    - Subscription plan creation
    - Recurring billing automation
    - Payment verification and signature validation
    - Webhook handling for payment events
    - Support for INR, USD, AED, and other currencies

### Mobile Application
- **Technology**: React Native with Expo (managed workflow, SDK 54)
- **Navigation**: Expo Router (file-based routing with TypeScript)
- **State Management**: React Query v5 for server state, React Context for auth
- **Authentication**: JWT tokens stored securely using Expo SecureStore
- **API Client**: Centralized HTTP client with automatic token management and error handling
- **Architecture**: Separate mobile/ directory with (auth), (tabs), and (manager) route groups
- **Core Features**:
  - Secure login with JWT authentication
  - Dashboard with workflow and task statistics
  - Tasks management with status and priority filtering
  - Teams browsing with member counts
  - Manager Dashboard for reportee task oversight
  - Settings and profile management
- **Platform Support**: iOS and Android (single codebase)
- **Development**: Runs on iOS Simulator, Android Emulator, and physical devices via Expo Go
- **Production**: Ready for EAS Build and deployment to App Store/Play Store