# Accute - AI-Powered Accounting Workflow Automation Platform

## Overview
Accute is an enterprise-grade AI-powered accounting workflow automation platform designed to streamline financial operations. It offers multi-role authentication, custom workflow building, an AI agent marketplace, and secure document management. The platform's core purpose is to provide a comprehensive, secure, and intelligent "AI-first" solution that enhances efficiency and ensures compliance for modern accounting practices.

## User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance

## System Architecture

### UI/UX Decisions
The UI draws inspiration from applications like Linear and Notion, utilizing the Carbon Design System. Key elements include a Porsche-to-Pink gradient, Orbitron and Exo 2 fonts, a collapsible sidebar, top navigation, card-based dashboards, and data tables with sorting and pagination. The platform is also implemented as a Progressive Web App (PWA) for a native-like experience across mobile and desktop, featuring a manifest, service worker for offline support, install prompts, and mobile-optimized navigation and installation guides.

### Technical Implementations
The frontend is built with React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend uses Node.js, Express, and TypeScript. Data persistence is managed by PostgreSQL (Neon) with Drizzle ORM. Authentication incorporates JWT and bcrypt, complemented by AES-256 encryption for sensitive data, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude.

### Feature Specifications
- **Multi-tenant Architecture**: Isolated data and distinct SaaS/tenant-level roles.
- **Role-Based Access Control**: Granular permission management.
- **AI Agent Chat Interface**: Real-time WebSocket streaming for interactive AI agents (Parity, Cadence, Forma, Luca).
- **Luca AI Chatbot Widget**: TaxDome-style floating chat assistant in bottom-right corner, persists across all authenticated pages with real-time AI responses.
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