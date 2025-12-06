# AWS WorkSpaces Inventory - v2.0

> **Modern Three-Tier Architecture with AI-Powered Insights**

An enterprise-grade web application for managing AWS WorkSpaces inventory with automated data ingestion, AI-powered analytics, and comprehensive reporting capabilities.

## 🚀 What's New in v2.0

- **Three-Tier Architecture**: Separated web, application, and AI tiers for enhanced security and scalability
- **Modern Tech Stack**: React + FastAPI + PostgreSQL + Redis + Celery
- **AI-Powered**: Natural language queries using Phi-3 model
- **Enhanced Security**: JWT authentication, RBAC, isolated network tiers
- **Async Processing**: Background tasks for reports and data sync
- **Production Ready**: Docker-based deployment, health checks, monitoring

## 📋 Features

### Core Functionality
- ✅ **Automated Data Ingestion** - Syncs directly from AWS APIs
- ✅ **WorkSpaces Tracking** - Complete inventory with detailed metadata
- ✅ **CloudTrail Integration** - Audit logs for all workspace changes
- ✅ **Billing & Cost Tracking** - Monthly usage and cost analysis
- ✅ **Advanced Filtering** - Search and filter by multiple criteria
- ✅ **Export Capabilities** - CSV and Excel exports

### New in v2.0
- ✨ **AI Query Interface** - Ask questions in natural language
- ✨ **User Management** - Role-based access control
- ✨ **Admin Portal** - System configuration and management
- ✨ **Async Reports** - Background report generation
- ✨ **RESTful API** - Full OpenAPI documentation
- ✨ **Modern UI** - React-based responsive interface

## 🏗️ Architecture

```
┌─────────────────┐
│   Web Tier      │  React, Nginx
│   (Lightsail 1) │  Ports: 80, 443
└────────┬────────┘
         │ HTTPS
         v
┌─────────────────┐
│ Application     │  FastAPI, PostgreSQL
│     Tier        │  Redis, Celery
│  (Lightsail 2)  │  Port: 8000 (internal)
└────────┬────────┘
         │ HTTP (internal)
         v
┌─────────────────┐
│    AI Tier      │  Phi-3, llama.cpp
│  (Lightsail 3)  │  Port: 11434 (internal)
└─────────────────┘
```

**Benefits:**
- 🔒 Enhanced security with network isolation
- 📈 Independent scaling of each tier
- 💰 90%+ cost savings vs managed AWS services
- 🔧 Easy maintenance and updates
- 🚀 High availability and fault tolerance

## 🚀 Quick Start

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- AWS credentials with appropriate permissions

### Single-Server Deployment (Development/Testing)

```bash
# Clone repository
git clone https://github.com/4syedalihassan/workspaces-inventory.git
cd workspaces-inventory

# Configure environment
cp .env.example .env
nano .env  # Add your AWS credentials

# Deploy all services
docker-compose -f docker-compose.full.yml up -d

# Initialize database
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
print('Admin created: admin / ChangeMe123!')
"

# Access at http://localhost
```

### Three-Tier Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## 📚 Documentation

- [**Architecture Guide**](./ARCHITECTURE.md) - Detailed architecture overview
- [**Deployment Guide**](./DEPLOYMENT.md) - Production deployment instructions
- [**API Documentation**](http://localhost:8000/docs) - OpenAPI/Swagger docs (when running)
- [**Legacy README**](./README.md) - Original v1.0 documentation

## 🔧 Technology Stack

### Frontend (Web Tier)
- React 18 with Vite
- TailwindCSS for styling
- React Router for navigation
- Axios for API communication
- Recharts for data visualization

### Backend (Application Tier)
- FastAPI (Python 3.11)
- PostgreSQL 15 (database)
- Redis 7 (caching & queues)
- Celery (background tasks)
- SQLAlchemy (ORM)
- Alembic (migrations)
- JWT authentication

### AI (AI Tier)
- Phi-3 Mini model
- llama.cpp runtime
- C++ HTTP server

### DevOps
- Docker & Docker Compose
- Nginx reverse proxy
- Health checks & monitoring
- Automated backups

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/login      # Login
GET    /api/auth/me         # Current user
```

### WorkSpaces
```
GET    /api/workspaces           # List workspaces
GET    /api/workspaces/{id}      # Get details
GET    /api/workspaces/{id}/usage    # Usage data
GET    /api/workspaces/{id}/billing  # Billing data
GET    /api/workspaces/{id}/events   # Audit events
```

### AI
```
POST   /api/ai/query        # Natural language query
GET    /api/ai/health       # AI service status
```

### Reports
```
POST   /api/reports/generate    # Generate report
GET    /api/reports/{id}        # Download report
```

### Admin
```
GET    /api/admin/config    # System configuration
GET    /api/admin/stats     # Statistics
POST   /api/admin/sync      # Trigger sync
```

Full API documentation available at `/docs` when running.

## 🔐 Security

- **Authentication**: JWT-based with bcrypt password hashing
- **Authorization**: Role-based access control (RBAC)
- **Network**: Isolated tiers, internal-only AI service
- **Data**: PostgreSQL with encryption at rest
- **Headers**: Security headers (CSP, XSS, etc.)
- **Rate Limiting**: Configured on all API endpoints

## 📊 Monitoring

### Health Checks
```bash
# Check all services
docker-compose ps

# Individual health endpoints
curl http://localhost/health
curl http://localhost:8000/health
```

### Logs
```bash
# View all logs
docker-compose logs -f

# Specific service
docker-compose logs -f backend
```

### Metrics
- All services include health check endpoints
- Docker resource monitoring with `docker stats`
- Application metrics via logs

## 🔄 Data Sync

Automated sync from AWS:
- **WorkSpaces** - Inventory and metadata
- **CloudTrail** - Audit events
- **Cost Explorer** - Billing data
- **Directory Service** - User information

Sync can be:
- Scheduled (configurable cron)
- Triggered manually via Admin Portal
- Triggered via API

## 💰 Cost Comparison

### This Solution (Lightsail)
- Web Tier: $10/month
- App Tier: $40/month
- AI Tier: $40/month
- **Total: ~$90/month**

### AWS Managed Services
- ECS Fargate: $200-400/month
- RDS PostgreSQL: $100-300/month
- ElastiCache: $50-150/month
- **Total: $350-850/month**

**Savings: 60-90%**

## 🚀 Scaling

### Vertical Scaling
- Upgrade individual tier instance size
- Adjust Docker resource limits
- Independent of other tiers

### Horizontal Scaling
- Add backend replicas with load balancer
- Scale Celery workers independently
- Use managed PostgreSQL (RDS) if needed

## 🔧 Development

### Local Development

```bash
# Backend
cd app-tier/backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd web-tier/frontend
npm install
npm run dev
```

### Testing

```bash
# Backend tests
cd app-tier/backend
pytest

# Frontend tests
cd web-tier/frontend
npm test

# Legacy Node.js tests (still available)
npm test
```

## 📝 Migration from v1.0

The v2.0 architecture is a complete rewrite. Both versions can coexist:

- **v1.0 (Node.js)**: Still available, maintained in same repository
- **v2.0 (Python/React)**: New three-tier architecture

To run v1.0:
```bash
npm install
npm start
```

To run v2.0:
```bash
docker-compose -f docker-compose.full.yml up -d
```

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

ISC

## 🆘 Support

- **Documentation**: See ARCHITECTURE.md and DEPLOYMENT.md
- **Issues**: [GitHub Issues](https://github.com/4syedalihassan/workspaces-inventory/issues)
- **Logs**: Check `docker-compose logs -f` for debugging

## 🎯 Roadmap

- [ ] GraphQL API option
- [ ] Real-time notifications
- [ ] Advanced AI analytics
- [ ] Mobile app
- [ ] Multi-region support
- [ ] SSO integration
- [ ] Grafana dashboards
- [ ] Terraform deployment

## 👥 Credits

Built with ❤️ for efficient AWS WorkSpaces management.

---

**Note**: This is v2.0 with a complete architectural redesign. For the original v1.0 documentation, see the legacy README sections above or run the Node.js version.
