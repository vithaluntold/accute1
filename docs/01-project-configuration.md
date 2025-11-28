# Project Configuration Documentation

## Overview
This document provides detailed analysis of the project's configuration files and setup.

## Package Configuration (package.json)

### Project Identity
- **Name**: rest-express
- **Version**: 1.0.0
- **Type**: ESM (ES Modules)
- **License**: MIT

### Scripts Analysis
- `dev`: Development server with tsx and TypeScript hot-reloading
- `build`: Production build using Vite for client and esbuild for server
- `start`: Production server startup
- `check`: TypeScript type checking
- `db:push`: Database schema migrations using Drizzle
- `seed`: Database seeding script

### Technology Stack

#### Core Dependencies
- **Runtime**: Node.js with Express server
- **Frontend**: React 18 with TypeScript
- **Build Tools**: Vite for client, esbuild for server
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT, bcrypt, passport strategies

#### AI & LLM Integration
- **OpenAI**: Latest SDK for GPT models
- **Anthropic Claude**: AI SDK integration
- **Azure OpenAI**: Enterprise AI services

#### UI Framework
- **Radix UI**: Comprehensive component library
- **Tailwind CSS**: Utility-first styling
- **Framer Motion**: Animation library
- **Lucide React**: Icon system

#### Payment Processing
- **Stripe**: Payment gateway integration
- **Razorpay**: Alternative payment processor
- **Cashfree**: Additional payment option

#### Communication Services
- **Twilio**: SMS and voice services
- **Plivo**: Alternative communication platform
- **Resend**: Email service
- **WebRTC**: Real-time communication

#### Document Processing
- **PDF**: jsPDF, pdf-parse for PDF operations
- **Excel**: xlsx for spreadsheet handling
- **Word**: mammoth for DOCX processing

#### Testing Framework
- **Jest**: Unit testing
- **Vitest**: Fast unit testing
- **Playwright**: End-to-end testing
- **Supertest**: API testing

## TypeScript Configuration (tsconfig.json)

### Compiler Options
- **Module System**: ESNext with bundler resolution
- **Strict Mode**: Enabled for type safety
- **Target Libraries**: ESNext, DOM, DOM.iterable
- **JSX**: Preserve mode for React
- **Import Extensions**: Allowed for TypeScript files

### Path Mapping
- `@/*`: Maps to `./client/src/*` (client-side code)
- `@shared/*`: Maps to `./shared/*` (shared types/schemas)
- `@db`: Maps to `./server/db.ts` (database connection)

### Include/Exclude Patterns
- **Included**: client/src, shared, server directories
- **Excluded**: node_modules, build, dist directories

## Vite Configuration (vite.config.ts)

### Plugin Architecture
- **React Plugin**: JSX/TSX transformation
- **Runtime Error Overlay**: Development error handling
- **Replit Integration**: Cartographer and dev banner (development only)

### Path Resolution
- **Client Alias (@)**: Points to client/src directory
- **Shared Alias (@shared)**: Points to shared directory  
- **Assets Alias (@assets)**: Points to attached_assets directory

### Build Configuration
- **Root Directory**: client/ (for frontend build)
- **Output Directory**: dist/public (for static assets)
- **Empty Output**: Cleans directory before build

### Development Server
- **File System**: Strict mode with hidden file denial
- **Security**: Prevents access to dotfiles

## Drizzle Configuration (drizzle.config.ts)

### Database Setup
- **Dialect**: PostgreSQL
- **Schema Location**: ./shared/schema.ts
- **Migrations Output**: ./migrations directory
- **Connection**: Uses DATABASE_URL environment variable

### Migration Strategy
- **Schema-driven**: Single source of truth in shared/schema.ts
- **Type-safe**: Full TypeScript integration
- **Automatic**: Drizzle-kit handles schema diff and migration generation

## Build Process Analysis

### Development Flow
1. **Server**: tsx starts TypeScript server with hot reload
2. **Client**: Vite dev server with React fast refresh
3. **Database**: Drizzle provides type-safe ORM
4. **Types**: Shared types ensure consistency

### Production Build
1. **Client Build**: Vite bundles React app to dist/public
2. **Server Build**: esbuild bundles Node.js server to dist/
3. **Assets**: Static files copied to public directory
4. **Deployment**: Single dist/ directory for production

## Security Considerations

### Development Security
- **Environment Variables**: Sensitive data in .env files
- **File Access**: Vite restricts access to system files
- **Type Safety**: TypeScript prevents runtime errors

### Production Security
- **Bundle Analysis**: esbuild optimizes and minifies code
- **External Packages**: Marked as external to reduce bundle size
- **ESM Format**: Modern module format for better tree-shaking

## Recommended Practices

### Development
1. Use `npm run check` before commits to verify TypeScript
2. Run `npm run db:push` after schema changes
3. Use proper path aliases (@, @shared) for imports
4. Follow ESM import/export patterns

### Production
1. Ensure DATABASE_URL is configured
2. Set NODE_ENV=production
3. Use `npm run build` for optimized builds
4. Monitor bundle size and dependencies

## Dependencies Overview

### Critical Dependencies (>50 packages)
- **UI Components**: 20+ Radix UI components
- **Development Tools**: TypeScript, Vite, esbuild
- **Database**: Drizzle ORM with PostgreSQL
- **AI Services**: OpenAI, Anthropic, Azure
- **Testing**: Jest, Vitest, Playwright suite
- **Utilities**: Date-fns, clsx, zod validation

### Optional Dependencies
- **bufferutil**: WebSocket performance optimization

This configuration supports a modern, type-safe, full-stack application with enterprise-grade features and development experience.