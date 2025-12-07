#!/bin/bash
set -e

# Start PostgreSQL in the background
/usr/bin/postgres -D /var/lib/postgresql/data &
POSTGRES_PID=$!

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to start..."
for i in {1..30}; do
  if pg_isready -h localhost -p 5432 -U postgres > /dev/null 2>&1; then
    echo "PostgreSQL is ready!"
    break
  fi
  echo "Waiting... ($i/30)"
  sleep 1
done

# Create database if it doesn't exist
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'workspaces'" | grep -q 1 || \
  psql -U postgres -c "CREATE DATABASE workspaces"

echo "Database 'workspaces' is ready!"

# Keep PostgreSQL running in foreground
wait $POSTGRES_PID
