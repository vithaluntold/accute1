# Accute - AI-Powered Accounting Workflow Automation Platform

## Overview
Accute is an enterprise-grade AI-powered accounting workflow automation platform designed to streamline financial operations. It provides multi-role authentication, custom workflow building, an AI agent marketplace, and secure document management. The platform aims to be an "AI-first" solution that enhances efficiency, ensures compliance, and significantly improves modern accounting practices.

## User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance

## System Architecture

### UI/UX Decisions
The UI is inspired by applications like Linear and Notion, using the Carbon Design System. It features a Porsche-to-Pink gradient, specific font usage (Orbitron, Inter, Fira Code), a collapsible sidebar, top navigation, card-based dashboards, and data tables. The platform is a responsive PWA, ensuring cross-browser, cross-device compatibility, and native-like experience with offline support.

### Technical Implementations
The frontend uses React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend is built with Node.js, Express, and TypeScript. Data persistence is handled by PostgreSQL (Neon) with Drizzle ORM. Authentication relies on JWT and bcrypt, complemented by AES-256 encryption, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude.

### Feature Specifications
- **Multi-tenant Architecture**: Provides isolated data and distinct SaaS/tenant-level roles.
- **SaaS Platform Administration (Super Admin)**: Offers platform-level management including user/subscription management, support ticket system, marketplace publishing, platform analytics, and specialized access control.
- **Role-Based Access Control**: A four-tier system (Super Admin, Admin, Employee, Client) with UI separation and route protection via `RoleGuard` and `OrganizationRoute` components, ensuring secure and role-aware navigation.
- **Client Portal**: Dedicated client-facing interface with pages for dashboard, documents, tasks, forms, signatures, and messages, offering simplified UI/UX.
- **AI Client Onboarding System**: A privacy-first conversational interface for onboarding, including AI-driven validation and automatic provisioning.
- **AI Agent Chat Interface & Luca AI Chatbot Widget**: Real-time WebSocket streaming for interactive AI agents and a floating, branded chatbot widget.
- **Unified Workflows System**: Visual automation with hierarchical project management (Stages → Steps → Tasks), supporting hybrid execution, triggers, conditions, and automated actions.
- **AI Agent Marketplace & Execution System**: Enables browsing, installation, and management of AI agents with secure LLM credential storage and a comprehensive pricing model (free, per month, per year, per instance, per token, one-time, hybrid).
- **LLM Configuration Management**: CRUD operations for AI provider credentials using AES-256-GCM encryption.
- **PKI Digital Signatures**: Tamper-proof document verification using RSA-2048.
- **Secure Document Management**: Encrypted storage, authenticated downloads, and access control.
- **User & Client Management**: Tools for managing users, roles, and client profiles.
- **Audit Trails**: Comprehensive logging of all activities.
- **Form Builder & Renderer**: Dynamic form creation with 22 field types and conditional logic.
- **Polymorphic Tagging System**: Flexible organization of resources.
- **Marketplace System**: Provides templates (Documents, Forms, Pipelines) with pricing models.
- **Workflow Assignment System**: Manages client assignments, tracks progress, and status lifecycles.
- **Hierarchical Folder Structure**: Self-referencing folder tree with unlimited nesting, content categorization, and sharing permissions.
- **Auto-Progression Engine**: Cascading automation for workflow progression.
- **Analytics Dashboard**: Comprehensive analytics with backend APIs and interactive frontend visualizations.
- **Email Template Management**: System for creating, managing, and customizing email templates with organization-scoped isolation and dynamic placeholders.
- **Automation Configuration UI**: Visual workflow task automation with 10 action types.
- **Email Inbox Integration & AI Email Processor**: OAuth/IMAP email account management with AI processing to convert emails to tasks.
- **Assignment Detail Page & Kanban Board**: Hierarchical workflow progress tracking and drag-and-drop assignment management.
- **Assignment Status Bot**: AI-powered conversational assistant for assignment queries.
- **Task Ingestion System**: Multi-source task creation with organization-scoped security.
- **Projects Management**: Comprehensive client engagement tracking for ad-hoc work, distinct from workflow-based assignments, featuring budget tracking, timeline management, priority/status management, team assignment, and a task Kanban board.
- **AI Agent Foundry**: A system for onboarding, dynamic registration, and deployment of custom AI agents via a manifest-driven architecture, supporting various pricing models and multi-tenant/user-level access control.
- **Template Scoping System**: Dual-scope template architecture with global (super admin, visible to all) and organization (admin, internal only) templates for workflows, forms, email templates, message templates, and document templates, with explicit scope field in database schema and UI badges for visual identification.

### System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. Security is a core principle, implemented through robust authentication, encryption, and access control, with distinct SaaS-level and tenant-level role separation for multi-tenancy. The Automation Engine supports various action types (create_task, send_notification, run_ai_agent, update_field, wait_delay) with context propagation and multi-tenant security.

## External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration.
- **Anthropic Claude API**: AI model integration.
- **Multer**: For file uploads.
- **expr-eval**: For secure expression evaluation.
- **Recharts**: Frontend library for data visualizations.