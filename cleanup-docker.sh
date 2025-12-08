#!/bin/bash

# Docker Cleanup Script for WorkSpaces Inventory
# This script helps resolve common Docker issues related to missing images and corrupted state

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}WorkSpaces Inventory - Docker Cleanup${NC}"
echo -e "${GREEN}========================================${NC}"
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
    echo -e "$1"
}

# Check if user wants to preserve data
echo -e "${YELLOW}This script will clean up Docker containers and images.${NC}"
echo ""
echo "Choose cleanup level:"
echo "1) Soft cleanup (preserve volumes/data) - RECOMMENDED"
echo "2) Hard cleanup (remove everything including data)"
echo "3) Nuclear cleanup (remove ALL Docker resources - affects other projects too)"
echo ""
read -p "Enter choice [1-3]: " cleanup_choice

case $cleanup_choice in
    1)
        print_info "Performing soft cleanup (preserving data)..."
        PRESERVE_VOLUMES=true
        ;;
    2)
        print_warning "Hard cleanup will delete all database data!"
        read -p "Are you sure? Type 'yes' to continue: " confirm
        if [ "$confirm" != "yes" ]; then
            echo "Aborted."
            exit 1
        fi
        PRESERVE_VOLUMES=false
        ;;
    3)
        print_warning "Nuclear cleanup will affect ALL Docker projects on this system!"
        read -p "Are you absolutely sure? Type 'DELETE EVERYTHING' to continue: " confirm
        if [ "$confirm" != "DELETE EVERYTHING" ]; then
            echo "Aborted."
            exit 1
        fi
        NUCLEAR=true
        ;;
    *)
        print_error "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
print_info "Starting cleanup process..."
echo ""

if [ "$NUCLEAR" = true ]; then
    # Nuclear option - remove everything
    print_warning "Stopping ALL Docker containers..."
    docker stop $(docker ps -aq) 2>/dev/null || true
    
    print_warning "Removing ALL Docker containers..."
    docker rm -f $(docker ps -aq) 2>/dev/null || true
    
    print_warning "Removing ALL Docker images, networks, and volumes..."
    docker system prune -af --volumes
    
    print_success "Nuclear cleanup complete!"
else
    # Targeted cleanup for this project
    print_info "Stopping docker-compose services..."
    docker-compose -f docker-compose.go.yml down 2>/dev/null || true
    docker-compose -f docker-compose.lite.yml down 2>/dev/null || true
    docker-compose -f docker-compose.yml down 2>/dev/null || true
    
    print_info "Force removing project containers..."
    docker rm -f workspaces-backend workspaces-frontend workspaces-ai 2>/dev/null || true
    docker rm -f workspaces-backend-lite workspaces-frontend-lite 2>/dev/null || true
    docker rm -f workspaces-inventory 2>/dev/null || true
    print_success "Containers removed"
    
    print_info "Removing project networks..."
    docker network rm workspaces-network 2>/dev/null || true
    print_success "Networks removed"
    
    if [ "$PRESERVE_VOLUMES" = false ]; then
        print_info "Removing project volumes (data will be lost)..."
        docker volume rm postgres-data redis-data workspaces-data 2>/dev/null || true
        print_success "Volumes removed"
    else
        print_success "Volumes preserved (data intact)"
    fi
    
    print_info "Removing project images..."
    # Remove images with workspaces in the name
    docker images --format "{{.Repository}}:{{.Tag}}" | grep workspaces | xargs -r docker rmi -f 2>/dev/null || true
    # Remove images from the project directories
    docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "backend|frontend|ai-service" | grep -v postgres | xargs -r docker rmi -f 2>/dev/null || true
    print_success "Images removed"
    
    print_info "Cleaning Docker builder cache..."
    docker builder prune -f
    print_success "Builder cache cleaned"
fi

echo ""
print_success "Cleanup complete!"
echo ""

# Ask if user wants to rebuild
read -p "Do you want to rebuild and start the services now? [y/N]: " rebuild
if [[ $rebuild =~ ^[Yy]$ ]]; then
    echo ""
    print_info "Building images (this may take several minutes)..."
    docker-compose -f docker-compose.go.yml build --no-cache
    
    print_info "Starting services..."
    docker-compose -f docker-compose.go.yml up -d
    
    echo ""
    print_success "Services started! Checking status..."
    echo ""
    docker-compose -f docker-compose.go.yml ps
    
    echo ""
    print_info "Access the application at:"
    echo "  Frontend: http://localhost:3001"
    echo "  Backend:  http://localhost:8080"
    echo "  AI Service: http://localhost:8081"
    echo ""
    print_info "View logs with: docker-compose -f docker-compose.go.yml logs -f"
else
    echo ""
    print_info "To rebuild and start services manually, run:"
    echo "  docker-compose -f docker-compose.go.yml build --no-cache"
    echo "  docker-compose -f docker-compose.go.yml up -d"
fi

echo ""
print_success "Done!"
