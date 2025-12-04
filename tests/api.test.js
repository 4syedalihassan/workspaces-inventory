const request = require('supertest');

// Mock the database before requiring the app
jest.mock('../src/models/database', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  
  // Create tables in memory
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      directory_id TEXT,
      user_name TEXT NOT NULL,
      ip_address TEXT,
      state TEXT,
      bundle_id TEXT,
      subnet_id TEXT,
      computer_name TEXT,
      running_mode TEXT,
      running_mode_auto_stop_timeout_in_minutes INTEGER,
      root_volume_size_gib INTEGER,
      user_volume_size_gib INTEGER,
      created_at TEXT,
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

// Now require the models and app
const db = require('../src/models/database');
const Workspace = require('../src/models/Workspace');
const WorkspaceUsage = require('../src/models/WorkspaceUsage');
const CloudTrailEvent = require('../src/models/CloudTrailEvent');
const BillingData = require('../src/models/BillingData');

// Create a minimal express app for testing
const express = require('express');
const workspacesRoutes = require('../src/routes/workspaces');
const usageRoutes = require('../src/routes/usage');
const billingRoutes = require('../src/routes/billing');
const cloudtrailRoutes = require('../src/routes/cloudtrail');
const exportRoutes = require('../src/routes/export');

const app = express();
app.use(express.json());
app.use('/api/workspaces', workspacesRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/cloudtrail', cloudtrailRoutes);
app.use('/api/export', exportRoutes);

describe('API Tests', () => {
  beforeAll(() => {
    // Insert test data
    Workspace.upsert({
      id: 'ws-test001',
      directory_id: 'd-test',
      user_name: 'testuser1',
      ip_address: '10.0.0.1',
      state: 'AVAILABLE',
      bundle_id: 'wsb-test',
      subnet_id: 'subnet-test',
      computer_name: 'AMAZON-TEST1',
      running_mode: 'AUTO_STOP',
      running_mode_auto_stop_timeout_in_minutes: 60,
      root_volume_size_gib: 80,
      user_volume_size_gib: 50,
      created_at: '2024-01-15T10:00:00Z',
      terminated_at: null,
      last_known_user_connection_timestamp: '2024-11-20T15:30:00Z',
      tags: { Name: 'TestWorkspace' }
    });

    Workspace.upsert({
      id: 'ws-test002',
      directory_id: 'd-test',
      user_name: 'testuser2',
      ip_address: '10.0.0.2',
      state: 'STOPPED',
      bundle_id: 'wsb-test2',
      subnet_id: 'subnet-test',
      computer_name: 'AMAZON-TEST2',
      running_mode: 'ALWAYS_ON',
      running_mode_auto_stop_timeout_in_minutes: null,
      root_volume_size_gib: 175,
      user_volume_size_gib: 100,
      created_at: '2024-02-20T08:00:00Z',
      terminated_at: null,
      last_known_user_connection_timestamp: '2024-11-19T10:00:00Z',
      tags: {}
    });

    WorkspaceUsage.upsert({
      workspace_id: 'ws-test001',
      month: '2024-11',
      usage_hours: 45.5
    });

    WorkspaceUsage.upsert({
      workspace_id: 'ws-test002',
      month: '2024-11',
      usage_hours: 720
    });

    CloudTrailEvent.insert({
      event_id: 'event-001',
      event_name: 'CreateWorkspaces',
      event_time: '2024-01-15T10:00:00Z',
      event_source: 'workspaces.amazonaws.com',
      aws_region: 'us-east-1',
      source_ip_address: '203.0.113.1',
      user_identity: { userName: 'admin' },
      request_parameters: { WorkspaceId: 'ws-test001' },
      response_elements: {},
      workspace_id: 'ws-test001'
    });

    BillingData.upsert({
      workspace_id: 'ws-test001',
      service: 'Amazon WorkSpaces',
      usage_type: 'AutoStop-Hours',
      start_date: '2024-11-01',
      end_date: '2024-11-30',
      amount: 25.50,
      unit: 'Hours',
      currency: 'USD'
    });
  });

  describe('Workspaces API', () => {
    test('GET /api/workspaces should return all workspaces', async () => {
      const response = await request(app).get('/api/workspaces');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.total).toBe(2);
    });

    test('GET /api/workspaces with user_name filter', async () => {
      const response = await request(app).get('/api/workspaces?user_name=testuser1');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].user_name).toBe('testuser1');
    });

    test('GET /api/workspaces with state filter', async () => {
      const response = await request(app).get('/api/workspaces?state=AVAILABLE');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].state).toBe('AVAILABLE');
    });

    test('GET /api/workspaces with running_mode filter', async () => {
      const response = await request(app).get('/api/workspaces?running_mode=AUTO_STOP');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].running_mode).toBe('AUTO_STOP');
    });

    test('GET /api/workspaces/:id should return workspace details', async () => {
      const response = await request(app).get('/api/workspaces/ws-test001');
      
      expect(response.status).toBe(200);
      expect(response.body.id).toBe('ws-test001');
      expect(response.body.user_name).toBe('testuser1');
      expect(response.body.creation_info).toBeDefined();
    });

    test('GET /api/workspaces/:id returns 404 for non-existent workspace', async () => {
      const response = await request(app).get('/api/workspaces/ws-nonexistent');
      
      expect(response.status).toBe(404);
    });

    test('GET /api/workspaces/filters/options returns filter options', async () => {
      const response = await request(app).get('/api/workspaces/filters/options');
      
      expect(response.status).toBe(200);
      expect(response.body.states).toContain('AVAILABLE');
      expect(response.body.states).toContain('STOPPED');
      expect(response.body.running_modes).toContain('AUTO_STOP');
      expect(response.body.running_modes).toContain('ALWAYS_ON');
    });
  });

  describe('Usage API', () => {
    test('GET /api/usage should return usage data', async () => {
      const response = await request(app).get('/api/usage');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });

    test('GET /api/usage with month filter', async () => {
      const response = await request(app).get('/api/usage?month=2024-11');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });

    test('GET /api/usage/workspace/:workspaceId', async () => {
      const response = await request(app).get('/api/usage/workspace/ws-test001');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].usage_hours).toBe(45.5);
    });

    test('GET /api/usage/summary/:month', async () => {
      const response = await request(app).get('/api/usage/summary/2024-11');
      
      expect(response.status).toBe(200);
      expect(response.body.total_workspaces).toBe(2);
      expect(response.body.total_hours).toBe(765.5);
    });
  });

  describe('Billing API', () => {
    test('GET /api/billing should return billing data', async () => {
      const response = await request(app).get('/api/billing');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    test('GET /api/billing with workspace_id filter', async () => {
      const response = await request(app).get('/api/billing?workspace_id=ws-test001');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].amount).toBe(25.50);
    });
  });

  describe('CloudTrail API', () => {
    test('GET /api/cloudtrail should return events', async () => {
      const response = await request(app).get('/api/cloudtrail');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    test('GET /api/cloudtrail with event_name filter', async () => {
      const response = await request(app).get('/api/cloudtrail?event_name=CreateWorkspaces');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].event_name).toBe('CreateWorkspaces');
    });

    test('GET /api/cloudtrail/workspace/:workspaceId', async () => {
      const response = await request(app).get('/api/cloudtrail/workspace/ws-test001');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('Export API', () => {
    test('GET /api/export/workspaces/csv should return CSV', async () => {
      const response = await request(app).get('/api/export/workspaces/csv');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text).toContain('id,user_name');
      expect(response.text).toContain('ws-test001');
    });

    test('GET /api/export/workspaces/excel should return Excel file', async () => {
      const response = await request(app).get('/api/export/workspaces/excel');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('spreadsheetml');
    });

    test('GET /api/export/usage/csv should return CSV', async () => {
      const response = await request(app).get('/api/export/usage/csv');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });

    test('GET /api/export/billing/csv should return CSV', async () => {
      const response = await request(app).get('/api/export/billing/csv');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });
  });
});
