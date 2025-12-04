const {
  DirectoryServiceClient,
  DescribeDirectoriesCommand
} = require('@aws-sdk/client-directory-service');
const {
  DirectoryServiceDataClient,
  DescribeUserCommand,
  ListGroupsForMemberCommand
} = require('@aws-sdk/client-directory-service-data');
const config = require('../config');
const Workspace = require('../models/Workspace');
const SyncHistory = require('../models/SyncHistory');

class DirectoryService {
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

    this.dsClient = new DirectoryServiceClient(clientConfig);
    // Note: DirectoryServiceDataClient requires a directory-specific endpoint
    // The endpoint is set when making API calls with directory_id
    this.dsDataClientConfig = clientConfig;

    // Cache for directory information
    this.directoryCache = new Map();
  }

  /**
   * Get directory information by ID
   * @param {string} directoryId - The directory ID
   * @returns {Promise<Object|null>} Directory information
   */
  async getDirectoryInfo(directoryId) {
    if (this.directoryCache.has(directoryId)) {
      return this.directoryCache.get(directoryId);
    }

    try {
      const command = new DescribeDirectoriesCommand({
        DirectoryIds: [directoryId]
      });
      const response = await this.dsClient.send(command);
      if (response.DirectoryDescriptions && response.DirectoryDescriptions.length > 0) {
        const dirInfo = response.DirectoryDescriptions[0];
        this.directoryCache.set(directoryId, dirInfo);
        return dirInfo;
      }
    } catch (error) {
      console.error(`Error fetching directory info for ${directoryId}:`, error.message);
    }
    return null;
  }

  /**
   * Create a DirectoryServiceDataClient for a specific directory
   * Note: The directoryId is passed to API calls, not the client constructor.
   * The client configuration is the same for all directories.
   * @returns {DirectoryServiceDataClient} Configured client
   */
  createDataClient() {
    return new DirectoryServiceDataClient({
      ...this.dsDataClientConfig
    });
  }

  /**
   * Get user details from AWS Directory Service
   * @param {string} directoryId - The directory ID
   * @param {string} userName - The SAM account name (user name)
   * @returns {Promise<Object|null>} User details or null if not found
   */
  async getUserDetails(directoryId, userName) {
    try {
      const dataClient = this.createDataClient();
      const command = new DescribeUserCommand({
        DirectoryId: directoryId,
        SAMAccountName: userName
      });
      
      const response = await dataClient.send(command);
      return {
        sam_account_name: response.SAMAccountName,
        distinguished_name: response.DistinguishedName,
        email_address: response.EmailAddress,
        given_name: response.GivenName,
        surname: response.Surname,
        display_name: response.DisplayName || `${response.GivenName || ''} ${response.Surname || ''}`.trim() || response.SAMAccountName,
        user_principal_name: response.UserPrincipalName,
        enabled: response.Enabled,
        sid: response.SID,
        other_attributes: response.OtherAttributes || {}
      };
    } catch (error) {
      // Handle common errors gracefully
      if (error.name === 'DirectoryUnavailableException') {
        console.error(`Directory ${directoryId} is not available for data queries`);
      } else if (error.name === 'ResourceNotFoundException') {
        console.error(`User ${userName} not found in directory ${directoryId}`);
      } else if (error.name === 'AccessDeniedException') {
        console.error(`Access denied when querying directory ${directoryId}. Ensure Directory Data Access is enabled.`);
      } else {
        console.error(`Error fetching user details for ${userName} in ${directoryId}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Get group memberships for a user
   * @param {string} directoryId - The directory ID
   * @param {string} userName - The SAM account name
   * @returns {Promise<Array>} Array of group names
   */
  async getUserGroups(directoryId, userName) {
    try {
      const dataClient = this.createDataClient();
      const groups = [];
      let nextToken = null;

      do {
        const command = new ListGroupsForMemberCommand({
          DirectoryId: directoryId,
          MemberRealm: 'DIRECTORY',
          SAMAccountName: userName,
          NextToken: nextToken
        });

        const response = await dataClient.send(command);
        
        for (const group of response.Groups || []) {
          groups.push({
            name: group.SAMAccountName,
            distinguished_name: group.DistinguishedName,
            group_scope: group.GroupScope,
            group_type: group.GroupType,
            sid: group.SID
          });
        }

        nextToken = response.NextToken;
      } while (nextToken);

      return groups;
    } catch (error) {
      console.error(`Error fetching groups for ${userName} in ${directoryId}:`, error.message);
      return [];
    }
  }

  /**
   * Sync directory user data for all workspaces
   * Updates workspace records with user details from Active Directory
   * @returns {Promise<Object>} Sync result
   */
  async syncDirectoryUserData() {
    const syncRecord = SyncHistory.create('directory');
    let recordsProcessed = 0;
    let recordsUpdated = 0;
    let errors = [];

    try {
      // Get all workspaces with directory_id
      const workspaces = Workspace.getAll({});
      
      // Group workspaces by directory for efficient processing
      const workspacesByDirectory = new Map();
      for (const ws of workspaces) {
        if (ws.directory_id && ws.user_name) {
          if (!workspacesByDirectory.has(ws.directory_id)) {
            workspacesByDirectory.set(ws.directory_id, []);
          }
          workspacesByDirectory.get(ws.directory_id).push(ws);
        }
      }

      // Process each directory
      for (const [directoryId, directoryWorkspaces] of workspacesByDirectory) {
        // Verify directory is available
        const dirInfo = await this.getDirectoryInfo(directoryId);
        if (!dirInfo) {
          errors.push(`Directory ${directoryId} not found or not accessible`);
          continue;
        }

        // Skip if directory is not in a state that supports data access
        if (dirInfo.Stage !== 'Active') {
          errors.push(`Directory ${directoryId} is not active (status: ${dirInfo.Stage})`);
          continue;
        }

        // Process each workspace user
        for (const ws of directoryWorkspaces) {
          recordsProcessed++;

          try {
            // Get user details from directory
            const userDetails = await this.getUserDetails(directoryId, ws.user_name);
            
            if (userDetails) {
              // Get user group memberships
              const groups = await this.getUserGroups(directoryId, ws.user_name);
              
              // Parse existing tags
              let tags = {};
              try {
                tags = JSON.parse(ws.tags || '{}');
              } catch {
                tags = {};
              }

              // Update workspace with directory user data
              Workspace.upsert({
                ...ws,
                // Preserve user_display_name from directory if we got one
                user_display_name: userDetails.display_name || ws.user_display_name,
                tags: {
                  ...tags,
                  // Store directory user data in tags for extensibility
                  directory_user: {
                    email: userDetails.email_address,
                    given_name: userDetails.given_name,
                    surname: userDetails.surname,
                    user_principal_name: userDetails.user_principal_name,
                    enabled: userDetails.enabled,
                    distinguished_name: userDetails.distinguished_name,
                    groups: groups.map(g => g.name),
                    synced_at: new Date().toISOString()
                  }
                }
              });
              recordsUpdated++;
            }
          } catch (error) {
            errors.push(`Error processing user ${ws.user_name}: ${error.message}`);
          }
        }
      }

      SyncHistory.complete(syncRecord.lastInsertRowid, recordsUpdated);
      return {
        success: true,
        recordsProcessed,
        recordsUpdated,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      SyncHistory.fail(syncRecord.lastInsertRowid, error.message);
      throw error;
    }
  }

  /**
   * Get enriched workspace data with directory user information
   * @param {string} workspaceId - The workspace ID
   * @returns {Promise<Object|null>} Workspace with directory data
   */
  async getWorkspaceWithDirectoryData(workspaceId) {
    const workspace = Workspace.getById(workspaceId);
    if (!workspace) {
      return null;
    }

    // Parse tags to get directory user data
    let tags = {};
    try {
      tags = JSON.parse(workspace.tags || '{}');
    } catch {
      tags = {};
    }

    // If directory user data is not in tags, try to fetch it
    if (!tags.directory_user && workspace.directory_id && workspace.user_name) {
      const userDetails = await this.getUserDetails(workspace.directory_id, workspace.user_name);
      if (userDetails) {
        const groups = await this.getUserGroups(workspace.directory_id, workspace.user_name);
        tags.directory_user = {
          email: userDetails.email_address,
          given_name: userDetails.given_name,
          surname: userDetails.surname,
          user_principal_name: userDetails.user_principal_name,
          enabled: userDetails.enabled,
          distinguished_name: userDetails.distinguished_name,
          groups: groups.map(g => g.name),
          synced_at: new Date().toISOString()
        };
      }
    }

    return {
      ...workspace,
      tags: JSON.stringify(tags),
      directory_user: tags.directory_user || null
    };
  }

  /**
   * Check if a user exists in the directory
   * Useful for identifying orphaned workspaces
   * @param {string} directoryId - The directory ID
   * @param {string} userName - The SAM account name
   * @returns {Promise<boolean>} True if user exists
   */
  async userExistsInDirectory(directoryId, userName) {
    const userDetails = await this.getUserDetails(directoryId, userName);
    return userDetails !== null;
  }

  /**
   * Find orphaned workspaces (workspace exists but user doesn't in AD)
   * @returns {Promise<Array>} Array of orphaned workspaces
   */
  async findOrphanedWorkspaces() {
    const workspaces = Workspace.getAll({});
    const orphaned = [];

    for (const ws of workspaces) {
      if (ws.directory_id && ws.user_name && ws.state !== 'TERMINATED') {
        const exists = await this.userExistsInDirectory(ws.directory_id, ws.user_name);
        if (!exists) {
          orphaned.push({
            workspace_id: ws.id,
            user_name: ws.user_name,
            directory_id: ws.directory_id,
            state: ws.state,
            last_connection: ws.last_known_user_connection_timestamp
          });
        }
      }
    }

    return orphaned;
  }
}

module.exports = new DirectoryService();
