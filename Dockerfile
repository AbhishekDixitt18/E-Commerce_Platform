# =============================================================================
# Production Multi-Stage Dockerfile for E-Commerce Platform
# Stage 1: Build React Frontend Static Assets
# Stage 2: Install Backend Production Dependencies
# Stage 3: Production Runtime (Node.js API + Static Assets)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Frontend Build
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Backend Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS dependencies

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# -----------------------------------------------------------------------------
# Stage 3: Production Runtime
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runtime

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000

# Install dumb-init for proper PID 1 signal handling and zombie reaping
RUN apk add --no-cache dumb-init

# Copy production node_modules from dependencies stage
COPY --from=dependencies /usr/src/app/node_modules ./node_modules

# Copy compiled production frontend assets
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

COPY package*.json ./
COPY src/ ./src/
COPY database/ ./database/
COPY scripts/ ./scripts/

# Ensure application files are owned by the unprivileged 'node' user
RUN chown -R node:node /usr/src/app

# Enforce least privilege: run container as non-root user
USER node

# Expose internal container port
EXPOSE 3000

# Container liveness health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); \
    const req = http.request({ host: '127.0.0.1', port: process.env.PORT || 3000, path: '/health', timeout: 3000 }, (res) => { \
      process.exit(res.statusCode === 200 ? 0 : 1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.end();"

# Wrap execution with dumb-init for graceful shutdown signal propagation (SIGTERM/SIGINT)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/server.js"]
