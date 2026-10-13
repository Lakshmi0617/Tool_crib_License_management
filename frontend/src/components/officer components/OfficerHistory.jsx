import React, { useState, useEffect } from 'react';
import { Table, Space, Tag, Typography, Card, Row, Col, Statistic } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { EnvironmentOutlined } from '@ant-design/icons';
import { API_BASE_URL } from '../../config';

const { Text } = Typography;

const OfficerHistory = ({ officerId }) => {
  const [loading, setLoading] = useState(false);
  const [requestHistory, setRequestHistory] = useState([]);
  const [issueHistory, setIssueHistory] = useState([]);
  const [stats, setStats] = useState({
    totalRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    totalIssues: 0,
    approvedIssues: 0,
    rejectedIssues: 0
  });

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        // Fetch all tools first
        const toolsResponse = await fetch(`${API_BASE_URL}/api/tools`);
        const toolsData = await toolsResponse.json();
        const toolsMap = toolsData.reduce((acc, tool) => {
          acc[tool.Sl_no] = {
            name: tool.Item_Description,
            range: tool.Range_in_mm,
            identificationCode: tool.Identification_Code,
            location: tool.Location
          };
          return acc;
        }, {});

        // Fetch new tool requests history
        const requestsResponse = await fetch(`${API_BASE_URL}/new-tool-requests/all-requests`);
        const requestsData = await requestsResponse.json();
        const officerRequests = requestsData.filter(request =>
          request.officer_id === officerId
        );
        const mappedRequests = officerRequests.map(request => ({
          ...request,
          tool_name: request.Item_Description || 'Unknown Tool',
          range: request.Range_in_mm || 'N/A',
          identification_code: request.Identification_Code || 'N/A',
          make: request.Make || 'N/A',
          location: request.Location || 'N/A',
          quantity: request.Quantity || '-'
        }));
        setRequestHistory(mappedRequests);

        // Fetch issues history
        const issuesResponse = await fetch(`${API_BASE_URL}/api/tool-issues/all`);
        const issuesData = await issuesResponse.json();
        const officerIssues = issuesData.filter(issue =>
          issue.officer_id === officerId
        );
        const mappedIssues = officerIssues.map(issue => ({
          ...issue,
          tool_name: toolsMap[issue.tool_sl_no]?.name,
          range: toolsMap[issue.tool_sl_no]?.range,
          identification_code: toolsMap[issue.tool_sl_no]?.identificationCode,
          location: toolsMap[issue.tool_sl_no]?.location
        }));
        setIssueHistory(mappedIssues);

        // Calculate statistics
        setStats({
          totalRequests: officerRequests.length,
          approvedRequests: officerRequests.filter(r => r.status === 'approved').length,
          rejectedRequests: officerRequests.filter(r => r.status === 'rejected').length,
          totalIssues: officerIssues.length,
          approvedIssues: officerIssues.filter(i => i.officer_status === 'approved').length,
          rejectedIssues: officerIssues.filter(i => i.officer_status === 'rejected').length
        });
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setLoading(false);
      }
    };

    if (officerId) {
      fetchHistory();
    }
  }, [officerId]);

  const requestColumns = [
    {
      title: 'Tool Details',
      key: 'toolDetails',
      width: 200,
      render: (_, record) => (
        <div style={{
          background: '#f9f9f9',
          padding: '8px',
          borderRadius: '4px',
        }}>
          <div style={{ fontWeight: 500, marginBottom: '4px' }}>{record.tool_name || 'Unknown Tool'}</div>
          <div style={{ color: '#666', fontSize: '13px' }}>Range: {record.range || 'N/A'}</div>
          <div style={{ color: '#666', fontSize: '13px' }}>ID Code: {record.identification_code || 'N/A'}</div>
          <div style={{ color: '#666', fontSize: '13px' }}>Make: {record.make || 'N/A'}</div>
          <div style={{ color: '#666', fontSize: '13px' }}>
            <EnvironmentOutlined style={{ fontSize: '12px' }} /> Location: {record.location || 'N/A'}
          </div>
        </div>
      ),
    },
    {
      title: 'Quantity',
      dataIndex: 'Quantity',
      width: 100,
      render: (quantity) => (
        <Tag color="blue">{quantity || '-'}</Tag>
      ),
    },
    {
      title: 'Supervisor Details',
      key: 'supervisorDetails',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.supervisor_name || 'N/A'}</Text>
          <Text type="secondary">ID: {record.supervisor_id || 'N/A'}</Text>
        </Space>
      ),
    },
    {
      title: 'Request Date',
      dataIndex: 'request_date',
      width: 150,
      render: date => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: 'Response Date',
      dataIndex: 'response_date',
      width: 150,
      render: date => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: 'Officer Details',
      key: 'officerDetails',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.officer_name || 'N/A'}</Text>
          <Text type="secondary">ID: {record.officer_id || 'N/A'}</Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: status => {
        let color = 'default';
        let text = status || 'Pending';

        switch (text.toLowerCase()) {
          case 'approved':
            color = 'success';
            break;
          case 'rejected':
            color = 'error';
            break;
          case 'pending':
            color = 'warning';
            break;
          default:
            color = 'default';
        }

        return (
          <Tag color={color} style={{ borderRadius: '12px', padding: '0 10px' }}>
            {text.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => {
        if (record.status && record.status.toLowerCase() !== 'pending') {
          return (
            <Tag
              color={record.status.toLowerCase() === 'approved' ? 'success' : 'error'}
              style={{ textTransform: 'capitalize', borderRadius: '12px', padding: '0 10px' }}
            >
              {record.status}
            </Tag>
          );
        }
        return null;
      },
    }
  ];

  const issueColumns = [
    {
      title: 'Tool Details',
      key: 'toolDetails',
      width: 300,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.tool_name || 'Unknown Tool'}</Text>
          <Text type="secondary">Serial No: {record.tool_sl_no}</Text>
          <Text type="secondary">Range: {record.range || 'N/A'}</Text>
          <Text type="secondary">ID Code: {record.identification_code || 'N/A'}</Text>
          <Text type="secondary">
            <EnvironmentOutlined style={{ color: '#1e88e5' }} /> Location: {record.location || 'N/A'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Operator Details',
      key: 'operatorDetails',
      width: 250,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.operator_name || 'N/A'}</Text>
          <Text type="secondary">ID: {record.operator_id || 'N/A'}</Text>
          <Text type="secondary">Department: {record.department || 'N/A'}</Text>
          <Text type="secondary">Contact: {record.contact || 'N/A'}</Text>
        </Space>
      ),
    },
    {
      title: 'Purpose',
      dataIndex: 'purpose',
      width: 200,
    },
    {
      title: 'Project Details',
      dataIndex: 'project_details',
      width: 200,
    },
    {
      title: 'Issue Details',
      key: 'issueDetails',
      width: 250,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>Severity: <Tag color={
            record.severity === 'high' ? 'red' :
              record.severity === 'medium' ? 'orange' :
                'green'
          }>{record.severity?.toUpperCase()}</Tag></Text>
          <Text type="secondary">Category: {record.category || 'N/A'}</Text>
          <Text type="secondary">Description: {record.description || 'N/A'}</Text>
        </Space>
      ),
    },
    {
      title: 'Supervisor Details',
      key: 'supervisorDetails',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.supervisor_name || 'N/A'}</Text>
          <Text type="secondary">ID: {record.supervisor_id || 'N/A'}</Text>
          <Text type="secondary">Response Date: {record.supervisor_approval_date ? new Date(record.supervisor_approval_date).toLocaleString() : 'N/A'}</Text>
        </Space>
      ),
    },
    {
      title: 'Response Date',
      dataIndex: 'officer_approval_date',
      width: 150,
      render: date => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: 'Status',
      dataIndex: 'officer_status',
      width: 120,
      render: status => {
        const color = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'warning';
        return <Tag color={color}>{(status || 'pending').toUpperCase()}</Tag>;
      },
    }
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card style={{ textAlign: 'center' }}>
            <Statistic
              title="New Tool Requests"
              value={stats.totalRequests}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontSize: '28px' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ textAlign: 'center' }}>
            <Statistic
              title="Approved New Tool Requests"
              value={stats.approvedRequests}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: '28px' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ textAlign: 'center' }}>
            <Statistic
              title="Total Issues"
              value={stats.totalIssues}
              prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16', fontSize: '28px' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ textAlign: 'center' }}>
            <Statistic
              title="Approved Issues"
              value={stats.approvedIssues}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: '28px' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Request History" style={{ marginBottom: 16 }}>
        <Table
          columns={requestColumns}
          dataSource={requestHistory}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1500 }}
          size="small"
          pagination={{
            pageSize: 50,
            showTotal: (total) => `Total ${total} requests`,
            showSizeChanger: true,
            pageSizeOptions: ['50', '100', '200', '500'],
          }}
          style={{
            '.ant-table-thead > tr > th': {
              background: '#fafafa',
              padding: '8px',
            },
            '.ant-table-tbody > tr > td': {
              padding: '8px',
            }
          }}
        />
      </Card>

      <Card title="Issue History">
        <Table
          columns={issueColumns}
          dataSource={issueHistory}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1800 }}
          pagination={{ pageSize: 5 }}
        />
      </Card>
    </div>
  );
};

export default OfficerHistory;