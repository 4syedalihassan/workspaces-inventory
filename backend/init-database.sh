#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."

# Wait for PostgreSQL to start (using simple counter instead of seq)
COUNT=0
while [ $COUNT -lt 60 ]; do
  if /usr/lib/postgresql15/bin/pg_isready -h localhost -p 5432 -U postgres >/dev/null 2>&1; then
    echo "PostgreSQL is ready!"
    break
  fi
  COUNT=$((COUNT + 1))
  echo "Waiting... ($COUNT/60)"
  sleep 1
done

# Create database if it doesn't exist
echo "Creating database if needed..."
/usr/lib/postgresql15/bin/psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'workspaces'" | grep -q 1 || \
  /usr/lib/postgresql15/bin/psql -U postgres -c "CREATE DATABASE workspaces"

echo "Database 'workspaces' is ready!"

# Run the user initialization script
if [ -f /docker-entrypoint-initdb.d/init-db.sh ]; then
  echo "Running user initialization..."
  /bin/sh /docker-entrypoint-initdb.d/init-db.sh
fi

echo "Database initialization complete!"
