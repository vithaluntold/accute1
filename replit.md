# Accute - AI-Powered Accounting Workflow Automation Platform

## Overview
Accute is an enterprise-grade AI-powered accounting workflow automation platform designed to streamline financial operations. It offers multi-role authentication (Super Admin, Admin, Employee, Client), custom workflow building, an AI agent marketplace, and secure document management. The platform aims to be an "AI-first" solution, providing significant advantages over traditional accounting software by leveraging advanced AI capabilities for automation and insights.

## User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance

## System Architecture

### UI/UX Decisions
The platform features a clean, modern UI inspired by productivity applications like Linear and Notion. It utilizes the Carbon Design System for data-heavy interfaces, with a primary color gradient from Porsche (#e5a660) to Pink (#d76082). Key UI components include a collapsible sidebar navigation, a top navigation with workspace switcher, card-based dashboards, and data tables with sorting and pagination. Fonts used are Orbitron (display) and Exo 2 (body).

### Technical Implementations
Accute is built with a modern tech stack:
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui.
- **Backend**: Node.js, Express, TypeScript.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Authentication**: JWT, bcrypt for password hashing, and secure session management.
- **Security**: AES-256 encryption for sensitive data, role-based access control (RBAC), rate limiting, SQL injection prevention, and comprehensive activity logging.
- **AI Integration**: Supports OpenAI, Azure OpenAI, and Anthropic Claude.

### Feature Specifications
- **Multi-tenant Architecture**: Supports multiple organizations with isolated data.
- **Role-Based Access Control**: Granular permission system for Super Admin, Admin, Employee, and Client roles.
- **Workflow Automation**: JSON node-based workflow templates for custom automation.
- **AI Agent Marketplace**: Allows browsing, installing, and managing AI agents with defined directory paths and pricing models.
- **Secure Document Management**: Encrypted document storage, authenticated downloads, and organization/client-level access control.
- **User & Client Management**: Features for managing users, roles, and client profiles, including invitation-based registration.
- **Audit Trails**: Comprehensive activity logs for compliance and monitoring.
- **Super Admin Onboarding**: Secure, single-use key-based registration for initial Super Admin setup.

### System Design Choices
The project structure separates concerns into `client/` (frontend), `server/` (backend), and `shared/` (common types/schemas). Database schema includes core tables for users, organizations, roles, permissions, and sessions, along with feature-specific tables for workflows, AI agents, documents, and notifications. Security is a core design principle, with robust authentication, encryption, and access control implemented throughout the system.

## External Dependencies
- **PostgreSQL (via Neon)**: Primary database for all application data.
- **OpenAI API**: For integrating OpenAI's language models.
- **Azure OpenAI API**: For integrating Azure's OpenAI service.
- **Anthropic Claude API**: For integrating Anthropic's AI models.
- **Multer**: Node.js middleware for handling `multipart/form-data`, primarily used for file uploads.

## Recent Changes

### 2025-10-26 (Latest - Contacts Management Complete)
- ✅ Implemented Contacts management system with client assignment:
  - Database schema with contacts table (firstName, lastName, email, phone, title, department, isPrimary)
  - Client relationship with cascade delete
  - Storage layer with CRUD operations
  - API routes with multi-tenant security and client ownership validation
  - Request body validation with Zod schemas
  - Frontend UI with client selection, search, filter by client
  - Contact cards displaying client affiliation, email, phone, department
  - Primary contact indicator (star icon)
- ✅ Added contact permissions: contacts.view, contacts.create, contacts.edit, contacts.delete

### 2025-10-26 (Earlier - Clients Management Complete)
- ✅ Implemented Clients management system:
  - Database schema with comprehensive client fields
  - Storage layer with CRUD operations
  - API routes with multi-tenant security
  - Request body validation and privilege escalation prevention
  - Frontend UI with create, edit, delete, search functionality
- ✅ Added client permissions: clients.view, clients.create, clients.edit, clients.delete

### 2025-10-26 (Earlier - Documents Page Complete)
- ✅ Implemented Documents page with full CRUD functionality:
  - File upload with multer middleware
  - Authenticated download endpoint with permission checks
  - Document grid view with search/filter
  - Delete functionality with proper authorization
- ✅ Fixed critical security vulnerability: replaced public static file serving with authenticated download endpoint