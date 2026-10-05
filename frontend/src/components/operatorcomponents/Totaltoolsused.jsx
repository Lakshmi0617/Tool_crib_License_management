import React, { useState, useEffect } from 'react';
import {
  Card,
  Statistic,
  Space,
  Typography,
  Modal,
  Table,
  Tag,
  message,
  Row,
  Col
} from 'antd';
import {
  DashboardOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { getAuthHeaders } from '../../config';

const { Text } = Typography;

const TotalToolsUsed = ({ currentUserInfo, tools, onCardClick }) => {
  const [totalUsed, setTotalUsed] = useState(0);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [detailsData, setDetailsData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUserInfo?.employee_id) {
      fetchTotalToolsData();
    }
  }, [currentUserInfo, tools]);

  const getToolDetails = (tool_sl_no) => {
    const tool = tools.find(t => t.id === tool_sl_no);
    return {
      name: tool?.name || 'Unknown Tool',
      range: tool?.range || 'N/A',
      identificationCode: tool?.identificationCode || 'N/A',
      make: tool?.make || 'N/A',
      quantity: tool?.quantity || 0  // Add quantity
    };
  };

  const fetchTotalToolsData = async () => {
    try {
      const authHeaders = getAuthHeaders();
      const [requestsResponse, returnsResponse, issuesResponse] = await Promise.all([
        fetch(`http://localhost:8000/api/tool-requests?operator_id=${currentUserInfo.employee_id}`, { headers: authHeaders }),
        fetch(`http://localhost:8000/api/tool-returns/operator/${currentUserInfo.employee_id}`, { headers: authHeaders }),
        fetch(`http://localhost:8000/api/tool-issues/${currentUserInfo.employee_id}`, { headers: authHeaders })
      ]);

      const [requestsData, returnsData, issuesData] = await Promise.all([
        requestsResponse.json(),
        returnsResponse.json(),
        issuesResponse.json()
      ]);

      // Create a map of returns by request ID for easy lookup
      const returnsMap = returnsData.reduce((acc, ret) => {
        acc[ret.unique_request_id] = ret;
        return acc;
      }, {});

      // Filter and process data
      const totalTools = requestsData.filter(req => req.status === 'approved').length;
      const returnedTools = returnsData.filter(ret => ret.status === 'collected').length;
      const reportedIssues = issuesData.filter(issue => issue.officer_status === 'approved').length;

      // Map requests to include return details
      const mappedRequests = requestsData.map(request => {
        const returnRecord = returnsMap[request.unique_request_id];
        return {
          ...request,
          returned: returnRecord ? 'yes' : request.returned,
          return_supervisor_name: returnRecord?.supervisor_name,
          return_supervisor_id: returnRecord?.supervisor_id,
          collected_date: returnRecord?.collected_date,
          condition: returnRecord?.condition_on_return,
          remarks: returnRecord?.remarks
        };
      });

      setTotalUsed(totalTools);
      setDetailsData(mappedRequests);
    } catch (error) {
      console.error('Error fetching total tools data:', error);
      message.error('Failed to fetch data');
    }
  };

  // Update the columns to show more details
  const columns = [
    {
      title: 'Tool Details',
      key: 'toolDetails',
      width: 250,
      render: (_, record) => {
        const tool = tools.find(t => t.id === record.tool_sl_no);
        return (
          <Space direction="vertical" size={0}>
            <Text strong>{tool?.name || record.tool_name || 'Unknown Tool'}</Text>
            <Text type="secondary">Serial No: {record.tool_sl_no}</Text>
            <Text type="secondary">Range: {tool?.range || record.tool_range || 'N/A'}</Text>
            <Text type="secondary">ID Code: {tool?.identificationCode || record.tool_id_code || 'N/A'}</Text>
            <Text type="secondary">Make: {tool?.make || record.tool_make || 'N/A'}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Purpose',
      dataIndex: 'purpose',
      key: 'purpose',
      width: 200,
      render: (purpose) => (
        <Text>{purpose || 'N/A'}</Text>
      )
    },
    {
      title: 'Project Details',
      dataIndex: 'project_details',
      key: 'project_details',
      width: 200,
      render: (project) => (
        <Text>{project || 'N/A'}</Text>
      )
    },
    {
      title: 'Timeline',
      key: 'timeline',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>Request Date:</Text>
          <Text>{new Date(record.request_date).toLocaleString()}</Text>
          {record.type === 'returned' && (
            <>
              <Text strong style={{ marginTop: 8 }}>Return Date:</Text>
              <Text>{new Date(record.return_date).toLocaleString()}</Text>
            </>
          )}
          {record.type === 'issue' && (
            <>
              <Text strong style={{ marginTop: 8 }}>Report Date:</Text>
              <Text>{new Date(record.report_date).toLocaleString()}</Text>
            </>
          )}
        </Space>
      )
    },
    {
      title: 'Supervisor Details',
      key: 'supervisor_details',
      width: 400,
      render: (_, record) => (
        <Row gutter={16}>
          <Col span={12}>
            <div>
              <Text strong>Approved by:</Text>
              <div>
                <Text>{record.supervisor_name || 'N/A'}</Text>
                <div style={{ color: '#666' }}>
                  ID: {record.supervisor_id || 'N/A'}
                </div>
                <div style={{ color: '#666' }}>
                  Date: {record.response_date ? new Date(record.response_date).toLocaleString() : 'N/A'}
                </div>
              </div>
            </div>
          </Col>
          {record.returned === 'yes' && (
            <Col span={12}>
              <div>
                <Text strong>Collected by:</Text>
                <div>
                  <Text>{record.return_supervisor_name || 'N/A'}</Text>
                  <div style={{ color: '#666' }}>
                    ID: {record.return_supervisor_id || 'N/A'}
                  </div>
                  <div style={{ color: '#666' }}>
                    Date: {record.collected_date ? new Date(record.collected_date).toLocaleString() : 'N/A'}
                  </div>
                </div>
              </div>
            </Col>
          )}
        </Row>
      )
    },
    {
      title: 'Status',
      dataIndex: 'returned',
      key: 'status',
      width: 100,
      render: (returned) => {
        if (returned === 'issue') {
          return <Tag color="red">Issue Reported</Tag>;
        } else if (returned === 'yes') {
          return <Tag color="success">Returned</Tag>;
        } else {
          return <Tag color="processing">In Use</Tag>;
        }
      },
    }
  ];

  const handleCardClick = () => {
    setDetailsVisible(true);
    if (onCardClick) {
      onCardClick('total');
    }
  };

  return (
    <>
      <Card
        hoverable
        onClick={handleCardClick}
        style={{
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)',
          border: '1px solid rgba(30, 136, 229, 0.2)',
          boxShadow: '0 2px 6px rgba(30, 136, 229, 0.1)',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          height: '120px',
        }}
        bodyStyle={{ padding: '16px' }}
      >
        <Statistic
          title={
            <Space align="center" style={{ marginBottom: 8 }}>
              <DashboardOutlined style={{ fontSize: '20px', color: '#1e88e5' }} />
              <Text strong style={{ color: '#1e88e5', fontSize: '14px', fontFamily: 'Segoe UI, Roboto, sans-serif' }}>
                Total Tools Used
              </Text>
            </Space>
          }
          value={totalUsed}
          valueStyle={{ color: '#1e88e5', fontSize: '28px', fontWeight: '600', fontFamily: 'Segoe UI, Roboto, sans-serif' }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <DashboardOutlined style={{ color: '#1e88e5' }} />
            <span>Total Tools Usage Details</span>
          </Space>
        }
        open={detailsVisible}
        onCancel={() => setDetailsVisible(false)}
        width={1000}
        footer={null}
      >
        <Table
          columns={columns}
          dataSource={detailsData}
          loading={loading}
          pagination={false}
          rowClassName={(record) => {
            if (record.type === 'inuse') return 'in-use-row';
            if (record.type === 'returned') return 'returned-row';
            if (record.type === 'return_pending') return 'return-pending-row';
            if (record.type === 'issue') return 'issue-row';
            return '';
          }}
          style={{
            '.in-use-row': {
              backgroundColor: '#e6f7ff'
            },
            '.returned-row': {
              backgroundColor: '#f6ffed'
            },
            '.return-pending-row': {
              backgroundColor: '#fffbe6'
            },
            '.issue-row': {
              backgroundColor: '#fff1f0'
            }
          }}
        />
      </Modal>
    </>
  );
};

export default TotalToolsUsed;
