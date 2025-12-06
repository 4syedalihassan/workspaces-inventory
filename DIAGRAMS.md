# AWS WorkSpaces Inventory - Architecture Diagrams

## Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           INTERNET / USERS                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTPS (443)
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                        WEB TIER (Lightsail 1)                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     Nginx Web Server                          │  │
│  │  - Static file serving                                        │  │
│  │  - SSL/TLS termination                                        │  │
│  │  - Reverse proxy to API                                       │  │
│  │  - Security headers                                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              React Single Page Application                    │  │
│  │  - Modern responsive UI                                       │  │
│  │  - TailwindCSS styling                                        │  │
│  │  - Client-side routing                                        │  │
│  │  - API integration                                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Ports: 80 (HTTP), 443 (HTTPS)                                      │
│  Public: Yes                                                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTP (Internal Network)
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                    APPLICATION TIER (Lightsail 2)                   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    FastAPI Backend                            │  │
│  │  - RESTful API endpoints                                      │  │
│  │  - JWT authentication                                         │  │
│  │  - Business logic                                             │  │
│  │  - AWS API integration                                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  PostgreSQL Database                          │  │
│  │  - Workspaces inventory                                       │  │
│  │  - User management                                            │  │
│  │  - Usage & billing data                                       │  │
│  │  - Audit logs                                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     Redis Cache                               │  │
│  │  - Session storage                                            │  │
│  │  - API response cache                                         │  │
│  │  - Celery message broker                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Celery Worker & Beat                             │  │
│  │  - Background tasks                                           │  │
│  │  - Report generation                                          │  │
│  │  - Scheduled AWS sync                                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Ports: 8000 (API), 5432 (DB), 6379 (Redis)                        │
│  Public: No (Internal only)                                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTP (Internal Network)
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│                        AI TIER (Lightsail 3)                        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                 Phi-3 Mini Model Server                       │  │
│  │  - Natural language processing                                │  │
│  │  - Query understanding                                        │  │
│  │  - Response generation                                        │  │
│  │  - C++ llama.cpp runtime                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Port: 11434 (AI API)                                               │
│  Public: No (Fully isolated)                                        │
└──────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌─────────┐     HTTPS      ┌─────────┐      HTTP      ┌──────────┐
│  User   │ ──────────────▶│   Web   │ ──────────────▶│   App    │
│ Browser │                │  Tier   │                │   Tier   │
└─────────┘                └─────────┘                └──────────┘
     │                          │                           │
     │                          │                           │
     │                          ▼                           │
     │                    ┌─────────┐                       │
     │                    │  React  │                       │
     │◀────────────────── │   SPA   │                       │
     │     HTML/JS/CSS    └─────────┘                       │
     │                                                       │
     │                                                       │
     │◀──────────────────────────────────────────────────────┤
     │              JSON API Response                        │
     │                                                       │
     │                                                       ▼
     │                                              ┌────────────────┐
     │                                              │   PostgreSQL   │
     │                                              │    Database    │
     │                                              └────────────────┘
     │                                                       │
     │                                                       │
     │                                              ┌────────▼───────┐
     │                                              │  Redis Cache   │
     │                                              └────────────────┘
     │                                                       │
     │                                                       │
     │                                              ┌────────▼───────┐
     │                                              │     Celery     │
     │                                              │     Worker     │
     │                                              └────────┬───────┘
     │                                                       │
     │                                                       │ HTTP
     │                                                       │
     │                                              ┌────────▼───────┐
     │                                              │   AI Service   │
     └──────────────────────────────────────────────┤   (Phi-3)      │
                    AI Query Response               └────────────────┘
```

## Network Security Diagram

```
Internet (0.0.0.0/0)
    │
    │ Port 80/443 ONLY
    │
    ▼
┌───────────────────────────────────────┐
│         Web Tier                      │
│  Firewall Rules:                      │
│  • Inbound: 80, 443 from 0.0.0.0/0   │
│  •          22 from admin IP only     │
│  • Outbound: App Tier IP only        │
└─────────────┬─────────────────────────┘
              │
              │ Internal Network
              │ Port 8000
              │
┌─────────────▼─────────────────────────┐
│      Application Tier                 │
│  Firewall Rules:                      │
│  • Inbound: 8000 from Web Tier only  │
│  •          22 from admin IP only     │
│  • Outbound: AI Tier + Internet      │
└─────────────┬─────────────────────────┘
              │
              │ Internal Network
              │ Port 11434
              │
┌─────────────▼─────────────────────────┐
│           AI Tier                     │
│  Firewall Rules:                      │
│  • Inbound: 11434 from App Tier only │
│  •          22 from admin IP only     │
│  • Outbound: NONE (fully isolated)   │
└───────────────────────────────────────┘
```

## Authentication Flow

```
┌──────┐                                    ┌─────────┐
│Client│                                    │ Backend │
└──┬───┘                                    └────┬────┘
   │                                             │
   │  POST /api/auth/login                      │
   │  {username, password}                      │
   ├────────────────────────────────────────────▶
   │                                             │
   │                                             │  Verify credentials
   │                                             │  (bcrypt hash check)
   │                                             │
   │                                             │  Generate JWT token
   │                                             │  (with user ID, role)
   │                                             │
   │  Response: {access_token, token_type}      │
   │◀────────────────────────────────────────────┤
   │                                             │
   │  Store token in localStorage                │
   │                                             │
   │  GET /api/workspaces                       │
   │  Header: Authorization: Bearer <token>     │
   ├────────────────────────────────────────────▶
   │                                             │
   │                                             │  Verify JWT signature
   │                                             │  Check expiration
   │                                             │  Extract user info
   │                                             │  Check permissions
   │                                             │
   │  Response: {workspaces: [...]}             │
   │◀────────────────────────────────────────────┤
   │                                             │
```

## AI Query Flow

```
┌──────┐       ┌─────────┐       ┌─────────┐       ┌──────────┐
│Client│       │   Web   │       │   App   │       │    AI    │
└──┬───┘       └────┬────┘       └────┬────┘       └────┬─────┘
   │                │                  │                  │
   │  User types    │                  │                  │
   │  query in UI   │                  │                  │
   │                │                  │                  │
   │ POST /api/ai/query                │                  │
   │ {query: "How many workspaces?"} │  │                  │
   ├────────────────┼──────────────────▶                  │
   │                │                  │                  │
   │                │                  │  Enrich query    │
   │                │                  │  with context    │
   │                │                  │  (DB data)       │
   │                │                  │                  │
   │                │                  │ POST /completion │
   │                │                  ├─────────────────▶│
   │                │                  │                  │
   │                │                  │                  │  Process with
   │                │                  │                  │  Phi-3 model
   │                │                  │                  │
   │                │                  │  Response        │
   │                │                  │◀─────────────────┤
   │                │                  │                  │
   │                │  Response        │                  │
   │◀───────────────┼──────────────────┤                  │
   │                │                  │                  │
   │  Display       │                  │                  │
   │  AI response   │                  │                  │
   │                │                  │                  │
```

## Database Schema Overview

```
┌─────────────┐
│    users    │
├─────────────┤
│ id          │
│ username    │
│ email       │
│ password    │
│ role        │
└─────────────┘

┌──────────────┐
│  workspaces  │
├──────────────┤
│ id           │
│ workspace_id │
│ user_name    │
│ state        │
│ bundle_id    │
│ created_time │
│ ...          │
└──────────────┘
        │
        │ 1:N
        ├────────────────┬────────────────┐
        │                │                │
┌───────▼──────┐ ┌──────▼──────┐ ┌───────▼────────┐
│workspace     │ │  billing_   │ │  cloudtrail_   │
│   _usage     │ │    data     │ │    events      │
├──────────────┤ ├─────────────┤ ├────────────────┤
│ workspace_id │ │workspace_id │ │ workspace_id   │
│ month        │ │ month       │ │ event_id       │
│ total_hours  │ │ cost        │ │ event_name     │
│ ...          │ │ ...         │ │ ...            │
└──────────────┘ └─────────────┘ └────────────────┘

┌──────────────┐
│sync_history  │
├──────────────┤
│ id           │
│ sync_type    │
│ status       │
│ started_at   │
│ ...          │
└──────────────┘

┌──────────────┐
│   reports    │
├──────────────┤
│ id           │
│ report_type  │
│ status       │
│ file_path    │
│ created_by   │
│ ...          │
└──────────────┘
```

## Deployment Topology Options

### Option 1: Single Server (Development)
```
┌─────────────────────────────────────┐
│        Single Lightsail Instance     │
│  ┌───────────────────────────────┐  │
│  │    All Services in Docker     │  │
│  │  • Nginx + React              │  │
│  │  • FastAPI                    │  │
│  │  • PostgreSQL                 │  │
│  │  • Redis                      │  │
│  │  • Celery                     │  │
│  │  • Phi-3 AI                   │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
Cost: ~$40/month
```

### Option 2: Three-Tier (Production)
```
┌─────────────────┐
│  Lightsail 1    │  $10/month
│  Web Tier       │  2GB RAM, 1 vCPU
│  • Nginx        │
│  • React        │
└─────────────────┘

┌─────────────────┐
│  Lightsail 2    │  $40/month
│  App Tier       │  8GB RAM, 2 vCPU
│  • FastAPI      │
│  • PostgreSQL   │
│  • Redis        │
│  • Celery       │
└─────────────────┘

┌─────────────────┐
│  Lightsail 3    │  $40/month
│  AI Tier        │  8GB RAM, 2 vCPU
│  • Phi-3        │
└─────────────────┘

Total: ~$90/month
```

## Monitoring & Health Checks

```
Every 30 seconds:

Web Tier:
  GET http://localhost/health
  ├─ Nginx status
  └─ React build integrity

Application Tier:
  GET http://localhost:8000/health
  ├─ FastAPI status
  ├─ PostgreSQL connection
  ├─ Redis connection
  └─ Celery worker status

AI Tier:
  GET http://localhost:11434/health
  ├─ AI service status
  └─ Model loaded status

If any health check fails:
  → Log error
  → Attempt automatic restart
  → Alert administrator
```

## Backup Strategy

```
Daily (2 AM):
┌──────────────────────────────────┐
│  PostgreSQL Database Backup      │
│  → pg_dump to S3                 │
│  → Keep 30 days history          │
└──────────────────────────────────┘

Weekly (Sunday 3 AM):
┌──────────────────────────────────┐
│  Full System Snapshot            │
│  → Lightsail snapshots           │
│  → Keep 4 weeks history          │
└──────────────────────────────────┘

On Configuration Change:
┌──────────────────────────────────┐
│  Configuration Backup            │
│  → .env files                    │
│  → Docker configs                │
│  → Nginx configs                 │
└──────────────────────────────────┘
```
