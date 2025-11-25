# Overview
Accute is an AI-native platform for accounting firms, aiming to automate workflows, boost efficiency, and ensure compliance. It features multi-agent orchestration, an extensive template library, support for multiple AI providers, and a dedicated AI agent marketplace. The platform seeks to revolutionize accounting with advanced AI, targeting significant global market share.

# Deployment Requirements

## Production Build Environment
**CRITICAL:** The build command requires `NODE_ENV=production` to be set:

```bash
# Standard build (requires NODE_ENV=production in environment)
npm run build

# Manual build (sets NODE_ENV explicitly)
NODE_ENV=production npm run build
```

**Why:** The vite.config.ts conditionally loads dev-only plugins (`@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`) that fail in production builds if NODE_ENV isn't set. These plugins are automatically disabled when `NODE_ENV=production`.

**Deployment Platforms:**
- ✅ **Replit Deployments:** Automatically set NODE_ENV=production (no action needed)
- ⚠️ **Other Platforms:** Ensure CI/CD or deployment environment sets NODE_ENV=production

## Recent Bug Fixes (November 25, 2025)

### Critical LLM Configuration Fix - PERMANENT FIX ✅
**Root Cause 1:** Double decryption bug causing recurring "LLM configuration" failures
- **Problem:** ConfigResolver was decrypting API keys, then LLMService constructor tried to decrypt again, causing double-decryption failure
- **Fix:** ConfigResolver now returns encrypted keys (validation only); LLMService handles all decryption (single responsibility)
- **Architecture:** `ConfigResolver` → returns encrypted config → `LLMService` constructor → decrypts API key

**Root Cause 2:** Multiple encryption formats across codebase (FIXED)
- The codebase historically used 3 different encryption formats, causing "invalid encrypted API key" validation failures:
  | Source File | Algorithm | Format | Key Derivation |
  |-------------|-----------|--------|----------------|
  | auth.ts | AES-256-CBC | `iv:encrypted` (2 parts) | SHA-256 hash |
  | crypto-utils.ts | AES-256-GCM | `iv:encrypted:authTag` (3 parts) | scrypt |
  | llm-service.ts | AES-256-GCM | concatenated (no colons) | direct slice |
- **Fix:** `ConfigResolver.isValidEncryptedApiKey()` now accepts ALL 3 formats for backward compatibility
- **Fix:** `LLMService.decrypt()` handles all 3 formats with correct key derivation for each
- **Files Changed:** `server/config-resolver.ts`, `server/llm-service.ts`

**IMPORTANT:** For future encryption, use `auth.ts` encrypt() which is imported by `routes.ts` for LLM config creation. The multi-format decrypt ensures backward compatibility with any existing data.

### Encryption Key Guard System (NEW) ✅
**Purpose:** Warns when ENCRYPTION_KEY changes so encrypted data issues are visible (not silent failures).

**How it works:**
1. On first startup: Stores a fingerprint of the current ENCRYPTION_KEY in `system_settings` table
2. On subsequent startups: Validates current key matches stored fingerprint
3. If mismatch detected: **Logs a warning** (does NOT block server - production-safe)
4. Decryption failures handled gracefully at runtime with clear error messages

**Important distinction:**
- **JWT_SECRET rotation** = Safe, just logs users out (they re-authenticate)
- **ENCRYPTION_KEY rotation** = Affects stored encrypted data (API keys) - users may need to re-enter

**Files:** `server/encryption-key-guard.ts`, `server/init.ts`

### Scheduler Service Fix ✅
- **Problem:** "isNotNull is not defined" error every few seconds in scheduler service
- **Fix:** Added missing `isNotNull` import from drizzle-orm in `server/storage.ts`

### Build Error Fixes (November 23, 2025) - PRODUCTION READY ✅
1. **Logo Asset References** - Fixed 6 marketing pages (terms, privacy, contact, security, about, features) to use existing Accute logo instead of missing logo.png
2. **Organization Field Consistency** - Fixed "No Workspace Selected" error with fallback pattern across 5 frontend files + 1 backend route
3. **Trace Button Visibility** - Fixed agent installations endpoint to show "Add Skills with Trace" button in Employee Profile
4. **Automation Triggers Schema** - Added missing condition_edges column to automation_triggers table
5. **Floating Footer** - Removed FinACEverse footer from authenticated pages

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
The UI/UX is inspired by Linear and Notion, utilizing the Carbon Design System with a Porsche-to-Pink gradient. It incorporates Orbitron, Inter, and Fira Code fonts, a collapsible sidebar, top navigation, card-based dashboards, and data tables, designed as a responsive Progressive Web App (PWA).

## Technical Implementations
The frontend is built with React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend uses Node.js, Express, TypeScript, and PostgreSQL (Neon) with Drizzle ORM. Security measures include JWT, bcrypt, AES-256 encryption, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude.

## Feature Specifications
Accute offers a multi-tenant architecture with four-tier RBAC and a Client Portal. Key features include an AI Client Onboarding System, conversational AI agents with auto-title generation, a unified workflows system, an AI Agent Marketplace, secure LLM Configuration Management, AI Psychology Assessment & Performance Monitoring, PKI Digital Signatures, Secure Document Management, a Template Marketplace, Projects Management, an AI Agent Foundry, and comprehensive collaboration tools.

## System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories, emphasizing security, multi-tenancy, and robust authentication/encryption. The Automation Engine supports various action types, including dependency-aware task orchestration with four dependency types (finish_to_start, start_to_start, finish_to_finish, start_to_finish) and time-based triggers (cron and due-date offset). AI agents are dynamically routed and lazy-loaded. A centralized `ConfigResolver` manages LLM configurations with caching and fallback (ConfigResolver validates encrypted keys; LLMService handles all decryption). A `FileParserService` handles diverse document types. Server initialization prioritizes health checks, system setup, agent route registration, and then Vite middleware. Auto-title generation occurs after the first message exchange using an LLM. Unified session routes support all 10 agents. Real-time communication utilizes SSE for User-to-AI streaming (e.g., AI Agent Chat, Luca Chat Widget) and WebSockets for User-to-User real-time interactions (e.g., Team Chat, Live Chat, Roundtable). Row Level Security (RLS) is implemented across 87 tables with 347 policies, enforced by both database RLS and application middleware, ensuring multi-tenant data isolation. A critical fix addressed `safeDecrypt` silent failure, now throwing loud errors for failed decryptions. The system includes auto-provisioning for AI agents upon subscription creation and robust entitlement and access control based on subscription plans. Resume analysis for the Trace agent includes PII sanitization, rate limiting, and file size validation for compliance. The AI Psychology Assessment & Performance Monitoring system uses a privacy-preserving multi-framework personality profiling system with hybrid ML model fusion, ensuring GDPR compliance and discarding raw message content after analysis.

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