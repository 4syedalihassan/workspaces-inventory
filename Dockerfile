# Use Node.js LTS with full build tools
FROM node:20-bullseye-slim

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY src ./src
COPY public ./public

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Create non-root user for security
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/workspaces.db

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start the application
CMD ["node", "src/app.js"]
