# Dockerfile for Accute - Railway Deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 make g++ openssl libc6-compat

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --prefer-offline

# Copy source code and configuration files
COPY . .

# Generate migrations
RUN npm run db:generate || echo "Migration generation failed, continuing..."

# Build the application
ENV NODE_ENV=production
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies for native modules and database tools
RUN apk add --no-cache openssl libc6-compat

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
