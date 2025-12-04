const express = require('express');
const router = express.Router();
const CloudTrailEvent = require('../models/CloudTrailEvent');

// Get all CloudTrail events with filters
router.get('/', (req, res) => {
  try {
    const filters = {
      event_name: req.query.event_name,
      workspace_id: req.query.workspace_id,
      event_from: req.query.event_from,
      event_to: req.query.event_to,
      event_source: req.query.event_source,
      limit: req.query.limit || 100,
      offset: req.query.offset || 0
    };

    const events = CloudTrailEvent.getAll(filters);

    // Parse JSON fields
    const parsedEvents = events.map(event => ({
      ...event,
      user_identity: JSON.parse(event.user_identity || '{}'),
      request_parameters: JSON.parse(event.request_parameters || '{}'),
      response_elements: JSON.parse(event.response_elements || '{}')
    }));

    res.json({
      data: parsedEvents,
      limit: parseInt(filters.limit, 10),
      offset: parseInt(filters.offset, 10)
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch CloudTrail events' });
  }
});

// Get events for a specific workspace
router.get('/workspace/:workspaceId', (req, res) => {
  try {
    const events = CloudTrailEvent.getByWorkspaceId(req.params.workspaceId);
    
    const parsedEvents = events.map(event => ({
      ...event,
      user_identity: JSON.parse(event.user_identity || '{}'),
      request_parameters: JSON.parse(event.request_parameters || '{}'),
      response_elements: JSON.parse(event.response_elements || '{}')
    }));

    res.json({ data: parsedEvents });
  } catch (error) {
    console.error('Error fetching workspace events:', error);
    res.status(500).json({ error: 'Failed to fetch workspace events' });
  }
});

// Get available event names
router.get('/event-names', (req, res) => {
  try {
    const eventNames = CloudTrailEvent.getEventNames();
    res.json({ data: eventNames.map(e => e.event_name) });
  } catch (error) {
    console.error('Error fetching event names:', error);
    res.status(500).json({ error: 'Failed to fetch event names' });
  }
});

module.exports = router;
