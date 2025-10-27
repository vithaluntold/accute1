# Accute - AI-Powered Accounting Workflow Automation Platform

## Overview
Accute is an enterprise-grade AI-powered accounting workflow automation platform designed to streamline financial operations. It offers multi-role authentication (Super Admin, Admin, Employee, Client), custom workflow building, an AI agent marketplace, and secure document management. The platform aims to be an "AI-first" solution, leveraging advanced AI capabilities for automation and insights to provide significant advantages over traditional accounting software.

## User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance

## System Architecture

### UI/UX Decisions
The platform features a clean, modern UI inspired by productivity applications like Linear and Notion, utilizing the Carbon Design System for data-heavy interfaces. It uses a primary color gradient from Porsche (#e5a660) to Pink (#d76082). Key UI components include a collapsible sidebar, a top navigation with workspace switcher, card-based dashboards, and data tables with sorting and pagination. Fonts are Orbitron (display) and Exo 2 (body).

### Technical Implementations
Accute is built with React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui for the frontend; Node.js, Express, and TypeScript for the backend. It uses PostgreSQL (Neon) with Drizzle ORM for the database. Authentication is handled via JWT and bcrypt, with AES-256 encryption for sensitive data, RBAC, rate limiting, and SQL injection prevention ensuring robust security. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude.

### Feature Specifications
- **Multi-tenant Architecture**: Isolated data for multiple organizations.
- **Role-Based Access Control**: Granular permissions for Super Admin, Admin, Employee, and Client roles.
- **Workflow Automation**: JSON node-based workflow templates.
- **AI Agent Marketplace**: Browse, install, and manage AI agents with defined directories and pricing.
- **Secure Document Management**: Encrypted storage, authenticated downloads, and organization/client-level access control.
- **User & Client Management**: Tools for managing users, roles, and client profiles, including invitation-based registration.
- **Audit Trails**: Comprehensive activity logging for compliance.
- **Super Admin Onboarding**: Secure, single-use key-based registration for initial setup.
- **Form Builder & Renderer**: Dynamic form creation with 22 field types including text, email, number, date, select, checkbox, radio, file upload, signature, rating, matrix, slider, and more. Features comprehensive conditional logic system that evaluates expressions safely using `expr-eval` library (no global scope access, no arbitrary code execution). Conditional rules support show/hide/require/disable actions on target fields based on real-time form value evaluation. Rules are configured via intuitive UI with live expression validation, stored in database, and evaluated reactively in form preview/submission. Includes dynamic Zod schema generation that adapts to conditional requirements and secure backend submission with multi-tenant isolation.
- **Polymorphic Tagging System**: Organize resources like documents, clients, and contacts with tags, including CRUD operations and permissions.
- **Contacts Management**: System for managing contacts associated with clients, including primary contact designation and permissions.
- **Clients Management**: Comprehensive CRUD operations for client profiles with multi-tenant security and permissions.
- **Hierarchical Pipeline Builder**: Sophisticated project management system with **Stages → Steps → Tasks → Subtasks/Checklists** hierarchy. Features include: user assignment to tasks and subtasks, manual and automated (AI-powered) tasks, progression logic requiring completion of all tasks/checklists before advancing, priority levels, status tracking, and comprehensive CRUD operations at every level. Pipelines support multi-tenant isolation with granular RBAC permissions for create, view, update, and delete operations. **Task Reminder System**: Configure reminders for tasks with due dates. Features include: customizable reminder duration (15 minutes to 1 week before due date), granular notification settings to notify assigned user, manager/admin, and/or client (if client is assigned), automated reminder processing endpoint (`POST /api/tasks/process-reminders`), and notification creation for selected recipients. Reminders are sent once per day maximum and track last sent timestamp to prevent spam.

### System Design Choices
The project is structured into `client/` (frontend), `server/` (backend), and `shared/` (common types/schemas). The database schema includes core tables for users, organizations, roles, permissions, sessions, and feature-specific tables for workflows, AI agents, documents, forms, tags, contacts, and pipelines (with related tables: pipelineStages, pipelineSteps, pipelineTasks, taskSubtasks, taskChecklists). Security is a paramount design principle, with robust authentication, encryption, and access control implemented throughout the system.

## External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration.
- **Anthropic Claude API**: AI model integration.
- **Multer**: Node.js middleware for `multipart/form-data` (file uploads).
- **expr-eval**: Secure expression evaluation for conditional logic.