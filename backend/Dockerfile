# Container 2: Backend + PostgreSQL + Redis
# Multi-stage build for Go backend

# Stage 1: Build Go application
FROM golang:1.21-alpine AS go-builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy source code first
COPY . .

# Add missing dependencies and generate go.sum
RUN go mod tidy

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Stage 2: Runtime environment with PostgreSQL and Redis
FROM alpine:3.18

# Install PostgreSQL, Redis, and supervisord
RUN apk add --no-cache \
    postgresql15 \
    postgresql15-client \
    postgresql15-contrib \
    redis \
    supervisor \
    ca-certificates \
    tzdata \
    bash

# Create necessary directories and users
RUN mkdir -p /var/lib/postgresql/data \
    /var/log/postgresql \
    /var/log/redis \
    /var/log/supervisor \
    /var/lib/redis \
    /app && \
    chown -R redis:redis /var/log/redis /var/lib/redis

# Initialize PostgreSQL
RUN mkdir -p /run/postgresql && \
    chown -R postgres:postgres /run/postgresql /var/lib/postgresql /var/log/postgresql

# Switch to postgres user to initialize database
USER postgres
RUN initdb -D /var/lib/postgresql/data && \
    echo "host all all 0.0.0.0/0 md5" >> /var/lib/postgresql/data/pg_hba.conf && \
    echo "listen_addresses='*'" >> /var/lib/postgresql/data/postgresql.conf && \
    echo "max_connections=100" >> /var/lib/postgresql/data/postgresql.conf && \
    echo "shared_buffers=256MB" >> /var/lib/postgresql/data/postgresql.conf

# Switch back to root
USER root

# Copy Go binary from builder
COPY --from=go-builder /app/main /app/main

# Copy supervisord configuration
COPY supervisord.conf /etc/supervisord.conf

# Copy initialization script
COPY init-db.sh /docker-entrypoint-initdb.d/init-db.sh
RUN chmod +x /docker-entrypoint-initdb.d/init-db.sh

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
