# Accute - AI-Native Accounting Workflow Automation Platform

## Overview
Accute is the world's first AI-native accounting workflow automation platform designed for modern accounting firms. It differentiates itself from legacy competitors by leveraging specialized AI agents to automate tasks previously requiring manual operation, enhancing efficiency, ensuring compliance, and improving accounting practices.

**Key Capabilities:**
- **Roundtable AI Multi-Agent Orchestration**: Coordinates multiple AI agents for complex task automation.
- **Six Specialized AI Agents**: Cadence (workflow automation), Forma (form generation), Relay (email automation), Parity (data extraction), Echo (data validation), and Scribe (document drafting).
- **Extensive Template Library**: Over 10,000 professional accounting templates.
- **Multi-Provider AI**: Supports OpenAI, Anthropic, and Azure.
- **AI Agent Marketplace**: Allows installation and customization of specialized agents.
- **Global Payment Coverage**: Integrates Razorpay for key markets.
- **Native Mobile Apps**: Available on iOS and Android via React Native + Expo.

The platform offers multi-role authentication, forms, workflows, email integration, calendar scheduling, custom workflow building, and secure document management, aiming to be an "AI-native" solution that automates core accounting processes.

## User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance

## System Architecture

### UI/UX Decisions
The UI is inspired by Linear and Notion, utilizing the Carbon Design System. It features a Porsche-to-Pink gradient, specific font usage (Orbitron, Inter, Fira Code), a collapsible sidebar, top navigation, card-based dashboards, and data tables. The platform is a responsive Progressive Web App (PWA) for cross-browser and cross-device compatibility, offering a native-like experience with offline support.

### Technical Implementations
The frontend uses React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend is built with Node.js, Express, and TypeScript. Data persistence is handled by PostgreSQL (Neon) with Drizzle ORM. Authentication uses JWT and bcrypt, with AES-256 encryption, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude. The platform is optimized for Replit's Cloud Run/Autoscale deployment.

### Feature Specifications
- **Multi-tenant Architecture**: Isolated data and distinct roles for SaaS and tenant levels.
- **Role-Based Access Control**: Four-tier system (Super Admin, Admin, Employee, Client).
- **Client Portal**: Dedicated interface for client-facing interactions.
- **AI Client Onboarding System**: Privacy-first, conversational, AI-driven onboarding.
- **Conversational AI Agent Interfaces**: Full-screen, dynamic conversational UIs for specialized agents.
- **Unified Workflows System**: Visual automation with hierarchical project management and hybrid execution.
- **AI Agent Marketplace & Execution System**: For browsing, installing, and managing AI agents.
- **LLM Configuration Management**: CRUD for AI provider credentials with AES-256-GCM encryption.
- **PKI Digital Signatures**: Tamper-proof document verification using RSA-2048.
- **Secure Document Management**: Encrypted storage, authenticated downloads, and access control.
- **Marketplace System**: Provides templates (Documents, Forms, Workflows) with pricing models.
- **Hierarchical Folder Structure**: Unlimited nesting for content categorization.
- **Projects Management**: Comprehensive client engagement tracking.
- **AI Agent Foundry**: System for onboarding and deployment of custom AI agents.
- **Template Scoping System**: Dual-scope architecture for global and organization-specific templates.

### System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. Security is paramount, with robust authentication, encryption, and access control, supporting multi-tenancy. The Automation Engine supports various action types (create_task, send_notification, run_ai_agent, update_field, wait_delay) with context propagation and multi-tenant security. AI agents are accessed via dynamic routing with lazy-loaded components.

## External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration.
- **Anthropic Claude API**: AI model integration.
- **Resend**: Transactional email service.
- **Twilio**: SMS service.
- **Razorpay**: Payment gateway for subscription billing and one-time payments (India, UAE, Turkey, USA).
- **Multer**: For file uploads.
- **expr-eval**: For secure expression evaluation.
- **Recharts**: Frontend library for data visualizations.

## Payment Integration & Security

### Razorpay Integration
- **Payment Gateway**: Razorpay for India, UAE, Turkey, USA markets
- **Environment Variables Required**:
  - `RAZORPAY_KEY_ID`: Razorpay API Key ID
  - `RAZORPAY_KEY_SECRET`: Razorpay API Key Secret
  - `RAZORPAY_WEBHOOK_SECRET`: Webhook signature verification (optional)

### Saved Payment Methods & Auto-Sweep
- Admins can save payment methods (cards, UPI) for automatic recurring billing
- ₹1 verification charge via Razorpay tokenization to save payment instruments
- Supports credit cards, debit cards, and UPI IDs
- Stores card last 4 digits, brand, expiry date, and Razorpay tokens
- Set default payment method for automatic invoice payments (auto-sweep)
- Payment methods management in **Settings → Payments** page

### Zero-Compromise Payment Security
**Implemented November 2025 - Enterprise-grade security with zero efficiency compromise**

#### AES-256-GCM Encryption
- All Razorpay credentials encrypted at rest with authenticated encryption
- Razorpay customer IDs encrypted in `platformSubscriptions` and `paymentMethods` tables
- Razorpay token IDs encrypted in `paymentMethods` table
- Organization RSA private keys encrypted in `organizationKeys` table
- 16-byte authentication tag for tamper detection
- **Lazy Re-Encryption**: Automatic upgrade of legacy plaintext data on access
  - Plaintext credentials transparently re-encrypted when accessed
  - Zero manual intervention - gradual migration happens automatically
  - Logged for monitoring migration progress

#### Backward Compatibility
- `safeDecryptRazorpay()` helper handles both encrypted and legacy plaintext values
- Detects encrypted format (iv:data:tag) vs plaintext
- Prevents runtime crashes for existing records
- Enables gradual migration to encrypted storage

#### HTTPS Enforcement
- Production environment requires HTTPS for all payment operations
- Middleware rejects non-HTTPS requests in production
- Development environment bypasses for local testing
- Prevents credential exposure via insecure connections

#### Rate Limiting
- 10 requests per 15-minute window per IP address
- Applies to all payment method CRUD operations (`/api/payment-methods/*`)
- Development environment skips for testing convenience
- Returns HTTP 429 when rate limit exceeded

#### Comprehensive Security Headers
Multi-layered protection against web attacks (applied to `/api/*` routes only):
- **Content Security Policy (CSP)**: Blocks unsafe scripts/styles in production
  - Production: Only allows self and Razorpay (no unsafe-inline/unsafe-eval)
  - Development: Permits unsafe directives for Vite HMR
- **HSTS**: Force HTTPS for 1 year with preload directive in production
- **X-Content-Type-Options**: Prevents MIME sniffing attacks
- **X-Frame-Options**: Prevents clickjacking (DENY)
- **X-XSS-Protection**: Enables XSS protection in legacy browsers
- **Referrer-Policy**: Controls referrer information leakage
- **Permissions-Policy**: Disables geolocation, microphone, camera
- **Note**: Headers scoped to API routes to avoid interfering with Vite dev server

#### Payment Audit Logging
- All payment method operations logged (add, delete, set default)
- Logged via `logActivity()` with user, organization, and timestamp
- Audit trail stored in `activityLogs` table for compliance and forensics
- Security metrics logging tracks plaintext fallbacks and suspected tampering

#### Encryption Key Management
- Primary: `ENCRYPTION_KEY` environment variable
- Fallback: `JWT_SECRET` if `ENCRYPTION_KEY` not set
- Keys derived using scrypt with salt for key derivation
- Key rotation support through environment variable updates

#### Database Performance Optimization
Indexed queries for payment operations:
- `payment_methods_org_default_idx`: Composite index for O(1) default payment lookup
- `payment_methods_status_idx`: Fast filtering by status (active/expired/failed)
- `payment_methods_type_idx`: Fast filtering by type (card/UPI/bank)
- `platformSubscriptions`: Indexed by organization, status, and plan
- Optimized common queries like "Get default payment method for organization"

#### Bulk Re-Encryption Migration
Script for legacy data migration available at `server/migrate-encryption.ts`:
- Dry-run mode to preview changes before applying
- Migrates platformSubscriptions, paymentMethods, organizationKeys
- Progress tracking with detailed logging
- Error handling with graceful degradation
- Usage: `tsx server/migrate-encryption.ts` (dry run)
- Apply: `tsx server/migrate-encryption.ts --apply`
- **Note**: Requires `npm run db:push --force` to sync schema before running