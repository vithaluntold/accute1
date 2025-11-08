# Accute - AI-Native Accounting Workflow Automation Platform

### Overview
Accute is an AI-native accounting workflow automation platform for modern accounting firms. It uses specialized AI agents to automate tasks, boosting efficiency, ensuring compliance, and enhancing accounting practices. Key features include multi-agent orchestration with 10 specialized AI agents, a comprehensive template library, multi-provider AI support, and an AI agent marketplace. It offers global payment coverage, native mobile apps, multi-role authentication, custom workflow building, and secure document management, aiming to revolutionize accounting workflows through AI-driven automation.

### User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance
- **CRITICAL**: ENCRYPTION_KEY environment variable must be stable across deployments to prevent LLM credential decryption failures
- WebSocket Management: WebSockets now lazy-load on-demand when chat sessions start, not at server startup to prevent initialization errors
- Subscription System: Full subscription UI and routes now enabled for testing (previously disabled, re-enabled Nov 8, 2025)
- Luca Agent Personality: Luca now asks follow-up questions BEFORE answering to narrow down exact requirements
- Luca Agent Approach: Luca asks 2-3 targeted clarifying questions to understand context
- Cadence Workflow Builder: Now supports FULL hierarchy extraction (Stages → Steps → Tasks → Subtasks → Checklists) from uploaded documents and conversational building
- AI Agent Pricing: Support for multiple pricing models (free, subscription, per-instance, per-token, one-time). Free agents auto-install to all organizations.
- Recurring Scheduler: Service runs every 5 minutes to process recurring schedules and auto-create workflow assignments. Supports daily, weekly, monthly, quarterly, and annual frequencies.
- @Mention Collaboration: Users can @mention team members in chat messages and document annotations. Mentions use format @[userId] internally, display as @FullName. Automatic notifications created for mentioned users.
- Tag-Based Routing: Clients and organizations support tag arrays for segmentation. Tags enable conditional workflow automation (IF-THEN logic based on client tags).
- Conditional Automations: Workflow actions support conditional execution based on tags, fields, and other criteria. Implements TaxDome-style conditional logic.
- Auto-Advance Triggers: Event-driven workflow progression system automatically advances workflows based on events (payment_received, document_uploaded, organizer_submitted, invoice_paid).
- Enhanced Automation Actions: 13 total automation action types including create_invoice, request_documents, send_organizer, apply_tags, remove_tags, send_proposal, apply_folder_template.
- Workload Insights: Analytics endpoint providing per-user metrics (assignments, tasks, time tracking, completion rates, workload scores) with team totals and capacity planning.
- Organizations with isTestAccount=true bypass all subscription limits and feature gates for unlimited access.
- Subscription add-ons now fully integrated into feature gating. Features and resource limits from active add-ons merge with base plan entitlements.
- Dynamic permission filtering based on subscription features. Role permissions automatically restricted when organization lacks required subscription features.

### System Architecture

#### UI/UX Decisions
The UI is inspired by Linear and Notion, utilizing the Carbon Design System. It features a Porsche-to-Pink gradient, specific fonts (Orbitron, Inter, Fira Code), a collapsible sidebar, top navigation, card-based dashboards, and data tables. It is implemented as a responsive Progressive Web App (PWA).

#### Technical Implementations
The frontend uses React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The backend is Node.js, Express, and TypeScript. Data is stored in PostgreSQL (Neon) via Drizzle ORM. Authentication uses JWT and bcrypt, with AES-256 encryption, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude. The platform is optimized for Replit's Cloud Run/Autoscale.

#### Feature Specifications
- **Multi-tenant Architecture**: Provides isolated data and distinct roles.
- **Role-Based Access Control**: Four-tier system (Super Admin, Admin, Employee, Client).
- **Client Portal**: Dedicated interface for client interactions.
- **AI Client Onboarding System**: Privacy-first, conversational, AI-driven onboarding.
- **Conversational AI Agent Interfaces**: Dynamic, full-screen UIs for specialized agents.
- **Unified Workflows System**: Visual automation with hierarchical project management.
- **AI Agent Marketplace & Execution System**: For managing AI agents.
- **LLM Configuration Management**: Secure CRUD for AI provider credentials with AES-256-GCM encryption.
- **PKI Digital Signatures**: Tamper-proof document verification using RSA-2048.
- **Secure Document Management**: Encrypted storage, authenticated downloads, and access control.
- **Marketplace System**: Offers templates (Documents, Forms, Workflows) with pricing.
- **Hierarchical Folder Structure**: Unlimited nesting for content categorization.
- **Projects Management**: Comprehensive client engagement tracking.
- **AI Agent Foundry**: System for onboarding custom AI agents.
- **Template Scoping System**: Dual-scope architecture for global and organization-specific templates.
- **Subscription Management System**: Four-tier model with regional pricing and automated billing.
- **Invoice Generation System**: Auto-generates invoices for subscription events.
- **Payment Security**: AES-256-GCM encryption, HTTPS, rate limiting, and audit logging.
- **Multi-Factor Authentication (MFA)**: TOTP-based MFA using Google Authenticator/Authy with QR code setup, backup codes, trusted devices, and device fingerprinting.
- **Comprehensive Pricing & Subscription Management**: Enterprise-grade system with product families, SKU-based plans, add-ons, coupons, regional pricing, and volume tiers.
- **Multi-Gateway Payment Processing**: Organizations configure their own payment gateways (Razorpay, Stripe, PayU, Payoneer) with encrypted credentials.
- **Service Plans Marketplace (Fiverr-style)**: Admins create service offerings with various pricing models, deliverables tracking, and client review systems.
- **Multi-Tier Authorization System**: 7-layer protection for service plan purchases to prevent data leakage and unauthorized access.
- **Subscription-Based Feature Gating**: Production-ready feature visibility and quota enforcement system with shared entitlement contract. Backend middleware and frontend hooks manage access and quotas. Real-time usage tracking via `UsageTrackingService`. Fail-closed security design.

#### System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. Security is a core focus, with robust authentication, encryption, and multi-tenancy support. The Automation Engine supports various action types (e.g., create_task, run_ai_agent) with context propagation. AI agents are accessed via dynamic routing with lazy-loaded components. A centralized `LLMConfigService` manages all LLM configurations, providing a single source of truth with caching and cache invalidation.

### External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration (default for AI agents).
- **Anthropic Claude API**: AI model integration.
- **Resend**: Transactional email service.
- **MSG91**: SMS service for OTP verification.
- **Razorpay**: Payment gateway.
- **Gmail API**: Per-user OAuth integration for email account connectivity.
- **Multer**: For file uploads.
- **expr-eval**: For secure expression evaluation.
- **Recharts**: Frontend library for data visualizations.
- **pdf-parse**: PDF text extraction.
- **mammoth**: DOCX text extraction.
- **xlsx**: Excel file parsing (XLSX, XLS).

### Critical Environment Variables
- **ENCRYPTION_KEY**: AES-256-GCM encryption key for LLM credentials (MUST be 32+ chars, stable across deployments)
  - LLM API keys are stored encrypted in database per organization
  - If ENCRYPTION_KEY changes, existing credentials cannot be decrypted
  - Server validates this at startup and fails fast if missing/invalid

### Critical Production Deployment Requirements
- **AI Agent Backends Must Be Compiled**: Production cannot load TypeScript files directly
  - Development: `tsx` transpiles `.ts` files on-the-fly
  - Production: Needs compiled `.js` files in `dist/agents/*/backend/index.js`
  - **SOLUTION**: Run `./scripts/build-production.sh` before deploying
  - Without this, all AI agents will fail with "Cannot find module" errors in production

### File Attachment System for AI Agents
All 8 conversational AI agents now support file attachments with automatic text extraction:

#### FileParserService (`server/file-parser-service.ts`)
Centralized parsing service supporting multiple file formats:
- **PDF**: Text extraction with fallback detection for scanned/image-only PDFs
- **DOCX**: Extracts text from paragraphs, tables, headers, and footers
- **Excel (XLSX/XLS)**: Converts sheets to CSV-style formatted text
- **CSV**: Automatic delimiter detection and parsing
- **TXT**: Direct text reading
- **Scanned PDFs**: Placeholder for OCR implementation (TODO: requires multimodal AI)

Security & Validation:
- MIME type validation (application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, etc.)
- 10MB file size limit
- Error handling with descriptive messages
- Returns parsed text, filename, and metadata

#### FileAttachment UI Component (`client/src/components/shared/FileAttachment.tsx`)
Reusable React component for file uploads:
- Client-side validation (size, type)
- Real-time upload progress tracking with status messages
- Success/error toast notifications
- File removal capability
- Accessible with proper ARIA labels
- Test IDs:
  - `input-file-upload`: Hidden file input element
  - `button-attach-file`: Main upload button
  - `text-attached-filename`: Display of attached file name
  - `button-remove-file`: Button to remove selected file

Usage Example:
```tsx
import { FileAttachment } from "@/components/shared/FileAttachment";

<FileAttachment
  uploadEndpoint="/api/agents/luca/upload-document"
  onFileProcessed={(extractedText) => {
    // Handle extracted text - add to chat, analyze, etc.
  }}
/>
```

#### Agent Upload Endpoints
All 8 agents have consistent `/api/agents/{agent}/upload-document` endpoints:
- **Agents**: Echo, Relay, Lynk, Luca, Parity, Scribe, Radar, OmniSpectra
- **Method**: POST with multipart/form-data
- **Field Name**: `file`
- **Authentication**: Required (requireAuth middleware)
- **File Size Limit**: 10MB
- **Supported Types**: PDF, DOCX, XLSX, XLS, CSV, TXT
- **Response**: `{ success: true, extractedText: string, filename: string, metadata: object }`

Implementation Pattern:
```typescript
// Backend (agents/{agent}/backend/handler.ts)
import multer from "multer";
import { FileParserService } from "../../../server/file-parser-service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.post("/api/agents/{agent}/upload-document", requireAuth, (req, res) => {
  upload.single("file")(req, res, async (err) => {
    // Parse file and return extracted text
  });
});
```

#### Future Enhancements
- Extract multer configuration into shared middleware (prevent config drift)
- Implement OCR for scanned PDFs using Claude 3.5 Sonnet or GPT-4 Vision
- Add automated tests for upload endpoints and parsing logic
- Add file extension validation in addition to MIME type checks
- Implement global rate limiting for file upload endpoints

### Recent Fixes (November 2025)
- **WebSocket Agent Execution (Nov 7, 2025)**: Fixed dev mode agent chat by replacing dynamic imports with static agent factory. Created `server/agent-static-factory.ts` with static imports of all agent classes for reliable operation in both development (tsx) and production (compiled JS).
- **Lynk AI Agent & Document Upload Fix (Nov 8, 2025)**: Implemented Lynk messaging intelligence agent (mirrors Relay for emails) with chat interface, task extraction, and LLM integration. Fixed client portal document upload to use correct endpoint `/api/documents`.