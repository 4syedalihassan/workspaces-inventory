# Troubleshooting Guide

This guide helps you resolve common Docker and deployment issues with WorkSpaces Inventory.

---

## Docker Image Errors

### Error: 'ContainerConfig' or ImageNotFound

**Symptoms:**
```
ERROR: for workspaces-backend  'ContainerConfig'
ERROR: for workspaces-ai  'ContainerConfig'
docker.errors.ImageNotFound: 404 Client Error: No such image: sha256:...
```

**Cause:** Docker Compose is trying to recreate containers that reference images that no longer exist. This typically happens when:
- Images were manually deleted (`docker rmi`)
- System cleanup removed images (`docker system prune`)
- Switching between different compose files
- Docker's internal state became inconsistent

**Solution 1: Use the cleanup script (Recommended)**
```bash
# Run the interactive cleanup script
./cleanup-docker.sh

# Choose option 1 (Soft cleanup) to preserve data
# The script will:
# - Stop all containers
# - Remove orphaned containers
# - Remove old images
# - Optionally rebuild and start services
```

**Solution 2: Use the new start script**
```bash
# This script automatically detects and fixes missing images
./start-services.sh full    # For full deployment (recommended)
./start-services.sh lite    # For lite deployment (no AI)
./start-services.sh simple  # For simple deployment (single container)
```

**Solution 3: Manual cleanup and rebuild**
```bash
# Stop and remove everything (preserves volumes/data)
docker compose -f docker-compose.go.yml down

# Remove containers forcefully
docker rm -f workspaces-backend workspaces-frontend workspaces-ai 2>/dev/null || true

# Rebuild images and start
docker compose -f docker-compose.go.yml build --no-cache
docker compose -f docker-compose.go.yml up -d
```

**Solution 4: Nuclear option (removes ALL data)**
```bash
# WARNING: This deletes all Docker data including volumes
docker compose -f docker-compose.go.yml down -v --rmi all
docker compose -f docker-compose.go.yml build --no-cache
docker compose -f docker-compose.go.yml up -d
```

---

## Port Allocation Errors

### Error: Port is already allocated

**Symptoms:**
```
ERROR: for workspaces-backend  Cannot start service backend: 
Bind for 0.0.0.0:8080 failed: port is already allocated
```

**Cause:** Multiple scenarios:
- Containers from another compose file are running
- Previous containers weren't properly stopped
- Another application is using the same port

**Solution 1: Stop all workspaces containers**
```bash
# Stop all compose stacks
docker compose -f docker-compose.go.yml down
docker compose -f docker-compose.lite.yml down
docker compose -f docker-compose.yml down

# Start only the one you want
docker compose -f docker-compose.go.yml up -d
```

**Solution 2: Use the start script (prevents conflicts)**
```bash
# The script automatically detects and stops conflicting containers
./start-services.sh full
```

**Solution 3: Check what's using the port**
```bash
# Find what's using port 8080
sudo lsof -i :8080

# Or on Linux
sudo netstat -tlnp | grep 8080

# Stop the conflicting process or container
docker stop <container-name>
```

---

## Docker Compose Version Issues

### Error: Exception in thread (watch_events): KeyError: 'id'

**Symptoms:**
```
Exception in thread Thread-1 (watch_events):
KeyError: 'id'
```

**Cause:** This is a benign error in older docker-compose v1 versions. It does not affect functionality.

**Solution:** 
```bash
# Upgrade to Docker Compose v2 (recommended)
# On Ubuntu/Debian:
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Verify
docker compose version

# Use 'docker compose' instead of 'docker-compose'
docker compose -f docker-compose.go.yml up -d

# Or ignore the error - your services still work fine
curl http://localhost:8080/health  # Verify backend is healthy
```

---

## Build Failures

### Backend Build Fails

**Symptoms:**
```
ERROR: failed to solve: golang:1.21-alpine: not found
```

**Solution:**
```bash
# Pull base images first
docker pull golang:1.21-alpine
docker pull alpine:3.18
docker pull node:20-alpine

# Then rebuild
docker compose -f docker-compose.go.yml build --no-cache backend
```

### AI Service Build Fails (Model Download)

**Symptoms:**
```
ERROR: failed to download Phi-3 model
wget: unable to resolve host address
```

**Solution:**
```bash
# Check internet connectivity
ping huggingface.co

# Manual download and mount as volume
mkdir -p ./models
cd models
wget https://huggingface.co/cleatherbury/Phi-3-mini-128k-instruct-Q4_K_M-GGUF/resolve/main/phi-3-mini-128k-instruct.Q4_K_M.gguf

# Update docker-compose.go.yml to mount the model
# Add under ai-service volumes:
#   - ./models:/models:ro
```

---

## Container Health Check Failures

### Backend won't start

**Symptoms:**
```
workspaces-backend is unhealthy
```

**Solution:**
```bash
# Check logs
docker logs workspaces-backend

# Common issues:
# 1. PostgreSQL not ready
docker exec -it workspaces-backend pg_isready

# 2. Environment variables missing
docker exec -it workspaces-backend env | grep AWS

# 3. Database migration failed
docker exec -it workspaces-backend psql -U postgres -d workspaces -c "\dt"

# Restart services
docker compose -f docker-compose.go.yml restart backend
```

### AI Service timeout

**Symptoms:**
```
workspaces-ai health check timeout
```

**Solution:**
```bash
# AI service needs more memory and startup time
# Check current memory
docker stats workspaces-ai

# If using less than 8GB, update docker-compose.go.yml:
# deploy:
#   resources:
#     limits:
#       memory: 16G

# Or reduce model requirements
docker compose -f docker-compose.go.yml down
docker compose -f docker-compose.go.yml up -d

# Wait 60-90 seconds for model to load
docker logs -f workspaces-ai
```

---

## Data Loss Prevention

### I accidentally deleted my database

**Prevention:**
```bash
# Always use soft cleanup (option 1 in cleanup script)
./cleanup-docker.sh
# Choose: 1) Soft cleanup (preserve volumes/data)

# Or backup before cleanup
docker run --rm -v postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data

# Restore if needed
docker run --rm -v postgres-data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-backup.tar.gz -C /
```

**Manual volume backup:**
```bash
# List volumes
docker volume ls | grep workspaces

# Backup PostgreSQL data
docker run --rm -v postgres-data:/source -v $(pwd)/backups:/backup alpine sh -c "cd /source && tar czf /backup/postgres-$(date +%Y%m%d).tar.gz ."

# Backup Redis data  
docker run --rm -v redis-data:/source -v $(pwd)/backups:/backup alpine sh -c "cd /source && tar czf /backup/redis-$(date +%Y%m%d).tar.gz ."

# Restore
docker run --rm -v postgres-data:/target -v $(pwd)/backups:/backup alpine sh -c "cd /target && tar xzf /backup/postgres-YYYYMMDD.tar.gz"
```

---

## Network Issues

### Cannot reach backend from frontend

**Symptoms:**
```
Failed to fetch: http://localhost:8080/api/v1/workspaces
```

**Solution:**
```bash
# Check if backend is running and healthy
curl http://localhost:8080/health

# Check if containers are on same network
docker network inspect workspaces-network

# Restart services
docker compose -f docker-compose.go.yml restart
```

---

## Permission Issues

### Database permission denied

**Symptoms:**
```
ERROR: permission denied for table workspaces
```

**Solution:**
```bash
# Connect to PostgreSQL
docker exec -it workspaces-backend psql -U postgres -d workspaces

# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE workspaces TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
```

---

## Getting Help

If you're still experiencing issues:

1. **Check logs:**
   ```bash
   docker compose -f docker-compose.go.yml logs -f
   docker logs workspaces-backend --tail 100
   ```

2. **Check container status:**
   ```bash
   docker compose -f docker-compose.go.yml ps
   docker stats
   ```

3. **Clean slate approach:**
   ```bash
   # Complete cleanup (warning: deletes data)
   ./cleanup-docker.sh
   # Choose option 2: Hard cleanup
   
   # Then rebuild from scratch
   ./start-services.sh full
   ```

4. **Report issue:**
   - Include output of `docker compose logs`
   - Include output of `docker compose ps`
   - Include your compose file name
   - Include Docker version: `docker version`
   - Create issue at: https://github.com/4syedalihassan/workspaces-inventory/issues

---

## Quick Reference Commands

```bash
# Start services (recommended way)
./start-services.sh full

# Stop services
docker compose -f docker-compose.go.yml down

# View logs
docker compose -f docker-compose.go.yml logs -f

# Rebuild specific service
docker compose -f docker-compose.go.yml build --no-cache backend
docker compose -f docker-compose.go.yml up -d backend

# Clean up everything and rebuild
./cleanup-docker.sh  # Choose option 1

# Check health
curl http://localhost:8080/health
curl http://localhost:8081/health
curl http://localhost:3001/

# Access database
docker exec -it workspaces-backend psql -U postgres -d workspaces

# Access Redis
docker exec -it workspaces-backend redis-cli
```
