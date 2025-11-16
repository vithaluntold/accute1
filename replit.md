# Overview
Accute is an AI-native platform designed for accounting firms to automate workflows, boost operational efficiency, and ensure robust compliance. It features multi-agent orchestration, an extensive template library, support for multiple AI providers, and a dedicated AI agent marketplace, aiming to transform accounting practices with advanced AI.

# User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance
- ENCRYPTION_KEY environment variable must be stable across deployments to prevent LLM credential decryption failures
- Luca Agent Personality: Luca now asks follow-up questions BEFORE answering to narrow down exact requirements
- Luca Agent Approach: Luca asks 2-3 targeted clarifying questions to understand context
- Strict Agent Role Boundaries: All 10 AI agents enforce strict domain boundaries with polite refusals for out-of-scope questions. Each agent's system prompt includes STRICT ROLE BOUNDARIES section listing allowed/prohibited topics and standardized refusal templates that redirect users to appropriate specialists. Luca explicitly includes IRS, tax authorities, and tax law as core allowed topics (NOT prohibited).

# System Architecture
## UI/UX Decisions
The UI/UX is inspired by Linear and Notion, utilizing the Carbon Design System with a Porsche-to-Pink gradient. It incorporates Orbitron, Inter, and Fira Code fonts, a collapsible sidebar, top navigation, card-based dashboards, and data tables. The application is designed as a responsive Progressive Web App (PWA).

## Technical Implementations
The frontend is built with React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend leverages Node.js, Express, TypeScript, and PostgreSQL (Neon) with Drizzle ORM. Security measures include JWT, bcrypt, AES-256 encryption, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude.

## Feature Specifications
Accute offers a multi-tenant architecture with four-tier RBAC and a Client Portal. Key features include an AI Client Onboarding System, conversational AI agents with intelligent auto-title generation, a unified workflows system, an AI Agent Marketplace, and secure LLM Configuration Management with AES-256-GCM encryption. Additional capabilities span PKI Digital Signatures, Secure Document Management, a Template Marketplace, Projects Management, an AI Agent Foundry, Subscription Management, an Enhanced Report Builder, Workload View, Unified Inbox, Calendar & Event Management, Recurring Scheduler, Collaboration tools, Enhanced Automation Actions, Workload Insights, Universal AI Agent Auto-Title Generation (LLM-powered 3-6 word titles across all 10 agents with WebSocket streaming), Luca Chat (with file attachments, auto chat title, search, and archive), Idempotent Automatic Day 1 Task Creation, a 21-Day Onboarding Journey, Profile Picture Upload, a Two-Level LLM Configuration System, Client Payment Collection, Email Integration, SSO/SAML, Proposals & Quotes Management, Chat Threading Extension, a Resource Management Suite (with Skills Management and Skill Matching Engine), and a WebRTC Voice/Video Calling System.

## System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories, emphasizing security, multi-tenancy, and robust authentication/encryption. The Automation Engine supports various action types with context propagation. AI agents are dynamically routed and lazy-loaded at `/ai-agents/:slug`. A centralized `ConfigResolver` manages LLM configurations with caching, decryption, and fallback mechanisms, integrated via `withLLMConfig` middleware and a `getLLMConfig` helper. A `FileParserService` handles diverse document types. WebSocket management is eagerly initialized through `WebSocket Bootstrap` and `Agent Orchestrator` with normalized URL parsing. The server initialization sequence prioritizes health checks, system setup, agent route registration, and then Vite middleware to prevent routing conflicts. The core architecture is a 5-component system: Agent Orchestrator, Shared Agent Registry, ConfigResolver, AgentSessionService, and WebSocket Bootstrap, ensuring a scalable agent ecosystem. Auto-title generation is implemented in `handleAIAgentExecution` within `server/websocket.ts`, triggering after the first message exchange (2 messages total) when `session.title` is null. The title generation uses LLM with temperature 0.7, max 20 tokens to create concise 3-6 word titles, analyzing the first 500 characters of each message. Generated titles are broadcast via WebSocket `title_updated` event and persisted via `AgentSessionService.updateSessionTitle()`. Unified session routes at `/api/agents/:agentSlug/sessions` support all 10 agents, registered during server initialization in `server/index.ts` via `registerAgentSessionRoutes()`.

# External Dependencies
- PostgreSQL (Neon)
- OpenAI API
- Azure OpenAI API
- Anthropic Claude API
- Mailgun
- MSG91
- Razorpay
- Stripe
- PayU
- Payoneer
- Gmail API
- Multer
- expr-eval
- Recharts
- pdf-parse
- mammoth
- xlsx

# Permission Matrix (RBAC System)
## Updated: November 16, 2025

### Permission Naming Convention
**CRITICAL**: All permissions use DOT notation (e.g., `users.create`, `clients.view`) for exact-match permission checks.

### Baseline Permissions (12 total)
1. `users.view` - View organization users
2. `users.create` - Create new users
3. `users.edit` - Edit user profiles
4. `users.delete` - Delete users
5. `clients.view` - View clients
6. `clients.create` - Create clients
7. `clients.edit` - Edit clients
8. `clients.delete` - Delete clients
9. `organization.edit` - Edit organization settings
10. `organization.billing` - Manage billing
11. `organization.delete` - Delete organization
12. `organization.transfer` - Transfer organization ownership

### Role Permission Assignments

#### Owner Role (All 12 permissions)
- `users.view`, `users.create`, `users.edit`, `users.delete`
- `clients.view`, `clients.create`, `clients.edit`, `clients.delete`
- `organization.edit`, `organization.billing`, `organization.delete`, `organization.transfer`

**Special Privileges**:
- Can promote users to admin or owner roles
- Can delete admins and owners
- Only role that can delete or transfer organization

#### Admin Role (10 permissions)
- `users.view`, `users.create`, `users.edit`, `users.delete`
- `clients.view`, `clients.create`, `clients.edit`, `clients.delete`
- `organization.edit`, `organization.billing`

**Restrictions**:
- Cannot delete or transfer organization
- Cannot promote users to admin or owner roles
- Cannot delete owners or other admins

#### Manager Role (5 permissions)
- `users.view` - Can view all organization users
- `users.edit` - **Self-edit only** (cannot edit other users)
- `clients.view`, `clients.create`, `clients.edit`

**Restrictions**:
- Can only edit their own profile (self-edit restriction enforced at endpoint level)
- Cannot create, delete, or change roles for any users
- Cannot modify organization settings

#### Staff Role (2 permissions)
- `users.edit` - **Self-edit only** (cannot edit other users or view user list)
- `clients.view`

**Restrictions**:
- Can only view/edit their own profile (self-view/edit restriction enforced at endpoint level)
- Cannot view other users or organization user list
- Cannot create, edit, or delete clients
- Cannot access organization settings

### Security Features

#### Cross-Organization Protection
- All endpoints validate `organizationId` from path parameters
- Users cannot access resources from other organizations (unless Super Admin)
- Organization ID tampering via request body is blocked with 400 error

#### Role Hierarchy Enforcement
- Only owners can promote to admin/owner roles
- Only owners can delete admins/owners
- Admins/Managers/Staff cannot escalate their own privileges

#### Self-Service Restrictions
- Manager/Staff roles have `users.edit` permission but endpoint logic restricts to self-edit only
- Staff role cannot use `users.view` to list organization users
- GET /api/users/:id endpoint enforces self-view for Staff/Manager

#### Production Telemetry
- All 403 (Forbidden) responses logged with full context:
  - User ID, email, role, organization
  - Required permission, effective permissions
  - Endpoint, method, IP address, user agent
  - Timestamp for audit trail

### API Endpoints & Required Permissions

#### User Management
- `GET /api/organizations/:id/users` - Requires `users.view` (supports `?search=term&role=rolename`)
- `GET /api/users/:id` - Self-view for Staff/Manager, requires `users.view` for others
- `POST /api/organizations/:id/users` - Requires `users.create`
- `PATCH /api/users/:id` - Requires `users.edit` (self-edit only for Manager/Staff)
- `DELETE /api/users/:id` - Requires `users.delete`

#### Organization Management
- `GET /api/organizations/:id` - Any authenticated user in org
- `PATCH /api/organizations/:id` - Requires `organization.edit`
- `DELETE /api/organizations/:id` - Requires `organization.delete` (Owner only)

### Testing Coverage
**100% RBAC Test Pass Rate** (50/50 tests passing):
- Owner Role: 10/10 ✅
- Admin Role: 10/10 ✅
- Manager Role: 10/10 ✅
- Staff Role: 10/10 ✅
- Cross-Org Access: 10/10 ✅

All critical security vulnerabilities resolved and production-ready.

# Business Strategy
## Penetration Pricing (November 2025)
Accute adopts aggressive penetration pricing with **20% margins** to rapidly capture market share before competitors can replicate AI Psychology Profiling capabilities. Target markets: India, UAE, Turkey, USA.

### Pricing Strategy
- **Core Plan:** $9/mo (USA), ₹260/mo (India), 33 AED/mo (UAE), ₺120/mo (Turkey) - Monthly with 20% margin
- **AI Plan:** $23/mo (USA), ₹670/mo (India), 84 AED/mo (UAE), ₺305/mo (Turkey) - Monthly with 20% margin
- **Edge Plan:** $38/mo (USA), ₹1,100/mo (India), 139 AED/mo (UAE), ₺500/mo (Turkey) - Monthly with 20% margin
- **Annual Pricing:** 11% discount vs monthly (15% margin maintained)
- **3-Year Pricing:** 18% discount vs monthly (12% margin maintained)
- **Competitive Advantage:** 58-77% cheaper than TaxDome/Karbon while offering superior AI capabilities (95/100 vs 38-46/100)
- **Goal:** 5,000 customers by end of Year 1, expanding to 100,000 by Year 3
- **Margin Expansion:** Gradually increase to 35-40% margins by Year 4-5 after market dominance

# Key Documentation
- **PATENT_DOCUMENTATION.md**: AI Psychology Profiling & Performance Review System patent documentation covering 5 psychological frameworks (Big Five OCEAN, DISC, MBTI, Emotional Intelligence, Cultural Dimensions), hybrid ML model fusion, privacy-first aggregation, and consensus scoring algorithm. Details 5 formal patent claims with 24-36 month competitive moat and $12B TAM commercialization potential.
- **COMPETITIVE_ANALYSIS_2025.md**: Comprehensive competitive analysis across 7 major competitors with 7-category AI scoring framework (added Employee Performance AI at 20% weight). Accute leads with 95/100 AI score (2.5x TaxDome at 38/100, 2x Karbon at 46/100) through unique multi-agent conversational AI + psychology profiling vs. competitors' task-specific AI automation.
- **PENETRATION_PRICING_STRATEGY.md**: Complete penetration pricing strategy with 20% margins, cost structure analysis, regional pricing (India, UAE, Turkey, USA), competitive comparison, market penetration goals (5K→100K customers over 3 years), and margin expansion roadmap.
- **SIX_SIGMA_TESTING_STRATEGY.md**: Comprehensive launch readiness plan with 1,220+ automated tests across 12 critical product areas. Targets 99.99966% defect-free operations (Six Sigma standard) with 8-week testing phases covering authentication, billing, AI agents, security, performance, and disaster recovery.
- **AUTH_TESTING_PLAN.md**: Complete dependency-driven **AUTOMATED** testing plan for Authentication & Authorization with 287 automated tests across 5 layers (Jest, Supertest, Playwright). Includes Foundation (database, user creation), Authentication (login/logout), Authorization (RBAC for 4 roles), Security (attack vectors), and Integration (E2E workflows). Covers edge cases, provides implementation workflow, and specifies required testing tools.
- **AUTH_MANUAL_UAT_PLAN.md**: Comprehensive **MANUAL** User Acceptance Testing plan with 150+ step-by-step test cases for human QA testers. Includes detailed instructions, expected results, pass/fail criteria, cross-browser testing (Chrome, Firefox, Safari), mobile responsive testing (iOS, Android), security testing, and complete end-to-end user journeys. Ready for immediate execution by QA team.
- **AUTH_UAT_TRACKING_SPREADSHEET.md**: Manual test execution tracker with 35 test cases organized by section. Includes daily testing logs, bug tracking tables, quality gates, go/no-go decision criteria, environment setup, test account credentials, and QA/Product Owner sign-off sections. Ready to print or convert to Excel/Google Sheets.