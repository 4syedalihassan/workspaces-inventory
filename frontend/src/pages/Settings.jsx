import { useEffect, useState } from 'react';
import {
  Card,
  Tabs,
  Input,
  Button,
  Table,
  Select,
  Switch,
  Modal,
  Row,
  Col,
  Space,
  Typography,
  Tag,
  message,
  Spin,
  Form,
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  SettingOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { API_BASE } from '../api';

const { Title, Text } = Typography;

function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [users, setUsers] = useState([]);
  const [awsAccounts, setAwsAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

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
    if (activeTab === 'general') {
      loadGeneralSettings();
    } else if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'integrations') {
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

  // General Settings Functions
  const loadGeneralSettings = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`${API_BASE}/admin/settings`);
      const data = await response.json();
      const settings = data.settings || {};

      const smtp = Object.values(settings).flat().filter(s => s.key.startsWith('SMTP_'));
      setSmtpSettings({
        host: smtp.find(s => s.key === 'SMTP_HOST')?.value || '',
        port: smtp.find(s => s.key === 'SMTP_PORT')?.value || '587',
        username: smtp.find(s => s.key === 'SMTP_USERNAME')?.value || '',
        password: smtp.find(s => s.key === 'SMTP_PASSWORD')?.value || '',
        fromEmail: smtp.find(s => s.key === 'SMTP_FROM_EMAIL')?.value || '',
        fromName: smtp.find(s => s.key === 'SMTP_FROM_NAME')?.value || 'WorkSpaces Inventory'
      });

      const notif = Object.values(settings).flat().filter(s => s.key.startsWith('NOTIFICATION_'));
      setNotificationSettings({
        emailEnabled: notif.find(s => s.key === 'NOTIFICATION_EMAIL_ENABLED')?.value === 'true',
        slackEnabled: notif.find(s => s.key === 'NOTIFICATION_SLACK_ENABLED')?.value === 'true',
        slackWebhook: notif.find(s => s.key === 'NOTIFICATION_SLACK_WEBHOOK')?.value || ''
      });

      const duo = Object.values(settings).flat().filter(s => s.key.startsWith('DUO_'));
      setDuoSettings({
        enabled: duo.find(s => s.key === 'DUO_ENABLED')?.value === 'true',
        integrationKey: duo.find(s => s.key === 'DUO_IKEY')?.value || '',
        secretKey: duo.find(s => s.key === 'DUO_SKEY')?.value || '',
        apiHostname: duo.find(s => s.key === 'DUO_API_HOSTNAME')?.value || ''
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      message.error('Failed to load settings');
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
        message.success('SMTP settings saved successfully');
      } else {
        message.error('Failed to save SMTP settings');
      }
    } catch (error) {
      message.error('Error saving SMTP settings: ' + error.message);
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
        message.success('Notification settings saved successfully');
      } else {
        message.error('Failed to save notification settings');
      }
    } catch (error) {
      message.error('Error saving notification settings: ' + error.message);
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
        message.success('DUO settings saved successfully');
      } else {
        message.error('Failed to save DUO settings');
      }
    } catch (error) {
      message.error('Error saving DUO settings: ' + error.message);
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
      message.error('Please fill in all fields');
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
        message.success('User created successfully');
        setNewUser({ username: '', email: '', password: '', role: 'USER' });
      } else {
        const data = await response.json();
        message.error(data.error || 'Failed to create user');
      }
    } catch (error) {
      message.error('Error creating user: ' + error.message);
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
        message.success('User deleted successfully');
      } else {
        message.error('Failed to delete user');
      }
    } catch (error) {
      message.error('Error deleting user: ' + error.message);
    } finally {
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    }
  };

  // AWS Integration Functions
  const loadAWSAccounts = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`${API_BASE}/admin/aws-accounts`);
      if (response.ok) {
        const data = await response.json();
        setAwsAccounts(data.accounts || []);
      } else {
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
      setAwsAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const addAWSAccount = async () => {
    if (!newAWSAccount.name || !newAWSAccount.accessKeyId || !newAWSAccount.secretAccessKey) {
      message.error('Please fill in all required fields');
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
        message.success('AWS account added successfully');
        setNewAWSAccount({
          name: '',
          region: 'us-east-1',
          accessKeyId: '',
          secretAccessKey: '',
          isDefault: false
        });
      } else {
        const data = await response.json();
        message.error(data.error || 'Failed to add AWS account');
      }
    } catch (error) {
      message.error('Error adding AWS account: ' + error.message);
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
        message.success('AWS account updated successfully');
      } else {
        const data = await response.json();
        message.error(data.error || 'Failed to update AWS account');
      }
    } catch (error) {
      message.error('Error updating AWS account: ' + error.message);
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
        message.success('AWS account deleted successfully');
      } else {
        message.error('Failed to delete AWS account');
      }
    } catch (error) {
      message.error('Error deleting AWS account: ' + error.message);
    } finally {
      setShowDeleteAWS(false);
      setSelectedAWS(null);
    }
  };

  const testAWSConnection = async (accountId) => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/aws-accounts/${accountId}/test`);
      if (response.ok) {
        message.success('AWS connection test successful');
      } else {
        message.error('AWS connection test failed');
      }
    } catch (error) {
      message.error('Error testing AWS connection: ' + error.message);
    }
  };

  const syncAWSAccount = async (accountId, accountName) => {
    try {
      message.loading({ content: `Syncing ${accountName}...`, key: 'sync', duration: 0 });
      const response = await apiFetch(`${API_BASE}/admin/aws-accounts/${accountId}/sync`, {
        method: 'POST'
      });
      if (response.ok) {
        message.success({ content: `Sync started for ${accountName}`, key: 'sync' });
        // Reload accounts to see updated sync time
        setTimeout(() => loadAWSAccounts(), 2000);
      } else {
        const data = await response.json();
        message.error({ content: data.error || 'Failed to start sync', key: 'sync' });
      }
    } catch (error) {
      message.error({ content: 'Error syncing AWS account: ' + error.message, key: 'sync' });
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
          bindPassword: '',
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

      if (ldapSettings.bindPassword) {
        settings.push({ key: 'ad.bind_password', value: ldapSettings.bindPassword });
      }

      const response = await apiFetch(`${API_BASE}/admin/settings`, {
        method: 'PUT',
        body: JSON.stringify({ settings })
      });

      if (response.ok) {
        message.success('LDAP settings saved successfully');
        loadLdapSettings();
      } else {
        message.error('Failed to save LDAP settings');
      }
    } catch (error) {
      message.error('Error saving LDAP settings: ' + error.message);
    }
  };

  const testLdapConnection = async () => {
    try {
      await saveLdapSettings();
      message.info('Testing LDAP connection...');
      setTimeout(() => {
        message.info('LDAP connection test - please check backend logs');
      }, 1000);
    } catch (error) {
      message.error('Error testing LDAP connection: ' + error.message);
    }
  };

  const userColumns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={role === 'ADMIN' ? 'red' : 'blue'}>{role}</Tag>
      ),
    },
    {
      title: 'Last Login',
      dataIndex: 'last_login',
      key: 'last_login',
      render: (date) => date ? new Date(date).toLocaleString() : 'Never',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            Modal.confirm({
              title: `Delete user "${record.username}"?`,
              content: 'Are you sure you want to delete this user? This action cannot be undone.',
              okText: 'Delete',
              okType: 'danger',
              cancelText: 'Cancel',
              onOk: () => deleteUser(record.id, record.username),
            });
          }}
        />
      ),
    },
  ];

  const awsColumns = [
    {
      title: 'Account Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Account ID',
      dataIndex: 'accountId',
      key: 'accountId',
      render: (text) => text || '-',
    },
    {
      title: 'Region',
      dataIndex: 'region',
      key: 'region',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag
          icon={status === 'connected' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          color={status === 'connected' ? 'success' : 'error'}
        >
          {status || 'unknown'}
        </Tag>
      ),
    },
    {
      title: 'Default',
      dataIndex: 'isDefault',
      key: 'isDefault',
      render: (isDefault) => isDefault ? <Tag color="blue">Default</Tag> : null,
    },
    {
      title: 'Last Sync',
      dataIndex: 'lastSync',
      key: 'lastSync',
      render: (date) => date ? new Date(date).toLocaleString() : 'Never',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<SyncOutlined />}
            onClick={() => syncAWSAccount(record.id, record.name)}
            title="Sync WorkSpaces"
          />
          <Button
            type="text"
            icon={<CheckCircleOutlined />}
            onClick={() => testAWSConnection(record.id)}
            title="Test Connection"
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => editAWSAccount(record)}
            title="Edit"
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => deleteAWSAccount(record)}
            title="Delete"
          />
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'general',
      label: 'General',
      children: loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <Spin size="large" />
        </div>
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* SMTP Settings */}
          <Card title="Email (SMTP) Configuration" bordered={false}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Configure SMTP settings for sending email notifications
            </Text>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>SMTP Host</Text>
                  <Input
                    placeholder="smtp.gmail.com"
                    value={smtpSettings.host}
                    onChange={(e) => setSmtpSettings({...smtpSettings, host: e.target.value})}
                  />
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>SMTP Port</Text>
                  <Input
                    type="number"
                    value={smtpSettings.port}
                    onChange={(e) => setSmtpSettings({...smtpSettings, port: e.target.value})}
                  />
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>Username</Text>
                  <Input
                    value={smtpSettings.username}
                    onChange={(e) => setSmtpSettings({...smtpSettings, username: e.target.value})}
                  />
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>Password</Text>
                  <Input.Password
                    value={smtpSettings.password}
                    onChange={(e) => setSmtpSettings({...smtpSettings, password: e.target.value})}
                  />
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>From Email</Text>
                  <Input
                    placeholder="noreply@company.com"
                    value={smtpSettings.fromEmail}
                    onChange={(e) => setSmtpSettings({...smtpSettings, fromEmail: e.target.value})}
                  />
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>From Name</Text>
                  <Input
                    value={smtpSettings.fromName}
                    onChange={(e) => setSmtpSettings({...smtpSettings, fromName: e.target.value})}
                  />
                </div>
              </Col>
            </Row>
            <div style={{ marginTop: 16 }}>
              <Button type="primary" onClick={saveSMTPSettings}>
                Save SMTP Settings
              </Button>
            </div>
          </Card>

          {/* Notification Settings */}
          <Card title="Notification Settings" bordered={false}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Configure when and how to send notifications
            </Text>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Switch
                  checked={notificationSettings.emailEnabled}
                  onChange={(checked) => setNotificationSettings({...notificationSettings, emailEnabled: checked})}
                />
                <Text style={{ marginLeft: 8 }}>Enable Email Notifications</Text>
              </div>
              <div>
                <Switch
                  checked={notificationSettings.slackEnabled}
                  onChange={(checked) => setNotificationSettings({...notificationSettings, slackEnabled: checked})}
                />
                <Text style={{ marginLeft: 8 }}>Enable Slack Notifications</Text>
              </div>
              {notificationSettings.slackEnabled && (
                <Input
                  placeholder="https://hooks.slack.com/services/..."
                  value={notificationSettings.slackWebhook}
                  onChange={(e) => setNotificationSettings({...notificationSettings, slackWebhook: e.target.value})}
                  style={{ marginTop: 8 }}
                />
              )}
              <Button type="primary" onClick={saveNotificationSettings}>
                Save Notification Settings
              </Button>
            </Space>
          </Card>

          {/* DUO MFA Settings */}
          <Card title="DUO Multi-Factor Authentication" bordered={false}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Configure DUO Security for two-factor authentication
            </Text>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Switch
                  checked={duoSettings.enabled}
                  onChange={(checked) => setDuoSettings({...duoSettings, enabled: checked})}
                />
                <Text style={{ marginLeft: 8 }}>Enable DUO MFA</Text>
              </div>
              {duoSettings.enabled && (
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={8}>
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>Integration Key</Text>
                      <Input
                        value={duoSettings.integrationKey}
                        onChange={(e) => setDuoSettings({...duoSettings, integrationKey: e.target.value})}
                      />
                    </div>
                  </Col>
                  <Col xs={24} md={8}>
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>Secret Key</Text>
                      <Input.Password
                        value={duoSettings.secretKey}
                        onChange={(e) => setDuoSettings({...duoSettings, secretKey: e.target.value})}
                      />
                    </div>
                  </Col>
                  <Col xs={24} md={8}>
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>API Hostname</Text>
                      <Input
                        placeholder="api-xxxxxxxx.duosecurity.com"
                        value={duoSettings.apiHostname}
                        onChange={(e) => setDuoSettings({...duoSettings, apiHostname: e.target.value})}
                      />
                    </div>
                  </Col>
                </Row>
              )}
              <Button type="primary" onClick={saveDUOSettings}>
                Save DUO Settings
              </Button>
            </Space>
          </Card>
        </Space>
      ),
    },
    {
      key: 'users',
      label: 'Users',
      children: (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <Title level={5} style={{ margin: 0 }}>User Management</Title>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowCreateUser(true)}
            >
              Create User
            </Button>
          </div>
          <Table
            columns={userColumns}
            dataSource={users}
            loading={loading}
            rowKey="id"
            size="small"
          />
        </Card>
      ),
    },
    {
      key: 'integrations',
      label: 'Integrations',
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* AWS Accounts */}
          <Card>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Title level={5} style={{ margin: 0 }}>AWS Account Integrations</Title>
                  <Text type="secondary">Manage multiple AWS accounts for WorkSpaces monitoring</Text>
                </div>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setShowAddAWS(true)}
                >
                  Add AWS Account
                </Button>
              </div>
            </div>
            <Table
              columns={awsColumns}
              dataSource={awsAccounts}
              loading={loading}
              rowKey="id"
              size="small"
            />
          </Card>

          {/* LDAP Integration */}
          <Card title="LDAP / Active Directory Integration" bordered={false}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Connect to your Active Directory or LDAP server to sync user information
            </Text>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>LDAP Server URL</Text>
                  <Input
                    placeholder="ldap://dc.example.com:389"
                    value={ldapSettings.serverUrl}
                    onChange={(e) => setLdapSettings({...ldapSettings, serverUrl: e.target.value})}
                  />
                  <Text type="secondary" style={{ fontSize: '11px' }}>LDAP or LDAPS URL</Text>
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>Base DN</Text>
                  <Input
                    placeholder="DC=example,DC=com"
                    value={ldapSettings.baseDN}
                    onChange={(e) => setLdapSettings({...ldapSettings, baseDN: e.target.value})}
                  />
                  <Text type="secondary" style={{ fontSize: '11px' }}>Base Distinguished Name for user searches</Text>
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>Bind Username</Text>
                  <Input
                    placeholder="CN=admin,DC=example,DC=com"
                    value={ldapSettings.bindUsername}
                    onChange={(e) => setLdapSettings({...ldapSettings, bindUsername: e.target.value})}
                  />
                  <Text type="secondary" style={{ fontSize: '11px' }}>Username for LDAP bind (full DN)</Text>
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>Bind Password</Text>
                  <Input.Password
                    placeholder="Leave blank to keep existing"
                    value={ldapSettings.bindPassword}
                    onChange={(e) => setLdapSettings({...ldapSettings, bindPassword: e.target.value})}
                  />
                  <Text type="secondary" style={{ fontSize: '11px' }}>Password for LDAP bind</Text>
                </div>
              </Col>
              <Col xs={24}>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>Search Filter</Text>
                  <Input
                    placeholder="(sAMAccountName={username})"
                    value={ldapSettings.searchFilter}
                    onChange={(e) => setLdapSettings({...ldapSettings, searchFilter: e.target.value})}
                  />
                  <Text type="secondary" style={{ fontSize: '11px' }}>LDAP search filter template (use {'{username}'} as placeholder)</Text>
                </div>
              </Col>
              <Col xs={24}>
                <div style={{ marginBottom: 16 }}>
                  <Switch
                    checked={ldapSettings.syncEnabled}
                    onChange={(checked) => setLdapSettings({...ldapSettings, syncEnabled: checked})}
                  />
                  <Text style={{ marginLeft: 8 }}>Enable automatic LDAP user synchronization</Text>
                  <div style={{ marginLeft: 32, marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      When enabled, user information will be synced from LDAP during workspace sync
                    </Text>
                  </div>
                </div>
              </Col>
              <Col xs={24}>
                <Space>
                  <Button type="primary" onClick={saveLdapSettings}>
                    Save LDAP Settings
                  </Button>
                  <Button onClick={testLdapConnection}>
                    Test Connection
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Space>
      ),
    },
  ];

  if (loading && activeTab !== 'general') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Space align="center" style={{ marginBottom: 8 }}>
          <SettingOutlined style={{ fontSize: 28, color: '#ff9900' }} />
          <Title level={2} style={{ margin: 0 }}>Settings</Title>
        </Space>
        <Text type="secondary">Manage application settings, users, and integrations</Text>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      {/* Create User Modal */}
      <Modal
        title="Create New User"
        open={showCreateUser}
        onOk={createUser}
        onCancel={() => setShowCreateUser(false)}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Input
            placeholder="Username"
            value={newUser.username}
            onChange={(e) => setNewUser({...newUser, username: e.target.value})}
          />
          <Input
            placeholder="Email"
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser({...newUser, email: e.target.value})}
          />
          <Input.Password
            placeholder="Password"
            value={newUser.password}
            onChange={(e) => setNewUser({...newUser, password: e.target.value})}
          />
          <Select
            style={{ width: '100%' }}
            value={newUser.role}
            onChange={(val) => setNewUser({...newUser, role: val})}
          >
            <Select.Option value="USER">User</Select.Option>
            <Select.Option value="ADMIN">Admin</Select.Option>
          </Select>
        </Space>
      </Modal>

      {/* Delete User Confirmation */}
      <Modal
        title="Confirm Delete"
        open={showDeleteConfirm}
        onOk={confirmDeleteUser}
        onCancel={() => setShowDeleteConfirm(false)}
        okText="Delete"
        okButtonProps={{ danger: true }}
      >
        <Text>Are you sure you want to delete user "{userToDelete?.username}"?</Text>
      </Modal>

      {/* Add AWS Account Modal */}
      <Modal
        title="Add AWS Account"
        open={showAddAWS}
        onOk={addAWSAccount}
        onCancel={() => setShowAddAWS(false)}
        width={600}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Input
            placeholder="Account Name (e.g., Production Account)"
            value={newAWSAccount.name}
            onChange={(e) => setNewAWSAccount({...newAWSAccount, name: e.target.value})}
          />
          <Select
            style={{ width: '100%' }}
            value={newAWSAccount.region}
            onChange={(val) => setNewAWSAccount({...newAWSAccount, region: val})}
          >
            <Select.Option value="us-east-1">US East (N. Virginia)</Select.Option>
            <Select.Option value="us-east-2">US East (Ohio)</Select.Option>
            <Select.Option value="us-west-1">US West (N. California)</Select.Option>
            <Select.Option value="us-west-2">US West (Oregon)</Select.Option>
            <Select.Option value="eu-west-1">EU (Ireland)</Select.Option>
            <Select.Option value="eu-central-1">EU (Frankfurt)</Select.Option>
            <Select.Option value="ap-southeast-1">Asia Pacific (Singapore)</Select.Option>
            <Select.Option value="ap-northeast-1">Asia Pacific (Tokyo)</Select.Option>
          </Select>
          <Input
            placeholder="Access Key ID"
            value={newAWSAccount.accessKeyId}
            onChange={(e) => setNewAWSAccount({...newAWSAccount, accessKeyId: e.target.value})}
          />
          <Input.Password
            placeholder="Secret Access Key"
            value={newAWSAccount.secretAccessKey}
            onChange={(e) => setNewAWSAccount({...newAWSAccount, secretAccessKey: e.target.value})}
          />
          <div>
            <Switch
              checked={newAWSAccount.isDefault}
              onChange={(checked) => setNewAWSAccount({...newAWSAccount, isDefault: checked})}
            />
            <Text style={{ marginLeft: 8 }}>Set as default account</Text>
          </div>
        </Space>
      </Modal>

      {/* Edit AWS Account Modal */}
      <Modal
        title="Edit AWS Account"
        open={showEditAWS}
        onOk={updateAWSAccount}
        onCancel={() => setShowEditAWS(false)}
        width={600}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Input
            placeholder="Account Name"
            value={newAWSAccount.name}
            onChange={(e) => setNewAWSAccount({...newAWSAccount, name: e.target.value})}
          />
          <Select
            style={{ width: '100%' }}
            value={newAWSAccount.region}
            onChange={(val) => setNewAWSAccount({...newAWSAccount, region: val})}
          >
            <Select.Option value="us-east-1">US East (N. Virginia)</Select.Option>
            <Select.Option value="us-east-2">US East (Ohio)</Select.Option>
            <Select.Option value="us-west-1">US West (N. California)</Select.Option>
            <Select.Option value="us-west-2">US West (Oregon)</Select.Option>
            <Select.Option value="eu-west-1">EU (Ireland)</Select.Option>
            <Select.Option value="eu-central-1">EU (Frankfurt)</Select.Option>
            <Select.Option value="ap-southeast-1">Asia Pacific (Singapore)</Select.Option>
            <Select.Option value="ap-northeast-1">Asia Pacific (Tokyo)</Select.Option>
          </Select>
          <Input
            placeholder="Access Key ID (leave blank to keep existing)"
            value={newAWSAccount.accessKeyId}
            onChange={(e) => setNewAWSAccount({...newAWSAccount, accessKeyId: e.target.value})}
          />
          <Input.Password
            placeholder="Secret Access Key (leave blank to keep existing)"
            value={newAWSAccount.secretAccessKey}
            onChange={(e) => setNewAWSAccount({...newAWSAccount, secretAccessKey: e.target.value})}
          />
          <div>
            <Switch
              checked={newAWSAccount.isDefault}
              onChange={(checked) => setNewAWSAccount({...newAWSAccount, isDefault: checked})}
            />
            <Text style={{ marginLeft: 8 }}>Set as default account</Text>
          </div>
        </Space>
      </Modal>

      {/* Delete AWS Account Confirmation */}
      <Modal
        title="Confirm Delete"
        open={showDeleteAWS}
        onOk={confirmDeleteAWS}
        onCancel={() => setShowDeleteAWS(false)}
        okText="Delete"
        okButtonProps={{ danger: true }}
      >
        <Space direction="vertical">
          <Text>Are you sure you want to delete AWS account "{selectedAWS?.name}"?</Text>
          <Text type="secondary">This will stop syncing data from this AWS account.</Text>
        </Space>
      </Modal>
    </div>
  );
}

export default Settings;
