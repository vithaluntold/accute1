# Accute - AI-Powered Accounting Workflow Automation Platform

## Overview
Accute is an enterprise-grade AI-powered accounting workflow automation platform designed to streamline financial operations. It offers multi-role authentication, custom workflow building, an AI agent marketplace, and secure document management. The platform aims to be an "AI-first" solution, leveraging advanced AI capabilities for automation and insights to provide significant advantages over traditional accounting software. Its business vision is to provide a comprehensive, secure, and intelligent platform for modern accounting practices, enhancing efficiency and compliance.

## User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance

## System Architecture

### UI/UX Decisions
The platform features a clean, modern UI inspired by productivity applications like Linear and Notion, utilizing the Carbon Design System. It uses a primary color gradient from Porsche (#e5a660) to Pink (#d76082), with Orbitron (display) and Exo 2 (body) fonts. Key UI components include a collapsible sidebar, top navigation with workspace switcher, card-based dashboards, and data tables with sorting and pagination.

### Technical Implementations
Accute is built with React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui for the frontend; Node.js, Express, and TypeScript for the backend. PostgreSQL (Neon) with Drizzle ORM is used for the database. Authentication is handled via JWT and bcrypt, with AES-256 encryption for sensitive data, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude.

### Feature Specifications
- **Multi-tenant Architecture**: Isolated data for multiple organizations with distinct SaaS-level (Super Admin) and tenant-level (Admin, Employee, Client) role separation and permission namespaces.
- **Role-Based Access Control**: Granular permissions for platform and tenant roles, preventing privilege escalation.
- **AI Agent Chat Interface with WebSocket Streaming**: Interactive chat for AI agents (Parity, Cadence, Forma) with real-time bidirectional streaming, supporting OpenAI, Azure OpenAI, and Anthropic. Features include word-by-word text appearance, context-aware conversations, and robust error handling.
- **Unified Workflows System**: Combines node-based visual automation with hierarchical project management (Stages → Steps → Tasks). Supports hybrid execution (manual and automated tasks), triggers, conditions, automated actions, and multi-tenant RBAC. Includes a task reminder system.
- **AI Agent Marketplace & Execution System**: Browse, install, and manage AI agents, supporting user-configured LLM credentials with AES-256 encrypted storage. Four production-ready agents (Kanban View, Cadence, Parity, Forma) are available.
- **LLM Configuration Management**: CRUD system for secure management of AI provider credentials (OpenAI, Anthropic, Azure OpenAI) with AES-256-GCM encryption and real-time connection health checks.
- **PKI Digital Signatures for Document Security**: Enterprise-grade tamper-proof document verification using RSA-2048 cryptographic signatures, with per-organization RSA key pair management encrypted at rest, meeting eIDAS and ESIGN Act requirements.
- **Secure Document Management**: Encrypted storage, authenticated downloads, organization/client-level access control, and tamper-proof verification with digital signatures.
- **User & Client Management**: Tools for managing users, roles, and client profiles, including invitation-based registration.
- **Audit Trails**: Comprehensive activity logging for compliance.
- **Super Admin Onboarding**: Secure, single-use key-based registration for initial setup.
- **Form Builder & Renderer**: Dynamic form creation with 22 field types and a comprehensive, secure conditional logic system using `expr-eval` for real-time field manipulation, dynamic Zod schema generation, and multi-tenant isolated backend submission.
- **Polymorphic Tagging System**: Organize resources with tags, including CRUD operations and permissions.
- **Contacts Management**: System for managing contacts associated with clients.
- **Clients Management**: Comprehensive CRUD operations for client profiles with multi-tenant security and permissions.

### System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. The database schema includes core tables for users, organizations, roles (with `scope` for platform/tenant separation), permissions, sessions, and feature-specific tables. Security is a paramount design principle, implementing robust authentication, encryption, and access control with a complete SaaS-level vs tenant-level role separation for multi-tenant isolation. The Automation Engine supports various action types (create_task, send_notification, run_ai_agent, update_field, wait_delay) with context propagation and multi-tenant security enforced at every level. It includes auto-progression cascades for tasks, steps, and stages.

## External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration.
- **Anthropic Claude API**: AI model integration.
- **Multer**: Node.js middleware for file uploads.
- **expr-eval**: Secure expression evaluation for conditional logic.