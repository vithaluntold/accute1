# Agent Template - LLM Middleware Pattern

This template shows the correct pattern for creating new AI agents using the centralized LLM configuration middleware.

## Overview

All agents should use the `withLLMConfig` middleware to automatically retrieve and cache LLM configurations. This provides:
- ✅ Automatic workspace → user fallback
- ✅ 5-minute caching to reduce database load
- ✅ Consistent error handling
- ✅ Support for both workspace-level and user-level configs
- ✅ Scales to infinite agents (both static and dynamic)

## Backend Handler Pattern

### File Structure
```
agents/{agent-name}/
├── backend/
│   ├── handler.ts     # HTTP endpoints using middleware
│   └── index.ts       # Agent class implementation
├── frontend/
│   └── ...
└── manifest.json      # For dynamic agents only
```

### handler.ts Template

```typescript
import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../../../server/auth";
import { storage } from "../../../server/storage";
import { withLLMConfig, getLLMConfig } from "../../../server/middleware/agent-llm-middleware";
import { registerAgentSessionRoutes } from "../../../server/agent-sessions";
import { YourAgent } from "./index";
import multer from "multer";
import { FileParserService } from "../../../server/file-parser-service";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const registerRoutes = (app: any) => {
  // Register session management routes (optional, for stateful agents)
  registerAgentSessionRoutes(app, "your-agent-name");

  // ✅ CORRECT: Main chat endpoint with middleware
  app.post("/api/agents/your-agent/chat", requireAuth, 
    withLLMConfig(async (req, res, llmConfig) => {
      try {
        const { message, history, contextData } = req.body;

        // Initialize agent with LLM config from middleware
        const agent = new YourAgent(llmConfig);
        
        // Execute agent logic
        const result = await agent.execute({ 
          message, 
          history, 
          contextData 
        });

        res.json({ 
          response: result.response,
          // ... other response fields
        });
        
      } catch (error) {
        console.error("Error in YourAgent chat:", error);
        res.status(500).json({ 
          error: "Failed to process message",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    })
  );

  // ✅ CORRECT: File upload endpoint (LLM config is optional for OCR)
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'text/plain'
      ];
      allowedMimes.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'));
    }
  });
  
  app.post("/api/agents/your-agent/upload-document", requireAuth, (req: AuthRequest, res: Response, next: any) => {
    upload.single("file")(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ 
          error: err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE' 
            ? 'File too large. Maximum size is 10MB.' 
            : err.message || 'Invalid file upload'
        });
      }

      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        // Get LLM config (optional - only needed for scanned PDF OCR)
        // Use .catch() to make this truly optional (won't throw if no config)
        const llmConfig = await getLLMConfig({
          organizationId: req.user!.organizationId!,
          userId: req.user!.id
        }).catch(() => null);
        
        const parsed = await FileParserService.parseFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          llmConfig || undefined // Pass undefined if no config available
        );

        // Warn if scanned PDF detected without LLM config
        if (parsed.isScannedPdf && !llmConfig) {
          console.warn(`[YourAgent] Scanned PDF upload without LLM config - OCR unavailable for org ${req.user!.organizationId}`);
        }

        res.json({ 
          text: parsed.text,
          isScannedPdf: parsed.isScannedPdf,
          filename: req.file.originalname
        });
        
      } catch (error) {
        console.error("Error parsing document:", error);
        res.status(500).json({ 
          error: "Failed to parse document",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    });
  });

  // Other endpoints (save, list, etc.)
  // These typically don't need LLM config
};
```

### ❌ WRONG PATTERNS (Do Not Use)

```typescript
// ❌ WRONG: Direct storage access without middleware
app.post("/api/agents/your-agent/chat", requireAuth, async (req: AuthRequest, res: Response) => {
  const llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
  if (!llmConfig) {
    return res.status(400).json({ error: "No LLM config..." });
  }
  // ...
});

// ❌ WRONG: Direct service access without middleware
app.post("/api/agents/your-agent/chat", requireAuth, async (req: AuthRequest, res: Response) => {
  const { getLLMConfigService } = await import('../../../server/llm-config-service');
  const llmConfigService = getLLMConfigService();
  const llmConfig = await llmConfigService.getConfig(req.user!.organizationId!, llmConfigId);
  // ...
});

// ❌ WRONG: Manual llmConfigId handling
app.post("/api/agents/your-agent/chat", requireAuth, async (req: AuthRequest, res: Response) => {
  const { llmConfigId } = req.body;
  let llmConfig;
  if (llmConfigId) {
    llmConfig = await storage.getLlmConfiguration(llmConfigId);
    if (!llmConfig || llmConfig.organizationId !== req.user!.organizationId) {
      return res.status(404).json({ error: "LLM configuration not found" });
    }
  } else {
    llmConfig = await storage.getDefaultLlmConfiguration(req.user!.organizationId!);
  }
  // ...
});
```

## Frontend Integration

Agents should NOT send `llmConfigId` in requests - the middleware handles this automatically:

```typescript
// ✅ CORRECT: Let middleware handle LLM config selection
const sendMessage = useMutation({
  mutationFn: async (data: { message: string; history: Message[] }) => {
    return apiRequest(`/api/agents/your-agent/chat`, {
      method: "POST",
      body: JSON.stringify({
        message: data.message,
        history: data.history,
        // NO llmConfigId here - middleware handles it
      }),
    });
  },
});

// ❌ WRONG: Manually passing llmConfigId
const sendMessage = useMutation({
  mutationFn: async (data: { message: string; llmConfigId?: string }) => {
    return apiRequest(`/api/agents/your-agent/chat`, {
      method: "POST",
      body: JSON.stringify({
        message: data.message,
        llmConfigId: data.llmConfigId, // ❌ Not needed
      }),
    });
  },
});
```

## WebSocket Pattern

For WebSocket-based agents (like Luca), use the `getLLMConfig` helper:

```typescript
import { getLLMConfig } from './middleware/agent-llm-middleware';

async function handleAgentExecution(ws: AuthenticatedWebSocket, message: StreamMessage) {
  // Get LLM configuration using centralized helper
  const llmConfig = await getLLMConfig({
    organizationId: ws.organizationId,
    userId: ws.userId,
    configId: message.llmConfigId // Optional user override
  });

  // Initialize agent
  const agent = new YourAgent(llmConfig);
  // ...
}
```

## Agent Class Pattern (index.ts)

```typescript
import { LLMService } from "../../../server/llm-service";
import type { LlmConfiguration } from "../../../shared/schema";

export class YourAgent {
  private llmService: LLMService;
  private llmConfig: LlmConfiguration;

  constructor(llmConfig: LlmConfiguration) {
    this.llmConfig = llmConfig;
    this.llmService = new LLMService(llmConfig);
  }

  async execute(params: {
    message: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    contextData?: any;
  }) {
    const systemPrompt = `You are YourAgent...`;
    
    // Build messages array
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...(params.history || []),
      { role: 'user' as const, content: params.message }
    ];

    // Call LLM
    const response = await this.llmService.chat(messages);

    return {
      response: response.content,
      // ... other response fields
    };
  }
}
```

## Key Benefits

1. **Automatic Config Resolution**: Middleware handles workspace → user fallback
2. **Caching**: 5-minute TTL reduces database load by ~95%
3. **Consistency**: All agents use the same pattern
4. **Scalability**: Works for both static and dynamic agents
5. **Error Handling**: Centralized, consistent error messages
6. **Maintainability**: Single source of truth for LLM config logic

## Migration Checklist

When migrating an existing agent:

- [ ] Import `withLLMConfig` and `getLLMConfig` from middleware
- [ ] Wrap main chat endpoint with `withLLMConfig(async (req, res, llmConfig) => { ... })`
- [ ] Remove manual LLM config retrieval logic (storage.getDefaultLlmConfiguration, etc.)
- [ ] Remove `llmConfigId` from request body destructuring
- [ ] Update file upload endpoints to use `getLLMConfig(...).catch(() => null)` if optional
- [ ] Remove frontend code that sends `llmConfigId`
- [ ] Test agent via Agent Health dashboard

## Testing

After creating or migrating an agent:

1. Restart the server: `npm run dev`
2. Navigate to Agent Health dashboard: `/admin/agent-health`
3. Test each agent endpoint
4. Verify proper LLM config resolution (workspace → user fallback)
5. Check server logs for cache hit rates

## References

- Middleware implementation: `server/middleware/agent-llm-middleware.ts`
- Service implementation: `server/llm-config-service.ts`
- Example migrations: All 10 static agents (luca, parity, cadence, forma, echo, relay, scribe, radar, omnispectra, lynk)
