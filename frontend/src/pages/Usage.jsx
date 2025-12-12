import { useEffect, useState } from 'react';
import { getUsage, exportUsage } from '../api';
import {
  Card,
  Input,
  Button,
  Table,
  Row,
  Col,
  Space,
  Typography,
  Dropdown,
  message,
  Spin,
  DatePicker,
} from 'antd';
import {
  SearchOutlined,
  ClearOutlined,
  DownloadOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

function Usage() {
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ user_name: '', month_from: '', month_to: '' });

  useEffect(() => { loadUsage(); }, []);

  const loadUsage = async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      Object.keys(params).forEach(key => { if (params[key] === '') delete params[key]; });
      const data = await getUsage(params);
      setUsage(data.data || []);
    } catch (error) {
      console.error('Error loading usage:', error);
      message.error('Failed to load usage data');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleClear = () => {
    setFilters({ user_name: '', month_from: '', month_to: '' });
    setTimeout(loadUsage, 0);
  };

  const handleExport = async (format) => {
    try {
      await exportUsage(format, filters);
      message.success('Export started successfully');
    } catch (error) {
      console.error('Export failed:', error);
      message.error('Export failed. Please try again.');
    }
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
      title: 'Workspace ID',
      dataIndex: 'workspace_id',
      key: 'workspace_id',
      render: (text) => <code style={{ fontSize: '12px' }}>{text}</code>,
    },
    {
      title: 'User',
      dataIndex: 'user_name',
      key: 'user_name',
      render: (text) => text || '-',
    },
    {
      title: 'Bundle',
      dataIndex: 'bundle_id',
      key: 'bundle_id',
      render: (text) => <Text style={{ fontSize: '12px' }}>{text || '-'}</Text>,
    },
    {
      title: 'Running Mode',
      dataIndex: 'running_mode',
      key: 'running_mode',
      render: (text) => text || '-',
    },
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
    },
    {
      title: 'Usage Hours',
      dataIndex: 'usage_hours',
      key: 'usage_hours',
      render: (val) => (val || 0).toFixed(2),
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Space align="center" style={{ marginBottom: 8 }}>
            <ClockCircleOutlined style={{ fontSize: 28, color: '#ff9900' }} />
            <Title level={2} style={{ margin: 0 }}>Usage</Title>
          </Space>
          <Text type="secondary">View WorkSpaces usage hours by month</Text>
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
          <Col xs={24} md={6}>
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
          <Col xs={24} md={6}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>Month From</Text>
              <DatePicker
                picker="month"
                style={{ width: '100%' }}
                value={filters.month_from ? dayjs(filters.month_from) : null}
                onChange={(date) => handleFilterChange('month_from', date ? date.format('YYYY-MM') : '')}
                placeholder="Select month"
              />
            </div>
          </Col>
          <Col xs={24} md={6}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>Month To</Text>
              <DatePicker
                picker="month"
                style={{ width: '100%' }}
                value={filters.month_to ? dayjs(filters.month_to) : null}
                onChange={(date) => handleFilterChange('month_to', date ? date.format('YYYY-MM') : '')}
                placeholder="Select month"
              />
            </div>
          </Col>
          <Col xs={24} md={6}>
            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={loadUsage}
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
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={usage}
            rowKey={(record, index) => `${record.workspace_id}-${record.month}-${index}`}
            pagination={{
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} records`,
            }}
            scroll={{ x: 800 }}
            size="small"
          />
        )}
      </Card>
    </div>
  );
}

export default Usage;
