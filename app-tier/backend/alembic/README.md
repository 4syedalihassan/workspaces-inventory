# Alembic Database Migrations

This directory contains database migration scripts for the PostgreSQL database.

## Commands

### Create a new migration

```bash
docker-compose exec backend alembic revision --autogenerate -m "Description of changes"
```

### Apply migrations

```bash
# Upgrade to latest
docker-compose exec backend alembic upgrade head

# Upgrade to specific revision
docker-compose exec backend alembic upgrade <revision>

# Downgrade one revision
docker-compose exec backend alembic downgrade -1
```

### View migration history

```bash
docker-compose exec backend alembic history
docker-compose exec backend alembic current
```

## Initial Setup

The initial migration creates all tables based on the models in `app/models/models.py`.

To generate the initial migration:

```bash
docker-compose exec backend alembic revision --autogenerate -m "Initial schema"
```
