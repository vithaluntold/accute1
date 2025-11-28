# Scripts & Utilities Documentation

## Overview
The project includes various build scripts, testing utilities, and automation tools to support development, deployment, and maintenance workflows. These scripts help ensure code quality, production readiness, and operational health.

## Build Scripts

### 1. Agent Build System (`build-agents.mjs`)
Transpiles AI agent backends for production deployment.

**Purpose:**
- Converts TypeScript agent handlers to JavaScript
- Ensures production-ready agent backends
- Maintains agent modularity and isolation

**Functionality:**
```javascript
// Build process
1. Scans agents/ directory for TypeScript backends
2. Uses esbuild to transpile each agent's backend/index.ts
3. Outputs to dist/agents/<agent-name>/backend/index.js
4. Maintains source maps for debugging
5. Marks node_modules as external dependencies

// Usage
npm run build-agents
# or directly: node build-agents.mjs
```

**Configuration:**
- **Target**: Node 20 ESM modules
- **Format**: ES modules for modern Node.js
- **Bundling**: No bundling (just transpilation)
- **Source Maps**: Generated for production debugging
- **External Packages**: All node_modules marked as external

### 2. Production Build (`scripts/build-production.sh`)
Comprehensive production build pipeline.

**Process:**
```bash
#!/bin/bash
# 1. Clean previous builds
rm -rf dist/

# 2. Build client (Vite)
npm run build

# 3. Build server (esbuild)
npm run build:server

# 4. Build agents
npm run build-agents

# 5. Copy static assets
cp -r public/* dist/public/

# 6. Generate production manifest
node scripts/generate-manifest.js
```

## Testing Infrastructure

### 1. Agent Health Check (`test-agents-health.sh`)
Comprehensive production health testing for all AI agents.

**Features:**
- **Authentication**: Automatic admin login and session management
- **Coverage**: Tests all 10 AI agents systematically
- **HTTP Validation**: Checks status codes and response formats
- **Error Handling**: Distinguishes between configuration and system errors
- **Color Output**: Green/red/yellow status indicators
- **Summary Report**: Pass/fail statistics and recommendations

**Agent Test Coverage:**
```bash
# Tests each agent endpoint
1. Luca (AI Accounting Expert) - /api/agents/luca/query
2. Parity (Document Generation) - /api/agents/parity/chat
3. Cadence (Workflow Builder) - /api/agents/cadence/chat
4. Forma (Form Builder) - /api/agents/forma/chat
5. Echo (Message Templates) - /api/agents/echo/chat
6. Relay (Email Inbox) - /api/agents/relay/chat
7. Scribe (Email Templates) - /api/agents/scribe/chat
8. Radar (Activity Tracking) - /api/agents/radar/chat
9. OmniSpectra (Assignment Tracking) - /api/agents/omnispectra/chat
10. Lynk (Client Messages) - /api/agents/lynk/chat
```

**Usage:**
```bash
# Test production
./test-agents-health.sh

# Expected output
🔍 AI Agent Health Check - Testing all 10 agents...
✅ Luca (AI Accounting Expert) - Working!
✅ Parity (Document Generation) - Working!
⚠️  Cadence (Workflow Builder) - No LLM config (expected)
...
🎉 All agents are working!
```

### 2. Foundation Test Suite (`run-tests.sh`)
Core system testing with Vitest framework.

**Test Categories:**
```bash
# Foundation Tests (85 tests)
- Database operations
- Authentication & authorization
- API endpoints
- Schema validation
- Security measures
- Multi-tenancy isolation

# Usage
./run-tests.sh
```

**Test Configuration:**
- **Environment**: Isolated test environment
- **Database**: Development database with cleanup
- **Coverage**: Core business logic and API endpoints
- **Reporter**: Verbose output for CI/CD integration

### 3. Specialized Testing Scripts

#### Agent Verification (`scripts/verify-agents-loaded.mjs`)
```javascript
// Verifies all agents are properly registered
- Checks agent manifest files
- Validates frontend/backend entries exist
- Confirms agent registry loading
- Reports missing or broken agents
```

#### All Agents Test (`scripts/test-all-agents.mjs`)
```javascript
// Comprehensive agent functionality testing
- Loads each agent's backend handler
- Tests registration and routing
- Validates LLM integration
- Checks WebSocket streaming
```

## Database Management

### 1. Schema Safety Checker (`check-schema-safety.sh`)
Production database protection against destructive migrations.

**Safety Checks:**
```bash
# Dangerous Operations Detection
- DROP COLUMN (data deletion)
- DROP TABLE (full table deletion)
- ALTER COLUMN TYPE (potential data loss)
- NOT NULL without DEFAULT (runtime failures)

# Safety Requirements
- Backup recommendations
- Migration strategy guidance
- Alternative approaches
```

**Usage Flow:**
```bash
# Before deploying
./check-schema-safety.sh

# Example output
⚠️ WARNING: DROP COLUMN detected!
❌ UNSAFE SCHEMA CHANGES DETECTED!
⛔ DO NOT PUBLISH - This will cause data loss in production!

# Safe migration alternatives provided
```

**Migration Safety Rules:**
1. **Never drop columns directly** - Make nullable first
2. **Add before remove** - Create new columns, migrate data, then remove old
3. **Default values required** - For new NOT NULL columns
4. **Backup first** - Always backup before destructive changes
5. **Test in development** - Verify migrations work correctly

## Utility Scripts

### 1. Icon Generation (`scripts/generate-icons.js`)
Automated icon processing for applications.

```javascript
// Features
- SVG optimization
- Multiple size generation (16x16, 32x32, 64x64, 128x128)
- PWA icon generation
- Favicon creation
- Asset manifest generation

// Usage
node scripts/generate-icons.js
```

### 2. API Testing Utilities

#### Personality API Test (`test-personality-api.js`)
```javascript
// Tests personality profiling system
async function testPersonalityAPI() {
  // 1. Admin authentication
  // 2. User data fetching
  // 3. Batch analysis triggering
  // 4. Job status monitoring
  // 5. Queue statistics
  // 6. Results validation
}
```

**Test Workflow:**
1. **Authentication**: Login as admin user
2. **User Selection**: Fetch organization users
3. **Batch Analysis**: Trigger personality profiling
4. **Monitoring**: Check job status and progress
5. **Validation**: Verify queue operations and results

## Development Workflows

### 1. Development Testing Flow
```bash
# Pre-commit checks
1. npm run check          # TypeScript validation
2. npm run test          # Unit tests
3. ./check-schema-safety.sh # Database safety
4. npm run build         # Build validation
5. ./test-agents-health.sh # Agent health check
```

### 2. Production Deployment Flow
```bash
# Production readiness
1. ./check-schema-safety.sh # Schema validation
2. npm run build-production # Full build
3. npm run db:push         # Database migration
4. ./test-agents-health.sh # Post-deploy validation
5. npm run test           # Final verification
```

### 3. Continuous Integration Integration
```yaml
# Example CI/CD pipeline integration
name: Quality Assurance
on: [push, pull_request]
jobs:
  test:
    steps:
      - name: Run Foundation Tests
        run: ./run-tests.sh
      
      - name: Check Schema Safety
        run: ./check-schema-safety.sh
      
      - name: Build Agents
        run: node build-agents.mjs
      
      - name: Health Check
        run: ./test-agents-health.sh
```

## Monitoring & Diagnostics

### 1. Health Check Endpoints
```bash
# Server health
curl http://localhost:5000/api/health

# Individual agent status
curl http://localhost:5000/api/agents/luca/status
```

### 2. Performance Monitoring
```bash
# Database performance
npm run db:analyze

# Bundle size analysis
npm run bundle-analyzer

# Memory usage tracking
node --inspect server/start.js
```

### 3. Error Diagnostics
```bash
# Agent debugging
DEBUG=agent:* npm run dev

# Database query logging
DEBUG=drizzle:* npm run dev

# Full system debugging
DEBUG=* npm run dev
```

## Configuration Management

### 1. Environment Validation
```bash
# Required environment variables
- DATABASE_URL (PostgreSQL connection)
- JWT_SECRET (Authentication)
- SESSION_SECRET (Session management)
- ENCRYPTION_KEY (Data encryption)
- OPENAI_API_KEY (AI services)

# Optional configurations
- ANTHROPIC_API_KEY (Claude integration)
- AZURE_OPENAI_* (Azure AI services)
- STRIPE_* (Payment processing)
- TWILIO_* (SMS services)
```

### 2. Production Safety
```bash
# Security validation
- HTTPS enforcement in production
- Secure cookie settings
- Rate limiting configuration
- CORS policy validation

# Performance optimization
- Connection pooling settings
- Cache configuration
- Bundle optimization
- Asset compression
```

## Best Practices

### 1. Script Development
- **Error Handling**: Comprehensive error catching and reporting
- **Exit Codes**: Proper exit codes for CI/CD integration
- **Logging**: Structured logging with timestamps and context
- **Idempotency**: Scripts can be run multiple times safely

### 2. Testing Strategy
- **Isolation**: Tests run in isolated environments
- **Cleanup**: Automatic cleanup of test data
- **Mocking**: External service mocking for reliability
- **Coverage**: High test coverage for critical paths

### 3. Deployment Safety
- **Validation**: Pre-deployment validation checks
- **Rollback**: Rollback procedures for failed deployments
- **Monitoring**: Post-deployment health monitoring
- **Documentation**: Clear deployment procedures and troubleshooting

This comprehensive script ecosystem ensures reliable development workflows, production safety, and operational excellence for the Accute platform.