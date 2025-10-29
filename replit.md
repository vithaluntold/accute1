# Accute - AI-Powered Accounting Workflow Automation Platform

## Overview
Accute is an enterprise-grade AI-powered accounting workflow automation platform. It leverages AI to streamline financial operations, offering multi-role authentication, custom workflow building, an AI agent marketplace, and secure document management. The platform's vision is to provide a comprehensive, secure, and intelligent solution for modern accounting practices, enhancing efficiency and compliance with an "AI-first" approach.

## User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance

## System Architecture

### UI/UX Decisions
The UI is inspired by applications like Linear and Notion, using the Carbon Design System. It features a Porsche-to-Pink gradient, Orbitron and Exo 2 fonts, a collapsible sidebar, top navigation, card-based dashboards, and data tables with sorting and pagination.

### Technical Implementations
The platform uses React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui for the frontend, and Node.js, Express, and TypeScript for the backend. PostgreSQL (Neon) with Drizzle ORM is used for data persistence. Authentication relies on JWT and bcrypt, with AES-256 encryption for sensitive data, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude.

### Feature Specifications
- **Multi-tenant Architecture**: Isolated data for organizations with SaaS-level and tenant-level roles.
- **Role-Based Access Control**: Granular permissions.
- **AI Agent Chat Interface**: Interactive chat with real-time WebSocket streaming for AI agents (Parity, Cadence, Forma, Luca).
- **Unified Workflows System**: Visual automation with hierarchical project management (Stages → Steps → Tasks), supporting hybrid execution, triggers, conditions, and automated actions.
- **AI Agent Marketplace & Execution System**: Browse, install, and manage AI agents with secure LLM credential storage.
- **LLM Configuration Management**: CRUD system for AI provider credentials with AES-256-GCM encryption.
- **PKI Digital Signatures**: Tamper-proof document verification using RSA-2048, meeting eIDAS and ESIGN Act.
- **Secure Document Management**: Encrypted storage, authenticated downloads, and access control.
- **User & Client Management**: Tools for managing users, roles, and client profiles.
- **Audit Trails**: Comprehensive activity logging.
- **Form Builder & Renderer**: Dynamic form creation with 22 field types and conditional logic using `expr-eval`.
- **Polymorphic Tagging System**: Organize resources with tags.
- **Contacts Management**: Manage contacts associated with clients.
- **Clients Management**: CRUD operations for client profiles.
- **Marketplace System**: Template marketplace (Documents, Forms, Pipelines) with pricing models and installation tracking.
- **Workflow Assignment System**: Assign clients to workflows, track progress, and manage status lifecycles.
- **Hierarchical Folder Structure**: Self-referencing folder tree with unlimited nesting, content categorization, and sharing permissions.
- **Auto-Progression Engine**: Cascade automation for workflow progression (checklist → task → step → stage → assignment complete) with configurable actions and progress tracking.

### System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. Security is a core principle, implemented through robust authentication, encryption, and access control, with distinct SaaS-level and tenant-level role separation for multi-tenancy. The Automation Engine supports various action types (create_task, send_notification, run_ai_agent, update_field, wait_delay) with context propagation and multi-tenant security.

## External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration.
- **Anthropic Claude API**: AI model integration.
- **Multer**: For file uploads.
- **expr-eval**: For secure expression evaluation in conditional logic.