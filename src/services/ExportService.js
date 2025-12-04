const ExcelJS = require('exceljs');
const Workspace = require('../models/Workspace');
const WorkspaceUsage = require('../models/WorkspaceUsage');
const BillingData = require('../models/BillingData');
const CloudTrailEvent = require('../models/CloudTrailEvent');

class ExportService {
  async exportWorkspacesToExcel(filters = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WorkSpaces Inventory';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('WorkSpaces');

    // Define columns
    worksheet.columns = [
      { header: 'Workspace ID', key: 'id', width: 25 },
      { header: 'User Name', key: 'user_name', width: 25 },
      { header: 'Display Name', key: 'user_display_name', width: 30 },
      { header: 'State', key: 'state', width: 15 },
      { header: 'Compute Type', key: 'compute_type', width: 15 },
      { header: 'Bundle ID', key: 'bundle_id', width: 25 },
      { header: 'Running Mode', key: 'running_mode', width: 15 },
      { header: 'Root Volume (GiB)', key: 'root_volume_size_gib', width: 18 },
      { header: 'User Volume (GiB)', key: 'user_volume_size_gib', width: 18 },
      { header: 'Computer Name', key: 'computer_name', width: 20 },
      { header: 'IP Address', key: 'ip_address', width: 15 },
      { header: 'Created At', key: 'created_at', width: 22 },
      { header: 'Terminated At', key: 'terminated_at', width: 22 },
      { header: 'Last Connection', key: 'last_known_user_connection_timestamp', width: 22 },
      { header: 'Tags', key: 'tags', width: 30 }
    ];

    // Style header row
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add data
    const workspaces = Workspace.getAll(filters);
    workspaces.forEach(ws => {
      worksheet.addRow({
        ...ws,
        tags: ws.tags ? (typeof ws.tags === 'string' ? ws.tags : JSON.stringify(ws.tags)) : ''
      });
    });

    return workbook;
  }

  async exportUsageToExcel(filters = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WorkSpaces Inventory';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Monthly Usage');

    worksheet.columns = [
      { header: 'Workspace ID', key: 'workspace_id', width: 25 },
      { header: 'User Name', key: 'user_name', width: 25 },
      { header: 'Bundle ID', key: 'bundle_id', width: 25 },
      { header: 'Running Mode', key: 'running_mode', width: 15 },
      { header: 'Month', key: 'month', width: 12 },
      { header: 'Usage Hours', key: 'usage_hours', width: 15 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const usage = WorkspaceUsage.getAll(filters);
    usage.forEach(u => worksheet.addRow(u));

    return workbook;
  }

  async exportBillingToExcel(filters = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WorkSpaces Inventory';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Billing Data');

    worksheet.columns = [
      { header: 'Workspace ID', key: 'workspace_id', width: 25 },
      { header: 'User Name', key: 'user_name', width: 25 },
      { header: 'Service', key: 'service', width: 20 },
      { header: 'Usage Type', key: 'usage_type', width: 30 },
      { header: 'Start Date', key: 'start_date', width: 15 },
      { header: 'End Date', key: 'end_date', width: 15 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Currency', key: 'currency', width: 10 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const billing = BillingData.getAll(filters);
    billing.forEach(b => worksheet.addRow(b));

    return workbook;
  }

  async exportCloudTrailToExcel(filters = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WorkSpaces Inventory';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('CloudTrail Events');

    worksheet.columns = [
      { header: 'Event ID', key: 'event_id', width: 40 },
      { header: 'Event Name', key: 'event_name', width: 25 },
      { header: 'Event Time', key: 'event_time', width: 22 },
      { header: 'Workspace ID', key: 'workspace_id', width: 25 },
      { header: 'Source IP', key: 'source_ip_address', width: 18 },
      { header: 'User', key: 'user', width: 30 },
      { header: 'Region', key: 'aws_region', width: 15 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const events = CloudTrailEvent.getAll(filters);
    events.forEach(e => {
      const userIdentity = JSON.parse(e.user_identity || '{}');
      worksheet.addRow({
        ...e,
        user: userIdentity.userName || userIdentity.arn || 'N/A'
      });
    });

    return workbook;
  }

  // CSV export utilities
  workspacesToCSV(filters = {}) {
    const workspaces = Workspace.getAll(filters);
    const headers = [
      'id', 'user_name', 'user_display_name', 'state', 'compute_type', 'bundle_id', 'running_mode',
      'root_volume_size_gib', 'user_volume_size_gib', 'computer_name',
      'ip_address', 'created_at', 'terminated_at', 'last_known_user_connection_timestamp', 'tags'
    ];

    let csv = headers.join(',') + '\n';
    workspaces.forEach(ws => {
      const row = headers.map(h => {
        let value = ws[h];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') value = JSON.stringify(value);
        // Escape commas, quotes, and newlines
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csv += row.join(',') + '\n';
    });

    return csv;
  }

  usageToCSV(filters = {}) {
    const usage = WorkspaceUsage.getAll(filters);
    const headers = ['workspace_id', 'user_name', 'bundle_id', 'running_mode', 'month', 'usage_hours'];

    let csv = headers.join(',') + '\n';
    usage.forEach(u => {
      const row = headers.map(h => u[h] ?? '');
      csv += row.join(',') + '\n';
    });

    return csv;
  }

  billingToCSV(filters = {}) {
    const billing = BillingData.getAll(filters);
    const headers = ['workspace_id', 'user_name', 'service', 'usage_type', 'start_date', 'end_date', 'amount', 'currency'];

    let csv = headers.join(',') + '\n';
    billing.forEach(b => {
      const row = headers.map(h => b[h] ?? '');
      csv += row.join(',') + '\n';
    });

    return csv;
  }
}

module.exports = new ExportService();
