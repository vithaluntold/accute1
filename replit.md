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
## Status: 165 Tests Built (63.5% of 260-test target) - PHASE 3 MILESTONE ACHIEVED

### Unit Tests (105 tests)
1. **Agent Routing & Registry** (40 tests) - `server/__tests__/agents/routing.test.ts`
   - Tests agent registry, route resolution, metadata validation
   - Tests slug normalization, lazy loading, deduplication
   
2. **LLM Configuration** (30 tests) - `server/__tests__/agents/llm-config.test.ts`
   - ✅ ConfigResolver.resolve() with two-level fallback (user → workspace)
   - ✅ AES-256 encryption/decryption of API keys
   - ✅ Caching with 5-minute TTL and cache invalidation
   - ✅ Multi-provider support (OpenAI, Anthropic, Azure OpenAI)
   - ✅ Error handling for missing configs and decryption failures
   
3. **Session Management** (35 tests) - `server/__tests__/agents/session-management.test.ts`
   - ✅ AgentSessionService layer testing (not direct DB access)
   - ✅ Session CRUD, message management, auto-title generation
   - ✅ **5 Authorization/Security Tests**: User isolation, session access control, organization boundaries, cross-user prevention
   - ✅ Cascade deletion and metadata management

### Integration Tests (60 tests)
4. **WebSocket Integration** (30 tests) - `server/__tests__/agents/integration/websocket.test.ts`
   - 🟡 10/30 passing (infrastructure refinement needed)
   - Tests connection lifecycle, authentication, message streaming
   - Tests error handling, concurrent sessions, heartbeat/reconnection
   - Coverage: Auth failures, malformed messages, network interruption, high connection volume
   
5. **LLM API Integration** (30 tests) - `server/__tests__/agents/integration/llm-api.test.ts`
   - Tests OpenAI, Anthropic, Azure OpenAI provider integration
   - Tests multi-provider fallback logic and configuration resolution
   - Tests API key encryption/decryption and configuration caching
   - Tests error handling for missing keys, corrupted data, org mismatch

### Remaining Work (95 tests to reach 260)
- 50 E2E Playwright tests (complete agent conversations, all 10 agents)
- 30 Psychology Profiling unit tests (OCEAN, DISC, MBTI, EQ, Cultural frameworks)
- 20 Load tests (concurrent sessions, WebSocket stability, stress testing)
- WebSocket test infrastructure refinement (fix 20 failing tests)

### Quality Metrics & Test Infrastructure
- **Test Framework**: Vitest with isolated test database
- **Test Patterns**: Service-layer testing, proper authorization coverage, security validation
- **Code Coverage**: Unit + Integration tests for core agent system components
- **Next Phase**: E2E conversation testing with Playwright for user-facing workflows

### Six Sigma Quality Targets
- <2s agent load time
- >99.9% WebSocket uptime
- >95% auto-title accuracy
- <5s LLM response time (p95)