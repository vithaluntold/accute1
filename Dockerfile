# Dockerfile for Accute - Railway Deployment (Optimized for Speed)
# Build timestamp: 2025-11-29T12:45:00Z
# Stage 1: Builder - Compile TypeScript to JavaScript
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies (cached layer - rarely changes)
RUN apk add --no-cache python3 make g++ openssl libc6-compat

# Copy ONLY package files first (maximize cache hits)
COPY package.json package-lock.json ./

# Install ALL dependencies including devDependencies (needed for build)
RUN npm ci --prefer-offline --no-audit --progress=false && \
    npm cache clean --force

# Copy source code (only invalidates cache if code changes)
COPY . .

# Build application - ensure fresh compilation
ENV NODE_ENV=production
RUN rm -rf dist/ && \
    npm run build && \
    echo "Build completed at $(date)" && \
    ls -la dist/ && \
    echo "✅ Build verification: dist/start.js exists" && \
    test -f dist/start.js

# Stage 2: Production - Minimal runtime image
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies for native modules and database tools
# python3, make, g++ required for bcrypt native module
RUN apk add --no-cache openssl libc6-compat python3 make g++ && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY --from=builder /app/package*.json ./

# Copy node_modules (includes production dependencies)
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled application (CRITICAL: Fresh build from builder stage)
COPY --from=builder /app/dist ./dist

# Copy database configuration and migrations
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/server/enable-extensions.ts ./server/

# Copy agents directory (required for Agent Registry at runtime)
COPY --from=builder /app/agents ./agents

# Copy public assets
COPY --from=builder /app/public ./public

# Copy startup script
COPY --from=builder /app/start-production.sh ./
RUN chmod +x start-production.sh

# Create uploads directory with correct permissions
RUN mkdir -p uploads && \
    chown -R nodejs:nodejs /app

# Set production environment
ENV NODE_ENV=production
ENV CI=true

# Switch to non-root user for security
USER nodejs

# Expose the port (Railway sets PORT dynamically)
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start with migration then server
CMD ["./start-production.sh"]
