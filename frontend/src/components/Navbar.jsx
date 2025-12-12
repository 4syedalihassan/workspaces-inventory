import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Layout, Menu, Button, Typography, Space, Dropdown, Avatar, message } from 'antd';
import {
  DashboardOutlined,
  DesktopOutlined,
  BarChartOutlined,
  DollarOutlined,
  HistoryOutlined,
  SettingOutlined,
  SyncOutlined,
  UserOutlined,
  LogoutOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { triggerSync } from '../api';

const { Header } = Layout;
const { Text } = Typography;

function Navbar({ lastSync, setLastSync }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [syncing, setSyncing] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const username = user.username || 'User';
  const isAdmin = user.role === 'ADMIN';

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync('all');
      setLastSync(new Date().toISOString());
      message.success('Sync triggered successfully');
    } catch (error) {
      console.error('Sync failed:', error);
      message.error('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Menu items configuration
  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/workspaces',
      icon: <DesktopOutlined />,
      label: 'WorkSpaces',
    },
    {
      key: '/usage',
      icon: <BarChartOutlined />,
      label: 'Usage',
    },
    {
      key: '/billing',
      icon: <DollarOutlined />,
      label: 'Billing',
    },
  ];

  // Add admin-only menu items
  if (isAdmin) {
    menuItems.push(
      {
        key: '/cloudtrail',
        icon: <HistoryOutlined />,
        label: 'Audit Log',
      },
      {
        key: '/settings',
        icon: <SettingOutlined />,
        label: 'Settings',
      }
    );
  }

  // User dropdown menu
  const userMenuItems = [
    {
      key: 'username',
      label: (
        <div style={{ padding: '4px 0' }}>
          <Text strong>{username}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {user.role || 'User'}
          </Text>
        </div>
      ),
      disabled: true,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
    },
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  return (
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        background: '#232f3e',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      {/* Logo/Brand */}
      <div
        onClick={() => navigate('/dashboard')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginRight: '48px',
          cursor: 'pointer',
        }}
      >
        <DesktopOutlined style={{ fontSize: '24px', color: '#ff9900' }} />
        <Text
          strong
          style={{
            color: '#ff9900',
            fontSize: '18px',
            whiteSpace: 'nowrap',
          }}
        >
          WorkSpaces Inventory
        </Text>
      </div>

      {/* Main Navigation Menu */}
      <Menu
        mode="horizontal"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{
          flex: 1,
          background: '#232f3e',
          borderBottom: 'none',
          color: '#ffffff',
        }}
        theme="dark"
      />

      {/* Right side actions */}
      <Space size="middle" style={{ marginLeft: 'auto' }}>
        {/* Last Sync Info */}
        <Text
          style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '12px',
            whiteSpace: 'nowrap',
          }}
        >
          Last sync: {formatDate(lastSync)}
        </Text>

        {/* Sync Button */}
        <Button
          type="primary"
          ghost
          size="small"
          icon={syncing ? <LoadingOutlined /> : <SyncOutlined />}
          onClick={handleSync}
          disabled={syncing}
          style={{
            borderColor: 'rgba(255, 255, 255, 0.5)',
          }}
        >
          {syncing ? 'Syncing...' : 'Sync Now'}
        </Button>

        {/* User Dropdown */}
        <Dropdown
          menu={{ items: userMenuItems }}
          placement="bottomRight"
          trigger={['click']}
        >
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text style={{ color: '#ffffff' }}>{username}</Text>
            <Avatar
              size="small"
              style={{
                backgroundColor: '#ff9900',
                cursor: 'pointer',
              }}
              icon={<UserOutlined />}
            >
              {username.charAt(0).toUpperCase()}
            </Avatar>
          </div>
        </Dropdown>
      </Space>
    </Header>
  );
}

export default Navbar;
