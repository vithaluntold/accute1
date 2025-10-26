# Accute - AI-Powered Accounting Workflow Automation Platform

## Overview
Accute is an enterprise-grade accounting workflow automation platform that combines AI-powered agents with traditional accounting software capabilities. The platform supports multi-role authentication (Super Admin, Admin, Employee, Client), custom workflow building, AI agent marketplace, and secure document management.

## Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Authentication**: JWT + bcrypt + session management
- **Security**: AES-256 encryption, CSRF protection, rate limiting
- **AI Integration**: OpenAI, Azure OpenAI, Anthropic Claude

### Project Structure
```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/ui/  # shadcn/ui components
│   │   ├── pages/          # Page components
│   │   ├── lib/            # Utility functions
│   │   └── App.tsx         # Main app router
├── server/                 # Backend Express application
│   ├── index.ts            # Server entry point
│   ├── routes.ts           # API routes
│   ├── storage.ts          # Database storage layer
│   ├── auth.ts             # Authentication utilities
│   ├── db.ts               # Database connection
│   └── seed.ts             # Database seeding
├── shared/
│   └── schema.ts           # Shared database schema & types
└── design_guidelines.md    # UI/UX design specifications
```

## Database Schema

### Core Tables
- **users**: User accounts with role-based access
- **organizations**: Multi-tenant organization support
- **roles**: Flexible role system (system + custom roles)
- **permissions**: Granular permission management
- **role_permissions**: Role-permission junction table
- **sessions**: Secure session management

### Feature Tables
- **workflows**: Workflow automation templates (JSON node-based)
- **ai_agents**: AI agent marketplace entries with directory paths and pricing models
- **ai_agent_installations**: Installed agents per organization
- **ai_provider_configs**: Multi-provider AI configurations (encrypted API keys)
- **documents**: Secure document storage with encryption
- **notifications**: Real-time user notifications
- **activity_logs**: Comprehensive audit trail
- **super_admin_keys**: Single-use keys for super admin onboarding (SHA-256 hashed)
- **invitations**: Email/SMS invite tokens for employee/client registration

## System Roles & Permissions

### Super Admin
- Full system access
- Organization management
- All user, role, workflow, and AI agent permissions
- Analytics and audit logs

### Admin
- Team management
- Workflow and AI agent management (no delete)
- Document management
- Analytics viewing

### Employee
- View and execute workflows
- Create and edit workflows
- Upload documents
- View analytics

### Client
- View and install AI agents from marketplace
- View workflows
- Upload and view own documents
- Limited portal access

## API Routes

### Authentication
- `POST /api/auth/register` - User registration with organization creation
- `POST /api/auth/login` - Login with JWT token generation
- `POST /api/auth/logout` - Logout and session deletion
- `GET /api/auth/me` - Get current user with role and permissions

### Users
- `GET /api/users` - List users (requires `users.view`)
- `POST /api/users` - Create user (requires `users.create`)
- `PATCH /api/users/:id` - Update user (requires `users.edit`)
- `DELETE /api/users/:id` - Delete user (requires `users.delete`)

### Roles & Permissions
- `GET /api/roles` - List all roles
- `POST /api/roles` - Create custom role (requires `roles.create`)
- `GET /api/roles/:id/permissions` - Get role permissions
- `POST /api/roles/:roleId/permissions/:permissionId` - Assign permission
- `GET /api/permissions` - List all permissions

### Workflows
- `GET /api/workflows` - List workflows (requires `workflows.view`)
- `GET /api/workflows/:id` - Get workflow details
- `POST /api/workflows` - Create workflow (requires `workflows.create`)
- `PATCH /api/workflows/:id` - Update workflow (requires `workflows.edit`)
- `DELETE /api/workflows/:id` - Delete workflow (requires `workflows.delete`)

### AI Agents
- `GET /api/ai-agents` - List public AI agents
- `GET /api/ai-agents/:id` - Get agent details
- `POST /api/ai-agents` - Create agent with directory paths and pricing (requires `ai_agents.create`)
- `POST /api/ai-agents/:id/install` - Install agent (requires `ai_agents.install`)
- `GET /api/ai-agents/installed` - List installed agents

### Super Admin & Invitations
- `GET /api/super-admin/keys` - List generated super admin keys (requires `super_admin.manage`)
- `POST /api/super-admin/keys` - Generate new super admin key (requires `super_admin.manage`)
- `POST /api/super-admin/register` - Register with super admin key (public)
- `POST /api/auth/register-admin` - Self-register as admin with new organization (public)
- `POST /api/auth/register-invite` - Register via invitation token (public)
- `POST /api/invitations` - Create invitation (requires `users.invite`)
- `GET /api/invitations/validate/:token` - Validate invitation token (public)
- `GET /api/invitations` - List organization invitations (requires `users.invite`)
- `POST /api/invitations/:id/revoke` - Revoke invitation (requires `users.invite`)

### AI Providers
- `POST /api/ai-providers` - Configure AI provider (requires `ai_agents.configure`)
- `GET /api/ai-providers` - List configured providers

### Documents
- `GET /api/documents` - List documents (requires `documents.view`)
- `POST /api/documents` - Upload document with multipart/form-data using multer (requires `documents.upload`)
  - Files stored in `uploads/` directory with unique filenames
  - 50MB file size limit
- `GET /api/documents/:id/download` - Authenticated download endpoint (requires `documents.view`)
  - Organization validation and client-only access to own documents
  - Streams file securely after permission checks
- `DELETE /api/documents/:id` - Delete document and physical file (requires `documents.delete`)

### Notifications
- `GET /api/notifications` - Get user notifications
- `PATCH /api/notifications/:id/read` - Mark as read

### Activity Logs
- `GET /api/activity-logs` - Get audit logs (requires `analytics.view`)

## Security Features

### Implemented
- ✅ JWT-based authentication with 7-day session expiry
- ✅ bcrypt password hashing (12 salt rounds)
- ✅ AES-256 encryption for sensitive data (API keys, documents)
- ✅ Rate limiting (login: 10 req/15min, register: 5 req/15min)
- ✅ SQL injection prevention via Drizzle ORM prepared statements
- ✅ Session management with token invalidation
- ✅ Role-based access control (RBAC)
- ✅ Activity logging for audit trails
- ✅ IP address and user agent tracking

### To Implement
- CSRF protection
- HTTPS/TLS enforcement
- Row-level security policies
- Input validation middleware

## Design System

### Colors
- Primary gradient: Porsche (#e5a660) to Pink (#d76082)
- UI framework: Carbon Design System for data-heavy interfaces
- Design inspiration: Linear/Notion productivity UIs
- Fonts: Orbitron (display), Exo 2 (body)

### Key Components
- Sidebar navigation with collapsible mode
- Top navigation with workspace switcher
- Card-based dashboard layouts
- Form components with validation
- Data tables with sorting and pagination
- Modal and drawer patterns

## Recent Changes

### 2025-10-26 (Latest - Clients Management Complete)
- ✅ Implemented Clients management system:
  - Database schema with comprehensive client fields (company, contact, address, tax ID)
  - Storage layer with CRUD operations
  - API routes with multi-tenant security (organization validation)
  - Request body validation using Zod schemas
  - Privilege escalation prevention (strip protected fields)
  - Frontend UI with create, edit, delete, search functionality
  - Client cards displaying key information with status badges
- ✅ Added client permissions to init system:
  - clients.view, clients.create, clients.edit, clients.delete
- ✅ Fixed critical security vulnerability:
  - Added organization validation to update/delete operations
  - Prevent cross-tenant data access
  - Schema validation on all mutations

### 2025-10-26 (Earlier - Documents Page Complete)
- ✅ Implemented Documents page (/documents) with full CRUD functionality:
  - File upload with multer middleware (multipart/form-data)
  - Document grid view with file type icons and metadata
  - Search/filter functionality
  - Authenticated download endpoint (not publicly accessible)
  - Delete functionality with physical file cleanup
- ✅ Fixed critical security vulnerability - documents no longer publicly accessible:
  - Removed static `/uploads` route
  - Created authenticated download endpoint with permission checks
  - Organization and client-level access control
  - Fixed path handling bug (strip leading slash before path.join)
- ✅ Enhanced authentication system:
  - Added cookie-parser middleware
  - Login endpoint now sets httpOnly session cookie
  - Auth middleware checks both Authorization header and session cookie
  - Supports multipart/form-data requests with authentication
- ✅ Created test admin user for development:
  - Email: admin@example.com
  - Password: admin123 (bcrypt hashed)
  - Role: Super Admin with full permissions

### 2025-10-26 (Earlier Session)
- ✅ Implemented multi-tier authentication system:
  - Super Admin registration via secret keys (SHA-256 hashed, single-use, expirable)
  - Admin self-registration with organization creation
  - Employee/Client invite-only registration (email/SMS)
- ✅ Extended AI agents schema with modular code architecture:
  - Directory paths (backendPath, frontendPath) for linking agent code
  - Subscription models (free, monthly, yearly, usage-based)
  - Pricing fields (priceMonthly, priceYearly)
  - Version tracking and tags for better organization
- ✅ Enhanced AI Agent Marketplace UI:
  - Super Admin can create agents with directory paths and pricing
  - Clients can browse, search, filter, and install agents
  - Pricing badges and subscription model display
  - Responsive grid layout with enhanced agent cards
- ✅ Added missing permissions:
  - `users.invite` for Admin and Super Admin roles
  - `ai_agents.view` and `ai_agents.install` for Client and Employee roles
- ✅ Created Team Management page (/team) for invitations
- ✅ Added Super Admin key management in Settings page
- ✅ Fixed invitation validation query bug in registration flow

### 2025-10-26 (Earlier)
- ✅ Created comprehensive landing page with hero, features, use cases, TaxDome comparison, and security sections
- ✅ Enhanced application header with workspace switcher, role indicator, notifications dropdown, profile menu, and global search
- ✅ Documented feature gaps vs TaxDome in FEATURE_ROADMAP.md (12 missing features identified)
- ✅ Positioned Accute as "AI-first" platform with unique AI Agent Marketplace advantage
- ✅ Completed all authentication UI components (login, register) with proper routing
- ✅ Implemented AI Provider Settings UI with secure API key management and multi-provider support

### Earlier (October 26, 2025)
- ✅ Created comprehensive database schema for multi-role system
- ✅ Implemented DbStorage layer with full CRUD operations
- ✅ Seeded database with system roles, permissions, and sample AI agents
- ✅ Built authentication system with bcrypt + JWT
- ✅ Implemented AES-256 encryption utilities
- ✅ Created complete API routes for all core features
- ✅ Added rate limiting and activity logging
- ✅ Set up role-based permission middleware

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string (auto-provided by Replit)
- `SESSION_SECRET` - Secret for JWT signing and encryption (auto-provided)

Optional (for AI features):
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic Claude API key
- `AZURE_OPENAI_API_KEY` - Azure OpenAI API key
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI endpoint URL

## Development

### Running the Application
```bash
npm run dev  # Starts backend + frontend dev servers
```

### Database Operations
```bash
npm run db:push   # Push schema changes to database
npm run seed      # Seed database with initial data
```

### Testing Users
After seeding, you can create test users via `/api/auth/register`:
1. First user can specify an `organizationName` to create an organization
2. Users are created with "Client" role by default
3. Manually update role to "Super Admin" via database for administrative access

## Next Steps

### Frontend Implementation (In Progress)
- ✅ Landing page with hero section and features (COMPLETED)
- ✅ Authentication UI (login, register) (COMPLETED)
- ✅ Main application layout with sidebar and enhanced header (COMPLETED)
- ✅ AI Provider Settings UI (COMPLETED)
- ✅ Workflows page with list view, search, and filtering (COMPLETED)
- ✅ AI Agent Marketplace page with browse and install functionality (COMPLETED)
- [ ] Dashboard views for all 4 roles (Super Admin, Admin, Employee, Client)
- [ ] Workflow builder with drag-drop canvas UI (next priority)
- [ ] Client portal with document upload UI
- [ ] Admin panel for user/role management UI
- [ ] Documents page UI

### Critical Missing Features (See FEATURE_ROADMAP.md)
**Phase 1 Priority (Q1 2025):**
- [ ] Client Questionnaires & Organizers (essential for tax season)
- [ ] Billing & Invoicing System (revenue generation)
- [ ] E-Signature Integration (DocuSign/HelloSign)
- [ ] Engagement Letters & Proposals
- [ ] Payment Processing (Stripe integration)

**Phase 2 Priority (Q2 2025):**
- [ ] Email Integration (Gmail/Outlook sync)
- [ ] Calendar & Scheduling (deadline management)
- [ ] Time Tracking & Billable Hours
- [ ] Team Chat & Real-time Messaging
- [ ] Tax Software Integration (QuickBooks/Xero)

### Future Features
- Advanced AI agent management (version control, A/B testing)
- Workflow analytics with AI insights
- Accounting software integrations (QuickBooks, Xero, Zoho)
- Advanced audit logging for compliance (SOC 2, GDPR)
- Team collaboration features
- White-label capabilities

## User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance
