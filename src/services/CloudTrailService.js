const { CloudTrailClient, LookupEventsCommand } = require('@aws-sdk/client-cloudtrail');
const config = require('../config');
const CloudTrailEvent = require('../models/CloudTrailEvent');
const Workspace = require('../models/Workspace');
const SyncHistory = require('../models/SyncHistory');

class CloudTrailService {
  constructor() {
    const clientConfig = {
      region: config.aws.region
    };

    if (config.aws.accessKeyId && config.aws.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
      };
    }

    this.client = new CloudTrailClient(clientConfig);

    // WorkSpaces-related event names to track
    this.workspacesEventNames = [
      'CreateWorkspaces',
      'TerminateWorkspaces',
      'ModifyWorkspaceProperties',
      'ModifyWorkspaceState',
      'StartWorkspaces',
      'StopWorkspaces',
      'RebootWorkspaces',
      'RebuildWorkspaces',
      'ModifyWorkspaceAccessProperties',
      'UpdateWorkspaceBundle',
      'CreateTags',
      'DeleteTags'
    ];
  }

  extractWorkspaceId(event) {
    // Try to extract workspace ID from request parameters or response elements
    try {
      const requestParams = JSON.parse(event.request_parameters || '{}');
      const responseElements = JSON.parse(event.response_elements || '{}');

      // Check various possible locations for workspace ID
      if (requestParams.WorkspaceId) {
        return requestParams.WorkspaceId;
      }
      if (requestParams.WorkspaceIds && requestParams.WorkspaceIds.length > 0) {
        return requestParams.WorkspaceIds[0];
      }
      if (responseElements.FailedRequests && responseElements.FailedRequests.length > 0) {
        return responseElements.FailedRequests[0].WorkspaceId;
      }
      if (responseElements.PendingRequests && responseElements.PendingRequests.length > 0) {
        return responseElements.PendingRequests[0].WorkspaceId;
      }
    } catch (e) {
      console.error('Error parsing CloudTrail event', event.event_id, e.message);
    }
    return null;
  }

  async syncCloudTrailEvents(daysBack = 7) {
    // Validate daysBack parameter to prevent unexpected behavior
    daysBack = Math.max(1, Math.min(daysBack, 90));
    
    const syncRecord = SyncHistory.create('cloudtrail');
    let recordsProcessed = 0;

    try {
      const endTime = new Date();
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - daysBack);

      for (const eventName of this.workspacesEventNames) {
        let nextToken = null;

        do {
          const command = new LookupEventsCommand({
            LookupAttributes: [
              {
                AttributeKey: 'EventName',
                AttributeValue: eventName
              }
            ],
            StartTime: startTime,
            EndTime: endTime,
            NextToken: nextToken
          });

          const response = await this.client.send(command);

          for (const event of response.Events || []) {
            const cloudTrailEvent = event.CloudTrailEvent ? JSON.parse(event.CloudTrailEvent) : {};

            const eventRecord = {
              event_id: event.EventId,
              event_name: event.EventName,
              event_time: event.EventTime?.toISOString(),
              event_source: event.EventSource,
              aws_region: cloudTrailEvent.awsRegion,
              source_ip_address: cloudTrailEvent.sourceIPAddress,
              user_identity: cloudTrailEvent.userIdentity,
              request_parameters: cloudTrailEvent.requestParameters,
              response_elements: cloudTrailEvent.responseElements,
              workspace_id: null
            };

            // Extract workspace ID if possible
            eventRecord.workspace_id = this.extractWorkspaceId({
              request_parameters: JSON.stringify(cloudTrailEvent.requestParameters || {}),
              response_elements: JSON.stringify(cloudTrailEvent.responseElements || {})
            });

            CloudTrailEvent.insert(eventRecord);
            recordsProcessed++;
          }

          nextToken = response.NextToken;
        } while (nextToken);
      }

      SyncHistory.complete(syncRecord.lastInsertRowid, recordsProcessed);
      return { success: true, recordsProcessed };
    } catch (error) {
      SyncHistory.fail(syncRecord.lastInsertRowid, error.message);
      throw error;
    }
  }

  // Get creation/termination history for a specific workspace
  getWorkspaceHistory(workspaceId) {
    const events = CloudTrailEvent.getByWorkspaceId(workspaceId);
    return events.map(event => ({
      ...event,
      user_identity: JSON.parse(event.user_identity || '{}'),
      request_parameters: JSON.parse(event.request_parameters || '{}'),
      response_elements: JSON.parse(event.response_elements || '{}')
    }));
  }

  // Get who created a workspace and extract user details
  getCreationInfo(workspaceId) {
    const events = CloudTrailEvent.getAll({
      workspace_id: workspaceId,
      event_name: 'CreateWorkspaces'
    });

    if (events.length > 0) {
      const event = events[0];
      const userIdentity = JSON.parse(event.user_identity || '{}');
      const requestParams = JSON.parse(event.request_parameters || '{}');
      
      // Extract user display name from request parameters if available
      // The CreateWorkspaces API request contains Workspaces array with UserName and other details
      let userDisplayName = null;
      if (requestParams.Workspaces && requestParams.Workspaces.length > 0) {
        const wsRequest = requestParams.Workspaces[0];
        // In some cases, the display name might be in tags or additional properties
        if (wsRequest.Tags) {
          const nameTag = wsRequest.Tags.find(t => t.Key === 'Name' || t.Key === 'DisplayName' || t.Key === 'FullName');
          if (nameTag) {
            userDisplayName = nameTag.Value;
          }
        }
      }
      
      return {
        created_at: event.event_time,
        created_by: userIdentity.userName || userIdentity.arn || 'Unknown',
        source_ip: event.source_ip_address,
        user_display_name: userDisplayName
      };
    }
    return null;
  }

  // Get who terminated a workspace
  getTerminationInfo(workspaceId) {
    const events = CloudTrailEvent.getAll({
      workspace_id: workspaceId,
      event_name: 'TerminateWorkspaces'
    });

    if (events.length > 0) {
      const event = events[0];
      const userIdentity = JSON.parse(event.user_identity || '{}');
      return {
        terminated_at: event.event_time,
        terminated_by: userIdentity.userName || userIdentity.arn || 'Unknown',
        source_ip: event.source_ip_address
      };
    }
    return null;
  }

  // Update workspaces with creation info from CloudTrail events
  updateWorkspacesCreationInfo() {
    // Get all workspaces that are missing created_at or created_by
    const workspaces = Workspace.getAll({});
    let updatedCount = 0;

    for (const ws of workspaces) {
      // Skip if both fields are already populated
      if (ws.created_at && ws.created_by) {
        continue;
      }

      // Look for creation info from CloudTrail
      const creationInfo = this.getCreationInfo(ws.id);
      if (creationInfo) {
        // Update the workspace with creation info
        Workspace.upsert({
          ...ws,
          tags: JSON.parse(ws.tags || '{}'),
          created_at: creationInfo.created_at,
          created_by: creationInfo.created_by,
          user_display_name: creationInfo.user_display_name || ws.user_display_name
        });
        updatedCount++;
      }
    }

    return updatedCount;
  }
}

module.exports = new CloudTrailService();
