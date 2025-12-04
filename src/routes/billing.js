const express = require('express');
const router = express.Router();
const BillingData = require('../models/BillingData');

// Get all billing data with filters
router.get('/', (req, res) => {
  try {
    const filters = {
      workspace_id: req.query.workspace_id,
      service: req.query.service,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      user_name: req.query.user_name,
      limit: req.query.limit || 100,
      offset: req.query.offset || 0
    };

    const billing = BillingData.getAll(filters);

    res.json({
      data: billing,
      limit: parseInt(filters.limit, 10),
      offset: parseInt(filters.offset, 10)
    });
  } catch (error) {
    console.error('Error fetching billing:', error);
    res.status(500).json({ error: 'Failed to fetch billing data' });
  }
});

// Get monthly summary
router.get('/summary', (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    const summary = BillingData.getMonthlySummary(start_date, end_date);
    res.json({ data: summary });
  } catch (error) {
    console.error('Error fetching billing summary:', error);
    res.status(500).json({ error: 'Failed to fetch billing summary' });
  }
});

// Get available services
router.get('/services', (req, res) => {
  try {
    const services = BillingData.getServices();
    res.json({ data: services.map(s => s.service) });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

module.exports = router;
