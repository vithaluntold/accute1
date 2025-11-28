# AI Agents System Documentation

## Overview
Accute features a sophisticated AI agent architecture with 10+ specialized agents for different accounting and business functions. Each agent operates independently with its own frontend interface, backend handler, and configuration.

## Agent Architecture

### Core Components
1. **Agent Registry** - Central management system for agent discovery and loading
2. **Agent Sessions** - Persistent conversation state management
3. **WebSocket Integration** - Real-time streaming communication
4. **LLM Configuration** - Multi-provider AI model support
5. **Security Layer** - RBAC and tenant isolation

### Agent Structure
Each agent follows a standardized structure:

```
agents/{slug}/
├── manifest.json          # Agent metadata and configuration
├── frontend/
│   └── {Agent}Agent.tsx  # React component interface
├── backend/
│   └── handler.ts        # Express route handlers
└── icon.png              # Optional agent icon
```

## Manifest Configuration

### Required Fields
- **slug**: Unique identifier (kebab-case)
- **name**: Display name for users
- **description**: Detailed capability description
- **category**: Classification (assistant, workflow, accounting, etc.)
- **provider**: AI provider (openai, anthropic, azure-openai, multi)
- **frontendEntry**: Path to React component
- **backendEntry**: Path to Express handler
- **capabilities**: Array of agent capabilities

### Optional Fields
- **subscriptionMinPlan**: Minimum subscription tier (free, starter, professional, enterprise)
- **defaultScope**: Default access level (admin, employee, client)
- **pricingModel**: Pricing structure (free, usage-based, subscription)
- **preInstalled**: Auto-install for new organizations
- **version**: Semantic version number
- **tags**: Search and categorization tags
- **configuration**: Default LLM settings (temperature, maxTokens, model)

## Available Agents

### 1. Luca - Tax & Compliance Expert
- **Slug**: `luca`
- **Provider**: Multi (supports all LLM providers)
- **Capabilities**: Accounting, taxation, finance, support tickets
- **Description**: Expert AI assistant for complex accounting and tax guidance
- **Features**:
  - Document upload and parsing
  - Support ticket creation
  - Multi-format file support (PDF, DOCX, Excel, CSV)
  - OCR for scanned documents

### 2. Cadence - Workflow Automation Specialist
- **Slug**: `cadence`
- **Provider**: Anthropic Claude
- **Capabilities**: Workflow builder, scheduling, automation
- **Description**: Operations expert for creating and managing workflows
- **Features**:
  - Visual workflow builder
  - Process automation
  - Scheduling coordination
  - Operational efficiency optimization

### 3. Parity - Legal Document Specialist
- **Slug**: `parity`
- **Provider**: Anthropic Claude
- **Capabilities**: Document generation, compliance, legal drafting
- **Description**: Elite legal document drafting specialist
- **Features**:
  - Engagement letters
  - Contract generation
  - Compliance forms
  - Professional legal documents

### 4. Echo - Communication Agent
- **Slug**: `echo`
- **Provider**: Multi-provider support
- **Capabilities**: Communication, client interaction, messaging
- **Description**: Handles client communications and messaging workflows

### 5. Forma - Form & Document Processor
- **Slug**: `forma`
- **Provider**: OpenAI/Multi
- **Capabilities**: Form processing, document analysis, data extraction
- **Description**: Specialized in form processing and document automation

### 6. Relay - Integration Coordinator
- **Slug**: `relay`
- **Provider**: Multi-provider
- **Capabilities**: System integration, data synchronization, API coordination
- **Description**: Manages integrations between different systems and platforms

### 7. Scribe - Documentation Specialist
- **Slug**: `scribe`
- **Provider**: Multi-provider
- **Capabilities**: Documentation, writing, content creation
- **Description**: Expert at creating and managing business documentation

### 8. Radar - Analytics & Insights
- **Slug**: `radar`
- **Provider**: Multi-provider
- **Capabilities**: Analytics, reporting, data insights, monitoring
- **Description**: Provides business intelligence and analytical insights

### 9. OmniSpectra - Multi-Domain Assistant
- **Slug**: `omnispectra`
- **Provider**: Multi-provider
- **Capabilities**: General assistance, multi-domain expertise, versatile support
- **Description**: Versatile AI assistant for broad business needs

### 10. Lynk - Relationship Manager
- **Slug**: `lynk`
- **Provider**: Multi-provider
- **Capabilities**: CRM, relationship management, client coordination
- **Description**: Manages client relationships and business connections

### 11. Kanban - Project Management
- **Slug**: `kanban`
- **Provider**: Multi-provider
- **Capabilities**: Project management, task organization, workflow tracking
- **Description**: Agile project management and task coordination

### 12. Trace - Audit & Tracking
- **Slug**: `trace`
- **Provider**: Multi-provider
- **Capabilities**: Audit trails, compliance tracking, monitoring
- **Description**: Specialized in audit trails and compliance monitoring

### 13. Onboard - User Onboarding
- **Slug**: `onboard`
- **Provider**: Multi-provider
- **Capabilities**: User onboarding, training, guidance
- **Description**: Helps with user onboarding and system training

## Technical Implementation

### Frontend Architecture
```typescript
// Each agent exports a React component
export default function AgentComponent() {
  return (
    <div>
      {/* Agent-specific UI */}
      <ChatInterface />
      <ToolbarActions />
      <StatusIndicators />
    </div>
  );
}
```

### Backend Handler Pattern
```typescript
import type { Express, Request, Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";

export const registerRoutes = (app: Express) => {
  // Health check
  app.get("/api/agents/{slug}/status", requireAuth, async (req, res) => {
    // Agent status endpoint
  });
  
  // Direct query endpoint
  app.post("/api/agents/{slug}/query", requireAuth, async (req, res) => {
    // Process agent queries
  });
  
  // File upload (if supported)
  app.post("/api/agents/{slug}/upload", requireAuth, async (req, res) => {
    // Handle file uploads
  });
};
```

### WebSocket Integration
Agents support real-time streaming through WebSocket connections:
- Session management with `AgentSessionService`
- Auto-title generation for conversations
- Message streaming for real-time responses
- Persistent conversation history

### LLM Configuration
Agents can use different LLM providers:
- **OpenAI**: GPT-3.5, GPT-4 models
- **Anthropic**: Claude models
- **Azure OpenAI**: Enterprise-grade OpenAI access
- **Multi**: Automatic provider selection based on organization settings

Configuration includes:
- Model selection
- Temperature settings
- Token limits
- Custom prompts
- Provider-specific parameters

## Security Features

### Access Control
- **Role-Based Access**: Super Admin, Admin, Employee, Client
- **Subscription Gating**: Agents can require specific subscription tiers
- **Organization Isolation**: Multi-tenant data separation
- **API Rate Limiting**: Prevent abuse and ensure fair usage

### Data Protection
- **Encryption**: AES-256-GCM for sensitive configurations
- **Audit Trails**: Comprehensive logging of agent interactions
- **Input Validation**: Zod schemas for type-safe data handling
- **SQL Injection Prevention**: Drizzle ORM with parameterized queries

### File Upload Security
- **MIME Type Validation**: Restricted file types
- **Size Limits**: 10MB maximum file size
- **Virus Scanning**: Integration with security scanning services
- **Temporary Storage**: Secure cleanup of uploaded files

## Agent Development Guidelines

### Creating New Agents
1. **Create Directory Structure**: Follow standard agent layout
2. **Define Manifest**: Complete manifest.json with all required fields
3. **Implement Frontend**: React component with standard interface patterns
4. **Create Backend Handler**: Express routes following security patterns
5. **Test Integration**: Verify all functionality works correctly
6. **Document Capabilities**: Clear documentation of agent features

### Best Practices
- **Error Handling**: Comprehensive error catching and user-friendly messages
- **Loading States**: Proper loading indicators for async operations
- **Type Safety**: Full TypeScript coverage for all code
- **Performance**: Efficient API calls and optimized rendering
- **Accessibility**: WCAG-compliant interface design
- **Testing**: Unit and integration tests for all functionality

## Monitoring and Analytics

### Performance Metrics
- Agent response times
- Error rates and types
- Usage patterns per organization
- Resource utilization

### Business Intelligence
- Most popular agents
- Feature adoption rates
- User engagement metrics
- Revenue attribution by agent

### Health Monitoring
- Agent availability status
- LLM provider health
- WebSocket connection stability
- File processing success rates

## Future Enhancements

### Planned Features
- **Agent Marketplace**: Public marketplace for community agents
- **Custom Agent Builder**: No-code agent creation interface
- **Agent Chaining**: Workflow automation between multiple agents
- **Advanced Analytics**: ML-powered usage insights
- **Voice Integration**: Speech-to-text for agent interactions

### Scalability Improvements
- **Horizontal Scaling**: Multi-instance agent distribution
- **Caching Layer**: Redis for session and response caching
- **Load Balancing**: Intelligent request distribution
- **Auto-scaling**: Dynamic resource allocation based on demand

This agent system provides a robust, scalable foundation for AI-powered business automation while maintaining security, performance, and user experience standards.