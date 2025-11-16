# Overview
Accute is an AI-native platform designed for accounting firms to automate workflows, boost operational efficiency, and ensure robust compliance. It features multi-agent orchestration, an extensive template library, support for multiple AI providers, and a dedicated AI agent marketplace, aiming to transform accounting practices with advanced AI.

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
Accute offers a multi-tenant architecture with four-tier RBAC and a Client Portal. Key features include an AI Client Onboarding System, conversational AI agents with intelligent auto-title generation, a unified workflows system, an AI Agent Marketplace, and secure LLM Configuration Management with AES-256-GCM encryption. Additional capabilities span PKI Digital Signatures, Secure Document Management, a Template Marketplace, Projects Management, an AI Agent Foundry, Subscription Management, an Enhanced Report Builder, Workload View, Unified Inbox, Calendar & Event Management, Recurring Scheduler, Collaboration tools, Enhanced Automation Actions, Workload Insights, Universal AI Agent Auto-Title Generation (LLM-powered 3-6 word titles across all 10 agents with WebSocket streaming), Luca Chat (with file attachments, auto chat title, search, and archive), Idempotent Automatic Day 1 Task Creation, a 21-Day Onboarding Journey, Profile Picture Upload, a Two-Level LLM Configuration System, Client Payment Collection, Email Integration, SSO/SAML, Proposals & Quotes Management, Chat Threading Extension, a Resource Management Suite (with Skills Management and Skill Matching Engine), and a WebRTC Voice/Video Calling System.

## System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories, emphasizing security, multi-tenancy, and robust authentication/encryption. The Automation Engine supports various action types with context propagation. AI agents are dynamically routed and lazy-loaded at `/ai-agents/:slug`. A centralized `ConfigResolver` manages LLM configurations with caching, decryption, and fallback mechanisms, integrated via `withLLMConfig` middleware and a `getLLMConfig` helper. A `FileParserService` handles diverse document types. WebSocket management is eagerly initialized through `WebSocket Bootstrap` and `Agent Orchestrator` with normalized URL parsing. The server initialization sequence prioritizes health checks, system setup, agent route registration, and then Vite middleware to prevent routing conflicts. The core architecture is a 5-component system: Agent Orchestrator, Shared Agent Registry, ConfigResolver, AgentSessionService, and WebSocket Bootstrap, ensuring a scalable agent ecosystem. Auto-title generation is implemented in `handleAIAgentExecution` within `server/websocket.ts`, triggering after the first message exchange (2 messages total) when `session.title` is null. The title generation uses LLM with temperature 0.7, max 20 tokens to create concise 3-6 word titles, analyzing the first 500 characters of each message. Generated titles are broadcast via WebSocket `title_updated` event and persisted via `AgentSessionService.updateSessionTitle()`. Unified session routes at `/api/agents/:agentSlug/sessions` support all 10 agents, registered during server initialization in `server/index.ts` via `registerAgentSessionRoutes()`.

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