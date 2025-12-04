const express = require('express');
const router = express.Router();
const WorkspaceUsage = require('../models/WorkspaceUsage');

// Get all usage data with filters
router.get('/', (req, res) => {
  try {
    const filters = {
      workspace_id: req.query.workspace_id,
      month: req.query.month,
      month_from: req.query.month_from,
      month_to: req.query.month_to,
      user_name: req.query.user_name,
      limit: req.query.limit || 100,
      offset: req.query.offset || 0
    };

    const usage = WorkspaceUsage.getAll(filters);

    res.json({
      data: usage,
      limit: parseInt(filters.limit, 10),
      offset: parseInt(filters.offset, 10)
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage data' });
  }
});

// Get usage for a specific workspace
router.get('/workspace/:workspaceId', (req, res) => {
  try {
    const usage = WorkspaceUsage.getByWorkspaceId(req.params.workspaceId);
    res.json({ data: usage });
  } catch (error) {
    console.error('Error fetching workspace usage:', error);
    res.status(500).json({ error: 'Failed to fetch workspace usage' });
  }
});

// Get monthly summary
router.get('/summary/:month', (req, res) => {
  try {
    const summary = WorkspaceUsage.getMonthlySummary(req.params.month);
    res.json(summary);
  } catch (error) {
    console.error('Error fetching usage summary:', error);
    res.status(500).json({ error: 'Failed to fetch usage summary' });
  }
});

module.exports = router;
