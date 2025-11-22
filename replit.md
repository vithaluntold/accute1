# Overview
Accute is an AI-native platform designed for accounting firms to automate workflows, enhance operational efficiency, and ensure robust compliance. It features multi-agent orchestration, an extensive template library, support for multiple AI providers, and a dedicated AI agent marketplace. The platform aims to revolutionize accounting practices with advanced AI capabilities, targeting significant global market share.

## Recent Security Implementation (November 22, 2025)
**Row Level Security (RLS) - PRODUCTION READY**
- ✅ 87 tables with RLS enabled (100% multi-tenant coverage)
- ✅ 347 comprehensive policies (SELECT/INSERT/UPDATE/DELETE per table)
- ✅ Global application middleware enforcing organization scope
- ✅ Defense-in-depth: Database RLS + Application middleware
- ✅ Helper functions: `get_user_organization_id()`, `is_super_admin()`
- ✅ Special cases handled: NULL org_id for system resources
- 📝 Documentation: database/RLS_IMPLEMENTATION.md, RLS_STATUS.md

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
The UI/UX is inspired by Linear and Notion, using the Carbon Design System with a Porsche-to-Pink gradient. It features Orbitron, Inter, and Fira Code fonts, a collapsible sidebar, top navigation, card-based dashboards, and data tables, designed as a responsive Progressive Web App (PWA).

## Technical Implementations
The frontend uses React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend is built with Node.js, Express, TypeScript, and PostgreSQL (Neon) with Drizzle ORM. Security includes JWT, bcrypt, AES-256 encryption, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude.

## Feature Specifications
Accute provides a multi-tenant architecture with four-tier RBAC and a Client Portal. Key features include an AI Client Onboarding System, conversational AI agents with auto-title generation, a unified workflows system, an AI Agent Marketplace, secure LLM Configuration Management, AI Psychology Assessment & Performance Monitoring, PKI Digital Signatures, Secure Document Management, a Template Marketplace, Projects Management, an AI Agent Foundry, and comprehensive collaboration tools.

## System Design Choices
The project is organized into `client/`, `server/`, and `shared/` directories, emphasizing security, multi-tenancy, and robust authentication/encryption. The Automation Engine supports various action types. AI agents are dynamically routed and lazy-loaded. A centralized `ConfigResolver` manages LLM configurations with caching, decryption, and fallback. A `FileParserService` handles diverse document types. The server initialization prioritizes health checks, system setup, agent route registration, and then Vite middleware. Auto-title generation occurs after the first message exchange using an LLM. Unified session routes support all 10 agents.

### Real-Time Communication Architecture
**SSE (Server-Sent Events)** - User-to-AI Streaming:
- AI Agent Chat (all 10 agents) uses SSE for streaming responses
- Luca Chat Widget uses SSE for onboarding/help
- Endpoints: `/api/ai-agent/stream` (POST to create, GET to receive)
- Tables: `agent_sessions`, `luca_chat_sessions`, `agent_session_messages`
- Backend is single source of truth (persists all messages)
- Security: Mandatory sessionId, strict ownership validation, 10s timeout
- Files: `server/sse-agent-routes.ts`, `client/src/hooks/use-agent-sse.ts`

**WebSocket** - User-to-User Real-Time:
- Team Chat (`/ws/team-chat`) - Internal team messaging - Tables: `team_chat_messages`
- Live Chat (`/ws/live-chat`) - Client support - Tables: `live_chat_conversations`, `live_chat_messages`
- Roundtable (`/ws/roundtable`) - Multi-agent collaboration - Tables: `roundtable_sessions`, `roundtable_messages`
- Security: Cookie/JWT auth, heartbeat monitoring, connection limits

**Key Insight**: No table overlap between SSE and WebSocket systems. Each uses distinct tables for distinct purposes.

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

# AI Psychology Assessment & Performance Monitoring
## Status: ✅ Complete - Production-Ready

**📋 Full Technical Documentation:** See `PATENT_DOCUMENTATION.md` (1,769 lines) for complete specifications, algorithms, patent claims, and commercial value analysis.

### Summary

Privacy-preserving multi-framework personality profiling system combining 5 psychological frameworks (Big Five, DISC, MBTI, Emotional Intelligence, Cultural Dimensions) using hybrid ML model fusion with consensus scoring.

**Key Innovation:** Tier 1 fast models (0 token cost) + Tier 2 selective LLM validation = 95%+ token cost reduction

### Implementation

**Services** (2,360 lines): PersonalityProfilingService, MLModelFusionEngine, ConversationAnalysisEngine, MLAnalysisQueueService  
**API Routes** (9 endpoints): Batch analysis, profiles, consent, queue stats, performance correlations  
**Database** (7 tables): personality_profiles, personality_traits, conversation_metrics, ml_analysis_runs/jobs, performance_metric_definitions/scores  
**Frontend**: `/personality-profile` (user dashboard), `/admin/personality-profiling` (admin analytics)

### Privacy-First Architecture

- ✅ GDPR-compliant with explicit opt-in consent  
- ✅ NO raw message storage - only aggregated metrics  
- ✅ Conversation content discarded immediately after analysis  
- ✅ Right to erasure anytime

**For complete details, see:** `PATENT_DOCUMENTATION.md`