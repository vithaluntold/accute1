# AI Agent Foundry - Agent Directory

This directory contains all AI agents available in the Accute platform. Each agent is self-contained with its own frontend, backend, and manifest configuration.

## Directory Structure

```
agents/
├── _templates/               # Template files and schemas
│   └── manifest.schema.json # JSON schema for manifest validation
├── {agent-slug}/            # Individual agent directory
│   ├── manifest.json        # Agent metadata and configuration
│   ├── frontend/            # React components
│   │   └── *.tsx           # Frontend entry point
│   ├── backend/            # Express handlers
│   │   └── *.ts           # Backend entry point
│   └── icon.png           # Agent icon (optional)
└── README.md              # This file
```

## Creating a New Agent

### 1. Create Agent Folder
```bash
mkdir -p agents/my-agent/{frontend,backend}
```

### 2. Create Manifest (`manifest.json`)
```json
{
  "slug": "my-agent",
  "name": "My AI Agent",
  "description": "Description of what the agent does",
  "category": "accounting",
  "provider": "openai",
  "frontendEntry": "./frontend/MyAgent.tsx",
  "backendEntry": "./backend/handler.ts",
  "capabilities": ["chat", "document-analysis"],
  "subscriptionMinPlan": "professional",
  "defaultScope": "admin",
  "version": "1.0.0"
}
```

### 3. Create Frontend Component
Create `frontend/MyAgent.tsx` - a React component that will be lazy-loaded.

### 4. Create Backend Handler
Create `backend/handler.ts` - exports a `registerRoutes(app)` function that registers Express routes.

### 5. Register the Agent
Use the Super Admin dashboard to register the agent:
1. Navigate to `/admin/agents/create`
2. Upload or link to your agent files
3. The system will validate the manifest
4. Publish the agent to make it available

## Agent Manifest Schema

See `_templates/manifest.schema.json` for the complete schema specification.

### Required Fields
- `slug`: Unique identifier (lowercase, hyphens only)
- `name`: Display name
- `description`: Detailed description
- `category`: Agent category
- `provider`: AI provider (openai, anthropic, azure-openai)
- `frontendEntry`: Path to frontend component
- `backendEntry`: Path to backend handler
- `capabilities`: Array of capabilities

### Optional Fields
- `iconPath`: Path to icon image
- `subscriptionMinPlan`: Minimum plan required (default: "free")
- `defaultScope`: Default access level (default: "admin")
- `pricingModel`: Pricing model (default: "free")
- `version`: Semantic version (default: "1.0.0")
- `tags`: Search tags for marketplace
- `configuration`: Default agent configuration

## Access Control

### By Role
- **Super Admin**: Can create, publish, and manage all agents
- **Organization Admin**: Can enable/disable agents for their organization
- **Users**: Can use agents if granted access by admin
- **Clients**: No access to agents

### By Subscription
Agents can require minimum subscription plans:
- `free`: Available to all organizations
- `starter`: Requires Starter plan or higher
- `professional`: Requires Professional plan or higher
- `enterprise`: Requires Enterprise plan only

## Backend Handler Interface

Your backend handler must export a `registerRoutes` function:

```typescript
import type { Express, Request, Response } from "express";

export const registerRoutes = (app: Express) => {
  // Register your agent's routes
  app.post("/api/agents/my-agent/action", async (req: Request, res: Response) => {
    // Handle request
    res.json({ success: true });
  });
};

export default { registerRoutes };
```

## Frontend Component Interface

Your frontend component should be a standard React component:

```typescript
export default function MyAgent() {
  return (
    <div>
      {/* Your agent UI */}
    </div>
  );
}
```

## Example: Parity Agent

See `parity-example/` for a complete working example showing:
- Manifest configuration
- Frontend chat interface
- Backend API handlers
- Proper error handling

## Dynamic Loading

Agents are dynamically loaded at runtime:
- **Backend**: `AgentRegistry` validates manifests and lazy-imports handlers
- **Frontend**: React lazy-loads components on-demand
- **No restart required**: New agents can be added without redeploying

## Best Practices

1. **Unique Slugs**: Use descriptive, unique slugs (e.g., `tax-compliance-bot`)
2. **Versioning**: Follow semantic versioning for updates
3. **Error Handling**: Always include proper error handling
4. **Documentation**: Document your agent's capabilities clearly
5. **Testing**: Test agents thoroughly before publishing
6. **Security**: Never expose sensitive data; use proper auth checks

## Troubleshooting

### Agent Not Loading
- Check manifest.json syntax
- Verify file paths are correct
- Ensure agent is published
- Check browser console for errors

### Access Denied
- Verify organization has agent enabled
- Check user has been granted access
- Confirm subscription plan meets minimum requirement

### API Errors
- Check backend handler is properly exporting routes
- Verify API paths match frontend calls
- Review server logs for detailed errors
