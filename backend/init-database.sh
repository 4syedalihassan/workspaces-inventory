#!/bin/sh
set -e

# PostgreSQL binaries are in /usr/lib/postgresql15/bin on Alpine
PG_ISREADY="/usr/lib/postgresql15/bin/pg_isready"
PSQL="/usr/lib/postgresql15/bin/psql"

echo "Waiting for PostgreSQL to be ready..."

# Wait for PostgreSQL to start
for i in $(seq 1 60); do
  if $PG_ISREADY -h localhost -p 5432 -U postgres > /dev/null 2>&1; then
    echo "PostgreSQL is ready!"
    break
  fi
  echo "Waiting... ($i/60)"
  sleep 1
done

# Create database if it doesn't exist
echo "Creating database if needed..."
$PSQL -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'workspaces'" | grep -q 1 || \
  $PSQL -U postgres -c "CREATE DATABASE workspaces"

echo "Database 'workspaces' is ready!"

# Run the user initialization script
if [ -f /docker-entrypoint-initdb.d/init-db.sh ]; then
  echo "Running user initialization..."
  sh /docker-entrypoint-initdb.d/init-db.sh
fi

echo "Database initialization complete!"
