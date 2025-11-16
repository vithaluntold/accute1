# Migration Guide: Implementing Permanent Agent Ecosystem Fixes

**Version:** 1.0  
**Date:** November 16, 2025  
**Status:** Implementation Guide

---

## Overview

This guide provides step-by-step instructions for migrating from the current fragile agent architecture to the permanent robust solution outlined in `AGENT_ECOSYSTEM_ANALYSIS.md`.

**Estimated Timeline:** 5 weeks (can be parallelized)

**Prerequisites:**
- Review `AGENT_ECOSYSTEM_ANALYSIS.md` for context
- Backup production database
- Ensure test environment is ready
- Review `QUICK_REFERENCE_AGENT_SYSTEM.md` for current state

---

## Phase 1: Foundation (Week 1)

### Day 1-2: Create Agent Orchestrator Module

**Goal:** Centralized source of truth for agent metadata

#### Step 1.1: Create Agent Metadata Interface

```typescript
// shared/types/agent.ts

export interface AgentMetadata {
  slug: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  category: 'finance' | 'compliance' | 'automation' | 'communication' | 'analytics';
  
  // Feature flags
  hasSessionPersistence: boolean;
  requiresLLMConfig: boolean;
  supportsFileUpload: boolean;
  supportsWebSocket: boolean;
  
  // Routing
  websocketTopic: string;
  routePaths: string[];  // Primary + aliases
  primaryPath: string;
  
  // Capabilities
  supportedFileTypes?: string[];
  maxFileSize?: number;
  
  // Metadata
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentCapabilities {
  canAnalyzeDocuments: boolean;
  canGenerateReports: boolean;
  canManageWorkflows: boolean;
  canAccessCalendar: boolean;
  canSendNotifications: boolean;
}
```

#### Step 1.2: Create Agent Orchestrator Service

```typescript
// server/agent-orchestrator.ts

import { AgentMetadata } from '@shared/types/agent';
import { WebSocket } from 'ws';

interface AgentConnection {
  ws: WebSocket;
  agentSlug: string;
  sessionId: string;
  userId: number;
  organizationId: number;
  connectedAt: Date;
}

class AgentOrchestrator {
  private registry: Map<string, AgentMetadata> = new Map();
  private connections: Map<string, AgentConnection> = new Map();
  
  /**
   * Register an agent in the orchestrator
   */
  registerAgent(metadata: AgentMetadata): void {
    if (this.registry.has(metadata.slug)) {
      throw new Error(`Agent ${metadata.slug} already registered`);
    }
    
    console.log(`[Orchestrator] Registering agent: ${metadata.name} (${metadata.slug})`);
    this.registry.set(metadata.slug, metadata);
  }
  
  /**
   * Get agent metadata by slug
   */
  getAgent(slug: string): AgentMetadata | null {
    return this.registry.get(slug) || null;
  }
  
  /**
   * Get all registered agents
   */
  getAllAgents(): AgentMetadata[] {
    return Array.from(this.registry.values());
  }
  
  /**
   * Get all route paths across all agents
   */
  getAllRoutes(): Map<string, AgentMetadata> {
    const routes = new Map<string, AgentMetadata>();
    
    for (const agent of this.registry.values()) {
      for (const path of agent.routePaths) {
        routes.set(path, agent);
      }
    }
    
    return routes;
  }
  
  /**
   * Handle new WebSocket connection
   */
  handleConnection(
    ws: WebSocket,
    agentSlug: string,
    sessionId: string,
    userId: number,
    organizationId: number
  ): void {
    const agent = this.getAgent(agentSlug);
    if (!agent) {
      throw new Error(`Agent ${agentSlug} not found`);
    }
    
    if (!agent.supportsWebSocket) {
      throw new Error(`Agent ${agentSlug} does not support WebSocket`);
    }
    
    const connectionId = `${agentSlug}:${sessionId}`;
    
    this.connections.set(connectionId, {
      ws,
      agentSlug,
      sessionId,
      userId,
      organizationId,
      connectedAt: new Date(),
    });
    
    console.log(`[Orchestrator] Connection established: ${connectionId}`);
  }
  
  /**
   * Close a connection
   */
  closeConnection(agentSlug: string, sessionId: string): void {
    const connectionId = `${agentSlug}:${sessionId}`;
    const connection = this.connections.get(connectionId);
    
    if (connection) {
      connection.ws.close();
      this.connections.delete(connectionId);
      console.log(`[Orchestrator] Connection closed: ${connectionId}`);
    }
  }
  
  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    connectionsByAgent: Record<string, number>;
  } {
    const stats = {
      totalConnections: this.connections.size,
      connectionsByAgent: {} as Record<string, number>,
    };
    
    for (const connection of this.connections.values()) {
      stats.connectionsByAgent[connection.agentSlug] =
        (stats.connectionsByAgent[connection.agentSlug] || 0) + 1;
    }
    
    return stats;
  }
}

export const orchestrator = new AgentOrchestrator();
```

#### Step 1.3: Create Shared Agent Registry

```typescript
// shared/agent-registry.ts

import { AgentMetadata } from './types/agent';

export const AGENT_REGISTRY: AgentMetadata[] = [
  {
    slug: 'luca',
    name: 'Luca',
    description: 'AI Accounting Expert - Your intelligent assistant for accounting, finance, and taxation queries',
    icon: 'Calculator',
    color: '#FF6B35',
    category: 'finance',
    hasSessionPersistence: false,  // TODO: Migrate to true in Phase 3
    requiresLLMConfig: true,
    supportsFileUpload: true,
    supportsWebSocket: true,
    websocketTopic: '/ws/ai-stream',
    routePaths: ['/ai-agents/luca', '/agents/luca'],
    primaryPath: '/ai-agents/luca',
    supportedFileTypes: ['pdf', 'docx', 'xlsx', 'csv', 'txt'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    version: '1.0.0',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-11-16'),
  },
  {
    slug: 'cadence',
    name: 'Cadence',
    description: 'Tax Compliance Specialist - Expert guidance on tax regulations and compliance',
    icon: 'FileText',
    color: '#4ECDC4',
    category: 'compliance',
    hasSessionPersistence: true,  // ✅ Already has persistence
    requiresLLMConfig: true,
    supportsFileUpload: true,
    supportsWebSocket: true,
    websocketTopic: '/ws/ai-stream',
    routePaths: ['/ai-agents/cadence', '/agents/cadence'],
    primaryPath: '/ai-agents/cadence',
    supportedFileTypes: ['pdf', 'docx', 'xlsx', 'csv', 'txt'],
    maxFileSize: 10 * 1024 * 1024,
    version: '1.0.0',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-11-16'),
  },
  // ... Add all 10 agents here
];

// Helper functions
export function getAgentBySlug(slug: string): AgentMetadata | undefined {
  return AGENT_REGISTRY.find(agent => agent.slug === slug);
}

export function getAllAgentSlugs(): string[] {
  return AGENT_REGISTRY.map(agent => agent.slug);
}

export function getAgentsByCategory(category: AgentMetadata['category']): AgentMetadata[] {
  return AGENT_REGISTRY.filter(agent => agent.category === category);
}
```

#### Step 1.4: Update Server Initialization

```typescript
// server/index.ts

import { orchestrator } from './agent-orchestrator';
import { AGENT_REGISTRY } from '@shared/agent-registry';

async function initializeAgentOrchestrator(): Promise<void> {
  console.log('🤖 Initializing Agent Orchestrator...');
  
  for (const agentMetadata of AGENT_REGISTRY) {
    orchestrator.registerAgent(agentMetadata);
  }
  
  console.log(`✅ Agent Orchestrator initialized with ${AGENT_REGISTRY.length} agents`);
}

// In main initialization
await initializeAgentOrchestrator();
```

**Testing Step 1:**
```bash
npm run dev
# Should see: "✅ Agent Orchestrator initialized with 10 agents"

# Verify in code:
import { orchestrator } from '@/server/agent-orchestrator';
console.log(orchestrator.getAllAgents()); // Should show all 10 agents
```

---

### Day 3-4: Implement ConfigResolver

**Goal:** Replace ad-hoc LLMService instantiation

#### Step 2.1: Create ConfigResolver Interface

```typescript
// server/config-resolver.ts

import { decrypt } from './crypto';
import { db } from './db';
import { llmConfigurations } from '@shared/schema';
import { and, eq, or } from 'drizzle-orm';

export interface ResolvedConfig {
  id: number;
  provider: string;
  apiKey: string;  // Already decrypted
  endpoint?: string;
  deploymentName?: string;
  organizationId: number;
  userId: number | null;
  isDefault: boolean;
  validatedAt: Date | null;
  cacheKey: string;
}

interface ConfigCache {
  config: ResolvedConfig;
  expiresAt: Date;
}

class ConfigResolver {
  private cache: Map<string, ConfigCache> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Resolve LLM configuration with caching and fallback logic
   */
  async resolve(
    userId: number,
    organizationId: number,
    llmConfigId?: number
  ): Promise<ResolvedConfig | null> {
    // 1. Check cache first
    const cacheKey = this.getCacheKey(userId, organizationId, llmConfigId);
    const cached = this.getCached(cacheKey);
    if (cached) {
      console.log(`[ConfigResolver] Cache hit: ${cacheKey}`);
      return cached;
    }
    
    console.log(`[ConfigResolver] Cache miss: ${cacheKey}`);
    
    // 2. Fetch from database
    const config = await this.fetchConfig(userId, organizationId, llmConfigId);
    if (!config) {
      return null;
    }
    
    // 3. Decrypt API key
    const decryptedKey = decrypt(config.apiKey);
    
    // 4. Build resolved config
    const resolved: ResolvedConfig = {
      id: config.id,
      provider: config.provider,
      apiKey: decryptedKey,
      endpoint: config.azureEndpoint || undefined,
      deploymentName: config.azureDeploymentName || undefined,
      organizationId: config.organizationId,
      userId: config.userId,
      isDefault: config.isDefault || false,
      validatedAt: config.validatedAt,
      cacheKey,
    };
    
    // 5. Cache with TTL
    this.setCache(cacheKey, resolved);
    
    return resolved;
  }
  
  /**
   * Invalidate cache for a specific organization
   */
  invalidate(organizationId: number): void {
    console.log(`[ConfigResolver] Invalidating cache for org: ${organizationId}`);
    
    for (const [key, _] of this.cache.entries()) {
      if (key.includes(`org:${organizationId}`)) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Invalidate all cache
   */
  invalidateAll(): void {
    console.log('[ConfigResolver] Invalidating all cache');
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    entries: string[];
  } {
    return {
      size: this.cache.size,
      hitRate: 0, // TODO: Track hits/misses
      entries: Array.from(this.cache.keys()),
    };
  }
  
  private getCacheKey(
    userId: number,
    organizationId: number,
    llmConfigId?: number
  ): string {
    return `user:${userId}:org:${organizationId}:config:${llmConfigId || 'default'}`;
  }
  
  private getCached(key: string): ResolvedConfig | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (cached.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.config;
  }
  
  private setCache(key: string, config: ResolvedConfig): void {
    this.cache.set(key, {
      config,
      expiresAt: new Date(Date.now() + this.CACHE_TTL),
    });
  }
  
  private async fetchConfig(
    userId: number,
    organizationId: number,
    llmConfigId?: number
  ): Promise<any | null> {
    // If specific config requested
    if (llmConfigId) {
      const config = await db.query.llmConfigurations.findFirst({
        where: and(
          eq(llmConfigurations.id, llmConfigId),
          eq(llmConfigurations.organizationId, organizationId)
        ),
      });
      
      return config || null;
    }
    
    // Fallback: workspace default > user default > first available
    const configs = await db.query.llmConfigurations.findMany({
      where: and(
        eq(llmConfigurations.organizationId, organizationId),
        or(
          eq(llmConfigurations.userId, null),  // Workspace configs
          eq(llmConfigurations.userId, userId)  // User configs
        )
      ),
      orderBy: (llmConfigurations, { desc }) => [
        desc(llmConfigurations.isDefault),
        desc(llmConfigurations.userId),  // Prefer workspace over user
      ],
    });
    
    return configs[0] || null;
  }
}

export const configResolver = new ConfigResolver();
```

#### Step 2.2: Update Middleware to Use ConfigResolver

```typescript
// server/middleware/with-llm-config.ts

import { configResolver } from '@/server/config-resolver';

export function withLLMConfig(req: Request, res: Response, next: NextFunction) {
  const user = req.user!;
  const llmConfigId = req.body.llmConfigId as number | undefined;
  
  configResolver
    .resolve(user.userId, user.organizationId, llmConfigId)
    .then((config) => {
      if (!config) {
        return res.status(400).json({
          error: 'No LLM configuration found. Please configure an LLM provider in Settings.',
        });
      }
      
      // Attach to request (DO NOT return decrypted key to client)
      req.llmConfig = config;
      next();
    })
    .catch((error) => {
      console.error('[withLLMConfig] Error resolving config:', error);
      res.status(500).json({ error: 'Failed to resolve LLM configuration' });
    });
}
```

#### Step 2.3: Update Agent Handlers

```typescript
// agents/luca/backend/index.ts (BEFORE)
const llmService = new LLMService(
  config.provider,
  decrypt(config.apiKey),  // ❌ Decrypting every time
  config.azureEndpoint,
  config.azureDeploymentName
);

// agents/luca/backend/index.ts (AFTER)
router.post('/chat', withLLMConfig, async (req, res) => {
  const config = req.llmConfig!;  // ✅ Already decrypted and cached
  
  const llmService = new LLMService(
    config.provider,
    config.apiKey,  // ✅ Already decrypted
    config.endpoint,
    config.deploymentName
  );
  
  // ... rest of handler
});
```

**Testing Step 2:**
```typescript
// Test cache behavior
import { configResolver } from '@/server/config-resolver';

const config1 = await configResolver.resolve(1, 1, 1);
const config2 = await configResolver.resolve(1, 1, 1);  // Should hit cache

console.log(configResolver.getCacheStats());
// Should show: { size: 1, entries: ['user:1:org:1:config:1'] }

// Test invalidation
configResolver.invalidate(1);
console.log(configResolver.getCacheStats());
// Should show: { size: 0, entries: [] }
```

---

### Day 5: Create Shared Agent Registry

*Already covered in Step 1.3 above*

**Testing Day 1-5:**
```bash
# Run tests
npm run test

# Start server
npm run dev

# Verify initialization logs
grep "Agent Orchestrator" /tmp/logs/Start_application_*.log
grep "ConfigResolver" /tmp/logs/Start_application_*.log

# Test API endpoint
curl -X POST http://localhost:5000/api/agents/luca/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Test", "llmConfigId": 1}'
```

---

## Phase 2: WebSocket Refactor (Week 2)

### Day 6-7: WebSocket Bootstrap

**Goal:** Eager initialization, bulletproof upgrade handling

#### Step 3.1: Create WebSocket Bootstrap Service

```typescript
// server/websocket-bootstrap.ts

import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { orchestrator } from './agent-orchestrator';
import cookie from 'cookie';
import { verifyToken } from './auth';

class WebSocketBootstrap {
  private wss: WebSocketServer | null = null;
  private initialized: boolean = false;
  
  /**
   * Initialize WebSocket server (EAGER, not lazy)
   */
  initialize(httpServer: Server): void {
    if (this.initialized) {
      throw new Error('WebSocket server already initialized');
    }
    
    console.log('[WebSocket] Initializing WebSocket server (EAGER)...');
    
    // Create WebSocket server in noServer mode
    this.wss = new WebSocketServer({ noServer: true });
    
    // Setup connection handler
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });
    
    // Setup upgrade handler
    httpServer.on('upgrade', (request, socket, head) => {
      this.handleUpgrade(request, socket, head);
    });
    
    // Setup heartbeat
    this.setupHeartbeat();
    
    this.initialized = true;
    console.log('✅ WebSocket server initialized (ready for connections)');
  }
  
  /**
   * Handle upgrade request with normalized URL parsing
   */
  private handleUpgrade(
    request: IncomingMessage,
    socket: any,
    head: Buffer
  ): void {
    try {
      // Parse URL (handles query params correctly)
      const url = this.parseURL(request);
      
      // Check if this is our WebSocket path
      if (url.pathname !== '/ws/ai-stream') {
        console.log(`[WebSocket] Rejecting upgrade for path: ${url.pathname}`);
        socket.destroy();
        return;
      }
      
      console.log('[WebSocket] Upgrade request received');
      
      // Authenticate before upgrade
      const user = this.authenticate(request);
      if (!user) {
        console.log('[WebSocket] Authentication failed');
        socket.write('HTTP/1.1 401 Unauthorized\\r\\n\\r\\n');
        socket.destroy();
        return;
      }
      
      // Handle upgrade
      this.wss!.handleUpgrade(request, socket, head, (ws) => {
        this.wss!.emit('connection', ws, request);
      });
    } catch (error) {
      console.error('[WebSocket] Error handling upgrade:', error);
      socket.destroy();
    }
  }
  
  /**
   * Parse URL with proper error handling
   */
  private parseURL(request: IncomingMessage): URL {
    const urlString = request.url || '/';
    const host = request.headers.host || 'localhost';
    
    return new URL(urlString, `http://${host}`);
  }
  
  /**
   * Authenticate WebSocket request via cookie
   */
  private authenticate(request: IncomingMessage): any | null {
    try {
      const cookies = cookie.parse(request.headers.cookie || '');
      const token = cookies['auth-token'];
      
      if (!token) {
        return null;
      }
      
      return verifyToken(token);
    } catch (error) {
      console.error('[WebSocket] Authentication error:', error);
      return null;
    }
  }
  
  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const url = this.parseURL(request);
    const agentSlug = url.searchParams.get('agentSlug');
    const sessionId = url.searchParams.get('sessionId');
    
    if (!agentSlug || !sessionId) {
      ws.close(1008, 'Missing required parameters: agentSlug, sessionId');
      return;
    }
    
    const user = this.authenticate(request);
    if (!user) {
      ws.close(1008, 'Authentication required');
      return;
    }
    
    // Register connection with orchestrator
    try {
      orchestrator.handleConnection(
        ws,
        agentSlug,
        sessionId,
        user.userId,
        user.organizationId
      );
      
      console.log(`[WebSocket] Connection established: ${agentSlug}/${sessionId}`);
      
      // Setup message handler
      ws.on('message', (data) => {
        this.handleMessage(ws, agentSlug, sessionId, user, data);
      });
      
      // Setup close handler
      ws.on('close', () => {
        orchestrator.closeConnection(agentSlug, sessionId);
        console.log(`[WebSocket] Connection closed: ${agentSlug}/${sessionId}`);
      });
      
      // Setup error handler
      ws.on('error', (error) => {
        console.error(`[WebSocket] Error on ${agentSlug}/${sessionId}:`, error);
      });
    } catch (error: any) {
      console.error('[WebSocket] Failed to register connection:', error);
      ws.close(1011, error.message);
    }
  }
  
  /**
   * Handle incoming message
   */
  private async handleMessage(
    ws: WebSocket,
    agentSlug: string,
    sessionId: string,
    user: any,
    data: any
  ): Promise<void> {
    try {
      const message = JSON.parse(data.toString());
      
      // Import and call agent execution handler
      const { handleAIAgentExecution } = await import('./websocket');
      await handleAIAgentExecution(
        agentSlug,
        message.message,
        user,
        message.llmConfigId,
        ws
      );
    } catch (error) {
      console.error('[WebSocket] Error handling message:', error);
      ws.send(JSON.stringify({ error: 'Failed to process message' }));
    }
  }
  
  /**
   * Setup heartbeat to detect broken connections
   */
  private setupHeartbeat(): void {
    const interval = setInterval(() => {
      this.wss!.clients.forEach((ws: any) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);  // 30 seconds
    
    this.wss!.on('close', () => {
      clearInterval(interval);
    });
  }
  
  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    orchestratorStats: ReturnType<typeof orchestrator.getConnectionStats>;
  } {
    return {
      totalConnections: this.wss?.clients.size || 0,
      orchestratorStats: orchestrator.getConnectionStats(),
    };
  }
}

export const wsBootstrap = new WebSocketBootstrap();
```

#### Step 3.2: Update Server Initialization

```typescript
// server/index.ts

import { wsBootstrap } from './websocket-bootstrap';

// AFTER server.listen()
const httpServer = server.listen(PORT, HOST, () => {
  console.log(`✅ Server listening on ${HOST}:${PORT}`);
});

// Initialize WebSocket IMMEDIATELY (not lazy)
wsBootstrap.initialize(httpServer);
```

**Testing Step 3:**
```bash
# Start server
npm run dev

# Should see: "✅ WebSocket server initialized (ready for connections)"

# Test connection from browser console
const ws = new WebSocket('ws://localhost:5000/ws/ai-stream?agentSlug=luca&sessionId=test-123');
ws.onopen = () => console.log('Connected!');
ws.onmessage = (e) => console.log('Message:', e.data);
ws.send(JSON.stringify({ message: 'Hello', llmConfigId: 1 }));
```

---

### Day 8-10: Session Service

**Goal:** Unified session persistence for all agents

#### Step 4.1: Create Database Schema

```typescript
// shared/schema.ts

export const agentSessions = pgTable("agent_sessions", {
  id: serial("id").primaryKey(),
  agentSlug: varchar("agent_slug", { length: 50 }).notNull(),
  sessionId: varchar("session_id", { length: 255 }).notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: integer("organization_id").notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  title: varchar("title", { length: 500 }),
  metadata: jsonb("metadata"),  // For agent-specific data
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  sessionIdIdx: index("agent_sessions_session_id_idx").on(table.sessionId),
  userOrgIdx: index("agent_sessions_user_org_idx").on(table.userId, table.organizationId),
}));

export const agentMessages = pgTable("agent_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => agentSessions.id, { onDelete: 'cascade' }),
  role: varchar("role", { length: 20 }).notNull(), // 'user' | 'assistant' | 'system'
  content: text("content").notNull(),
  metadata: jsonb("metadata"),  // For attachments, timestamps, etc
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sessionIdIdx: index("agent_messages_session_id_idx").on(table.sessionId),
  createdAtIdx: index("agent_messages_created_at_idx").on(table.createdAt),
}));

// Relations
export const agentSessionsRelations = relations(agentSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [agentSessions.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [agentSessions.organizationId],
    references: [organizations.id],
  }),
  messages: many(agentMessages),
}));

export const agentMessagesRelations = relations(agentMessages, ({ one }) => ({
  session: one(agentSessions, {
    fields: [agentMessages.sessionId],
    references: [agentSessions.id],
  }),
}));
```

#### Step 4.2: Run Database Migration

```bash
# Push schema to database
npm run db:push

# Or if warnings, force push
npm run db:push --force
```

#### Step 4.3: Create Session Service

```typescript
// server/agent-session-service.ts

import { db } from './db';
import { agentSessions, agentMessages } from '@shared/schema';
import { and, eq, desc } from 'drizzle-orm';

export interface AgentSession {
  id: number;
  agentSlug: string;
  sessionId: string;
  userId: number;
  organizationId: number;
  title: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMessage {
  id: number;
  sessionId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: any;
  createdAt: Date;
}

class AgentSessionService {
  /**
   * Get or create a session
   */
  async getOrCreateSession(
    agentSlug: string,
    sessionId: string,
    userId: number,
    organizationId: number
  ): Promise<AgentSession> {
    // Try to find existing session
    let session = await db.query.agentSessions.findFirst({
      where: and(
        eq(agentSessions.sessionId, sessionId),
        eq(agentSessions.userId, userId)
      ),
    });
    
    // Create if doesn't exist
    if (!session) {
      const [newSession] = await db
        .insert(agentSessions)
        .values({
          agentSlug,
          sessionId,
          userId,
          organizationId,
          title: null,
          metadata: {},
        })
        .returning();
      
      session = newSession;
      console.log(`[SessionService] Created new session: ${sessionId}`);
    }
    
    return session as AgentSession;
  }
  
  /**
   * Save a message to a session
   */
  async saveMessage(
    sessionDbId: number,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: any
  ): Promise<void> {
    await db.insert(agentMessages).values({
      sessionId: sessionDbId,
      role,
      content,
      metadata: metadata || {},
    });
    
    // Update session timestamp
    await db
      .update(agentSessions)
      .set({ updatedAt: new Date() })
      .where(eq(agentSessions.id, sessionDbId));
  }
  
  /**
   * Get conversation history
   */
  async getHistory(
    sessionDbId: number,
    limit: number = 50
  ): Promise<AgentMessage[]> {
    const messages = await db.query.agentMessages.findMany({
      where: eq(agentMessages.sessionId, sessionDbId),
      orderBy: [desc(agentMessages.createdAt)],
      limit,
    });
    
    return messages.reverse() as AgentMessage[];  // Oldest first
  }
  
  /**
   * Update session title (auto-generate from first message)
   */
  async updateSessionTitle(
    sessionDbId: number,
    title: string
  ): Promise<void> {
    await db
      .update(agentSessions)
      .set({ title })
      .where(eq(agentSessions.id, sessionDbId));
  }
  
  /**
   * Get all sessions for a user
   */
  async getUserSessions(
    userId: number,
    organizationId: number,
    agentSlug?: string,
    limit: number = 50
  ): Promise<AgentSession[]> {
    const conditions = [
      eq(agentSessions.userId, userId),
      eq(agentSessions.organizationId, organizationId),
    ];
    
    if (agentSlug) {
      conditions.push(eq(agentSessions.agentSlug, agentSlug));
    }
    
    return await db.query.agentSessions.findMany({
      where: and(...conditions),
      orderBy: [desc(agentSessions.updatedAt)],
      limit,
    }) as AgentSession[];
  }
  
  /**
   * Delete a session and all its messages
   */
  async deleteSession(sessionDbId: number, userId: number): Promise<void> {
    // Verify ownership
    const session = await db.query.agentSessions.findFirst({
      where: and(
        eq(agentSessions.id, sessionDbId),
        eq(agentSessions.userId, userId)
      ),
    });
    
    if (!session) {
      throw new Error('Session not found or access denied');
    }
    
    // Delete (cascade will handle messages)
    await db
      .delete(agentSessions)
      .where(eq(agentSessions.id, sessionDbId));
    
    console.log(`[SessionService] Deleted session: ${sessionDbId}`);
  }
}

export const sessionService = new AgentSessionService();
```

**Testing Step 4:**
```typescript
import { sessionService } from '@/server/agent-session-service';

// Test create session
const session = await sessionService.getOrCreateSession(
  'luca',
  'test-session-123',
  1,
  1
);
console.log('Session:', session);

// Test save message
await sessionService.saveMessage(session.id, 'user', 'Hello!');
await sessionService.saveMessage(session.id, 'assistant', 'Hi there!');

// Test get history
const history = await sessionService.getHistory(session.id);
console.log('History:', history);
// Should show 2 messages

// Test get user sessions
const sessions = await sessionService.getUserSessions(1, 1);
console.log('Sessions:', sessions);
```

---

## Phase 3: Agent Migration (Week 3)

*[Continue with migration guide for all 9 agents]*

## Summary

This migration guide provides:
- ✅ Step-by-step implementation instructions
- ✅ Code examples for each component
- ✅ Testing procedures at each step
- ✅ Database migration commands
- ✅ Error handling strategies

**Next Steps:**
1. Review this guide with team
2. Schedule implementation sprints
3. Assign owners to each phase
4. Track progress weekly
5. Document deviations

---

**Document Version:** 1.0  
**Last Updated:** November 16, 2025  
**Status:** Ready for Implementation
