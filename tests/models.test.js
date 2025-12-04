// Mock the database for testing
jest.mock('../src/models/database', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  
  db.exec(`
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
      tags TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workspace_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id TEXT NOT NULL,
      month TEXT NOT NULL,
      usage_hours REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(workspace_id, month)
    );

    CREATE TABLE IF NOT EXISTS cloudtrail_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT UNIQUE,
      event_name TEXT NOT NULL,
      event_time TEXT NOT NULL,
      event_source TEXT,
      aws_region TEXT,
      source_ip_address TEXT,
      user_identity TEXT,
      request_parameters TEXT,
      response_elements TEXT,
      workspace_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

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

    CREATE TABLE IF NOT EXISTS sync_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_type TEXT NOT NULL,
      status TEXT NOT NULL,
      records_processed INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    );
  `);
  
  return db;
});

const Workspace = require('../src/models/Workspace');
const WorkspaceUsage = require('../src/models/WorkspaceUsage');
const CloudTrailEvent = require('../src/models/CloudTrailEvent');
const BillingData = require('../src/models/BillingData');
const SyncHistory = require('../src/models/SyncHistory');

describe('Workspace Model', () => {
  beforeEach(() => {
    // Clear data before each test
    const db = require('../src/models/database');
    db.exec('DELETE FROM workspaces');
  });

  test('upsert creates a new workspace', () => {
    const result = Workspace.upsert({
      id: 'ws-new001',
      directory_id: 'd-test',
      user_name: 'newuser',
      ip_address: '10.0.0.10',
      state: 'AVAILABLE',
      bundle_id: 'wsb-new',
      subnet_id: 'subnet-test',
      computer_name: 'AMAZON-NEW',
      running_mode: 'AUTO_STOP',
      running_mode_auto_stop_timeout_in_minutes: 60,
      root_volume_size_gib: 80,
      user_volume_size_gib: 50,
      created_at: '2024-01-01T00:00:00Z',
      terminated_at: null,
      last_known_user_connection_timestamp: null,
      tags: { Name: 'New' }
    });

    expect(result.changes).toBe(1);
  });

  test('upsert updates an existing workspace', () => {
    Workspace.upsert({
      id: 'ws-update001',
      user_name: 'user1',
      state: 'AVAILABLE',
      running_mode: 'AUTO_STOP'
    });

    Workspace.upsert({
      id: 'ws-update001',
      user_name: 'user1',
      state: 'STOPPED',
      running_mode: 'ALWAYS_ON'
    });

    const workspace = Workspace.getById('ws-update001');
    expect(workspace.state).toBe('STOPPED');
    expect(workspace.running_mode).toBe('ALWAYS_ON');
  });

  test('getById returns correct workspace', () => {
    Workspace.upsert({
      id: 'ws-get001',
      user_name: 'getuser',
      state: 'AVAILABLE'
    });

    const workspace = Workspace.getById('ws-get001');
    expect(workspace).toBeDefined();
    expect(workspace.user_name).toBe('getuser');
  });

  test('getById returns undefined for non-existent workspace', () => {
    const workspace = Workspace.getById('ws-nonexistent');
    expect(workspace).toBeUndefined();
  });

  test('getAll with filters works correctly', () => {
    Workspace.upsert({ id: 'ws-f1', user_name: 'alice', state: 'AVAILABLE', running_mode: 'AUTO_STOP' });
    Workspace.upsert({ id: 'ws-f2', user_name: 'bob', state: 'STOPPED', running_mode: 'AUTO_STOP' });
    Workspace.upsert({ id: 'ws-f3', user_name: 'charlie', state: 'AVAILABLE', running_mode: 'ALWAYS_ON' });

    // Filter by state
    const available = Workspace.getAll({ state: 'AVAILABLE' });
    expect(available).toHaveLength(2);

    // Filter by running_mode
    const autoStop = Workspace.getAll({ running_mode: 'AUTO_STOP' });
    expect(autoStop).toHaveLength(2);

    // Filter by user_name (partial match)
    const alice = Workspace.getAll({ user_name: 'lic' });
    expect(alice).toHaveLength(1);
    expect(alice[0].user_name).toBe('alice');
  });

  test('getCount returns correct count', () => {
    Workspace.upsert({ id: 'ws-c1', user_name: 'user1', state: 'AVAILABLE' });
    Workspace.upsert({ id: 'ws-c2', user_name: 'user2', state: 'STOPPED' });
    Workspace.upsert({ id: 'ws-c3', user_name: 'user3', state: 'AVAILABLE' });

    const total = Workspace.getCount({});
    expect(total.count).toBe(3);

    const available = Workspace.getCount({ state: 'AVAILABLE' });
    expect(available.count).toBe(2);
  });
});

describe('WorkspaceUsage Model', () => {
  beforeEach(() => {
    const db = require('../src/models/database');
    db.exec('DELETE FROM workspace_usage');
  });

  test('upsert creates usage record', () => {
    const result = WorkspaceUsage.upsert({
      workspace_id: 'ws-usage001',
      month: '2024-11',
      usage_hours: 100
    });

    expect(result.changes).toBe(1);
  });

  test('upsert updates existing usage record', () => {
    WorkspaceUsage.upsert({
      workspace_id: 'ws-usage002',
      month: '2024-11',
      usage_hours: 50
    });

    WorkspaceUsage.upsert({
      workspace_id: 'ws-usage002',
      month: '2024-11',
      usage_hours: 75
    });

    const usage = WorkspaceUsage.getByWorkspaceId('ws-usage002');
    expect(usage).toHaveLength(1);
    expect(usage[0].usage_hours).toBe(75);
  });

  test('getMonthlySummary calculates correctly', () => {
    WorkspaceUsage.upsert({ workspace_id: 'ws-s1', month: '2024-11', usage_hours: 100 });
    WorkspaceUsage.upsert({ workspace_id: 'ws-s2', month: '2024-11', usage_hours: 200 });
    WorkspaceUsage.upsert({ workspace_id: 'ws-s3', month: '2024-10', usage_hours: 300 });

    const summary = WorkspaceUsage.getMonthlySummary('2024-11');
    expect(summary.total_workspaces).toBe(2);
    expect(summary.total_hours).toBe(300);
    expect(summary.avg_hours).toBe(150);
  });
});

describe('CloudTrailEvent Model', () => {
  beforeEach(() => {
    const db = require('../src/models/database');
    db.exec('DELETE FROM cloudtrail_events');
  });

  test('insert creates event', () => {
    const result = CloudTrailEvent.insert({
      event_id: 'evt-001',
      event_name: 'CreateWorkspaces',
      event_time: '2024-01-01T00:00:00Z',
      event_source: 'workspaces.amazonaws.com',
      aws_region: 'us-east-1',
      source_ip_address: '1.2.3.4',
      user_identity: { userName: 'admin' },
      request_parameters: {},
      response_elements: {},
      workspace_id: 'ws-001'
    });

    expect(result.changes).toBe(1);
  });

  test('insert ignores duplicate event_id', () => {
    CloudTrailEvent.insert({
      event_id: 'evt-dup',
      event_name: 'CreateWorkspaces',
      event_time: '2024-01-01T00:00:00Z',
      workspace_id: 'ws-001'
    });

    const result = CloudTrailEvent.insert({
      event_id: 'evt-dup',
      event_name: 'TerminateWorkspaces',
      event_time: '2024-01-02T00:00:00Z',
      workspace_id: 'ws-001'
    });

    expect(result.changes).toBe(0);
  });

  test('getAll with filters works correctly', () => {
    CloudTrailEvent.insert({ event_id: 'evt-1', event_name: 'CreateWorkspaces', event_time: '2024-01-01T00:00:00Z', workspace_id: 'ws-001' });
    CloudTrailEvent.insert({ event_id: 'evt-2', event_name: 'TerminateWorkspaces', event_time: '2024-01-02T00:00:00Z', workspace_id: 'ws-001' });
    CloudTrailEvent.insert({ event_id: 'evt-3', event_name: 'CreateWorkspaces', event_time: '2024-01-03T00:00:00Z', workspace_id: 'ws-002' });

    const creates = CloudTrailEvent.getAll({ event_name: 'CreateWorkspaces' });
    expect(creates).toHaveLength(2);

    const ws001 = CloudTrailEvent.getByWorkspaceId('ws-001');
    expect(ws001).toHaveLength(2);
  });
});

describe('BillingData Model', () => {
  beforeEach(() => {
    const db = require('../src/models/database');
    db.exec('DELETE FROM billing_data');
  });

  test('upsert creates billing record', () => {
    const result = BillingData.upsert({
      workspace_id: 'ws-bill001',
      service: 'Amazon WorkSpaces',
      usage_type: 'AutoStop-Hours',
      start_date: '2024-11-01',
      end_date: '2024-11-30',
      amount: 50.00,
      unit: 'Hours',
      currency: 'USD'
    });

    expect(result.changes).toBe(1);
  });

  test('getMonthlySummary aggregates correctly', () => {
    BillingData.upsert({ workspace_id: 'ws-b1', service: 'Amazon WorkSpaces', usage_type: 'AutoStop', start_date: '2024-11-01', end_date: '2024-11-30', amount: 25 });
    BillingData.upsert({ workspace_id: 'ws-b2', service: 'Amazon WorkSpaces', usage_type: 'AlwaysOn', start_date: '2024-11-01', end_date: '2024-11-30', amount: 75 });

    const summary = BillingData.getMonthlySummary('2024-11-01', '2024-11-30');
    expect(summary).toHaveLength(1);
    expect(summary[0].total_amount).toBe(100);
  });
});

describe('SyncHistory Model', () => {
  beforeEach(() => {
    const db = require('../src/models/database');
    db.exec('DELETE FROM sync_history');
  });

  test('create and complete sync record', () => {
    const result = SyncHistory.create('workspaces');
    expect(result.lastInsertRowid).toBeDefined();

    SyncHistory.complete(result.lastInsertRowid, 100);

    const recent = SyncHistory.getRecent(1);
    expect(recent).toHaveLength(1);
    expect(recent[0].status).toBe('completed');
    expect(recent[0].records_processed).toBe(100);
  });

  test('create and fail sync record', () => {
    const result = SyncHistory.create('cloudtrail');
    SyncHistory.fail(result.lastInsertRowid, 'Connection timeout');

    const recent = SyncHistory.getRecent(1);
    expect(recent).toHaveLength(1);
    expect(recent[0].status).toBe('failed');
    expect(recent[0].error_message).toBe('Connection timeout');
  });

  test('getLastSuccessful returns correct record', () => {
    const r1 = SyncHistory.create('workspaces');
    SyncHistory.complete(r1.lastInsertRowid, 50);

    const r2 = SyncHistory.create('workspaces');
    SyncHistory.fail(r2.lastInsertRowid, 'Error');

    const last = SyncHistory.getLastSuccessful('workspaces');
    expect(last).toBeDefined();
    expect(last.status).toBe('completed');
    expect(last.records_processed).toBe(50);
  });
});
