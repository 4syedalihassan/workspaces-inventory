# Docker Image Error Prevention

## Understanding the ContainerConfig Error

### What Happened?

The error message:
```
ERROR: for workspaces-backend  'ContainerConfig'
docker.errors.ImageNotFound: 404 Client Error: No such image: sha256:...
```

This occurs when Docker Compose tries to recreate containers that reference images that no longer exist on your system.

### Root Cause

Docker maintains three separate states:
1. **Images** - The built application templates
2. **Containers** - Running instances of images
3. **Compose State** - Docker Compose's record of what should be running

When images are deleted (manually or via `docker system prune`), but containers or compose state still exist, Docker Compose gets confused trying to recreate containers from non-existent images.

### Why It Happens

Common scenarios:
- Running `docker system prune` or `docker image prune` while containers exist
- Switching between different `docker-compose.yml` files
- Manual deletion of images with `docker rmi`
- Docker daemon restart/crash with incomplete cleanup
- Running out of disk space, triggering automatic cleanup

### Prevention

**Use the provided scripts (Recommended):**

The `start-services.sh` script now includes **automatic cleanup** before building:

```bash
# Always use start-services.sh to start (now with auto-clean)
./start-services.sh full
```

**What auto-clean does:**
- Removes stopped workspaces containers
- Removes dangling Docker images
- Ensures clean state before building
- Prevents ContainerConfig errors automatically

**Alternative: Manual cleanup:**

```bash
# Use cleanup-docker.sh before manual operations
./cleanup-docker.sh
```

**Manual prevention:**

```bash
# Always stop containers before removing images
docker compose -f docker-compose.go.yml down

# If removing images, remove everything together
docker compose -f docker-compose.go.yml down --rmi all

# When restarting, always use --build flag if unsure
docker compose -f docker-compose.go.yml up --build -d
```

### Quick Fix

If you encounter this error:

1. **Easiest (Automated):**
   ```bash
   ./start-services.sh full
   ```

2. **Safe Cleanup (Preserves Data):**
   ```bash
   ./cleanup-docker.sh
   # Choose option 1: Soft cleanup
   ```

3. **Manual Fix:**
   ```bash
   # Stop everything
   docker compose -f docker-compose.go.yml down
   
   # Remove orphaned containers
   ORPHANED=$(docker ps -a --filter "name=workspaces-" -q)
   if [ -n "$ORPHANED" ]; then
       echo "$ORPHANED" | xargs docker rm -f 2>/dev/null || true
   fi
   
   # Rebuild and start fresh
   docker compose -f docker-compose.go.yml build --no-cache
   docker compose -f docker-compose.go.yml up -d
   ```

### Best Practices

1. **Use the wrapper scripts** - They handle edge cases automatically
2. **One compose file at a time** - Don't run multiple compose files simultaneously
3. **Clean before switching** - Run `docker compose down` before switching compose files
4. **Preserve volumes** - Use soft cleanup to keep your data
5. **Build explicitly** - Use `--build` flag when unsure about image state

### Technical Details

The ContainerConfig error specifically occurs in Docker Compose's `merge_volume_bindings()` function when it tries to:
1. Get container data from stopped containers
2. Inspect the image the container was based on
3. Access the image config to merge volume settings

When the image doesn't exist, step 2 fails with a 404 error, and Docker Compose crashes instead of gracefully rebuilding.

Our scripts prevent this by:
- Detecting missing images before starting
- Forcing rebuild when images are missing
- Cleaning up orphaned containers automatically
- Using `--remove-orphans` flag to handle conflicts

### Related Issues

This fix also resolves related problems:
- Port allocation errors (conflicting containers)
- Volume mount errors (inconsistent state)
- Network errors (orphaned networks)
- Container recreation loops

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more details.
