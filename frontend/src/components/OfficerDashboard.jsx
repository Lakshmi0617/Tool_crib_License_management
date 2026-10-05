import React, { useState, useEffect, useMemo } from 'react';
import {
  Layout,
  Table,
  Input,
  Select,
  Button,
  Modal,
  Form,
  Space,
  Badge,
  Typography,
  Avatar,
  Tabs,
  Card,
  Statistic,
  Row,
  Col,
  Descriptions,
  Divider,
  Tag,
  message,
  InputNumber,
  Slider,
  Menu
} from 'antd';
import {
  SearchOutlined,
  KeyOutlined,
  LogoutOutlined,
  ToolOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  EnvironmentOutlined,
  HistoryOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  DashboardOutlined,
  CheckOutlined,
  CloseOutlined,
  BellOutlined,
  AlertOutlined,
  FilterOutlined,
  ReloadOutlined,
  UserAddOutlined,
  HomeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import cmtisLogo from '../assets/cmtis.png';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Dashboard.css';
import { getAuthHeaders } from '../config';
import PendingRequestsDrawer from './officer components/PendingRequestsDrawer';
import AddUserDrawer from './officer components/AddUserDrawer';
import ItemIssuesHistory from './officer components/itemissueshistory';
import OfficerHistory from './officer components/OfficerHistory';

const { Header, Content, Sider } = Layout;
const { Option } = Select;
const { Title, Text } = Typography;

const OfficerDashboard = ({ userInfo, onLogout, onOpenLicenseModal }) => {
  const navigate = useNavigate();
  const [tools, setTools] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [userDetailsVisible, setUserDetailsVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentUserInfo, setCurrentUserInfo] = useState(userInfo);
  const [issuesModalVisible, setIssuesModalVisible] = useState(false);
  const [pendingIssues, setPendingIssues] = useState([]);
  const [supervisorApprovedIssues, setSupervisorApprovedIssues] = useState([]);
  const [newSupervisorApprovedIssues, setNewSupervisorApprovedIssues] = useState([]);
  const [pendingIssuesModalVisible, setPendingIssuesModalVisible] = useState(false);
  const [supervisorApprovedIssuesModalVisible, setSupervisorApprovedIssuesModalVisible] = useState(false);
  const [selectedItemDescription, setSelectedItemDescription] = useState(null);
  const [virtualScrollEnabled, setVirtualScrollEnabled] = useState(true);
  const [itemIssues, setItemIssues] = useState([]);
  const [pendingToolRequestsVisible, setPendingToolRequestsVisible] = useState(false);
  const [addUserDrawerVisible, setAddUserDrawerVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState('dashboard');
  const [toolStats, setToolStats] = useState({
    total: 0,
    available: 0,
    inUse: 0,
    maintenance: 0
  });
  const [issuesHistoryVisible, setIssuesHistoryVisible] = useState(false);
  const [officerHistoryVisible, setOfficerHistoryVisible] = useState(false);
  const [editingKey, setEditingKey] = useState('');
  const [form] = Form.useForm();

  // Add state for pending tool requests
  const [pendingToolRequests, setPendingToolRequests] = useState([]);

  const isEditing = (record) => record.id === editingKey;

  const handleEdit = (record) => {
    form.setFieldsValue({
      name: record.name,
      range: record.range,
      identificationCode: record.identificationCode,
      make: record.make,
      quantity: record.quantity,
      location: record.location,
    });
    setEditingKey(record.id);
  };

  const handleCancel = () => {
    setEditingKey('');
  };

  const handleSave = async (record) => {
    try {
      const row = await form.validateFields();
      const response = await fetch(`http://localhost:8000/api/tools/${record.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Item_Description: row.name,
          Range_in_mm: row.range,
          Identification_Code: row.identificationCode,
          Make: row.make,
          Quantity: row.quantity,
          Location: row.location,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update tool');
      }

      message.success('Tool updated successfully');
      setEditingKey('');
      fetchTools();
    } catch (error) {
      console.error('Error updating tool:', error);
      message.error('Failed to update tool');
    }
  };

  const EditableCell = ({
    editing,
    dataIndex,
    title,
    inputType,
    record,
    index,
    children,
    ...restProps
  }) => {
    const inputNode = inputType === 'number' ?
      <InputNumber min={0} /> :
      <Input />;

    return editing ? (
      <td {...restProps}>
        <Form.Item
          name={dataIndex}
          style={{ margin: 0 }}
          rules={[
            {
              required: title === 'Item Description' || title === 'Quantity',
              message: `Please input ${title}!`,
            },
          ]}
        >
          {inputNode}
        </Form.Item>
      </td>
    ) : (
      <td {...restProps}>{children}</td>
    );
  };

  // Calculate dynamic categories based on Item Description frequency
  const dynamicCategories = useMemo(() => {
    const itemDescriptionCount = {};
    tools.forEach(tool => {
      if (tool.name) {
        itemDescriptionCount[tool.name] = (itemDescriptionCount[tool.name] || 0) + 1;
      }
    });

    return Object.entries(itemDescriptionCount)
      .filter(([_, count]) => count >= 6)
      .map(([name]) => ({
        value: name,
        label: `${name} (${itemDescriptionCount[name]})`
      }));
  }, [tools]);

  // Get min and max Sl.No for range slider
  const slNoLimits = useMemo(() => {
    if (tools.length === 0) return { min: 0, max: 100 };
    return {
      min: Math.min(...tools.map(t => t.id)),
      max: Math.max(...tools.map(t => t.id))
    };
  }, [tools]);

  const fetchTools = async () => {
    try {
      setLoading(true);
      const authHeaders = getAuthHeaders({
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });
      const [toolsResponse, requestsResponse, returnsResponse, issuesResponse] = await Promise.all([
        fetch('http://localhost:8000/api/tools', { headers: authHeaders }),
        fetch('http://localhost:8000/api/tool-requests/all', { headers: authHeaders }),
        fetch('http://localhost:8000/api/tool-returns/all', { headers: authHeaders }),
        fetch('http://localhost:8000/api/tool-issues/all', { headers: authHeaders })
      ]);

      // Check if any response failed
      const failedResponses = [
        { name: 'tools', response: toolsResponse },
        { name: 'requests', response: requestsResponse },
        { name: 'returns', response: returnsResponse },
        { name: 'issues', response: issuesResponse }
      ].filter(item => !item.response.ok);

      if (failedResponses.length > 0) {
        const errors = failedResponses.map(item => `${item.name}: ${item.response.status}`).join(', ');
        throw new Error(`Failed to fetch data: ${errors}`);
      }

      const [toolsData, requestsData, returnsData, issuesData] = await Promise.all([
        toolsResponse.json(),
        requestsResponse.json(),
        returnsResponse.json(),
        issuesResponse.json()
      ]);

      // Get active tool requests (approved and collected but not returned)
      const activeRequests = requestsData.filter(req =>
        req.status === 'approved' &&
        req.collected === 'yes' &&
        req.returned !== 'yes'
      );

      // Create sets of returned tools and tools with issues
      const returnedTools = new Set(
        returnsData
          .filter(ret => ret.status === 'collected')
          .map(ret => `${ret.tool_sl_no}-${ret.operator_id}`)
      );

      const toolsWithIssues = new Set(
        issuesData
          .filter(issue => issue.supervisor_status === 'approved')
          .map(issue => `${issue.tool_sl_no}-${issue.operator_id}`)
      );

      // Group active requests by tool_sl_no
      const requestsByTool = activeRequests.reduce((acc, request) => {
        if (!acc[request.tool_sl_no]) {
          acc[request.tool_sl_no] = [];
        }
        acc[request.tool_sl_no].push({
          name: request.operator_name,
          id: request.operator_id,
          department: request.department,
          contact: request.contact,
          requestDate: request.request_date,
          purpose: request.purpose,
          projectDetails: request.project_details
        });
        return acc;
      }, {});

      // Count tools in use by each request, excluding returned and reported tools
      const toolsInUseCount = activeRequests.reduce((acc, request) => {
        const toolId = request.tool_sl_no;
        const requestKey = `${toolId}-${request.operator_id}`;

        // Skip if tool has been returned or has approved issues
        if (returnedTools.has(requestKey) || toolsWithIssues.has(requestKey)) {
          return acc;
        }

        if (!acc[toolId]) {
          acc[toolId] = 0;
        }
        acc[toolId] += request.quantity || 1;
        return acc;
      }, {});

      // Map backend data to frontend structure
      const mappedTools = toolsData.map(tool => {
        const activeUsers = requestsByTool[tool.Sl_no] || [];
        const inUseCount = toolsInUseCount[tool.Sl_no] || 0;
        const totalQuantity = parseInt(tool.Quantity) || 0;

        // Determine status based on quantity and usage
        let status;
        if (totalQuantity === 0) {
          status = 'maintenance';
        } else if (inUseCount > 0) {
          status = 'in_use';
        } else {
          status = 'available';
        }

        return {
          id: tool.Sl_no,
          name: tool.Item_Description || '',
          status: status,
          range: tool.Range_in_mm || '',
          identificationCode: tool.Identification_Code || '',
          make: tool.Make || '',
          quantity: totalQuantity,
          location: tool.Location || '',
          remarks: tool.Remarks || '',
          gauge: tool.Gauge || '',
          currentUsers: activeUsers,
          activeUsersCount: activeUsers.length
        };
      });

      // Calculate overall statistics
      const stats = mappedTools.reduce((acc, tool) => {
        // Total is sum of all quantities
        acc.total += tool.quantity;

        if (tool.status === 'maintenance') {
          acc.maintenance += 1;
        } else if (tool.status === 'in_use') {
          acc.inUse += toolsInUseCount[tool.id] || 0;
          acc.available += (tool.quantity - (toolsInUseCount[tool.id] || 0));
        } else {
          acc.available += tool.quantity;
        }

        return acc;
      }, { total: 0, available: 0, inUse: 0, maintenance: 0 });

      setTools(mappedTools);
      setToolStats(stats);

    } catch (error) {
      console.error('Error fetching tools:', error);
      message.error(`Failed to fetch tools data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Update the fetchIssues function to handle real-time updates better
  const fetchIssues = async () => {
    try {
      // setLoading(true);

      const authHeaders = getAuthHeaders({
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });
      const [issuesResponse, toolsResponse] = await Promise.all([
        fetch('http://localhost:8000/api/tool-issues/all', { headers: authHeaders }),
        fetch('http://localhost:8000/api/tools', { headers: authHeaders })
      ]);

      if (!issuesResponse.ok || !toolsResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const [issues, tools] = await Promise.all([
        issuesResponse.json(),
        toolsResponse.json()
      ]);

      const toolsMap = tools.reduce((acc, tool) => {
        acc[tool.Sl_no] = tool;
        return acc;
      }, {});

      const issuesWithTools = issues.map(issue => ({
        ...issue,
        tool_details: toolsMap[issue.tool_sl_no] || {}
      }));

      // Filter pending issues (no officer action yet)
      const pendingIssues = issuesWithTools.filter(issue =>
        issue.officer_status === 'pending' || !issue.officer_status
      );

      // Filter supervisor approved issues (has officer action)
      const supervisorApprovedIssues = issuesWithTools.filter(issue =>
        issue.officer_status === 'approved' || issue.officer_status === 'rejected'
      );

      // Sort issues by report date in descending order
      const sortedPendingIssues = pendingIssues.sort((a, b) =>
        new Date(b.report_date) - new Date(a.report_date)
      );

      const sortedSupervisorApprovedIssues = supervisorApprovedIssues.sort((a, b) =>
        new Date(b.report_date) - new Date(a.report_date)
      );

      setPendingIssues(sortedPendingIssues);
      setSupervisorApprovedIssues(sortedSupervisorApprovedIssues);
      setItemIssues(sortedPendingIssues);

    } catch (error) {
      console.error('Error fetching issues:', error);
      message.error('Failed to fetch issues');
    } finally {
      // setLoading(false);
    }
  };

  // Add function to fetch pending tool requests
  const fetchPendingToolRequests = async () => {
    try {
      const response = await fetch('http://localhost:8000/new-tool-requests/all-requests', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch requests');
      const data = await response.json();
      setPendingToolRequests(data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  // Add initialization useEffect
  useEffect(() => {
    // Check for authentication and user info
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      navigate('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser.role !== 'officer') {
        navigate('/login');
        return;
      }
      setCurrentUserInfo(parsedUser);

      // Initial data fetch
      const fetchInitialData = async () => {
        try {
          await Promise.all([
            fetchTools(),
            fetchIssues(),
            fetchPendingToolRequests()
          ]);
        } catch (error) {
          console.error('Error fetching initial data:', error);
        }
      };

      fetchInitialData();

      // Set up polling only when the window is visible
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          fetchInitialData();
        }
      };

      // Add visibility change listener
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Cleanup
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } catch (error) {
      console.error('Error parsing user info:', error);
      return;
    }
  }, []);

  // Add separate polling for issues
  useEffect(() => {
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchIssues();
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, []);

  // Update itemIssues when pendingIssues changes
  // useEffect(() => {
  //   setItemIssues(pendingIssues);
  // }, [pendingIssues]);

  // Update the handleIssueApproval function
  const handleIssueApproval = async (issueId, action) => {
    try {
      console.log('Sending approval request:', {
        action,
        officer_id: currentUserInfo?.employee_id,
        officer_name: currentUserInfo?.employee_name
      });

      const response = await fetch(`http://localhost:8000/api/tool-issues/${issueId}/officer-action`, {
        method: 'PUT',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          action: action,
          officer_id: currentUserInfo?.employee_id,
          officer_name: currentUserInfo?.employee_name,
          supervisor_id: null,
          supervisor_name: null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.detail || 'Failed to update issue status');
      }

      const updatedIssue = await response.json();
      console.log('Success response:', updatedIssue);

      message.success(`Issue ${action === 'approve' ? 'approved' : 'rejected'} successfully`);

      // Update the local state
      setPendingIssues(prev => prev.filter(issue => issue.id !== issueId));
      setSupervisorApprovedIssues(prev => [...prev, updatedIssue].sort((a, b) =>
        new Date(b.report_date) - new Date(a.report_date)
      ));

      // Fetch updated data to ensure consistency
      fetchIssues();

    } catch (error) {
      console.error('Error updating issue status:', error);
      message.error(error.message || 'Failed to update issue status');
    }
  };

  const showUserDetails = (user) => {
    setSelectedUser(user);
    setUserDetailsVisible(true);
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      available: { status: 'success', text: 'Available', icon: <CheckCircleOutlined /> },
      in_use: { status: 'warning', text: 'In Use', icon: <ClockCircleOutlined /> },
      'Not Available': { status: 'error', text: 'Not Available', icon: <ExclamationCircleOutlined /> }
    };
    const config = statusConfig[status] || { status: 'default', text: status || 'Unknown', icon: <ExclamationCircleOutlined /> };
    return (
      <Space>
        {config.icon}
        <Badge status={config.status} text={config.text} />
      </Space>
    );
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this tool?',
      icon: <ExclamationCircleOutlined />,
      content: `This will permanently delete the tool "${record.name}"`,
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          const response = await fetch(`http://localhost:8000/api/tools/${record.id}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            throw new Error('Failed to delete tool');
          }

          message.success('Tool deleted successfully');
          fetchTools(); // Refresh the tools list
        } catch (error) {
          console.error('Error deleting tool:', error);
          message.error('Failed to delete tool');
        }
      },
    });
  };

  const toolColumns = [
    {
      title: 'Sl.No',
      dataIndex: 'id',
      key: 'id',
      width: 60,
      sorter: (a, b) => a.id - b.id,
      render: (text) => (
        <span style={{ color: '#1e88e5', fontWeight: 500 }}>{text}</span>
      )
    },
    {
      title: 'Item Description',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      editable: true,
      render: (text, record) => {
        const editable = isEditing(record);
        return editable ? (
          <Form.Item
            name="name"
            style={{ margin: 0 }}
            rules={[{ required: true, message: 'Item Description is required!' }]}
          >
            <Input />
          </Form.Item>
        ) : (
          <Button
            type="link"
            onClick={() => setSelectedItemDescription(text)}
            style={{
              padding: 0,
              height: 'auto',
              lineHeight: 'inherit',
              color: '#1e88e5',
              fontWeight: 500,
              '&:hover': {
                color: '#1565c0',
                textDecoration: 'underline'
              }
            }}
          >
            {text}
          </Button>
        );
      }
    },
    {
      title: 'Range in mm',
      dataIndex: 'range',
      key: 'range',
      width: 100,
      editable: true,
    },
    {
      title: 'Identification Code',
      dataIndex: 'identificationCode',
      key: 'identificationCode',
      width: 130,
      editable: true,
    },
    {
      title: 'Make',
      dataIndex: 'make',
      key: 'make',
      width: 100,
      editable: true,
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 70,
      editable: true,
      render: (text, record) => {
        const editable = isEditing(record);
        return editable ? (
          <Form.Item
            name="quantity"
            style={{ margin: 0 }}
            rules={[{ required: true, message: 'Quantity is required!' }]}
          >
            <InputNumber min={0} />
          </Form.Item>
        ) : (
          <span style={{
            color: text > 0 ? '#2e7d32' : '#c62828',
            fontWeight: 500
          }}>
            {text}
          </span>
        );
      }
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 120,
      editable: true,
      render: (text, record) => {
        const editable = isEditing(record);
        return editable ? (
          <Form.Item
            name="location"
            style={{ margin: 0 }}
          >
            <Input />
          </Form.Item>
        ) : (
          <Space>
            <EnvironmentOutlined style={{ color: '#1e88e5' }} />
            {text}
          </Space>
        );
      }
    },
    {
      title: 'Current Users',
      key: 'currentUsers',
      width: 250,
      render: (_, record) => {
        if (record.status === 'in_use' && record.currentUsers?.length > 0) {
          return (
            <Space direction="vertical" size={4}>
              {record.currentUsers.map((user, index) => (
                <div key={index}>
                  {user.name} | ID: {user.id} | {user.department}
                </div>
              ))}
            </Space>
          );
        }
        return <span style={{ color: '#757575' }}>-</span>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: status => getStatusBadge(status),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => {
        const editable = isEditing(record);
        return editable ? (
          <Space>
            <Button
              type="primary"
              onClick={() => handleSave(record)}
              size="small"
              icon={<CheckOutlined />}
            />
            <Button
              onClick={handleCancel}
              size="small"
              icon={<CloseOutlined />}
            />
          </Space>
        ) : (
          <Space>
            <Button
              type="primary"
              disabled={editingKey !== ''}
              onClick={() => handleEdit(record)}
              size="small"
              icon={<EditOutlined />}
            />
            <Button
              type="primary"
              danger
              disabled={editingKey !== ''}
              onClick={() => handleDelete(record)}
              size="small"
              icon={<DeleteOutlined />}
            />
          </Space>
        );
      },
    }
  ];

  const mergedColumns = toolColumns.map(col => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: (record) => ({
        record,
        dataIndex: col.dataIndex,
        title: col.title,
        editing: isEditing(record),
      }),
    };
  });

  const issueColumns = [
    {
      title: 'Tool Details',
      key: 'tool_details',
      width: 200,
      render: (_, record) => {
        const tool = record.tool_details || {};
        return (
          <Space direction="vertical" size={0}>
            <Text strong>{tool.Item_Description}</Text>
            <Text type="secondary">Serial No: {record.tool_sl_no}</Text>
            <Text type="secondary">Range: {tool.Range_in_mm}</Text>
            <Text type="secondary">ID Code: {tool.Identification_Code || 'N/A'}</Text>
            <Text type="secondary">
              <EnvironmentOutlined style={{ color: '#1e88e5' }} /> Location: {tool.Location || 'N/A'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Operator Details',
      key: 'operator',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.operator_name}</Text>
          <Text type="secondary">ID: {record.operator_id}</Text>
          <Text type="secondary">Department: {record.department || 'N/A'}</Text>
          <Text type="secondary">Contact: {record.contact || 'N/A'}</Text>
        </Space>
      ),
    },
    {
      title: 'Purpose',
      dataIndex: 'purpose',
      key: 'purpose',
      width: 150,
    },
    {
      title: 'Project Details',
      dataIndex: 'project_details',
      key: 'project_details',
      width: 150,
    },
    {
      title: 'Issue Severity',
      key: 'severity',
      width: 120,
      render: (_, record) => (
        <Tag color={
          record.severity === 'high' ? 'red' :
            record.severity === 'medium' ? 'orange' :
              'green'
        }>
          {record.severity.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Issue Category',
      dataIndex: 'category',
      key: 'category',
      width: 150,
    },
    {
      title: 'Issue Description',
      dataIndex: 'description',
      key: 'description',
      width: 150,
    },
    {
      title: 'Report Date',
      dataIndex: 'report_date',
      key: 'report_date',
      width: 150,
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, record) => {
        let color = 'default';
        let text = record.officer_status || 'Pending';

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
          <Tag color={color}>
            {text.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => {
        // Only show actions if status is pending
        if (!record.officer_status || record.officer_status.toLowerCase() === 'pending') {
          return (
            <Space>
              <Button
                type="primary"
                onClick={() => handleIssueApproval(record.id, 'approve')}
              >
                Accept
              </Button>
              <Button
                danger
                onClick={() => handleIssueApproval(record.id, 'reject')}
              >
                Reject
              </Button>
            </Space>
          );
        }
        return null;
      },
    },
  ];

  const supervisorApprovedIssueColumns = [
    {
      title: 'Tool Details',
      key: 'tool_details',
      width: 200,
      render: (_, record) => {
        const tool = record.tool_details || {};
        return (
          <Space direction="vertical" size={0}>
            <Text strong>{tool.Item_Description}</Text>
            <Text type="secondary">Serial No: {record.tool_sl_no}</Text>
            <Text type="secondary">Range: {tool.Range_in_mm}</Text>
            <Text type="secondary">ID Code: {tool.Identification_Code || 'N/A'}</Text>
            <Text type="secondary">
              <EnvironmentOutlined style={{ color: '#1e88e5' }} /> Location: {tool.Location || 'N/A'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Operator Details',
      key: 'operator',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.operator_name}</Text>
          <Text type="secondary">ID: {record.operator_id}</Text>
          <Text type="secondary">Department: {record.department || 'N/A'}</Text>
          <Text type="secondary">Contact: {record.contact || 'N/A'}</Text>
        </Space>
      ),
    },
    {
      title: 'Purpose',
      dataIndex: 'purpose',
      key: 'purpose',
      width: 150,
    },
    {
      title: 'Project Details',
      dataIndex: 'project_details',
      key: 'project_details',
      width: 150,
    },
    {
      title: 'Issue Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      render: (severity) => (
        <Tag color={
          severity === 'high' ? 'red' :
            severity === 'medium' ? 'orange' :
              'green'
        }>
          {severity.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Issue Category',
      dataIndex: 'category',
      key: 'category',
      width: 150,
    },
    {
      title: 'Issue Description',
      dataIndex: 'description',
      key: 'description',
      width: 150,
    },
    {
      title: 'Report Date',
      dataIndex: 'report_date',
      key: 'report_date',
      width: 150,
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: 'Supervisor Details',
      key: 'supervisor',
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={2} style={{ padding: '8px 0' }}>
          <Text strong style={{ fontSize: '14px' }}>{record.supervisor_name}</Text>
          <Text type="secondary">Employee ID: {record.supervisor_id}</Text>
        </Space>
      ),
    },
    {
      title: 'Supervisor Accepted Date',
      dataIndex: 'supervisor_approval_date',
      key: 'supervisor_approval_date',
      width: 150,
      render: (date) => date ? new Date(date).toLocaleString() : 'N/A',
    },
  ];

  // Update filteredTools to remove range filter
  const filteredTools = useMemo(() => {
    return tools.filter(tool => {
      const matchesSearch = !searchQuery ||
        (tool.name && tool.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tool.range && tool.range.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tool.identificationCode && tool.identificationCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tool.make && tool.make.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = selectedCategory === 'all' ||
        (selectedCategory === tool.name);

      const matchesStatus = activeTab === 'all' || tool.status === activeTab;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [tools, searchQuery, selectedCategory, activeTab]);

  const tabItems = [
    {
      key: 'all',
      label: 'All Tools',
    },
    {
      key: 'available',
      label: 'Available',
    },
    {
      key: 'in_use',
      label: 'In Use',
    },
    {
      key: 'maintenance',
      label: 'Maintenance',
    }
  ];

  const menuItems = [
    {
      key: 'item_issues',
      label: (
        <Badge count={pendingIssues.length} offset={[10, 0]}>
          Item Issues
        </Badge>
      ),
      onClick: () => {
        setSelectedMenu('item_issues');
        setPendingIssuesModalVisible(true);
      }
    },
    {
      key: 'supervisor_approved',
      label: (
        <Badge count={newSupervisorApprovedIssues.length} offset={[10, 0]}>
          Supervisor Approved Issues
        </Badge>
      ),
      onClick: () => {
        setSelectedMenu('supervisor_approved');
        setSupervisorApprovedIssuesModalVisible(true);
      }
    }
  ];

  const headerMenu = <Menu items={menuItems} />;

  const PendingIssuesModal = () => (
    <Modal
      title={
        <Space>
          <AlertOutlined style={{ color: '#faad14' }} />
          <span>Item Issues</span>
        </Space>
      }
      open={pendingIssuesModalVisible}
      onCancel={() => {
        setPendingIssuesModalVisible(false);
      }}
      width={1200}
      footer={null}
      destroyOnClose={true}
      maskClosable={false}
    >
      <Table
        dataSource={pendingIssues}
        columns={issueColumns}
        rowKey="id"
        scroll={{ x: 1600 }}
        pagination={{
          pageSize: 5,
          showTotal: (total) => `Total ${total} issues`
        }}
      />
    </Modal>
  );

  const SupervisorApprovedIssuesModal = () => (
    <Modal
      title={
        <Space>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          <span>Supervisor Approved Issues</span>
        </Space>
      }
      open={supervisorApprovedIssuesModalVisible}
      onCancel={() => {
        setSupervisorApprovedIssuesModalVisible(false);
      }}
      width={1200}
      footer={null}
    >
      <Table
        dataSource={supervisorApprovedIssues}
        columns={supervisorApprovedIssueColumns}
        rowKey="id"
        scroll={{ x: 1600 }}
        pagination={{
          pageSize: 5,
          showTotal: (total) => `Total ${total} issues`
        }}
      />
    </Modal>
  );

  const handleManualRefresh = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchTools(),
        fetchIssues(),
        // Fetch pending issues
        (async () => {
          const response = await fetch('http://localhost:8000/api/tool-issues/pending', { headers: getAuthHeaders() });
          if (!response.ok) throw new Error('Failed to fetch pending issues');
          const data = await response.json();
          setPendingIssues(data);
        })(),
        // Fetch supervisor approved issues
        (async () => {
          const response = await fetch('http://localhost:8000/api/tool-issues/supervisor-approved', { headers: getAuthHeaders() });
          if (!response.ok) throw new Error('Failed to fetch supervisor approved issues');
          const data = await response.json();
          setSupervisorApprovedIssues(data);
        })(),
        // Fetch pending tool requests
        (async () => {
          const response = await fetch('http://localhost:8000/new-tool-requests/pending', { headers: getAuthHeaders() });
          if (!response.ok) throw new Error('Failed to fetch pending requests');
          const data = await response.json();
          setPendingToolRequests(data);
        })()
      ]);
      message.success('All data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
      message.error('Failed to refresh some data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        await fetch(`http://localhost:8000/logout?employee_id=${user.employee_id}`, {
          method: 'POST',
          headers: getAuthHeaders({
            'Content-Type': 'application/json',
          })
        });
      }

      // Clear local storage and call onLogout
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      onLogout();
      navigate('/login');
    } catch (error) {
      console.error('Error during logout:', error);
      // Still clear local storage and logout even if server request fails
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      onLogout();
      navigate('/login');
    }
  };

  const HeaderActions = () => (
    <Space size="middle">
      <Button
        type="primary"
        icon={<UserAddOutlined />}
        onClick={() => setAddUserDrawerVisible(true)}
        style={{
          background: '#52c41a',
          borderColor: '#52c41a'
        }}
      >
        Add User
      </Button>
      {onOpenLicenseModal && (
        <Button
          type="primary"
          icon={<KeyOutlined />}
          onClick={onOpenLicenseModal}
          style={{
            background: '#722ed1',
            borderColor: '#722ed1'
          }}
        >
          License Key
        </Button>
      )}
      <Space>
        <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
        <Text strong style={{ color: '#262626' }}>{currentUserInfo?.employee_name || 'Officer'}</Text>
      </Space>
      <Button type="primary" danger icon={<LogoutOutlined />} onClick={handleLogout}>
        Logout
      </Button>
    </Space>
  );

  const ItemIssuesModal = () => (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Space align="center" style={{ marginBottom: '16px' }}>
              <ToolOutlined style={{ color: '#1890ff' }} />
              <Text strong>Item Issues</Text>
            </Space>
          </div>
        </Space>
      </div>

      <Table
        dataSource={itemIssues}
        columns={issueColumns}
        rowKey="id"
        loading={loading}
        size="small"
        scroll={{ x: 900, y: 'calc(100vh - 280px)' }}
        pagination={{
          pageSize: 50,
          showTotal: (total) => `Total ${total} issues`,
          showSizeChanger: true,
          pageSizeOptions: ['50', '100', '200', '500'],
        }}
        className="item-issues-table"
      />
    </div>
  );

  const sidebarItems = [
    {
      key: 'dashboard',
      icon: <HomeOutlined style={{ color: '#ffffff', fontSize: '18px' }} />,
      label: <span style={{ color: '#ffffff', fontWeight: selectedMenu === 'dashboard' ? '600' : '400' }}>Dashboard</span>,
      style: {
        margin: '4px 12px',
        borderRadius: '8px',
        backgroundColor: selectedMenu === 'dashboard' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        transition: 'all 0.3s ease',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          transform: 'translateX(5px)'
        },
      },
      onClick: () => setSelectedMenu('dashboard')
    },
    {
      key: 'item_issues',
      icon: <AlertOutlined style={{ color: '#ffffff', fontSize: '18px' }} />,
      label: (
        <Badge count={pendingIssues.length} size="small">
          <span style={{ color: '#ffffff', fontWeight: selectedMenu === 'item_issues' ? '600' : '400' }}>Item Issues</span>
        </Badge>
      ),
      style: {
        margin: '4px 12px',
        borderRadius: '8px',
        backgroundColor: selectedMenu === 'item_issues' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        transition: 'all 0.3s ease',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          transform: 'translateX(5px)'
        },
      },
      onClick: () => {
        setSelectedMenu('item_issues');
      }
    },


    {
      key: 'pending_requests',
      icon: <BellOutlined style={{ color: '#ffffff', fontSize: '18px' }} />,
      label: (
        <Badge count={pendingToolRequests.filter(req => req.status === 'pending').length} size="small">
          <span style={{ color: '#ffffff', fontWeight: selectedMenu === 'pending_requests' ? '600' : '400' }}>Pending Requests</span>
        </Badge>
      ),
      style: {
        margin: '4px 12px',
        borderRadius: '8px',
        backgroundColor: selectedMenu === 'pending_requests' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        transition: 'all 0.3s ease',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          transform: 'translateX(5px)'
        },
      },
      onClick: () => {
        setSelectedMenu('pending_requests');
        setPendingToolRequestsVisible(true);
      }
    },
    {
      key: 'add_user',
      icon: <UserAddOutlined style={{ color: '#ffffff', fontSize: '18px' }} />,
      label: <span style={{ color: '#ffffff', fontWeight: selectedMenu === 'add_user' ? '600' : '400' }}>Add User</span>,
      style: {
        margin: '4px 12px',
        borderRadius: '8px',
        backgroundColor: selectedMenu === 'add_user' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        transition: 'all 0.3s ease',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          transform: 'translateX(5px)'
        },
      },
      onClick: () => {
        setSelectedMenu('add_user');
        setAddUserDrawerVisible(true);
      }
    },
    {
      key: 'issues_history',
      icon: <HistoryOutlined style={{ color: '#ffffff', fontSize: '18px' }} />,
      label: <span style={{ color: '#ffffff', fontWeight: selectedMenu === 'issues_history' ? '600' : '400' }}>Issues History</span>,
      style: {
        margin: '4px 12px',
        borderRadius: '8px',
        backgroundColor: selectedMenu === 'issues_history' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        transition: 'all 0.3s ease',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          transform: 'translateX(5px)'
        },
      },
      onClick: () => {
        setSelectedMenu('issues_history');
        setIssuesHistoryVisible(true);
      }
    },
    {
      key: 'officer_history',
      icon: <HistoryOutlined style={{ color: '#ffffff', fontSize: '18px' }} />,
      label: <span style={{ color: '#ffffff', fontWeight: selectedMenu === 'officer_history' ? '600' : '400' }}>My History</span>,
      style: {
        margin: '4px 12px',
        borderRadius: '8px',
        backgroundColor: selectedMenu === 'officer_history' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        transition: 'all 0.3s ease',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          transform: 'translateX(5px)'
        },
      },
      onClick: () => {
        setSelectedMenu('officer_history');
        setOfficerHistoryVisible(true);
      }
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          background: '#1e88e5',
          boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
          zIndex: 999,
          width: '220px',
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
        }}
        width={220}
      >
        <div style={{
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          background: '#1e88e5'
        }}>
          <img
            src={cmtisLogo}
            alt="CMTIS Logo"
            style={{
              height: '40px',
              filter: 'brightness(0) invert(1)'
            }}
          />
        </div>

        <Menu
          mode="inline"
          selectedKeys={[selectedMenu]}
          style={{
            borderRight: 0,
            background: '#1e88e5',
            color: '#ffffff',
            fontFamily: 'Segoe UI, Roboto, sans-serif',
          }}
          items={sidebarItems}
        />
      </Sider>

      <Layout style={{ marginLeft: 220 }}>
        <Header style={{
          background: '#ffffff',
          padding: '0 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Space>
            <Title level={3} style={{ margin: 0, color: '#1e88e5' }}>Tool Crib Officer Dashboard</Title>
          </Space>
          <Space>
            <Space style={{ marginRight: 24 }}>
              <Avatar
                style={{
                  backgroundColor: '#4096ff',
                  verticalAlign: 'middle'
                }}
                size="large"
                icon={<UserOutlined />}
              />
              <span style={{ color: '#262626', fontWeight: 500 }}>
                {currentUserInfo?.employee_name || 'Officer'}
              </span>
            </Space>
            <Button
              type="primary"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              danger
              style={{
                borderRadius: '8px'
              }}
            >
              Logout
            </Button>
          </Space>
        </Header>

        <Content style={{ padding: '24px', background: '#f5f7fa' }}>
          {selectedMenu === 'dashboard' && (
            <>
              {/* Tool Statistics */}
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={6}>
                  <Card
                    hoverable
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
                      '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: '0 4px 12px rgba(30, 136, 229, 0.2)',
                        borderColor: 'rgba(30, 136, 229, 0.4)'
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, #1e88e5, transparent)',
                      }
                    }}
                    bodyStyle={{ padding: '16px' }}
                  >
                    <Statistic
                      title={
                        <Space align="center" style={{ marginBottom: 8 }}>
                          <DashboardOutlined style={{ fontSize: '20px', color: '#1e88e5' }} />
                          <Text strong style={{ color: '#1e88e5', fontSize: '14px', fontFamily: 'Segoe UI, Roboto, sans-serif' }}>Total Tools</Text>
                        </Space>
                      }
                      value={toolStats.total}
                      valueStyle={{ color: '#1e88e5', fontSize: '28px', fontWeight: '600', fontFamily: 'Segoe UI, Roboto, sans-serif' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card
                    hoverable
                    style={{
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f6fbf6 100%)',
                      border: '1px solid rgba(46, 125, 50, 0.2)',
                      boxShadow: '0 2px 6px rgba(46, 125, 50, 0.1)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      height: '120px',
                      '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: '0 4px 12px rgba(46, 125, 50, 0.2)',
                        borderColor: 'rgba(46, 125, 50, 0.4)'
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, #2e7d32, transparent)',
                      }
                    }}
                    bodyStyle={{ padding: '16px' }}
                  >
                    <Statistic
                      title={
                        <Space align="center" style={{ marginBottom: 8 }}>
                          <CheckCircleOutlined style={{ fontSize: '20px', color: '#2e7d32' }} />
                          <Text strong style={{ color: '#2e7d32', fontSize: '14px', fontFamily: 'Segoe UI, Roboto, sans-serif' }}>Available</Text>
                        </Space>
                      }
                      value={toolStats.available}
                      valueStyle={{ color: '#2e7d32', fontSize: '28px', fontWeight: '600', fontFamily: 'Segoe UI, Roboto, sans-serif' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card
                    hoverable
                    style={{
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #ffffff 0%, #fff9f0 100%)',
                      border: '1px solid rgba(239, 108, 0, 0.2)',
                      boxShadow: '0 2px 6px rgba(239, 108, 0, 0.1)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      height: '120px',
                      '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: '0 4px 12px rgba(239, 108, 0, 0.2)',
                        borderColor: 'rgba(239, 108, 0, 0.4)'
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, #ef6c00, transparent)',
                      }
                    }}
                    bodyStyle={{ padding: '16px' }}
                  >
                    <Statistic
                      title={
                        <Space align="center" style={{ marginBottom: 8 }}>
                          <ClockCircleOutlined style={{ fontSize: '20px', color: '#ef6c00' }} />
                          <Text strong style={{ color: '#ef6c00', fontSize: '14px', fontFamily: 'Segoe UI, Roboto, sans-serif' }}>In Use</Text>
                        </Space>
                      }
                      value={toolStats.inUse}
                      valueStyle={{ color: '#ef6c00', fontSize: '28px', fontWeight: '600', fontFamily: 'Segoe UI, Roboto, sans-serif' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card
                    hoverable
                    style={{
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #ffffff 0%, #fff1f1 100%)',
                      border: '1px solid rgba(198, 40, 40, 0.2)',
                      boxShadow: '0 2px 6px rgba(198, 40, 40, 0.1)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      height: '120px',
                      '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: '0 4px 12px rgba(198, 40, 40, 0.2)',
                        borderColor: 'rgba(198, 40, 40, 0.4)'
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, #c62828, transparent)',
                      }
                    }}
                    bodyStyle={{ padding: '16px' }}
                  >
                    <Statistic
                      title={
                        <Space align="center" style={{ marginBottom: 8 }}>
                          <WarningOutlined style={{ fontSize: '20px', color: '#c62828' }} />
                          <Text strong style={{ color: '#c62828', fontSize: '14px', fontFamily: 'Segoe UI, Roboto, sans-serif' }}>Under Maintenance</Text>
                        </Space>
                      }
                      value={toolStats.maintenance}
                      valueStyle={{ color: '#c62828', fontSize: '28px', fontWeight: '600', fontFamily: 'Segoe UI, Roboto, sans-serif' }}
                    />
                  </Card>
                </Col>
              </Row>

              {/* Tools Management Section */}
              <Card
                style={{
                  borderRadius: '12px',
                  background: '#fff',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }}
              >
                <Space style={{ marginBottom: 24, width: '100%', justifyContent: 'space-between' }}>
                  <Space size="middle">
                    <Input.Search
                      placeholder="Search tools..."
                      allowClear
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{
                        width: 300,
                        '.ant-input': {
                          borderRadius: '8px'
                        },
                        '.ant-input-search-button': {
                          borderRadius: '0 8px 8px 0'
                        }
                      }}
                      prefix={<SearchOutlined style={{ color: '#1890ff' }} />}
                    />
                    <Select
                      value={selectedCategory}
                      onChange={setSelectedCategory}
                      style={{ width: 200 }}
                      showSearch
                      optionFilterProp="label"
                    >
                      <Option value="all">All Categories</Option>
                      {dynamicCategories.map(cat => (
                        <Option key={cat.value} value={cat.value}>{cat.label}</Option>
                      ))}
                    </Select>
                  </Space>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={handleManualRefresh}
                    loading={loading}
                    style={{
                      background: '#1890ff',
                      borderColor: '#1890ff',
                      color: '#ffffff',
                      borderRadius: '8px'
                    }}
                  >
                    Refresh
                  </Button>
                </Space>

                <Tabs
                  activeKey={activeTab}
                  onChange={handleTabChange}
                  items={tabItems}
                  style={{
                    marginBottom: '16px',
                    '.ant-tabs-nav': {
                      marginBottom: '16px'
                    },
                    '.ant-tabs-tab': {
                      padding: '8px 16px',
                      transition: 'all 0.3s'
                    },
                    '.ant-tabs-tab-active': {
                      backgroundColor: '#e6f7ff',
                      borderRadius: '8px'
                    },
                    '.ant-tabs-ink-bar': {
                      display: 'none'
                    }
                  }}
                />

                {selectedItemDescription && (
                  <Tag
                    closable
                    onClose={() => setSelectedItemDescription(null)}
                    color="blue"
                    style={{ marginBottom: 16 }}
                  >
                    Filtered by: {selectedItemDescription}
                  </Tag>
                )}

                <Form form={form} component={false}>
                  <Table
                    components={{
                      body: {
                        cell: EditableCell,
                      },
                    }}
                    columns={mergedColumns}
                    dataSource={filteredTools}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1500, y: 'calc(100vh - 450px)' }}
                    pagination={false}
                    virtual={virtualScrollEnabled}
                    style={{
                      '.ant-table': {
                        borderRadius: '12px',
                        overflow: 'hidden'
                      },
                      '.ant-table-thead > tr > th': {
                        background: '#fafafa',
                        fontWeight: 600
                      },
                      '.ant-table-tbody > tr:hover > td': {
                        background: '#e6f7ff'
                      }
                    }}
                  />
                </Form>
              </Card>
            </>
          )}

          {/* Issues History Section */}
          {selectedMenu === 'issues_history' && (
            <Card
              style={{
                borderRadius: '12px',
                background: '#fff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }}
            >
              <ItemIssuesHistory />
            </Card>
          )}

          {/* Officer History Section */}
          {selectedMenu === 'officer_history' && (
            <Card
              style={{
                borderRadius: '12px',
                background: '#fff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }}
            >
              <OfficerHistory officerId={currentUserInfo?.employee_id} />
            </Card>
          )}

          {/* Item Issues Section */}
          {selectedMenu === 'item_issues' && (
            <Card
              style={{
                borderRadius: '12px',
                background: '#fff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }}
            >
              <ItemIssuesModal />
            </Card>
          )}

          {/* Pending Requests Section */}
          {selectedMenu === 'pending_requests' && (
            <Card
              style={{
                borderRadius: '12px',
                background: '#fff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }}
            >
              <PendingRequestsDrawer
                currentUserInfo={currentUserInfo}
                pendingRequests={pendingToolRequests}
                onRequestsChange={(newRequests) => setPendingToolRequests(newRequests)}
              />
            </Card>
          )}

          {/* Keep all existing modals and drawers */}
          <Modal
            title={
              <Space>
                <AlertOutlined />
                <span>Supervisor Approved Issues</span>
              </Space>
            }
            open={issuesModalVisible}
            onCancel={() => setIssuesModalVisible(false)}
            width={1200}
            footer={null}
          >
            <Table
              columns={supervisorApprovedIssueColumns}
              dataSource={supervisorApprovedIssues}
              rowKey="id"
              pagination={{
                pageSize: 5,
                showTotal: (total) => `Total ${total} issues`
              }}
              scroll={{ x: 1500 }}
            />
          </Modal>

          <Modal
            title="Tool User Details"
            open={userDetailsVisible}
            onCancel={() => setUserDetailsVisible(false)}
            footer={null}
          >
            {selectedUser && (
              <Descriptions bordered column={1}>
                <Descriptions.Item label="Name">{selectedUser.name}</Descriptions.Item>
                <Descriptions.Item label="Employee ID">{selectedUser.id}</Descriptions.Item>
                <Descriptions.Item label="Department">{selectedUser.department}</Descriptions.Item>
                <Descriptions.Item label="Contact">{selectedUser.contact}</Descriptions.Item>
                <Descriptions.Item label="Taken Time">{selectedUser.takenTime}</Descriptions.Item>
                <Descriptions.Item label="Expected Return">{selectedUser.expectedReturn}</Descriptions.Item>
                <Descriptions.Item label="Purpose">{selectedUser.purpose}</Descriptions.Item>
              </Descriptions>
            )}
          </Modal>

          <PendingIssuesModal />
          <SupervisorApprovedIssuesModal />

          {selectedMenu === 'add_user' && (
            <Card
              style={{
                borderRadius: '12px',
                background: '#fff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }}
            >
              <AddUserDrawer
                visible={selectedMenu === 'add_user'}
                onClose={() => setSelectedMenu('dashboard')}
                userInfo={currentUserInfo}
              />
            </Card>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default OfficerDashboard; 