# Accute - AI-Native Accounting Platform

An enterprise-grade AI platform designed for accounting firms to automate workflows, boost operational efficiency, and ensure robust compliance.

## 🚀 Quick Start

1. **Install Dependencies**
   Use the Replit package manager to install dependencies

2. **Set Environment Variables**
   Required secrets are managed through Replit. See `INTEGRATIONS.md` for setup.

3. **Run Development Server**
   Click the "Run" button or use: `npm run dev`
   The app will be available at the provided URL

4. **Database Setup**
   Run: `npm run db:push`

## 📋 Key Features

- **10 AI Agents** with intelligent auto-title generation (Luca, Cadence, Parity, Forma, Echo, Relay, Scribe, Radar, OmniSpectra, Lynk)
- **Multi-tenant Architecture** with 4-tier RBAC (Super Admin, Admin, Employee, Client)
- **Unified Workflows System** for automation
- **AI Agent Marketplace** for custom agents
- **Secure LLM Configuration** with AES-256-GCM encryption
- **Client Portal** for client collaboration
- **Document Management** with PKI digital signatures
- **Template Marketplace** for reusable workflows
- **Resource Management Suite** with skill matching
- **WebRTC Voice/Video Calling**
- **Universal Auto-Title Generation** - LLM-powered 3-6 word conversation titles across all agents

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **AI**: OpenAI, Azure OpenAI, Anthropic Claude
- **Security**: JWT, bcrypt, AES-256, RBAC, rate limiting

### Project Structure
```
├── client/          # React frontend
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   └── lib/         # Utilities and helpers
├── server/          # Express backend
│   ├── routes.ts       # API routes
│   ├── storage.ts      # Database layer
│   ├── websocket.ts    # WebSocket handlers
│   └── agents/         # Agent implementations
├── shared/          # Shared types and schemas
│   ├── schema.ts       # Drizzle database schema
│   └── agent-registry.ts
├── agents/          # AI agent implementations
│   ├── luca/           # Tax & Compliance Agent
│   ├── cadence/        # Workflow Automation Agent
│   ├── parity/         # Data Reconciliation Agent
│   └── ...
├── mobile/          # React Native mobile app
└── docs/            # Additional documentation
```

## 📚 Documentation

### Essential Guides
- **[Design Guidelines](design_guidelines.md)** - UI/UX design system with Carbon Design inspiration
- **[Integrations](INTEGRATIONS.md)** - Third-party integrations setup (Stripe, Twilio, Email, etc.)
- **[Feature Roadmap](FEATURE_ROADMAP.md)** - Upcoming features and enhancements
- **[Product Features](PRODUCT_FEATURES.md)** - Complete feature list with descriptions
- **[RBAC Features](RBAC_FEATURES.md)** - Role-based access control system

### Architecture & Security
- **[Multi-Tenancy](MULTI_TENANCY_ARCHITECTURE.md)** - Tenant isolation architecture
- **[Database Safety](DATABASE_SAFETY_RULES.md)** - Critical safety rules for database operations
- **[Security Assessment](FILE_UPLOAD_SECURITY_CORRECTED.md)** - Security guidelines and best practices

### Operations
- **[Emergency Recovery](EMERGENCY_RECOVERY.md)** - Crisis management and recovery procedures

### Agent Development
- **[Agent Template](docs/agent-template.md)** - Template for creating new AI agents
- **[AI Personality Profiling](docs/ai-personality-profiling-architecture.md)** - Agent personality system
- **[Agents Overview](agents/README.md)** - Agent system architecture

## 🤖 AI Agents

Accute features 10 specialized AI agents:

1. **Luca** - Tax & Compliance Expert
2. **Cadence** - Workflow Automation Specialist
3. **Parity** - Data Reconciliation Agent
4. **Forma** - Form & Document Processor
5. **Echo** - Communication Agent
6. **Relay** - Integration Coordinator
7. **Scribe** - Documentation Specialist
8. **Radar** - Analytics & Insights
9. **OmniSpectra** - Multi-domain AI Assistant
10. **Lynk** - Relationship Manager

All agents feature:
- Intelligent auto-title generation (3-6 word titles)
- WebSocket streaming for real-time responses
- Session persistence with AgentSessionService
- Multi-provider LLM support (OpenAI, Azure, Anthropic)

## 🔐 Security

- **Enterprise-grade encryption** with AES-256-GCM
- **Multi-tenant data isolation** at database level
- **Role-based access control** (Super Admin, Admin, Employee, Client)
- **Rate limiting** to prevent abuse
- **SQL injection prevention** via Drizzle ORM
- **Comprehensive audit trail** for compliance

## 🧪 Testing

The platform includes comprehensive testing capabilities. See testing documentation for details.

## 📱 Mobile Apps

The platform includes React Native mobile apps for iOS and Android.

### Mobile Build
See `mobile/README.md` for detailed build instructions.

## 🔧 Development

### Database Migrations
```bash
# Push schema changes to database
npm run db:push

# Force push (if warnings)
npm run db:push --force
```

### Environment Variables
Key environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `ENCRYPTION_KEY` - Must be stable across deployments for LLM config decryption
- `SESSION_SECRET` - Session encryption key
- LLM API keys (OPENAI_API_KEY, AZURE_OPENAI_API_KEY, etc.)

See `INTEGRATIONS.md` for complete list.

## 📝 Key Files

- **`replit.md`** - Project memory and technical architecture (keep updated!)
- **`shared/schema.ts`** - Database schema (single source of truth)
- **`server/storage.ts`** - Database interface layer
- **`server/routes.ts`** - API route definitions
- **`server/websocket.ts`** - WebSocket handlers for real-time AI streaming

## 🤝 Contributing

This is a proprietary platform. For development guidelines and preferences, see `replit.md`.

### Code Conventions
- TypeScript everywhere
- Drizzle ORM for database operations
- Never modify `vite.config.ts` or `package.json` directly
- Use `packager_tool` for package installation
- Follow security best practices (see `DATABASE_SAFETY_RULES.md`)

## 📄 License

Proprietary - All rights reserved

## 🆘 Support

For emergency issues and recovery procedures, see `EMERGENCY_RECOVERY.md`.

---

**Last Updated**: November 16, 2025  
**Version**: 2.0  
**Platform**: Replit
