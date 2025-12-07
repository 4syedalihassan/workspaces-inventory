#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."

# Wait for PostgreSQL to start
for i in $(seq 1 60); do
  if /usr/bin/pg_isready -h localhost -p 5432 -U postgres > /dev/null 2>&1; then
    echo "PostgreSQL is ready!"
    break
  fi
  echo "Waiting... ($i/60)"
  sleep 1
done

# Create database if it doesn't exist
echo "Creating database if needed..."
/usr/bin/psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'workspaces'" | grep -q 1 || \
  /usr/bin/psql -U postgres -c "CREATE DATABASE workspaces"

echo "Database 'workspaces' is ready!"

# Run the user initialization script
if [ -f /docker-entrypoint-initdb.d/init-db.sh ]; then
  echo "Running user initialization..."
  sh /docker-entrypoint-initdb.d/init-db.sh
fi

echo "Database initialization complete!"
