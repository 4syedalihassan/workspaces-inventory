import { useEffect, useState } from 'react';
import { getWorkspaces, getFilterOptions, exportWorkspaces } from '../api';
import {
  Card,
  Input,
  Button,
  Table,
  Select,
  Row,
  Col,
  Space,
  Tag,
  Typography,
  Dropdown,
  message,
  Spin,
} from 'antd';
import {
  SearchOutlined,
  ClearOutlined,
  DownloadOutlined,
  DesktopOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

function WorkSpaces() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ states: [], runningModes: [] });
  const [filters, setFilters] = useState({ user_name: '', state: '', running_mode: '', terminated: '' });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [filters, pagination.current, pagination.pageSize]);

  const loadFilterOptions = async () => {
    try {
      const options = await getFilterOptions();
      setFilterOptions(options);
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const loadWorkspaces = async () => {
    setLoading(true);
    try {
      const offset = (pagination.current - 1) * pagination.pageSize;
      const params = { ...filters, offset, limit: pagination.pageSize };
      Object.keys(params).forEach(key => { if (params[key] === '') delete params[key]; });

      const data = await getWorkspaces(params);
      setWorkspaces(data.data || []);
      setPagination(prev => ({ ...prev, total: data.total || 0 }));
    } catch (error) {
      console.error('Error loading workspaces:', error);
      message.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    loadWorkspaces();
  };

  const handleClear = () => {
    setFilters({ user_name: '', state: '', running_mode: '', terminated: '' });
    setPagination(prev => ({ ...prev, current: 1 }));
    setTimeout(() => loadWorkspaces(), 0);
  };

  const handleExport = async (format) => {
    try {
      await exportWorkspaces(format, filters);
      message.success('Export started successfully');
    } catch (error) {
      console.error('Export failed:', error);
      message.error('Export failed. Please try again.');
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

  const exportMenuItems = [
    {
      key: 'xlsx',
      label: 'Excel',
      onClick: () => handleExport('xlsx'),
    },
    {
      key: 'csv',
      label: 'CSV',
      onClick: () => handleExport('csv'),
    },
  ];

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      render: (text) => <code style={{ fontSize: '12px' }}>{text}</code>,
    },
    {
      title: 'Assigned To',
      dataIndex: 'user_name',
      key: 'user_name',
      render: (text) => text || '-',
    },
    {
      title: 'Display Name',
      dataIndex: 'user_display_name',
      key: 'user_display_name',
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
      title: 'Compute Type',
      dataIndex: 'compute_type',
      key: 'compute_type',
      render: (text) => text || '-',
    },
    {
      title: 'Running Mode',
      dataIndex: 'running_mode',
      key: 'running_mode',
      render: (text) => text || '-',
    },
    {
      title: 'Root Vol',
      dataIndex: 'root_volume_size_gib',
      key: 'root_volume_size_gib',
      render: (val) => val ? `${val} GiB` : '-',
    },
    {
      title: 'User Vol',
      dataIndex: 'user_volume_size_gib',
      key: 'user_volume_size_gib',
      render: (val) => val ? `${val} GiB` : '-',
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: 'Created By',
      dataIndex: 'created_by',
      key: 'created_by',
      render: (text) => text || '-',
    },
    {
      title: 'Last Connection',
      dataIndex: 'last_known_user_connection_timestamp',
      key: 'last_known_user_connection_timestamp',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Space align="center" style={{ marginBottom: 8 }}>
            <DesktopOutlined style={{ fontSize: 28, color: '#ff9900' }} />
            <Title level={2} style={{ margin: 0 }}>WorkSpaces</Title>
          </Space>
          <Text type="secondary">View and manage all AWS WorkSpaces</Text>
        </div>
        <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
          <Button type="primary" icon={<DownloadOutlined />}>
            Export
          </Button>
        </Dropdown>
      </div>

      {/* Filters Card */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} md={6} lg={4}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>User Name</Text>
              <Input
                placeholder="Search by user"
                value={filters.user_name}
                onChange={(e) => handleFilterChange('user_name', e.target.value)}
                allowClear
              />
            </div>
          </Col>
          <Col xs={24} md={6} lg={4}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>State</Text>
              <Select
                style={{ width: '100%' }}
                placeholder="All States"
                value={filters.state || undefined}
                onChange={(val) => handleFilterChange('state', val || '')}
                allowClear
              >
                {filterOptions.states?.map(state => (
                  <Select.Option key={state} value={state}>{state}</Select.Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col xs={24} md={6} lg={4}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>Running Mode</Text>
              <Select
                style={{ width: '100%' }}
                placeholder="All Modes"
                value={filters.running_mode || undefined}
                onChange={(val) => handleFilterChange('running_mode', val || '')}
                allowClear
              >
                {filterOptions.runningModes?.map(mode => (
                  <Select.Option key={mode} value={mode}>{mode}</Select.Option>
                ))}
              </Select>
            </div>
          </Col>
          <Col xs={24} md={6} lg={4}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>Terminated</Text>
              <Select
                style={{ width: '100%' }}
                placeholder="All"
                value={filters.terminated || undefined}
                onChange={(val) => handleFilterChange('terminated', val || '')}
                allowClear
              >
                <Select.Option value="false">Active Only</Select.Option>
                <Select.Option value="true">Terminated Only</Select.Option>
              </Select>
            </div>
          </Col>
          <Col xs={24} md={12} lg={8}>
            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
              >
                Filter
              </Button>
              <Button
                icon={<ClearOutlined />}
                onClick={handleClear}
              >
                Clear
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Table Card */}
      <Card>
        <Table
          columns={columns}
          dataSource={workspaces}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} workspaces`,
            onChange: (page, pageSize) => {
              setPagination(prev => ({ ...prev, current: page, pageSize }));
            },
          }}
          scroll={{ x: 1400 }}
          size="small"
        />
      </Card>
    </div>
  );
}

export default WorkSpaces;
