# Accute - AI-Powered Accounting Workflow Automation Platform

## Overview
Accute is an enterprise-grade AI-powered accounting workflow automation platform designed to streamline financial operations. It offers multi-role authentication, custom workflow building, an AI agent marketplace, and secure document management. The platform's core purpose is to provide a comprehensive, secure, and intelligent "AI-first" solution that enhances efficiency and ensures compliance for modern accounting practices.

## Recent Updates (October 2025)
### New Features Implemented:
1. **Automation Configuration UI** - Visual workflow task automation with 10 action types
2. **Email Inbox Integration** - OAuth/IMAP email account management with AI processing
3. **AI Email Processor** - Convert emails to tasks using LLM analysis
4. **Assignment Detail Page** - Hierarchical workflow progress tracking (Stages → Steps → Tasks)
5. **Kanban Board** - Drag-and-drop assignment management across workflow stages
6. **Analytics Dashboard** - Comprehensive metrics with role-based filtering (All/User/Admin/Team Manager)
7. **Assignment Status Bot** - AI-powered conversational assistant for assignment queries at /assignment-bot
8. **AI Client Onboarding** - Privacy-first conversational client onboarding with dynamic country-specific tax field collection
9. **E2E Test Coverage** - Playwright-based testing for core features

### Configuration Requirements:
- **LLM Provider Setup Required**: Assignment Status Bot, AI Email Processor, and AI Client Onboarding require LLM configuration (OpenAI/Azure OpenAI/Anthropic) in Settings → LLM Configurations. Create a default LLM config to enable these features.

## User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance

## System Architecture

### UI/UX Decisions
The UI draws inspiration from applications like Linear and Notion, utilizing the Carbon Design System. Key elements include a Porsche-to-Pink gradient, Orbitron and Exo 2 fonts, a collapsible sidebar with organized navigation categories (Overview, Workflow Management, AI & Automation, Documents, Financial, Communication, Client Management, Administration), top navigation, card-based dashboards, and data tables with sorting and pagination. The platform is fully cross-browser and cross-device compatible with:
- Responsive design across all screen sizes (mobile, tablet, desktop)
- iOS Safari safe area support for notched devices
- Android Chrome dynamic viewport handling
- Touch-optimized UI with 44px minimum tap targets on mobile
- Prevented zoom on input focus (16px font size)
- Smooth scrolling with -webkit-overflow-scrolling
- Global responsive CSS in client/src/styles/global-responsive.css

The platform is implemented as a Progressive Web App (PWA) for a native-like experience across mobile and desktop, featuring a manifest, service worker for offline support, install prompts, and mobile-optimized navigation and installation guides.

### Technical Implementations
The frontend is built with React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend uses Node.js, Express, and TypeScript. Data persistence is managed by PostgreSQL (Neon) with Drizzle ORM. Authentication incorporates JWT and bcrypt, complemented by AES-256 encryption for sensitive data, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude.

### Feature Specifications
- **Multi-tenant Architecture**: Isolated data and distinct SaaS/tenant-level roles.
- **Role-Based Access Control**: Granular permission management.
- **AI Client Onboarding System**: True privacy-first conversational interface at /client-onboarding where AI acts as a GUIDE ONLY, never seeing sensitive data. AI asks qualifying questions (country, business type, industry) and provides metadata to dynamically show appropriate form fields. ALL sensitive data (names, emails, addresses, AND tax IDs like PAN/GST/EIN/SSN/VAT/UTR) collected via encrypted forms, NEVER sent to AI model. System supports 10+ countries (India, USA, UK, UAE, Australia, Canada, etc.) with dynamic tax field visibility based on AI guidance. Complete audit trail stored in database (client_onboarding_sessions, onboarding_messages tables). Updated October 2025 to eliminate ALL sensitive data exposure to AI models.
- **AI Agent Chat Interface**: Real-time WebSocket streaming for interactive AI agents (Parity, Cadence, Forma, Luca).
- **Luca AI Chatbot Widget**: TaxDome-style floating chat assistant in bottom-right corner with custom Luca logo branding. Features cross-browser and cross-device compatibility including:
  - Responsive design with mobile-first approach (full-screen on mobile, dialog on desktop)
  - iOS Safari safe area support for notched devices
  - WebKit-specific fixes for iOS/Safari positioning and scrolling
  - Android Chrome dynamic viewport height support
  - Touch-optimized interactions with no blue tap highlights
  - Prevents iOS zoom on input focus (16px font size)
  - Keyboard-aware input handling (Enter to send on desktop, normal on mobile)
  - Body scroll prevention when dialog is open on mobile
  - Smooth scrolling with -webkit-overflow-scrolling for iOS
  - High z-index (9999) to float above all page elements
  - Custom CSS compatibility layer in client/src/styles/luca-widget.css
- **Unified Workflows System**: Visual automation with hierarchical project management (Stages → Steps → Tasks), supporting hybrid execution, triggers, conditions, and automated actions.
- **AI Agent Marketplace & Execution System**: Enables browsing, installation, and management of AI agents with secure LLM credential storage.
- **LLM Configuration Management**: CRUD operations for AI provider credentials with AES-256-GCM encryption.
- **PKI Digital Signatures**: Tamper-proof document verification using RSA-2048, compliant with eIDAS and ESIGN Act.
- **Secure Document Management**: Encrypted storage, authenticated downloads, and access control.
- **User & Client Management**: Tools for managing users, roles, and client profiles.
- **Audit Trails**: Comprehensive logging of all activities.
- **Form Builder & Renderer**: Dynamic form creation with 22 field types and conditional logic.
- **Polymorphic Tagging System**: Organize resources with flexible tagging.
- **Marketplace System**: Provides templates (Documents, Forms, Pipelines) with pricing models and installation tracking.
- **Workflow Assignment System**: Assign clients to workflows, track progress, and manage status lifecycles.
- **Hierarchical Folder Structure**: Self-referencing folder tree with unlimited nesting, content categorization, and sharing permissions.
- **Auto-Progression Engine**: Cascading automation for workflow progression.
- **Analytics Dashboard**: Comprehensive analytics with backend API endpoints and interactive frontend visualizations.

### System Design Choices
The project is organized into `client/`, `server/`, and `shared/` directories. Security is a foundational principle, implemented through robust authentication, encryption, and access control, with distinct SaaS-level and tenant-level role separation for multi-tenancy. The Automation Engine supports various action types (create_task, send_notification, run_ai_agent, update_field, wait_delay) with context propagation and multi-tenant security.

## External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration.
- **Anthropic Claude API**: AI model integration.
- **Multer**: For file uploads.
- **expr-eval**: Used for secure expression evaluation in conditional logic.
- **Recharts**: Frontend library for data visualizations and charts.