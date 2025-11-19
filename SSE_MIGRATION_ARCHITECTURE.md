# SSE Migration Architecture Documentation

## Executive Summary

This document outlines the complete architecture of real-time communication systems in Accute, clarifying which features use WebSocket vs SSE, and the data tables each system interacts with.

## System Architecture Overview

### 🔄 Server-Sent Events (SSE) - User-to-AI Communication

**Purpose**: Streaming communication between users and AI agents  
**Endpoints**: `/api/ai-agent/stream`, `/api/roundtable/:sessionId/*`  
**Status**: ✅ ACTIVE (Migration Complete)

#### Features Using SSE:
1. **AI Agent Chat** (10 agents: Cadence, Echo, Forma, Luca, Lynk, OmniSpectra, Parity, Radar, Relay, Scribe)
   - Generic agent conversations
   - Agent-specific dialogs

2. **Luca Chat Widget**
   - Onboarding assistant
   - General help desk

3. **AI Roundtable**
   - Multi-agent collaboration sessions
   - Deliverable presentations
   - Real-time participant updates

#### Data Tables Used:
| Table | Purpose | Schema |
|-------|---------|--------|
| `agent_sessions` | Stores agent conversation sessions | id, agent_slug, session_id, user_id, organization_id, title, metadata, created_at, updated_at |
| `luca_chat_sessions` | Stores Luca-specific sessions | id, user_id, organization_id, title, llm_config_id, is_active, is_pinned, is_archived, last_message_at, created_at |
| `agent_session_messages` | Stores all AI agent messages (shared) | id, session_id, role, content, created_at |
| `roundtable_sessions` | Roundtable sessions | id, organization_id, creator_id, title, description, status, activePresentationDeliverableId, activePresentationParticipantId, metadata, created_at, updated_at |
| `roundtable_participants` | Session participants | id, session_id, participant_type, user_id, agent_slug, status, joined_at, left_at |
| `roundtable_messages` | Session messages | id, session_id, channel_type, recipient_participant_id, sender_participant_id, sender_agent_slug, content, metadata, created_at |
| `roundtable_deliverables` | Work products | id, session_id, creator_participant_id, creator_agent_slug, deliverable_type, deliverable_id, title, status, presented_at, created_at |

#### SSE Architecture (AI Agent Chat):
```
Frontend (Client)
    ↓
useAgentSSE Hook (REQUIRED sessionId)
    ↓
POST /api/ai-agent/stream
    → Creates stream
    → Persists USER message
    → Returns streamId
    ↓
GET /api/ai-agent/stream/:streamId
    → SSE connection established
    → Streams AI response chunks
    → Persists ASSISTANT message on completion
    ↓
Frontend receives stream
    → Updates UI optimistically
    → Invalidates React Query cache
    → Backend is single source of truth
```

#### SSE Architecture (Roundtable Collaboration):
```
Frontend (Client)
    ↓
useRoundtableSSE Hook (REQUIRED sessionId)
    ↓
GET /api/roundtable/sessions/:sessionId/stream
    → SSE connection established
    → Hydrates active presentation state immediately
    → Streams multi-party updates
    ↓
Participant sends message:
    ↓
POST /api/roundtable/sessions/:sessionId/messages
    → Persists message to roundtable_messages
    → Broadcasts SSE event to all participants
    → Event: { type: 'message', channel: 'broadcast'|'private', ... }
    ↓
Agent invoked in message:
    ↓
Backend (sse-roundtable-routes.ts)
    → Detects @mention or /command
    → Executes agent via AgentRegistry
    → Persists agent response
    → Broadcasts SSE event to participants
    → Event: { type: 'agent_response', agentSlug, content, ... }
    ↓
Presenter starts presentation:
    ↓
POST /api/roundtable/sessions/:sessionId/presentations/start
    → Authorization: Only presenter/owner allowed
    → Updates roundtable_sessions.activePresentationDeliverableId
    → Updates roundtable_sessions.activePresentationParticipantId
    → Blocks concurrent presentations
    → Broadcasts SSE event to all participants
    → Event: { type: 'presentation_started', deliverableId, ... }
    ↓
Presenter ends presentation:
    ↓
POST /api/roundtable/sessions/:sessionId/presentations/stop
    → Authorization: Only presenter/owner allowed
    → Clears activePresentationDeliverableId
    → Clears activePresentationParticipantId
    → Broadcasts SSE event to all participants
    → Event: { type: 'presentation_ended' }
    ↓
Late joiner reconnects:
    ↓
GET /api/roundtable/sessions/:sessionId/stream
    → SSE sends hydration event immediately
    → Event: { type: 'presentation_state', deliverable: {...}, presenter: {...} }
    → Frontend shows active presentation instantly
```

**Roundtable SSE Event Taxonomy**:
| Event Type | Purpose | Payload |
|------------|---------|---------|
| `message` | New message from participant | channel, sender, content, metadata |
| `agent_response` | AI agent reply | agentSlug, content, recipientId |
| `participant_joined` | User/agent joined session | participantId, type, displayName |
| `participant_left` | User/agent left session | participantId |
| `presentation_started` | Deliverable presentation began | deliverableId, presenterId, deliverable{} |
| `presentation_ended` | Presentation stopped | N/A |
| `presentation_state` | Reconnect hydration (active presentation) | deliverable{}, presenter{} or null |

#### Security Features:
- ✅ Mandatory sessionId validation
- ✅ Strict session ownership (userId + organizationId)
- ✅ Stream ownership verification
- ✅ 10-second connection timeout
- ✅ Audit logging
- ✅ Agent execution waits for client connection

#### Key Files:
- **Backend**: `server/sse-agent-routes.ts`, `server/sse-agent-stream.ts`, `server/sse-roundtable-routes.ts`
- **Frontend**: `client/src/hooks/use-agent-sse.ts`, `client/src/hooks/use-roundtable-sse.ts`, `client/src/components/ai-agent-chat.tsx`, `client/src/components/luca-chat-widget.tsx`, `client/src/pages/roundtable-detail.tsx`
- **Utilities**: `client/src/lib/agent-utils.ts`

---

### 🌐 WebSocket - User-to-User Real-Time Communication

**Purpose**: Bidirectional real-time communication between users  
**Endpoints**: `/ws/team-chat`, `/ws/live-chat`  
**Status**: ✅ ACTIVE (Lazy-Loaded)  
**Loading Pattern**: `noServer: true` with lazy initialization on first upgrade request

#### Feature 1: Team Chat

**Endpoint**: `/ws/team-chat`  
**Purpose**: Internal team messaging and collaboration  
**Loading**: Lazy-loaded on first connection (no upfront initialization cost)

**Data Tables Used**:
| Table | Purpose | Schema |
|-------|---------|--------|
| `team_chat_messages` | Team chat messages | id, team_id, client_id, sender_id, message, metadata, thread_id, in_reply_to, created_at |

**Files**: `server/team-chat-websocket.ts`, `server/websocket-lazy-loader.ts`, `client/src/hooks/useTeamChatWebSocket.ts`, `client/src/pages/team-chat.tsx`

---

#### Feature 2: Live Chat (Client Support)

**Endpoint**: `/ws/live-chat`  
**Purpose**: Real-time support chat between firm employees and clients  
**Loading**: Lazy-loaded on first connection (no upfront initialization cost)

**Data Tables Used**:
| Table | Purpose | Schema |
|-------|---------|--------|
| `live_chat_conversations` | Chat conversations | id, organization_id, client_id, assigned_agent_id, status, priority, subject, metadata, created_at, updated_at |
| `live_chat_messages` | Chat messages | id, conversation_id, content, sender_type, sender_id, is_internal, metadata, thread_id, in_reply_to, created_at |
| `agent_availability` | Support agent status | id, user_id, status, status_message, updated_at |

**Files**: `server/live-chat-websocket.ts`, `server/websocket-lazy-loader.ts`, `client/src/pages/live-chat.tsx`

---

#### WebSocket Lazy Loading Architecture

```
Server Startup
    ↓
setupLazyWebSocketLoader(server)
    → Registers upgrade request handler
    → NO WebSocket servers created yet
    ↓
First /ws/team-chat request arrives
    ↓
Lazy loader:
    → Parses upgrade URL defensively
    → Creates teamChatWss server (noServer: true)
    → Handles upgrade
    → Caches server for subsequent requests
    ↓
First /ws/live-chat request arrives
    ↓
Lazy loader:
    → Parses upgrade URL defensively
    → Creates liveChatWss server (noServer: true)
    → Handles upgrade
    → Caches server for subsequent requests
    ↓
Subsequent requests use cached servers
```

**Benefits**:
- ✅ Faster server startup (no upfront WebSocket initialization)
- ✅ Defensive URL parsing prevents crashes from malformed upgrade requests
- ✅ Memory efficient (servers created only when needed)
- ✅ Graceful degradation (malformed requests logged, not crashed)

---

### ❌ Deprecated: Old WebSocket Systems (Replaced by SSE)

**Status**: 🔴 DEPRECATED (Removed)

#### 1. Old AI Agent WebSocket System
**Old Endpoint**: `/ws` (noServer mode)  
**Replacement**: SSE system (`/api/ai-agent/stream`)  
**Status**: ✅ REMOVED

**Files Removed**:
- ✅ `server/websocket.ts` - Old WebSocket agent execution
- ✅ `server/websocket-bootstrap.ts` - WebSocket initialization
- ✅ `server/agent-orchestrator.ts` - WebSocket agent orchestration
- ✅ `client/src/hooks/use-agent-websocket.ts` - Old client hook
- ✅ Related tests in `server/__tests__/agents/integration/websocket.test.ts`

---

#### 2. Old Roundtable WebSocket System
**Old Endpoint**: `/ws/roundtable`  
**Replacement**: SSE system (`/api/roundtable/sessions/:sessionId/*`)  
**Status**: ✅ REMOVED

**Files Removed**:
- ✅ `server/roundtable-websocket.ts` - WebSocket server for Roundtable
- ✅ `client/src/hooks/useRoundtableWebSocket.ts` - Old client hook

**Migration Mapping**:
| Old WebSocket Pattern | New SSE Pattern |
|-----------------------|-----------------|
| `/ws/roundtable` connection | `GET /api/roundtable/sessions/:sessionId/stream` |
| WebSocket `send({type:'message'})` | `POST /api/roundtable/sessions/:sessionId/messages` |
| WebSocket `send({type:'invoke_agent'})` | `POST /api/roundtable/sessions/:sessionId/messages` (with @mention) |
| WebSocket event `message` | SSE event `{ type: 'message' }` |
| WebSocket event `agent_response` | SSE event `{ type: 'agent_response' }` |
| WebSocket event `participant_joined` | SSE event `{ type: 'participant_joined' }` |
| WebSocket event `participant_left` | SSE event `{ type: 'participant_left' }` |
| N/A (no presentation support) | SSE events `presentation_started`, `presentation_ended`, `presentation_state` |

**New Presentation Features (SSE Only)**:
- Persistent presentation state in `roundtable_sessions` table:
  - `activePresentationDeliverableId` - Which deliverable is being presented
  - `activePresentationParticipantId` - Who is presenting
- Authorization: Only presenter or session owner can end presentations
- Concurrent presentation prevention: Only one presentation active at a time
- SSE reconnect hydration: Late joiners immediately see active presentation

**Table Mapping (Unchanged)**:
- `roundtable_sessions` - Session metadata + presentation state
- `roundtable_participants` - Session participants (users + agents)
- `roundtable_messages` - All messages (broadcast + private channels)
- `roundtable_deliverables` - Work products created in session

---

**⚠️ IMPORTANT**: Team Chat (`/ws/team-chat`) and Live Chat (`/ws/live-chat`) continue using WebSocket with lazy loading. Only AI-related real-time communication uses SSE.

---

## Table Interaction Matrix

### Complete Table Mapping

| System | Primary Tables | Message Tables | Session Tables |
|--------|----------------|----------------|----------------|
| **AI Agent Chat (SSE)** | `agent_sessions` | `agent_session_messages` | `agent_sessions` |
| **Luca Chat (SSE)** | `luca_chat_sessions` | `agent_session_messages` | `luca_chat_sessions` |
| **Roundtable (SSE)** | `roundtable_sessions` | `roundtable_messages` | `roundtable_sessions` |
| **Team Chat (WS)** | `teams` | `team_chat_messages` | N/A (persistent teams) |
| **Live Chat (WS)** | `live_chat_conversations` | `live_chat_messages` | `live_chat_conversations` |

### Table Overlap Analysis

✅ **NO OVERLAP** - Each system uses distinct tables  
✅ **NO CONFLICTS** - SSE and WebSocket systems are completely independent  
✅ **SAFE MIGRATION** - SSE migration does not affect WebSocket features

**Shared Table**: `agent_session_messages`
- Used by both AI Agent Chat and Luca Chat (both via SSE)
- Messages distinguished by `session_id` which maps to either `agent_sessions` or `luca_chat_sessions`
- No conflict - this is intentional design for unified message storage

---

## Migration Status

### ✅ Completed
1. ✅ Created SSE endpoints with strict authorization
2. ✅ Built `useAgentSSE` hook with required sessionId
3. ✅ Migrated `ai-agent-chat.tsx` to SSE with session management
4. ✅ Migrated `luca-chat-widget.tsx` to SSE with single-source persistence
5. ✅ Implemented session state management and cleanup
6. ✅ Added React Query cache invalidation
7. ✅ Removed duplicate message persistence
8. ✅ Architect security review passed (AI Agent SSE)
9. ✅ Migrated Roundtable from WebSocket to SSE
10. ✅ Built `useRoundtableSSE` hook with presentation state
11. ✅ Implemented presentation state persistence (activePresentationDeliverableId, activePresentationParticipantId)
12. ✅ Added presentation authorization (only presenter/owner can end)
13. ✅ Implemented SSE reconnect hydration for active presentations
14. ✅ Removed roundtable-websocket.ts
15. ✅ Implemented lazy loading for Team Chat and Live Chat WebSocket servers
16. ✅ Added defensive URL parsing to prevent crashes from malformed upgrade requests
17. ✅ Architect security review passed (Roundtable SSE)
18. ✅ Updated documentation (SSE_MIGRATION_ARCHITECTURE.md)

### 🎉 Migration Complete
**All AI-related real-time communication now uses SSE**:
- AI Agent Chat (10 agents)
- Luca Chat Widget
- Roundtable Collaboration

**User-to-user communication continues using WebSocket**:
- Team Chat (lazy-loaded)
- Live Chat (lazy-loaded)

---

## Single Source of Truth Architecture

### Backend Persistence (Server)
**Location**: `server/sse-agent-routes.ts`

1. **User Message Persistence** (Line ~66):
   ```typescript
   const userMessage = await storage.createAgentSessionMessage({
     sessionId: session.id,
     role: 'user',
     content: message
   });
   ```

2. **Assistant Message Persistence** (Line ~315):
   ```typescript
   await storage.createAgentSessionMessage({
     sessionId: streamMetadata.sessionId,
     role: 'assistant',
     content: fullResponse
   });
   ```

### Frontend Behavior (Client)
**No Message Persistence** - Frontend NEVER persists messages

1. **Optimistic UI Updates**:
   - Display user message immediately (UX only)
   - Stream assistant chunks as they arrive
   - Show final response when complete

2. **React Query Cache**:
   - Invalidate session queries after SSE completion
   - Fetch authoritative data from backend
   - Ensure UI reflects server state

---

## Testing Expectations

### SSE Testing
1. **Session Creation**: New sessions created correctly
2. **Message Streaming**: SSE chunks received and displayed
3. **Backend Persistence**: Single user + assistant message per exchange
4. **Query Invalidation**: React Query cache updates after completion
5. **Session State**: Proper lifecycle (create → continue → reset on close)

### WebSocket Testing (Preserve)
1. **Team Chat**: Messages sent/received in real-time
2. **Live Chat**: Support conversations work correctly
3. **Roundtable**: Multi-agent collaboration functions

---

## Security Model

### SSE Security
- Session ownership: `session.userId === user.id AND session.organizationId === user.organizationId`
- Stream ownership: Verified on GET and DELETE endpoints
- Connection timeout: 10 seconds maximum
- Audit logging: All stream events logged

### WebSocket Security
- Cookie-based session authentication
- JWT token fallback (mobile clients)
- Heartbeat: 30-second intervals
- Origin validation (Roundtable)
- Connection limits (per user)

---

## Key Insights

1. **SSE is for AI**: User-to-AI streaming communication
2. **WebSocket is for Humans**: User-to-user real-time communication
3. **No Table Overlap**: Each system uses distinct tables
4. **Safe Migration**: SSE does not affect existing WebSocket features
5. **Single Source of Truth**: Backend persists all messages, frontend displays only

---

## Developer Guidelines

### When to Use SSE
- ✅ User chatting with AI agents
- ✅ Streaming AI responses
- ✅ One-way server → client data flow

### When to Use WebSocket
- ✅ User chatting with other users
- ✅ Real-time bidirectional communication
- ✅ Presence indicators
- ✅ Typing indicators
- ✅ Live collaboration

### When Modifying Code
1. **AI Agent Changes**: Modify SSE code (`sse-agent-routes.ts`, `use-agent-sse.ts`)
2. **Roundtable Changes**: Modify SSE code (`sse-roundtable-routes.ts`, `use-roundtable-sse.ts`)
3. **Team Chat Changes**: Modify WebSocket code (`team-chat-websocket.ts`, `websocket-lazy-loader.ts`, `useTeamChatWebSocket.ts`)
4. **Live Chat Changes**: Modify WebSocket code (`live-chat-websocket.ts`, `websocket-lazy-loader.ts`)

---

## Conclusion

The SSE migration is **COMPLETE** and successfully separates user-to-AI communication (SSE) from user-to-user communication (WebSocket), providing:

- ✅ Better scalability for AI streaming
- ✅ Single source of truth for messages
- ✅ Strict security and authorization
- ✅ Clean architectural separation
- ✅ No disruption to existing real-time features
- ✅ Lazy loading for WebSocket servers (faster startup, defensive parsing)
- ✅ Presentation state persistence with SSE hydration
- ✅ Eliminated obsolete code (roundtable-websocket.ts removed)

**All 10 AI agents operational via SSE**. User-to-user chat features preserved via lazy-loaded WebSocket.
