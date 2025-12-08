import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Tabs, Tab, TextField, Button, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel, Chip, IconButton, Grid } from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { API_BASE } from '../api';

function Admin() {
  const [activeTab, setActiveTab] = useState(0);
  const [settings, setSettings] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'USER' });
  const [awsSettings, setAwsSettings] = useState({ region: '', accessKeyId: '', secretAccessKey: '' });
  const [duoSettings, setDuoSettings] = useState({ integrationKey: '', secretKey: '', apiHostname: '' });
  const [syncSettings, setSyncSettings] = useState({ autoSyncEnabled: false, syncInterval: 60 });

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
      window.location.href = '/login';
      return;
    }
    return response;
  };

  const showNotification = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const loadSettings = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/settings`);
      const data = await response.json();
      setSettings(data.settings || {});
    } catch (error) {
      console.error('Failed to load settings:', error);
      showNotification('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveAllSettings = async () => {
    const settingsToSave = {};
    Object.values(settings).flat().forEach(setting => {
      const input = document.getElementById(`setting-${setting.key}`);
      if (input) settingsToSave[setting.key] = input.value;
    });
    try {
      const response = await apiFetch(`${API_BASE}/admin/settings`, { method: 'PUT', body: JSON.stringify(settingsToSave) });
      if (response.ok) {
        showNotification('Settings saved successfully', 'success');
      } else {
        showNotification('Failed to save settings', 'error');
      }
    } catch (error) {
      showNotification('Error saving settings: ' + error.message, 'error');
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
      showNotification('Please fill in all fields', 'error');
      return;
    }
    try {
      const response = await apiFetch(`${API_BASE}/admin/users`, { method: 'POST', body: JSON.stringify(newUser) });
      if (response.ok) {
        setShowCreateUser(false);
        loadUsers();
        showNotification('User created successfully', 'success');
        setNewUser({ username: '', email: '', password: '', role: 'USER' });
      } else {
        const data = await response.json();
        showNotification(data.error || 'Failed to create user', 'error');
      }
    } catch (error) {
      showNotification('Error creating user: ' + error.message, 'error');
    }
  };

  const deleteUser = (userId, username) => {
    setUserToDelete({ id: userId, username });
    setShowDeleteConfirm(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const response = await apiFetch(`${API_BASE}/admin/users/${userToDelete.id}`, { method: 'DELETE' });
      if (response.ok) {
        loadUsers();
        showNotification('User deleted successfully', 'success');
      } else {
        showNotification('Failed to delete user', 'error');
      }
    } catch (error) {
      showNotification('Error deleting user: ' + error.message, 'error');
    } finally {
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    }
  };

  const loadIntegrationSettings = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/settings`);
      const data = await response.json();
      const allSettings = data.settings || {};
      const awsGroup = Object.values(allSettings).flat().filter(s => s.key.startsWith('AWS_'));
      setAwsSettings({
        region: awsGroup.find(s => s.key === 'AWS_REGION')?.value || '',
        accessKeyId: awsGroup.find(s => s.key === 'AWS_ACCESS_KEY_ID')?.value || '',
        secretAccessKey: awsGroup.find(s => s.key === 'AWS_SECRET_ACCESS_KEY')?.value || ''
      });
      const duoGroup = Object.values(allSettings).flat().filter(s => s.key.startsWith('DUO_'));
      setDuoSettings({
        integrationKey: duoGroup.find(s => s.key === 'DUO_IKEY')?.value || '',
        secretKey: duoGroup.find(s => s.key === 'DUO_SKEY')?.value || '',
        apiHostname: duoGroup.find(s => s.key === 'DUO_API_HOSTNAME')?.value || ''
      });
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
        showNotification('AWS settings saved successfully', 'success');
      } else {
        showNotification('Failed to save AWS settings', 'error');
      }
    } catch (error) {
      showNotification('Error saving AWS settings: ' + error.message, 'error');
    }
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
        showNotification('DUO settings saved successfully', 'success');
      } else {
        showNotification('Failed to save DUO settings', 'error');
      }
    } catch (error) {
      showNotification('Error saving DUO settings: ' + error.message, 'error');
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
        showNotification('Sync settings saved successfully', 'success');
      } else {
        showNotification('Failed to save sync settings', 'error');
      }
    } catch (error) {
      showNotification('Error saving sync settings: ' + error.message, 'error');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Settings" />
        <Tab label="Users" />
        <Tab label="Integrations" />
      </Tabs>

      {activeTab === 0 && (
        <Box sx={{ mt: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Application Settings</Typography>
                <Button variant="contained" onClick={saveAllSettings}>Save All Changes</Button>
              </Box>
              {Object.entries(settings).map(([category, categorySettings]) => (
                <Box key={category} sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>{category}</Typography>
                  {categorySettings.map((setting) => (
                    <Box key={setting.key} sx={{ mb: 2, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={6}>
                          <Typography variant="body1" fontWeight="bold">
                            {setting.key}
                            {setting.encrypted && <Chip label="Encrypted" size="small" color="warning" sx={{ ml: 1 }} />}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">{setting.description}</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField fullWidth size="small" type={setting.encrypted ? 'password' : 'text'} id={`setting-${setting.key}`} defaultValue={setting.value || ''} placeholder={setting.description} />
                        </Grid>
                      </Grid>
                    </Box>
                  ))}
                </Box>
              ))}
            </CardContent>
          </Card>
        </Box>
      )}

      {activeTab === 1 && (
        <Box sx={{ mt: 3 }}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">User Management</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowCreateUser(true)}>Create User</Button>
              </Box>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Username</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Last Login</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">No users found</TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell><Chip label={user.role} color={user.role === 'ADMIN' ? 'error' : 'primary'} size="small" /></TableCell>
                        <TableCell>{user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</TableCell>
                        <TableCell>
                          <IconButton size="small" color="error" onClick={() => deleteUser(user.id, user.username)}>
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Box>
      )}

      {activeTab === 2 && (
        <Box sx={{ mt: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>AWS Integration</Typography>
                  <TextField fullWidth label="Region" value={awsSettings.region} onChange={(e) => setAwsSettings({...awsSettings, region: e.target.value})} sx={{ mb: 2 }} />
                  <TextField fullWidth label="Access Key ID" value={awsSettings.accessKeyId} onChange={(e) => setAwsSettings({...awsSettings, accessKeyId: e.target.value})} sx={{ mb: 2 }} />
                  <TextField fullWidth label="Secret Access Key" type="password" value={awsSettings.secretAccessKey} onChange={(e) => setAwsSettings({...awsSettings, secretAccessKey: e.target.value})} sx={{ mb: 2 }} />
                  <Button variant="contained" onClick={saveAWSSettings}>Save AWS Settings</Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>DUO MFA</Typography>
                  <TextField fullWidth label="Integration Key" value={duoSettings.integrationKey} onChange={(e) => setDuoSettings({...duoSettings, integrationKey: e.target.value})} sx={{ mb: 2 }} />
                  <TextField fullWidth label="Secret Key" type="password" value={duoSettings.secretKey} onChange={(e) => setDuoSettings({...duoSettings, secretKey: e.target.value})} sx={{ mb: 2 }} />
                  <TextField fullWidth label="API Hostname" value={duoSettings.apiHostname} onChange={(e) => setDuoSettings({...duoSettings, apiHostname: e.target.value})} sx={{ mb: 2 }} />
                  <Button variant="contained" onClick={saveDUOSettings}>Save DUO Settings</Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Synchronization Settings</Typography>
                  <FormControlLabel control={<Switch checked={syncSettings.autoSyncEnabled} onChange={(e) => setSyncSettings({...syncSettings, autoSyncEnabled: e.target.checked})} />} label="Enable Automatic Synchronization" />
                  <TextField type="number" label="Sync Interval (minutes)" value={syncSettings.syncInterval} onChange={(e) => setSyncSettings({...syncSettings, syncInterval: parseInt(e.target.value)})} sx={{ mt: 2, mb: 2, maxWidth: 300 }} />
                  <br />
                  <Button variant="contained" onClick={saveSyncSettings}>Save Sync Settings</Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      <Dialog open={showCreateUser} onClose={() => setShowCreateUser(false)}>
        <DialogTitle>Create New User</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Username" value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})} sx={{ mt: 2, mb: 2 }} />
          <TextField fullWidth label="Email" type="email" value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} sx={{ mb: 2 }} />
          <TextField fullWidth label="Password" type="password" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} sx={{ mb: 2 }} />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Role</InputLabel>
            <Select value={newUser.role} label="Role" onChange={(e) => setNewUser({...newUser, role: e.target.value})}>
              <MenuItem value="USER">User</MenuItem>
              <MenuItem value="ADMIN">Admin</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateUser(false)}>Cancel</Button>
          <Button onClick={createUser} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete user "{userToDelete?.username}"?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          <Button onClick={confirmDeleteUser} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={notification.open} autoHideDuration={5000} onClose={() => setNotification({...notification, open: false})} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert onClose={() => setNotification({...notification, open: false})} severity={notification.severity} sx={{ width: '100%' }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Admin;
