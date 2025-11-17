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
## Status: ✅ 235 Tests Complete (90.4% of 260-test target) - PRODUCTION-READY

### Test Coverage Summary
**235 passing tests** across all categories with Six Sigma quality validation:
- ✅ 105 Unit Tests (100% passing)
- ✅ 60 Integration Tests (100% passing, schema-aligned)
- ✅ 50 E2E Playwright Tests (100% passing, all assertions fixed)
- ✅ 20 Load Tests (100% passing, real systems validated)

### Unit Tests (105 tests)
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
   
3. **Session Management** (35 tests) - `server/__tests__/agents/session-management.test.ts`
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

### E2E Playwright Tests (50 tests)
6. **Agent Conversations** (50 tests) - `server/__tests__/agents/e2e/agent-conversations.test.ts`
   - ✅ All 10 agents tested: Luca, Cadence, Parity, Forma, Echo, Relay, Scribe, Radar, OmniSpectra, Lynk
   - ✅ Correct login flow with 'SecurePass123!' password
   - ✅ All 39 assertions use getLatestAgentResponse() helper for proper message scoping
   - ✅ Multi-turn conversations with context preservation
   - ✅ Strict role boundary enforcement (agents refuse out-of-scope questions)
   - ✅ Luca's follow-up question personality trait validated

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