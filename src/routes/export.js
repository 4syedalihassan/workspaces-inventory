const express = require('express');
const router = express.Router();
const ExportService = require('../services/ExportService');

// Export workspaces to Excel
router.get('/workspaces/excel', async (req, res) => {
  try {
    const filters = {
      user_name: req.query.user_name,
      state: req.query.state,
      bundle_id: req.query.bundle_id,
      running_mode: req.query.running_mode,
      created_from: req.query.created_from,
      created_to: req.query.created_to,
      terminated: req.query.terminated
    };

    const workbook = await ExportService.exportWorkspacesToExcel(filters);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=workspaces_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting workspaces to Excel:', error);
    res.status(500).json({ error: 'Failed to export workspaces' });
  }
});

// Export workspaces to CSV
router.get('/workspaces/csv', (req, res) => {
  try {
    const filters = {
      user_name: req.query.user_name,
      state: req.query.state,
      bundle_id: req.query.bundle_id,
      running_mode: req.query.running_mode,
      created_from: req.query.created_from,
      created_to: req.query.created_to,
      terminated: req.query.terminated
    };

    const csv = ExportService.workspacesToCSV(filters);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=workspaces_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting workspaces to CSV:', error);
    res.status(500).json({ error: 'Failed to export workspaces' });
  }
});

// Export usage to Excel
router.get('/usage/excel', async (req, res) => {
  try {
    const filters = {
      workspace_id: req.query.workspace_id,
      month: req.query.month,
      month_from: req.query.month_from,
      month_to: req.query.month_to,
      user_name: req.query.user_name
    };

    const workbook = await ExportService.exportUsageToExcel(filters);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=usage_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting usage to Excel:', error);
    res.status(500).json({ error: 'Failed to export usage data' });
  }
});

// Export usage to CSV
router.get('/usage/csv', (req, res) => {
  try {
    const filters = {
      workspace_id: req.query.workspace_id,
      month: req.query.month,
      month_from: req.query.month_from,
      month_to: req.query.month_to,
      user_name: req.query.user_name
    };

    const csv = ExportService.usageToCSV(filters);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=usage_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting usage to CSV:', error);
    res.status(500).json({ error: 'Failed to export usage data' });
  }
});

// Export billing to Excel
router.get('/billing/excel', async (req, res) => {
  try {
    const filters = {
      workspace_id: req.query.workspace_id,
      service: req.query.service,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      user_name: req.query.user_name
    };

    const workbook = await ExportService.exportBillingToExcel(filters);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=billing_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting billing to Excel:', error);
    res.status(500).json({ error: 'Failed to export billing data' });
  }
});

// Export billing to CSV
router.get('/billing/csv', (req, res) => {
  try {
    const filters = {
      workspace_id: req.query.workspace_id,
      service: req.query.service,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      user_name: req.query.user_name
    };

    const csv = ExportService.billingToCSV(filters);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=billing_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting billing to CSV:', error);
    res.status(500).json({ error: 'Failed to export billing data' });
  }
});

// Export CloudTrail events to Excel
router.get('/cloudtrail/excel', async (req, res) => {
  try {
    const filters = {
      event_name: req.query.event_name,
      workspace_id: req.query.workspace_id,
      event_from: req.query.event_from,
      event_to: req.query.event_to
    };

    const workbook = await ExportService.exportCloudTrailToExcel(filters);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=cloudtrail_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting CloudTrail to Excel:', error);
    res.status(500).json({ error: 'Failed to export CloudTrail events' });
  }
});

module.exports = router;
