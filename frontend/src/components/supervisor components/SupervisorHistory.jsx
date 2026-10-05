import React, { useState, useEffect } from 'react';
import { Table, Space, Tag, Typography, Card, Row, Col, Statistic } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, FileTextOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { EnvironmentOutlined } from '@ant-design/icons';
import { API_BASE_URL, getAuthHeaders } from '../../config';

const { Text } = Typography;

const SupervisorHistory = ({ supervisorId }) => {
  const [loading, setLoading] = useState(false);
  const [requestHistory, setRequestHistory] = useState([]);
  const [issueHistory, setIssueHistory] = useState([]);
  const [returnHistory, setReturnHistory] = useState([]);
  const [stats, setStats] = useState({
    totalRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    totalIssues: 0,
    approvedIssues: 0,
    rejectedIssues: 0,
    totalReturns: 0
  });

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const authHeaders = getAuthHeaders();
        // Fetch all tools first
        const toolsResponse = await fetch(`${API_BASE_URL}/api/tools`, { headers: authHeaders });
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

        // Fetch requests history
        const requestsResponse = await fetch(`${API_BASE_URL}/api/tool-requests/supervisor/${supervisorId}`, { headers: authHeaders });
        const requestsData = await requestsResponse.json();
        const mappedRequests = requestsData.map(request => ({
          ...request,
          tool_name: toolsMap[request.tool_sl_no]?.name,
          range: toolsMap[request.tool_sl_no]?.range,
          identification_code: toolsMap[request.tool_sl_no]?.identificationCode,
          location: toolsMap[request.tool_sl_no]?.location
        }));
        setRequestHistory(mappedRequests);

        // Fetch issues history
        const issuesResponse = await fetch(`${API_BASE_URL}/api/tool-issues/supervisor/${supervisorId}`, { headers: authHeaders });
        const issuesData = await issuesResponse.json();
        const mappedIssues = issuesData.map(issue => ({
          ...issue,
          tool_name: toolsMap[issue.tool_sl_no]?.name,
          range: toolsMap[issue.tool_sl_no]?.range,
          identification_code: toolsMap[issue.tool_sl_no]?.identificationCode,
          location: toolsMap[issue.tool_sl_no]?.location
        }));
        setIssueHistory(mappedIssues);

        // Fetch returns history
        const returnsResponse = await fetch(`${API_BASE_URL}/api/tool-returns/supervisor/${supervisorId}`, { headers: authHeaders });
        const returnsData = await returnsResponse.json();
        const mappedReturns = returnsData.map(return_ => ({
          ...return_,
          tool_name: toolsMap[return_.tool_sl_no]?.name,
          range: toolsMap[return_.tool_sl_no]?.range,
          identification_code: toolsMap[return_.tool_sl_no]?.identificationCode,
          location: toolsMap[return_.tool_sl_no]?.location
        }));
        setReturnHistory(mappedReturns);

        // Calculate statistics
        setStats({
          totalRequests: requestsData.length,
          approvedRequests: requestsData.filter(r => r.status === 'approved').length,
          rejectedRequests: requestsData.filter(r => r.status === 'rejected').length,
          totalIssues: issuesData.length,
          approvedIssues: issuesData.filter(i => i.supervisor_status === 'approved').length,
          rejectedIssues: issuesData.filter(i => i.supervisor_status === 'rejected').length,
          totalReturns: returnsData.length
        });
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setLoading(false);
      }
    };

    if (supervisorId) {
      fetchHistory();
    }
  }, [supervisorId]);

  const requestColumns = [
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
      title: 'Request Date',
      dataIndex: 'request_date',
      width: 150,
      render: date => new Date(date).toLocaleString(),
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
      title: 'Response Date',
      dataIndex: 'response_date',
      width: 150,
      render: date => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: status => {
        const color = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'warning';
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
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
      title: 'Officer Details',
      key: 'officerDetails',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.officer_name || 'N/A'}</Text>
          <Text type="secondary">ID: {record.officer_id || 'N/A'}</Text>
          <Text type="secondary">Response Date: {record.officer_approval_date ? new Date(record.officer_approval_date).toLocaleString() : 'N/A'}</Text>
        </Space>
      ),
    },
    {
      title: 'Response Date',
      dataIndex: 'supervisor_approval_date',
      width: 150,
      render: date => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: 'Status',
      dataIndex: 'supervisor_status',
      width: 120,
      render: status => {
        const color = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'warning';
        return <Tag color={color}>{(status || 'pending').toUpperCase()}</Tag>;
      },
    }
  ];

  const returnColumns = [
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
      title: 'Return Date',
      dataIndex: 'request_date',
      width: 150,
      render: date => new Date(date).toLocaleString(),
    },
    {
      title: 'Condition',
      dataIndex: 'condition_on_return',
      width: 150,
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      width: 200,
    },
    {
      title: 'Collection Date',
      dataIndex: 'collected_date',
      width: 150,
      render: date => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: status => {
        const color = status === 'collected' ? 'success' : 'warning';
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
    }
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Tool Requests"
              value={stats.totalRequests}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
              suffix={
                <div style={{ marginLeft: 16 }}>
                  <Tag color="success" style={{ marginRight: 4 }}>{stats.approvedRequests} Approved</Tag>
                  <Tag color="error">{stats.rejectedRequests} Rejected</Tag>
                </div>
              }
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Tool Issues"
              value={stats.totalIssues}
              prefix={<ExclamationCircleOutlined style={{ color: '#fa8c16' }} />}
              suffix={
                <div style={{ marginLeft: 16 }}>
                  <Tag color="success" style={{ marginRight: 4 }}>{stats.approvedIssues} Approved</Tag>
                  <Tag color="error">{stats.rejectedIssues} Rejected</Tag>
                </div>
              }
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Tool Returns"
              value={stats.totalReturns}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              suffix={
                <div style={{ marginLeft: 16 }}>
                  <Tag color="processing">{stats.totalReturns} Collected</Tag>
                </div>
              }
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
          pagination={{ pageSize: 5 }}
        />
      </Card>

      <Card title="Issue History" style={{ marginBottom: 16 }}>
        <Table
          columns={issueColumns}
          dataSource={issueHistory}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1800 }}
          pagination={{ pageSize: 5 }}
        />
      </Card>

      <Card title="Return History">
        <Table
          columns={returnColumns}
          dataSource={returnHistory}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1500 }}
          pagination={{ pageSize: 5 }}
        />
      </Card>
    </div>
  );
};

export default SupervisorHistory;