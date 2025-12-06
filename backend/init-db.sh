#!/bin/bash
set -e

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h localhost -p 5432 -U postgres; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is ready!"

# Create database if it doesn't exist
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'workspaces'" | grep -q 1 || \
  psql -U postgres -c "CREATE DATABASE workspaces"

echo "Database 'workspaces' is ready!"

# Create default admin user (password: admin123 - CHANGE IN PRODUCTION!)
# Password hash for 'admin123' using bcrypt
psql -U postgres -d workspaces -c "
  INSERT INTO users (username, email, password_hash, role)
  VALUES (
    'admin',
    'admin@example.com',
    '\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'ADMIN'
  )
  ON CONFLICT (username) DO NOTHING;
" || true

echo "Database initialization complete!"
