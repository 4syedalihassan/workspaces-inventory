# Deployment Guide

Complete guide for deploying AWS WorkSpaces Inventory locally and to AWS Lightsail.

---

## Table of Contents

1. [Local Development](#local-development)
2. [AWS Lightsail Deployment](#aws-lightsail-deployment)
3. [Production Checklist](#production-checklist)
4. [Monitoring & Logging](#monitoring--logging)
5. [Backup & Disaster Recovery](#backup--disaster-recovery)
6. [Scaling & Migration](#scaling--migration)

---

## Local Development

### Prerequisites

- **Docker Desktop** 4.0+ (or Docker Engine 20.10+)
- **Docker Compose** 2.0+
- **Git** 2.30+
- **AWS Account** with IAM credentials
- **8GB RAM minimum** (16GB recommended for AI service)

### Step 1: Clone Repository

```bash
git clone https://github.com/4syedalihassan/workspaces-inventory.git
cd workspaces-inventory
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.go.example .env

# Edit with your favorite editor
nano .env  # or vim, code, etc.
```

**Required Configuration:**

```env
# AWS Credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...YOUR_KEY_HERE
AWS_SECRET_ACCESS_KEY=abc123...YOUR_SECRET_HERE

# JWT Secret (generate strong random string)
JWT_SECRET=$(openssl rand -base64 32)

# Database (use defaults for local)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/workspaces?sslmode=disable
REDIS_URL=redis://localhost:6379/0

# Backend
PORT=8080
ENVIRONMENT=development

# AI Service
AI_SERVICE_URL=http://ai-service:8081
```

### Step 3: Build and Start Containers

```bash
# Build all containers (first time only)
docker-compose -f docker-compose.go.yml build

# Start all services
docker-compose -f docker-compose.go.yml up -d

# View logs
docker-compose -f docker-compose.go.yml logs -f

# Check status
docker-compose -f docker-compose.go.yml ps
```

**Expected Output:**

```
NAME                  STATUS    PORTS
workspaces-backend    Up        0.0.0.0:8080->8080/tcp
workspaces-frontend   Up        0.0.0.0:3001->80/tcp
workspaces-ai         Up        0.0.0.0:8081->8081/tcp
```

### Step 4: Verify Deployment

**Backend Health Check:**
```bash
curl http://localhost:8080/health
# Expected: {"status":"healthy"}
```

**AI Service Health Check:**
```bash
curl http://localhost:8081/health
# Expected: {"status":"healthy","model":"/models/Phi-3-mini-128k-instruct-Q4_K_M.gguf"}
```

**Frontend Access:**
```bash
# Open in browser
open http://localhost:3001
```

### Step 5: Login and Test

**Default Credentials:**
- Username: `admin`
- Password: `admin123`

**First Steps:**
1. Login with default credentials
2. Navigate to Dashboard
3. Click "Sync Now" to fetch AWS data
4. Verify workspaces appear in inventory

### Step 6: Development Workflow

**Backend Development (Go):**

```bash
# Stop backend container
docker-compose -f docker-compose.go.yml stop backend

# Run backend locally with hot reload
cd backend
go run main.go

# Run tests
go test ./... -v

# Rebuild after changes
cd ..
docker-compose -f docker-compose.go.yml up -d --build backend
```

**Frontend Development:**

```bash
# Frontend files are in /public
# Edit public/index.html or public/app.js

# Rebuild frontend container
docker-compose -f docker-compose.go.yml up -d --build frontend
```

**View Logs:**

```bash
# All containers
docker-compose -f docker-compose.go.yml logs -f

# Specific container
docker-compose -f docker-compose.go.yml logs -f backend

# Last 100 lines
docker-compose -f docker-compose.go.yml logs --tail=100 backend
```

### Step 7: Database Management

**Access PostgreSQL:**

```bash
# Connect to PostgreSQL
docker exec -it workspaces-backend psql -U postgres -d workspaces

# List tables
\dt

# View schema
\d workspaces

# Query data
SELECT workspace_id, user_name, state FROM workspaces LIMIT 10;

# Exit
\q
```

**Access Redis:**

```bash
# Connect to Redis
docker exec -it workspaces-backend redis-cli

# Check keys
KEYS *

# Get value
GET some_key

# Exit
exit
```

### Step 8: Stopping Services

```bash
# Stop all containers
docker-compose -f docker-compose.go.yml down

# Stop and remove volumes (WARNING: deletes data)
docker-compose -f docker-compose.go.yml down -v

# Remove images
docker-compose -f docker-compose.go.yml down --rmi all
```

---

## AWS Lightsail Deployment

### Prerequisites

- **AWS Account** with billing enabled
- **AWS CLI** 2.0+ installed and configured
- **Lightsail permissions** in IAM
- **Domain name** (optional but recommended)
- **Budget**: ~$242/month

### Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  AWS Lightsail                                  │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  Load Balancer ($18/month)              │   │
│  │  - SSL Certificate (free)               │   │
│  │  - HTTP → HTTPS redirect                │   │
│  └─────────────────────────────────────────┘   │
│          ↓                                      │
│  ┌─────────────────────────────────────────┐   │
│  │  Frontend Container ($7/month)          │   │
│  │  - 512MB RAM, 0.25 vCPU                 │   │
│  │  - Nginx + React SPA                    │   │
│  └─────────────────────────────────────────┘   │
│          ↓                                      │
│  ┌─────────────────────────────────────────┐   │
│  │  Backend Container ($40/month)          │   │
│  │  - 8GB RAM, 2 vCPU                      │   │
│  │  - Go + PostgreSQL + Redis              │   │
│  └─────────────────────────────────────────┘   │
│          ↓                                      │
│  ┌─────────────────────────────────────────┐   │
│  │  AI Container ($160/month)              │   │
│  │  - 16GB RAM, 4 vCPU                     │   │
│  │  - llama.cpp + Phi-3                    │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Step 1: Install AWS CLI and Lightsail Plugin

```bash
# Install AWS CLI (macOS)
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Verify installation
aws --version

# Configure AWS credentials
aws configure
# Enter Access Key ID, Secret Key, Region (us-east-1), Output format (json)

# Install Lightsail plugin
aws lightsail help
```

### Step 2: Create Container Services

```bash
# Frontend container (Micro - 512MB RAM)
aws lightsail create-container-service \
  --service-name workspaces-frontend \
  --power micro \
  --scale 1 \
  --region us-east-1

# Backend container (Large - 8GB RAM)
aws lightsail create-container-service \
  --service-name workspaces-backend \
  --power large \
  --scale 1 \
  --region us-east-1

# AI container (XXLarge - 16GB RAM)
aws lightsail create-container-service \
  --service-name workspaces-ai \
  --power xxlarge \
  --scale 1 \
  --region us-east-1

# Check status
aws lightsail get-container-services
```

**Wait for services to be "READY" (takes 5-10 minutes):**

```bash
# Check status periodically
watch -n 30 'aws lightsail get-container-services --query "containerServices[*].[serviceName,state]" --output table'
```

### Step 3: Build Docker Images

```bash
# Frontend
cd frontend-container
docker build -t workspaces-frontend:latest .

# Backend
cd ../backend
docker build -t workspaces-backend:latest .

# AI Service
cd ../ai-service
docker build -t workspaces-ai:latest .

# Return to root
cd ..
```

### Step 4: Push Images to Lightsail

```bash
# Push frontend
aws lightsail push-container-image \
  --service-name workspaces-frontend \
  --label workspaces-frontend \
  --image workspaces-frontend:latest \
  --region us-east-1

# Push backend
aws lightsail push-container-image \
  --service-name workspaces-backend \
  --label workspaces-backend \
  --image workspaces-backend:latest \
  --region us-east-1

# Push AI service
aws lightsail push-container-image \
  --service-name workspaces-ai \
  --label workspaces-ai \
  --image workspaces-ai:latest \
  --region us-east-1
```

**Note the image tags** returned (e.g., `:workspaces-frontend.1`)

### Step 5: Create Deployment Configuration

**Create `frontend-deployment.json`:**

```json
{
  "containers": {
    "frontend": {
      "image": ":workspaces-frontend.1",
      "ports": {
        "80": "HTTP"
      },
      "environment": {}
    }
  },
  "publicEndpoint": {
    "containerName": "frontend",
    "containerPort": 80,
    "healthCheck": {
      "path": "/health",
      "intervalSeconds": 30
    }
  }
}
```

**Create `backend-deployment.json`:**

```json
{
  "containers": {
    "backend": {
      "image": ":workspaces-backend.1",
      "ports": {
        "8080": "HTTP"
      },
      "environment": {
        "DATABASE_URL": "postgresql://postgres:CHANGE_PASSWORD@localhost:5432/workspaces?sslmode=disable",
        "REDIS_URL": "redis://localhost:6379/0",
        "PORT": "8080",
        "ENVIRONMENT": "production",
        "JWT_SECRET": "GENERATE_STRONG_SECRET_HERE",
        "AWS_REGION": "us-east-1",
        "AWS_ACCESS_KEY_ID": "YOUR_AWS_KEY",
        "AWS_SECRET_ACCESS_KEY": "YOUR_AWS_SECRET",
        "AI_SERVICE_URL": "https://workspaces-ai.your-domain.com"
      }
    }
  },
  "publicEndpoint": {
    "containerName": "backend",
    "containerPort": 8080,
    "healthCheck": {
      "path": "/health",
      "intervalSeconds": 30
    }
  }
}
```

**Create `ai-deployment.json`:**

```json
{
  "containers": {
    "ai": {
      "image": ":workspaces-ai.1",
      "ports": {
        "8081": "HTTP"
      },
      "environment": {
        "MODEL_PATH": "/models/Phi-3-mini-128k-instruct-Q4_K_M.gguf",
        "THREADS": "4",
        "CONTEXT_SIZE": "8192"
      }
    }
  },
  "publicEndpoint": {
    "containerName": "ai",
    "containerPort": 8081,
    "healthCheck": {
      "path": "/health",
      "intervalSeconds": 30
    }
  }
}
```

### Step 6: Deploy Containers

```bash
# Deploy frontend
aws lightsail create-container-service-deployment \
  --service-name workspaces-frontend \
  --cli-input-json file://frontend-deployment.json \
  --region us-east-1

# Deploy backend
aws lightsail create-container-service-deployment \
  --service-name workspaces-backend \
  --cli-input-json file://backend-deployment.json \
  --region us-east-1

# Deploy AI service
aws lightsail create-container-service-deployment \
  --service-name workspaces-ai \
  --cli-input-json file://ai-deployment.json \
  --region us-east-1

# Check deployment status
aws lightsail get-container-services \
  --query 'containerServices[*].[serviceName,currentDeployment.state]' \
  --output table
```

### Step 7: Get Service URLs

```bash
# Get public URLs
aws lightsail get-container-services \
  --query 'containerServices[*].[serviceName,url]' \
  --output table

# Example output:
# workspaces-frontend | https://workspaces-frontend.abc123.us-east-1.cs.amazonlightsail.com
# workspaces-backend  | https://workspaces-backend.def456.us-east-1.cs.amazonlightsail.com
# workspaces-ai       | https://workspaces-ai.ghi789.us-east-1.cs.amazonlightsail.com
```

### Step 8: Configure Custom Domain (Optional)

**Prerequisites:**
- Domain registered (e.g., workspaces.example.com)
- SSL certificate

**Create SSL Certificate:**

```bash
# Request certificate in Lightsail
aws lightsail create-certificate \
  --certificate-name workspaces-cert \
  --domain-name workspaces.example.com \
  --subject-alternative-names www.workspaces.example.com \
  --region us-east-1

# Verify certificate (add DNS records as instructed)
```

**Create Load Balancer:**

```bash
# Create load balancer
aws lightsail create-load-balancer \
  --load-balancer-name workspaces-lb \
  --instance-port 80 \
  --health-check-path /health \
  --region us-east-1

# Attach certificate
aws lightsail attach-load-balancer-tls-certificate \
  --load-balancer-name workspaces-lb \
  --certificate-name workspaces-cert \
  --region us-east-1

# Attach frontend container
aws lightsail attach-instances-to-load-balancer \
  --load-balancer-name workspaces-lb \
  --instance-names workspaces-frontend \
  --region us-east-1
```

**Update DNS:**

```
# Add CNAME record in your DNS provider:
workspaces.example.com → workspaces-lb-xxx.us-east-1.elb.amazonaws.com
```

### Step 9: Configure Environment Variables (Production)

**Update backend environment variables:**

```bash
# Generate strong JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Update deployment with AWS Secrets Manager
aws lightsail update-container-service \
  --service-name workspaces-backend \
  --cli-input-json '{
    "containers": {
      "backend": {
        "environment": {
          "JWT_SECRET": "'$JWT_SECRET'",
          "ENVIRONMENT": "production"
        }
      }
    }
  }'
```

### Step 10: Enable Monitoring

```bash
# Enable container metrics
aws lightsail get-container-service-metric-data \
  --service-name workspaces-backend \
  --metric-name CPUUtilization \
  --start-time 2025-12-06T00:00:00Z \
  --end-time 2025-12-06T23:59:59Z \
  --period 300 \
  --statistics Average
```

**Set up CloudWatch Alarms:**

```bash
# Create SNS topic for alerts
aws sns create-topic --name workspaces-alerts

# Subscribe to email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789012:workspaces-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com

# Create CPU alarm
aws cloudwatch put-metric-alarm \
  --alarm-name workspaces-backend-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/Lightsail \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:workspaces-alerts
```

---

## Production Checklist

### Security

- [ ] Change default admin password
- [ ] Generate strong JWT secret (32+ characters)
- [ ] Configure DUO MFA for production
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Restrict CORS origins to your domain
- [ ] Enable PostgreSQL SSL connections
- [ ] Use AWS Secrets Manager for credentials
- [ ] Enable Redis password authentication
- [ ] Configure security groups (limit access)
- [ ] Enable WAF (Web Application Firewall)

### Performance

- [ ] Enable Redis caching
- [ ] Configure PostgreSQL connection pooling
- [ ] Set up CDN for static assets (CloudFront)
- [ ] Enable gzip compression in Nginx
- [ ] Optimize database indexes
- [ ] Configure sync schedule (avoid peak hours)

### Reliability

- [ ] Set up automated backups (PostgreSQL)
- [ ] Configure health checks for all containers
- [ ] Enable automatic container restarts
- [ ] Set up monitoring and alerting
- [ ] Create disaster recovery plan
- [ ] Test failover procedures

### Compliance

- [ ] Enable CloudTrail logging
- [ ] Configure audit log retention
- [ ] Document data retention policies
- [ ] Set up access logging
- [ ] Create backup policy
- [ ] Review IAM permissions

---

## Monitoring & Logging

### Application Logs

**Backend Logs:**

```bash
# View container logs
aws lightsail get-container-log \
  --service-name workspaces-backend \
  --container-name backend

# Stream logs (real-time)
aws lightsail get-container-log \
  --service-name workspaces-backend \
  --container-name backend \
  --follow
```

**AI Service Logs:**

```bash
aws lightsail get-container-log \
  --service-name workspaces-ai \
  --container-name ai
```

### Metrics Dashboard

**CloudWatch Metrics:**

```bash
# CPU Utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lightsail \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=workspaces-backend \
  --start-time 2025-12-06T00:00:00Z \
  --end-time 2025-12-06T23:59:59Z \
  --period 3600 \
  --statistics Average

# Memory Utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lightsail \
  --metric-name MemoryUtilization \
  --dimensions Name=ServiceName,Value=workspaces-backend \
  --start-time 2025-12-06T00:00:00Z \
  --end-time 2025-12-06T23:59:59Z \
  --period 3600 \
  --statistics Average
```

### Application Metrics

Access built-in metrics:
- `GET /api/v1/dashboard` - Application stats
- `GET /api/v1/sync/history` - Sync job metrics

---

## Backup & Disaster Recovery

### Database Backup

**Manual Backup:**

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec workspaces-backend pg_dump -U postgres workspaces > backup_$DATE.sql
aws s3 cp backup_$DATE.sql s3://your-backup-bucket/postgres/
rm backup_$DATE.sql
EOF

chmod +x backup.sh
```

**Automated Daily Backup:**

```bash
# Add to crontab
crontab -e

# Add line (runs daily at 2 AM)
0 2 * * * /path/to/backup.sh
```

### Restore from Backup

```bash
# Download backup from S3
aws s3 cp s3://your-backup-bucket/postgres/backup_20251206_020000.sql .

# Restore to container
cat backup_20251206_020000.sql | docker exec -i workspaces-backend psql -U postgres -d workspaces
```

---

## Scaling & Migration

### When to Scale

**Indicators you need to scale:**
- CPU consistently >70%
- Memory consistently >80%
- Response time >2 seconds
- More than 10,000 WorkSpaces
- More than 5M API requests/month

### Vertical Scaling (Lightsail)

```bash
# Scale backend to XLarge (32GB RAM)
aws lightsail update-container-service \
  --service-name workspaces-backend \
  --power xlarge \
  --scale 1
```

### Migration to ECS/EKS

**Step 1: Push images to ECR**

```bash
# Create ECR repository
aws ecr create-repository --repository-name workspaces-backend

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag workspaces-backend:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/workspaces-backend:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/workspaces-backend:latest
```

**Step 2: Create ECS Task Definition**

```json
{
  "family": "workspaces-backend",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/workspaces-backend:latest",
      "memory": 8192,
      "cpu": 2048,
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "ENVIRONMENT",
          "value": "production"
        }
      ]
    }
  ]
}
```

**Step 3: Create ECS Service**

```bash
aws ecs create-service \
  --cluster workspaces-cluster \
  --service-name workspaces-backend \
  --task-definition workspaces-backend \
  --desired-count 2 \
  --launch-type FARGATE
```

---

## Troubleshooting

### Docker Image Errors

**Error:** `No such image: sha256:...` or `The image for the service you're trying to recreate has been removed`

This error occurs when Docker tries to use cached image references that no longer exist (e.g., after running `docker image prune` or system cleanup).

**Solution 1: Rebuild images and recreate containers**

```bash
# Stop and remove containers
docker-compose -f docker-compose.go.yml down

# Remove dangling images
docker image prune -f

# Rebuild all images from scratch
docker-compose -f docker-compose.go.yml build --no-cache

# Start containers with freshly built images
docker-compose -f docker-compose.go.yml up -d
```

**Solution 2: Complete cleanup and fresh start**

```bash
# Stop all containers
docker-compose -f docker-compose.go.yml down

# Remove all containers, networks, and images (WARNING: This removes all unused Docker resources)
docker system prune -a --volumes

# Rebuild and start
docker-compose -f docker-compose.go.yml build --no-cache
docker-compose -f docker-compose.go.yml up -d
```

**Solution 3: Remove specific project images and rebuild**

```bash
# Stop containers
docker-compose -f docker-compose.go.yml down

# Remove project-specific images
docker images | grep workspaces | awk '{print $3}' | xargs docker rmi -f

# Rebuild
docker-compose -f docker-compose.go.yml build
docker-compose -f docker-compose.go.yml up -d
```

**Important Notes:**
- Always backup your data before running cleanup commands
- The `--volumes` flag will delete database data unless you have external volume backups
- If you want to preserve data, omit the `--volumes` flag

### ContainerConfig KeyError

**Error:** `KeyError: 'ContainerConfig'` or `404 Client Error for http+docker://localhost/v1.52/images/...`

This error indicates severe Docker state corruption where containers reference non-existent images. This happens when:
- Images were deleted while containers were still referencing them
- Docker daemon was improperly shut down
- Docker Compose state is out of sync with Docker daemon

**Solution: Force remove containers and rebuild**

```bash
# Step 1: Force remove all project containers (ignores errors)
docker rm -f workspaces-backend workspaces-frontend workspaces-ai 2>/dev/null || true
docker rm -f workspaces-backend-lite workspaces-frontend-lite 2>/dev/null || true
docker rm -f workspaces-inventory 2>/dev/null || true

# Step 2: Remove all project networks
docker network rm workspaces-network 2>/dev/null || true

# Step 3: Clean up orphaned volumes (OPTIONAL - skips if you want to preserve data)
# docker volume rm postgres-data redis-data workspaces-data 2>/dev/null || true

# Step 4: Remove project images
docker rmi -f $(docker images -q 'workspaces-*' 2>/dev/null) 2>/dev/null || true
docker rmi -f $(docker images -q '*workspaces*' 2>/dev/null) 2>/dev/null || true

# Step 5: Clean Docker builder cache
docker builder prune -af

# Step 6: Rebuild everything from scratch
docker-compose -f docker-compose.go.yml build --no-cache

# Step 7: Start services
docker-compose -f docker-compose.go.yml up -d

# Step 8: Verify everything is running
docker-compose -f docker-compose.go.yml ps
```

**Quick one-liner (nuclear option - USE WITH CAUTION):**

```bash
docker rm -f $(docker ps -aq) 2>/dev/null; docker system prune -af --volumes; docker-compose -f docker-compose.go.yml build --no-cache && docker-compose -f docker-compose.go.yml up -d
```

**⚠️ WARNING:** The nuclear option will:
- Stop and remove ALL Docker containers (not just this project)
- Delete ALL unused images, networks, and volumes
- Require rebuilding all images from scratch

**Alternative: Use Docker Compose down with volumes**

```bash
# This properly cleans up everything managed by docker-compose
docker-compose -f docker-compose.go.yml down -v --remove-orphans --rmi all

# Then rebuild and start
docker-compose -f docker-compose.go.yml build --no-cache
docker-compose -f docker-compose.go.yml up -d
```

### Port Allocation Errors

**Error:** `Bind for 0.0.0.0:8080 failed: port is already allocated`

This error occurs when trying to start containers while another Docker Compose stack is already running.

**Solution:**

```bash
# Stop all running containers first
docker-compose -f docker-compose.go.yml down
docker-compose -f docker-compose.lite.yml down
docker-compose -f docker-compose.yml down

# Then start the desired stack
docker-compose -f docker-compose.go.yml up -d
```

**Docker Compose File Ports:**

| File | Frontend Port | Backend Port | AI Service Port |
|------|---------------|--------------|-----------------|
| `docker-compose.yml` | 3001 | N/A | N/A |
| `docker-compose.lite.yml` | 3002 | 8082 | N/A |
| `docker-compose.go.yml` | 3001 | 8080 | 8081 |

**Which file should you use?**

- `docker-compose.yml` - Single container (Node.js + SQLite) - **Simplest setup**
- `docker-compose.lite.yml` - Two containers (Go backend + frontend, no AI) - **Lightweight**
- `docker-compose.go.yml` - Three containers (Go backend + frontend + AI service) - **Full featured** (Recommended)

### Container Won't Start

```bash
# Check service status
aws lightsail get-container-services

# View deployment history
aws lightsail get-container-service-deployments \
  --service-name workspaces-backend

# Check logs for errors
aws lightsail get-container-log \
  --service-name workspaces-backend \
  --container-name backend
```

### High Memory Usage

```bash
# Check memory metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lightsail \
  --metric-name MemoryUtilization \
  --dimensions Name=ServiceName,Value=workspaces-backend

# Scale up if needed
aws lightsail update-container-service \
  --service-name workspaces-backend \
  --power xlarge
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker exec workspaces-backend pg_isready -U postgres

# Check connection string
docker exec workspaces-backend env | grep DATABASE_URL

# Restart container
aws lightsail update-container-service \
  --service-name workspaces-backend \
  --is-disabled false
```

---

## Support

- **Documentation**: [README.md](README.md) | [ARCHITECTURE.md](ARCHITECTURE.md)
- **Issues**: [GitHub Issues](https://github.com/4syedalihassan/workspaces-inventory/issues)
- **AWS Support**: [Lightsail Docs](https://lightsail.aws.amazon.com/ls/docs)

---

**Last Updated**: December 6, 2025
