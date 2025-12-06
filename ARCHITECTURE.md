# AWS WorkSpaces Inventory - Three-Tier Architecture

## Overview

This application has been re-architected into a modern three-tier architecture optimized for AWS Lightsail deployment with clear separation of concerns, enhanced security, and built-in AI capabilities.

## Architecture Diagram

```
                [ Internet / Users ]
                         |
                +--------------------+
                |    Web Tier        |
                |  (Lightsail 1)     |
                | Nginx, React       |
                +--------------------+
                       |   HTTPS (443)
                       v
                +---------------------+
                | Application Tier    |
                |   (Lightsail 2)     |
                | FastAPI, PostgreSQL |
                | Redis, Celery       |
                +---------------------+
                        |   Internal API, DB
                        v
                +---------------------+
                |     AI Tier         |
                |   (Lightsail 3)     |
                | Phi-3 Llama.cpp     |
                +---------------------+
```

## Technology Stack

### Web Tier
- **Frontend**: React 18 with Vite
- **Styling**: TailwindCSS
- **HTTP Server**: Nginx
- **Routing**: React Router v6

### Application Tier
- **Backend Framework**: FastAPI (Python)
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Task Queue**: Celery with Redis broker
- **ORM**: SQLAlchemy
- **Authentication**: JWT with bcrypt
- **AWS Integration**: Boto3

### AI Tier
- **Model**: Phi-3 Mini
- **Runtime**: llama.cpp (C++)
- **API**: Custom HTTP server

## Directory Structure

```
.
├── web-tier/
│   ├── frontend/           # React application
│   │   ├── src/
│   │   │   ├── components/ # Reusable UI components
│   │   │   ├── pages/      # Page components
│   │   │   ├── services/   # API client
│   │   │   └── utils/      # Helper functions
│   │   ├── public/         # Static assets
│   │   ├── Dockerfile      # Frontend container
│   │   └── package.json
│   ├── nginx/
│   │   └── nginx.conf      # Nginx configuration
│   └── docker-compose.yml
│
├── app-tier/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── api/        # API endpoints
│   │   │   ├── core/       # Core config & security
│   │   │   ├── models/     # SQLAlchemy models
│   │   │   ├── schemas/    # Pydantic schemas
│   │   │   ├── services/   # Business logic
│   │   │   └── db/         # Database config
│   │   ├── alembic/        # Database migrations
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── docker-compose.yml
│
├── ai-tier/
│   ├── phi3-service/
│   │   ├── src/            # C++ source code
│   │   ├── include/        # Header files
│   │   ├── CMakeLists.txt
│   │   └── Dockerfile
│   └── docker-compose.yml
│
└── docker-compose.full.yml # Complete deployment
```

## Key Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- User management with admin portal
- Secure password hashing with bcrypt

### WorkSpaces Management
- Real-time inventory tracking
- Detailed workspace information
- Usage metrics and analytics
- Cost tracking and billing data
- CloudTrail audit logs

### AI-Powered Insights
- Natural language queries
- Intelligent data analysis
- Powered by Phi-3 mini model
- Isolated AI tier for security

### Reporting & Export
- Asynchronous report generation
- CSV and Excel export
- Email delivery (optional)
- Background processing with Celery

### Admin Portal
- System configuration
- User management
- AWS account setup
- Sync scheduling
- System statistics

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - List users (admin)
- `POST /api/users` - Create user (admin)
- `GET /api/users/{id}` - Get user details
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user (admin)

### WorkSpaces
- `GET /api/workspaces` - List workspaces
- `GET /api/workspaces/{id}` - Get workspace details
- `GET /api/workspaces/{id}/usage` - Get usage data
- `GET /api/workspaces/{id}/billing` - Get billing data
- `GET /api/workspaces/{id}/events` - Get CloudTrail events

### AI
- `POST /api/ai/query` - Natural language query
- `GET /api/ai/health` - AI service health check

### Reports
- `POST /api/reports/generate` - Generate report
- `GET /api/reports/{id}` - Get report status/download

### Admin
- `GET /api/admin/config` - Get system config
- `PUT /api/admin/config` - Update config
- `GET /api/admin/stats` - System statistics
- `POST /api/admin/sync` - Trigger data sync

## Deployment

### Prerequisites
- Docker & Docker Compose
- AWS credentials with appropriate permissions
- At least 3 AWS Lightsail instances (or equivalent)

### Quick Start (All-in-One Development)

```bash
# Clone the repository
git clone <repository-url>
cd workspaces-inventory

# Create environment file
cp .env.example .env
# Edit .env with your credentials

# Start all services
docker-compose -f docker-compose.full.yml up -d

# View logs
docker-compose -f docker-compose.full.yml logs -f

# Stop services
docker-compose -f docker-compose.full.yml down
```

### Production Deployment (Three Separate Lightsail Instances)

#### Lightsail Instance 1 - Web Tier
```bash
cd web-tier
docker-compose up -d
```

#### Lightsail Instance 2 - Application Tier
```bash
cd app-tier
docker-compose up -d

# Run database migrations
docker-compose exec backend alembic upgrade head

# Create initial admin user
docker-compose exec backend python -c "
from app.db.session import SessionLocal
from app.models.models import User
from app.core.security import get_password_hash

db = SessionLocal()
admin = User(
    username='admin',
    email='admin@example.com',
    hashed_password=get_password_hash('admin123'),
    is_superuser=True,
    role='admin'
)
db.add(admin)
db.commit()
print('Admin user created')
"
```

#### Lightsail Instance 3 - AI Tier
```bash
cd ai-tier
docker-compose up -d
```

### Environment Variables

Create a `.env` file with the following variables:

```env
# Security
SECRET_KEY=your-secret-key-here

# Database
POSTGRES_PASSWORD=your-postgres-password

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Service URLs (for production multi-instance deployment)
# BACKEND_URL=http://app-tier-ip:8000
# AI_SERVICE_URL=http://ai-tier-ip:11434
```

## Security

### Network Security
- Web tier: Open ports 80/443 only
- Application tier: Internal network only, accessible from Web tier
- AI tier: Fully isolated, accessible only from Application tier
- All tiers: SSH restricted to admin IPs

### Application Security
- JWT-based authentication
- Password hashing with bcrypt
- CORS protection
- Rate limiting
- SQL injection protection (SQLAlchemy)
- XSS protection headers
- HTTPS enforcement (production)

### Data Security
- Database encryption at rest
- Secrets management via environment variables
- No credentials in code
- Audit logging for sensitive operations

## Monitoring & Maintenance

### Health Checks
- All services include health check endpoints
- Docker health checks configured
- Automatic restart on failure

### Logs
```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f phi3-service
```

### Database Backups
```bash
# Backup database
docker-compose exec postgres pg_dump -U workspaces workspaces_inventory > backup.sql

# Restore database
docker-compose exec -T postgres psql -U workspaces workspaces_inventory < backup.sql
```

### Scaling

#### Vertical Scaling
- Upgrade Lightsail instance size for any tier independently
- Adjust Docker resource limits in docker-compose.yml

#### Horizontal Scaling
- Add multiple backend instances with load balancer
- Scale Celery workers independently
- Use managed PostgreSQL (RDS) for better DB performance

## Development

### Local Development

```bash
# Backend development
cd app-tier/backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend development
cd web-tier/frontend
npm install
npm run dev
```

### Running Tests

```bash
# Backend tests
cd app-tier/backend
pytest

# Frontend tests
cd web-tier/frontend
npm test
```

## Migration from V1

The new architecture is a complete rewrite. To migrate data from the old SQLite-based system:

1. Export data from old system
2. Run migration script (to be provided)
3. Import into PostgreSQL
4. Verify data integrity

## Cost Optimization

### Estimated Monthly Costs (AWS Lightsail)
- Web Tier: $10-20 (2GB RAM, 1 vCPU)
- Application Tier: $40-80 (8GB RAM, 2 vCPU)
- AI Tier: $40-80 (8GB RAM, 2 vCPU)
- **Total: ~$90-180/month**

Compare to AWS managed services:
- ECS Fargate: $200-400/month
- RDS: $100-300/month
- ElastiCache: $50-150/month
- **Savings: 60-90%**

## Support & Troubleshooting

### Common Issues

1. **Connection refused errors**: Check network connectivity between tiers
2. **Database connection errors**: Verify PostgreSQL is healthy
3. **AI service timeout**: Check AI tier resources and health
4. **Frontend not loading**: Verify Nginx configuration and backend URL

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
docker-compose up
```

## License

ISC

## Contributing

Please read CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.
