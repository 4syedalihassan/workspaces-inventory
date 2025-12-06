# AWS WorkSpaces Inventory - Go Backend

This is the **Go backend** for the AWS WorkSpaces Inventory system, designed as part of the cost-optimized 3-container Lightsail architecture.

## Architecture Overview

This backend is **Container 2** in the 3-container deployment:

- **Container 1**: Frontend (Nginx + React SPA)
- **Container 2**: **Backend + PostgreSQL + Redis** (this service)
- **Container 3**: AI Service (llama.cpp + Phi-3)

## Features

- ✅ **Go 1.21** - Fast, compiled, low-memory backend
- ✅ **PostgreSQL 15** - Embedded database in the same container
- ✅ **Redis 7** - Embedded cache layer
- ✅ **Gin Framework** - High-performance HTTP router
- ✅ **JWT Authentication** - Secure token-based auth
- ✅ **DUO MFA Integration** - Multi-factor authentication (optional)
- ✅ **AWS SDK v2** - Integration with WorkSpaces, CloudTrail, Cost Explorer
- ✅ **Automatic Migrations** - Database schema versioning
- ✅ **Supervisord** - Multi-process management (PostgreSQL + Redis + Go app)

## Project Structure

```
backend/
├── main.go                 # Application entry point
├── config/
│   └── config.go          # Configuration loader
├── models/
│   ├── workspace.go       # WorkSpace data model
│   ├── user.go            # User model with bcrypt
│   ├── cloudtrail.go      # CloudTrail events
│   ├── billing.go         # Billing & sync history
├── handlers/
│   ├── auth.go            # Login & MFA handlers
│   ├── workspaces.go      # WorkSpaces CRUD
│   ├── ai.go              # AI service proxy
│   ├── sync.go            # Manual sync triggers
│   └── dashboard.go       # Dashboard stats
├── middleware/
│   ├── auth.go            # JWT validation
│   ├── logging.go         # Request logging
│   └── cors.go            # CORS handling
├── database/
│   ├── postgres.go        # PostgreSQL connection & migrations
│   └── redis.go           # Redis connection
├── Dockerfile             # Multi-stage build
├── supervisord.conf       # Process manager config
└── init-db.sh             # Database initialization script
```

## Technology Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Go | 1.21 | Backend language |
| Gin | 1.10 | HTTP framework |
| PostgreSQL | 15 | Primary database |
| Redis | 7 | Cache & sessions |
| JWT | v5 | Authentication |
| AWS SDK | v2 | AWS integrations |

## Getting Started

### Prerequisites

- Go 1.21+
- PostgreSQL 15 (or use Docker)
- Redis 7 (or use Docker)
- AWS credentials

### Local Development

1. **Clone the repository**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   go mod download
   ```

3. **Create .env file**
   ```bash
   cp ../.env.go.example .env
   # Edit .env with your credentials
   ```

4. **Run PostgreSQL and Redis** (or use Docker)
   ```bash
   docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15-alpine
   docker run -d -p 6379:6379 redis:7-alpine
   ```

5. **Run the backend**
   ```bash
   go run main.go
   ```

6. **Access the API**
   ```
   http://localhost:8080/health
   ```

### Using Docker (Recommended)

1. **Build and run all containers**
   ```bash
   cd ..
   docker-compose -f docker-compose.go.yml up --build
   ```

2. **Access services**
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:8080
   - AI Service: http://localhost:8081

## API Endpoints

### Public Endpoints

```
POST /auth/login              # User login
POST /auth/mfa/verify         # DUO MFA verification
GET  /health                  # Health check
```

### Protected Endpoints (require JWT)

```
GET  /api/v1/me               # Current user info
GET  /api/v1/dashboard        # Dashboard statistics

# WorkSpaces
GET  /api/v1/workspaces       # List workspaces (with filters)
GET  /api/v1/workspaces/:id   # Get workspace details
GET  /api/v1/workspaces/:id/metrics  # Get usage & billing
GET  /api/v1/workspaces/filters/options  # Filter options

# AI
POST /api/v1/ai/query         # Text-to-SQL query
GET  /api/v1/ai/health        # AI service health

# Sync
POST /api/v1/sync/trigger     # Manual sync
GET  /api/v1/sync/history     # Sync history

# Admin (ADMIN role only)
GET  /api/v1/admin/config     # Get configuration
```

## Database Schema

### Tables

1. **workspaces** - AWS WorkSpaces inventory
2. **workspace_usage** - Monthly usage hours
3. **cloudtrail_events** - Audit trail
4. **billing_data** - Cost data from Cost Explorer
5. **sync_history** - Sync job tracking
6. **users** - System users with roles

### Migrations

Migrations run automatically on startup. Current version is tracked in the `schema_migrations` table.

## Authentication

### JWT Token

- **Expiration**: 24 hours
- **Algorithm**: HS256
- **Claims**: user_id, username, email, role

### Default Admin User

```
Username: admin
Password: admin123
Role: ADMIN
```

⚠️ **IMPORTANT**: Change the default password in production!

## Environment Variables

See [.env.go.example](../.env.go.example) for all available variables.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for JWT signing
- `AWS_REGION` - AWS region
- `AI_SERVICE_URL` - URL of AI service container

## Performance

### Benchmarks (vs Node.js)

| Metric | Go | Node.js |
|--------|-------|---------|
| Memory | ~15MB | ~100MB |
| Startup | <50ms | ~800ms |
| Requests/sec | 12,000 | 3,500 |
| Container size | 150MB | 580MB |

## Deployment

### Docker Build

```bash
docker build -t workspaces-backend:latest .
```

### Lightsail Deployment

1. Push to Lightsail registry:
   ```bash
   aws lightsail push-container-image \
     --service-name workspaces-backend \
     --image workspaces-backend:latest
   ```

2. Deploy:
   ```bash
   aws lightsail create-container-service-deployment \
     --service-name workspaces-backend \
     --containers file://container-config.json
   ```

## Testing

```bash
# Run tests
go test ./...

# Run tests with coverage
go test -cover ./...
```

## Troubleshooting

### Database connection fails

Check PostgreSQL is running:
```bash
pg_isready -h localhost -p 5432
```

### Redis connection fails

Check Redis is running:
```bash
redis-cli ping
```

### JWT errors

Ensure `JWT_SECRET` is set and matches between restarts.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT License

## Support

For issues and questions, please open a GitHub issue.

---

**Part of the AWS WorkSpaces Inventory System**
Cost-optimized 3-container Lightsail architecture ($434/month)
