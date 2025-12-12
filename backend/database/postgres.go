package database

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

// DB is the global database connection
var DB *sql.DB

// Connect establishes a connection to PostgreSQL
func Connect(databaseURL string) *sql.DB {
	// First, ensure the database exists
	ensureDatabaseExists(databaseURL)

	var err error
	DB, err = sql.Open("postgres", databaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Set connection pool settings
	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	// Test connection with retries
	maxRetries := 30
	for i := 0; i < maxRetries; i++ {
		err = DB.Ping()
		if err == nil {
			break
		}
		log.Printf("Waiting for database to be ready... (%d/%d)", i+1, maxRetries)
		time.Sleep(1 * time.Second)
	}

	if err != nil {
		log.Fatalf("Failed to ping database after %d retries: %v", maxRetries, err)
	}

	log.Println("Successfully connected to PostgreSQL")
	return DB
}

// ensureDatabaseExists creates the database if it doesn't exist
func ensureDatabaseExists(databaseURL string) {
	// Parse the database name from the URL
	// Format: postgresql://user:pass@host:port/dbname?params
	parts := strings.Split(databaseURL, "/")
	if len(parts) < 4 {
		log.Fatalf("Invalid database URL format")
	}

	dbNamePart := parts[len(parts)-1]
	dbName := strings.Split(dbNamePart, "?")[0]

	// Connect to default postgres database
	defaultURL := strings.Replace(databaseURL, "/"+dbNamePart, "/postgres"+strings.Split(dbNamePart, dbName)[1], 1)

	db, err := sql.Open("postgres", defaultURL)
	if err != nil {
		log.Fatalf("Failed to connect to postgres database: %v", err)
	}
	defer db.Close()

	// Wait for PostgreSQL to be ready
	maxRetries := 30
	for i := 0; i < maxRetries; i++ {
		err = db.Ping()
		if err == nil {
			break
		}
		log.Printf("Waiting for PostgreSQL to start... (%d/%d)", i+1, maxRetries)
		time.Sleep(1 * time.Second)
	}

	if err != nil {
		log.Fatalf("PostgreSQL not available after %d retries: %v", maxRetries, err)
	}

	// Check if database exists
	var exists bool
	query := fmt.Sprintf("SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = '%s')", dbName)
	err = db.QueryRow(query).Scan(&exists)
	if err != nil {
		log.Fatalf("Failed to check if database exists: %v", err)
	}

	if !exists {
		log.Printf("Database '%s' does not exist, creating it...", dbName)
		_, err = db.Exec(fmt.Sprintf("CREATE DATABASE %s", dbName))
		if err != nil {
			log.Fatalf("Failed to create database: %v", err)
		}
		log.Printf("Database '%s' created successfully", dbName)
	} else {
		log.Printf("Database '%s' already exists", dbName)
	}
}

// Close closes the database connection
func Close() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}

// RunMigrations executes all pending database migrations
func RunMigrations() error {
	// Create migrations table if it doesn't exist
	_, err := DB.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	// Get current version
	var currentVersion int
	err = DB.QueryRow("SELECT COALESCE(MAX(version), 0) FROM schema_migrations").Scan(&currentVersion)
	if err != nil {
		return fmt.Errorf("failed to get current migration version: %w", err)
	}

	log.Printf("Current database schema version: %d", currentVersion)

	// Run migrations
	migrations := []struct {
		version int
		sql     string
	}{
		{
			version: 1,
			sql: `
				CREATE TABLE IF NOT EXISTS workspaces (
					workspace_id VARCHAR(255) PRIMARY KEY,
					user_name VARCHAR(255),
					display_name VARCHAR(255),
					directory_id VARCHAR(255),
					ip_address VARCHAR(45),
					state VARCHAR(50),
					bundle_id VARCHAR(255),
					subnet_id VARCHAR(255),
					computer_name VARCHAR(255),
					running_mode VARCHAR(50),
					root_volume_size_gib INTEGER,
					user_volume_size_gib INTEGER,
					compute_type_name VARCHAR(100),
					created_at TIMESTAMP,
					terminated_at TIMESTAMP,
					last_known_user_connection_timestamp TIMESTAMP,
					created_by_user VARCHAR(255),
					terminated_by_user VARCHAR(255),
					tags JSONB,
					updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				);

				CREATE INDEX IF NOT EXISTS idx_workspaces_user_name ON workspaces(user_name);
				CREATE INDEX IF NOT EXISTS idx_workspaces_state ON workspaces(state);
				CREATE INDEX IF NOT EXISTS idx_workspaces_bundle_id ON workspaces(bundle_id);
				CREATE INDEX IF NOT EXISTS idx_workspaces_running_mode ON workspaces(running_mode);
				CREATE INDEX IF NOT EXISTS idx_workspaces_created_at ON workspaces(created_at);
			`,
		},
		{
			version: 2,
			sql: `
				CREATE TABLE IF NOT EXISTS workspace_usage (
					id SERIAL PRIMARY KEY,
					workspace_id VARCHAR(255) REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
					month VARCHAR(7) NOT NULL,
					usage_hours DECIMAL(10, 2) DEFAULT 0,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					UNIQUE(workspace_id, month)
				);

				CREATE INDEX IF NOT EXISTS idx_workspace_usage_month ON workspace_usage(month);
			`,
		},
		{
			version: 3,
			sql: `
				CREATE TABLE IF NOT EXISTS cloudtrail_events (
					id SERIAL PRIMARY KEY,
					event_id VARCHAR(255) UNIQUE,
					event_name VARCHAR(255),
					event_time TIMESTAMP,
					event_source VARCHAR(255),
					username VARCHAR(255),
					user_identity JSONB,
					workspace_id VARCHAR(255),
					request_parameters JSONB,
					response_elements JSONB,
					event_region VARCHAR(50),
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				);

				CREATE INDEX IF NOT EXISTS idx_cloudtrail_event_time ON cloudtrail_events(event_time);
				CREATE INDEX IF NOT EXISTS idx_cloudtrail_event_name ON cloudtrail_events(event_name);
				CREATE INDEX IF NOT EXISTS idx_cloudtrail_workspace_id ON cloudtrail_events(workspace_id);
			`,
		},
		{
			version: 4,
			sql: `
				CREATE TABLE IF NOT EXISTS billing_data (
					id SERIAL PRIMARY KEY,
					workspace_id VARCHAR(255),
					service VARCHAR(100),
					usage_type VARCHAR(255),
					start_date DATE,
					end_date DATE,
					amount DECIMAL(12, 2),
					unit VARCHAR(50),
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					UNIQUE(workspace_id, service, usage_type, start_date, end_date)
				);

				CREATE INDEX IF NOT EXISTS idx_billing_start_date ON billing_data(start_date);
				CREATE INDEX IF NOT EXISTS idx_billing_workspace_id ON billing_data(workspace_id);
			`,
		},
		{
			version: 5,
			sql: `
				CREATE TABLE IF NOT EXISTS sync_history (
					id SERIAL PRIMARY KEY,
					sync_type VARCHAR(50),
					status VARCHAR(20),
					records_processed INTEGER DEFAULT 0,
					error_message TEXT,
					started_at TIMESTAMP,
					completed_at TIMESTAMP,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				);

				CREATE INDEX IF NOT EXISTS idx_sync_history_created_at ON sync_history(created_at);
			`,
		},
		{
			version: 6,
			sql: `
				CREATE TABLE IF NOT EXISTS users (
					id SERIAL PRIMARY KEY,
					username VARCHAR(255) UNIQUE NOT NULL,
					email VARCHAR(255) UNIQUE NOT NULL,
					password_hash VARCHAR(255),
					role VARCHAR(50) DEFAULT 'USER',
					duo_verified BOOLEAN DEFAULT false,
					last_login TIMESTAMP,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				);

				CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
				CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
			`,
		},
		{
			version: 7,
			sql: `
				CREATE TABLE IF NOT EXISTS settings (
					id SERIAL PRIMARY KEY,
					key VARCHAR(255) UNIQUE NOT NULL,
					value TEXT,
					encrypted BOOLEAN DEFAULT false,
					category VARCHAR(100),
					description TEXT,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				);

				CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
				CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);

				-- Insert default settings
				INSERT INTO settings (key, value, encrypted, category, description) VALUES
					('aws.region', 'us-east-1', false, 'aws', 'AWS Region for WorkSpaces'),
					('aws.access_key_id', '', true, 'aws', 'AWS Access Key ID'),
					('aws.secret_access_key', '', true, 'aws', 'AWS Secret Access Key'),
					('duo.integration_key', '', true, 'duo', 'DUO Integration Key'),
					('duo.secret_key', '', true, 'duo', 'DUO Secret Key'),
					('duo.api_hostname', '', false, 'duo', 'DUO API Hostname'),
					('sync.auto_sync_enabled', 'false', false, 'sync', 'Enable automatic synchronization'),
					('sync.interval_minutes', '60', false, 'sync', 'Sync interval in minutes'),
					('ad.domain', '', false, 'active_directory', 'Active Directory Domain'),
					('ad.server_url', '', false, 'active_directory', 'AD Server URL (ldap://dc.example.com)'),
					('ad.base_dn', '', false, 'active_directory', 'Base DN (DC=example,DC=com)'),
					('ad.bind_username', '', false, 'active_directory', 'AD Bind Username'),
					('ad.bind_password', '', true, 'active_directory', 'AD Bind Password'),
					('ad.sync_enabled', 'false', false, 'active_directory', 'Enable AD user sync'),
					('notifications.email_enabled', 'false', false, 'notifications', 'Enable email notifications'),
					('notifications.smtp_host', '', false, 'notifications', 'SMTP Server Host'),
					('notifications.smtp_port', '587', false, 'notifications', 'SMTP Server Port'),
					('notifications.smtp_username', '', false, 'notifications', 'SMTP Username'),
					('notifications.smtp_password', '', true, 'notifications', 'SMTP Password'),
					('notifications.from_email', '', false, 'notifications', 'From Email Address'),
					('app.company_name', 'WorkSpaces Inventory', false, 'general', 'Company name'),
					('app.default_timezone', 'UTC', false, 'general', 'Default timezone')
				ON CONFLICT (key) DO NOTHING;
			`,
		},
		{
			version: 8,
			sql: `
				CREATE TABLE IF NOT EXISTS notifications (
					id SERIAL PRIMARY KEY,
					event_type VARCHAR(50) NOT NULL,
					workspace_id VARCHAR(255),
					workspace_user VARCHAR(255),
					title VARCHAR(255) NOT NULL,
					message TEXT NOT NULL,
					severity VARCHAR(20) DEFAULT 'info',
					read BOOLEAN DEFAULT false,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					metadata JSONB
				);

				CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
				CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id ON notifications(workspace_id);
				CREATE INDEX IF NOT EXISTS idx_notifications_event_type ON notifications(event_type);
				CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

				-- Notification preferences table
				CREATE TABLE IF NOT EXISTS notification_preferences (
					id SERIAL PRIMARY KEY,
					user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
					email_enabled BOOLEAN DEFAULT true,
					notify_on_create BOOLEAN DEFAULT true,
					notify_on_terminate BOOLEAN DEFAULT true,
					notify_on_modify BOOLEAN DEFAULT true,
					notify_on_state_change BOOLEAN DEFAULT true,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					UNIQUE(user_id)
				);
			`,
		},
		{
			version: 9,
			sql: `
				-- Add Active Directory sync fields to workspaces
				ALTER TABLE workspaces
					ADD COLUMN IF NOT EXISTS ad_full_name VARCHAR(255),
					ADD COLUMN IF NOT EXISTS ad_email VARCHAR(255),
					ADD COLUMN IF NOT EXISTS ad_department VARCHAR(255),
					ADD COLUMN IF NOT EXISTS ad_job_title VARCHAR(255),
					ADD COLUMN IF NOT EXISTS ad_manager VARCHAR(255),
					ADD COLUMN IF NOT EXISTS ad_last_sync TIMESTAMP;

				CREATE INDEX IF NOT EXISTS idx_workspaces_ad_full_name ON workspaces(ad_full_name);
				CREATE INDEX IF NOT EXISTS idx_workspaces_ad_email ON workspaces(ad_email);
				CREATE INDEX IF NOT EXISTS idx_workspaces_ad_department ON workspaces(ad_department);

				-- Add display tracking fields
				ALTER TABLE workspaces
					ADD COLUMN IF NOT EXISTS previous_state VARCHAR(50),
					ADD COLUMN IF NOT EXISTS state_changed_at TIMESTAMP;
			`,
		},
		{
			version: 10,
			sql: `
				-- Create aws_accounts table for managing multiple AWS accounts
				CREATE TABLE IF NOT EXISTS aws_accounts (
					id SERIAL PRIMARY KEY,
					name VARCHAR(255) NOT NULL,
					account_id VARCHAR(12),
					region VARCHAR(50) NOT NULL DEFAULT 'us-east-1',
					access_key_id TEXT NOT NULL,
					secret_access_key TEXT NOT NULL,
					is_default BOOLEAN DEFAULT false,
					is_active BOOLEAN DEFAULT true,
					status VARCHAR(50) DEFAULT 'pending',
					last_sync TIMESTAMP,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					UNIQUE(name)
				);

				-- Create index on is_default for quick lookups
				CREATE INDEX IF NOT EXISTS idx_aws_accounts_default ON aws_accounts(is_default) WHERE is_default = true;

				-- Create index on is_active
				CREATE INDEX IF NOT EXISTS idx_aws_accounts_active ON aws_accounts(is_active);

				-- Ensure only one default account
				CREATE UNIQUE INDEX IF NOT EXISTS idx_aws_accounts_one_default ON aws_accounts(is_default) WHERE is_default = true;

				-- Add updated_at trigger
				CREATE OR REPLACE FUNCTION update_aws_accounts_updated_at()
				RETURNS TRIGGER AS $$
				BEGIN
					NEW.updated_at = CURRENT_TIMESTAMP;
					RETURN NEW;
				END;
				$$ LANGUAGE plpgsql;

				DROP TRIGGER IF EXISTS aws_accounts_updated_at ON aws_accounts;
				CREATE TRIGGER aws_accounts_updated_at
					BEFORE UPDATE ON aws_accounts
					FOR EACH ROW
					EXECUTE FUNCTION update_aws_accounts_updated_at();
			`,
		},
		{
			version: 11,
			sql: `
				-- Add aws_account_id to workspaces table to track which account each workspace belongs to
				ALTER TABLE workspaces
					ADD COLUMN IF NOT EXISTS aws_account_id INTEGER REFERENCES aws_accounts(id) ON DELETE SET NULL;

				-- Create index for faster lookups
				CREATE INDEX IF NOT EXISTS idx_workspaces_aws_account_id ON workspaces(aws_account_id);

				-- Add aws_account_id to other tables for multi-account support
				ALTER TABLE cloudtrail_events
					ADD COLUMN IF NOT EXISTS aws_account_id INTEGER REFERENCES aws_accounts(id) ON DELETE SET NULL;

				ALTER TABLE billing_data
					ADD COLUMN IF NOT EXISTS aws_account_id INTEGER REFERENCES aws_accounts(id) ON DELETE SET NULL;

				CREATE INDEX IF NOT EXISTS idx_cloudtrail_aws_account_id ON cloudtrail_events(aws_account_id);
				CREATE INDEX IF NOT EXISTS idx_billing_aws_account_id ON billing_data(aws_account_id);
			`,
		},
	}

	for _, migration := range migrations {
		if migration.version > currentVersion {
			log.Printf("Running migration version %d...", migration.version)

			tx, err := DB.Begin()
			if err != nil {
				return fmt.Errorf("failed to start transaction: %w", err)
			}

			_, err = tx.Exec(migration.sql)
			if err != nil {
				tx.Rollback()
				return fmt.Errorf("failed to run migration %d: %w", migration.version, err)
			}

			_, err = tx.Exec("INSERT INTO schema_migrations (version) VALUES ($1)", migration.version)
			if err != nil {
				tx.Rollback()
				return fmt.Errorf("failed to record migration %d: %w", migration.version, err)
			}

			if err = tx.Commit(); err != nil {
				return fmt.Errorf("failed to commit migration %d: %w", migration.version, err)
			}

			log.Printf("Migration version %d completed successfully", migration.version)
		}
	}

	log.Println("All database migrations completed")
	return nil
}
