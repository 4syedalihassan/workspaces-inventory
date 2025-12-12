import { useEffect, useState } from 'react';
import { getBilling, exportBilling } from '../api';
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
  DollarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

function Billing() {
  const [billing, setBilling] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ user_name: '', start_date: '', end_date: '' });

  useEffect(() => { loadBilling(); }, []);

  const loadBilling = async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      Object.keys(params).forEach(key => { if (params[key] === '') delete params[key]; });
      const data = await getBilling(params);
      setBilling(data.data || []);
    } catch (error) {
      console.error('Error loading billing:', error);
      message.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleClear = () => {
    setFilters({ user_name: '', start_date: '', end_date: '' });
    setTimeout(loadBilling, 0);
  };

  const handleExport = async (format) => {
    try {
      await exportBilling(format, filters);
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
      title: 'Service',
      dataIndex: 'service',
      key: 'service',
      render: (text) => text || '-',
    },
    {
      title: 'Usage Type',
      dataIndex: 'usage_type',
      key: 'usage_type',
      render: (text) => text || '-',
    },
    {
      title: 'Start Date',
      dataIndex: 'start_date',
      key: 'start_date',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: 'End Date',
      dataIndex: 'end_date',
      key: 'end_date',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (val) => `$${val?.toFixed(2) || '0.00'}`,
    },
    {
      title: 'Currency',
      dataIndex: 'currency',
      key: 'currency',
      render: (text) => text || 'USD',
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Space align="center" style={{ marginBottom: 8 }}>
            <DollarOutlined style={{ fontSize: 28, color: '#ff9900' }} />
            <Title level={2} style={{ margin: 0 }}>Billing</Title>
          </Space>
          <Text type="secondary">View WorkSpaces billing and cost information</Text>
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
              <Text type="secondary" style={{ fontSize: '12px' }}>Start Date</Text>
              <DatePicker
                style={{ width: '100%' }}
                value={filters.start_date ? dayjs(filters.start_date) : null}
                onChange={(date) => handleFilterChange('start_date', date ? date.format('YYYY-MM-DD') : '')}
                placeholder="Select start date"
              />
            </div>
          </Col>
          <Col xs={24} md={6}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>End Date</Text>
              <DatePicker
                style={{ width: '100%' }}
                value={filters.end_date ? dayjs(filters.end_date) : null}
                onChange={(date) => handleFilterChange('end_date', date ? date.format('YYYY-MM-DD') : '')}
                placeholder="Select end date"
              />
            </div>
          </Col>
          <Col xs={24} md={6}>
            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={loadBilling}
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
            dataSource={billing}
            rowKey={(record, index) => `${record.workspace_id}-${record.start_date}-${index}`}
            pagination={{
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} records`,
            }}
            scroll={{ x: 1000 }}
            size="small"
          />
        )}
      </Card>
    </div>
  );
}

export default Billing;
