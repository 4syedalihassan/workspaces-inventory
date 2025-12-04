const express = require('express');
const router = express.Router();
const Workspace = require('../models/Workspace');
const CloudTrailService = require('../services/CloudTrailService');

// Get all workspaces with filters
router.get('/', (req, res) => {
  try {
    const filters = {
      user_name: req.query.user_name,
      state: req.query.state,
      bundle_id: req.query.bundle_id,
      running_mode: req.query.running_mode,
      created_from: req.query.created_from,
      created_to: req.query.created_to,
      terminated: req.query.terminated,
      limit: req.query.limit || 100,
      offset: req.query.offset || 0
    };

    const workspaces = Workspace.getAll(filters);
    const count = Workspace.getCount(filters);

    res.json({
      data: workspaces,
      total: count.count,
      limit: parseInt(filters.limit, 10),
      offset: parseInt(filters.offset, 10)
    });
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

// Get workspace by ID with detailed info
router.get('/:id', (req, res) => {
  try {
    const workspace = Workspace.getById(req.params.id);
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Enrich with creation/termination info from CloudTrail
    const creationInfo = CloudTrailService.getCreationInfo(req.params.id);
    const terminationInfo = CloudTrailService.getTerminationInfo(req.params.id);
    const history = CloudTrailService.getWorkspaceHistory(req.params.id);

    res.json({
      ...workspace,
      tags: JSON.parse(workspace.tags || '{}'),
      creation_info: creationInfo,
      termination_info: terminationInfo,
      history: history.slice(0, 20) // Last 20 events
    });
  } catch (error) {
    console.error('Error fetching workspace:', error);
    res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

// Get filter options
router.get('/filters/options', (req, res) => {
  try {
    const states = Workspace.getStates();
    const bundles = Workspace.getBundles();
    const runningModes = Workspace.getRunningModes();

    res.json({
      states: states.map(s => s.state),
      bundles: bundles.map(b => b.bundle_id),
      running_modes: runningModes.map(r => r.running_mode)
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({ error: 'Failed to fetch filter options' });
  }
});

module.exports = router;
