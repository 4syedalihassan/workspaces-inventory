const { WorkSpacesClient, DescribeWorkspacesCommand, DescribeWorkspaceBundlesCommand } = require('@aws-sdk/client-workspaces');
const config = require('../config');
const Workspace = require('../models/Workspace');
const SyncHistory = require('../models/SyncHistory');

class WorkspacesService {
  constructor() {
    const clientConfig = {
      region: config.aws.region
    };

    // Only add credentials if explicitly provided
    if (config.aws.accessKeyId && config.aws.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
      };
    }

    this.client = new WorkSpacesClient(clientConfig);
    this.bundleCache = new Map();
  }

  async getBundleInfo(bundleId) {
    if (this.bundleCache.has(bundleId)) {
      return this.bundleCache.get(bundleId);
    }

    try {
      const command = new DescribeWorkspaceBundlesCommand({
        BundleIds: [bundleId]
      });
      const response = await this.client.send(command);
      if (response.Bundles && response.Bundles.length > 0) {
        this.bundleCache.set(bundleId, response.Bundles[0]);
        return response.Bundles[0];
      }
    } catch (error) {
      console.error(`Error fetching bundle info for ${bundleId}:`, error.message);
    }
    return null;
  }

  async syncWorkspaces() {
    const syncRecord = SyncHistory.create('workspaces');
    let recordsProcessed = 0;

    try {
      let nextToken = null;

      do {
        const command = new DescribeWorkspacesCommand({
          NextToken: nextToken
        });

        const response = await this.client.send(command);

        for (const ws of response.Workspaces || []) {
          // Transform AWS WorkSpace to our model
          const workspace = {
            id: ws.WorkspaceId,
            directory_id: ws.DirectoryId,
            user_name: ws.UserName,
            ip_address: ws.IpAddress,
            state: ws.State,
            bundle_id: ws.BundleId,
            subnet_id: ws.SubnetId,
            computer_name: ws.ComputerName,
            running_mode: ws.WorkspaceProperties?.RunningMode,
            running_mode_auto_stop_timeout_in_minutes: ws.WorkspaceProperties?.RunningModeAutoStopTimeoutInMinutes,
            root_volume_size_gib: ws.WorkspaceProperties?.RootVolumeSizeGib,
            user_volume_size_gib: ws.WorkspaceProperties?.UserVolumeSizeGib,
            // Note: AWS DescribeWorkspaces API doesn't provide creation timestamp
            // created_at will be populated from CloudTrail CreateWorkspaces events
            created_at: null,
            terminated_at: ws.State === 'TERMINATED' ? new Date().toISOString() : null,
            last_known_user_connection_timestamp: ws.LastKnownUserConnectionTimestamp?.toISOString(),
            tags: {}
          };

          // Store workspace modification timestamps if available
          if (ws.ModificationStates && ws.ModificationStates.length > 0) {
            workspace.tags.modificationStates = ws.ModificationStates;
          }

          Workspace.upsert(workspace);
          recordsProcessed++;
        }

        nextToken = response.NextToken;
      } while (nextToken);

      SyncHistory.complete(syncRecord.lastInsertRowid, recordsProcessed);
      return { success: true, recordsProcessed };
    } catch (error) {
      SyncHistory.fail(syncRecord.lastInsertRowid, error.message);
      throw error;
    }
  }

  // Get workspaces with their bundle/spec information
  async getWorkspacesWithSpecs() {
    const workspaces = Workspace.getAll();
    const enriched = [];

    for (const ws of workspaces) {
      const bundleInfo = await this.getBundleInfo(ws.bundle_id);
      enriched.push({
        ...ws,
        bundle_name: bundleInfo?.Name,
        bundle_description: bundleInfo?.Description,
        compute_type: bundleInfo?.ComputeType?.Name,
        root_storage: bundleInfo?.RootStorage?.Capacity,
        user_storage: bundleInfo?.UserStorage?.Capacity
      });
    }

    return enriched;
  }
}

module.exports = new WorkspacesService();
