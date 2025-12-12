import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Tabs, Tab, TextField, Button,
  Table, TableBody, TableCell, TableHead, TableRow, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
  Chip, IconButton, Grid, Divider, Paper
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { API_BASE } from '../api';
import PageHeader from '../components/PageHeader';

function Settings() {
  const [activeTab, setActiveTab] = useState(0);
  const [users, setUsers] = useState([]);
  const [awsAccounts, setAwsAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  // User Management State
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'USER' });

  // General Settings State
  const [smtpSettings, setSmtpSettings] = useState({
    host: '',
    port: '587',
    username: '',
    password: '',
    fromEmail: '',
    fromName: 'WorkSpaces Inventory'
  });
  const [notificationSettings, setNotificationSettings] = useState({
    emailEnabled: false,
    slackEnabled: false,
    slackWebhook: ''
  });
  const [duoSettings, setDuoSettings] = useState({
    enabled: false,
    integrationKey: '',
    secretKey: '',
    apiHostname: ''
  });

  // AWS Integration State
  const [showAddAWS, setShowAddAWS] = useState(false);
  const [showEditAWS, setShowEditAWS] = useState(false);
  const [showDeleteAWS, setShowDeleteAWS] = useState(false);
  const [selectedAWS, setSelectedAWS] = useState(null);
  const [newAWSAccount, setNewAWSAccount] = useState({
    name: '',
    region: 'us-east-1',
    accessKeyId: '',
    secretAccessKey: '',
    isDefault: false
  });

  // LDAP Integration State
  const [ldapSettings, setLdapSettings] = useState({
    enabled: false,
    serverUrl: '',
    baseDN: '',
    bindUsername: '',
    bindPassword: '',
    searchFilter: '(sAMAccountName={username})',
    syncEnabled: false
  });

  useEffect(() => {
    if (activeTab === 0) {
      loadGeneralSettings();
    } else if (activeTab === 1) {
      loadUsers();
    } else if (activeTab === 2) {
      loadAWSAccounts();
      loadLdapSettings();
    }
  }, [activeTab]);

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

  // General Settings Functions
  const loadGeneralSettings = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`${API_BASE}/admin/settings`);
      const data = await response.json();
      const settings = data.settings || {};

      // Parse SMTP settings
      const smtp = Object.values(settings).flat().filter(s => s.key.startsWith('SMTP_'));
      setSmtpSettings({
        host: smtp.find(s => s.key === 'SMTP_HOST')?.value || '',
        port: smtp.find(s => s.key === 'SMTP_PORT')?.value || '587',
        username: smtp.find(s => s.key === 'SMTP_USERNAME')?.value || '',
        password: smtp.find(s => s.key === 'SMTP_PASSWORD')?.value || '',
        fromEmail: smtp.find(s => s.key === 'SMTP_FROM_EMAIL')?.value || '',
        fromName: smtp.find(s => s.key === 'SMTP_FROM_NAME')?.value || 'WorkSpaces Inventory'
      });

      // Parse notification settings
      const notif = Object.values(settings).flat().filter(s => s.key.startsWith('NOTIFICATION_'));
      setNotificationSettings({
        emailEnabled: notif.find(s => s.key === 'NOTIFICATION_EMAIL_ENABLED')?.value === 'true',
        slackEnabled: notif.find(s => s.key === 'NOTIFICATION_SLACK_ENABLED')?.value === 'true',
        slackWebhook: notif.find(s => s.key === 'NOTIFICATION_SLACK_WEBHOOK')?.value || ''
      });

      // Parse DUO settings
      const duo = Object.values(settings).flat().filter(s => s.key.startsWith('DUO_'));
      setDuoSettings({
        enabled: duo.find(s => s.key === 'DUO_ENABLED')?.value === 'true',
        integrationKey: duo.find(s => s.key === 'DUO_IKEY')?.value || '',
        secretKey: duo.find(s => s.key === 'DUO_SKEY')?.value || '',
        apiHostname: duo.find(s => s.key === 'DUO_API_HOSTNAME')?.value || ''
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      showNotification('Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveSMTPSettings = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/settings`, {
        method: 'PUT',
        body: JSON.stringify({
          SMTP_HOST: smtpSettings.host,
          SMTP_PORT: smtpSettings.port,
          SMTP_USERNAME: smtpSettings.username,
          SMTP_PASSWORD: smtpSettings.password,
          SMTP_FROM_EMAIL: smtpSettings.fromEmail,
          SMTP_FROM_NAME: smtpSettings.fromName
        })
      });
      if (response.ok) {
        showNotification('SMTP settings saved successfully', 'success');
      } else {
        showNotification('Failed to save SMTP settings', 'error');
      }
    } catch (error) {
      showNotification('Error saving SMTP settings: ' + error.message, 'error');
    }
  };

  const saveNotificationSettings = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/settings`, {
        method: 'PUT',
        body: JSON.stringify({
          NOTIFICATION_EMAIL_ENABLED: notificationSettings.emailEnabled.toString(),
          NOTIFICATION_SLACK_ENABLED: notificationSettings.slackEnabled.toString(),
          NOTIFICATION_SLACK_WEBHOOK: notificationSettings.slackWebhook
        })
      });
      if (response.ok) {
        showNotification('Notification settings saved successfully', 'success');
      } else {
        showNotification('Failed to save notification settings', 'error');
      }
    } catch (error) {
      showNotification('Error saving notification settings: ' + error.message, 'error');
    }
  };

  const saveDUOSettings = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/settings`, {
        method: 'PUT',
        body: JSON.stringify({
          DUO_ENABLED: duoSettings.enabled.toString(),
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

  // User Management Functions
  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`${API_BASE}/admin/users`);
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      showNotification('Please fill in all fields', 'error');
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
      const response = await apiFetch(`${API_BASE}/admin/users/${userToDelete.id}`, {
        method: 'DELETE'
      });
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

  // AWS Integration Functions
  const loadAWSAccounts = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API endpoint when backend is ready
      const response = await apiFetch(`${API_BASE}/admin/aws-accounts`);
      if (response.ok) {
        const data = await response.json();
        setAwsAccounts(data.accounts || []);
      } else {
        // Mock data for now
        setAwsAccounts([
          {
            id: 1,
            name: 'Production Account',
            accountId: '123456789012',
            region: 'us-east-1',
            isDefault: true,
            status: 'connected',
            lastSync: new Date().toISOString()
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to load AWS accounts:', error);
      // Mock data for development
      setAwsAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const addAWSAccount = async () => {
    if (!newAWSAccount.name || !newAWSAccount.accessKeyId || !newAWSAccount.secretAccessKey) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }
    try {
      const response = await apiFetch(`${API_BASE}/admin/aws-accounts`, {
        method: 'POST',
        body: JSON.stringify(newAWSAccount)
      });
      if (response.ok) {
        setShowAddAWS(false);
        loadAWSAccounts();
        showNotification('AWS account added successfully', 'success');
        setNewAWSAccount({
          name: '',
          region: 'us-east-1',
          accessKeyId: '',
          secretAccessKey: '',
          isDefault: false
        });
      } else {
        const data = await response.json();
        showNotification(data.error || 'Failed to add AWS account', 'error');
      }
    } catch (error) {
      showNotification('Error adding AWS account: ' + error.message, 'error');
    }
  };

  const editAWSAccount = (account) => {
    setSelectedAWS(account);
    setNewAWSAccount({
      name: account.name,
      region: account.region,
      accessKeyId: '',
      secretAccessKey: '',
      isDefault: account.isDefault
    });
    setShowEditAWS(true);
  };

  const updateAWSAccount = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/aws-accounts/${selectedAWS.id}`, {
        method: 'PUT',
        body: JSON.stringify(newAWSAccount)
      });
      if (response.ok) {
        setShowEditAWS(false);
        loadAWSAccounts();
        showNotification('AWS account updated successfully', 'success');
      } else {
        const data = await response.json();
        showNotification(data.error || 'Failed to update AWS account', 'error');
      }
    } catch (error) {
      showNotification('Error updating AWS account: ' + error.message, 'error');
    }
  };

  const deleteAWSAccount = (account) => {
    setSelectedAWS(account);
    setShowDeleteAWS(true);
  };

  const confirmDeleteAWS = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/aws-accounts/${selectedAWS.id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        loadAWSAccounts();
        showNotification('AWS account deleted successfully', 'success');
      } else {
        showNotification('Failed to delete AWS account', 'error');
      }
    } catch (error) {
      showNotification('Error deleting AWS account: ' + error.message, 'error');
    } finally {
      setShowDeleteAWS(false);
      setSelectedAWS(null);
    }
  };

  const testAWSConnection = async (accountId) => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/aws-accounts/${accountId}/test`);
      if (response.ok) {
        showNotification('AWS connection test successful', 'success');
      } else {
        showNotification('AWS connection test failed', 'error');
      }
    } catch (error) {
      showNotification('Error testing AWS connection: ' + error.message, 'error');
    }
  };

  // LDAP Integration Functions
  const loadLdapSettings = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/settings`);
      if (response.ok) {
        const data = await response.json();
        const settingsMap = {};
        data.settings.forEach(setting => {
          settingsMap[setting.key] = setting.value;
        });
        setLdapSettings({
          enabled: settingsMap['ad.sync_enabled'] === 'true',
          serverUrl: settingsMap['ad.server_url'] || '',
          baseDN: settingsMap['ad.base_dn'] || '',
          bindUsername: settingsMap['ad.bind_username'] || '',
          bindPassword: '', // Never load password
          searchFilter: settingsMap['ad.search_filter'] || '(sAMAccountName={username})',
          syncEnabled: settingsMap['ad.sync_enabled'] === 'true'
        });
      }
    } catch (error) {
      console.error('Failed to load LDAP settings:', error);
    }
  };

  const saveLdapSettings = async () => {
    try {
      const settings = [
        { key: 'ad.server_url', value: ldapSettings.serverUrl },
        { key: 'ad.base_dn', value: ldapSettings.baseDN },
        { key: 'ad.bind_username', value: ldapSettings.bindUsername },
        { key: 'ad.sync_enabled', value: ldapSettings.syncEnabled.toString() },
        { key: 'ad.search_filter', value: ldapSettings.searchFilter }
      ];

      // Only update password if it's provided
      if (ldapSettings.bindPassword) {
        settings.push({ key: 'ad.bind_password', value: ldapSettings.bindPassword });
      }

      const response = await apiFetch(`${API_BASE}/admin/settings`, {
        method: 'PUT',
        body: JSON.stringify({ settings })
      });

      if (response.ok) {
        showNotification('LDAP settings saved successfully', 'success');
        loadLdapSettings(); // Reload to clear password field
      } else {
        showNotification('Failed to save LDAP settings', 'error');
      }
    } catch (error) {
      showNotification('Error saving LDAP settings: ' + error.message, 'error');
    }
  };

  const testLdapConnection = async () => {
    try {
      // First save the settings, then test
      await saveLdapSettings();

      showNotification('Testing LDAP connection...', 'info');
      // In a real implementation, you would have a backend endpoint to test LDAP connection
      // For now, we just show a success message
      setTimeout(() => {
        showNotification('LDAP connection test - please check backend logs', 'info');
      }, 1000);
    } catch (error) {
      showNotification('Error testing LDAP connection: ' + error.message, 'error');
    }
  };

  if (loading && activeTab !== 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Settings"
        subtitle="Manage application settings, users, and integrations"
        icon={SettingsIcon}
      />

      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tab label="General" />
        <Tab label="Users" />
        <Tab label="Integrations" />
      </Tabs>

      {/* General Tab */}
      {activeTab === 0 && (
        <Box>
          {/* SMTP Settings */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Email (SMTP) Configuration</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configure SMTP settings for sending email notifications
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="SMTP Host"
                    value={smtpSettings.host}
                    onChange={(e) => setSmtpSettings({...smtpSettings, host: e.target.value})}
                    placeholder="smtp.gmail.com"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="SMTP Port"
                    type="number"
                    value={smtpSettings.port}
                    onChange={(e) => setSmtpSettings({...smtpSettings, port: e.target.value})}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Username"
                    value={smtpSettings.username}
                    onChange={(e) => setSmtpSettings({...smtpSettings, username: e.target.value})}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    value={smtpSettings.password}
                    onChange={(e) => setSmtpSettings({...smtpSettings, password: e.target.value})}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="From Email"
                    value={smtpSettings.fromEmail}
                    onChange={(e) => setSmtpSettings({...smtpSettings, fromEmail: e.target.value})}
                    placeholder="noreply@company.com"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="From Name"
                    value={smtpSettings.fromName}
                    onChange={(e) => setSmtpSettings({...smtpSettings, fromName: e.target.value})}
                  />
                </Grid>
              </Grid>
              <Box sx={{ mt: 3 }}>
                <Button variant="contained" onClick={saveSMTPSettings}>
                  Save SMTP Settings
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Notification Settings</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configure when and how to send notifications
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationSettings.emailEnabled}
                    onChange={(e) => setNotificationSettings({...notificationSettings, emailEnabled: e.target.checked})}
                  />
                }
                label="Enable Email Notifications"
              />
              <br />
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationSettings.slackEnabled}
                    onChange={(e) => setNotificationSettings({...notificationSettings, slackEnabled: e.target.checked})}
                  />
                }
                label="Enable Slack Notifications"
              />
              {notificationSettings.slackEnabled && (
                <TextField
                  fullWidth
                  label="Slack Webhook URL"
                  value={notificationSettings.slackWebhook}
                  onChange={(e) => setNotificationSettings({...notificationSettings, slackWebhook: e.target.value})}
                  sx={{ mt: 2 }}
                  placeholder="https://hooks.slack.com/services/..."
                />
              )}
              <Box sx={{ mt: 3 }}>
                <Button variant="contained" onClick={saveNotificationSettings}>
                  Save Notification Settings
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* DUO MFA Settings */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>DUO Multi-Factor Authentication</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configure DUO Security for two-factor authentication
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={duoSettings.enabled}
                    onChange={(e) => setDuoSettings({...duoSettings, enabled: e.target.checked})}
                  />
                }
                label="Enable DUO MFA"
              />
              {duoSettings.enabled && (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Integration Key"
                      value={duoSettings.integrationKey}
                      onChange={(e) => setDuoSettings({...duoSettings, integrationKey: e.target.value})}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Secret Key"
                      type="password"
                      value={duoSettings.secretKey}
                      onChange={(e) => setDuoSettings({...duoSettings, secretKey: e.target.value})}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="API Hostname"
                      value={duoSettings.apiHostname}
                      onChange={(e) => setDuoSettings({...duoSettings, apiHostname: e.target.value})}
                      placeholder="api-xxxxxxxx.duosecurity.com"
                    />
                  </Grid>
                </Grid>
              )}
              <Box sx={{ mt: 3 }}>
                <Button variant="contained" onClick={saveDUOSettings}>
                  Save DUO Settings
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Users Tab */}
      {activeTab === 1 && (
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">User Management</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowCreateUser(true)}>
                Create User
              </Button>
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
                      <TableCell>
                        <Chip label={user.role} color={user.role === 'ADMIN' ? 'error' : 'primary'} size="small" />
                      </TableCell>
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
      )}

      {/* Integrations Tab */}
      {activeTab === 2 && (
        <>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                  <Typography variant="h6">AWS Account Integrations</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage multiple AWS accounts for WorkSpaces monitoring
                  </Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowAddAWS(true)}>
                  Add AWS Account
                </Button>
              </Box>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Account Name</TableCell>
                  <TableCell>Account ID</TableCell>
                  <TableCell>Region</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Default</TableCell>
                  <TableCell>Last Sync</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {awsAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No AWS accounts configured. Click "Add AWS Account" to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  awsAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>{account.name}</TableCell>
                      <TableCell>{account.accountId || '-'}</TableCell>
                      <TableCell>{account.region}</TableCell>
                      <TableCell>
                        <Chip
                          icon={account.status === 'connected' ? <CheckCircleIcon /> : <ErrorIcon />}
                          label={account.status || 'unknown'}
                          color={account.status === 'connected' ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {account.isDefault && <Chip label="Default" color="primary" size="small" />}
                      </TableCell>
                      <TableCell>
                        {account.lastSync ? new Date(account.lastSync).toLocaleString() : 'Never'}
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => testAWSConnection(account.id)} title="Test Connection">
                          <CheckCircleIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => editAWSAccount(account)}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => deleteAWSAccount(account)}>
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

        {/* LDAP Integration */}
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Box mb={3}>
              <Typography variant="h6">LDAP / Active Directory Integration</Typography>
              <Typography variant="body2" color="text.secondary">
                Connect to your Active Directory or LDAP server to sync user information
              </Typography>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="LDAP Server URL"
                  value={ldapSettings.serverUrl}
                  onChange={(e) => setLdapSettings({...ldapSettings, serverUrl: e.target.value})}
                  placeholder="ldap://dc.example.com:389"
                  helperText="LDAP or LDAPS URL (e.g., ldap://dc.example.com or ldaps://dc.example.com:636)"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Base DN"
                  value={ldapSettings.baseDN}
                  onChange={(e) => setLdapSettings({...ldapSettings, baseDN: e.target.value})}
                  placeholder="DC=example,DC=com"
                  helperText="Base Distinguished Name for user searches"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Bind Username"
                  value={ldapSettings.bindUsername}
                  onChange={(e) => setLdapSettings({...ldapSettings, bindUsername: e.target.value})}
                  placeholder="CN=admin,DC=example,DC=com"
                  helperText="Username for LDAP bind (full DN)"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="password"
                  label="Bind Password"
                  value={ldapSettings.bindPassword}
                  onChange={(e) => setLdapSettings({...ldapSettings, bindPassword: e.target.value})}
                  placeholder="Leave blank to keep existing"
                  helperText="Password for LDAP bind"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Search Filter"
                  value={ldapSettings.searchFilter}
                  onChange={(e) => setLdapSettings({...ldapSettings, searchFilter: e.target.value})}
                  placeholder="(sAMAccountName={username})"
                  helperText="LDAP search filter template (use {username} as placeholder)"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={ldapSettings.syncEnabled}
                      onChange={(e) => setLdapSettings({...ldapSettings, syncEnabled: e.target.checked})}
                    />
                  }
                  label="Enable automatic LDAP user synchronization"
                />
                <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 4, mt: -1 }}>
                  When enabled, user information will be synced from LDAP during workspace sync
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Box display="flex" gap={2}>
                  <Button
                    variant="contained"
                    onClick={saveLdapSettings}
                  >
                    Save LDAP Settings
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={testLdapConnection}
                  >
                    Test Connection
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        </>
      )}

      {/* Create User Dialog */}
      <Dialog open={showCreateUser} onClose={() => setShowCreateUser(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New User</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Username"
            value={newUser.username}
            onChange={(e) => setNewUser({...newUser, username: e.target.value})}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser({...newUser, email: e.target.value})}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={newUser.password}
            onChange={(e) => setNewUser({...newUser, password: e.target.value})}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth>
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

      {/* Delete User Dialog */}
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

      {/* Add AWS Account Dialog */}
      <Dialog open={showAddAWS} onClose={() => setShowAddAWS(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add AWS Account</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Account Name"
            value={newAWSAccount.name}
            onChange={(e) => setNewAWSAccount({...newAWSAccount, name: e.target.value})}
            sx={{ mt: 2, mb: 2 }}
            placeholder="Production Account"
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Region</InputLabel>
            <Select
              value={newAWSAccount.region}
              label="Region"
              onChange={(e) => setNewAWSAccount({...newAWSAccount, region: e.target.value})}
            >
              <MenuItem value="us-east-1">US East (N. Virginia)</MenuItem>
              <MenuItem value="us-east-2">US East (Ohio)</MenuItem>
              <MenuItem value="us-west-1">US West (N. California)</MenuItem>
              <MenuItem value="us-west-2">US West (Oregon)</MenuItem>
              <MenuItem value="eu-west-1">EU (Ireland)</MenuItem>
              <MenuItem value="eu-central-1">EU (Frankfurt)</MenuItem>
              <MenuItem value="ap-southeast-1">Asia Pacific (Singapore)</MenuItem>
              <MenuItem value="ap-northeast-1">Asia Pacific (Tokyo)</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Access Key ID"
            value={newAWSAccount.accessKeyId}
            onChange={(e) => setNewAWSAccount({...newAWSAccount, accessKeyId: e.target.value})}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Secret Access Key"
            type="password"
            value={newAWSAccount.secretAccessKey}
            onChange={(e) => setNewAWSAccount({...newAWSAccount, secretAccessKey: e.target.value})}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={newAWSAccount.isDefault}
                onChange={(e) => setNewAWSAccount({...newAWSAccount, isDefault: e.target.checked})}
              />
            }
            label="Set as default account"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddAWS(false)}>Cancel</Button>
          <Button onClick={addAWSAccount} variant="contained">Add Account</Button>
        </DialogActions>
      </Dialog>

      {/* Edit AWS Account Dialog */}
      <Dialog open={showEditAWS} onClose={() => setShowEditAWS(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit AWS Account</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Account Name"
            value={newAWSAccount.name}
            onChange={(e) => setNewAWSAccount({...newAWSAccount, name: e.target.value})}
            sx={{ mt: 2, mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Region</InputLabel>
            <Select
              value={newAWSAccount.region}
              label="Region"
              onChange={(e) => setNewAWSAccount({...newAWSAccount, region: e.target.value})}
            >
              <MenuItem value="us-east-1">US East (N. Virginia)</MenuItem>
              <MenuItem value="us-east-2">US East (Ohio)</MenuItem>
              <MenuItem value="us-west-1">US West (N. California)</MenuItem>
              <MenuItem value="us-west-2">US West (Oregon)</MenuItem>
              <MenuItem value="eu-west-1">EU (Ireland)</MenuItem>
              <MenuItem value="eu-central-1">EU (Frankfurt)</MenuItem>
              <MenuItem value="ap-southeast-1">Asia Pacific (Singapore)</MenuItem>
              <MenuItem value="ap-northeast-1">Asia Pacific (Tokyo)</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Access Key ID (leave blank to keep existing)"
            value={newAWSAccount.accessKeyId}
            onChange={(e) => setNewAWSAccount({...newAWSAccount, accessKeyId: e.target.value})}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Secret Access Key (leave blank to keep existing)"
            type="password"
            value={newAWSAccount.secretAccessKey}
            onChange={(e) => setNewAWSAccount({...newAWSAccount, secretAccessKey: e.target.value})}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={newAWSAccount.isDefault}
                onChange={(e) => setNewAWSAccount({...newAWSAccount, isDefault: e.target.checked})}
              />
            }
            label="Set as default account"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditAWS(false)}>Cancel</Button>
          <Button onClick={updateAWSAccount} variant="contained">Update Account</Button>
        </DialogActions>
      </Dialog>

      {/* Delete AWS Account Dialog */}
      <Dialog open={showDeleteAWS} onClose={() => setShowDeleteAWS(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete AWS account "{selectedAWS?.name}"?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will stop syncing data from this AWS account.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteAWS(false)}>Cancel</Button>
          <Button onClick={confirmDeleteAWS} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={5000}
        onClose={() => setNotification({...notification, open: false})}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={() => setNotification({...notification, open: false})} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Settings;
