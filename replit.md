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