# Migration Guide: v1.0 to v2.0

## Overview

This guide helps you understand the differences between v1.0 (Node.js/SQLite) and v2.0 (FastAPI/PostgreSQL/React) architectures and how to work with both versions.

## Architecture Comparison

### v1.0 (Legacy - Still Available)
```
Single Server
├── Node.js + Express
├── SQLite database
├── Vanilla JS frontend
└── All-in-one deployment
```

### v2.0 (New - Three-Tier)
```
Web Tier (Lightsail 1)
├── React 18 + Vite
└── Nginx

Application Tier (Lightsail 2)
├── FastAPI
├── PostgreSQL
├── Redis
└── Celery

AI Tier (Lightsail 3)
└── Phi-3 Model (llama.cpp)
```

## Key Differences

### Technology Stack

| Component | v1.0 | v2.0 |
|-----------|------|------|
| Backend | Node.js/Express | Python/FastAPI |
| Database | SQLite | PostgreSQL |
| Cache | None | Redis |
| Queue | None | Celery |
| Frontend | Vanilla JS | React + Vite |
| Styling | Bootstrap | TailwindCSS |
| Auth | None | JWT + RBAC |
| AI | None | Phi-3 Model |

### API Differences

#### v1.0 Endpoints
```
GET  /api/workspaces
GET  /api/workspaces/:id
GET  /api/usage
GET  /api/billing
GET  /api/cloudtrail
POST /api/sync/all
GET  /api/export/workspaces/csv
```

#### v2.0 Endpoints
```
POST /api/auth/login           # NEW: Authentication
GET  /api/auth/me              # NEW: User info
GET  /api/workspaces
GET  /api/workspaces/{id}
GET  /api/workspaces/{id}/usage
POST /api/ai/query             # NEW: AI queries
POST /api/reports/generate     # NEW: Async reports
GET  /api/admin/config         # NEW: Admin functions
```

## Running Both Versions

### Run v1.0 (Legacy)

```bash
# Install dependencies
npm install

# Start server
npm start

# Access at http://localhost:3000
```

### Run v2.0 (New Architecture)

```bash
# Single server deployment
docker-compose -f docker-compose.full.yml up -d

# Access at http://localhost
```

## Data Migration

### Export from v1.0

```bash
# Export workspaces data
node -e "
const Workspace = require('./src/models/Workspace');
const fs = require('fs');
const workspaces = Workspace.getAll({});
fs.writeFileSync('workspaces_export.json', JSON.stringify(workspaces, null, 2));
console.log('Exported', workspaces.length, 'workspaces');
"
```

### Import to v2.0

```bash
# Import into PostgreSQL
docker-compose exec backend python -c "
import json
from app.db.session import SessionLocal
from app.models.models import Workspace

db = SessionLocal()

with open('/app/workspaces_export.json', 'r') as f:
    workspaces = json.load(f)
    
for ws in workspaces:
    workspace = Workspace(**ws)
    db.add(workspace)
    
db.commit()
print(f'Imported {len(workspaces)} workspaces')
"
```

## Feature Comparison

### Features in Both Versions
- ✅ WorkSpaces inventory tracking
- ✅ CloudTrail event logging
- ✅ Billing data integration
- ✅ Usage tracking
- ✅ CSV/Excel exports
- ✅ AWS API synchronization

### New Features in v2.0
- ✨ User authentication & authorization
- ✨ Role-based access control (RBAC)
- ✨ AI-powered natural language queries
- ✨ Admin portal for system management
- ✨ Async report generation
- ✨ Background task processing
- ✨ Modern React UI
- ✨ API documentation (OpenAPI/Swagger)
- ✨ Three-tier security architecture
- ✨ Horizontal scalability

## Development Workflow

### v1.0 Development

```bash
# Edit code
nano src/app.js

# Restart server
npm start

# Run tests
npm test
```

### v2.0 Development

```bash
# Backend development
cd app-tier/backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend development
cd web-tier/frontend
npm install
npm run dev

# Run tests
pytest  # Backend
npm test  # Frontend
```

## When to Use Which Version

### Use v1.0 If:
- ✅ You need quick deployment
- ✅ You have a small team
- ✅ You don't need authentication
- ✅ Single server is sufficient
- ✅ You prefer Node.js

### Use v2.0 If:
- ✅ You need enterprise features
- ✅ You need authentication/RBAC
- ✅ You want AI capabilities
- ✅ You need horizontal scaling
- ✅ You prefer modern tech stack
- ✅ You need three-tier security

## Deployment Comparison

### v1.0 Deployment
```bash
# Single command
docker-compose up -d
```

### v2.0 Deployment

**Single Server:**
```bash
docker-compose -f docker-compose.full.yml up -d
```

**Three Servers (Production):**
```bash
# On Web Tier
cd web-tier && docker-compose up -d

# On App Tier
cd app-tier && docker-compose up -d

# On AI Tier
cd ai-tier && docker-compose up -d
```

## Cost Comparison

### v1.0 Cost (Single Server)
- 1x Lightsail: $20/month
- **Total: ~$20/month**

### v2.0 Cost (Three-Tier)
- Web Tier: $10/month
- App Tier: $40/month
- AI Tier: $40/month
- **Total: ~$90/month**

**But provides:**
- Better security
- Scalability
- AI features
- User management
- Still 60-90% cheaper than AWS managed services

## Troubleshooting

### v1.0 Issues
```bash
# Check logs
docker-compose logs -f

# Check database
ls -la data/workspaces.db

# Rebuild
docker-compose down && docker-compose up --build
```

### v2.0 Issues
```bash
# Check all services
docker-compose -f docker-compose.full.yml ps

# Check logs
docker-compose -f docker-compose.full.yml logs -f backend
docker-compose -f docker-compose.full.yml logs -f postgres

# Database access
docker-compose exec postgres psql -U workspaces workspaces_inventory
```

## Security Considerations

### v1.0
- ⚠️ No authentication
- ⚠️ Single point of failure
- ⚠️ All services on one server
- ✅ Simple firewall rules

### v2.0
- ✅ JWT authentication
- ✅ RBAC authorization
- ✅ Network isolation
- ✅ Internal-only AI service
- ✅ Encrypted database
- ✅ Security headers

## Support

### v1.0 Documentation
- See README.md (sections 1-10)
- Node.js/Express documentation
- SQLite documentation

### v2.0 Documentation
- See ARCHITECTURE.md
- See DEPLOYMENT.md
- See README_V2.md
- FastAPI documentation
- React documentation

## Conclusion

Both versions are maintained and functional:

- **v1.0** is perfect for simple, quick deployments
- **v2.0** is ideal for enterprise, production use

Choose based on your specific needs and requirements.
