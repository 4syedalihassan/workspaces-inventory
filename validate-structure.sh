#!/bin/bash
# Validation script for three-tier architecture

echo "================================"
echo "Architecture Validation Script"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        return 0
    else
        echo -e "${RED}✗${NC} $1"
        return 1
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1/"
        return 0
    else
        echo -e "${RED}✗${NC} $1/"
        return 1
    fi
}

echo "=== Web Tier ==="
check_dir "web-tier"
check_dir "web-tier/frontend"
check_file "web-tier/frontend/package.json"
check_file "web-tier/frontend/vite.config.js"
check_file "web-tier/frontend/tailwind.config.js"
check_file "web-tier/frontend/Dockerfile"
check_file "web-tier/frontend/src/App.jsx"
check_file "web-tier/frontend/src/main.jsx"
check_file "web-tier/nginx/nginx.conf"
check_file "web-tier/docker-compose.yml"
echo ""

echo "=== Application Tier ==="
check_dir "app-tier"
check_dir "app-tier/backend"
check_file "app-tier/backend/requirements.txt"
check_file "app-tier/backend/Dockerfile"
check_file "app-tier/backend/app/main.py"
check_file "app-tier/backend/app/core/config.py"
check_file "app-tier/backend/app/core/security.py"
check_file "app-tier/backend/app/models/models.py"
check_file "app-tier/backend/app/api/auth.py"
check_file "app-tier/backend/app/api/workspaces.py"
check_file "app-tier/backend/app/api/ai.py"
check_file "app-tier/backend/alembic.ini"
check_file "app-tier/docker-compose.yml"
echo ""

echo "=== AI Tier ==="
check_dir "ai-tier"
check_dir "ai-tier/phi3-service"
check_file "ai-tier/phi3-service/CMakeLists.txt"
check_file "ai-tier/phi3-service/Dockerfile"
check_file "ai-tier/phi3-service/src/server.cpp"
check_file "ai-tier/docker-compose.yml"
echo ""

echo "=== Root Level ==="
check_file "docker-compose.full.yml"
check_file ".env.example"
check_file "ARCHITECTURE.md"
check_file "DEPLOYMENT.md"
check_file "README_V2.md"
echo ""

echo "================================"
echo "Validation Complete"
echo "================================"
