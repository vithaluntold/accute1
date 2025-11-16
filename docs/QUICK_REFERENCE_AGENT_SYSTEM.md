# Agent System Quick Reference Guide

**Last Updated:** November 16, 2025

---

## Critical URLs & Paths

### Frontend Routes
```
✅ CORRECT:  /ai-agents/luca
❌ WRONG:    /agents/luca

All agents accessible at: /ai-agents/{slug}
- /ai-agents/luca       - AI Accounting Expert
- /ai-agents/cadence    - Tax Compliance Specialist
- /ai-agents/parity     - Financial Audit Agent
- /ai-agents/forma      - Document Processing
- /ai-agents/echo       - Communication Agent
- /ai-agents/relay      - Workflow Automation
- /ai-agents/scribe     - Meeting Notes & Transcription
- /ai-agents/radar      - Risk & Compliance Monitoring
- /ai-agents/omnispectra - Multi-Channel Analytics
- /ai-agents/lynk       - Integration Specialist
```

### Backend API Endpoints
```
GET    /api/agents/{slug}           - Agent metadata
POST   /api/agents/{slug}/chat      - Send message (HTTP)
POST   /api/agents/{slug}/upload    - Upload file
GET    /api/agents/{slug}/sessions  - List sessions (Cadence only for now)
```

### WebSocket Connection
```
ws://hostname/ws/ai-stream?agentSlug={slug}&sessionId={uuid}

Example:
ws://localhost:5000/ws/ai-stream?agentSlug=luca&sessionId=abc-123-def
```

---

## LLM Configuration System

### How It Works
```
1. User/Admin creates LLM config in Settings UI
2. Config encrypted with AES-256-GCM
3. Stored in llm_configurations table
4. Scoped by organizationId (workspace-level) OR userId (user-level)
5. Auto-selection priority: workspace default > user default > first available
```

### Current Implementation
```typescript
// HTTP Endpoints (preferred)
router.post('/api/agents/:slug/chat', withLLMConfig, async (req, res) => {
  // req.llmConfig is automatically injected
  const config = req.llmConfig;
});

// WebSocket/File Uploads (fallback)
const config = await getLLMConfig(userId, organizationId, llmConfigId);
if (!config) {
  // Handle missing config
}

// Frontend
const [selectedLlmConfig, setSelectedLlmConfig] = useState<number | null>(null);

// Auto-selection
useEffect(() => {
  if (configs.length > 0 && !selectedLlmConfig) {
    const defaultConfig = configs.find(c => c.isDefault);
    setSelectedLlmConfig(defaultConfig?.id || configs[0].id);
  }
}, [configs, selectedLlmConfig]);
```

### Cache Behavior
- **TTL:** 5 minutes
- **Invalidation:** Manual via `invalidateLLMConfigCache()` after mutations
- **Scope:** Per (userId, organizationId, llmConfigId) combination
- **⚠️ Warning:** Cache can become stale if not invalidated properly

---

## Session Persistence

### Current State (Nov 2025)

**✅ Has Session Persistence:**
- Cadence (uses `cadence_sessions`, `cadence_messages`)

**❌ Missing Session Persistence:**
- Luca, Parity, Forma, Echo, Relay, Scribe, Radar, OmniSpectra, Lynk

### How Cadence Does It
```typescript
// 1. Get or create session
const session = await db.query.cadenceSessions.findFirst({
  where: and(
    eq(cadenceSessions.sessionId, sessionId),
    eq(cadenceSessions.userId, userId)
  )
});

if (!session) {
  const [newSession] = await db.insert(cadenceSessions)
    .values({ sessionId, userId, organizationId })
    .returning();
  session = newSession;
}

// 2. Save messages
await db.insert(cadenceMessages).values({
  sessionId: session.id,
  role: 'user',
  content: message
});

// 3. Load history
const history = await db.query.cadenceMessages.findMany({
  where: eq(cadenceMessages.sessionId, session.id),
  orderBy: [asc(cadenceMessages.createdAt)]
});
```

### Planned Unified Approach
```typescript
// Will be replaced with:
const session = await sessionService.getOrCreateSession(
  agentSlug,
  sessionId,
  userId,
  organizationId
);

await sessionService.saveMessage(session.id, 'user', message);
const history = await sessionService.getHistory(session.id);
```

---

## WebSocket Connection Flow

### Current Implementation (Nov 2025)

```typescript
// 1. Client initiates connection
const ws = new WebSocket(
  `ws://host/ws/ai-stream?agentSlug=${agentSlug}&sessionId=${sessionId}`
);

// 2. Server receives upgrade request
httpServer.on('upgrade', (request, socket, head) => {
  // ✅ FIXED: Parse pathname, not full URL
  const { pathname } = new URL(request.url!, `http://${request.headers.host}`);
  
  if (pathname === '/ws/ai-stream') {
    // ✅ Initialize WSS on first connection (lazy)
    let wss = wssInstance;
    if (!wss) {
      wss = initializeWebSocketServer(httpServer);
    }
    
    // ✅ Handle upgrade
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

// 3. Authentication
const cookies = cookie.parse(request.headers.cookie || '');
const token = cookies['auth-token'];
const user = verifyToken(token);

// 4. Message handling
ws.on('message', async (data) => {
  const { message, llmConfigId } = JSON.parse(data);
  
  // Get LLM config
  const config = await getLLMConfig(user.userId, user.organizationId, llmConfigId);
  
  // Stream response
  await handleAIAgentExecution(agentSlug, message, config, ws);
});
```

### Known Issues
- ❌ Lazy initialization can cause race conditions
- ❌ No connection pooling
- ❌ No automatic reconnection strategy
- ❌ Query param handling was broken (FIXED: Nov 16, 2025)

---

## Common Failure Modes & Solutions

### 1. "WebSocket is closed before the connection is established"

**Cause:** URL check was too strict (`request.url === '/ws/ai-stream'`)

**Fix:** Parse pathname instead
```typescript
// ❌ OLD (broken with query params)
if (request.url === '/ws/ai-stream') { }

// ✅ NEW (works with query params)
const { pathname } = new URL(request.url!, `http://${request.headers.host}`);
if (pathname === '/ws/ai-stream') { }
```

**Status:** FIXED (Nov 16, 2025)

---

### 2. "404 Page Not Found" when accessing agent

**Cause:** Wrong URL pattern

**Solution:**
```
❌ Don't use: /agents/luca
✅ Use:        /ai-agents/luca
```

**Status:** DOCUMENTED (needs redirect aliases in future)

---

### 3. "No LLM configuration selected"

**Cause:** Empty string initial state prevents auto-selection

**Fix:**
```typescript
// ❌ OLD (broken)
const [selectedLlmConfig, setSelectedLlmConfig] = useState<number | string>('');

// ✅ NEW (working)
const [selectedLlmConfig, setSelectedLlmConfig] = useState<number | null>(null);

useEffect(() => {
  if (configs.length > 0 && !selectedLlmConfig) {
    const defaultConfig = configs.find(c => c.isDefault);
    setSelectedLlmConfig(defaultConfig?.id || configs[0].id);
  }
}, [configs, selectedLlmConfig]);
```

**Status:** FIXED

---

### 4. Stale LLM configs after update

**Cause:** 5-minute cache not invalidated

**Solution:** Call `invalidateLLMConfigCache()` after mutations
```typescript
// After creating/updating/deleting LLM config
import { invalidateLLMConfigCache } from '@/server/llm-config-service';

await db.update(llmConfigurations).set({ ... });
invalidateLLMConfigCache();  // ✅ Invalidate cache
```

**Status:** PARTIALLY FIXED (manual invalidation required)

---

### 5. Conversation history lost on refresh

**Cause:** Agent doesn't implement session persistence

**Affected:** Luca, Parity, Forma, Echo, Relay, Scribe, Radar, OmniSpectra, Lynk (9 agents)

**Workaround:** Use Cadence for important conversations

**Permanent Fix:** Phase 2 of roadmap (Unified Session Service)

---

## Adding a New Agent

### Checklist

```
[ ] 1. Create agent backend at agents/{slug}/backend/index.ts
[ ] 2. Add agent metadata to agent registry
[ ] 3. Implement message handler with LLM integration
[ ] 4. Use withLLMConfig middleware for HTTP endpoints
[ ] 5. Use getLLMConfig for WebSocket/file uploads
[ ] 6. Create agent frontend page
[ ] 7. Add LLM config selector to UI
[ ] 8. Register route in App.tsx
[ ] 9. Test WebSocket connection
[ ] 10. Test LLM config auto-selection
[ ] 11. Update documentation
```

### Template
```typescript
// agents/{slug}/backend/index.ts
import { Router } from 'express';
import { withLLMConfig } from '@/server/middleware/with-llm-config';
import { LLMService } from '@/server/llm-service';

const router = Router();

router.post('/chat', withLLMConfig, async (req, res) => {
  const { message } = req.body;
  const config = req.llmConfig!;
  
  // Decrypt API key
  const apiKey = decrypt(config.apiKey);
  
  // Create LLM service
  const llmService = new LLMService(
    config.provider,
    apiKey,
    config.azureEndpoint,
    config.azureDeploymentName
  );
  
  // Generate response
  const response = await llmService.generateResponse(message, []);
  
  res.json({ response });
});

export default router;
```

---

## Testing Checklist

### Before Deploying

```
[ ] Run database migration: npm run db:push
[ ] Test WebSocket connections for each agent
[ ] Verify LLM config auto-selection
[ ] Test session persistence (Cadence only for now)
[ ] Check route aliases work
[ ] Verify cache invalidation on config updates
[ ] Test concurrent agent usage
[ ] Review server logs for errors
[ ] Monitor WebSocket connection count
```

### Test Credentials
```
Email:    admin@sterling.com
Password: Admin123!
User:     Sarah Sterling (Admin role)
Org:      Sterling Accounting Firm
```

---

## Architecture Diagrams

### Current LLM Config Flow
```
Frontend
  ├─> Select LLM Config (dropdown)
  ├─> Send message with llmConfigId
  └─> API Request
        ↓
withLLMConfig Middleware
  ├─> Extract llmConfigId from body
  ├─> Call LLMConfigService.getLLMConfigForRequest()
  ├─> Check 5-min cache
  ├─> Fetch from DB if not cached
  ├─> Decrypt API key (DO NOT return to client)
  └─> Attach to req.llmConfig
        ↓
Agent Handler
  ├─> Read req.llmConfig
  ├─> Instantiate LLMService
  └─> Generate response
```

### Current WebSocket Flow
```
Client
  ├─> Connect to /ws/ai-stream?agentSlug=X&sessionId=Y
  └─> WebSocket connection
        ↓
Server Upgrade Handler
  ├─> Parse pathname (ignore query params)
  ├─> Lazy initialize WebSocketServer (first connection)
  ├─> handleUpgrade()
  └─> Emit 'connection' event
        ↓
Connection Handler
  ├─> Parse cookies for auth
  ├─> Verify JWT token
  ├─> Extract agentSlug, sessionId from query
  └─> Setup message listener
        ↓
Message Handler
  ├─> Parse message + llmConfigId
  ├─> Call getLLMConfig()
  ├─> Decrypt API key
  ├─> Load agent instance
  ├─> Generate response
  └─> Stream chunks via WebSocket
```

---

## Key Files Reference

### Backend
```
server/index.ts                    - Server initialization, sequential routing setup
server/websocket.ts                - WebSocket upgrade handler, lazy initialization
server/llm-config-service.ts       - LLM config CRUD, caching, encryption
server/middleware/with-llm-config.ts - HTTP middleware for config injection
server/agent-loader.ts             - Dynamic agent registration
agents/{slug}/backend/index.ts     - Individual agent implementations
```

### Frontend
```
client/src/App.tsx                 - Route registration (/ai-agents/:slug)
client/src/pages/agent-detail.tsx  - Generic agent UI component
client/src/hooks/use-agent-websocket.ts - WebSocket connection hook
client/src/components/luca-chat-widget.tsx - Example agent widget
```

### Shared
```
shared/schema.ts                   - Database schema (Drizzle ORM)
shared/agent-registry.ts           - FUTURE: Shared agent metadata
```

---

## Environment Variables

### Required
```bash
# Database
DATABASE_URL=postgresql://...

# Authentication
JWT_SECRET=your-jwt-secret-min-32-chars
ENCRYPTION_KEY=your-encryption-key-base64-or-hex

# LLM Providers (at least one required)
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
# OR
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://...
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
```

### Optional
```bash
# Email
MAILGUN_API_KEY=...
MAILGUN_DOMAIN=...

# Payments
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
```

---

## Troubleshooting Commands

### Check WebSocket Server Status
```bash
# Server logs
grep "WebSocket" /tmp/logs/Start_application_*.log

# Check upgrade requests
grep "Upgrade request" /tmp/logs/Start_application_*.log
```

### Check LLM Config Cache
```typescript
// In server code
import { getLLMConfigForRequest } from '@/server/llm-config-service';

// This will show cache hits/misses in logs
const config = await getLLMConfigForRequest(userId, orgId, configId);
```

### Manually Invalidate Cache
```bash
# Restart server to clear all caches
npm run dev

# Or programmatically
invalidateLLMConfigCache();
```

### Check Agent Registration
```bash
# Should see "✅ Successfully registered: {slug}" for each agent
grep "Successfully registered" /tmp/logs/Start_application_*.log
```

---

## Support & Resources

- **Full Analysis:** `docs/AGENT_ECOSYSTEM_ANALYSIS.md`
- **Implementation Roadmap:** See Phase 1-5 in analysis doc
- **Agent Template:** `docs/agent-template.md`
- **Known Issues:** `replit.md` → "Known Architectural Issues" section

---

**Document Version:** 1.0  
**Last Updated:** November 16, 2025  
**Maintained By:** Development Team
