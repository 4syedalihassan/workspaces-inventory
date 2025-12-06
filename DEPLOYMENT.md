# Deployment Guide - AWS WorkSpaces Inventory

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Single-Server Deployment](#single-server-deployment)
3. [Three-Tier Lightsail Deployment](#three-tier-lightsail-deployment)
4. [Post-Deployment Setup](#post-deployment-setup)
5. [SSL/TLS Configuration](#ssltls-configuration)
6. [Monitoring & Maintenance](#monitoring--maintenance)

## Prerequisites

### Required
- Docker 20.10+
- Docker Compose 2.0+
- AWS credentials with the following permissions:
  - `workspaces:DescribeWorkspaces`
  - `workspaces:DescribeWorkspaceBundles`
  - `cloudtrail:LookupEvents`
  - `ce:GetCostAndUsage`
  - `ds:DescribeDirectories` (optional)

### For Three-Tier Deployment
- 3 AWS Lightsail instances (or equivalent VPS)
- Private networking between instances
- Domain name (optional but recommended)

## Single-Server Deployment

Perfect for development, testing, or small deployments.

### Step 1: Clone Repository

```bash
git clone https://github.com/4syedalihassan/workspaces-inventory.git
cd workspaces-inventory
```

### Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your credentials
nano .env
```

Required changes:
```env
SECRET_KEY=generate-a-secure-random-string-here
POSTGRES_PASSWORD=choose-a-strong-password
AWS_ACCESS_KEY_ID=your-actual-key
AWS_SECRET_ACCESS_KEY=your-actual-secret
```

### Step 3: Deploy All Services

```bash
# Build and start all containers
docker-compose -f docker-compose.full.yml up -d

# Wait for services to be healthy (2-3 minutes)
docker-compose -f docker-compose.full.yml ps
```

### Step 4: Initialize Database

```bash
# Run database migrations
docker-compose -f docker-compose.full.yml exec backend alembic upgrade head

# Create admin user
docker-compose -f docker-compose.full.yml exec backend python -c "
from app.db.session import SessionLocal
from app.models.models import User
from app.core.security import get_password_hash

db = SessionLocal()
admin = User(
    username='admin',
    email='admin@company.com',
    hashed_password=get_password_hash('ChangeMe123!'),
    is_superuser=True,
    role='admin'
)
db.add(admin)
db.commit()
print('Admin user created: username=admin, password=ChangeMe123!')
"
```

### Step 5: Access Application

Navigate to `http://your-server-ip` and login with:
- Username: `admin`
- Password: `ChangeMe123!`

**Important**: Change the admin password immediately after first login!

## Three-Tier Lightsail Deployment

Optimal for production with maximum security and scalability.

### Architecture Overview

```
Instance 1 (Web Tier)    - 2GB RAM, 1 vCPU  - Public IP
Instance 2 (App Tier)    - 8GB RAM, 2 vCPU  - Private network
Instance 3 (AI Tier)     - 8GB RAM, 2 vCPU  - Private network
```

### Step 1: Provision Lightsail Instances

1. **Web Tier Instance**
   - OS: Ubuntu 22.04 LTS
   - Plan: 2GB RAM, 1 vCPU ($10/month)
   - Enable public IP
   - Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS)

2. **Application Tier Instance**
   - OS: Ubuntu 22.04 LTS
   - Plan: 8GB RAM, 2 vCPU ($40/month)
   - Private network only
   - Firewall: Allow from Web Tier IP

3. **AI Tier Instance**
   - OS: Ubuntu 22.04 LTS
   - Plan: 8GB RAM, 2 vCPU ($40/month)
   - Private network only
   - Firewall: Allow from App Tier IP only

### Step 2: Install Docker on All Instances

```bash
# Run on each instance
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Step 3: Deploy AI Tier (Instance 3)

```bash
# On AI Tier instance
git clone https://github.com/4syedalihassan/workspaces-inventory.git
cd workspaces-inventory/ai-tier

# Start AI service
docker-compose up -d

# Verify it's running
docker-compose ps
docker-compose logs -f
```

Note the private IP of this instance (e.g., `10.0.1.3`).

### Step 4: Deploy Application Tier (Instance 2)

```bash
# On Application Tier instance
git clone https://github.com/4syedalihassan/workspaces-inventory.git
cd workspaces-inventory/app-tier

# Create environment file
cat > .env << EOF
SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -base64 32)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key-id
AWS_SECRET_ACCESS_KEY=your-secret-key
AI_SERVICE_URL=http://10.0.1.3:11434
EOF

# Start application services
docker-compose up -d

# Wait for services to be healthy
sleep 30

# Run migrations
docker-compose exec backend alembic upgrade head

# Create admin user
docker-compose exec backend python -c "
from app.db.session import SessionLocal
from app.models.models import User
from app.core.security import get_password_hash

db = SessionLocal()
admin = User(
    username='admin',
    email='admin@company.com',
    hashed_password=get_password_hash('SecurePassword123!'),
    is_superuser=True,
    role='admin'
)
db.add(admin)
db.commit()
"

# Verify API is accessible
curl http://localhost:8000/health
```

Note the private IP of this instance (e.g., `10.0.1.2`).

### Step 5: Deploy Web Tier (Instance 1)

```bash
# On Web Tier instance
git clone https://github.com/4syedalihassan/workspaces-inventory.git
cd workspaces-inventory/web-tier

# Update Nginx config with App Tier IP
sed -i 's/backend:8000/10.0.1.2:8000/g' nginx/nginx.conf

# Build and deploy
docker-compose up -d

# Verify
curl http://localhost/health
```

### Step 6: Configure Networking

On each Lightsail instance, configure firewall rules:

**Web Tier (Instance 1)**
```
Inbound:
- Port 22: Your admin IP only
- Port 80: 0.0.0.0/0 (public)
- Port 443: 0.0.0.0/0 (public)

Outbound:
- All to App Tier private IP
```

**Application Tier (Instance 2)**
```
Inbound:
- Port 22: Your admin IP only
- Port 8000: Web Tier private IP only

Outbound:
- All to AI Tier private IP
- All to Internet (for AWS API calls)
```

**AI Tier (Instance 3)**
```
Inbound:
- Port 22: Your admin IP only
- Port 11434: App Tier private IP only

Outbound:
- None (fully isolated)
```

## Post-Deployment Setup

### 1. Change Default Passwords

```bash
# Login to the application
# Go to Admin > Users
# Update admin password
```

### 2. Configure AWS Sync

```bash
# Trigger initial sync
curl -X POST http://your-server/api/admin/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sync_type": "all"}'
```

### 3. Create Additional Users

Via the Admin Portal:
1. Navigate to Admin > Users
2. Click "Add User"
3. Assign appropriate roles:
   - `admin`: Full access
   - `finance`: Read-only access to billing
   - `user`: Basic workspace viewing

## SSL/TLS Configuration

### Using Let's Encrypt (Recommended)

```bash
# On Web Tier instance
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
sudo certbot renew --dry-run
```

### Using Custom Certificate

```bash
# Place your certificate files on Web Tier
sudo cp your-cert.crt /etc/ssl/certs/
sudo cp your-key.key /etc/ssl/private/

# Update Nginx config
sudo nano /etc/nginx/sites-available/default
```

Add SSL configuration:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/ssl/certs/your-cert.crt;
    ssl_certificate_key /etc/ssl/private/your-key.key;
    
    # ... rest of config
}
```

## Monitoring & Maintenance

### Health Checks

```bash
# Check all services
docker-compose ps

# Check specific service health
curl http://localhost/health
curl http://localhost:8000/health
curl http://localhost:11434/health
```

### View Logs

```bash
# All logs
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f postgres
docker-compose logs -f phi3-service
```

### Database Backups

#### Automated Backup Script

```bash
#!/bin/bash
# save as /opt/backup-db.sh

BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="workspaces_backup_${DATE}.sql"

docker-compose exec -T postgres pg_dump -U workspaces workspaces_inventory > "${BACKUP_DIR}/${FILENAME}"

# Keep only last 7 days
find ${BACKUP_DIR} -name "workspaces_backup_*.sql" -mtime +7 -delete

# Optional: Upload to S3
# aws s3 cp "${BACKUP_DIR}/${FILENAME}" s3://your-backup-bucket/
```

#### Schedule with Cron

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/backup-db.sh
```

### Updates and Upgrades

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Run any new migrations
docker-compose exec backend alembic upgrade head
```

### Monitoring Resource Usage

```bash
# View resource usage
docker stats

# Check disk space
df -h

# Check logs size
du -sh /var/lib/docker/containers/*/*-json.log
```

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Verify environment variables
docker-compose config

# Check port conflicts
sudo netstat -tulpn | grep LISTEN
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose exec postgres pg_isready

# Test connection
docker-compose exec backend python -c "from app.db.session import engine; print(engine.connect())"
```

### AI Service Not Responding

```bash
# Check AI service health
docker-compose exec phi3-service wget -O- http://localhost:11434/health

# Restart AI service
docker-compose restart phi3-service
```

## Rollback Procedure

If something goes wrong:

```bash
# Stop current deployment
docker-compose down

# Restore from backup
docker-compose exec -T postgres psql -U workspaces workspaces_inventory < /opt/backups/latest_backup.sql

# Start with previous version
git checkout <previous-commit>
docker-compose up -d
```

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Review ARCHITECTURE.md
3. Open an issue on GitHub
4. Contact support team

## Security Checklist

- [ ] Changed default admin password
- [ ] Generated secure SECRET_KEY
- [ ] Configured firewall rules
- [ ] Enabled HTTPS/SSL
- [ ] Set up automated backups
- [ ] Restricted SSH access
- [ ] Reviewed and updated CORS settings
- [ ] Configured rate limiting
- [ ] Set up monitoring/alerting
- [ ] Documented custom configurations
