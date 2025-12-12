import { useEffect, useState } from 'react';
import { getDashboardStats, getWorkspaces, getSyncHistory } from '../api';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Tag,
  Spin,
  Typography,
  Space,
} from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  LineChartOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

function Dashboard({ setLastSync }) {
  const [stats, setStats] = useState({});
  const [recentWorkspaces, setRecentWorkspaces] = useState([]);
  const [syncHistory, setSyncHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, workspacesData, syncData] = await Promise.all([
        getDashboardStats(),
        getWorkspaces({ limit: 10 }),
        getSyncHistory({ limit: 10 })
      ]);

      setStats(statsData);
      setRecentWorkspaces(workspacesData.data || []);
      setSyncHistory(syncData.data || []);
      if (statsData.last_sync) {
        setLastSync(statsData.last_sync);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStateTagColor = (state) => {
    const stateMap = {
      'AVAILABLE': 'success',
      'PENDING': 'warning',
      'TERMINATED': 'error',
      'STOPPED': 'default'
    };
    return stateMap[state] || 'default';
  };

  const getSyncStatusColor = (status) => {
    if (status === 'completed') return 'success';
    if (status === 'failed') return 'error';
    return 'warning';
  };

  // Recent WorkSpaces table columns
  const workspacesColumns = [
    {
      title: 'User',
      dataIndex: 'user_name',
      key: 'user_name',
      render: (text) => text || '-',
    },
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
      render: (state) => (
        <Tag color={getStateTagColor(state)}>{state || '-'}</Tag>
      ),
    },
    {
      title: 'Running Mode',
      dataIndex: 'running_mode',
      key: 'running_mode',
      render: (text) => text || '-',
    },
  ];

  // Sync History table columns
  const syncColumns = [
    {
      title: 'Type',
      dataIndex: 'sync_type',
      key: 'sync_type',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getSyncStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: 'Records',
      dataIndex: 'records_processed',
      key: 'records_processed',
      render: (val) => val || 0,
    },
    {
      title: 'Time',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (time) => new Date(time).toLocaleString(),
    },
  ];

  if (loading) {
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
          <DashboardOutlined style={{ fontSize: 28, color: '#ff9900' }} />
          <Title level={2} style={{ margin: 0 }}>Dashboard</Title>
        </Space>
        <Text type="secondary">Overview of your AWS WorkSpaces infrastructure</Text>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderLeft: '4px solid #ff9900' }}>
            <Statistic
              title="Total WorkSpaces"
              value={stats.total_workspaces || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#232f3e', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderLeft: '4px solid #ff9900' }}>
            <Statistic
              title="Active WorkSpaces"
              value={stats.active_workspaces || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#232f3e', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderLeft: '4px solid #ff9900' }}>
            <Statistic
              title="Usage Hours (This Month)"
              value={stats.current_month_usage?.total_hours?.toFixed(1) || '0'}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#232f3e', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card bordered={false} style={{ borderLeft: '4px solid #ff9900' }}>
            <Statistic
              title="Avg Hours/WorkSpace"
              value={stats.current_month_usage?.avg_hours?.toFixed(1) || '0'}
              prefix={<LineChartOutlined />}
              valueStyle={{ color: '#232f3e', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tables Row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Recent WorkSpaces" bordered={false}>
            <Table
              columns={workspacesColumns}
              dataSource={recentWorkspaces}
              pagination={false}
              size="small"
              rowKey={(record, index) => index}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Sync History" bordered={false}>
            <Table
              columns={syncColumns}
              dataSource={syncHistory}
              pagination={false}
              size="small"
              rowKey={(record, index) => index}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
