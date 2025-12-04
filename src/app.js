const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const config = require('./config');

// Initialize database first
require('./models/database');

// Import routes
const workspacesRoutes = require('./routes/workspaces');
const usageRoutes = require('./routes/usage');
const billingRoutes = require('./routes/billing');
const cloudtrailRoutes = require('./routes/cloudtrail');
const exportRoutes = require('./routes/export');
const syncRoutes = require('./routes/sync');

// Import services for scheduled sync
const WorkspacesService = require('./services/WorkspacesService');
const CloudTrailService = require('./services/CloudTrailService');
const BillingService = require('./services/BillingService');

const app = express();

// Rate limiting - 100 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware
app.use(limiter);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:"]
    }
  }
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/workspaces', workspacesRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/cloudtrail', cloudtrailRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/sync', syncRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dashboard stats
app.get('/api/dashboard', (req, res) => {
  try {
    const Workspace = require('./models/Workspace');
    const WorkspaceUsage = require('./models/WorkspaceUsage');
    const SyncHistory = require('./models/SyncHistory');

    const totalWorkspaces = Workspace.getCount({});
    const activeWorkspaces = Workspace.getCount({ state: 'AVAILABLE' });
    const lastSync = SyncHistory.getLastSuccessful('workspaces');

    // Get current month usage
    const currentMonth = new Date().toISOString().substring(0, 7);
    const usageSummary = WorkspaceUsage.getMonthlySummary(currentMonth);

    res.json({
      total_workspaces: totalWorkspaces.count,
      active_workspaces: activeWorkspaces.count,
      current_month_usage: usageSummary,
      last_sync: lastSync?.completed_at
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Serve frontend for all other routes (must be last)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Scheduled sync job
if (config.server.nodeEnv === 'production') {
  cron.schedule(config.sync.schedule, async () => {
    console.log('Starting scheduled data sync...');
    try {
      await WorkspacesService.syncWorkspaces();
      console.log('WorkSpaces sync completed');
    } catch (error) {
      console.error('WorkSpaces sync failed:', error.message);
    }

    try {
      await CloudTrailService.syncCloudTrailEvents(7);
      console.log('CloudTrail sync completed');
    } catch (error) {
      console.error('CloudTrail sync failed:', error.message);
    }

    try {
      await BillingService.syncBillingData(3);
      console.log('Billing sync completed');
    } catch (error) {
      console.error('Billing sync failed:', error.message);
    }
  });
}

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`WorkSpaces Inventory server running on port ${PORT}`);
  console.log(`Environment: ${config.server.nodeEnv}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
});

module.exports = app;
