# Dockerfile for Accute - Railway Deployment
# Clean rebuild: 2025-11-29T16:00:00Z
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ openssl libc6-compat

# Copy package files first (layer caching for dependencies)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --prefer-offline

# Copy source code (.dockerignore excludes dist/ and node_modules/)
COPY . .

# Build application (creates fresh dist/ from TypeScript)
ENV NODE_ENV=production
RUN npm run build

# Verify build output
RUN ls -la dist/ && echo "Build completed successfully"

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies for native modules and database tools
# Added python3, make, g++ for bcrypt to work properly in production
RUN apk add --no-cache openssl libc6-compat python3 make g++

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy database configuration and schema (required for migrations)
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/server/enable-extensions.ts ./server/

# Copy agents directory (required for Agent Registry at runtime)
COPY --from=builder /app/agents ./agents

# Copy public assets
COPY --from=builder /app/public ./public

# Copy uploads directory structure
RUN mkdir -p uploads

# Copy startup script
COPY --from=builder /app/start-production.sh ./
RUN chmod +x start-production.sh

# Set production environment
ENV NODE_ENV=production
ENV CI=true

# Expose the port (Railway sets PORT dynamically)
EXPOSE 5000

# Start with migration then server
CMD ["./start-production.sh"]
