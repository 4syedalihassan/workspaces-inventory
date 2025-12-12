import { useEffect, useState } from 'react';
import { getCloudTrailEvents, exportCloudTrail } from '../api';
import {
  Card,
  Input,
  Button,
  Table,
  Select,
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
  AuditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

function CloudTrail() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ event_name: '', workspace_id: '', from_date: '', to_date: '' });

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      Object.keys(params).forEach(key => { if (params[key] === '') delete params[key]; });
      const data = await getCloudTrailEvents(params);
      setEvents(data.data || []);
    } catch (error) {
      console.error('Error loading events:', error);
      message.error('Failed to load CloudTrail events');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleClear = () => {
    setFilters({ event_name: '', workspace_id: '', from_date: '', to_date: '' });
    setTimeout(loadEvents, 0);
  };

  const handleExport = async (format) => {
    try {
      await exportCloudTrail(format, filters);
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
  ];

  const columns = [
    {
      title: 'Event Time',
      dataIndex: 'event_time',
      key: 'event_time',
      render: (time) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: 'Event Name',
      dataIndex: 'event_name',
      key: 'event_name',
      render: (text) => text || '-',
    },
    {
      title: 'Workspace ID',
      dataIndex: 'workspace_id',
      key: 'workspace_id',
      render: (text) => text ? <code style={{ fontSize: '12px' }}>{text}</code> : '-',
    },
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      render: (text, record) => record.user_identity?.userName || text || '-',
    },
    {
      title: 'Source IP',
      dataIndex: 'source_ip_address',
      key: 'source_ip_address',
      render: (text) => text || '-',
    },
    {
      title: 'Region',
      dataIndex: 'aws_region',
      key: 'aws_region',
      render: (text) => text || '-',
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Space align="center" style={{ marginBottom: 8 }}>
            <AuditOutlined style={{ fontSize: 28, color: '#ff9900' }} />
            <Title level={2} style={{ margin: 0 }}>CloudTrail</Title>
          </Space>
          <Text type="secondary">View AWS CloudTrail events for WorkSpaces</Text>
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
          <Col xs={24} md={5}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>Event Name</Text>
              <Select
                style={{ width: '100%' }}
                placeholder="All Events"
                value={filters.event_name || undefined}
                onChange={(val) => handleFilterChange('event_name', val || '')}
                allowClear
              >
                <Select.Option value="CreateWorkspaces">CreateWorkspaces</Select.Option>
                <Select.Option value="TerminateWorkspaces">TerminateWorkspaces</Select.Option>
                <Select.Option value="ModifyWorkspaceProperties">ModifyWorkspaceProperties</Select.Option>
                <Select.Option value="RebootWorkspaces">RebootWorkspaces</Select.Option>
                <Select.Option value="RebuildWorkspaces">RebuildWorkspaces</Select.Option>
              </Select>
            </div>
          </Col>
          <Col xs={24} md={5}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>Workspace ID</Text>
              <Input
                placeholder="ws-..."
                value={filters.workspace_id}
                onChange={(e) => handleFilterChange('workspace_id', e.target.value)}
                allowClear
              />
            </div>
          </Col>
          <Col xs={24} md={5}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>From Date</Text>
              <DatePicker
                style={{ width: '100%' }}
                value={filters.from_date ? dayjs(filters.from_date) : null}
                onChange={(date) => handleFilterChange('from_date', date ? date.format('YYYY-MM-DD') : '')}
                placeholder="Select from date"
              />
            </div>
          </Col>
          <Col xs={24} md={5}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>To Date</Text>
              <DatePicker
                style={{ width: '100%' }}
                value={filters.to_date ? dayjs(filters.to_date) : null}
                onChange={(date) => handleFilterChange('to_date', date ? date.format('YYYY-MM-DD') : '')}
                placeholder="Select to date"
              />
            </div>
          </Col>
          <Col xs={24} md={4}>
            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={loadEvents}
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
            dataSource={events}
            rowKey={(record, index) => `${record.event_time}-${index}`}
            pagination={{
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} events`,
            }}
            scroll={{ x: 1000 }}
            size="small"
          />
        )}
      </Card>
    </div>
  );
}

export default CloudTrail;
