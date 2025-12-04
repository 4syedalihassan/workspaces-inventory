// Mock the database for testing
jest.mock('../src/models/database', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      directory_id TEXT,
      user_name TEXT NOT NULL,
      user_display_name TEXT,
      ip_address TEXT,
      state TEXT,
      bundle_id TEXT,
      compute_type TEXT,
      subnet_id TEXT,
      computer_name TEXT,
      running_mode TEXT,
      running_mode_auto_stop_timeout_in_minutes INTEGER,
      root_volume_size_gib INTEGER,
      user_volume_size_gib INTEGER,
      created_at TEXT,
      created_by TEXT,
      terminated_at TEXT,
      last_known_user_connection_timestamp TEXT,
      tags TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_type TEXT NOT NULL,
      status TEXT NOT NULL,
      records_processed INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    );
  `);
  
  return db;
});

// Mock AWS SDK clients
const mockDSClientSend = jest.fn();
const mockDSDataClientSend = jest.fn();

jest.mock('@aws-sdk/client-directory-service', () => {
  return {
    DirectoryServiceClient: jest.fn().mockImplementation(() => ({
      send: mockDSClientSend
    })),
    DescribeDirectoriesCommand: jest.fn()
  };
});

jest.mock('@aws-sdk/client-directory-service-data', () => {
  return {
    DirectoryServiceDataClient: jest.fn().mockImplementation(() => ({
      send: mockDSDataClientSend
    })),
    DescribeUserCommand: jest.fn(),
    ListGroupsForMemberCommand: jest.fn()
  };
});

const Workspace = require('../src/models/Workspace');
const SyncHistory = require('../src/models/SyncHistory');

// Need to require DirectoryService after mocks are set up
let DirectoryService;

describe('DirectoryService', () => {

  beforeEach(() => {
    // Clear data before each test
    const db = require('../src/models/database');
    db.exec('DELETE FROM workspaces');
    db.exec('DELETE FROM sync_history');

    // Reset mocks
    mockDSClientSend.mockReset();
    mockDSDataClientSend.mockReset();

    // Clear the module cache and re-require
    jest.resetModules();
    
    // Re-mock after resetModules
    jest.doMock('@aws-sdk/client-directory-service', () => ({
      DirectoryServiceClient: jest.fn().mockImplementation(() => ({
        send: mockDSClientSend
      })),
      DescribeDirectoriesCommand: jest.fn()
    }));

    jest.doMock('@aws-sdk/client-directory-service-data', () => ({
      DirectoryServiceDataClient: jest.fn().mockImplementation(() => ({
        send: mockDSDataClientSend
      })),
      DescribeUserCommand: jest.fn(),
      ListGroupsForMemberCommand: jest.fn()
    }));

    // Re-require DirectoryService to pick up fresh mocks
    DirectoryService = require('../src/services/DirectoryService');
  });

  describe('getDirectoryInfo', () => {
    test('should return directory info when directory exists', async () => {
      const mockDirectory = {
        DirectoryId: 'd-test123',
        Name: 'corp.example.com',
        Stage: 'Active',
        Type: 'MicrosoftAD'
      };

      mockDSClientSend.mockResolvedValue({
        DirectoryDescriptions: [mockDirectory]
      });

      const result = await DirectoryService.getDirectoryInfo('d-test123');
      
      expect(result).toEqual(mockDirectory);
    });

    test('should cache directory info', async () => {
      const mockDirectory = {
        DirectoryId: 'd-test123',
        Name: 'corp.example.com',
        Stage: 'Active'
      };

      mockDSClientSend.mockResolvedValue({
        DirectoryDescriptions: [mockDirectory]
      });

      // First call
      await DirectoryService.getDirectoryInfo('d-test123');
      // Second call - should use cache
      await DirectoryService.getDirectoryInfo('d-test123');

      expect(mockDSClientSend).toHaveBeenCalledTimes(1);
    });

    test('should return null when directory not found', async () => {
      mockDSClientSend.mockResolvedValue({
        DirectoryDescriptions: []
      });

      const result = await DirectoryService.getDirectoryInfo('d-nonexistent');
      
      expect(result).toBeNull();
    });

    test('should handle errors gracefully', async () => {
      mockDSClientSend.mockRejectedValue(new Error('Access denied'));

      const result = await DirectoryService.getDirectoryInfo('d-test123');
      
      expect(result).toBeNull();
    });
  });

  describe('getUserDetails', () => {
    test('should return user details when user exists', async () => {
      mockDSDataClientSend.mockResolvedValue({
        SAMAccountName: 'jsmith',
        DisplayName: 'John Smith',
        EmailAddress: 'jsmith@example.com',
        GivenName: 'John',
        Surname: 'Smith',
        UserPrincipalName: 'jsmith@corp.example.com',
        Enabled: true,
        SID: 'S-1-5-21-123456789',
        DistinguishedName: 'CN=John Smith,OU=Users,DC=corp,DC=example,DC=com'
      });

      const result = await DirectoryService.getUserDetails('d-test123', 'jsmith');
      
      expect(result).toBeDefined();
      expect(result.sam_account_name).toBe('jsmith');
      expect(result.display_name).toBe('John Smith');
      expect(result.email_address).toBe('jsmith@example.com');
      expect(result.enabled).toBe(true);
    });

    test('should return null when user not found', async () => {
      const error = new Error('User not found');
      error.name = 'ResourceNotFoundException';
      mockDSDataClientSend.mockRejectedValue(error);

      const result = await DirectoryService.getUserDetails('d-test123', 'nonexistent');
      
      expect(result).toBeNull();
    });

    test('should handle DirectoryUnavailableException', async () => {
      const error = new Error('Directory unavailable');
      error.name = 'DirectoryUnavailableException';
      mockDSDataClientSend.mockRejectedValue(error);

      const result = await DirectoryService.getUserDetails('d-test123', 'jsmith');
      
      expect(result).toBeNull();
    });

    test('should handle AccessDeniedException', async () => {
      const error = new Error('Access denied');
      error.name = 'AccessDeniedException';
      mockDSDataClientSend.mockRejectedValue(error);

      const result = await DirectoryService.getUserDetails('d-test123', 'jsmith');
      
      expect(result).toBeNull();
    });

    test('should cache access denied directories and skip subsequent calls', async () => {
      const error = new Error('Access denied');
      error.name = 'AccessDeniedException';
      mockDSDataClientSend.mockRejectedValue(error);

      // First call should hit the API and cache the access denied status
      const result1 = await DirectoryService.getUserDetails('d-accessdenied', 'user1');
      expect(result1).toBeNull();
      expect(mockDSDataClientSend).toHaveBeenCalledTimes(1);

      // Second call should skip the API call due to cache
      const result2 = await DirectoryService.getUserDetails('d-accessdenied', 'user2');
      expect(result2).toBeNull();
      // Should still be 1 call (no additional API call made)
      expect(mockDSDataClientSend).toHaveBeenCalledTimes(1);
      
      // Verify the directory is marked as access denied
      expect(DirectoryService.isDirectoryAccessDenied('d-accessdenied')).toBe(true);
    });
  });

  describe('getUserGroups', () => {
    test('should return user groups', async () => {
      mockDSDataClientSend.mockResolvedValue({
        Groups: [
          {
            SAMAccountName: 'Domain Users',
            DistinguishedName: 'CN=Domain Users,CN=Users,DC=corp,DC=example,DC=com',
            GroupScope: 'Global',
            GroupType: 'Security',
            SID: 'S-1-5-21-123456789-513'
          },
          {
            SAMAccountName: 'Developers',
            DistinguishedName: 'CN=Developers,OU=Groups,DC=corp,DC=example,DC=com',
            GroupScope: 'Global',
            GroupType: 'Security',
            SID: 'S-1-5-21-123456789-1001'
          }
        ]
      });

      const result = await DirectoryService.getUserGroups('d-test123', 'jsmith');
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Domain Users');
      expect(result[1].name).toBe('Developers');
    });

    test('should handle pagination', async () => {
      mockDSDataClientSend
        .mockResolvedValueOnce({
          Groups: [{ SAMAccountName: 'Group1', SID: '1' }],
          NextToken: 'token123'
        })
        .mockResolvedValueOnce({
          Groups: [{ SAMAccountName: 'Group2', SID: '2' }],
          NextToken: null
        });

      const result = await DirectoryService.getUserGroups('d-test123', 'jsmith');
      
      expect(result).toHaveLength(2);
      expect(mockDSDataClientSend).toHaveBeenCalledTimes(2);
    });

    test('should return empty array on error', async () => {
      mockDSDataClientSend.mockRejectedValue(new Error('Access denied'));

      const result = await DirectoryService.getUserGroups('d-test123', 'jsmith');
      
      expect(result).toEqual([]);
    });
  });

  describe('syncDirectoryUserData', () => {
    beforeEach(() => {
      // Insert test workspaces directly using the database
      const db = require('../src/models/database');
      db.prepare(`
        INSERT OR REPLACE INTO workspaces (id, directory_id, user_name, state, running_mode) 
        VALUES (?, ?, ?, ?, ?)
      `).run('ws-test001', 'd-test123', 'jsmith', 'AVAILABLE', 'AUTO_STOP');
      
      db.prepare(`
        INSERT OR REPLACE INTO workspaces (id, directory_id, user_name, state, running_mode) 
        VALUES (?, ?, ?, ?, ?)
      `).run('ws-test002', 'd-test123', 'jdoe', 'AVAILABLE', 'ALWAYS_ON');
    });

    test('should sync user data for workspaces', async () => {
      // Mock directory info
      mockDSClientSend.mockResolvedValue({
        DirectoryDescriptions: [{
          DirectoryId: 'd-test123',
          Stage: 'Active'
        }]
      });

      // Mock user details and groups
      mockDSDataClientSend.mockImplementation((command) => {
        // Check if this is a group command (has MemberRealm property)
        if (command.input && command.input.MemberRealm) {
          return Promise.resolve({ Groups: [] });
        }
        // User details command
        return Promise.resolve({
          SAMAccountName: command.input?.SAMAccountName || 'user',
          DisplayName: 'Test User',
          EmailAddress: 'test@example.com',
          GivenName: 'Test',
          Surname: 'User',
          Enabled: true
        });
      });

      const result = await DirectoryService.syncDirectoryUserData();
      
      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(2);
      expect(result.recordsUpdated).toBe(2);
    });

    test('should skip inactive directories', async () => {
      mockDSClientSend.mockResolvedValue({
        DirectoryDescriptions: [{
          DirectoryId: 'd-test123',
          Stage: 'Deleting'
        }]
      });

      const result = await DirectoryService.syncDirectoryUserData();
      
      expect(result.success).toBe(true);
      expect(result.recordsUpdated).toBe(0);
      expect(result.errors).toBeDefined();
      expect(result.errors[0]).toContain('not active');
    });

    test('should create sync history record', async () => {
      mockDSClientSend.mockResolvedValue({
        DirectoryDescriptions: [{
          DirectoryId: 'd-test123',
          Stage: 'Active'
        }]
      });

      mockDSDataClientSend.mockImplementation((command) => {
        if (command.input && command.input.MemberRealm) {
          return Promise.resolve({ Groups: [] });
        }
        return Promise.resolve({
          SAMAccountName: 'jsmith',
          DisplayName: 'John Smith',
          Enabled: true
        });
      });

      await DirectoryService.syncDirectoryUserData();

      const db = require('../src/models/database');
      const history = db.prepare('SELECT * FROM sync_history ORDER BY id DESC LIMIT 1').all();
      expect(history).toHaveLength(1);
      expect(history[0].sync_type).toBe('directory');
    });

    test('should report access denied directories in sync result', async () => {
      // Mock directory info returning active directory
      mockDSClientSend.mockResolvedValue({
        DirectoryDescriptions: [{
          DirectoryId: 'd-test123',
          Stage: 'Active'
        }]
      });

      // Mock access denied for user details
      const error = new Error('Access denied');
      error.name = 'AccessDeniedException';
      mockDSDataClientSend.mockRejectedValue(error);

      const result = await DirectoryService.syncDirectoryUserData();
      
      expect(result.success).toBe(true);
      expect(result.accessDeniedDirectories).toBeDefined();
      expect(result.accessDeniedDirectories).toContain('d-test123');
      expect(result.errors).toBeDefined();
      expect(result.errors[0]).toContain('Access denied');
      expect(result.errors[0]).toContain('Directory Data Access');
    });
  });

  describe('findOrphanedWorkspaces', () => {
    beforeEach(() => {
      const db = require('../src/models/database');
      
      db.prepare(`
        INSERT OR REPLACE INTO workspaces (id, directory_id, user_name, state, running_mode) 
        VALUES (?, ?, ?, ?, ?)
      `).run('ws-active001', 'd-test123', 'activeuser', 'AVAILABLE', 'AUTO_STOP');

      db.prepare(`
        INSERT OR REPLACE INTO workspaces (id, directory_id, user_name, state, running_mode) 
        VALUES (?, ?, ?, ?, ?)
      `).run('ws-orphan001', 'd-test123', 'deleteduser', 'AVAILABLE', 'AUTO_STOP');

      db.prepare(`
        INSERT OR REPLACE INTO workspaces (id, directory_id, user_name, state, running_mode) 
        VALUES (?, ?, ?, ?, ?)
      `).run('ws-terminated001', 'd-test123', 'terminateduser', 'TERMINATED', 'AUTO_STOP');
    });

    test('should identify orphaned workspaces', async () => {
      // Need to return a new mock implementation before each call
      let callCount = 0;
      mockDSDataClientSend.mockImplementation((command) => {
        const userName = command.input?.SAMAccountName;
        if (userName === 'activeuser') {
          return Promise.resolve({
            SAMAccountName: 'activeuser',
            DisplayName: 'Active User',
            Enabled: true
          });
        }
        // User not found for deleteduser
        const error = new Error('User not found');
        error.name = 'ResourceNotFoundException';
        return Promise.reject(error);
      });

      const orphaned = await DirectoryService.findOrphanedWorkspaces();
      
      // Filter to only check the orphan
      const deletedUserOrphan = orphaned.find(ws => ws.user_name === 'deleteduser');
      expect(deletedUserOrphan).toBeDefined();
      expect(deletedUserOrphan.workspace_id).toBe('ws-orphan001');
    });

    test('should skip terminated workspaces', async () => {
      mockDSDataClientSend.mockImplementation(() => {
        const error = new Error('User not found');
        error.name = 'ResourceNotFoundException';
        return Promise.reject(error);
      });

      const orphaned = await DirectoryService.findOrphanedWorkspaces();
      
      // Should not include terminated workspace
      const terminatedWs = orphaned.find(ws => ws.workspace_id === 'ws-terminated001');
      expect(terminatedWs).toBeUndefined();
    });
  });
});
