import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Folder, 
  FileCode, 
  Server, 
  Monitor, 
  CheckCircle2, 
  ArrowRight,
  Code2,
  Box,
  Zap,
  BookOpen
} from "lucide-react";

export default function AgentIntegrationGuide() {
  return (
    <div className="h-full overflow-auto">
      <ScrollArea className="h-full">
        <div className="container mx-auto p-6 max-w-6xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">AI Agent Integration Guide</h1>
            <p className="text-muted-foreground text-lg">
              Learn how to build external AI agents and integrate them seamlessly into Accute
            </p>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" data-testid="tab-overview">
                <BookOpen className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="external" data-testid="tab-external">
                <Code2 className="h-4 w-4 mr-2" />
                Building External Agents
              </TabsTrigger>
              <TabsTrigger value="integration" data-testid="tab-integration">
                <Zap className="h-4 w-4 mr-2" />
                Integration Steps
              </TabsTrigger>
              <TabsTrigger value="reference" data-testid="tab-reference">
                <Box className="h-4 w-4 mr-2" />
                Tech Stack Reference
              </TabsTrigger>
            </TabsList>

            {/* OVERVIEW */}
            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Two-Phase Integration Approach</CardTitle>
                  <CardDescription>Build your agent separately, then integrate into Accute</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border-2 border-primary/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Code2 className="h-5 w-5 text-primary" />
                          Phase 1: External Development
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <div>
                            <p className="font-medium">Build Independently</p>
                            <p className="text-sm text-muted-foreground">
                              Develop your agent as a standalone application with its own tech stack
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <div>
                            <p className="font-medium">Test Thoroughly</p>
                            <p className="text-sm text-muted-foreground">
                              Validate all features work before integration
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <div>
                            <p className="font-medium">Design API Contract</p>
                            <p className="text-sm text-muted-foreground">
                              Define clear input/output interfaces
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-2 border-primary/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Zap className="h-5 w-5 text-primary" />
                          Phase 2: Accute Integration
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <div>
                            <p className="font-medium">Copy Files</p>
                            <p className="text-sm text-muted-foreground">
                              Move your agent code into Accute's agents/ folder
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <div>
                            <p className="font-medium">Create Manifest</p>
                            <p className="text-sm text-muted-foreground">
                              Add manifest.json for auto-discovery
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                          <div>
                            <p className="font-medium">Register Routes</p>
                            <p className="text-sm text-muted-foreground">
                              Add frontend route in App.tsx
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <ArrowRight className="h-4 w-4" />
                      How It Works
                    </h3>
                    <div className="pl-6 space-y-3 border-l-2 border-primary/20">
                      <div>
                        <p className="font-medium mb-1">1. Agent Discovery</p>
                        <p className="text-sm text-muted-foreground">
                          On server startup, Accute's Agent Registry scans the <code className="bg-muted px-1 py-0.5 rounded">agents/</code> directory
                        </p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">2. Manifest Loading</p>
                        <p className="text-sm text-muted-foreground">
                          Each agent's <code className="bg-muted px-1 py-0.5 rounded">manifest.json</code> is read and validated
                        </p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">3. Route Registration</p>
                        <p className="text-sm text-muted-foreground">
                          Backend routes are dynamically registered from <code className="bg-muted px-1 py-0.5 rounded">backend/handler.ts</code>
                        </p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">4. Frontend Access</p>
                        <p className="text-sm text-muted-foreground">
                          Users access your agent at <code className="bg-muted px-1 py-0.5 rounded">/ai-agents/your-agent-slug</code>
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* EXTERNAL DEVELOPMENT */}
            <TabsContent value="external" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Building Your External Agent</CardTitle>
                  <CardDescription>What to do in your separate agent application</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Compatible Tech Stacks</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3">
                        <h4 className="font-medium flex items-center gap-2">
                          <Server className="h-4 w-4" />
                          Backend Options
                        </h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Node.js + Express</Badge>
                            <span className="text-xs text-green-500">Recommended</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Node.js + TypeScript</Badge>
                            <span className="text-xs text-green-500">Recommended</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Python + Flask</Badge>
                            <span className="text-xs text-muted-foreground">Compatible</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Python + FastAPI</Badge>
                            <span className="text-xs text-muted-foreground">Compatible</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-medium flex items-center gap-2">
                          <Monitor className="h-4 w-4" />
                          Frontend Options
                        </h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">React + TypeScript</Badge>
                            <span className="text-xs text-green-500">Required</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">shadcn/ui Components</Badge>
                            <span className="text-xs text-green-500">Recommended</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">TailwindCSS</Badge>
                            <span className="text-xs text-green-500">Recommended</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Required Agent Structure</h3>
                    <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-1">
                      <div>your-agent/</div>
                      <div className="pl-4">├── backend/</div>
                      <div className="pl-8 text-muted-foreground">│   ├── index.ts           # Agent class with execute() method</div>
                      <div className="pl-8 text-muted-foreground">│   └── handler.ts         # Express route registration</div>
                      <div className="pl-4">├── frontend/</div>
                      <div className="pl-8 text-muted-foreground">│   └── YourAgent.tsx      # React component (main UI)</div>
                      <div className="pl-4 text-muted-foreground">└── manifest.json          # Agent metadata</div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Agent Class Requirements</h3>
                    <p className="text-sm text-muted-foreground">Your backend agent class MUST implement:</p>
                    <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                      <pre>{`export class YourAgent {
  private llmService: LLMService;
  
  constructor(llmConfig: LlmConfiguration) {
    this.llmService = new LLMService(llmConfig);
  }
  
  // REQUIRED: Main execution method
  async execute(input: YourInput | string): Promise<YourOutput> {
    // Your agent logic here
  }
  
  // OPTIONAL: Streaming for real-time responses
  async executeStream(
    input: YourInput | string,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    // Streaming logic here
  }
}`}</pre>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Route Handler Requirements</h3>
                    <p className="text-sm text-muted-foreground">Your handler.ts MUST export a registerRoutes function:</p>
                    <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                      <pre>{`export const registerRoutes = (app: any) => {
  // Register session management (chat history)
  registerAgentSessionRoutes(app, "your-slug");
  
  // Main chat endpoint
  app.post("/api/agents/your-slug/chat", 
    requireAuth, 
    async (req, res) => {
      // Chat logic here
    }
  );
  
  // Add custom endpoints as needed
  app.post("/api/agents/your-slug/custom-action",
    requireAuth,
    async (req, res) => {
      // Custom logic here
    }
  );
};`}</pre>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Development Checklist</h3>
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium">Build and test your agent independently</p>
                          <p className="text-sm text-muted-foreground">Use your preferred stack and tools</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium">Create an agent class with execute() method</p>
                          <p className="text-sm text-muted-foreground">This is the core logic that Accute will call</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium">Build your frontend UI as a React component</p>
                          <p className="text-sm text-muted-foreground">Use shadcn/ui components for consistency</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium">Define clear API endpoints</p>
                          <p className="text-sm text-muted-foreground">Follow RESTful conventions</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="font-medium">Handle errors gracefully</p>
                          <p className="text-sm text-muted-foreground">Return user-friendly error messages</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* INTEGRATION STEPS */}
            <TabsContent value="integration" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Integrating into Accute</CardTitle>
                  <CardDescription>What to do in the Accute platform</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-6">
                    {/* Step 1 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                          1
                        </div>
                        <h3 className="font-semibold text-lg">Create Agent Folder</h3>
                      </div>
                      <div className="pl-11 space-y-2">
                        <p className="text-sm">
                          Create a new folder in <code className="bg-muted px-1 py-0.5 rounded">agents/</code> with your agent slug:
                        </p>
                        <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                          agents/casting/
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Step 2 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                          2
                        </div>
                        <h3 className="font-semibold text-lg">Copy Your Agent Files</h3>
                      </div>
                      <div className="pl-11 space-y-2">
                        <p className="text-sm">Move your backend and frontend code into the structure:</p>
                        <div className="bg-muted p-3 rounded-lg font-mono text-sm space-y-1">
                          <div>agents/casting/</div>
                          <div className="pl-4">├── backend/</div>
                          <div className="pl-8">│   ├── index.ts</div>
                          <div className="pl-8">│   └── handler.ts</div>
                          <div className="pl-4">└── frontend/</div>
                          <div className="pl-8">    └── CastingAgent.tsx</div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Step 3 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                          3
                        </div>
                        <h3 className="font-semibold text-lg">Create manifest.json</h3>
                      </div>
                      <div className="pl-11 space-y-2">
                        <p className="text-sm">Create <code className="bg-muted px-1 py-0.5 rounded">agents/casting/manifest.json</code>:</p>
                        <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                          <pre>{`{
  "slug": "casting",
  "name": "Casting Engine",
  "description": "Resource allocation AI",
  "category": "automation",
  "provider": "openai",
  "frontendEntry": "./frontend/CastingAgent.tsx",
  "backendEntry": "./backend/handler.ts",
  "capabilities": ["chat", "automation"],
  "subscriptionMinPlan": "professional",
  "defaultScope": "admin",
  "version": "1.0.0"
}`}</pre>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Step 4 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                          4
                        </div>
                        <h3 className="font-semibold text-lg">Register Frontend Route</h3>
                      </div>
                      <div className="pl-11 space-y-2">
                        <p className="text-sm">Add to <code className="bg-muted px-1 py-0.5 rounded">client/src/App.tsx</code>:</p>
                        <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                          <pre>{`// Import your agent
import CastingAgent from "../../agents/casting/frontend/CastingAgent";

// Add route inside Router component
<Route path="/ai-agents/casting" component={CastingAgent} />`}</pre>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Step 5 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                          5
                        </div>
                        <h3 className="font-semibold text-lg">Adapt Dependencies</h3>
                      </div>
                      <div className="pl-11 space-y-2">
                        <p className="text-sm">Update imports to use Accute's shared services:</p>
                        <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                          <pre>{`// Use Accute's LLM Service
import { LLMService } from '../../../server/llm-service';
import type { LlmConfiguration } from '../../../shared/schema';

// Use Accute's authentication
import { requireAuth, type AuthRequest } from '../../../server/auth';

// Use Accute's storage
import { storage } from '../../../server/storage';`}</pre>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Step 6 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                          6
                        </div>
                        <h3 className="font-semibold text-lg">Test Integration</h3>
                      </div>
                      <div className="pl-11 space-y-2">
                        <p className="text-sm">Restart the server and navigate to your agent:</p>
                        <div className="bg-muted p-3 rounded-lg font-mono text-sm">
                          http://localhost:5000/ai-agents/casting
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          Your agent should appear in the AI Agents list and be fully functional!
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TECH STACK REFERENCE */}
            <TabsContent value="reference" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Accute Tech Stack Reference</CardTitle>
                  <CardDescription>What Accute uses and what your agent should align with</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Backend */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        Backend Stack
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <p className="font-medium">Runtime</p>
                          <Badge variant="outline">Node.js</Badge>
                        </div>
                        <div>
                          <p className="font-medium">Language</p>
                          <Badge variant="outline">TypeScript</Badge>
                        </div>
                        <div>
                          <p className="font-medium">Web Framework</p>
                          <Badge variant="outline">Express.js</Badge>
                        </div>
                        <div>
                          <p className="font-medium">Database</p>
                          <Badge variant="outline">PostgreSQL (Neon)</Badge>
                        </div>
                        <div>
                          <p className="font-medium">ORM</p>
                          <Badge variant="outline">Drizzle ORM</Badge>
                        </div>
                        <div>
                          <p className="font-medium">Authentication</p>
                          <Badge variant="outline">JWT + bcrypt</Badge>
                        </div>
                        <div>
                          <p className="font-medium">AI Providers</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <Badge variant="outline">OpenAI</Badge>
                            <Badge variant="outline">Azure OpenAI</Badge>
                            <Badge variant="outline">Anthropic Claude</Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Frontend */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Monitor className="h-5 w-5" />
                        Frontend Stack
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <p className="font-medium">Library</p>
                          <Badge variant="outline">React 18</Badge>
                        </div>
                        <div>
                          <p className="font-medium">Language</p>
                          <Badge variant="outline">TypeScript</Badge>
                        </div>
                        <div>
                          <p className="font-medium">Build Tool</p>
                          <Badge variant="outline">Vite</Badge>
                        </div>
                        <div>
                          <p className="font-medium">Styling</p>
                          <Badge variant="outline">Tailwind CSS</Badge>
                        </div>
                        <div>
                          <p className="font-medium">UI Components</p>
                          <Badge variant="outline">shadcn/ui</Badge>
                        </div>
                        <div>
                          <p className="font-medium">Routing</p>
                          <Badge variant="outline">Wouter</Badge>
                        </div>
                        <div>
                          <p className="font-medium">Data Fetching</p>
                          <Badge variant="outline">TanStack Query</Badge>
                        </div>
                        <div>
                          <p className="font-medium">Form Handling</p>
                          <Badge variant="outline">React Hook Form + Zod</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Shared Services Available to Your Agent</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">LLMService</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm">
                          <p className="text-muted-foreground mb-2">Unified interface for all AI providers</p>
                          <code className="bg-muted px-2 py-1 rounded text-xs">
                            server/llm-service.ts
                          </code>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Storage</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm">
                          <p className="text-muted-foreground mb-2">Database operations and queries</p>
                          <code className="bg-muted px-2 py-1 rounded text-xs">
                            server/storage.ts
                          </code>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Auth Middleware</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm">
                          <p className="text-muted-foreground mb-2">requireAuth for protected routes</p>
                          <code className="bg-muted px-2 py-1 rounded text-xs">
                            server/auth.ts
                          </code>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Agent Sessions</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm">
                          <p className="text-muted-foreground mb-2">Chat history management</p>
                          <code className="bg-muted px-2 py-1 rounded text-xs">
                            server/agent-sessions.ts
                          </code>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Key Conventions</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium mb-1">Agent Slugs</p>
                        <p className="text-sm text-muted-foreground">
                          Lowercase, hyphenated (e.g., <code className="bg-muted px-1 rounded">casting-engine</code>, <code className="bg-muted px-1 rounded">compliance-checker</code>)
                        </p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">API Routes</p>
                        <p className="text-sm text-muted-foreground">
                          <code className="bg-muted px-1 rounded">/api/agents/[slug]/[action]</code>
                        </p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">Frontend Routes</p>
                        <p className="text-sm text-muted-foreground">
                          <code className="bg-muted px-1 rounded">/ai-agents/[slug]</code>
                        </p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">Component Naming</p>
                        <p className="text-sm text-muted-foreground">
                          PascalCase (e.g., <code className="bg-muted px-1 rounded">CastingAgent.tsx</code>)
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Quick Reference Card */}
          <Card className="mt-8 border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Folder className="h-5 w-5" />
                Quick Reference: Complete Agent Structure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                <pre>{`agents/
└── your-agent/
    ├── manifest.json                    # Agent metadata
    ├── backend/
    │   ├── index.ts                    # Agent class with execute()
    │   └── handler.ts                  # Route registration
    ├── frontend/
    │   └── YourAgent.tsx               # React UI component
    └── icon.png                        # Optional 512x512 icon

Required in manifest.json:
- slug, name, description
- frontendEntry, backendEntry
- category, provider, version

Backend must export:
- Agent class with execute() method
- registerRoutes function in handler.ts

Frontend must:
- Be a React component
- Use shadcn/ui for consistency
- Make API calls to /api/agents/[slug]/*`}</pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
