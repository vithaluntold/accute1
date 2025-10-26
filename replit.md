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

### 2025-10-26 (Latest - Forms Management UI Complete)
- ✅ Built production-ready Forms Management page (/forms):
  - Full CRUD operations: Create, Edit, Publish, Delete forms
  - Card-based grid layout with search/filter functionality
  - Status badges: draft (secondary), published (default with checkmark)
  - Permission-based access control (forms.view, forms.create, forms.edit, forms.delete, forms.publish)
  - Clean field separation: user-editable (name, description, category) vs backend-managed (status, version, fields)
  - Multi-tenant security with organization isolation
  - Activity logging for all form operations
  - Empty state handling
- ✅ Fixed critical bugs:
  - Form reset via useEffect when dialog opens
  - apiRequest parameter order: (method, url, data)
  - Update payload now sends ONLY editable fields
  - Create payload adds backend-managed fields explicitly (fields: [], sections: [], etc.)
- ✅ Verified with automated E2E tests:
  - Create multiple forms with fresh defaults
  - Edit forms without field leakage
  - Publish forms (draft → published status)
  - Delete forms with confirmation
  - Search/filter forms
- ✅ Architect approved as production-ready
- 📋 Next: Build form builder page (add/configure fields, sections, logic)

### 2025-10-26 (Earlier - Form Builder Schema Complete)
- ✅ Designed comprehensive form creator system:
  - Database schema: form_templates and form_submissions tables
  - 22 field types: text, textarea, number, email, phone, url, date, time, datetime, select, multi_select, radio, checkbox, file_upload, signature, address, currency, percentage, rating, slider, calculated, heading, divider, html
  - Conditional logic: Show/hide/require/disable fields based on expressions
  - Validation rules: Required, min/max, pattern matching, custom JavaScript
  - Calculated fields: Auto-compute values using expressions
  - Repeating sections: For listing multiple items (e.g., dependents, income sources)
  - Multi-page forms: With sections and progress tracking
  - **Folder structure mapping**: Critical for auto-creating client folders!
  - Submission workflow: Review, approve, reject submissions
  - Client linking: Associate submissions with clients
  - Version control: Track form template versions
  - TypeScript types for all form structures
- ✅ Capabilities exceed Zoho Forms (22 vs ~18 field types, folder automation unique to Accute)
- ✅ Architect approved as production-ready

### 2025-10-26 (Earlier - Tag Management UI Complete)
- ✅ Built complete tag management UI with CRUD operations:
  - Tags page (/tags) with color picker, search, and card-based grid
  - TagSelector component for applying/removing tags on any resource
  - Integrated into Documents, Clients, and Contacts pages
- ✅ Fixed critical bugs:
  - Dialog open handler - properly accepts boolean parameter
  - Schema imports - added insertTagSchema, insertContactSchema, insertTaggableSchema
  - LSP errors resolved
- ✅ Created tag permissions in database (manually):
  - Super Admin: all 5 permissions (view, create, edit, delete, apply)
  - Admin: 4 permissions (view, create, edit, apply)
  - Employee: 2 permissions (view, apply)
- ✅ Verified with automated E2E tests - Create, Edit, Delete all working

### 2025-10-26 (Earlier - Tagging System Backend Complete)
- ✅ Implemented polymorphic tagging system for organizing resources:
  - Database schema with tags table (name, color, organizationId)
  - Polymorphic taggables junction table (tagId, taggableType, taggableId)
  - Supports tagging documents, clients, workflows, contacts, and any future resources
  - Storage layer with comprehensive tag operations (CRUD, apply/remove, queries)
  - API routes with multi-tenant security and schema validation
  - Cascade delete when tags are removed
- ✅ Added tag permissions: tags.view, tags.create, tags.edit, tags.delete, tags.apply
- ✅ Server-populated fields pattern for organizationId and createdBy

### 2025-10-26 (Earlier - Contacts Management Complete)
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