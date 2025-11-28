# Dockerfile for Accute - Railway Deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 make g++ openssl libc6-compat

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --prefer-offline

# Copy source code
COPY . .

# Build the application
ENV NODE_ENV=production
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies for native modules
# libc6-compat is needed for bcrypt and other native modules on Alpine
RUN apk add --no-cache openssl libc6-compat

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy database configuration and schema (required for migrations)
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/shared ./shared

# Copy agents directory (required for Agent Registry at runtime)
COPY --from=builder /app/agents ./agents

# Copy public assets
COPY --from=builder /app/public ./public

# Copy uploads directory structure
RUN mkdir -p uploads

# Set production environment
# NOTE: PORT is set by Railway dynamically - do not hardcode
ENV NODE_ENV=production

# Expose the port (Railway sets PORT dynamically)
EXPOSE 5000

# Start the application
CMD ["node", "dist/start.js"]
