# AI Agent System Testing Plan
**Accute - Six Sigma Quality Standards**  
**Phase 3: AI Agent System**  
**Target Coverage: 98%+ | Test Count: 260 Automated Tests**

---

## Executive Summary

This document outlines the comprehensive automated testing strategy for Accute's AI Agent System, targeting **Six Sigma quality standards** (99.99966% defect-free operations). The AI Agent System is a **CRITICAL Tier 1** component and the platform's core differentiator, requiring near-perfect reliability.

### Quality Targets
- **Coverage:** 98%+ code coverage
- **Test Count:** 260 automated tests
- **Success Rate:** 99.9%+ passing
- **Performance:** All agents load within 2 seconds
- **WebSocket Uptime:** 99.9%+
- **Auto-Title Success:** 95%+
- **LLM Response Time:** <5 seconds (p95)
- **Role Boundary Violations:** ZERO

---

## Test Architecture Overview

### Test Layers (Pyramid Model)
```
                    /\
                   /  \
                  / E2E \          50 tests (19%)
                 /------\
                /        \
               /Integration\       90 tests (35%)
              /------------\
             /              \
            /  Unit Tests    \    120 tests (46%)
           /------------------\
```

### Test Distribution
| Layer | Test Count | Coverage Focus | Tools |
|-------|-----------|----------------|-------|
| **Unit Tests** | 120 | Agent logic, routing, config, sessions | Jest |
| **Integration Tests** | 90 | WebSocket, LLM APIs, database | Supertest + Jest |
| **E2E Tests** | 50 | Complete agent conversations | Playwright |
| **Total** | **260** | **98%+ coverage** | - |

---

## 1. Unit Tests (120 Tests)

### 1.1 Agent Routing & Initialization (40 Tests)

**File:** `server/__tests__/agents/routing.test.ts`

#### Test Cases:

**Agent Registry (15 tests)**
- ✅ All 10 agents load correctly from static registry
- ✅ Agent slugs match expected names (luca, cadence, parity, forma, echo, relay, scribe, radar, omnispectra, lynk)
- ✅ Agent manifests contain required fields (name, slug, description, category, capabilities)
- ✅ Invalid agent slug returns 404
- ✅ Agent capabilities array is non-empty
- ✅ Agent categories are valid (assistant, workflow, forms, legal, messaging, inbox, email, status, logging, integration)
- ✅ Agent icons resolve correctly
- ✅ Agent subscription requirements validated (free/core/ai/edge)
- ✅ `getAgentConfig()` returns correct agent
- ✅ `getAvailableAgents()` returns all 10 agents
- ✅ `isAgentRegistered()` validates agent existence
- ✅ Agent backend exports `registerRoutes` function
- ✅ Duplicate agent registration is prevented
- ✅ Agent directory structure is correct (/agents/{slug}/backend, /agents/{slug}/frontend)
- ✅ Manifest JSON parsing handles malformed data gracefully

**Agent Route Registration (15 tests)**
- ✅ All 10 agents register routes successfully
- ✅ Agent routes follow pattern `/api/ai-agents/:slug/*`
- ✅ Session routes follow pattern `/api/agents/:agentSlug/sessions`
- ✅ Missing agent slug returns 400 error
- ✅ Invalid agent slug returns 404 error
- ✅ Duplicate route registration is prevented
- ✅ Routes registered AFTER system initialization (prevents conflicts)
- ✅ Static agent loader registers all agents
- ✅ Dynamic agent loader handles runtime agent additions
- ✅ Agent routes accessible with authentication
- ✅ Agent routes blocked without authentication (401)
- ✅ Agent routes enforce RBAC permissions
- ✅ Cross-organization agent access blocked (403)
- ✅ Agent route handler error returns 500
- ✅ Agent route logging captures all requests

**Agent Access Control (10 tests)**
- ✅ Super Admin can access all published agents
- ✅ Org Admin can access organization-enabled agents
- ✅ Manager requires explicit user-agent permission
- ✅ Staff requires explicit user-agent permission
- ✅ Client portal users cannot access internal agents
- ✅ Unpublished agents return 403 for non-admins
- ✅ Disabled agents return 403 (even if previously enabled)
- ✅ `checkUserAccess()` validates user permissions correctly
- ✅ `getAvailableAgents()` filters by user role and org
- ✅ Subscription plan gates premium agents (Core/AI/Edge)

---

### 1.2 LLM Configuration Management (30 Tests)

**File:** `server/__tests__/agents/llm-config.test.ts`

#### Test Cases:

**Two-Level Configuration System (10 tests)**
- ✅ Organization-level config is created and retrieved
- ✅ User-level config overrides organization config
- ✅ User config inherits from org config when not overridden
- ✅ Missing user config falls back to org config
- ✅ Missing org config returns system default
- ✅ ConfigResolver caches configurations correctly
- ✅ Config cache invalidates on update
- ✅ Concurrent config reads don't cause race conditions
- ✅ `getLLMConfig()` returns correct merged configuration
- ✅ `withLLMConfig` middleware injects config into request

**Multi-Provider Support (10 tests)**
- ✅ OpenAI provider configuration validated
- ✅ Anthropic Claude provider configuration validated
- ✅ Azure OpenAI provider configuration validated
- ✅ Provider fallback works (OpenAI → Anthropic → Azure)
- ✅ Invalid provider returns error
- ✅ Provider-specific parameters validated (temperature, max_tokens)
- ✅ Provider API key validation
- ✅ Provider endpoint URL validation
- ✅ Provider model name validation (gpt-4, claude-3-opus, etc.)
- ✅ Provider rate limiting enforced

**Encryption & Security (10 tests)**
- ✅ LLM credentials encrypted with AES-256-GCM
- ✅ Encrypted credentials decrypted correctly
- ✅ ENCRYPTION_KEY stability across deployments
- ✅ Decryption fails with wrong key (returns error)
- ✅ Missing ENCRYPTION_KEY returns error
- ✅ Credentials never logged in plain text
- ✅ API keys masked in responses (show last 4 chars)
- ✅ Encryption key rotation supported
- ✅ Old encrypted data remains accessible after key rotation
- ✅ No credentials exposed in error messages

---

### 1.3 Agent Session Management (30 Tests)

**File:** `server/__tests__/agents/sessions.test.ts`

#### Test Cases:

**Session Creation & Lifecycle (10 tests)**
- ✅ Agent session created with valid parameters
- ✅ Session ID is unique UUID
- ✅ Session stores user ID and organization ID
- ✅ Session stores agent slug correctly
- ✅ Session title is null on creation (auto-generated later)
- ✅ Session context is empty object on creation
- ✅ Session timestamps (createdAt, updatedAt) are accurate
- ✅ Session query returns all user sessions for agent
- ✅ Session query filters by organizationId
- ✅ Session deletion removes all messages

**Auto-Title Generation (10 tests)**
- ✅ Auto-title triggers after 2 messages (1 user + 1 assistant)
- ✅ Title is 3-6 words long
- ✅ Title analyzes first 500 characters of conversation
- ✅ Title generation uses LLM with temperature 0.7
- ✅ Title generation uses max 20 tokens
- ✅ Title is persisted to database
- ✅ WebSocket `title_updated` event broadcast to client
- ✅ Title generation failure doesn't crash session
- ✅ Title not regenerated if already exists
- ✅ Title reflects conversation topic accurately

**Session Context Management (10 tests)**
- ✅ Session context updated with new data
- ✅ Session context preserves previous values (merge, not replace)
- ✅ Session context supports nested objects
- ✅ Session context size limited to 10KB (prevents bloat)
- ✅ Context serialization/deserialization works correctly
- ✅ Context passed to LLM in system message
- ✅ Context available across multi-turn conversations
- ✅ Context cleared when session archived
- ✅ Context query returns latest values
- ✅ Context update atomicity (no race conditions)

---

### 1.4 AI Psychology Profiling (20 Tests)

**File:** `server/__tests__/agents/psychology-profiling.test.ts`

#### Test Cases:

**Five Framework Analysis (10 tests)**
- ✅ OCEAN (Big Five) scoring (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism)
- ✅ DISC scoring (Dominance, Influence, Steadiness, Compliance)
- ✅ MBTI scoring (16 personality types: INTJ, ENFP, etc.)
- ✅ Emotional Intelligence (EQ) scoring (self-awareness, empathy, regulation)
- ✅ Cultural Dimensions scoring (Hofstede: power distance, individualism, uncertainty avoidance)
- ✅ Framework scores normalized to 0-100 scale
- ✅ All 5 frameworks analyzed in parallel
- ✅ Missing framework data handled gracefully
- ✅ Framework weights applied correctly (equal 20% each)
- ✅ Framework scoring uses hybrid ML model fusion

**Privacy-Preserving Aggregation (5 tests)**
- ✅ Raw AI messages NOT stored in database
- ✅ Only aggregated psychological scores stored
- ✅ Message content hashed before analysis
- ✅ No PII extracted from messages
- ✅ Compliance with GDPR/CCPA (no raw message retention)

**Consensus Scoring & Performance (5 tests)**
- ✅ Consensus algorithm averages 5 framework scores
- ✅ Performance metrics calculated (productivity, quality, collaboration)
- ✅ Profile accuracy > 85% (validated against ground truth)
- ✅ Profile generation completes within 10 seconds
- ✅ Profile stored in `ml_analysis_results` table

---

## 2. Integration Tests (90 Tests)

### 2.1 WebSocket Agent Communication (30 Tests)

**File:** `server/__tests__/agents/websocket.integration.test.ts`

#### Test Cases:

**Connection & Initialization (10 tests)**
- ✅ WebSocket server initializes on HTTP server
- ✅ Client connects to `/api/ai-agents/:slug` WebSocket endpoint
- ✅ Authentication token validated on connection
- ✅ Unauthenticated connection rejected (401)
- ✅ Invalid agent slug rejected (404)
- ✅ Connection stores userId and organizationId
- ✅ Multiple clients can connect to same agent
- ✅ Connection cleanup on client disconnect
- ✅ Connection timeout after 5 minutes inactivity
- ✅ Heartbeat ping/pong prevents disconnection

**Message Streaming (10 tests)**
- ✅ Client sends message via WebSocket
- ✅ Server receives message and broadcasts to agent
- ✅ Agent streams response back to client (chunk by chunk)
- ✅ Message chunks arrive in correct order
- ✅ Final message includes `done: true` flag
- ✅ Message streaming handles large responses (>10KB)
- ✅ Stream interruption handled gracefully (resume or fail)
- ✅ Concurrent messages queued and processed sequentially
- ✅ Message rate limiting enforced (max 10 msg/min per user)
- ✅ WebSocket error handling (reconnection logic)

**Session Synchronization (10 tests)**
- ✅ WebSocket message creates session if not exists
- ✅ Session ID returned in response
- ✅ Subsequent messages use existing session
- ✅ Session context updated with each message
- ✅ Session title auto-generated after 2 messages
- ✅ `title_updated` event broadcast to all connected clients
- ✅ Session archived when marked as complete
- ✅ Archived sessions read-only (no new messages)
- ✅ Session search returns matching sessions
- ✅ Session deletion removes WebSocket subscriptions

---

### 2.2 LLM API Integration (30 Tests)

**File:** `server/__tests__/agents/llm-api.integration.test.ts`

#### Test Cases:

**OpenAI Integration (10 tests)**
- ✅ OpenAI API key validated on first call
- ✅ GPT-4 model responds correctly
- ✅ GPT-3.5-turbo model responds correctly
- ✅ Temperature parameter controls randomness
- ✅ Max tokens limit enforced
- ✅ System message injected with agent role
- ✅ Conversation history passed correctly (last 10 messages)
- ✅ OpenAI API error returns 500 with details
- ✅ OpenAI rate limit (429) triggers retry with backoff
- ✅ OpenAI timeout (>30s) fails gracefully

**Anthropic Claude Integration (10 tests)**
- ✅ Anthropic API key validated on first call
- ✅ Claude 3 Opus model responds correctly
- ✅ Claude 3 Sonnet model responds correctly
- ✅ Claude streaming works correctly
- ✅ System prompt with agent personality injected
- ✅ Conversation history formatted correctly for Claude
- ✅ Claude API error returns 500 with details
- ✅ Claude rate limit (429) triggers retry
- ✅ Claude timeout (>30s) fails gracefully
- ✅ Claude message length limit enforced (100K tokens)

**Azure OpenAI Integration (10 tests)**
- ✅ Azure OpenAI endpoint validated
- ✅ Azure API key validated
- ✅ Azure GPT-4 deployment responds correctly
- ✅ Azure regional endpoints supported
- ✅ Azure rate limiting enforced
- ✅ Azure error handling (500, 429, 503)
- ✅ Azure fallback to standard OpenAI
- ✅ Azure deployment name validation
- ✅ Azure API version validation
- ✅ Azure timeout handling

---

### 2.3 Database Integration (30 Tests)

**File:** `server/__tests__/agents/database.integration.test.ts`

#### Test Cases:

**Agent Data Persistence (10 tests)**
- ✅ Agent synced to `ai_agents` table on load
- ✅ Agent manifest stored as JSON
- ✅ Agent pricing fields stored correctly
- ✅ Agent updates reflected in database
- ✅ Agent deletion marks as unpublished (soft delete)
- ✅ Agent installation creates `ai_agent_installations` record
- ✅ Organization agent enablement creates `organization_agents` record
- ✅ User agent access creates `user_agent_access` record
- ✅ Agent access revocation sets `revokedAt` timestamp
- ✅ Agent query filters by organizationId

**Session & Message Storage (10 tests)**
- ✅ Agent session created in `agent_sessions` table
- ✅ Session stores userId, organizationId, agentSlug
- ✅ Message created in `agent_messages` table
- ✅ Message stores role (user/assistant/system)
- ✅ Message stores content and timestamp
- ✅ Message links to session via `sessionId`
- ✅ Session query returns all messages ordered by timestamp
- ✅ Session deletion cascades to messages
- ✅ Message count per session limited to 1000 (prevents bloat)
- ✅ Session archive flag prevents new messages

**Multi-Tenancy & Isolation (10 tests)**
- ✅ Users can only access sessions in their organization
- ✅ Cross-organization session access blocked
- ✅ Agent access controlled by `organization_agents` table
- ✅ User agent permissions checked via `user_agent_access` table
- ✅ Super Admin bypasses organization restrictions
- ✅ Deleted organization cascades to sessions and messages
- ✅ Organization agent disablement blocks new sessions
- ✅ Existing sessions remain accessible after agent disabled
- ✅ Session query pagination works correctly
- ✅ Database indexes optimized for session queries

---

## 3. End-to-End Tests (50 Tests)

### 3.1 Complete Agent Conversations (50 Tests)

**File:** `client/src/__tests__/e2e/agents.spec.ts` (Playwright)

#### Test Cases:

**Luca Agent (Tax & Accounting Assistant) - 10 tests**
- ✅ User navigates to Luca agent page
- ✅ Chat interface loads within 2 seconds
- ✅ User sends tax law question (e.g., "What is Section 179 deduction?")
- ✅ Luca asks 2-3 clarifying follow-up questions
- ✅ Luca provides comprehensive tax answer (3+ paragraphs)
- ✅ Luca cites IRS sources correctly
- ✅ Session title auto-generated after 2 messages
- ✅ Session appears in Luca chat history sidebar
- ✅ User can archive session
- ✅ Archived session appears in archive view

**Cadence Agent (Workflow Automation) - 5 tests**
- ✅ User creates new workflow for email automation
- ✅ Cadence suggests workflow steps
- ✅ User approves workflow
- ✅ Workflow saved to database
- ✅ Workflow appears in workflows list

**Parity Agent (Financial Reporting) - 5 tests**
- ✅ User requests financial report generation
- ✅ Parity asks for report parameters (date range, accounts)
- ✅ Parity generates sample financial report
- ✅ Report data visualized correctly
- ✅ User can export report as PDF

**Forma Agent (Form Generation) - 5 tests**
- ✅ User requests tax organizer form
- ✅ Forma generates form with fields
- ✅ Form includes validation rules
- ✅ User can fill out form
- ✅ Form submission validates correctly

**Echo Agent (Client Communication Templates) - 5 tests**
- ✅ User requests email template for client
- ✅ Echo generates professional email template
- ✅ Template includes merge fields
- ✅ User can edit template
- ✅ Template saved to template library

**Relay Agent (Inbox Intelligence) - 5 tests**
- ✅ User uploads email to Relay
- ✅ Relay analyzes email and extracts tasks
- ✅ Tasks created in task list
- ✅ Email categorized correctly
- ✅ User can mark email as processed

**Scribe Agent (Document Generation) - 5 tests**
- ✅ User requests engagement letter
- ✅ Scribe generates engagement letter with client data
- ✅ Document formatted professionally
- ✅ User can edit document
- ✅ Document saved and downloadable

**Radar Agent (Compliance Monitoring) - 5 tests**
- ✅ User requests compliance check
- ✅ Radar identifies compliance requirements
- ✅ Radar highlights missing documentation
- ✅ User can view compliance checklist
- ✅ Compliance status updated in database

**Omnispectra Agent (Team Status Tracking) - 5 tests**
- ✅ User checks team availability
- ✅ Omnispectra shows current team status
- ✅ User can update own status
- ✅ Status broadcast to team members
- ✅ Status history visible

**Lynk Agent (Integration Orchestration) - 5 tests**
- ✅ User connects external service (e.g., QuickBooks)
- ✅ Lynk validates API credentials
- ✅ Lynk syncs data from external service
- ✅ Data appears in Accute
- ✅ Sync status visible in integrations page

---

## 4. Load & Performance Tests (20 Tests)

### 4.1 Concurrent Agent Sessions (20 Tests)

**File:** `server/__tests__/agents/load.test.ts`

#### Test Cases:

**WebSocket Load Testing (10 tests)**
- ✅ 100 concurrent WebSocket connections established
- ✅ 500 concurrent WebSocket connections established
- ✅ 1000 concurrent WebSocket connections established (stress test)
- ✅ All connections remain stable for 5 minutes
- ✅ Message throughput > 100 msg/second
- ✅ WebSocket CPU usage < 80% under load
- ✅ WebSocket memory usage < 2GB under load
- ✅ Connection latency < 100ms (p95)
- ✅ Message delivery latency < 500ms (p95)
- ✅ No dropped messages under load

**LLM API Load Testing (10 tests)**
- ✅ 10 concurrent LLM API calls complete successfully
- ✅ 50 concurrent LLM API calls complete successfully
- ✅ 100 concurrent LLM API calls complete successfully
- ✅ LLM response time < 5 seconds (p95)
- ✅ LLM response time < 10 seconds (p99)
- ✅ LLM API rate limit respected (no 429 errors)
- ✅ LLM API failover works under load
- ✅ Database connection pool handles concurrent sessions
- ✅ Session creation rate > 50 sessions/second
- ✅ Auto-title generation doesn't block message processing

---

## 5. Security & Compliance Tests (30 Tests)

### 5.1 Agent Security (30 Tests)

**File:** `server/__tests__/agents/security.test.ts`

#### Test Cases:

**Role Boundary Enforcement (10 tests)**
- ✅ Luca refuses tax advice outside domain (e.g., medical advice)
- ✅ Cadence refuses to execute unauthorized workflows
- ✅ Parity refuses to access unauthorized financial data
- ✅ All agents refuse to impersonate users
- ✅ All agents refuse to bypass RBAC permissions
- ✅ All agents log unauthorized access attempts
- ✅ Agent refusal messages are polite and redirect correctly
- ✅ No agent can access data from other organizations
- ✅ Agent system prompts enforce strict role boundaries
- ✅ Zero role boundary violations in 1M requests

**Input Validation & Sanitization (10 tests)**
- ✅ XSS prevention (HTML tags escaped in agent responses)
- ✅ SQL injection prevention (parameterized queries only)
- ✅ Command injection prevention (no shell commands)
- ✅ Path traversal prevention (no file system access)
- ✅ SSRF prevention (no external URL fetching)
- ✅ Message length validation (max 10KB per message)
- ✅ Session context size validation (max 100KB)
- ✅ File upload validation (MIME type, size, malware scan)
- ✅ Rate limiting enforced (max 10 msg/min per user)
- ✅ CSRF protection on all agent endpoints

**Data Privacy & Compliance (10 tests)**
- ✅ No raw AI messages stored (only aggregated profiles)
- ✅ PII detection and masking in logs
- ✅ Audit trail for sensitive data access
- ✅ GDPR right to be forgotten (session deletion)
- ✅ GDPR data portability (session export)
- ✅ SOC 2 compliance logging
- ✅ No credentials exposed in error messages
- ✅ Encrypted LLM credentials in transit and at rest
- ✅ Session data encrypted at rest
- ✅ Multi-tenant data isolation verified

---

## Implementation Workflow

### Phase 1: Foundation (Week 1)
1. **Setup Test Infrastructure**
   - Configure Jest for server tests
   - Configure Playwright for E2E tests
   - Setup test database (separate from dev)
   - Create test helpers and fixtures

2. **Build Unit Tests**
   - Agent routing & initialization (40 tests)
   - LLM configuration management (30 tests)
   - Agent session management (30 tests)
   - AI psychology profiling (20 tests)

### Phase 2: Integration (Week 2)
1. **Build Integration Tests**
   - WebSocket agent communication (30 tests)
   - LLM API integration (30 tests)
   - Database integration (30 tests)

### Phase 3: End-to-End (Week 3)
1. **Build E2E Tests**
   - Complete agent conversations (50 tests across 10 agents)

### Phase 4: Performance & Security (Week 4)
1. **Build Load Tests**
   - Concurrent agent sessions (20 tests)

2. **Build Security Tests**
   - Agent security & compliance (30 tests)

### Phase 5: Validation & Sign-off (Week 5)
1. **Execute All Tests**
   - Run full test suite (260 tests)
   - Measure code coverage (target: 98%+)
   - Fix failing tests

2. **Architect Review**
   - Get architect sign-off on test coverage
   - Address any gaps identified
   - Final production readiness check

---

## Success Criteria

### Test Execution Metrics
- ✅ **260/260 tests passing** (100% pass rate)
- ✅ **98%+ code coverage** on critical paths
- ✅ **All 10 agents load within 2 seconds**
- ✅ **WebSocket uptime > 99.9%** under load
- ✅ **Auto-title success rate > 95%**
- ✅ **LLM response time < 5 seconds (p95)**
- ✅ **Psychology profile accuracy > 85%**
- ✅ **Zero role boundary violations**

### Production Readiness Gates
- ✅ All unit tests passing
- ✅ All integration tests passing
- ✅ All E2E tests passing
- ✅ All load tests passing
- ✅ All security tests passing
- ✅ Architect approval obtained
- ✅ Code coverage target met
- ✅ Performance benchmarks met

---

## Test Execution Commands

```bash
# Run all AI Agent unit tests
npm run test:agents:unit

# Run all AI Agent integration tests
npm run test:agents:integration

# Run all AI Agent E2E tests
npm run test:agents:e2e

# Run all AI Agent load tests
npm run test:agents:load

# Run all AI Agent security tests
npm run test:agents:security

# Run complete AI Agent test suite
npm run test:agents:all

# Generate coverage report
npm run test:agents:coverage
```

---

## Appendix: Test Data & Fixtures

### Test Users
- **Super Admin:** `admin@accute.ai` (access to all agents)
- **Org Admin:** `admin@testorg.com` (access to org-enabled agents)
- **Manager:** `manager@testorg.com` (explicit agent permissions required)
- **Staff:** `staff@testorg.com` (explicit agent permissions required)

### Test Organizations
- **Test Org 1:** Accounting firm with 5 users
- **Test Org 2:** Tax practice with 3 users
- **Test Org 3:** Bookkeeping service with 10 users

### Test Agents (All 10)
- Luca (assistant), Cadence (workflow), Parity (legal), Forma (forms), Echo (messaging)
- Relay (inbox), Scribe (email), Radar (logging), Omnispectra (status), Lynk (integration)

### Test LLM Providers
- **OpenAI:** GPT-4, GPT-3.5-turbo
- **Anthropic:** Claude 3 Opus, Claude 3 Sonnet
- **Azure OpenAI:** GPT-4 deployment

---

**Document Version:** 1.0  
**Last Updated:** November 16, 2025  
**Next Review:** After Phase 3 completion
