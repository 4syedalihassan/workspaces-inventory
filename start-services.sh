#!/bin/bash

# Startup script for WorkSpaces Inventory
# This script safely starts services and prevents common Docker image issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}WorkSpaces Inventory - Start Services${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to print colored messages
print_warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Detect docker-compose version (v1 vs v2)
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
    print_info "Using Docker Compose v2"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
    print_info "Using Docker Compose v1"
else
    print_error "Docker Compose is not installed!"
    exit 1
fi

# Check which compose file to use
if [ -n "$1" ]; then
    case "$1" in
        simple|single)
            COMPOSE_FILE="docker-compose.yml"
            print_info "Using simple single-container deployment"
            ;;
        lite)
            COMPOSE_FILE="docker-compose.lite.yml"
            print_info "Using lite deployment (no AI service)"
            ;;
        full|go)
            COMPOSE_FILE="docker-compose.go.yml"
            print_info "Using full deployment (all 3 containers)"
            ;;
        *)
            print_error "Invalid option: $1"
            echo "Usage: ./start-services.sh [simple|lite|full]"
            echo "  simple - Single container (Node.js + SQLite)"
            echo "  lite   - Two containers (Go backend + frontend, no AI)"
            echo "  full   - Three containers (Full featured, RECOMMENDED)"
            exit 1
            ;;
    esac
else
    # Default to full deployment
    COMPOSE_FILE="docker-compose.go.yml"
    print_info "Using default: full deployment (all 3 containers)"
    echo "  To change: ./start-services.sh [simple|lite|full]"
fi

echo ""

# Check if containers are already running
RUNNING_CONTAINERS=$($DOCKER_COMPOSE -f "$COMPOSE_FILE" ps -q 2>/dev/null | wc -l)

if [ "$RUNNING_CONTAINERS" -gt 0 ]; then
    print_warning "Some containers are already running!"
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps
    echo ""
    read -p "Stop and rebuild? [y/N]: " rebuild
    if [[ ! $rebuild =~ ^[Yy]$ ]]; then
        print_info "Keeping existing containers. Exiting."
        exit 0
    fi
    
    print_info "Stopping existing containers..."
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" down
    print_success "Containers stopped"
    echo ""
fi

# Auto-clean: Remove old containers and images before building
print_info "Performing auto-clean to prevent build issues..."

# Remove any stopped workspaces containers
print_info "Removing stopped containers..."
STOPPED_CONTAINERS=$(docker ps -a --filter "name=workspaces-" --filter "status=exited" -q)
if [ -n "$STOPPED_CONTAINERS" ]; then
    echo "$STOPPED_CONTAINERS" | xargs docker rm 2>/dev/null || true
    print_success "Removed stopped containers"
else
    print_info "No stopped containers to remove"
fi

# Remove old/dangling images to free space and prevent conflicts
print_info "Removing dangling images..."
DANGLING_IMAGES=$(docker images -f "dangling=true" -q)
if [ -n "$DANGLING_IMAGES" ]; then
    echo "$DANGLING_IMAGES" | xargs docker rmi -f 2>/dev/null || true
    print_success "Removed dangling images"
else
    print_info "No dangling images to remove"
fi

print_success "Auto-clean complete"
echo ""

# Check for orphaned containers from other compose files
print_info "Checking for containers from other compose files..."
docker ps -a --filter "name=workspaces-" --format "{{.Names}} ({{.Status}})" | while read -r container; do
    if [ -n "$container" ]; then
        print_warning "Found: $container"
    fi
done

# Ask if we should clean up orphans
ORPHAN_COUNT=$(docker ps -a --filter "name=workspaces-" -q | wc -l)
if [ "$ORPHAN_COUNT" -gt "$RUNNING_CONTAINERS" ] && [ "$ORPHAN_COUNT" -gt 0 ]; then
    echo ""
    print_warning "Found $ORPHAN_COUNT containers from other deployments"
    read -p "Clean up all workspaces containers before starting? [y/N]: " cleanup
    if [[ $cleanup =~ ^[Yy]$ ]]; then
        print_info "Stopping all workspaces containers..."
        CONTAINERS_TO_STOP=$(docker ps -a --filter "name=workspaces-" -q)
        if [ -n "$CONTAINERS_TO_STOP" ]; then
            echo "$CONTAINERS_TO_STOP" | xargs docker stop 2>/dev/null
            echo "$CONTAINERS_TO_STOP" | xargs docker rm 2>/dev/null
            print_success "Cleanup complete"
        fi
    fi
    echo ""
fi

# Check if images exist for this compose file
print_info "Checking if Docker images need to be built..."
IMAGES_NEEDED=$($DOCKER_COMPOSE -f "$COMPOSE_FILE" config --images 2>/dev/null || echo "")
MISSING_IMAGES=0

# Known external/official Docker images that we should not try to check
EXTERNAL_IMAGES=(
    "postgres" "redis" "nginx" "node" "golang" "ubuntu" "alpine"
    "mysql" "mariadb" "mongo" "python" "java" "openjdk" "php"
    "debian" "centos" "fedora" "busybox"
)

if [ -n "$IMAGES_NEEDED" ]; then
    while IFS= read -r image; do
        # Skip empty lines
        [ -z "$image" ] && continue
        
        # Check if this is an external image
        IS_EXTERNAL=false
        
        # Check for registry domain (e.g., docker.io/, gcr.io/, quay.io/)
        if [[ $image =~ ^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ ]]; then
            IS_EXTERNAL=true
        else
            # Check if it matches known official images
            for official in "${EXTERNAL_IMAGES[@]}"; do
                if [[ $image =~ ^${official}: ]]; then
                    IS_EXTERNAL=true
                    break
                fi
            done
        fi
        
        # Only check locally built images
        if [ "$IS_EXTERNAL" = false ]; then
            # This is a locally built image, check if it exists
            if ! docker image inspect "$image" &> /dev/null; then
                print_warning "Image not found: $image"
                MISSING_IMAGES=$((MISSING_IMAGES + 1))
            fi
        fi
    done <<< "$IMAGES_NEEDED"
fi

if [ "$MISSING_IMAGES" -gt 0 ]; then
    print_warning "Some images are missing and will be built from scratch"
else
    print_info "Images will be rebuilt to ensure they are up to date"
fi

echo ""
print_info "Starting services with $COMPOSE_FILE..."
echo ""

# Always rebuild images to ensure they're up to date
print_info "Building images (this may take several minutes)..."

# Determine build strategy
if [ "$MISSING_IMAGES" -gt 0 ]; then
    # Missing images require full rebuild from scratch
    print_warning "Missing images detected - using clean build (--no-cache)"
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" build --no-cache
else
    # For updates, use incremental build for speed
    print_info "Using incremental build for faster compilation"
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" build
fi
echo ""

print_info "Starting containers..."
$DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d --remove-orphans

echo ""
print_success "Services started successfully!"
echo ""

# Wait a few seconds for containers to initialize
sleep 3

# Show status
print_info "Container status:"
$DOCKER_COMPOSE -f "$COMPOSE_FILE" ps

echo ""
print_success "Access the application at:"
if [ "$COMPOSE_FILE" = "docker-compose.yml" ]; then
    echo "  Application: http://localhost:3001"
elif [ "$COMPOSE_FILE" = "docker-compose.lite.yml" ]; then
    echo "  Frontend: http://localhost:3002"
    echo "  Backend:  http://localhost:8082"
else
    echo "  Frontend: http://localhost:3001"
    echo "  Backend:  http://localhost:8080"
    echo "  AI Service: http://localhost:8081"
fi

echo ""
print_info "Useful commands:"
echo "  View logs:      $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f"
echo "  Stop services:  $DOCKER_COMPOSE -f $COMPOSE_FILE down"
echo "  Restart:        $DOCKER_COMPOSE -f $COMPOSE_FILE restart"

echo ""
print_success "Done! Check logs if services don't respond within 60 seconds."
echo ""
print_info "Note: If you see 'KeyError: id' in docker-compose logs, it's benign."
echo "      This is a known issue in older docker-compose versions."
echo "      Your services are working fine. See TROUBLESHOOTING.md for details."
