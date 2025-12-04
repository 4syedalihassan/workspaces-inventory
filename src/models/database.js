const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Ensure data directory exists
const dataDir = path.dirname(config.database.path);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(config.database.path);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  -- WorkSpaces table
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    directory_id TEXT,
    user_name TEXT NOT NULL,
    user_display_name TEXT,
    ip_address TEXT,
    state TEXT,
    bundle_id TEXT,
    compute_type TEXT,
    subnet_id TEXT,
    computer_name TEXT,
    running_mode TEXT,
    running_mode_auto_stop_timeout_in_minutes INTEGER,
    root_volume_size_gib INTEGER,
    user_volume_size_gib INTEGER,
    created_at TEXT,
    created_by TEXT,
    terminated_at TEXT,
    last_known_user_connection_timestamp TEXT,
    tags TEXT, -- JSON string
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Add new columns if they don't exist (for migration)
  -- SQLite doesn't have IF NOT EXISTS for ALTER TABLE, so we handle this in code

  -- WorkSpaces usage table (monthly usage hours)
  CREATE TABLE IF NOT EXISTS workspace_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL,
    month TEXT NOT NULL, -- YYYY-MM format
    usage_hours REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, month),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );

  -- CloudTrail events table
  CREATE TABLE IF NOT EXISTS cloudtrail_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE,
    event_name TEXT NOT NULL,
    event_time TEXT NOT NULL,
    event_source TEXT,
    aws_region TEXT,
    source_ip_address TEXT,
    user_identity TEXT, -- JSON string
    request_parameters TEXT, -- JSON string
    response_elements TEXT, -- JSON string
    workspace_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Billing/Cost data table
  CREATE TABLE IF NOT EXISTS billing_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT,
    service TEXT,
    usage_type TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    amount REAL,
    unit TEXT,
    currency TEXT DEFAULT 'USD',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, service, usage_type, start_date, end_date)
  );

  -- Sync history table
  CREATE TABLE IF NOT EXISTS sync_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_type TEXT NOT NULL,
    status TEXT NOT NULL,
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
  );

  -- Create indexes for better query performance
  CREATE INDEX IF NOT EXISTS idx_workspaces_user_name ON workspaces(user_name);
  CREATE INDEX IF NOT EXISTS idx_workspaces_state ON workspaces(state);
  CREATE INDEX IF NOT EXISTS idx_workspaces_bundle_id ON workspaces(bundle_id);
  CREATE INDEX IF NOT EXISTS idx_workspaces_running_mode ON workspaces(running_mode);
  CREATE INDEX IF NOT EXISTS idx_workspaces_created_at ON workspaces(created_at);
  CREATE INDEX IF NOT EXISTS idx_workspace_usage_month ON workspace_usage(month);
  CREATE INDEX IF NOT EXISTS idx_cloudtrail_event_time ON cloudtrail_events(event_time);
  CREATE INDEX IF NOT EXISTS idx_cloudtrail_event_name ON cloudtrail_events(event_name);
  CREATE INDEX IF NOT EXISTS idx_cloudtrail_workspace_id ON cloudtrail_events(workspace_id);
  CREATE INDEX IF NOT EXISTS idx_billing_start_date ON billing_data(start_date);
  CREATE INDEX IF NOT EXISTS idx_billing_workspace_id ON billing_data(workspace_id);
`);

// Migration: Add new columns to existing tables
// Check if columns exist and add them if they don't
const columns = db.pragma('table_info(workspaces)').map(col => col.name);

if (!columns.includes('user_display_name')) {
  try {
    db.exec('ALTER TABLE workspaces ADD COLUMN user_display_name TEXT');
  } catch (e) {
    // Log error if it's not about duplicate column
    if (!e.message.includes('duplicate column')) {
      console.error('Migration error adding user_display_name column:', e.message);
    }
  }
}

if (!columns.includes('compute_type')) {
  try {
    db.exec('ALTER TABLE workspaces ADD COLUMN compute_type TEXT');
  } catch (e) {
    // Log error if it's not about duplicate column
    if (!e.message.includes('duplicate column')) {
      console.error('Migration error adding compute_type column:', e.message);
    }
  }
}

if (!columns.includes('created_by')) {
  try {
    db.exec('ALTER TABLE workspaces ADD COLUMN created_by TEXT');
  } catch (e) {
    // Log error if it's not about duplicate column
    if (!e.message.includes('duplicate column')) {
      console.error('Migration error adding created_by column:', e.message);
    }
  }
}

module.exports = db;
