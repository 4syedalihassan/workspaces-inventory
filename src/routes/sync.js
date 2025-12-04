const express = require('express');
const router = express.Router();
const WorkspacesService = require('../services/WorkspacesService');
const CloudTrailService = require('../services/CloudTrailService');
const BillingService = require('../services/BillingService');
const DirectoryService = require('../services/DirectoryService');
const SyncHistory = require('../models/SyncHistory');

// Sync all data
router.post('/all', async (req, res) => {
  try {
    const results = {
      workspaces: null,
      cloudtrail: null,
      billing: null,
      directory: null,
      workspacesCreationInfoUpdated: 0
    };

    // Sync WorkSpaces
    try {
      results.workspaces = await WorkspacesService.syncWorkspaces();
    } catch (error) {
      results.workspaces = { success: false, error: error.message };
    }

    // Sync CloudTrail events
    try {
      const daysBack = parseInt(req.query.cloudtrail_days, 10) || 7;
      results.cloudtrail = await CloudTrailService.syncCloudTrailEvents(daysBack);
    } catch (error) {
      results.cloudtrail = { success: false, error: error.message };
    }

    // Update workspaces with creation info from CloudTrail
    try {
      results.workspacesCreationInfoUpdated = CloudTrailService.updateWorkspacesCreationInfo();
    } catch (error) {
      console.error('Error updating workspace creation info:', error);
    }

    // Sync Billing data
    try {
      const monthsBack = parseInt(req.query.billing_months, 10) || 3;
      results.billing = await BillingService.syncBillingData(monthsBack);
    } catch (error) {
      results.billing = { success: false, error: error.message };
    }

    // Sync Directory Service user data
    try {
      results.directory = await DirectoryService.syncDirectoryUserData();
    } catch (error) {
      results.directory = { success: false, error: error.message };
    }

    res.json(results);
  } catch (error) {
    console.error('Error during sync:', error);
    res.status(500).json({ error: 'Failed to sync data' });
  }
});

// Sync WorkSpaces only
router.post('/workspaces', async (req, res) => {
  try {
    const result = await WorkspacesService.syncWorkspaces();
    res.json(result);
  } catch (error) {
    console.error('Error syncing workspaces:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync CloudTrail events only
router.post('/cloudtrail', async (req, res) => {
  try {
    const daysBack = parseInt(req.query.days, 10) || 7;
    const result = await CloudTrailService.syncCloudTrailEvents(daysBack);
    
    // Update workspaces with creation info from CloudTrail
    const creationInfoUpdated = CloudTrailService.updateWorkspacesCreationInfo();
    
    res.json({ ...result, workspacesCreationInfoUpdated: creationInfoUpdated });
  } catch (error) {
    console.error('Error syncing CloudTrail:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync Billing data only
router.post('/billing', async (req, res) => {
  try {
    const monthsBack = parseInt(req.query.months, 10) || 3;
    const result = await BillingService.syncBillingData(monthsBack);
    res.json(result);
  } catch (error) {
    console.error('Error syncing billing:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync Directory Service user data only
router.post('/directory', async (req, res) => {
  try {
    const result = await DirectoryService.syncDirectoryUserData();
    res.json(result);
  } catch (error) {
    console.error('Error syncing directory user data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get orphaned workspaces (user doesn't exist in directory)
router.get('/directory/orphaned', async (req, res) => {
  try {
    const orphaned = await DirectoryService.findOrphanedWorkspaces();
    res.json({ data: orphaned, count: orphaned.length });
  } catch (error) {
    console.error('Error finding orphaned workspaces:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get sync history
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const history = SyncHistory.getRecent(limit);
    res.json({ data: history });
  } catch (error) {
    console.error('Error fetching sync history:', error);
    res.status(500).json({ error: 'Failed to fetch sync history' });
  }
});

module.exports = router;
