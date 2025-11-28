# Backend Server Architecture Documentation

## Overview
The backend is built with Node.js, Express, and TypeScript to provide a robust, scalable API server with comprehensive security, multi-tenancy, and enterprise-grade features. It follows a modular architecture with clear separation of concerns.

## Technology Stack

### Core Framework
- **Node.js**: Runtime environment with ES modules
- **Express.js**: Web application framework
- **TypeScript**: Type-safe JavaScript development
- **Drizzle ORM**: Type-safe SQL query builder
- **PostgreSQL**: Primary database with Neon hosting

### Security & Authentication
- **JWT**: JSON Web Token authentication
- **bcrypt**: Password hashing with salt rounds
- **AES-256-GCM**: Data encryption for sensitive information
- **Passport.js**: Authentication strategies (SAML, local)
- **Rate Limiting**: Express rate limiter for API protection

### External Integrations
- **OpenAI**: GPT models for AI agents
- **Anthropic Claude**: Advanced AI model support
- **Azure OpenAI**: Enterprise AI services
- **Stripe**: Payment processing
- **Razorpay**: Alternative payment gateway
- **Twilio**: SMS and voice services
- **Resend**: Email service

## Project Structure

### Directory Organization
```
server/
├── auth.ts                    # Authentication middleware and utilities
├── storage.ts                 # Database abstraction layer
├── routes.ts                  # Main API route definitions
├── index.ts                   # Server initialization and setup
├── start.ts                   # Production entry point
├── db.ts                      # Database connection configuration
├── websocket.ts               # WebSocket handlers
├── middleware/                # Express middleware functions
├── services/                  # Business logic services
├── agents/                    # AI agent implementations
└── __tests__/                 # Test files
```

### Core Components

#### 1. Server Initialization (`index.ts` & `start.ts`)
```typescript
// Environment validation before startup
function validateEnvironment() {
  const requiredVars = [
    { name: 'DATABASE_URL', critical: true },
    { name: 'JWT_SECRET', critical: true },
    { name: 'SESSION_SECRET', critical: true },
    { name: 'ENCRYPTION_KEY', critical: true }
  ];
  // Validation logic...
}

// Server startup with health checks
export async function startServer() {
  // 1. Start HTTP server immediately for health checks
  // 2. Register routes in background
  // 3. Initialize database connections
  // 4. Setup WebSocket handlers
  // 5. Load AI agents and automation
}
```

#### 2. Database Layer (`db.ts` & `storage.ts`)
```typescript
// Database connection with pooling
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

export const pool = neon(process.env.DATABASE_URL!);
export const db = drizzle(pool);

// Storage abstraction interface
export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  // ... other CRUD operations
}
```

## Security Architecture

### 1. Authentication System
```typescript
// JWT-based authentication with refresh tokens
export function generateToken(payload: object): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { 
    expiresIn: '24h',
    issuer: 'accute-platform',
    audience: 'accute-users'
  });
}

// Multi-factor authentication support
export const mfaService = {
  generateTOTPSecret(): string,
  verifyTOTP(secret: string, token: string): boolean,
  generateBackupCodes(): string[]
};
```

### 2. Authorization & RBAC
```typescript
// Role-based access control middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractTokenFromRequest(req);
  const user = verifyAndDecodeToken(token);
  req.user = user;
  next();
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
```

### 3. Multi-Tenancy & Organization Scope
```typescript
// Organization-level data isolation
export function enforceOrganizationScope(req: AuthRequest, res: Response, next: NextFunction) {
  const organizationId = req.user.organizationId;
  req.organizationScope = organizationId;
  next();
}

// Entity validation against organization
export async function validateEntityOrganization(
  entityId: string, 
  organizationId: string, 
  entityType: string
): Promise<boolean> {
  // Verify entity belongs to organization
}
```

### 4. Encryption Services
```typescript
// AES-256-GCM encryption for sensitive data
export class EncryptionService {
  static encrypt(data: string, key: string): string {
    const cipher = crypto.createCipher('aes-256-gcm', key);
    const iv = crypto.randomBytes(16);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
  }
  
  static decrypt(encryptedData: string, key: string): string {
    const [ivHex, encryptedHex, authTagHex] = encryptedData.split(':');
    const decipher = crypto.createDecipher('aes-256-gcm', key);
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  }
}
```

## API Architecture

### 1. RESTful Endpoints Structure
```typescript
// Organized by feature domains
app.use('/api/auth/*')          // Authentication endpoints
app.use('/api/users/*')         // User management
app.use('/api/organizations/*') // Multi-tenant organization management
app.use('/api/agents/*')        // AI agent interactions
app.use('/api/workflows/*')     // Workflow automation
app.use('/api/documents/*')     // Document management
app.use('/api/payments/*')      // Payment processing
app.use('/api/admin/*')         // Super admin functions
```

### 2. Request/Response Patterns
```typescript
// Standard API response format
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});
```

### 3. Input Validation with Zod
```typescript
// Schema-driven validation
import { z } from 'zod';

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional()
});

app.post('/api/users', async (req, res) => {
  try {
    const userData = createUserSchema.parse(req.body);
    const user = await storage.createUser(userData);
    res.json({ success: true, data: user });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors
      });
    }
    throw error;
  }
});
```

## Database Schema & Architecture

### 1. Multi-Tenant Data Model
```sql
-- Core entity relationships
users ←→ userOrganizations ←→ organizations
  ↓                           ↓
roles                   subscriptions
  ↓                           ↓
permissions            features & limits

-- Data isolation patterns
- Organization-scoped entities
- User-organization memberships
- Role-based permissions per organization
```

### 2. Key Tables Structure
```typescript
// Users with KYC support
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  roleId: varchar("role_id").notNull(),
  defaultOrganizationId: varchar("default_organization_id"),
  kycStatus: text("kyc_status").default("pending"),
  // ... additional fields
});

// Multi-workspace membership
export const userOrganizations = pgTable("user_organizations", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  organizationId: varchar("organization_id").notNull(),
  roleId: varchar("role_id").notNull(),
  status: text("status").default("active"),
  // ... additional fields
});
```

### 3. AI Agent Integration
```typescript
// Agent registry and installations
export const aiAgents = pgTable("ai_agents", {
  id: varchar("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  capabilities: text("capabilities").array(),
  subscriptionMinPlan: text("subscription_min_plan").default("free"),
  // ... configuration fields
});

export const organizationAgents = pgTable("organization_agents", {
  organizationId: varchar("organization_id").notNull(),
  agentSlug: text("agent_slug").notNull(),
  isEnabled: boolean("is_enabled").default(true),
  // ... installation settings
});
```

## Services Architecture

### 1. Business Logic Services
```typescript
// Service pattern for complex business logic
export class ResourceAllocationService {
  static async allocateResource(
    resourceId: string, 
    taskId: string, 
    allocation: number
  ): Promise<ResourceAllocation> {
    // Complex allocation logic
    // Validation, conflict checking, optimization
  }
  
  static async getOptimalAllocation(
    taskId: string, 
    requirements: SkillRequirement[]
  ): Promise<ResourceSuggestion[]> {
    // AI-powered resource matching
  }
}
```

### 2. External Service Integration
```typescript
// Email service abstraction
export class EmailService {
  static async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      await resend.emails.send({
        from: 'noreply@accute.io',
        to: options.to,
        subject: options.subject,
        html: options.html
      });
      return true;
    } catch (error) {
      console.error('Email send failed:', error);
      return false;
    }
  }
}

// SMS service with multiple providers
export class SMSService {
  static async sendSMS(phone: string, message: string): Promise<boolean> {
    const provider = process.env.SMS_PROVIDER || 'twilio';
    
    if (provider === 'twilio') {
      return await TwilioService.sendSMS(phone, message);
    } else if (provider === 'plivo') {
      return await PlivoService.sendSMS(phone, message);
    }
    
    throw new Error(`Unsupported SMS provider: ${provider}`);
  }
}
```

### 3. File Processing Services
```typescript
// Document parsing and processing
export class FileParserService {
  static async parseFile(
    buffer: Buffer, 
    filename: string, 
    mimeType: string,
    llmConfig?: LLMConfig
  ): Promise<ParseResult> {
    switch (mimeType) {
      case 'application/pdf':
        return await this.parsePDF(buffer, llmConfig);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await this.parseDOCX(buffer);
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return await this.parseXLSX(buffer);
      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }
  }
}
```

## Real-Time Communication

### 1. WebSocket Architecture
```typescript
// WebSocket connection management
export class WebSocketManager {
  private connections = new Map<string, WebSocket>();
  
  handleConnection(ws: WebSocket, userId: string) {
    this.connections.set(userId, ws);
    
    ws.on('message', (data) => {
      this.handleMessage(userId, JSON.parse(data.toString()));
    });
    
    ws.on('close', () => {
      this.connections.delete(userId);
    });
  }
  
  broadcastToOrganization(organizationId: string, message: any) {
    // Send message to all users in organization
  }
}
```

### 2. AI Agent Streaming
```typescript
// Real-time AI response streaming
export class AgentStreamingService {
  static async streamAgentResponse(
    agentSlug: string, 
    query: string, 
    ws: WebSocket,
    context: AgentContext
  ): Promise<void> {
    const agent = await AgentRegistry.getAgent(agentSlug);
    const stream = await agent.executeStream(query, context);
    
    for await (const chunk of stream) {
      ws.send(JSON.stringify({
        type: 'agent_response',
        chunk: chunk.text,
        metadata: chunk.metadata
      }));
    }
    
    ws.send(JSON.stringify({ type: 'agent_complete' }));
  }
}
```

## Performance & Monitoring

### 1. Caching Strategies
```typescript
// In-memory caching for frequently accessed data
import { LRUCache } from 'lru-cache';

const userCache = new LRUCache<string, User>({
  max: 1000,
  ttl: 1000 * 60 * 15 // 15 minutes
});

export async function getCachedUser(userId: string): Promise<User | undefined> {
  const cached = userCache.get(userId);
  if (cached) return cached;
  
  const user = await storage.getUser(userId);
  if (user) userCache.set(userId, user);
  return user;
}
```

### 2. Database Optimization
```typescript
// Connection pooling and query optimization
export const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  query_timeout: 10000
};

// Indexed queries for performance
export async function getUsersByOrganizationOptimized(
  organizationId: string
): Promise<User[]> {
  return await db
    .select()
    .from(users)
    .innerJoin(userOrganizations, eq(users.id, userOrganizations.userId))
    .where(eq(userOrganizations.organizationId, organizationId))
    .orderBy(desc(users.createdAt));
}
```

### 3. Error Handling & Logging
```typescript
// Structured logging with different levels
export class Logger {
  static info(message: string, context?: object) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      context,
      timestamp: new Date().toISOString()
    }));
  }
  
  static error(message: string, error?: Error, context?: object) {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error?.stack,
      context,
      timestamp: new Date().toISOString()
    }));
  }
}

// Global error handling
process.on('uncaughtException', (error) => {
  Logger.error('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Unhandled rejection', new Error(String(reason)));
});
```

## Rate Limiting & Security

### 1. API Rate Limiting
```typescript
// Different limits for different endpoint types
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts',
  standardHeaders: true
});

export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 payment attempts per window
  message: 'Too many payment attempts'
});
```

### 2. Security Headers & HTTPS
```typescript
// Security middleware
app.use('/api', (req, res, next) => {
  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.status(403).json({ error: 'HTTPS required' });
  }
  
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
});
```

## Deployment & Production

### 1. Environment Configuration
```typescript
// Environment variable validation
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
  'OPENAI_API_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
```

### 2. Health Checks
```typescript
// Health endpoint for load balancers
app.get('/api/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'connected' // Test DB connection
  };
  
  res.json(health);
});
```

### 3. Graceful Shutdown
```typescript
// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close database connections
    db.end().then(() => {
      console.log('Database connections closed');
      process.exit(0);
    });
  });
});
```

This server architecture provides enterprise-grade security, scalability, and maintainability while supporting complex multi-tenant operations and AI agent integrations.