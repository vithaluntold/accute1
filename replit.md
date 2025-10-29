# Accute - AI-Powered Accounting Workflow Automation Platform

## Overview
Accute is an enterprise-grade AI-powered accounting workflow automation platform. It leverages AI to streamline financial operations, offering multi-role authentication, custom workflow building, an AI agent marketplace, and secure document management. The platform's vision is to provide a comprehensive, secure, and intelligent solution for modern accounting practices, enhancing efficiency and compliance with an "AI-first" approach.

## User Preferences
- Prefer database-backed storage over in-memory
- Enterprise-grade security is paramount
- Multi-provider AI support essential
- Clean, modern UI following design guidelines
- Comprehensive audit trail for compliance

## System Architecture

### UI/UX Decisions
The UI is inspired by applications like Linear and Notion, using the Carbon Design System. It features a Porsche-to-Pink gradient, Orbitron and Exo 2 fonts, a collapsible sidebar, top navigation, card-based dashboards, and data tables with sorting and pagination.

### Technical Implementations
The platform uses React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui for the frontend, and Node.js, Express, and TypeScript for the backend. PostgreSQL (Neon) with Drizzle ORM is used for data persistence. Authentication relies on JWT and bcrypt, with AES-256 encryption for sensitive data, RBAC, rate limiting, and SQL injection prevention. AI integration supports OpenAI, Azure OpenAI, and Anthropic Claude.

### Feature Specifications
- **Multi-tenant Architecture**: Isolated data for organizations with SaaS-level and tenant-level roles.
- **Role-Based Access Control**: Granular permissions.
- **AI Agent Chat Interface**: Interactive chat with real-time WebSocket streaming for AI agents (Parity, Cadence, Forma, Luca).
- **Unified Workflows System**: Visual automation with hierarchical project management (Stages → Steps → Tasks), supporting hybrid execution, triggers, conditions, and automated actions.
- **AI Agent Marketplace & Execution System**: Browse, install, and manage AI agents with secure LLM credential storage.
- **LLM Configuration Management**: CRUD system for AI provider credentials with AES-256-GCM encryption.
- **PKI Digital Signatures**: Tamper-proof document verification using RSA-2048, meeting eIDAS and ESIGN Act.
- **Secure Document Management**: Encrypted storage, authenticated downloads, and access control.
- **User & Client Management**: Tools for managing users, roles, and client profiles.
- **Audit Trails**: Comprehensive activity logging.
- **Form Builder & Renderer**: Dynamic form creation with 22 field types and conditional logic using `expr-eval`.
- **Polymorphic Tagging System**: Organize resources with tags.
- **Contacts Management**: Manage contacts associated with clients.
- **Clients Management**: CRUD operations for client profiles.
- **Marketplace System**: Template marketplace (Documents, Forms, Pipelines) with pricing models and installation tracking.
- **Workflow Assignment System**: Assign clients to workflows, track progress, and manage status lifecycles.
- **Hierarchical Folder Structure**: Self-referencing folder tree with unlimited nesting, content categorization, and sharing permissions.
- **Auto-Progression Engine**: Cascade automation for workflow progression (checklist → task → step → stage → assignment complete) with configurable actions and progress tracking.

### System Design Choices
The project is structured into `client/`, `server/`, and `shared/` directories. Security is a core principle, implemented through robust authentication, encryption, and access control, with distinct SaaS-level and tenant-level role separation for multi-tenancy. The Automation Engine supports various action types (create_task, send_notification, run_ai_agent, update_field, wait_delay) with context propagation and multi-tenant security.

## External Dependencies
- **PostgreSQL (via Neon)**: Primary database.
- **OpenAI API**: AI model integration.
- **Azure OpenAI API**: AI model integration.
- **Anthropic Claude API**: AI model integration.
- **Multer**: For file uploads.
- **expr-eval**: For secure expression evaluation in conditional logic.
### Agent Management System - Configurable Dynamic Loading
Implemented centralized agent registry and dynamic loading system to eliminate hardcoded agent imports and enable flexible agent management.

**1. Agent Registry (`server/agent-registry.ts`)**
- **Centralized Configuration**: Single source of truth for all AI agents with metadata (name, display name, category, capabilities, path)
- **Agent Metadata**: Each agent configured with:
  - `path`: Relative path from project root for dynamic importing
  - `className`: Name of the exported agent class
  - `capabilities`: Array of agent capabilities
  - `requiresToolExecution`: Flag for agents needing tool execution context (e.g., Luca)
  - `supportsStreaming`: Flag for agents supporting streaming responses
- **Helper Functions**: `getAgentConfig()`, `getAllAgents()`, `getAgentsByCategory()`, `isAgentRegistered()`

**2. Dynamic Agent Loader (`server/agent-loader.ts`)**
- **Dynamic Module Loading**: `loadAgentModule()` function uses dynamic imports to load agent modules based on registry paths
- **Module Caching**: Prevents redundant imports with in-memory module cache
- **Instance Creation**: `createAgentInstance()` dynamically instantiates agents with LLM configuration
- **Capability Queries**: Helper functions to check agent capabilities (`agentRequiresToolExecution()`, `agentSupportsStreaming()`)
- **Error Handling**: Robust error handling with descriptive messages for missing agents or failed imports

**3. Standardized Agent Directory Structure**
- **Unified Location**: All agents now in `agents/{agentname}/backend/index.ts` pattern
- **Consistency**: Luca moved from `server/agents/luca/` to `agents/luca/backend/` to match other agents
- **Agent Locations**:
  - Parity: `agents/parity/backend/index.ts`
  - Cadence: `agents/cadence/backend/index.ts`
  - Forma: `agents/forma/backend/index.ts`
  - Kanban: `agents/kanban/backend/index.ts`
  - Luca: `agents/luca/backend/index.ts`

**4. WebSocket Handler Refactoring (`server/websocket.ts`)**
- **Eliminated Hardcoded Imports**: Removed all static agent imports (`import { ParityAgent } from ...`)
- **Dynamic Agent Loading**: Uses `createAgentInstance()` to load agents at runtime based on agent name
- **Intelligent Routing**: Automatically determines execution mode based on agent capabilities:
  - Tool execution mode for agents with `requiresToolExecution: true` (Luca)
  - Streaming mode for conversational agents (Parity)
  - Structured response mode for analytical agents (Cadence, Forma, Kanban)
- **Agent-Specific Input Formatting**: Dynamically prepares input based on agent type (workflow data for Cadence, form data for Forma, etc.)

**Benefits:**
- **Scalability**: Adding new agents requires only updating the registry, no code changes needed
- **Maintainability**: Single configuration file instead of scattered imports and hardcoded paths
- **Flexibility**: Agents can be moved, renamed, or reorganized by updating registry paths
- **Consistency**: Enforces standardized agent structure and interface across the platform
- **Type Safety**: Full TypeScript support with type checking for agent interfaces
- **Performance**: Module caching reduces import overhead for frequently used agents

**Files Modified:**
- `server/agent-registry.ts` - NEW: Central agent configuration registry
- `server/agent-loader.ts` - NEW: Dynamic agent loading utilities
- `agents/luca/backend/index.ts` - Moved from `server/agents/luca/index.ts`, updated imports
- `server/websocket.ts` - Replaced hardcoded switch statement with dynamic loader
