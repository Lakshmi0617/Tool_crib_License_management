import React, { useState, useEffect } from 'react';
import {
  Card,
  Statistic,
  Space,
  Typography,
  Modal,
  Table,
  Button,
  message
} from 'antd';
import {
  ClockCircleOutlined
} from '@ant-design/icons';
import { getAuthHeaders } from '../../config';

const { Text } = Typography;

const InUse = ({ currentUserInfo, tools, onToolReturn, onIssueReport }) => {
  const [categoryDetailsVisible, setCategoryDetailsVisible] = useState(false);
  const [categoryTools, setCategoryTools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inUseCount, setInUseCount] = useState(0);

  // Function to fetch and update in-use tools data
  const fetchInUseTools = async () => {
    if (!currentUserInfo?.employee_id || !tools || tools.length === 0) return;

    try {
      setLoading(true);

      const authHeaders = getAuthHeaders();

      const [requestsResponse, returnsResponse, issuesResponse] = await Promise.all([
        fetch(`http://localhost:8000/api/tool-requests?operator_id=${currentUserInfo.employee_id}&status=approved&collected=yes&returned=no`, { headers: authHeaders }),
        fetch(`http://localhost:8000/api/tool-returns/operator/${currentUserInfo.employee_id}`, { headers: authHeaders }),
        fetch(`http://localhost:8000/api/tool-issues/${currentUserInfo.employee_id}`, { headers: authHeaders })
      ]);

      if (!requestsResponse.ok || !returnsResponse.ok || !issuesResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const [requestsData, returnsData, issuesData] = await Promise.all([
        requestsResponse.json(),
        returnsResponse.json(),
        issuesResponse.json()
      ]);

      // Log the raw data for debugging
      console.log('Raw Requests Data:', requestsData);
      console.log('Raw Returns Data:', returnsData);
      console.log('Raw Issues Data:', issuesData);

      // Get IDs of returned tools with their request IDs
      const returnedTools = new Set(
        returnsData
          .filter(ret => ret.status === 'collected')
          .map(ret => ret.request_id)
      );

      // Get tools that have approved issues
      const toolsWithIssues = new Set(
        issuesData
          .filter(issue => issue.officer_status === 'approved')
          .map(issue => issue.unique_request_id)
      );

      // Filter active tools:
      // 1. Tool request is approved and collected
      // 2. Tool has not been returned (not in returnedTools)
      // 3. Tool does not have an approved issue for this specific request
      const activeTools = requestsData.filter(req => {
        // Verify req has unique_request_id
        if (!req.unique_request_id) {
          console.error('Request missing unique_request_id:', req);
          return false;
        }

        // Check if request is approved and collected
        const isCollected = req.status === 'approved' && req.collected === 'yes';
        if (!isCollected) return false;

        // Check if this specific request has been returned
        if (returnedTools.has(req.id)) return false;

        // Check if this specific request has an approved issue
        if (toolsWithIssues.has(req.unique_request_id)) return false;

        return true;
      }).map(req => ({
        ...req,
        toolDetails: tools.find(t => t.id === req.tool_sl_no) || {},
        // Ensure unique_request_id is included in the mapped data
        unique_request_id: req.unique_request_id
      }));

      // Log the processed data
      console.log('Processed Active Tools:', activeTools);

      setInUseCount(activeTools.length);
      setCategoryTools(activeTools);
    } catch (error) {
      console.error('Error fetching in-use tools:', error);
      message.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUserInfo?.employee_id && tools && tools.length > 0) {
      fetchInUseTools();
    }
  }, [currentUserInfo, tools]);

  const handleCardClick = () => {
    setCategoryDetailsVisible(true);
  };

  // Define columns for the details table
  const categoryColumns = [
    {
      title: 'Tool Details',
      key: 'toolDetails',
      width: 250,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.toolDetails?.name || 'Unknown Tool'}</Text>
          <Text type="secondary">Serial No: {record.tool_sl_no}</Text>
          <Text type="secondary">Range: {record.toolDetails?.range || 'N/A'}</Text>
          <Text type="secondary">ID Code: {record.toolDetails?.identificationCode || 'N/A'}</Text>
        </Space>
      ),
    },
    {
      title: 'Collection Date',
      dataIndex: 'request_date',
      key: 'request_date',
      width: 150,
      render: (date) => date ? new Date(date).toLocaleString() : 'N/A',
    },
    {
      title: 'Purpose',
      dataIndex: 'purpose',
      key: 'purpose',
      width: 200,
      render: (purpose) => purpose || 'N/A',
    },
    {
      title: 'Project Details',
      dataIndex: 'project_details',
      key: 'project_details',
      width: 200,
      render: (project_details) => project_details || 'N/A',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            onClick={() => {
              const toolData = {
                tool_sl_no: record.tool_sl_no,
                name: record.toolDetails?.name || 'Unknown Tool',
                purpose: record.purpose,
                project_details: record.project_details,
                unique_request_id: record.unique_request_id  // Add this line
              };
              onToolReturn(toolData);
              // Refresh data after tool return
              fetchInUseTools();
            }}
          >
            Return Tool
          </Button>
          <Button
            type="primary"
            danger
            size="small"
            onClick={() => {
              // Log the full record for debugging
              console.log('Full record data:', record);

              // Create a complete tool data object with all necessary information
              const toolData = {
                ...record,  // Include all record data
                tool_sl_no: record.tool_sl_no,
                name: record.toolDetails?.name || 'Unknown Tool',
                purpose: record.purpose,
                project_details: record.project_details,
                unique_request_id: record.unique_request_id,
                toolDetails: record.toolDetails || {}
              };

              // Log the tool data being passed
              console.log('Reporting issue for tool:', toolData);

              // Verify unique_request_id is present
              if (!toolData.unique_request_id) {
                console.error('Missing unique_request_id in tool data:', toolData);
                message.error('Error: Missing unique request ID for the tool');
                return;
              }

              onIssueReport(toolData);
              // Refresh data after issue report
              fetchInUseTools();
            }}
          >
            Report Issue
          </Button>
        </Space>
      ),
    }
  ];

  const EmptyState = () => (
    <div style={{ textAlign: 'center', padding: '24px' }}>
      <Space direction="vertical" size="large">
        <ClockCircleOutlined style={{ fontSize: '32px', color: '#fa8c16' }} />
        <Text type="secondary" style={{ fontSize: '16px' }}>
          No tools currently in use
        </Text>
      </Space>
    </div>
  );

  return (
    <>
      <Card
        hoverable
        onClick={handleCardClick}
        style={{
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #ffffff 0%, #fff7e6 100%)',
          border: '1px solid rgba(250, 140, 22, 0.2)',
          boxShadow: '0 2px 6px rgba(250, 140, 22, 0.1)',
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
              <ClockCircleOutlined style={{ fontSize: '20px', color: '#fa8c16' }} />
              <Text strong style={{ color: '#fa8c16', fontSize: '14px', fontFamily: 'Segoe UI, Roboto, sans-serif' }}>
                Tools In Use
              </Text>
            </Space>
          }
          value={inUseCount}
          valueStyle={{ color: '#fa8c16', fontSize: '28px', fontWeight: '600', fontFamily: 'Segoe UI, Roboto, sans-serif' }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <ClockCircleOutlined style={{ color: '#fa8c16' }} />
            <span>Tools Currently In Use</span>
          </Space>
        }
        open={categoryDetailsVisible}
        onCancel={() => setCategoryDetailsVisible(false)}
        width={1000}
        footer={null}
      >
        <Table
          columns={categoryColumns}
          dataSource={categoryTools}
          loading={loading}
          pagination={false}
          locale={{
            emptyText: <EmptyState />
          }}
        />
      </Modal>
    </>
  );
};

export default InUse;
