# Multi-stage Dockerfile for MEDRecords frontend.
#
# Stage 1: Build the application using Node.js
# Stage 2: Serve the built assets via Alpine nginx
#
# Final image target: ≤ 150MB uncompressed.
#
# Requirements: 11.1, 11.2, 11.8

# ---------------------------------------------------------------------------
# Stage 1: Build
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install dependencies using locked lockfile (Requirement 9.5)
RUN npm ci --frozen-lockfile

# Copy source code
COPY . .

# Build the production bundle
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Production serve with Alpine nginx
# ---------------------------------------------------------------------------
FROM nginx:alpine AS production

# Remove default nginx config
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check for container orchestration (Requirement 11.2)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# Start nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
