import { useEffect, useState } from 'react';
import { Modal, Button, Form, Tabs, Tab, Badge, Alert } from 'react-bootstrap';

const API_BASE = '/api/v1';

function Admin() {
  const [activeTab, setActiveTab] = useState('settings');
  const [settings, setSettings] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [alert, setAlert] = useState(null);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'USER'
  });

  // AWS Integration State
  const [awsSettings, setAwsSettings] = useState({
    region: '',
    accessKeyId: '',
    secretAccessKey: ''
  });

  // DUO Integration State
  const [duoSettings, setDuoSettings] = useState({
    integrationKey: '',
    secretKey: '',
    apiHostname: ''
  });

  // Sync Settings State
  const [syncSettings, setSyncSettings] = useState({
    autoSyncEnabled: false,
    syncInterval: 60
  });

  useEffect(() => {
    loadSettings();
    loadUsers();
    loadIntegrationSettings();
  }, []);

  const apiFetch = async (url, options = {}) => {
    const authToken = localStorage.getItem('authToken');
    const headers = {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      ...options.headers
    };

    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login.html';
      return;
    }

    return response;
  };

  const showAlertMessage = (message, variant = 'success') => {
    setAlert({ message, variant });
    setTimeout(() => setAlert(null), 5000);
  };

  const loadSettings = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/settings`);
      const data = await response.json();
      setSettings(data.settings || {});
    } catch (error) {
      console.error('Failed to load settings:', error);
      showAlertMessage('Failed to load settings', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const saveAllSettings = async () => {
    const settingsToSave = {};
    Object.values(settings).flat().forEach(setting => {
      const input = document.getElementById(`setting-${setting.key}`);
      if (input) {
        settingsToSave[setting.key] = input.value;
      }
    });

    try {
      const response = await apiFetch(`${API_BASE}/admin/settings`, {
        method: 'PUT',
        body: JSON.stringify(settingsToSave)
      });

      if (response.ok) {
        showAlertMessage('Settings saved successfully', 'success');
      } else {
        showAlertMessage('Failed to save settings', 'danger');
      }
    } catch (error) {
      showAlertMessage('Error saving settings: ' + error.message, 'danger');
    }
  };

  const loadUsers = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/users`);
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const createUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      showAlertMessage('Please fill in all fields', 'danger');
      return;
    }

    try {
      const response = await apiFetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        body: JSON.stringify(newUser)
      });

      if (response.ok) {
        setShowCreateUser(false);
        loadUsers();
        showAlertMessage('User created successfully', 'success');
        setNewUser({ username: '', email: '', password: '', role: 'USER' });
      } else {
        const data = await response.json();
        showAlertMessage(data.error || 'Failed to create user', 'danger');
      }
    } catch (error) {
      showAlertMessage('Error creating user: ' + error.message, 'danger');
    }
  };

  const deleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"?`)) {
      return;
    }

    try {
      const response = await apiFetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        loadUsers();
        showAlertMessage('User deleted successfully', 'success');
      } else {
        showAlertMessage('Failed to delete user', 'danger');
      }
    } catch (error) {
      showAlertMessage('Error deleting user: ' + error.message, 'danger');
    }
  };

  const loadIntegrationSettings = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/settings`);
      const data = await response.json();
      const allSettings = data.settings || {};
      
      // Extract AWS settings
      const awsGroup = Object.values(allSettings).flat().filter(s => s.key.startsWith('AWS_'));
      setAwsSettings({
        region: awsGroup.find(s => s.key === 'AWS_REGION')?.value || '',
        accessKeyId: awsGroup.find(s => s.key === 'AWS_ACCESS_KEY_ID')?.value || '',
        secretAccessKey: awsGroup.find(s => s.key === 'AWS_SECRET_ACCESS_KEY')?.value || ''
      });

      // Extract DUO settings
      const duoGroup = Object.values(allSettings).flat().filter(s => s.key.startsWith('DUO_'));
      setDuoSettings({
        integrationKey: duoGroup.find(s => s.key === 'DUO_IKEY')?.value || '',
        secretKey: duoGroup.find(s => s.key === 'DUO_SKEY')?.value || '',
        apiHostname: duoGroup.find(s => s.key === 'DUO_API_HOSTNAME')?.value || ''
      });

      // Extract Sync settings
      const syncGroup = Object.values(allSettings).flat().filter(s => s.key.startsWith('SYNC_'));
      setSyncSettings({
        autoSyncEnabled: syncGroup.find(s => s.key === 'SYNC_ENABLED')?.value === 'true',
        syncInterval: parseInt(syncGroup.find(s => s.key === 'SYNC_INTERVAL')?.value || '60')
      });
    } catch (error) {
      console.error('Failed to load integration settings:', error);
    }
  };

  const saveAWSSettings = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/settings`, {
        method: 'PUT',
        body: JSON.stringify({
          AWS_REGION: awsSettings.region,
          AWS_ACCESS_KEY_ID: awsSettings.accessKeyId,
          AWS_SECRET_ACCESS_KEY: awsSettings.secretAccessKey
        })
      });

      if (response.ok) {
        showAlertMessage('AWS settings saved successfully', 'success');
      } else {
        showAlertMessage('Failed to save AWS settings', 'danger');
      }
    } catch (error) {
      showAlertMessage('Error saving AWS settings: ' + error.message, 'danger');
    }
  };

  const testAWSConnection = async () => {
    showAlertMessage('Testing AWS connection...', 'info');
    // TODO: Implement test connection endpoint
    setTimeout(() => {
      showAlertMessage('AWS connection test not implemented yet', 'warning');
    }, 1000);
  };

  const saveDUOSettings = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/settings`, {
        method: 'PUT',
        body: JSON.stringify({
          DUO_IKEY: duoSettings.integrationKey,
          DUO_SKEY: duoSettings.secretKey,
          DUO_API_HOSTNAME: duoSettings.apiHostname
        })
      });

      if (response.ok) {
        showAlertMessage('DUO settings saved successfully', 'success');
      } else {
        showAlertMessage('Failed to save DUO settings', 'danger');
      }
    } catch (error) {
      showAlertMessage('Error saving DUO settings: ' + error.message, 'danger');
    }
  };

  const saveSyncSettings = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/settings`, {
        method: 'PUT',
        body: JSON.stringify({
          SYNC_ENABLED: syncSettings.autoSyncEnabled.toString(),
          SYNC_INTERVAL: syncSettings.syncInterval.toString()
        })
      });

      if (response.ok) {
        showAlertMessage('Sync settings saved successfully', 'success');
      } else {
        showAlertMessage('Failed to save sync settings', 'danger');
      }
    } catch (error) {
      showAlertMessage('Error saving sync settings: ' + error.message, 'danger');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid">
      {alert && (
        <Alert variant={alert.variant} onClose={() => setAlert(null)} dismissible className="mt-3">
          {alert.message}
        </Alert>
      )}

      <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3">
        {/* Settings Tab */}
        <Tab eventKey="settings" title={<><i className="bi bi-gear me-2"></i>Settings</>}>
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Application Settings</h5>
              <Button size="sm" variant="primary" onClick={saveAllSettings}>
                <i className="bi bi-save me-1"></i>Save All Changes
              </Button>
            </div>
            <div className="card-body">
              {Object.entries(settings).map(([category, categorySettings]) => (
                <div key={category} className="mb-4">
                  <h6 className="text-uppercase text-muted mb-3">{category}</h6>
                  {categorySettings.map((setting) => (
                    <div key={setting.key} className="border-bottom pb-3 mb-3">
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <div className="fw-bold">
                            {setting.key}
                            {setting.encrypted && (
                              <Badge bg="warning" className="ms-2" style={{ fontSize: '0.75rem' }}>
                                Encrypted
                              </Badge>
                            )}
                          </div>
                          <small className="text-muted">{setting.description}</small>
                        </div>
                        <div style={{ minWidth: '300px' }}>
                          <Form.Control
                            type={setting.encrypted ? 'password' : 'text'}
                            id={`setting-${setting.key}`}
                            defaultValue={setting.value || ''}
                            placeholder={setting.description}
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Tab>

        {/* Users Tab */}
        <Tab eventKey="users" title={<><i className="bi bi-people me-2"></i>Users</>}>
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">User Management</h5>
              <Button size="sm" variant="success" onClick={() => setShowCreateUser(true)}>
                <i className="bi bi-plus-circle me-1"></i>Create User
              </Button>
            </div>
            <div className="card-body">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center">No users found</td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.username}</td>
                        <td>{user.email}</td>
                        <td>
                          <Badge bg={user.role === 'ADMIN' ? 'danger' : 'primary'}>
                            {user.role}
                          </Badge>
                        </td>
                        <td>{user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => deleteUser(user.id, user.username)}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Tab>

        {/* Integrations Tab */}
        <Tab eventKey="integrations" title={<><i className="bi bi-plug me-2"></i>Integrations</>}>
          <div className="row">
            {/* AWS Integration */}
            <div className="col-md-6 mb-3">
              <div className="card">
                <div className="card-header">
                  <h5 className="mb-0"><i className="bi bi-cloud me-2"></i>AWS Integration</h5>
                </div>
                <div className="card-body">
                  <Form.Group className="mb-3">
                    <Form.Label>Region</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="us-east-1"
                      value={awsSettings.region}
                      onChange={(e) => setAwsSettings({ ...awsSettings, region: e.target.value })}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Access Key ID</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="AKIA..."
                      value={awsSettings.accessKeyId}
                      onChange={(e) => setAwsSettings({ ...awsSettings, accessKeyId: e.target.value })}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Secret Access Key</Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="********"
                      value={awsSettings.secretAccessKey}
                      onChange={(e) => setAwsSettings({ ...awsSettings, secretAccessKey: e.target.value })}
                    />
                  </Form.Group>
                  <div className="d-flex gap-2">
                    <Button variant="primary" onClick={saveAWSSettings}>Save AWS Settings</Button>
                    <Button variant="outline-secondary" onClick={testAWSConnection}>Test Connection</Button>
                  </div>
                </div>
              </div>
            </div>

            {/* DUO Integration */}
            <div className="col-md-6 mb-3">
              <div className="card">
                <div className="card-header">
                  <h5 className="mb-0"><i className="bi bi-shield-check me-2"></i>DUO MFA</h5>
                </div>
                <div className="card-body">
                  <Form.Group className="mb-3">
                    <Form.Label>Integration Key</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="DI..."
                      value={duoSettings.integrationKey}
                      onChange={(e) => setDuoSettings({ ...duoSettings, integrationKey: e.target.value })}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Secret Key</Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="********"
                      value={duoSettings.secretKey}
                      onChange={(e) => setDuoSettings({ ...duoSettings, secretKey: e.target.value })}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>API Hostname</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="api-xxxxx.duosecurity.com"
                      value={duoSettings.apiHostname}
                      onChange={(e) => setDuoSettings({ ...duoSettings, apiHostname: e.target.value })}
                    />
                  </Form.Group>
                  <Button variant="primary" onClick={saveDUOSettings}>Save DUO Settings</Button>
                </div>
              </div>
            </div>
          </div>

          {/* Sync Settings */}
          <div className="row">
            <div className="col-md-12">
              <div className="card">
                <div className="card-header">
                  <h5 className="mb-0"><i className="bi bi-arrow-repeat me-2"></i>Synchronization Settings</h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <Form.Check
                        type="switch"
                        id="auto-sync-enabled"
                        label="Enable Automatic Synchronization"
                        checked={syncSettings.autoSyncEnabled}
                        onChange={(e) => setSyncSettings({ ...syncSettings, autoSyncEnabled: e.target.checked })}
                        className="mb-3"
                      />
                    </div>
                    <div className="col-md-6">
                      <Form.Group className="mb-3">
                        <Form.Label>Sync Interval (minutes)</Form.Label>
                        <Form.Control
                          type="number"
                          value={syncSettings.syncInterval}
                          onChange={(e) => setSyncSettings({ ...syncSettings, syncInterval: parseInt(e.target.value) })}
                        />
                      </Form.Group>
                    </div>
                  </div>
                  <Button variant="primary" onClick={saveSyncSettings}>Save Sync Settings</Button>
                </div>
              </div>
            </div>
          </div>
        </Tab>
      </Tabs>

      {/* Create User Modal */}
      <Modal show={showCreateUser} onHide={() => setShowCreateUser(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create New User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Username</Form.Label>
            <Form.Control
              type="text"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Role</Form.Label>
            <Form.Select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreateUser(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={createUser}>
            Create User
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default Admin;
