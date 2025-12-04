const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
const config = require('../config');
const BillingData = require('../models/BillingData');
const WorkspaceUsage = require('../models/WorkspaceUsage');
const SyncHistory = require('../models/SyncHistory');

class BillingService {
  constructor() {
    const clientConfig = {
      region: 'us-east-1' // Cost Explorer only available in us-east-1
    };

    if (config.aws.accessKeyId && config.aws.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
      };
    }

    this.client = new CostExplorerClient(clientConfig);
  }

  async syncBillingData(monthsBack = 3) {
    // Validate monthsBack parameter to prevent excessive API costs
    monthsBack = Math.max(1, Math.min(monthsBack, 12));
    
    const syncRecord = SyncHistory.create('billing');
    let recordsProcessed = 0;

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);

      // Format dates as YYYY-MM-DD
      const formatDate = (date) => date.toISOString().split('T')[0];

      const command = new GetCostAndUsageCommand({
        TimePeriod: {
          Start: formatDate(startDate),
          End: formatDate(endDate)
        },
        Granularity: 'MONTHLY',
        Filter: {
          Dimensions: {
            Key: 'SERVICE',
            Values: ['Amazon WorkSpaces']
          }
        },
        Metrics: ['UnblendedCost', 'UsageQuantity'],
        GroupBy: [
          { Type: 'DIMENSION', Key: 'USAGE_TYPE' },
          { Type: 'DIMENSION', Key: 'RESOURCE_ID' }
        ]
      });

      const response = await this.client.send(command);

      for (const result of response.ResultsByTime || []) {
        for (const group of result.Groups || []) {
          const [usageType, resourceId] = group.Keys || [];
          const amount = parseFloat(group.Metrics?.UnblendedCost?.Amount || 0);
          const usageQuantity = parseFloat(group.Metrics?.UsageQuantity?.Amount || 0);

          // Store billing data
          const billing = {
            workspace_id: resourceId || null,
            service: 'Amazon WorkSpaces',
            usage_type: usageType,
            start_date: result.TimePeriod?.Start,
            end_date: result.TimePeriod?.End,
            amount: amount,
            unit: group.Metrics?.UsageQuantity?.Unit || 'Hours',
            currency: 'USD'
          };

          BillingData.upsert(billing);
          recordsProcessed++;

          // If this is hourly usage, also update workspace usage
          if (usageType && usageType.includes('Hours') && resourceId) {
            const month = result.TimePeriod?.Start?.substring(0, 7); // YYYY-MM
            WorkspaceUsage.upsert({
              workspace_id: resourceId,
              month: month,
              usage_hours: usageQuantity
            });
          }
        }
      }

      SyncHistory.complete(syncRecord.lastInsertRowid, recordsProcessed);
      return { success: true, recordsProcessed };
    } catch (error) {
      SyncHistory.fail(syncRecord.lastInsertRowid, error.message);
      throw error;
    }
  }

  async getMonthlyCostSummary(startDate, endDate) {
    try {
      const command = new GetCostAndUsageCommand({
        TimePeriod: {
          Start: startDate,
          End: endDate
        },
        Granularity: 'MONTHLY',
        Filter: {
          Dimensions: {
            Key: 'SERVICE',
            Values: ['Amazon WorkSpaces']
          }
        },
        Metrics: ['UnblendedCost'],
        GroupBy: [
          { Type: 'DIMENSION', Key: 'USAGE_TYPE' }
        ]
      });

      const response = await this.client.send(command);
      return response.ResultsByTime || [];
    } catch (error) {
      console.error('Error fetching cost summary:', error.message);
      throw error;
    }
  }
}

module.exports = new BillingService();
