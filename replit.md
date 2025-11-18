# Overview
Accute is an AI-native platform for accounting firms, aiming to automate workflows, boost operational efficiency, and ensure robust compliance. It features multi-agent orchestration, an extensive template library, support for multiple AI providers, and a dedicated AI agent marketplace. The platform seeks to transform accounting practices with advanced AI, offering superior AI capabilities at a competitive price to capture significant market share globally.

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
Accute offers a multi-tenant architecture with four-tier RBAC and a Client Portal. Key features include an AI Client Onboarding System, conversational AI agents with intelligent auto-title generation, a unified workflows system, an AI Agent Marketplace, and secure LLM Configuration Management. Additional capabilities include PKI Digital Signatures, Secure Document Management, a Template Marketplace, Projects Management, an AI Agent Foundry, and a comprehensive suite of collaboration and management tools such as Subscription Management, an Enhanced Report Builder, Workload View, Unified Inbox, Calendar & Event Management, Recurring Scheduler, Enhanced Automation Actions, Workload Insights, and a WebRTC Voice/Video Calling System.

## System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. It emphasizes security, multi-tenancy, and robust authentication/encryption. The Automation Engine supports various action types. AI agents are dynamically routed and lazy-loaded. A centralized `ConfigResolver` manages LLM configurations with caching, decryption, and fallback mechanisms. A `FileParserService` handles diverse document types. WebSocket management is eagerly initialized through `WebSocket Bootstrap` and `Agent Orchestrator`. The server initialization sequence prioritizes health checks, system setup, agent route registration, and then Vite middleware. The core architecture is a 5-component system: Agent Orchestrator, Shared Agent Registry, ConfigResolver, AgentSessionService, and WebSocket Bootstrap, ensuring a scalable agent ecosystem. Auto-title generation occurs after the first message exchange, using an LLM to create concise 3-6 word titles. Unified session routes support all 10 agents.

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

# AI Agent System Testing Progress (Phase 3)
## Status: ⚠️ 187 Tests Implemented (72% of 260-test target) - In Progress

### Test Coverage Summary
**187 implemented tests** across unit, integration, and load categories:
- ✅ 107 Unit Tests (implemented and validated)
- ✅ 60 Integration Tests (implemented and validated)
- ❌ 0 E2E Tests (planned but not implemented)
- ✅ 20 Load Tests (implemented and validated)

### Unit Tests (107 tests)
1. **Agent Routing & Registry** (40 tests) - `server/__tests__/agents/routing.test.ts`
   - ✅ Agent registry, route resolution, metadata validation
   - ✅ Slug normalization, lazy loading, deduplication
   - ✅ Error handling for invalid agents
   
2. **LLM Configuration** (30 tests) - `server/__tests__/agents/llm-config.test.ts`
   - ✅ ConfigResolver.resolve() with two-level fallback (user → workspace)
   - ✅ AES-256 encryption/decryption of API keys
   - ✅ Caching with 5-minute TTL and cache invalidation
   - ✅ Multi-provider support (OpenAI, Anthropic, Azure OpenAI)
   - ✅ Error handling for missing configs and decryption failures
   - ✅ Schema-aligned: apiKeyEncrypted, scope, azureEndpoint, createdBy
   
3. **Session Management** (37 tests) - `server/__tests__/agents/session-management.test.ts`
   - ✅ AgentSessionService layer testing (not direct DB access)
   - ✅ Session CRUD, message management, auto-title generation
   - ✅ **5 Authorization/Security Tests**: User isolation, session access control, organization boundaries, cross-user prevention
   - ✅ Cascade deletion and metadata management

### Integration Tests (60 tests)
4. **WebSocket Integration** (30 tests) - `server/__tests__/agents/integration/websocket.test.ts`
   - ✅ Connection lifecycle, authentication, message streaming
   - ✅ Error handling, concurrent sessions, heartbeat/reconnection
   - ✅ Coverage: Auth failures, malformed messages, network interruption, high connection volume
   
5. **LLM API Integration** (30 tests) - `server/__tests__/agents/integration/llm-api.test.ts`
   - ✅ OpenAI, Anthropic, Azure OpenAI provider integration
   - ✅ Multi-provider fallback logic and configuration resolution
   - ✅ API key encryption/decryption and configuration caching
   - ✅ Error handling for missing keys, corrupted data, org mismatch

### E2E Playwright Tests (0 tests - NOT IMPLEMENTED)
6. **Agent Conversations** - `server/__tests__/agents/e2e/agent-conversations.test.ts`
   - ❌ File exists but contains no test cases
   - ❌ Playwright not configured (@playwright/test dependency missing)
   - ❌ Browser automation not set up
   - ⚠️ Planned: Multi-agent conversations, role boundaries, authentication flows
   - ⚠️ Planned: Test all 10 agents with multi-turn conversations

### Load & Stress Tests (20 tests)
7. **Real System Performance** (20 tests) - `server/__tests__/agents/load/stress-testing.test.ts`
   - ✅ **Agent Orchestrator Performance** (5 tests): <1s for all 10 agents, 100 concurrent lookups
   - ✅ **ConfigResolver Caching** (5 tests): >90% cache hit rate, <100ms cached resolution, cache invalidation
   - ✅ **Session Service Scalability** (5 tests): 100 sessions in <3s, 50 concurrent messages, pagination
   - ✅ **Database Query Performance** (5 tests): 1000 inserts in <5s, 500-message query in <1s, concurrent R/W
   - ✅ Tests REAL components (not mocks): AgentOrchestrator, ConfigResolver, AgentSessionService
   - ✅ Proper cleanup (afterAll) to prevent state leakage

### Quality Metrics & Test Infrastructure
- **Test Framework**: Vitest with isolated test database, Playwright for E2E
- **Test Patterns**: Service-layer testing, proper authorization coverage, security validation, real system testing
- **Code Coverage**: Comprehensive coverage of core agent system components
- **Test Data**: Uses beforeEach() for org/user creation, default password 'SecurePass123!'
- **Cleanup**: Proper teardown with cache invalidation and state isolation

### Six Sigma Quality Targets - VALIDATED
- ✅ Agent load time: <1s (AgentOrchestrator tests confirm all 10 agents load in <1s)
- ✅ Config resolution: <100ms cached, >90% hit rate (ConfigResolver tests validate caching)
- ✅ Session creation: 100 sessions in <3s (AgentSessionService tests confirm throughput)
- ✅ Message queries: <1s for 500 messages (Database performance tests validate indexes)
- ✅ Concurrent operations: Validated with 50-100 concurrent requests across all components

### Identified Gaps & Future Work (73 tests to reach 260 target)

**1. E2E Playwright Tests** (50 tests - NOT IMPLEMENTED):
- **Gap**: No browser automation or end-to-end user journey testing
- **Impact**: Cannot verify full user workflows through the browser
- **Needed**: Playwright setup, browser automation for all 10 agents, multi-turn conversations, role boundary testing
- **Priority**: HIGH - E2E tests are critical for user-facing validation

**2. Database HTTP Integration Testing** (23 tests - DEFERRED):
- **Gap**: HTTP-level database persistence verification via supertest
- **Complexity**: Requires full Express middleware stack (sessions, cookies, rate limits, auth) + proper route registration
- **Current Coverage**: Database persistence tested at service layer, but not through HTTP API
- **Decision**: Deferred until unified agent session REST API is implemented (currently WebSocket-based)
- **Priority**: MEDIUM - Core logic tested, HTTP layer adds routing validation

**Current Status - 187 Tests (72% of target)**:
- ✅ Strong unit test foundation (107 tests)
- ✅ Comprehensive integration testing (60 tests)
- ✅ Real system performance validation (20 load tests)
- ✅ Six Sigma performance targets met
- ❌ Missing E2E user journey validation (50 tests)
- ❌ Missing HTTP-level database verification (23 tests)

# RBAC Enhancement Progress (In Parallel with AI Agent Testing)
## Status: ✅ Phase 1 Complete - Owner Role & Permission Categorization

### Phase 1 Implementation (November 18, 2025)
**Objective**: Add Owner role with billing/subscription permissions, create permission categorization system

**Delivered Components**:
1. **Owner System Role** (`server/init.ts`)
   - Name: "Owner"
   - Description: "Organization owner with billing and full control"
   - Scope: tenant
   - Permissions: 176 (all Admin permissions + Owner-specific permissions)
   - Owner-specific permissions:
     - `billing.view` - View billing history and invoices
     - `billing.update` - Update payment methods
     - `organization.transfer` - Transfer organization ownership
     - `organization.delete` - Delete organization permanently
     - `subscriptions.view`, `subscriptions.manage`, `subscriptions.billing`

2. **Permission Categorization System** (`shared/permission-categories.ts`)
   - **11 Categories**: User Management, Workflows & Automation, AI Agents, Documents & Files, Financial Management, Client Portal, Analytics & Reporting, Communication, Project Management, Settings & Configuration, Billing & Subscriptions (Owner Only)
   - **46 Permission Dependencies**: Hierarchical relationships (e.g., workflows.edit requires workflows.view)
   - **13 Permission Metadata Entries**: Dangerous permissions, subscription requirements, role requirements
   - **6 Role Templates**: Senior Accountant, Tax Specialist, Bookkeeper, Junior Staff, Practice Manager, Client Services Coordinator

3. **API Endpoint** (`server/routes.ts`)
   - `GET /api/permissions/categories` - Returns categories, dependencies, metadata, and templates
   - Used by frontend for intelligent role management UI
   - Tested and operational ✅

**Architecture Decisions**:
- **Non-Breaking**: Existing Admin users retain their current permissions (no billing/subscription access)
- **Backward Compatible**: Admin role filtering explicitly excludes Owner-specific permissions
- **Security**: Dangerous permissions marked with metadata, Owner-only permissions require specific role
- **Future-Proof**: Permission categorization supports upcoming custom role builder UI

**Architect Review**: ✅ Passed
- Owner role creation verified (tenant scope, 176 permissions)
- Admin role filter correctly excludes Owner-only permissions
- Permission categorization system properly structured
- No security concerns identified
- Backward compatibility confirmed

**Next Actions**:
- Frontend integration: Surface permission categories in role management UI
- Phase 2: Advanced permission editor with dependency validation
- Phase 3: Custom role builder with templates
- Phase 4: Permission usage analytics
- Phase 5: Bulk role assignment
- Phase 6: Role migration utilities for breaking changes