import React, { useState, useEffect, useMemo } from 'react';
import {
  Layout,
  Table,
  Input,
  Select,
  Button,
  Modal,
  Form,
  Upload,
  Tag,
  Space,
  message,
  Badge,
  Typography,
  Avatar,
  Tabs,
  Card,
  Statistic,
  Row,
  Col,
  Timeline,
  Drawer,
  Descriptions,
  Divider,
  Menu,
  Dropdown,
  InputNumber,
  Slider
} from 'antd';
import {
  SearchOutlined,
  LogoutOutlined,
  ToolOutlined,
  UploadOutlined,
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
  PlusOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  NotificationOutlined,
  SettingOutlined,
  HomeOutlined,
  EditOutlined,
  DeleteOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import cmtisLogo from '../assets/cmtis.png';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ToolRequestDrawer, { getTableColumns, DateRangeFilter, DownloadButton, getFilteredRequests } from './supervisor components/ToolRequestDrawer';
import ToolRequestsHistory from './supervisor components/ToolRequestsHistory';
import IssuesHistory from './supervisor components/IssuesHistory';
import ToolReturnsHistory from './supervisor components/ToolReturnsHistory';
import SupervisorHistory from './supervisor components/SupervisorHistory';
import { API_BASE_URL, getAuthHeaders } from '../config';

const { Header, Content, Sider } = Layout;
const { Option } = Select;
const { Title, Text } = Typography;

// Add retry utility function at the top of the file
const fetchWithRetry = async (url, options = {}, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
          ...options.headers
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

const SupervisorDashboard = ({ userInfo, onLogout }) => {
  const navigate = useNavigate();
  const [tools, setTools] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [userDetailsVisible, setUserDetailsVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentUserInfo, setCurrentUserInfo] = useState(userInfo);
  const [requestsModalVisible, setRequestsModalVisible] = useState(false);
  const [officerAcceptedIssuesVisible, setOfficerAcceptedIssuesVisible] = useState(false);
  const [officerAcceptedIssues, setOfficerAcceptedIssues] = useState([]);
  const [toolSubmitRequestsVisible, setToolSubmitRequestsVisible] = useState(false);
  const [toolSubmitRequests, setToolSubmitRequests] = useState([]);
  const [selectedItemDescription, setSelectedItemDescription] = useState(null);
  const [virtualScrollEnabled, setVirtualScrollEnabled] = useState(true);
  const [officerApprovedIssues, setOfficerApprovedIssues] = useState([]);
  const [officerApprovedIssuesModalVisible, setOfficerApprovedIssuesModalVisible] = useState(false);
  const [toolRequestDrawerVisible, setToolRequestDrawerVisible] = useState(false);
  const [pendingToolRequests, setPendingToolRequests] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState('dashboard');
  const [toolStats, setToolStats] = useState({
    total: 0,
    available: 0,
    inUse: 0,
    maintenance: 0
  });
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [editingKey, setEditingKey] = useState('');
  const [form] = Form.useForm();

  // Add state for pending and collected returns
  const [pendingReturns, setPendingReturns] = useState([]);
  const [collectedReturns, setCollectedReturns] = useState([]);
  const [dateRange, setDateRange] = useState([null, null]);

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
      const response = await fetch(`${API_BASE_URL}/api/tools/${record.id}`, {
        method: 'PUT',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
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
          const response = await fetch(`${API_BASE_URL}/api/tools/${record.id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });

          if (!response.ok) {
            throw new Error('Failed to delete tool');
          }

          message.success('Tool deleted successfully');
          fetchTools();
        } catch (error) {
          console.error('Error deleting tool:', error);
          message.error('Failed to delete tool');
        }
      },
    });
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

  // Handle logout
  const handleLogout = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        await fetch(`${API_BASE_URL}/logout?employee_id=${user.employee_id}`, {
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

  // Update fetchTools function
  const fetchTools = async () => {
    try {
      setLoading(true);
      const authHeaders = getAuthHeaders();
      // Fetch tools, requests, returns and issues in parallel
      const [toolsResponse, requestsResponse, returnsResponse, issuesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/tools`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/api/tool-requests?status=approved&collected=yes&returned=no`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/api/tool-returns/pending`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/api/tool-issues/all`, { headers: authHeaders })
      ]);

      if (!toolsResponse.ok || !requestsResponse.ok || !returnsResponse.ok || !issuesResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const [toolsData, requestsData, returnsData, issuesData] = await Promise.all([
        toolsResponse.json(),
        requestsResponse.json(),
        returnsResponse.json(),
        issuesResponse.json()
      ]);

      // Get active tool requests (approved and collected)
      const activeRequests = requestsData;

      // Create sets of returned tools and tools with issues
      const returnedTools = new Set(
        returnsData
          .filter(ret => ret.status === 'collected')
          .map(ret => ret.request_id)
      );

      const toolsWithIssues = new Set(
        issuesData
          .filter(issue =>
            issue.officer_status === 'approved' &&
            (!issue.supervisor_status || issue.supervisor_status === 'pending')
          )
          .map(issue => issue.request_id)
      );

      // Count tools in use by each request, excluding returned and reported tools
      const toolsInUseCount = activeRequests.reduce((acc, request) => {
        const toolId = request.tool_sl_no;

        // Skip if tool has been returned or has approved issues
        if (returnedTools.has(request.unique_request_id) || toolsWithIssues.has(request.unique_request_id)) {
          return acc;
        }

        if (!acc[toolId]) {
          acc[toolId] = 0;
        }
        acc[toolId] += 1;
        return acc;
      }, {});

      // Group active requests by tool_sl_no for user display, excluding returned and reported tools
      const requestsByTool = activeRequests.reduce((acc, request) => {
        const toolId = request.tool_sl_no;

        // Skip if tool has been returned or has approved issues
        if (returnedTools.has(request.unique_request_id) || toolsWithIssues.has(request.unique_request_id)) {
          return acc;
        }

        if (!acc[toolId]) {
          acc[toolId] = [];
        }
        acc[toolId].push({
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

      // Map backend data to frontend structure
      const mappedTools = toolsData.map(tool => {
        const activeUsers = requestsByTool[tool.Sl_no] || [];
        const inUseCount = toolsInUseCount[tool.Sl_no] || 0;
        const totalQuantity = tool.Quantity || 0;

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

        if (tool.quantity === 0) {
          // If quantity is 0, tool is in maintenance
          acc.maintenance += 1;
        } else if (tool.status === 'in_use') {
          // Add number of tools currently in use
          const inUseCount = toolsInUseCount[tool.id] || 0;
          acc.inUse += inUseCount;
        }

        return acc;
      }, { total: 0, inUse: 0, maintenance: 0 });

      // Available is what's left after subtracting in-use
      stats.available = stats.total - stats.inUse;

      setTools(mappedTools);
      setToolStats({
        total: stats.total,
        available: stats.available,
        inUse: stats.inUse,
        maintenance: stats.maintenance
      });

    } catch (error) {
      console.error('Error fetching tools:', error);
      message.error('Failed to fetch tools data');
    } finally {
      setLoading(false);
    }
  };

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
      if (parsedUser.role !== 'supervisor') {
        navigate('/login');
        return;
      }
      setCurrentUserInfo(parsedUser);
    } catch (error) {
      console.error('Error parsing user info:', error);
      return;
    }

    // Fetch tools data
    fetchTools();

    // Fetch all tool requests from backend
    const fetchRequests = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/tool-requests`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Failed to fetch requests');
        const data = await response.json();

        // Map the data to ensure all fields are present
        const mappedRequests = data.map(request => ({
          ...request,
          department: request.department || '',
          contact: request.contact || '',
          operator_name: request.operator_name || '',
          operator_id: request.operator_id || '',
          purpose: request.purpose || '',
          project_details: request.project_details || '',
          status: request.status || 'pending'
        }));

        console.log('Mapped Requests:', mappedRequests); // Add this for debugging
        setRequests(mappedRequests);
      } catch (err) {
        console.error('Error fetching requests:', err);
        message.error('Failed to fetch tool requests');
        setRequests([]);
      }
    };

    fetchRequests();
  }, []);

  useEffect(() => {
    setFilteredRequests(requests);
  }, [requests]);

  // Update fetchToolSubmitRequests function
  const fetchToolSubmitRequests = async () => {
    try {
      const authHeaders = getAuthHeaders();
      // Fetch both pending and collected returns
      const [pendingResponse, collectedResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/tool-returns/pending`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/api/tool-returns/all?status=collected`, { headers: authHeaders })
      ]);

      if (!pendingResponse.ok || !collectedResponse.ok) {
        throw new Error('Failed to fetch tool returns');
      }

      const [pendingData, collectedData] = await Promise.all([
        pendingResponse.json(),
        collectedResponse.json()
      ]);

      // Set pending and collected returns separately
      setPendingReturns(pendingData);
      setCollectedReturns(collectedData);

      // Combine for display
      setToolSubmitRequests([...pendingData, ...collectedData]);
    } catch (error) {
      console.error('Error fetching tool returns:', error);
      message.error('Failed to fetch tool returns');
    }
  };

  // Add function to only fetch pending returns
  const fetchPendingReturns = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tool-returns/pending`, { headers: getAuthHeaders() });
      if (!response.ok) {
        throw new Error('Failed to fetch pending returns');
      }
      const pendingData = await response.json();
      setPendingReturns(pendingData);

      // Update combined list while keeping collected returns
      setToolSubmitRequests([...pendingData, ...collectedReturns]);
    } catch (error) {
      console.error('Error fetching pending returns:', error);
    }
  };

  const handleStatusChange = async (requestId, newStatus) => {
    try {
      let endpoint = `${API_BASE_URL}/api/tool-requests/${requestId}`;

      if (newStatus === 'approved') {
        endpoint = `${API_BASE_URL}/api/tool-requests/${requestId}/approve`;
        const response = await fetch(endpoint, {
          method: 'PUT',
          headers: getAuthHeaders({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            supervisor_id: currentUserInfo?.employee_id,
            supervisor_name: currentUserInfo?.employee_name,
            status: newStatus
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to approve request');
        }

        const updated = await response.json();
        const newRequests = requests.map(req =>
          req.id === updated.id ? { ...updated, loading: false } : req
        );
        setRequests(newRequests);
        setFilteredRequests(newRequests);

        // Refresh tools list after approval
        fetchTools();
      } else {
        endpoint = `${endpoint}?status=${newStatus}`;
        const response = await fetch(endpoint, {
          method: 'PATCH',
          headers: getAuthHeaders({
            'Content-Type': 'application/json',
          })
        });

        if (!response.ok) throw new Error('Failed to update status');

        const updated = await response.json();
        const newRequests = requests.map(req =>
          req.id === updated.id ? { ...updated, loading: false } : req
        );
        setRequests(newRequests);
        setFilteredRequests(newRequests);
      }

      message.success(`Request ${newStatus} successfully`);
    } catch (error) {
      console.error('Error updating request:', error);
      message.error(error.message || 'Failed to update request status');
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

  // Update toolColumns to include editable cells
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
      render: (text, record) => {
        const editable = isEditing(record);
        return editable ? (
          <Form.Item
            name="range"
            style={{ margin: 0 }}
          >
            <Input />
          </Form.Item>
        ) : text;
      }
    },
    {
      title: 'Identification Code',
      dataIndex: 'identificationCode',
      key: 'identificationCode',
      width: 130,
      editable: true,
      render: (text, record) => {
        const editable = isEditing(record);
        return editable ? (
          <Form.Item
            name="identificationCode"
            style={{ margin: 0 }}
          >
            <Input />
          </Form.Item>
        ) : text;
      }
    },
    {
      title: 'Make',
      dataIndex: 'make',
      key: 'make',
      width: 100,
      editable: true,
      render: (text, record) => {
        const editable = isEditing(record);
        return editable ? (
          <Form.Item
            name="make"
            style={{ margin: 0 }}
          >
            <Input />
          </Form.Item>
        ) : text;
      }
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
            <Space direction="vertical" size={1}>
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
    // ...removed Actions column...
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

  const requestColumns = [
    {
      title: 'Tool Details',
      key: 'toolDetails',
      width: 200,  // Reduced from 300
      render: (_, record) => {
        const tool = tools.find(t => t.id === record.tool_sl_no);
        return (
          <Space direction="vertical" size={0}>
            <Text strong>{tool?.name || 'Unknown Tool'}</Text>
            <Text type="secondary">Serial No: {record.tool_sl_no}</Text>
            <Text type="secondary">Range: {tool?.range || 'N/A'}</Text>
            <Text type="secondary">ID Code: {tool?.identificationCode || 'N/A'}</Text>
            <Text type="secondary">
              <EnvironmentOutlined style={{ color: '#1e88e5' }} /> Location: {tool?.location || 'N/A'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Operator Details',
      key: 'operatorDetails',
      width: 180,  // Reduced from 250
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
      key: 'request_date',
      width: 120,  // Reduced from 150
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: 'Purpose',
      dataIndex: 'purpose',
      key: 'purpose',
      width: 150,  // Reduced from 200
    },
    {
      title: 'Project Details',
      dataIndex: 'project_details',
      key: 'project_details',
      width: 180,  // Reduced from 250
    },
    {
      title: 'Supervisor Details',
      key: 'supervisorDetails',
      width: 200,
      render: (_, record) => {
        if (record.status === 'pending') return '-';
        return (
          <Space direction="vertical" size={0}>
            <Text strong>{record.supervisor_name || 'N/A'}</Text>
            <Text type="secondary">ID: {record.supervisor_id || 'N/A'}</Text>
            <Text type="secondary">Response Date: {record.response_date ? new Date(record.response_date).toLocaleString() : 'N/A'}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, record) => {
        const statusColors = {
          pending: 'warning',
          approved: 'success',
          rejected: 'error'
        };
        return <Tag color={statusColors[record.status]}>{record.status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        record.status === 'pending' && (
          <Space size="small">
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => handleStatusChange(record.id, 'approved')}
              loading={record.loading}
              size="small"
            >
              Approve
            </Button>
            <Button
              danger
              icon={<CloseOutlined />}
              onClick={() => handleStatusChange(record.id, 'rejected')}
              loading={record.loading}
              size="small"
            >
              Reject
            </Button>
          </Space>
        )
      ),
    },
  ];

  // Update the officerAcceptedIssuesColumns
  const officerAcceptedIssuesColumns = [
    {
      title: 'Tool Details',
      key: 'tool_details',
      width: 180,  // Reduced from 200
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
      width: 180,  // Reduced from 200
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
      width: 120,  // Reduced from 150
    },
    {
      title: 'Project Details',
      dataIndex: 'project_details',
      key: 'project_details',
      width: 120,  // Reduced from 150
    },
    {
      title: 'Issue Severity',
      key: 'severity',
      width: 100,  // Reduced from 120
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
      width: 120,  // Reduced from 150
    },
    {
      title: 'Issue Description',
      dataIndex: 'description',
      key: 'description',
      width: 120,  // Reduced from 150
    },
    {
      title: 'Officer Details',
      key: 'officer',
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.officer_name || 'N/A'}</Text>
          <Text type="secondary">ID: {record.officer_id || 'N/A'}</Text>
          <Text type="secondary">Response Date: {record.officer_approval_date ? new Date(record.officer_approval_date).toLocaleString() : 'N/A'}</Text>
        </Space>
      ),
    },
    {
      title: 'Supervisor Details',
      key: 'supervisorDetails',
      width: 200,
      render: (_, record) => {
        if (!record.supervisor_status || record.supervisor_status === 'pending') return '-';
        return (
          <Space direction="vertical" size={0}>
            <Text strong>{record.supervisor_name || 'N/A'}</Text>
            <Text type="secondary">ID: {record.supervisor_id || 'N/A'}</Text>
            <Text type="secondary">Response Date: {record.supervisor_approval_date ? new Date(record.supervisor_approval_date).toLocaleString() : 'N/A'}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      key: 'supervisor_status',
      width: 120,
      render: (_, record) => {
        const color = record.supervisor_status === 'approved' ? 'success' :
          record.supervisor_status === 'rejected' ? 'error' : 'warning';
        return <Tag color={color}>{(record.supervisor_status || 'pending').toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => {
        const supervisorHasActed = record.supervisor_status && record.supervisor_status !== 'pending';

        return (
          <Space>
            <Button
              type="primary"
              onClick={() => handleIssueApproval(record.id, 'approve')}
              disabled={supervisorHasActed}
            >
              Accept
            </Button>
            <Button
              danger
              onClick={() => handleIssueApproval(record.id, 'reject')}
              disabled={supervisorHasActed}
            >
              Reject
            </Button>
          </Space>
        );
      },
    },
  ];

  // Update filteredTools
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

  const requestStats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length
  };

  // Add tabItems configuration
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

  const handleToolSubmitStatusChange = async (requestId, newStatus) => {
    setLoading(true);
    try {
      const updatedRequests = toolSubmitRequests.map(req =>
        req.id === requestId ? { ...req, status: newStatus } : req
      );
      setToolSubmitRequests(updatedRequests);
      message.success(`Tool submit request ${newStatus} successfully`);
    } catch (error) {
      message.error('Failed to update tool submit request status');
    }
    setLoading(false);
  };

  // Update handleCollectTool function
  const handleCollectTool = async (returnId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tool-returns/${returnId}/collect`, {
        method: 'PATCH',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          supervisor_id: currentUserInfo.employee_id,
          supervisor_name: currentUserInfo.employee_name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to collect tool');
      }

      const collectedReturn = await response.json();
      message.success('Tool collected successfully');

      // Update states
      setPendingReturns(prev => prev.filter(r => r.id !== returnId));
      setCollectedReturns(prev => [...prev, collectedReturn]);
      setToolSubmitRequests(prev => prev.map(r => r.id === returnId ? collectedReturn : r));

      // Refresh tools data
      await fetchTools();
    } catch (error) {
      console.error('Error collecting tool:', error);
      message.error(error.message || 'Failed to collect tool');
    }
  };

  // Update tool submit columns
  const toolSubmitColumns = [
    {
      title: 'Tool Details',
      key: 'toolDetails',
      width: 200,  // Reduced from 300
      render: (_, record) => {
        const tool = tools.find(t => t.id === record.tool_sl_no);
        return (
          <Space direction="vertical" size={0}>
            <Text strong>{tool?.name || 'Unknown Tool'}</Text>
            <Text type="secondary">Serial No: {record.tool_sl_no}</Text>
            <Text type="secondary">Range: {tool?.range || 'N/A'}</Text>
            <Text type="secondary">ID Code: {tool?.identificationCode || 'N/A'}</Text>
            <Text type="secondary">
              <EnvironmentOutlined style={{ color: '#1e88e5' }} /> Location: {tool?.location || 'N/A'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Operator Details',
      key: 'operatorDetails',
      width: 180,  // Reduced from 250
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
      title: 'Submit Date',
      dataIndex: 'request_date',
      key: 'request_date',
      width: 120,  // Reduced from 150
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: 'Condition',
      dataIndex: 'condition_on_return',
      key: 'condition',
      width: 120,  // Reduced from 150
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      key: 'remarks',
      width: 150,  // Reduced from 200
    },
    {
      title: 'Supervisor Details',
      key: 'supervisorDetails',
      width: 200,
      render: (_, record) => {
        if (record.status === 'pending') return '-';
        return (
          <Space direction="vertical" size={0}>
            <Text strong>{record.supervisor_name || 'N/A'}</Text>
            <Text type="secondary">ID: {record.supervisor_id || 'N/A'}</Text>
            <Text type="secondary">Collection Date: {record.collected_date ? new Date(record.collected_date).toLocaleString() : 'N/A'}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 150,
      render: (_, record) => {
        const statusColors = {
          pending: 'warning',
          collected: 'success'
        };
        return (
          <Tag color={statusColors[record.status]}>
            {record.status === 'collected' ? 'COLLECTED' : 'PENDING'}
          </Tag>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        record.status === 'pending' ? (
          <Button
            type="primary"
            onClick={() => handleCollectTool(record.id)}
          >
            Collect
          </Button>
        ) : (
          <Button type="primary" disabled>
            Collected
          </Button>
        )
      ),
    },
  ];

  // Update fetchIssues function
  const fetchIssues = async () => {
    try {
      const authHeaders = getAuthHeaders();
      const [issuesResponse, toolsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/tool-issues/all`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/api/tools`, { headers: authHeaders })
      ]);

      const [issues, tools] = await Promise.all([
        issuesResponse.json(),
        toolsResponse.json()
      ]);

      const toolsMap = tools.reduce((acc, tool) => {
        acc[tool.Sl_no] = tool;
        return acc;
      }, {});

      // Filter for issues that have been approved by officer
      const issuesWithTools = issues
        .filter(issue => issue.officer_status === 'approved')
        .map(issue => ({
          ...issue,
          tool_details: toolsMap[issue.tool_sl_no] || {}
        }));

      setOfficerApprovedIssues(issuesWithTools);
    } catch (error) {
      console.error('Error fetching issues:', error);
      message.error('Failed to fetch issues');
    }
  };

  // Update handleIssueApproval function
  const handleIssueApproval = async (issueId, status) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tool-issues/${issueId}/supervisor-action`,
        {
          method: 'PUT',
          headers: getAuthHeaders({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            action: status,
            supervisor_id: currentUserInfo?.employee_id,
            supervisor_name: currentUserInfo?.employee_name
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update issue status');
      }

      message.success(`Issue ${status === 'approve' ? 'approved' : 'rejected'} successfully`);
      await fetchIssues();
    } catch (error) {
      console.error('Error updating issue status:', error);
      message.error(error.message || 'Failed to update issue status');
    }
  };

  // Add a function to count pending issues
  const getPendingIssuesCount = (issues) => {
    return issues.filter(issue =>
      issue.officer_status === 'approved' &&
      (!issue.supervisor_status || issue.supervisor_status === 'pending')
    ).length;
  };

  // Update useEffect to fetch issues periodically
  useEffect(() => {
    let isSubscribed = true;

    const fetchData = async () => {
      if (!isSubscribed) return;

      try {
        await fetchTools();
        await fetchIssues();

        // Fetch tool requests
        if (currentUserInfo?.employee_id) {
          const response = await fetchWithRetry(`${API_BASE_URL}/new-tool-requests/supervisor/${currentUserInfo.employee_id}`);
          if (!isSubscribed) return;
          const data = await response.json();
          setPendingToolRequests(data.filter(req => req.status === 'pending'));
        }

        // Fetch tool returns
        const returnsResponse = await fetchWithRetry(`${API_BASE_URL}/api/tool-returns/pending`);
        if (!isSubscribed) return;
        const returnsData = await returnsResponse.json();
        setToolSubmitRequests(returnsData);

      } catch (error) {
        console.error('Error fetching data:', error);
        if (isSubscribed) {
          message.error('Failed to fetch some data');
        }
      }
    };

    fetchData();

    return () => {
      isSubscribed = false;
    };
  }, [currentUserInfo]);

  // Add button to header menu
  const headerMenu = (
    <Menu>
      <Menu.Item key="officer_approved_issues" onClick={() => setOfficerApprovedIssuesModalVisible(true)}>
        <Badge
          count={getPendingIssuesCount(officerApprovedIssues)}
          offset={[10, 0]}
          style={{ backgroundColor: '#1890ff' }}
        >
          Officer Accepted Issues
        </Badge>
      </Menu.Item>
    </Menu>
  );

  // Add modal
  const OfficerApprovedIssuesModal = () => (
    <Modal
      title="Officer Accepted Issues"
      visible={officerApprovedIssuesModalVisible}
      onCancel={() => setOfficerApprovedIssuesModalVisible(false)}
      width={1200}
      footer={null}
    >
      <Table
        dataSource={officerApprovedIssues}
        columns={officerAcceptedIssuesColumns}
        rowKey="id"
        scroll={{ x: true }}
      />
    </Modal>
  );

  // Update fetchPendingToolRequests function
  const fetchPendingToolRequests = async () => {
    if (!currentUserInfo?.employee_id) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/new-tool-requests/supervisor/${currentUserInfo.employee_id}`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch tool requests');
      const data = await response.json();
      setPendingToolRequests(data);
    } catch (error) {
      console.error('Error fetching tool requests:', error);
      message.error('Failed to fetch tool requests');
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!currentUserInfo?.employee_id) return;

      try {
        setLoading(true);
        await fetchTools();
        await fetchIssues();
        await fetchPendingToolRequests();

        // Fetch tool returns
        const returnsResponse = await fetchWithRetry(`${API_BASE_URL}/api/tool-returns/pending`);
        const returnsData = await returnsResponse.json();
        setToolSubmitRequests(returnsData);
      } catch (error) {
        console.error('Error fetching initial data:', error);
        message.error('Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [currentUserInfo]);

  // Handle menu selection changes
  useEffect(() => {
    const fetchMenuData = async () => {
      setLoading(true);
      try {
        switch (selectedMenu) {
          case 'dashboard':
            await fetchTools();
            break;
          case 'requests':
            const response = await fetch(`${API_BASE_URL}/api/tool-requests`, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('Failed to fetch requests');
            const data = await response.json();
            setRequests(data);
            setFilteredRequests(data);
            break;
          case 'issues':
            await fetchIssues();
            break;
          case 'returns':
            const returnsResponse = await fetch(`${API_BASE_URL}/api/tool-returns/pending`, { headers: getAuthHeaders() });
            if (!returnsResponse.ok) throw new Error('Failed to fetch returns');
            const returnsData = await returnsResponse.json();
            setToolSubmitRequests(returnsData);
            break;
          case 'new-request':
            await fetchPendingToolRequests();
            break;
          case 'history':
            // Add any additional logic you want to execute when history is selected
            break;
        }
      } catch (error) {
        console.error('Error fetching menu data:', error);
        message.error(`Failed to fetch ${selectedMenu} data`);
      } finally {
        setLoading(false);
      }
    };

    fetchMenuData();
  }, [selectedMenu]);

  // Update handleManualRefresh function
  const handleManualRefresh = async () => {
    try {
      setLoading(true);
      switch (selectedMenu) {
        case 'dashboard':
          await fetchTools();
          break;
        case 'requests':
          const response = await fetch(`${API_BASE_URL}/api/tool-requests`, { headers: getAuthHeaders() });
          if (!response.ok) throw new Error('Failed to fetch requests');
          const data = await response.json();
          setRequests(data);
          setFilteredRequests(data);
          break;
        case 'issues':
          await fetchIssues();
          break;
        case 'returns':
          const returnsResponse = await fetch(`${API_BASE_URL}/api/tool-returns/pending`, { headers: getAuthHeaders() });
          if (!returnsResponse.ok) throw new Error('Failed to fetch returns');
          const returnsData = await returnsResponse.json();
          setToolSubmitRequests(returnsData);
          break;
        case 'new-request':
          await fetchPendingToolRequests();
          break;
      }
      message.success('Data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
      message.error('Failed to refresh data');
    } finally {
      setLoading(false);
    }
  };

  // Update useEffect for polling
  useEffect(() => {
    if (selectedMenu === 'returns') {
      // Initial fetch of all data
      fetchToolSubmitRequests();
    }
  }, [selectedMenu]);

  const handleDateRangeChange = (dates) => {
    setDateRange(dates);

    if (dates && dates[0] && dates[1]) {
      const filtered = getFilteredRequests(pendingToolRequests, dates);
      if (filtered.length === 0) {
        Modal.warning({
          title: 'No Data Available',
          content: 'Data is not available for the selected date range.',
          onOk: () => {
            setDateRange([null, null]); // Clear date range to show all data
          },
          okText: 'OK'
        });
      }
    }
  };

  // Update filtered requests when date range or pending requests change
  useEffect(() => {
    setFilteredRequests(getFilteredRequests(pendingToolRequests, dateRange));
  }, [pendingToolRequests, dateRange]);

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
              filter: 'brightness(0) invert(1)' // Makes logo white
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
          items={[
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
              key: 'requests',
              icon: <BellOutlined style={{ color: '#ffffff', fontSize: '18px' }} />,
              label: (
                <Badge count={requestStats.pending} size="small">
                  <span style={{ color: '#ffffff', fontWeight: selectedMenu === 'requests' ? '600' : '400' }}>Tool Requests</span>
                </Badge>
              ),
              style: {
                margin: '4px 12px',
                borderRadius: '8px',
                backgroundColor: selectedMenu === 'requests' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                transition: 'all 0.3s ease',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  transform: 'translateX(5px)'
                },
              },
              onClick: () => {
                setSelectedMenu('requests');
                setRequestsModalVisible(true);
              }
            },

            {
              key: 'returns',
              icon: <ToolOutlined style={{ color: '#ffffff', fontSize: '18px' }} />,
              label: (
                <Badge count={toolSubmitRequests.filter(req => req.status === 'pending').length} size="small">
                  <span style={{ color: '#ffffff', fontWeight: selectedMenu === 'returns' ? '600' : '400' }}>Tool Returns</span>
                </Badge>
              ),
              style: {
                margin: '4px 12px',
                borderRadius: '8px',
                backgroundColor: selectedMenu === 'returns' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                transition: 'all 0.3s ease',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  transform: 'translateX(5px)'
                },
              },
              onClick: () => {
                setSelectedMenu('returns');
                setToolSubmitRequestsVisible(true);
              }
            },

            {
              key: 'issues',
              icon: <AlertOutlined style={{ color: '#ffffff', fontSize: '18px' }} />,
              label: (
                <Badge count={getPendingIssuesCount(officerApprovedIssues)} size="small">
                  <span style={{ color: '#ffffff', fontWeight: selectedMenu === 'issues' ? '600' : '400' }}>Issues</span>
                </Badge>
              ),
              style: {
                margin: '4px 12px',
                borderRadius: '8px',
                backgroundColor: selectedMenu === 'issues' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                transition: 'all 0.3s ease',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  transform: 'translateX(5px)'
                },
              },
              onClick: () => {
                setSelectedMenu('issues');
                setOfficerAcceptedIssuesVisible(true);
              }
            },

            {
              key: 'new-request',
              icon: <PlusOutlined style={{ color: '#ffffff', fontSize: '18px' }} />,
              label: <span style={{ color: '#ffffff', fontWeight: selectedMenu === 'new-request' ? '600' : '400' }}>New Tool Request</span>,
              style: {
                margin: '4px 12px',
                borderRadius: '8px',
                backgroundColor: selectedMenu === 'new-request' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                transition: 'all 0.3s ease',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  transform: 'translateX(5px)'
                },
              },
              onClick: () => setSelectedMenu('new-request')
            },
            {
              key: 'history',
              icon: <HistoryOutlined style={{ color: '#ffffff', fontSize: '18px' }} />,
              label: <span style={{ color: '#ffffff', fontWeight: selectedMenu === 'history' ? '600' : '400' }}>My History</span>,
              style: {
                margin: '4px 12px',
                borderRadius: '8px',
                backgroundColor: selectedMenu === 'history' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                transition: 'all 0.3s ease',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  transform: 'translateX(5px)'
                },
              },
              onClick: () => setSelectedMenu('history')
            }
          ]}
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
            <Title level={3} style={{ margin: 0, color: '#1e88e5' }}>Tool Crib Supervisor Dashboard</Title>
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
                {currentUserInfo?.employee_name || 'Supervisor'}
              </span>
            </Space>
            <Button
              type="primary"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              danger
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

              {/* Request Statistics */}
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
                          <Text strong style={{ color: '#1e88e5', fontSize: '14px', fontFamily: 'Segoe UI, Roboto, sans-serif' }}>Total Requests</Text>
                        </Space>
                      }
                      value={requestStats.total}
                      valueStyle={{ color: '#1e88e5', fontSize: '28px', fontWeight: '600', fontFamily: 'Segoe UI, Roboto, sans-serif' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card
                    hoverable
                    style={{
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #ffffff 0%, #fffbf2 100%)',
                      border: '1px solid rgba(245, 127, 23, 0.2)',
                      boxShadow: '0 2px 6px rgba(245, 127, 23, 0.1)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      height: '120px',
                      '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: '0 4px 12px rgba(245, 127, 23, 0.2)',
                        borderColor: 'rgba(245, 127, 23, 0.4)'
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '2px',
                        background: 'linear-gradient(90deg, #f57f17, transparent)',
                      }
                    }}
                    bodyStyle={{ padding: '16px' }}
                  >
                    <Statistic
                      title={
                        <Space align="center" style={{ marginBottom: 8 }}>
                          <ClockCircleOutlined style={{ fontSize: '20px', color: '#f57f17' }} />
                          <Text strong style={{ color: '#f57f17', fontSize: '14px', fontFamily: 'Segoe UI, Roboto, sans-serif' }}>Pending Requests</Text>
                        </Space>
                      }
                      value={requestStats.pending}
                      valueStyle={{ color: '#f57f17', fontSize: '28px', fontWeight: '600', fontFamily: 'Segoe UI, Roboto, sans-serif' }}
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
                          <Text strong style={{ color: '#2e7d32', fontSize: '14px', fontFamily: 'Segoe UI, Roboto, sans-serif' }}>Approved</Text>
                        </Space>
                      }
                      value={requestStats.approved}
                      valueStyle={{ color: '#2e7d32', fontSize: '28px', fontWeight: '600', fontFamily: 'Segoe UI, Roboto, sans-serif' }}
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
                          <CloseOutlined style={{ fontSize: '20px', color: '#c62828' }} />
                          <Text strong style={{ color: '#c62828', fontSize: '14px', fontFamily: 'Segoe UI, Roboto, sans-serif' }}>Rejected</Text>
                        </Space>
                      }
                      value={requestStats.rejected}
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
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  marginBottom: '24px'
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
                          borderRadius: '8px',
                          fontFamily: 'Segoe UI, Roboto, sans-serif',
                          fontSize: '14px'
                        },
                        '.ant-input-search-button': {
                          borderRadius: '0 8px 8px 0',
                          background: '#1e88e5',
                          borderColor: '#1e88e5'
                        }
                      }}
                      prefix={<SearchOutlined style={{ color: '#1e88e5' }} />}
                    />
                    <Select
                      value={selectedCategory}
                      onChange={setSelectedCategory}
                      style={{
                        width: 200,
                        fontFamily: 'Segoe UI, Roboto, sans-serif',
                        fontSize: '14px',
                        '.ant-select': {
                          width: '100%',
                          '& .ant-select-selector': {
                            borderRadius: '6px',
                            padding: '4px 11px',
                            height: '32px',
                            alignItems: 'center',
                            backgroundColor: '#ffffff',
                            border: '1px solid #d9d9d9',
                            '&:hover': {
                              borderColor: '#40a9ff'
                            }
                          }
                        }
                      }}
                      showSearch
                      optionFilterProp="label"
                    >
                      <Option value="all">All Categories</Option>
                      {dynamicCategories.map(cat => (
                        <Option key={cat.value} value={cat.value}>{cat.label}</Option>
                      ))}
                    </Select>
                  </Space>
                </Space>

                <div style={{ marginBottom: '16px' }}>
                  <Tabs
                    activeKey={activeTab}
                    onChange={handleTabChange}
                    items={tabItems}
                    style={{
                      width: '100%',
                      borderBottom: '1px solid #f0f0f0',
                      paddingBottom: '8px',
                      fontFamily: 'Segoe UI, Roboto, sans-serif',
                      '.ant-tabs-nav': {
                        marginBottom: 0,
                        '&::before': {
                          border: 'none'
                        }
                      },
                      '.ant-tabs-tab': {
                        padding: '8px 16px',
                        fontSize: '14px',
                        '&.ant-tabs-tab-active': {
                          backgroundColor: '#e6f2fa',
                          borderRadius: '8px',
                          color: '#1e88e5'
                        }
                      },
                      '.ant-tabs-ink-bar': {
                        display: 'none'
                      }
                    }}
                  />
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginBottom: '16px',
                  marginTop: '8px'
                }}>
                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={handleManualRefresh}
                    loading={loading}
                    style={{
                      background: '#1e88e5',
                      borderColor: '#1e88e5',
                      borderRadius: '8px',
                      fontFamily: 'Segoe UI, Roboto, sans-serif',
                      fontSize: '14px'
                    }}
                  >
                    Refresh
                  </Button>
                </div>

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
                    scroll={{ x: 1200, y: 'calc(100vh - 480px)' }}
                    pagination={false}
                    virtual={true}
                    style={{
                      '.ant-table': {
                        borderRadius: '12px',
                        overflow: 'hidden',
                        fontFamily: 'Segoe UI, Roboto, sans-serif',
                        fontSize: '14px',
                        maxWidth: '100%',
                        margin: '0 auto'
                      },
                      '.ant-table-header': {
                        background: '#1e88e5 !important'
                      },
                      '.ant-table-thead': {
                        background: '#1e88e5 !important'
                      },
                      '.ant-table-thead > tr': {
                        background: '#1e88e5 !important'
                      },
                      '.ant-table-thead > tr > th': {
                        background: '#1e88e5 !important',
                        color: '#ffffff !important',
                        fontWeight: 600,
                        padding: '12px 16px',
                        borderBottom: 'none',
                        fontSize: '14px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        whiteSpace: 'nowrap',
                        '&::before': {
                          display: 'none !important'
                        },
                        '&.ant-table-cell-scrollbar': {
                          background: '#1e88e5 !important'
                        }
                      },
                      '.ant-table-header-column': {
                        background: '#1e88e5 !important'
                      },
                      '.ant-table-thead > tr > th:not(:last-child)': {
                        borderRight: '1px solid rgba(255, 255, 255, 0.1)'
                      },
                      '.ant-table-tbody > tr > td': {
                        padding: '12px 16px',
                        borderBottom: '1px solid #f0f0f0',
                        fontSize: '13px',
                        whiteSpace: 'nowrap',
                        color: '#595959',
                        transition: 'all 0.3s ease'
                      },
                      '.ant-table-tbody > tr:nth-child(even)': {
                        backgroundColor: '#fafbfc'
                      },
                      '.ant-table-tbody > tr:hover > td': {
                        background: '#e3f2fd !important',
                        cursor: 'pointer'
                      },
                      '.ant-table-cell': {
                        '&:nth-child(1)': { color: '#1e88e5' },
                        '&:nth-child(2)': { color: '#2e7d32' },
                        '&:nth-child(6)': { color: '#2e7d32' },
                        '&:nth-child(8)': { color: '#1e88e5' }
                      }
                    }}
                  />
                </Form>
              </Card>
            </>
          )}

          {selectedMenu === 'requests' && (
            <Card
              style={{
                borderRadius: '12px',
                background: '#fff',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                marginBottom: '24px'
              }}
            >
              <div style={{ padding: '16px 0', borderBottom: '1px solid #f0f0f0', marginBottom: '24px' }}>
                <Space size="middle">
                  <BellOutlined style={{ fontSize: '24px', color: '#4096ff' }} />
                  <Text strong style={{ fontSize: '20px', color: '#262626' }}>Tool Requests</Text>
                </Space>
              </div>

              <ToolRequestsHistory
                requests={requests}
                onFilterChange={setFilteredRequests}
                tools={tools}
              />

              <Table
                columns={requestColumns}
                dataSource={filteredRequests}
                rowKey="id"
                scroll={{ x: 1200, y: 'calc(100vh - 250px)' }}
                pagination={false}
                style={{
                  marginTop: '16px',
                  '.ant-table': {
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  },
                  '.ant-table-thead > tr > th': {
                    background: '#fafafa',
                    fontWeight: 600,
                    position: 'sticky',
                    top: 0,
                    zIndex: 1
                  },
                  '.ant-table-tbody > tr:hover > td': {
                    background: '#f0f7ff'
                  }
                }}
              />
            </Card>
          )}

          {selectedMenu === 'returns' && (
            <Card
              style={{
                borderRadius: '12px',
                background: '#fff',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                marginBottom: '24px'
              }}
            >
              <div style={{ padding: '16px 0', borderBottom: '1px solid #f0f0f0', marginBottom: '24px' }}>
                <Space size="middle">
                  <ToolOutlined style={{ fontSize: '24px', color: '#4096ff' }} />
                  <Text strong style={{ fontSize: '20px', color: '#262626' }}>Tool Returns</Text>
                </Space>
              </div>

              <ToolReturnsHistory
                returns={toolSubmitRequests}
                onFilterChange={setToolSubmitRequests}
                tools={tools}
              />

              <Table
                columns={toolSubmitColumns}
                dataSource={toolSubmitRequests}
                rowKey="id"
                scroll={{ x: 1200, y: 'calc(100vh - 250px)' }}
                pagination={false}
                style={{
                  marginTop: '16px',
                  '.ant-table': {
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  },
                  '.ant-table-thead > tr > th': {
                    background: '#fafafa',
                    fontWeight: 600,
                    position: 'sticky',
                    top: 0,
                    zIndex: 1
                  },
                  '.ant-table-tbody > tr:hover > td': {
                    background: '#f0f7ff'
                  }
                }}
              />
            </Card>
          )}

          {selectedMenu === 'issues' && (
            <Card
              style={{
                borderRadius: '12px',
                background: '#fff',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                marginBottom: '24px'
              }}
            >
              <div style={{ padding: '16px 0', borderBottom: '1px solid #f0f0f0', marginBottom: '24px' }}>
                <Space size="middle">
                  <AlertOutlined style={{ fontSize: '24px', color: '#4096ff' }} />
                  <Text strong style={{ fontSize: '20px', color: '#262626' }}>Officer Accepted Issues</Text>
                </Space>
              </div>

              <IssuesHistory
                issues={officerApprovedIssues}
                onFilterChange={(filtered) => setOfficerApprovedIssues(filtered)}
                tools={tools}
              />

              <Table
                columns={officerAcceptedIssuesColumns}
                dataSource={officerApprovedIssues}
                rowKey="id"
                scroll={{ x: 1200, y: 'calc(100vh - 250px)' }}
                pagination={false}
                style={{
                  marginTop: '16px',
                  '.ant-table': {
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  },
                  '.ant-table-thead > tr > th': {
                    background: '#fafafa',
                    fontWeight: 600,
                    position: 'sticky',
                    top: 0,
                    zIndex: 1
                  },
                  '.ant-table-tbody > tr:hover > td': {
                    background: '#f0f7ff'
                  }
                }}
              />
            </Card>
          )}

          {selectedMenu === 'new-request' && (
            <Card
              style={{
                borderRadius: '12px',
                background: '#fff',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                marginBottom: '24px'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
              }}>
                <Space>
                  <PlusOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                  <Text strong style={{ fontSize: '20px', color: '#262626' }}>New Tools History</Text>
                  <Tag color="blue" style={{ marginLeft: '8px' }}>
                    {pendingToolRequests.filter(req => req.status === 'pending').length} Total Pending
                  </Tag>
                </Space>
                <Space>
                  <DateRangeFilter
                    dateRange={dateRange}
                    onDateRangeChange={handleDateRangeChange}
                  />
                  <DownloadButton
                    dateRange={dateRange}
                    requests={filteredRequests}
                  />
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setToolRequestDrawerVisible(true)}
                    style={{
                      background: '#1890ff',
                      borderColor: '#1890ff'
                    }}
                  >
                    Request New Tool
                  </Button>
                </Space>
              </div>

              <Table
                columns={getTableColumns()}
                dataSource={filteredRequests}
                rowKey="id"
                loading={loading}
                scroll={{ x: 1200, y: 'calc(100vh - 250px)' }}
                pagination={false}
                style={{
                  '.ant-table': {
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  },
                  '.ant-table-thead > tr > th': {
                    background: '#fafafa',
                    fontWeight: 600,
                    position: 'sticky',
                    top: 0,
                    zIndex: 1
                  },
                  '.ant-table-tbody > tr:hover > td': {
                    background: '#f0f7ff'
                  }
                }}
              />

              <ToolRequestDrawer
                visible={toolRequestDrawerVisible}
                onClose={() => setToolRequestDrawerVisible(false)}
                currentUserInfo={currentUserInfo}
                onRequestSubmitted={fetchPendingToolRequests}
                pendingToolRequests={pendingToolRequests}
                setPendingToolRequests={setPendingToolRequests}
              />
            </Card>
          )}

          {selectedMenu === 'history' && (
            <Card
              style={{
                borderRadius: '12px',
                background: '#fff',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                marginBottom: '24px'
              }}
            >
              <div style={{ padding: '16px 0', borderBottom: '1px solid #f0f0f0', marginBottom: '24px' }}>
                <Space size="middle">
                  <HistoryOutlined style={{ fontSize: '24px', color: '#4096ff' }} />
                  <Text strong style={{ fontSize: '20px', color: '#262626' }}>My Action History</Text>
                </Space>
              </div>

              <SupervisorHistory supervisorId={currentUserInfo?.employee_id} />
            </Card>
          )}

          {/* User Details Modal - Keep this as modal since it's for quick view */}
          <Modal
            title={
              <Space size="middle">
                <UserOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                <Text strong style={{ fontSize: '20px' }}>Tool User Details</Text>
              </Space>
            }
            open={userDetailsVisible}
            onCancel={() => setUserDetailsVisible(false)}
            footer={null}
            bodyStyle={{ padding: '24px' }}
            style={{ top: 20 }}
          >
            {selectedUser && (
              <Descriptions
                bordered
                column={1}
                labelStyle={{
                  background: '#fafafa',
                  padding: '12px 24px',
                  fontWeight: 500
                }}
                contentStyle={{
                  padding: '12px 24px'
                }}
              >
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

          {/* Tool Request Drawer - Keep this as drawer since it's for creating new requests */}
          <ToolRequestDrawer
            visible={toolRequestDrawerVisible}
            onClose={() => {
              setToolRequestDrawerVisible(false);
              fetchPendingToolRequests();
            }}
            currentUserInfo={currentUserInfo}
            selectedMenu={selectedMenu}
          />
        </Content>
      </Layout>
    </Layout>
  );
};

// Add EditableCell component
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

  return (
    <td {...restProps}>
      {editing ? (
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
      ) : (
        children
      )}
    </td>
  );
};

export default SupervisorDashboard;