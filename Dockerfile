# Dockerfile for Accute - Railway Deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++ openssl

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

# Install openssl for bcrypt and other native modules
RUN apk add --no-cache openssl

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "run", "start"]
