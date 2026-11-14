# =============================================================================
# Production Dockerfile for E-Commerce Platform REST API
# Multi-stage build for optimal image size and minimal attack surface
# =============================================================================

# Stage 1: Build & Dependencies
FROM node:20-alpine AS dependencies
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

# Copy full application for build / testing if required
COPY . .

# Stage 2: Production Runtime
FROM node:20-alpine AS runtime
WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000

# Install dumb-init for proper PID 1 signal forwarding
RUN apk add --no-cache dumb-init

# Copy package manifests and production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application source code and database scripts
COPY src/ ./src/
COPY database/ ./database/
COPY scripts/ ./scripts/

# Enforce least privilege: run container as unprivileged 'node' user
USER node

# Expose internal service port
EXPOSE 3000

# Container liveness health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); \
    const req = http.request({ host: '127.0.0.1', port: process.env.PORT || 3000, path: '/health', timeout: 3000 }, (res) => { \
      process.exit(res.statusCode === 200 ? 0 : 1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.end();"

# Start application wrapped in dumb-init
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/server.js"]

