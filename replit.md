# Accute - AI-Powered Accounting Workflow Automation Platform

## Overview
Accute is an enterprise-grade AI-powered accounting workflow automation platform designed to streamline financial operations. It offers multi-role authentication, custom workflow building, an AI agent marketplace, and secure document management. The platform's core purpose is to provide a comprehensive, secure, and intelligent "AI-first" solution that enhances efficiency and ensures compliance for modern accounting practices. It aims to significantly improve efficiency and compliance in accounting practices.

## User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance

## System Architecture

### UI/UX Decisions
The UI draws inspiration from applications like Linear and Notion, utilizing the Carbon Design System. Key elements include a Porsche-to-Pink gradient, Orbitron and Exo 2 fonts, a collapsible sidebar with organized navigation, top navigation, card-based dashboards, and data tables with sorting and pagination. The platform is fully cross-browser and cross-device compatible, implemented as a Progressive Web App (PWA) for a native-like experience with responsive design, offline support, and mobile-optimized navigation.

### Technical Implementations
The frontend is built with React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend uses Node.js, Express, and TypeScript. Data persistence is managed by PostgreSQL (Neon) with Drizzle ORM. Authentication incorporates JWT and bcrypt, complemented by AES-256 encryption for sensitive data, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude.

### Feature Specifications
- **Multi-tenant Architecture**: Isolated data and distinct SaaS/tenant-level roles.
- **Role-Based Access Control**: Granular permission management.
- **Client Portal Task System**: Unified task management system visible in client portal with multi-source task ingestion (employee messages, workflow tasks, form/document requests), source tracking, follow-up scheduling, and escalation rules.
- **AI Client Onboarding System**: Privacy-first conversational interface for client onboarding, dynamically collecting country-specific tax fields with AI-driven validation, and automatic contact/portal access provisioning.
- **AI Agent Chat Interface**: Real-time WebSocket streaming for interactive AI agents (Parity, Cadence, Forma, Luca).
- **Luca AI Chatbot Widget**: A floating, branded chat assistant with cross-browser and cross-device compatibility.
- **Unified Workflows System**: Visual automation with hierarchical project management (Stages → Steps → Tasks), supporting hybrid execution, triggers, conditions, and automated actions.
- **AI Agent Marketplace & Execution System**: Enables browsing, installation, and management of AI agents with secure LLM credential storage.
- **LLM Configuration Management**: CRUD operations for AI provider credentials with AES-256-GCM encryption.
- **PKI Digital Signatures**: Tamper-proof document verification using RSA-2048.
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
- **Email Template Management**: Complete system for creating, managing, and customizing email templates with organization-scoped isolation, dynamic placeholders, branding configuration, and live preview.
- **Automation Configuration UI**: Visual workflow task automation with 10 action types.
- **Email Inbox Integration**: OAuth/IMAP email account management with AI processing.
- **AI Email Processor**: Converts emails to tasks using LLM analysis.
- **Assignment Detail Page**: Hierarchical workflow progress tracking (Stages → Steps → Tasks).
- **Kanban Board**: Drag-and-drop assignment management across workflow stages.
- **Assignment Status Bot**: AI-powered conversational assistant for assignment queries.
- **Task Ingestion System**: Multi-source task creation with organization-scoped security, including workflow tasks, message-based tasks, and form request tasks.
- **Projects Management**: Comprehensive client engagement tracking system distinct from workflow-based assignments. Features include:
  - **Purpose**: Manage ad-hoc client work, consulting engagements, and projects outside standardized workflows
  - **Client Linkage**: Associate projects with specific clients for centralized engagement tracking
  - **Budget Tracking**: Set project budgets and track actual costs against estimates with visual progress indicators
  - **Timeline Management**: Define start dates, due dates, and track project completion
  - **Priority & Status Management**: Categorize projects (Low/Medium/High/Urgent priority, Active/On Hold/Completed/Cancelled status)
  - **Team Assignment**: Assign project owners from your team for accountability
  - **Task Kanban Board**: Visual drag-and-drop task management across four columns (To Do, In Progress, Review, Completed)
  - **Task Details**: Each task includes title, description, assignee, priority, due date, estimated/actual hours
  - **Organization Scoping**: All projects and tasks isolated by organizationId for multi-tenant security
  - **Database Schema**: `projects` table (engagement metadata) and `project_tasks` table (individual deliverables)
  - **Integration**: Complements workflow-based Assignments by handling non-standardized client work
  - **Use Cases**: One-off consulting projects, custom client requests, internal initiatives, engagements without predefined workflows

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