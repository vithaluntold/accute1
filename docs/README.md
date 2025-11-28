# Accute Platform Documentation Index

Welcome to the comprehensive documentation for the Accute AI-native accounting platform. This documentation provides detailed technical and architectural information for developers, system administrators, and stakeholders.

## Quick Navigation

### 📋 Getting Started
- **[Project Overview](00-project-overview.md)** - Complete project introduction and high-level architecture
- **[Project Configuration](01-project-configuration.md)** - Package.json, TypeScript, and build configurations

### 🏗️ Architecture Documentation
- **[Frontend Architecture](03-frontend-architecture.md)** - React application structure and patterns
- **[Backend Server Architecture](04-backend-server-architecture.md)** - Node.js server and API design
- **[Database Schema](05-database-schema-architecture.md)** - PostgreSQL schema and multi-tenancy design

### 🤖 AI & Automation
- **[AI Agents System](02-ai-agents-system.md)** - 10+ specialized AI agents and their implementations

### 🛠️ Development & Operations
- **[Scripts & Utilities](06-scripts-utilities.md)** - Build scripts, testing tools, and automation

## Documentation Structure

```
docs/
├── 00-project-overview.md              # 📋 Complete project overview
├── 01-project-configuration.md         # ⚙️ Configuration and setup
├── 02-ai-agents-system.md             # 🤖 AI agents architecture
├── 03-frontend-architecture.md         # 🎨 Frontend React application
├── 04-backend-server-architecture.md   # 🔧 Backend Node.js server
├── 05-database-schema-architecture.md  # 🗄️ PostgreSQL database design
├── 06-scripts-utilities.md            # 🛠️ Development tools and scripts
├── architecture/                       # 📐 Detailed architecture docs
├── features/                          # ✨ Feature specifications
├── security/                          # 🔒 Security implementation
├── testing/                           # 🧪 Testing strategies
└── README.md                          # 📖 This documentation index
```

## Key Platform Features

### 🤖 AI-Powered Automation
- **10 Specialized AI Agents** for different accounting functions
- **Multi-Provider LLM Support** (OpenAI, Anthropic, Azure)
- **Real-Time Streaming** responses via WebSocket
- **Auto-Title Generation** for intelligent conversation management

### 🏢 Multi-Tenant Architecture
- **Organization-Level Isolation** for secure multi-tenancy
- **Role-Based Access Control** (Super Admin, Admin, Employee, Client)
- **Subscription Management** with flexible pricing tiers
- **Custom Branding** and white-label capabilities

### 🔒 Enterprise Security
- **AES-256-GCM Encryption** for sensitive data
- **Multi-Factor Authentication** with TOTP and backup codes
- **JWT-Based Authentication** with secure session management
- **Comprehensive Audit Trails** for compliance

### 📱 Modern Technology Stack
- **React 18 + TypeScript** for type-safe frontend development
- **Node.js + Express** for robust backend services
- **PostgreSQL + Drizzle ORM** for reliable data management
- **Vite Build System** for lightning-fast development

## Documentation Categories

### 🎯 For Developers
- [Frontend Architecture](03-frontend-architecture.md) - React patterns and component structure
- [Backend Architecture](04-backend-server-architecture.md) - API design and server architecture
- [AI Agents System](02-ai-agents-system.md) - Agent development and integration

### 🏗️ For System Architects
- [Project Overview](00-project-overview.md) - High-level system design
- [Database Schema](05-database-schema-architecture.md) - Data modeling and relationships
- [Security Documentation](security/) - Security implementation details

### 🔧 For DevOps Engineers
- [Scripts & Utilities](06-scripts-utilities.md) - Build and deployment tools
- [Project Configuration](01-project-configuration.md) - Environment and build setup
- [Testing Strategies](testing/) - Quality assurance processes

### 📊 For Product Managers
- [Feature Documentation](features/) - Feature specifications and requirements
- [Architecture Decisions](architecture/) - Technical decision records
- [Competitive Analysis](competitive-analysis/) - Market positioning

## Legacy Documentation

### 📁 Previous Documentation Structure

### 🏗️ [Architecture](./architecture/)
System design, features, integrations, and technical specifications.

### 🔒 [Security](./security/)
Security controls, file upload safety, emergency recovery procedures, database safety rules.

### 🧪 [Testing](./testing/)
Test strategies, execution guides, Six Sigma testing, RBAC tests, AI agent tests.

### 📊 [Competitive Analysis](./competitive-analysis/)
Market positioning, workflow automation gaps, penetration pricing strategy.

### 💡 [Patents](./patents/)
AI Psychology Assessment & Performance Monitoring patent documentation.

### 🛠️ [Infrastructure](./infrastructure/)
Refactoring summaries, documentation cleanup, deployment guides.

---

## 📚 Quick Links

- **Start Here**: [README.md](../README.md)
- **Product Features**: [architecture/PRODUCT_FEATURES.md](./architecture/PRODUCT_FEATURES.md)
- **Security Overview**: [security/SECURITY_CONTROL_MATRIX.md](./security/SECURITY_CONTROL_MATRIX.md)
- **Testing Guide**: [testing/SIX_SIGMA_TESTING_STRATEGY.md](./testing/SIX_SIGMA_TESTING_STRATEGY.md)
- **Automation Gaps**: [competitive-analysis/WORKFLOW_AUTOMATION_GAP_ANALYSIS.md](./competitive-analysis/WORKFLOW_AUTOMATION_GAP_ANALYSIS.md)

## Quick Reference

### 📦 Technology Stack
```
Frontend:  React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
Backend:   Node.js, Express, TypeScript, Drizzle ORM
Database:  PostgreSQL (Neon hosting)
AI/ML:     OpenAI, Anthropic Claude, Azure OpenAI
Security:  JWT, bcrypt, AES-256-GCM, MFA
Real-time: WebSocket, Server-Sent Events
Testing:   Jest, Vitest, Playwright
Build:     esbuild, Vite, Docker
```

### 🗃️ Database Tables (Key)
```
users              # User accounts and profiles
organizations      # Multi-tenant organizations
user_organizations # Multi-workspace memberships
ai_agents          # Agent registry and configurations
agent_sessions     # AI conversation sessions
workflows          # Business process automation
documents          # File and document management
clients            # Customer relationship management
platform_subscriptions # Billing and subscription management
```

### 🤖 AI Agents
```
Luca        # Tax & compliance expert
Cadence     # Workflow automation specialist  
Parity      # Legal document drafting
Forma       # Form creation and processing
Echo        # Communication automation
Relay       # Email integration and management
Scribe      # Documentation specialist
Radar       # Analytics and monitoring
OmniSpectra # Multi-domain assistance
Lynk        # Client relationship management
```

---

**Last Updated**: November 28, 2025  
**Documentation Version**: 1.0  
**Platform Version**: 2.0  

*This documentation is automatically generated and updated. For the latest information, please refer to the source code and inline comments.*
