# Overview
Accute is an AI-native platform designed for accounting firms to automate workflows, enhance operational efficiency, and ensure robust compliance. It features multi-agent orchestration, an extensive template library, support for multiple AI providers, and a dedicated AI agent marketplace. The platform aims to revolutionize accounting practices with advanced AI capabilities, targeting significant global market share.

## Recent Updates

### Workflow Automation Engine - Dependency & Time-Based Triggers (November 23, 2025)
**Status: ✅ PRODUCTION READY**

**Karbon-Style Workflow Automation**
- ✅ Dependency-aware task orchestration with 4 dependency types (finish_to_start, start_to_start, finish_to_finish, start_to_finish)
- ✅ Event-driven auto-progression: Tasks auto-start when all blocking dependencies satisfied
- ✅ Time-based triggers: Cron scheduling + due-date offset triggers
- ✅ Visual trigger builder UI with scope configuration (workflow/stage/step-level)
- ✅ Transaction-safe dependency updates with organization scoping

**Security Hardening**
- ✅ Multi-tenant data isolation: All dependency storage queries org-scoped
- ✅ Transactional dependency satisfaction: Race condition prevention
- ✅ Organization-filtered scheduled trigger endpoints
- ✅ Permission-gated automation management (workflows.view/create/update/delete)

**Architecture Decisions**
- **Consolidated Schema**: `workflowTaskDependencies` table with `isBlocking`, `isSatisfied`, `lagDays`, `satisfiedAt` fields
- **Auto-Start Flow**: Task completion → Mark dependencies satisfied → Check all dependencies → Auto-start ready tasks
- **Dependency Types**: Snake_case normalized (finish_to_start, start_to_start, finish_to_finish, start_to_finish)
- **Time-Based Config**: Cron expressions + due-date offsets stored in `automationTriggers.cronExpression/dueDateOffsetDays`

**Files Modified**
- `server/storage.ts`: Org-scoped dependency queries (getWorkflowTaskDependents, getWorkflowTaskDependenciesByTask, updateWorkflowTaskDependency)
- `server/event-triggers.ts`: Auto-start logic with dependency satisfaction checks
- `server/routes.ts`: Time-based automation routes (preview-schedule, due-date-triggers, scheduled/due)
- `client/src/pages/automation.tsx`: Time-based trigger UI (cron/due-date configuration)
- `client/src/components/task-dependency-manager.tsx`: Visual dependency builder

### Trace AI Agent - Production-Ready Integration (November 23, 2025)
**Status: ✅ PRODUCTION READY**

**Auto-Provisioning Infrastructure**
- ✅ Reusable `provisionBundledAgents()` function for automatic agent installation
- ✅ Integrated into all subscription flows:
  - Admin subscription creation (POST /api/admin/subscriptions)
  - Stripe checkout webhook (checkout.session.completed)
  - Razorpay subscription creation (POST /api/razorpay/subscriptions/create)
- ✅ Idempotent installation (prevents duplicate installations)
- ✅ Graceful error handling (subscription creation never fails due to provisioning errors)
- 📝 **How it works**: When an organization subscribes to a plan, all AI agents listed in the plan's `featureIdentifiers` array are automatically installed for that organization

**Entitlement & Access Control**
- ✅ Subscription-based agent access (POST /api/marketplace/agents/:agentSlug/install)
- ✅ Plan bundling verification via `featureIdentifiers` array
- ✅ Premium vs free agent distinction (pricingTier field)
- ✅ Actionable upgrade prompts for unauthorized installations
- 📝 **Security**: Organizations can only install agents that are either (a) bundled in their subscription plan, or (b) marked as free/available to all plans

**Resume Analysis Security (Trace Agent)**
- ✅ PII sanitization (`sanitizeResumePII` function) redacts:
  - Email addresses → [EMAIL_REDACTED]
  - Phone numbers → [PHONE_REDACTED]
  - SSN patterns → [SSN_REDACTED]
  - Street addresses → [ADDRESS_REDACTED]
- ✅ Rate limiting: 10 requests per 15 minutes (POST /api/ai-agent/chat)
- ✅ File size validation: 500KB maximum (server-side enforcement)
- ✅ Agent installation verification before execution
- ✅ Activity logging with PII filtering metrics
- 📝 **Compliance**: Resume text is automatically sanitized before being sent to LLM providers, protecting candidate privacy while maintaining skills extraction quality

**Files Modified**
- `server/routes.ts`: Auto-provisioning, entitlement checks, PII filtering, rate limiting
- `agents/trace/backend/index.ts`: Resume analysis implementation (unchanged, uses existing code)
- `client/src/components/profile/skills-expertise-tab.tsx`: UI for resume upload (already implemented)

## Recent Security Implementation (November 22, 2025)

### Critical Production Bug Fix - Encryption Service (DEPLOYED)
**safeDecrypt Silent Failure Vulnerability**
- 🐛 **Bug Found**: safeDecrypt returned ciphertext as plaintext when decryption failed
- ✅ **Fixed**: Now throws loud error with actionable message
- 🔍 **Found By**: Intelligent test methodology (encryption key rotation scenario)
- 📝 **Documentation**: CRITICAL_BUG_FOUND_SAFEdecrypt.md
- **Impact**: Prevents silent credential corruption on ENCRYPTION_KEY changes
- **Status**: Production-ready, deployed

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