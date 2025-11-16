# Agent Ecosystem & LLM Configuration: Comprehensive Analysis & Permanent Fixes

**Date:** November 16, 2025  
**Status:** CRITICAL ARCHITECTURE DOCUMENTATION  
**Author:** System Architecture Team

---

## Executive Summary

The current Agent ecosystem and LLM configuration system exhibits fragility due to **ad-hoc evolution** where components grew independently without centralized orchestration. This document provides root cause analysis, failure modes catalog, and permanent architectural fixes.

**Critical Finding:** Tight coupling between storage, middleware, and runtime code creates cascading failures. Config discovery requires cookies + storage + cache coherence, while agents individually instantiate LLMService, duplicating logic and bypassing resilience features.

---

## Table of Contents

1. [Root Cause Analysis](#root-cause-analysis)
2. [Current Architecture Problems](#current-architecture-problems)
3. [Dependency Map](#dependency-map)
4. [Failure Modes Catalog](#failure-modes-catalog)
5. [Permanent Fixes](#permanent-fixes)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Operational Checklists](#operational-checklists)

---

## Root Cause Analysis

### Primary Issue: Ad-Hoc Evolution

The LLM config service, agent middleware, and WebSocket handling **grew independently** over time, producing:

1. **Tight Coupling**: Storage → LLM config service → middleware → WebSocket → agent loader → individual agents
2. **Logic Duplication**: Each agent individually instantiates `LLMService`, duplicating config resolution logic
3. **Bypassed Resilience**: Individual agent instantiation bypasses centralized error handling and fallback mechanisms
4. **Cache Incoherence**: 5-minute TTL cache can linger after mutations, causing stale configs

### Secondary Issues

- **No Centralized Orchestrator**: No single source of truth for agent metadata, routing, or connection lifecycle
- **Inconsistent Session Persistence**: Only Cadence tracks `conversationId`, other 9 agents don't persist sessions
- **Fragile WebSocket Initialization**: Lazy init + strict URL checking + query params = connection failures
- **Route Path Confusion**: `/agents/:slug` vs `/ai-agents/:slug` inconsistency
- **Missing Config Validation**: File uploads bypass LLM config validation

---

## Current Architecture Problems

### 1. LLM Configuration System

**Current State:**
```typescript
// Fragile: Each agent instantiates LLMService independently
const llmService = new LLMService(
  config.provider,
  decryptedKey,
  config.azureEndpoint,
  config.azureDeploymentName
);
```

**Problems:**
- ❌ No centralized config resolution
- ❌ Decryption happens multiple times per request
- ❌ Cache invalidation requires manual coordination
- ❌ No provider validation or fallback strategy
- ❌ Missing API key creates silent failures

**Current Flow:**
```
Frontend → API Request with llmConfigId
         → withLLMConfig middleware
         → LLMConfigService.getLLMConfigForRequest()
         → 5-min cache lookup
         → Decrypt API key
         → Pass to agent
         → Agent creates new LLMService
         → Make API call
```

### 2. WebSocket Infrastructure

**Current State:**
```typescript
// Fragile: Lazy initialization with strict URL checking
if (request.url === '/ws/ai-stream') { // ❌ Breaks with query params
  wss = initializeWebSocketServer(httpServer);
}
```

**Problems:**
- ❌ Lazy initialization causes race conditions
- ❌ Query parameters break URL equality check
- ❌ `noServer: true` mode conflicts with manual upgrade handling
- ❌ Double `handleUpgrade()` calls crash server
- ❌ No connection pooling or reconnection strategy

**Current Flow:**
```
Client → WebSocket connection to /ws/ai-stream?agentSlug=luca&sessionId=123
       → httpServer.on('upgrade') handler
       → Strict URL check (fails with query params)
       → Initialize WSS if first connection
       → handleUpgrade() (can be called twice)
       → Connection established or crashes
```

### 3. Agent Registration & Routing

**Current State:**
```typescript
// Fragile: Late registration after Vite catch-all
await initializeSystem(app);
await registerAgentRoutes(app);  // Agents registered late
setupVite(app);  // Catch-all registered
```

**Problems:**
- ❌ Route path confusion: `/agents/:slug` vs `/ai-agents/:slug`
- ❌ Agent routes registered after system init (timing issue)
- ❌ Vite catch-all can intercept agent API routes
- ❌ No route aliases for backward compatibility
- ❌ Frontend and backend route patterns don't match

**Current Flow:**
```
Server Start → Listen on port 5000
            → Attach WebSocket upgrade handler
            → Initialize system (RBAC, DB, etc.)
            → Register agent routes (/api/agents/*)
            → Setup Vite (catch-all /*)
            → Routes active
```

### 4. Session Persistence

**Current State:**
- ✅ **Cadence**: Has full session persistence with `conversationId`
- ❌ **Other 9 Agents**: No session persistence, conversations lost on reload

**Problems:**
- ❌ Inconsistent user experience across agents
- ❌ Lost conversation context when browser refreshes
- ❌ No conversation history for non-Cadence agents
- ❌ Duplicate pattern implementation needed for each agent

---

## Dependency Map

### Storage Layer → Service Layer
```
PostgreSQL Database
  ├── users (authentication)
  ├── organizations (workspace scoping)
  ├── llm_configurations (encrypted API keys)
  ├── cadence_sessions (only for Cadence!)
  ├── cadence_messages (only for Cadence!)
  └── [Missing: agent_sessions, agent_messages for other 9 agents]
        ↓
LLMConfigService (5-min cache)
  ├── getLLMConfigForRequest(userId, organizationId, llmConfigId?)
  ├── getDefaultLLMConfig(organizationId)
  ├── Cache management (memoizee 5-min TTL)
  └── Encryption/decryption
```

### Middleware Layer
```
withLLMConfig Middleware (HTTP endpoints)
  ├── Extracts llmConfigId from req.body
  ├── Calls LLMConfigService.getLLMConfigForRequest()
  ├── Attaches req.llmConfig
  └── Returns 400 if no config found

getLLMConfig Helper (WebSocket/File uploads)
  ├── Similar logic to withLLMConfig
  ├── Returns null instead of throwing
  └── Used in file upload handlers
```

### Runtime Layer
```
WebSocket Server (server/websocket.ts)
  ├── Lazy initialization on first upgrade request
  ├── URL pathname check: /ws/ai-stream
  ├── Authentication via cookie parsing
  ├── Fetches LLM config per message
  └── Calls createStaticAgentInstance()
        ↓
Agent Loader (server/agent-loader.ts)
  ├── Static agent registry (10 agents)
  ├── Dynamic route registration
  └── Returns agent instance
        ↓
Individual Agent (e.g., agents/luca/backend/index.ts)
  ├── Instantiates LLMService (duplication!)
  ├── Executes agent logic
  ├── Streams response via WebSocket
  └── [Missing: session persistence for 9 agents]
```

### Frontend Layer
```
Client Application
  ├── useAgentWebSocket hook
  │     ├── Connects to /ws/ai-stream?agentSlug=X&sessionId=Y
  │     ├── Handles reconnection
  │     └── Streams messages
  ├── LLM Config Selectors (all 10 agents)
  │     ├── Auto-selects default config
  │     ├── Workspace fallback to user configs
  │     └── Passes llmConfigId with messages
  └── Router
        ├── /ai-agents/:slug → AgentDetail component
        ├── OrganizationRoute wrapper
        └── ProtectedRoute wrapper
```

---

## Failure Modes Catalog

### 1. WebSocket Connection Failures

**Symptom:** "WebSocket is closed before the connection is established"

**Root Causes:**
- ❌ Strict URL equality check: `request.url === '/ws/ai-stream'` fails with query params
- ❌ Query params in client hook: `/ws/ai-stream?agentSlug=luca&sessionId=123`
- ❌ Double `handleUpgrade()` when using `noServer: true` + manual handling

**Impact:** Users cannot send messages to any AI agent

**Current Fix:** Parse pathname instead of full URL
```typescript
const { pathname } = new URL(request.url!, `http://${request.headers.host}`);
if (pathname === '/ws/ai-stream') { /* ... */ }
```

**Permanent Fix Needed:** Centralized WebSocket server with normalized URL handling

---

### 2. Route Path Confusion

**Symptom:** 404 Page Not Found when accessing `/agents/luca`

**Root Causes:**
- ❌ Frontend routes use `/ai-agents/:slug`
- ❌ Users/docs reference `/agents/:slug`
- ❌ No redirect aliases

**Impact:** Users cannot access agents, see 404 page

**Current Workaround:** Update documentation to use `/ai-agents/:slug`

**Permanent Fix Needed:** Add route aliases for backward compatibility

---

### 3. Stale LLM Configuration Cache

**Symptom:** Updated LLM configs don't take effect immediately

**Root Causes:**
- ❌ 5-minute TTL cache in LLMConfigService
- ❌ Cache not invalidated on config mutations
- ❌ Manual invalidation in some endpoints, missed in others

**Impact:** Users see old/invalid API keys, API calls fail

**Current Fix:** Manual `invalidateLLMConfigCache()` calls after mutations

**Permanent Fix Needed:** Event-driven cache invalidation

---

### 4. Missing Session Persistence (9 Agents)

**Symptom:** Conversation history lost on browser refresh for all agents except Cadence

**Root Causes:**
- ❌ Only Cadence has `cadence_sessions` and `cadence_messages` tables
- ❌ Other 9 agents don't implement session persistence
- ❌ No shared session abstraction

**Impact:** Poor user experience, lost context, repeated questions

**Current State:** Only Cadence persists conversations

**Permanent Fix Needed:** Unified agent session service

---

### 5. LLM Config Auto-Selection Failures

**Symptom:** Agent fails to auto-select LLM config, shows "No LLM configuration selected"

**Root Causes:**
- ❌ Empty string `""` initial state prevents auto-selection useEffect from running
- ❌ Priority logic: default configs → user configs → first available
- ❌ Missing configs when no API keys in environment

**Impact:** Users must manually select config every time

**Current Fix:** Fixed initial state, proper useEffect dependencies

**Permanent Fix Needed:** Backend-driven default config selection

---

### 6. File Upload Config Bypass

**Symptom:** File uploads to agents work without LLM config validation

**Root Causes:**
- ❌ File upload endpoints use `getLLMConfig().catch(() => null)`
- ❌ No validation that config exists before processing
- ❌ Silent failures when config missing

**Impact:** Inconsistent behavior, potential errors during file processing

**Current Workaround:** Return null and skip LLM processing

**Permanent Fix Needed:** Require valid config for all agent operations

---

### 7. Agent Route Registration Race

**Symptom:** Agent API routes return HTML instead of JSON (Vite catch-all intercepts)

**Root Causes:**
- ❌ Agent routes registered during background initialization
- ❌ Vite catch-all active before agent routes ready
- ❌ Race condition between initialization and route registration

**Impact:** 500 errors, HTML responses for JSON endpoints

**Current Fix:** Sequential initialization order in server/index.ts:
1. `server.listen()` for health checks
2. `await initializeSystem(app)` blocks until agents ready
3. Register all agent routes AFTER agents initialized
4. `setupVite()` adds catch-all LAST

**Permanent Fix Needed:** Declarative route registration before any catch-all

---

## Permanent Fixes

### Fix 1: Agent Orchestrator Module

**Goal:** Centralized source of truth for all agent metadata, routing, and connection lifecycle

**Implementation:**
```typescript
// server/agent-orchestrator.ts

interface AgentMetadata {
  slug: string;
  name: string;
  description: string;
  hasSessionPersistence: boolean;
  websocketTopic: string;
  routePaths: string[];  // ['/ai-agents/:slug', '/agents/:slug'] for aliases
  requiresLLMConfig: boolean;
}

class AgentOrchestrator {
  private registry: Map<string, AgentMetadata>;
  private connectionPool: Map<string, WebSocket>;
  
  // Single source of truth
  registerAgent(metadata: AgentMetadata): void;
  getAgent(slug: string): AgentMetadata | null;
  getAllAgents(): AgentMetadata[];
  
  // Connection lifecycle
  handleConnection(ws: WebSocket, agentSlug: string, sessionId: string): void;
  closeConnection(sessionId: string): void;
  
  // Route management
  getRoutesForAgent(slug: string): string[];
  getAllRoutes(): Map<string, AgentMetadata>;
}

export const orchestrator = new AgentOrchestrator();
```

**Benefits:**
- ✅ Single registry consumed by both backend and frontend
- ✅ Declarative agent manifest drives routing
- ✅ Centralized connection management
- ✅ Easy to add new agents
- ✅ Build-time route validation

---

### Fix 2: Injected ConfigResolver

**Goal:** Replace ad-hoc LLMService instantiation with centralized config resolution

**Implementation:**
```typescript
// server/config-resolver.ts

interface ResolvedConfig {
  provider: string;
  apiKey: string;  // Already decrypted
  endpoint?: string;
  deploymentName?: string;
  validatedAt: Date;
  cacheKey: string;
}

class ConfigResolver {
  private cache: Map<string, ResolvedConfig>;
  private validationStatus: Map<string, boolean>;
  
  async resolve(
    userId: number,
    organizationId: number,
    llmConfigId?: number
  ): Promise<ResolvedConfig> {
    // 1. Check cache
    const cacheKey = this.getCacheKey(userId, organizationId, llmConfigId);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // 2. Fetch and decrypt
    const config = await this.fetchConfig(userId, organizationId, llmConfigId);
    
    // 3. Validate provider
    await this.validateProvider(config);
    
    // 4. Cache with TTL
    this.cache.set(cacheKey, config);
    setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);
    
    return config;
  }
  
  async invalidate(organizationId: number): Promise<void> {
    // Event-driven cache invalidation
    for (const [key, config] of this.cache.entries()) {
      if (key.includes(`org:${organizationId}`)) {
        this.cache.delete(key);
      }
    }
  }
}

export const configResolver = new ConfigResolver();
```

**Benefits:**
- ✅ Single decryption per request
- ✅ Centralized validation and fallback
- ✅ Event-driven cache invalidation
- ✅ Provider health tracking
- ✅ No logic duplication

---

### Fix 3: Dedicated WebSocket Bootstrap

**Goal:** Single WebSocket server initialized on server start, not lazily

**Implementation:**
```typescript
// server/websocket-bootstrap.ts

class WebSocketBootstrap {
  private wss: WebSocketServer | null = null;
  private sessionStore: Map<string, AgentSession>;
  
  initialize(httpServer: Server): void {
    if (this.wss) {
      throw new Error('WebSocket server already initialized');
    }
    
    // Initialize immediately on server start
    this.wss = new WebSocketServer({ 
      noServer: true  // Manual upgrade handling
    });
    
    // Normalized URL parsing
    httpServer.on('upgrade', (request, socket, head) => {
      const url = this.parseURL(request);
      
      if (url.pathname === '/ws/ai-stream') {
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.handleConnection(ws, url);
        });
      } else {
        socket.destroy();
      }
    });
    
    console.log('✅ WebSocket server initialized');
  }
  
  private parseURL(request: IncomingMessage): URL {
    return new URL(request.url!, `http://${request.headers.host}`);
  }
  
  private handleConnection(ws: WebSocket, url: URL): void {
    const agentSlug = url.searchParams.get('agentSlug');
    const sessionId = url.searchParams.get('sessionId');
    
    if (!agentSlug || !sessionId) {
      ws.close(1008, 'Missing required parameters');
      return;
    }
    
    // Centralized session management
    orchestrator.handleConnection(ws, agentSlug, sessionId);
  }
}

export const wsBootstrap = new WebSocketBootstrap();
```

**Benefits:**
- ✅ No lazy initialization races
- ✅ Normalized URL parsing (handles query params)
- ✅ Single `handleUpgrade()` call
- ✅ Centralized session management
- ✅ Graceful error handling

---

### Fix 4: Shared Agent Session Service

**Goal:** Unified session persistence for all 10 agents

**Implementation:**
```typescript
// Database schema addition (shared/schema.ts)
export const agentSessions = pgTable("agent_sessions", {
  id: serial("id").primaryKey(),
  agentSlug: varchar("agent_slug", { length: 50 }).notNull(),
  sessionId: varchar("session_id", { length: 255 }).notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  title: varchar("title", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentMessages = pgTable("agent_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => agentSessions.id, { onDelete: 'cascade' }),
  role: varchar("role", { length: 20 }).notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  metadata: jsonb("metadata"), // For agent-specific data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Service layer (server/agent-session-service.ts)
class AgentSessionService {
  async getOrCreateSession(
    agentSlug: string,
    sessionId: string,
    userId: number,
    organizationId: number
  ): Promise<AgentSession> {
    // Fetch or create session
    // Load message history
    // Return session object
  }
  
  async saveMessage(
    sessionId: number,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Save message to database
    // Update session timestamp
  }
  
  async getHistory(sessionId: number, limit: number = 50): Promise<Message[]> {
    // Load conversation history
  }
  
  async updateSessionTitle(sessionId: number, title: string): Promise<void> {
    // Auto-generate or update title
  }
}

export const sessionService = new AgentSessionService();
```

**Migration Plan:**
1. Create new tables: `agent_sessions`, `agent_messages`
2. Migrate Cadence to use new tables
3. Remove Cadence-specific tables after migration
4. Roll out to other 9 agents
5. Update all agent backends to use `sessionService`

**Benefits:**
- ✅ Consistent UX across all agents
- ✅ Conversation history persists
- ✅ Single implementation for all agents
- ✅ Easy to add new agents
- ✅ Centralized session management

---

### Fix 5: Formalized Route Mappings

**Goal:** Shared agent registry consumed at build time, with redirect aliases

**Implementation:**
```typescript
// shared/agent-registry.ts (consumed by both frontend and backend)

export const AGENT_REGISTRY = [
  {
    slug: 'luca',
    name: 'Luca',
    description: 'AI Accounting Expert',
    paths: ['/ai-agents/luca', '/agents/luca'],  // Primary + alias
    primaryPath: '/ai-agents/luca',
    hasSessionPersistence: true,
    requiresLLMConfig: true,
  },
  {
    slug: 'cadence',
    name: 'Cadence',
    description: 'Tax Compliance Specialist',
    paths: ['/ai-agents/cadence', '/agents/cadence'],
    primaryPath: '/ai-agents/cadence',
    hasSessionPersistence: true,
    requiresLLMConfig: true,
  },
  // ... other 8 agents
] as const;

// Backend route registration (server/agent-routes.ts)
import { AGENT_REGISTRY } from '@shared/agent-registry';

export function registerAgentRoutes(app: Express): void {
  for (const agent of AGENT_REGISTRY) {
    // Register all paths for each agent
    for (const path of agent.paths) {
      app.get(`${path}`, (req, res) => {
        // Agent detail endpoint
      });
    }
    
    // API endpoints
    app.post(`/api/agents/${agent.slug}/chat`, withLLMConfig, async (req, res) => {
      // Chat endpoint
    });
  }
  
  console.log(`✅ Registered ${AGENT_REGISTRY.length} agents`);
}

// Frontend router (client/src/App.tsx)
import { AGENT_REGISTRY } from '@shared/agent-registry';

// Auto-generate routes from registry
{AGENT_REGISTRY.map(agent => (
  <Route key={agent.slug} path={agent.primaryPath}>
    <OrganizationRoute>
      <AppLayout>
        <AgentDetail />
      </AppLayout>
    </OrganizationRoute>
  </Route>
))}
```

**Benefits:**
- ✅ Single source of truth
- ✅ Build-time validation
- ✅ Automatic redirect aliases
- ✅ No route path confusion
- ✅ Easy to add new agents

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)

**Goal:** Establish core architectural components

1. **Create Agent Orchestrator Module** (2 days)
   - Design `AgentMetadata` interface
   - Implement `AgentOrchestrator` class
   - Create agent manifest for all 10 agents
   - Write unit tests

2. **Implement ConfigResolver** (2 days)
   - Design `ResolvedConfig` interface
   - Implement cache with event-driven invalidation
   - Add provider validation logic
   - Migrate existing code to use resolver

3. **Setup Shared Agent Registry** (1 day)
   - Create `shared/agent-registry.ts`
   - Define agent metadata for all 10 agents
   - Add TypeScript types and validation
   - Document registry schema

### Phase 2: WebSocket Refactor (Week 2)

**Goal:** Bulletproof WebSocket infrastructure

1. **WebSocket Bootstrap** (2 days)
   - Implement eager initialization
   - Add normalized URL parsing
   - Setup connection pooling
   - Add reconnection strategy
   - Write integration tests

2. **Session Service** (3 days)
   - Create database schema (`agent_sessions`, `agent_messages`)
   - Implement `AgentSessionService`
   - Migrate Cadence to new service
   - Test with existing Cadence frontend

### Phase 3: Agent Migration (Week 3)

**Goal:** Migrate all 9 agents to unified architecture

1. **Update Agent Backends** (3 days)
   - Migrate Luca, Parity, Forma (Day 1)
   - Migrate Echo, Relay, Scribe (Day 2)
   - Migrate Radar, OmniSpectra, Lynk (Day 3)
   - Each agent uses:
     - `configResolver` instead of direct LLMService instantiation
     - `sessionService` for message persistence
     - Standardized error handling

2. **Update Agent Frontends** (2 days)
   - Ensure all use `useAgentWebSocket` hook
   - Add session restoration on mount
   - Test conversation history
   - Verify LLM config auto-selection

### Phase 4: Route Consolidation (Week 4)

**Goal:** Unified routing with aliases

1. **Backend Route Registration** (1 day)
   - Use `AGENT_REGISTRY` from shared
   - Register all route aliases
   - Ensure Vite catch-all is last
   - Test all route paths

2. **Frontend Route Generation** (1 day)
   - Auto-generate routes from registry
   - Add redirects for old paths
   - Update navigation components
   - Test deep linking

3. **Documentation Update** (1 day)
   - Update all references to use `/ai-agents/:slug`
   - Document route aliases
   - Add troubleshooting guide
   - Create runbook for common issues

### Phase 5: Testing & Validation (Week 5)

**Goal:** Comprehensive testing and hardening

1. **Integration Tests** (2 days)
   - WebSocket connection/disconnection
   - Session persistence across agents
   - LLM config resolution and caching
   - Route registration and aliases
   - Concurrent agent usage

2. **Load Testing** (1 day)
   - Multiple simultaneous connections
   - Config cache performance
   - Session query performance
   - Memory leak detection

3. **Documentation** (2 days)
   - Architecture diagrams
   - Connection flow charts
   - Configuration lifecycle
   - Troubleshooting playbook
   - Operational runbook

---

## Operational Checklists

### Deployment Checklist

Before deploying changes:

- [ ] Run database migration: `npm run db:push`
- [ ] Verify all 10 agents in registry
- [ ] Test WebSocket connections for each agent
- [ ] Verify LLM config auto-selection
- [ ] Test session persistence
- [ ] Check route aliases work
- [ ] Verify cache invalidation on config updates
- [ ] Test concurrent agent usage
- [ ] Review server logs for errors
- [ ] Monitor WebSocket connection count

### Adding New Agent Checklist

When adding a new AI agent:

- [ ] Add entry to `shared/agent-registry.ts`
- [ ] Create agent backend at `agents/{slug}/backend/index.ts`
- [ ] Use `configResolver` for LLM config
- [ ] Use `sessionService` for message persistence
- [ ] Implement standardized error handling
- [ ] Create agent frontend page
- [ ] Add LLM config selector to UI
- [ ] Test WebSocket connection
- [ ] Test session restoration
- [ ] Update documentation
- [ ] Add to integration tests

### Troubleshooting Checklist

When investigating agent issues:

**WebSocket Connection Failures:**
- [ ] Check server logs for upgrade requests
- [ ] Verify pathname parsing (not full URL)
- [ ] Check query parameters format
- [ ] Verify authentication cookie present
- [ ] Check WebSocket server initialized
- [ ] Review connection pool state

**LLM Config Issues:**
- [ ] Verify API keys present in environment
- [ ] Check config cache state
- [ ] Verify auto-selection logic
- [ ] Test manual config selection
- [ ] Check provider validation
- [ ] Review decryption errors

**Session Persistence Issues:**
- [ ] Check `agent_sessions` table
- [ ] Verify `agent_messages` populated
- [ ] Check session ID matching
- [ ] Verify user/org scoping
- [ ] Review session restoration logic

**Route Not Found (404):**
- [ ] Verify agent in registry
- [ ] Check route registration order
- [ ] Test both primary and alias paths
- [ ] Verify Vite catch-all is last
- [ ] Check OrganizationRoute wrapper
- [ ] Review ProtectedRoute permissions

---

## Conclusion

This architecture overhaul eliminates fragile ad-hoc patterns in favor of **centralized orchestration**, **declarative configuration**, and **unified session management**.

### Key Takeaways

1. **Agent Orchestrator** provides single source of truth for metadata and routing
2. **ConfigResolver** eliminates duplicated LLM service instantiation
3. **WebSocket Bootstrap** prevents lazy initialization races
4. **Shared Session Service** ensures consistent UX across all agents
5. **Formalized Route Registry** prevents path confusion

### Expected Outcomes

After implementing these fixes:

- ✅ WebSocket connections never fail due to query params
- ✅ All 10 agents have session persistence
- ✅ LLM configs auto-select reliably
- ✅ Route paths are unambiguous
- ✅ Cache invalidation is event-driven
- ✅ New agents take <1 hour to add
- ✅ System is observable and debuggable

### Next Steps

1. Review this document with engineering team
2. Prioritize phases based on business impact
3. Assign owners to each phase
4. Schedule weekly review meetings
5. Track progress in project management tool

**You should NEVER face these issues again.**

---

## Appendix

### Architecture Diagrams

*(To be created during Phase 5)*

1. Current State Diagram
2. Target State Diagram
3. WebSocket Connection Flow
4. LLM Config Resolution Flow
5. Agent Registration Flow
6. Session Persistence Flow

### Reference Documentation

- [Agent Orchestrator API](./agent-orchestrator-api.md) *(to be created)*
- [ConfigResolver API](./config-resolver-api.md) *(to be created)*
- [Session Service API](./session-service-api.md) *(to be created)*
- [WebSocket Bootstrap API](./websocket-bootstrap-api.md) *(to be created)*
- [Agent Registry Schema](./agent-registry-schema.md) *(to be created)*

### Contact

For questions about this architecture:
- Technical Lead: [To be assigned]
- DevOps: [To be assigned]
- Product Owner: [To be assigned]

---

**Document Version:** 1.0  
**Last Updated:** November 16, 2025  
**Status:** Draft for Review
