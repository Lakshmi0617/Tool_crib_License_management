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
  Alert,
  Slider,
  InputNumber,
  Menu,
  Empty
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
  BellOutlined,
  NotificationOutlined,
  ReloadOutlined,
  FilterOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined
} from '@ant-design/icons';
import cmtisLogo from '../assets/cmtis.png';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Dashboard.css';
import TotalToolsUsed from './operatorcomponents/Totaltoolsused';
import InUse from './operatorcomponents/inuse';
import ReturnedTools from './operatorcomponents/Returnedtools';
import ReportedIssues from './operatorcomponents/Reportedissues';
import { API_BASE_URL, getAuthHeaders } from '../config';

const { Header, Content, Sider } = Layout;
const { Option } = Select;
const { Title, Text } = Typography;

const EmptySearchState = () => (
  <Empty
    image={<UserOutlined style={{ fontSize: 64, color: '#1e88e5' }} />}
    imageStyle={{ height: 80 }}
    description={
      <Space direction="vertical" align="center">
        <Typography.Title level={4} style={{ margin: 0, color: '#1e88e5' }}>
          Search for Your Tools
        </Typography.Title>
        <Typography.Text type="secondary">
          Enter a search term to find and request the tools you need
        </Typography.Text>
      </Space>
    }
  />
);

const OperatorDashboard = ({ userInfo, onLogout }) => {
  const navigate = useNavigate();
  const [tools, setTools] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isRequestModalVisible, setIsRequestModalVisible] = useState(false);
  const [isIssueModalVisible, setIsIssueModalVisible] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requestForm] = Form.useForm();
  const [issueForm] = Form.useForm();
  const [userDetailsVisible, setUserDetailsVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [toolHistory, setToolHistory] = useState([]);
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);
  const [currentUserInfo, setCurrentUserInfo] = useState(null);
  const [isSubmitModalVisible, setIsSubmitModalVisible] = useState(false);
  const [supervisorResponsesVisible, setSupervisorResponsesVisible] = useState(false);
  const [supervisorResponses, setSupervisorResponses] = useState([]);
  const [slNoRange, setSlNoRange] = useState([0, 100]);
  const [selectedItemDescription, setSelectedItemDescription] = useState(null);
  const [virtualScrollEnabled, setVirtualScrollEnabled] = useState(true);
  const [operatorStats, setOperatorStats] = useState({
    inUse: 0,
    returned: 0,
    issues: 0
  });
  const [toolStats, setToolStats] = useState({
    total: 0,
    available: 0,
    inUse: 0,
    maintenance: 0
  });
  const [categoryDetailsVisible, setCategoryDetailsVisible] = useState(false);
  const [categoryTools, setCategoryTools] = useState([]);
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState('dashboard');
  const [returns, setReturns] = useState([]);
  const [inUseTools, setInUseTools] = useState([]);
  const [totalToolsUsed, setTotalToolsUsed] = useState([]);
  const [issues, setIssues] = useState([]);

  // Add tabItems configuration
  const tabItems = [
    {
      key: 'all',
      label: 'All Tools',
    },

  ];

  // Update fetchData function
  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (!token || !storedUser) {
        message.error('Session expired. Please login again.');
        navigate('/login');
        return;
      }

      let parsedUser;
      try {
        parsedUser = JSON.parse(storedUser);
        if (!parsedUser || !parsedUser.employee_id || parsedUser.role !== 'operator') {
          message.error('Invalid user data. Please login again.');
          navigate('/login');
          return;
        }
      } catch (error) {
        console.error('Error parsing user info:', error);
        message.error('Invalid user data. Please login again.');
        navigate('/login');
        return;
      }

      // First fetch tools
      const toolsResponse = await fetch(`${API_BASE_URL}/api/tools`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (toolsResponse.status === 401) {
        message.error('Session expired. Please login again.');
        navigate('/login');
        return;
      }

      if (!toolsResponse.ok) {
        throw new Error('Failed to fetch tools');
      }

      const toolsData = await toolsResponse.json();

      // Map backend data to frontend structure
      const mappedTools = toolsData.map(tool => ({
        id: tool.Sl_no,
        name: tool.Item_Description || '',
        status: tool.Quantity === 0 ? 'Not Available' : 'available',
        range: tool.Range_in_mm || '',
        identificationCode: tool.Identification_Code || '',
        make: tool.Make || '',
        quantity: tool.Quantity || 0,
        location: tool.Location || '',
        remarks: tool.Remarks || '',
        gauge: tool.Gauge || '',
        currentUser: tool.current_user || null
      }));

      setTools(mappedTools);

      // Then fetch requests for this specific operator
      const requestsResponse = await fetch(`${API_BASE_URL}/api/tool-requests?operator_id=${parsedUser.employee_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (requestsResponse.status === 401) {
        message.error('Session expired. Please login again.');
        navigate('/login');
        return;
      }

      if (!requestsResponse.ok) {
        throw new Error('Failed to fetch requests');
      }

      const requestsData = await requestsResponse.json();

      // Filter requests to show in Supervisor Responses only if approved but not collected
      const supervisorResponses = requestsData
        .filter(req =>
          req.status === 'approved' &&
          (!req.collected || req.collected === 'no')
        )
        .map(req => ({
          ...req,
          tool_details: mappedTools.find(t => t.id === req.tool_sl_no) || {}
        }));

      // Filter requests to show in Total Tools Used only if collected
      const totalToolsUsed = requestsData
        .filter(req =>
          req.status === 'approved' &&
          req.collected === 'yes'
        )
        .map(req => ({
          ...req,
          tool_details: mappedTools.find(t => t.id === req.tool_sl_no) || {}
        }));

      setSupervisorResponses(supervisorResponses);
      setTotalToolsUsed(totalToolsUsed);

      // Update currentUserInfo if needed
      if (!currentUserInfo) {
        setCurrentUserInfo(parsedUser);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      message.error('Failed to fetch data');
    }
  };

  // Update useEffect
  useEffect(() => {
    // Initial fetch only
    fetchData();
  }, []); // Empty dependency array since we want this to run only once on mount

  // Add a manual refresh function
  const handleManualRefresh = async () => {
    if (!currentUserInfo?.employee_id) return;

    try {
      setLoading(true);
      await Promise.all([
        // Fetch tools data
        fetchTools(),
        // Fetch operator's in-use tools
        (async () => {
          const authHeaders = getAuthHeaders();
          const [requestsResponse, returnsResponse, issuesResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/api/tool-requests?operator_id=${currentUserInfo.employee_id}&status=approved&collected=yes&returned=no`, { headers: authHeaders }),
            fetch(`${API_BASE_URL}/api/tool-returns/operator/${currentUserInfo.employee_id}`, { headers: authHeaders }),
            fetch(`${API_BASE_URL}/api/tool-issues/${currentUserInfo.employee_id}`, { headers: authHeaders })
          ]);

          const [requestsData, returnsData, issuesData] = await Promise.all([
            requestsResponse.json(),
            returnsResponse.json(),
            issuesResponse.json()
          ]);

          // Filter data to only include this operator's data
          const filteredRequestsData = requestsData.filter(req => req.operator_id === currentUserInfo.employee_id);
          const filteredReturnsData = returnsData.filter(ret => ret.operator_id === currentUserInfo.employee_id);
          const filteredIssuesData = issuesData.filter(issue => issue.operator_id === currentUserInfo.employee_id);

          // Get IDs of returned tools with their request IDs
          const returnedTools = new Set(
            filteredReturnsData
              .filter(ret => ret.status === 'collected')
              .map(ret => ret.request_id)
          );

          // Get tools that are currently in use (collected but not returned or reported)
          const activeTools = filteredRequestsData
            .filter(req => {
              // First check if request is approved and collected
              const isCollected = req.status === 'approved' && req.collected === 'yes';

              if (!isCollected) return false;

              // Check if tool has been marked as returned in the request
              if (req.returned === 'yes') return false;

              // Check if this request has been returned
              if (returnedTools.has(req.id)) return false;

              // Check if the tool has any active issues
              const hasActiveIssue = filteredIssuesData.some(issue => {
                if (issue.tool_sl_no === req.tool_sl_no && ['approved'].includes(issue.officer_status)) {
                  // Compare timestamps - check both report date and approval date
                  const requestDate = new Date(req.request_date);
                  const issueDate = new Date(issue.report_date);
                  const approvalDate = issue.officer_approval_date ? new Date(issue.officer_approval_date) : null;

                  // Use the later of report_date or officer_approval_date
                  const effectiveIssueDate = approvalDate && approvalDate > issueDate ? approvalDate : issueDate;

                  return requestDate <= effectiveIssueDate;
                }
                return false;
              });

              return !hasActiveIssue;
            });

          setInUseTools(activeTools);
        })(),
        // Fetch operator's tool returns
        (async () => {
          const response = await fetch(`${API_BASE_URL}/api/tool-returns/operator/${currentUserInfo.employee_id}`, { headers: getAuthHeaders() });
          if (!response.ok) throw new Error('Failed to fetch returns');
          const data = await response.json();
          setReturns(data);
        })(),
        // Fetch operator's tool usage history
        (async () => {
          const authHeaders = getAuthHeaders();
          const [requestsResponse, returnsResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/api/tool-requests?operator_id=${currentUserInfo.employee_id}`, { headers: authHeaders }),
            fetch(`${API_BASE_URL}/api/tool-returns/operator/${currentUserInfo.employee_id}`, { headers: authHeaders })
          ]);

          const [requestsData, returnsData] = await Promise.all([
            requestsResponse.json(),
            returnsResponse.json()
          ]);

          // Combine requests and returns to create usage history
          const usageHistory = requestsData
            .filter(req => req.operator_id === currentUserInfo.employee_id && req.status === 'approved')
            .map(req => {
              const returnRecord = returnsData.find(ret => ret.request_id === req.id);
              return {
                ...req,
                return_status: returnRecord?.status || 'pending',
                return_date: returnRecord?.collected_date || null
              };
            });

          setTotalToolsUsed(usageHistory);
        })(),
        // Fetch operator's reported issues
        (async () => {
          const response = await fetch(`${API_BASE_URL}/api/tool-issues/${currentUserInfo.employee_id}`, { headers: getAuthHeaders() });
          if (!response.ok) throw new Error('Failed to fetch issues');
          const data = await response.json();
          setIssues(data);
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

  // Fetch tools data from backend
  const fetchTools = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/tools`, { headers: getAuthHeaders() });
      if (!response.ok) {
        throw new Error('Failed to fetch tools');
      }
      const data = await response.json();

      // Map backend data to frontend structure
      const mappedTools = data.map(tool => ({
        id: tool.Sl_no,
        name: tool.Item_Description || '',
        status: tool.Quantity === 0 ? 'Not Available' : (tool.status || 'available'),
        range: tool.Range_in_mm || '',
        identificationCode: tool.Identification_Code || '',
        make: tool.Make || '',
        quantity: tool.Quantity || 0,
        location: tool.Location || '',
        remarks: tool.Remarks || '',
        gauge: tool.Gauge || '',
        currentUser: tool.current_user || null
      }));

      // Calculate total tools (sum of Item Description × Quantity)
      const totalTools = mappedTools.reduce((acc, tool) => acc + (tool.quantity || 0), 0);

      // Calculate available tools
      const availableTools = mappedTools.reduce((acc, tool) => {
        if (tool.status === 'available') {
          return acc + (tool.quantity || 0);
        }
        return acc;
      }, 0);

      setTools(mappedTools);
      setToolStats({
        total: totalTools,
        available: availableTools,
        inUse: mappedTools.filter(t => t.status === 'in_use').length,
        maintenance: mappedTools.filter(t => t.status === 'maintenance').length
      });
    } catch (error) {
      console.error('Error fetching tools:', error);
      message.error('Failed to fetch tools data');
    } finally {
      setLoading(false);
    }
  };

  // Add useEffect to fetch data on component mount and when currentUserInfo changes
  useEffect(() => {
    if (currentUserInfo?.employee_id) {
      fetchTools();
    }
  }, [currentUserInfo]);

  // Add refresh button handler
  const handleRefresh = () => {
    fetchTools();
  };

  // Calculate scroll height
  const [tableHeight, setTableHeight] = useState(500);

  useEffect(() => {
    const updateTableHeight = () => {
      const viewportHeight = window.innerHeight;
      const tableOffset = 450; // Approximate offset for headers and other elements
      setTableHeight(viewportHeight - tableOffset);
    };

    updateTableHeight();
    window.addEventListener('resize', updateTableHeight);

    return () => window.removeEventListener('resize', updateTableHeight);
  }, []);

  const handleToolRequest = (tool) => {
    setSelectedTool(tool);
    setIsRequestModalVisible(true);
  };

  const checkExistingIssues = async (toolSlNo) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tool-issues/tool/${toolSlNo}`, { headers: getAuthHeaders() });
      if (!response.ok) {
        throw new Error('Failed to check existing issues');
      }
      const issues = await response.json();
      return issues.some(issue => issue.status === 'pending');
    } catch (error) {
      console.error('Error checking existing issues:', error);
      return false;
    }
  };

  const handleIssueReport = async (values) => {
    try {
      if (!selectedTool) {
        throw new Error('No tool selected');
      }

      setIsSubmittingIssue(true);

      // Log the selected tool data for debugging
      console.log('Selected Tool Data:', selectedTool);
      console.log('Form Values:', values);

      if (!selectedTool.unique_request_id) {
        console.error('Missing unique_request_id in selectedTool:', selectedTool);
        throw new Error('Missing unique request ID for the tool');
      }

      // Check for existing pending issues
      const hasExistingIssue = await checkExistingIssues(selectedTool.tool_sl_no);
      if (hasExistingIssue) {
        message.error('There is already a pending issue for this tool. Please wait for the current issue to be resolved.');
        return;
      }

      // Prepare the request payload
      const payload = {
        tool_sl_no: selectedTool.tool_sl_no,
        operator_id: currentUserInfo.employee_id,
        operator_name: currentUserInfo.employee_name,
        department: currentUserInfo.department,
        contact: currentUserInfo.contact,
        severity: values.severity,
        category: values.category,
        description: values.description,
        purpose: selectedTool.purpose || '',
        project_details: selectedTool.project_details || '',
        unique_request_id: selectedTool.unique_request_id
      };

      // Log the request payload for debugging
      console.log('Issue Report Payload:', payload);

      const response = await fetch(`${API_BASE_URL}/api/tool-issues`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      // Log the response for debugging
      console.log('Server Response:', data);

      if (!response.ok) {
        if (data.detail) {
          message.error(data.detail);
        } else if (typeof data === 'object') {
          const errors = Object.values(data).flat().join(', ');
          throw new Error(errors);
        } else {
          throw new Error('Failed to report issue');
        }
        return;
      }

      message.success('Issue reported successfully');
      setIsIssueModalVisible(false);
      issueForm.resetFields();
      setSelectedTool(null);  // Clear the selected tool

      // Refresh data
      await Promise.all([
        fetchTools(),
        handleManualRefresh() // Add this to refresh all data
      ]);
    } catch (error) {
      console.error('Error reporting issue:', error);
      message.error(error.message || 'Failed to report issue');
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  const showUserDetails = (user) => {
    setSelectedUser(user);
    setUserDetailsVisible(true);
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
  };

  // Update the getStatusBadge function
  const getStatusBadge = (status) => {
    const statusConfig = {
      available: { status: 'success', text: 'Available', icon: <CheckCircleOutlined /> },
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

  // Update the filteredTools logic to be more effective
  const filteredTools = useMemo(() => {
    if (!tools.length) return [];

    // If no search query, return empty array
    if (!searchQuery) {
      return [];
    }

    const searchLower = searchQuery.toLowerCase().trim();

    return tools.filter(tool => {
      // Enhanced search matching with more precise field matching
      const searchableFields = [
        { value: tool.name, weight: 3 }, // Higher weight for name matches
        { value: tool.range, weight: 2 }, // Medium weight for range
        { value: tool.identificationCode, weight: 2 }, // Medium weight for ID code
        { value: tool.make, weight: 1 }, // Lower weight for make
        { value: tool.location, weight: 1 } // Lower weight for location
      ];

      // Check if any field contains the search term
      const matches = searchableFields.some(field =>
        field.value && field.value.toLowerCase().includes(searchLower)
      );

      // Status filter
      const matchesStatus = activeTab === 'all' || tool.status === activeTab;

      return matches && matchesStatus;
    });
  }, [tools, searchQuery, activeTab]);

  // Define the columns for the main table
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
      render: (name) => (
        <Button
          type="link"
          onClick={() => setSelectedItemDescription(name)}
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
          {name}
        </Button>
      ),
    },
    {
      title: 'Range in mm',
      dataIndex: 'range',
      key: 'range',
      width: 100,
    },
    {
      title: 'Identification Code',
      dataIndex: 'identificationCode',
      key: 'identificationCode',
      width: 130,
    },
    {
      title: 'Make',
      dataIndex: 'make',
      key: 'make',
      width: 100,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Text style={{
          color: status === 'Not Available' ? '#ff4d4f' : '#52c41a',
          fontWeight: 500
        }}>
          {status}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        record.status === 'available' && record.quantity > 0 && (
          <Button
            type="primary"
            onClick={() => handleToolRequest(record)}
            size="small"
          >
            Request
          </Button>
        )
      ),
    }
  ];

  // Function to handle KPI card clicks - simplified to only handle non-total cards
  const handleCardClick = async (category) => {
    if (category === 'total') return; // Now handled by TotalToolsUsed component

    if (!currentUserInfo) return;

    try {
      let data = [];
      switch (category) {
        case 'in_use': {
          const authHeaders = getAuthHeaders();
          const [requestsResponse, returnsResponse, issuesResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/api/tool-requests?operator_id=${currentUserInfo.employee_id}`, { headers: authHeaders }),
            fetch(`${API_BASE_URL}/api/tool-returns/operator/${currentUserInfo.employee_id}`, { headers: authHeaders }),
            fetch(`${API_BASE_URL}/api/tool-issues/${currentUserInfo.employee_id}`, { headers: authHeaders })
          ]);

          const [requestsData, returnsData, issuesData] = await Promise.all([
            requestsResponse.json(),
            returnsResponse.json(),
            issuesResponse.json()
          ]);

          // Get tools with pending or approved issues
          const toolsWithIssues = new Set(
            issuesData
              .filter(issue => ['pending', 'supervisor_approved', 'officer_approved'].includes(issue.status))
              .map(issue => issue.tool_sl_no)
          );

          // Filter out tools that have issues
          data = requestsData
            .filter(req => req.status === 'approved' && !toolsWithIssues.has(req.tool_sl_no))
            .map(tool => ({
              ...tool,
              showActions: true
            }));
          break;
        }
        case 'returned':
          const returnedResponse = await fetch(`${API_BASE_URL}/api/tool-returns/operator/${currentUserInfo.employee_id}`, { headers: getAuthHeaders() });
          if (!returnedResponse.ok) throw new Error('Failed to fetch returned data');
          data = await returnedResponse.json();
          break;
        case 'issues':
          const issuesResponse = await fetch(`${API_BASE_URL}/api/tool-issues/${currentUserInfo.employee_id}`, { headers: getAuthHeaders() });
          if (!issuesResponse.ok) throw new Error('Failed to fetch issues data');
          data = await issuesResponse.json();
          break;
      }

      setSelectedCategory(category);
      setCategoryTools(data);
      setCategoryDetailsVisible(true);
    } catch (error) {
      console.error('Error fetching category details:', error);
      message.error('Failed to fetch details');
      setCategoryTools([]);
    }
  };

  // Add these functions before the handleCardClick function
  const handleSubmitTool = async (values) => {
    try {
      if (!selectedTool?.tool_sl_no || !currentUserInfo) {
        message.error('Missing tool or user information');
        return;
      }

      // Create the tool return record
      const returnResponse = await fetch(`${API_BASE_URL}/api/tool-returns`, {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          tool_sl_no: selectedTool.tool_sl_no,
          operator_id: currentUserInfo.employee_id,
          operator_name: currentUserInfo.employee_name,
          department: currentUserInfo.department,
          contact: currentUserInfo.contact,
          condition_on_return: values.condition,
          remarks: values.remarks,
          purpose: selectedTool.purpose || '',
          project_details: selectedTool.project_details || '',
          unique_request_id: selectedTool.unique_request_id, // Add this line
          status: 'pending'
        }),
      });

      if (!returnResponse.ok) {
        const errorData = await returnResponse.json();
        throw new Error(errorData.detail || 'Failed to submit tool return');
      }

      message.success('Tool submitted successfully');
      setIsSubmitModalVisible(false);
      setSelectedTool(null);

      // Refresh all relevant data
      await Promise.all([
        fetchTools(),
        // Refresh the in-use tools data
        (async () => {
          if (currentUserInfo?.employee_id) {
            const authHeaders = getAuthHeaders();
            const [requestsResponse, returnsResponse, issuesResponse] = await Promise.all([
              fetch(`${API_BASE_URL}/api/tool-requests?operator_id=${currentUserInfo.employee_id}`, { headers: authHeaders }),
              fetch(`${API_BASE_URL}/api/tool-returns/operator/${currentUserInfo.employee_id}`, { headers: authHeaders }),
              fetch(`${API_BASE_URL}/api/tool-issues/${currentUserInfo.employee_id}`, { headers: authHeaders })
            ]);

            const [requestsData, returnsData, issuesData] = await Promise.all([
              requestsResponse.json(),
              returnsResponse.json(),
              issuesResponse.json()
            ]);

            // Filter and process data similar to handleManualRefresh
            const filteredRequestsData = requestsData.filter(req => req.operator_id === currentUserInfo.employee_id);
            const filteredReturnsData = returnsData.filter(ret => ret.operator_id === currentUserInfo.employee_id);
            const filteredIssuesData = issuesData.filter(issue => issue.operator_id === currentUserInfo.employee_id);

            const returnedTools = new Set(
              filteredReturnsData
                .filter(ret => ret.status === 'collected')
                .map(ret => ret.request_id)
            );

            const activeTools = filteredRequestsData
              .filter(req => {
                const isCollected = req.status === 'approved' && req.collected === 'yes';
                if (!isCollected) return false;
                if (req.returned === 'yes') return false;
                if (returnedTools.has(req.id)) return false;

                const hasActiveIssue = filteredIssuesData.some(issue => {
                  if (issue.tool_sl_no === req.tool_sl_no && ['approved'].includes(issue.officer_status)) {
                    const requestDate = new Date(req.request_date);
                    const issueDate = new Date(issue.report_date);
                    const approvalDate = issue.officer_approval_date ? new Date(issue.officer_approval_date) : null;
                    const effectiveIssueDate = approvalDate && approvalDate > issueDate ? approvalDate : issueDate;
                    return requestDate <= effectiveIssueDate;
                  }
                  return false;
                });

                return !hasActiveIssue;
              });

            setInUseTools(activeTools);
          }
        })()
      ]);
    } catch (error) {
      console.error('Error submitting tool:', error);
      message.error(error.message || 'Failed to submit tool');
    }
  };

  // Update the logout handler
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (onLogout) onLogout();
    navigate('/login');
  };

  // Add empty state components
  const EmptyState = ({ category }) => (
    <div style={{ textAlign: 'center', padding: '24px' }}>
      <Space direction="vertical" size="large">
        {category === 'in_use' && <ClockCircleOutlined style={{ fontSize: '32px', color: '#fa8c16' }} />}
        {category === 'returned' && <CheckCircleOutlined style={{ fontSize: '32px', color: '#52c41a' }} />}
        {category === 'issues' && <WarningOutlined style={{ fontSize: '32px', color: '#f5222d' }} />}
        {category === 'total' && <DashboardOutlined style={{ fontSize: '32px', color: '#1890ff' }} />}
        <Text type="secondary" style={{ fontSize: '16px' }}>
          {category === 'in_use' && 'No tools currently in use'}
          {category === 'returned' && 'No tools have been returned yet'}
          {category === 'issues' && 'No issues reported'}
          {category === 'total' && 'No tool usage history'}
        </Text>
      </Space>
    </div>
  );

  // Update handleConfirmSupervisorResponse function
  const handleConfirmSupervisorResponse = async (response) => {
    try {
      // Only handle approved requests
      if (response.status !== 'approved') {
        message.info('This request was rejected by the supervisor');
        return;
      }

      const confirmResponse = await fetch(`${API_BASE_URL}/api/tool-requests/${response.id}/collect`, {
        method: 'PUT',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        })
      });

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json();
        throw new Error(errorData.detail || 'Failed to collect tool');
      }

      message.success('Tool collected successfully');

      // Remove from supervisor responses and add to total tools used
      setSupervisorResponses(prev => prev.filter(r => r.id !== response.id));
      setTotalToolsUsed(prev => [...prev, { ...response, collected: 'yes' }]);

      // Refresh all data
      await fetchData();
    } catch (error) {
      console.error('Error collecting tool:', error);
      message.error('Failed to collect tool');
    }
  };

  // Update the supervisorResponseColumns
  const supervisorResponseColumns = [
    {
      title: 'Tool Details',
      key: 'toolDetails',
      width: 250,
      render: (_, record) => {
        if (record.operator_id !== currentUserInfo?.employee_id) {
          return null;
        }
        const tool = tools.find(t => t.id === record.tool_sl_no);
        return (
          <Space direction="vertical" size={0}>
            <Text strong>{tool?.name || 'Unknown Tool'}</Text>
            <Text type="secondary">Serial No: {record.tool_sl_no}</Text>
            <Text type="secondary">Range: {tool?.range || 'N/A'}</Text>
            <Text type="secondary">ID Code: {tool?.identificationCode || 'N/A'}</Text>
          </Space>
        );
      },
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
      width: 200,
    },
    {
      title: 'Request Date',
      dataIndex: 'request_date',
      key: 'request_date',
      width: 150,
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: 'Supervisor Details',
      key: 'supervisor',
      width: 180,
      render: (_, record) => (
        record.supervisor_name ? (
          <Space direction="vertical" size={0}>
            <Text strong>{record.supervisor_name}</Text>
            <Text type="secondary">ID: {record.supervisor_id}</Text>
          </Space>
        ) : (
          <Text type="secondary">Pending Response</Text>
        )
      ),
    },
    {
      title: 'Response Date',
      key: 'response_date',
      width: 150,
      render: (_, record) => (
        record.response_date ? new Date(record.response_date).toLocaleString() : 'N/A'
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_, record) => {
        const statusColors = {
          approved: 'success',
          rejected: 'error',
          pending: 'warning'
        };
        return <Tag color={statusColors[record.status]}>{record.status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        record.status === 'approved' ? (
          record.collected === 'yes' ? (
            <Tag color="success">Collected</Tag>
          ) : (
            <Button
              type="primary"
              onClick={() => handleConfirmSupervisorResponse(record)}
            >
              Collect
            </Button>
          )
        ) : (
          <Tag color={record.status === 'rejected' ? 'error' : 'warning'}>
            {record.status.toUpperCase()}
          </Tag>
        )
      ),
    },
  ];

  // Update the category details modal columns
  const categoryColumns = selectedCategory === 'issues'
    ? [
      {
        title: 'Tool Details',
        key: 'toolDetails',
        width: 250,
        render: (_, record) => {
          const tool = tools.find(t => t.id === record.tool_sl_no);
          return (
            <Space direction="vertical" size={0}>
              <Text strong>{tool?.name || 'Unknown Tool'}</Text>
              <Text type="secondary">Serial No: {record.tool_sl_no}</Text>
              <Text type="secondary">Range: {tool?.range || 'N/A'}</Text>
              <Text type="secondary">ID Code: {tool?.identificationCode || 'N/A'}</Text>
            </Space>
          );
        },
      },
      {
        title: 'Purpose',
        dataIndex: 'purpose',
        key: 'purpose',
        width: 150,
        render: (purpose) => purpose || 'N/A'
      },
      {
        title: 'Project Details',
        dataIndex: 'project_details',
        key: 'project_details',
        width: 150,
        render: (project_details) => project_details || 'N/A'
      },
      {
        title: 'Issue Severity ',
        dataIndex: 'severity',
        key: 'severity',
        width: 120,
        render: (severity) => (
          <Tag color={
            (severity || '').toLowerCase() === 'high' ? 'red' :
              (severity || '').toLowerCase() === 'medium' ? 'orange' :
                'green'
          }>
            {(severity || 'N/A').toUpperCase()}
          </Tag>
        ),
      },
      {
        title: 'Issue Category',
        dataIndex: 'category',
        key: 'category',
        width: 120,
        render: (category) => (
          <Tag color={
            (category || '').toLowerCase() === 'breakage' ? 'red' :
              (category || '').toLowerCase() === 'calibration' ? 'blue' :
                'gold'
          }>
            {(category || 'N/A').toUpperCase()}
          </Tag>
        ),
      },
      {
        title: 'Issue Description',
        dataIndex: 'description',
        key: 'description',
        width: 200,
      },
      {
        title: 'Report Date',
        dataIndex: 'report_date',
        key: 'report_date',
        width: 150,
        render: (date) => date ? new Date(date).toLocaleString() : 'N/A',
      },
    ]
    : selectedCategory === 'returned'
      ? [
        {
          title: 'Tool Details',
          key: 'toolDetails',
          width: 250,
          render: (_, record) => {
            const tool = tools.find(t => t.id === record.tool_sl_no);
            return (
              <Space direction="vertical" size={0}>
                <Text strong>{tool?.name || 'Unknown Tool'}</Text>
                <Text type="secondary">Serial No: {record.tool_sl_no}</Text>
                <Text type="secondary">Range: {tool?.range || 'N/A'}</Text>
                <Text type="secondary">ID Code: {tool?.identificationCode || 'N/A'}</Text>
              </Space>
            );
          },
        },
        {
          title: 'Request Date',
          dataIndex: 'request_date',
          key: 'request_date',
          render: (date) => date ? new Date(date).toLocaleString() : 'N/A',
        },
        {
          title: 'Purpose',
          dataIndex: 'purpose',
          key: 'purpose',
          render: (purpose) => purpose || 'N/A',
        },
        {
          title: 'Project',
          dataIndex: 'project_details',
          key: 'project_details',
          render: (project_details) => project_details || 'N/A',
        },
        {
          title: 'Condition',
          dataIndex: 'condition_on_return',
          key: 'condition',
          render: (condition) => condition || 'N/A',
        },
        {
          title: 'Remarks',
          dataIndex: 'remarks',
          key: 'remarks',
          render: (remarks) => remarks || 'N/A',
        },
        {
          title: 'Status',
          key: 'status',
          render: (_, record) => (
            <Tag color={record.status === 'collected' ? 'success' : 'processing'}>
              {(record.status || 'PENDING').toUpperCase()}
            </Tag>
          ),
        },
        {
          title: 'Supervisor',
          key: 'supervisor',
          render: (_, record) => (
            record.supervisor_name ? (
              <Space direction="vertical" size={0}>
                <Text>{record.supervisor_name}</Text>
                <Text type="secondary">ID: {record.supervisor_id || 'N/A'}</Text>
              </Space>
            ) : (
              <Text type="secondary">Pending</Text>
            )
          ),
        },
        {
          title: 'Collected Date',
          key: 'collected_date',
          render: (_, record) => (
            record.collected_date ?
              new Date(record.collected_date).toLocaleString() :
              'Not collected'
          ),
        }
      ]
      : [
        {
          title: 'Tool ID',
          dataIndex: 'tool_sl_no',
          key: 'tool_sl_no',
        },
        {
          title: 'Start Date',
          dataIndex: 'start_date',
          key: 'start_date',
          render: (date) => date ? new Date(date).toLocaleString() : 'N/A',
        },
        {
          title: 'Purpose',
          dataIndex: 'purpose',
          key: 'purpose',
          render: (purpose) => purpose || 'N/A',
        },
        {
          title: 'Status',
          dataIndex: 'status',
          key: 'status',
          render: (status) => (
            <Tag color={status === 'in_use' ? 'processing' : 'success'}>
              {(status || 'N/A').toUpperCase()}
            </Tag>
          ),
        },
        // Only show actions for in-use tools
        ...(selectedCategory === 'in_use' ? [{
          title: 'Actions',
          key: 'actions',
          render: (_, record) => (
            <Space>
              <Button
                type="primary"
                size="small"
                onClick={() => {
                  const tool = tools.find(t => t.id === record.tool_sl_no);
                  setSelectedTool({
                    tool_sl_no: record.tool_sl_no,
                    name: tool?.name || record.name || 'Unknown Tool',
                    purpose: record.purpose,
                    project_details: record.project_details
                  });
                  setIsSubmitModalVisible(true);
                }}
              >
                Return Tool
              </Button>
              <Button
                type="primary"
                danger
                size="small"
                loading={isSubmittingIssue}
                onClick={async () => {
                  try {
                    // Check for existing issues first
                    const hasExistingIssue = await checkExistingIssues(record.tool_sl_no);
                    if (hasExistingIssue) {
                      message.error('There is already a pending issue for this tool. Please wait for the current issue to be resolved.');
                      return;
                    }

                    // Get the tool usage data
                    const toolUsage = record;
                    // Get the tool details
                    const tool = tools.find(t => t.id === record.tool_sl_no);

                    setSelectedTool({
                      tool_sl_no: record.tool_sl_no,
                      name: tool?.name || 'Unknown Tool',
                      purpose: record.purpose,
                      project_details: record.project_details
                    });

                    setIsIssueModalVisible(true);
                  } catch (error) {
                    console.error('Error preparing issue report:', error);
                    message.error('Failed to prepare issue report');
                  }
                }}
              >
                Report Issue
              </Button>
            </Space>
          ),
        }] : [])
      ];

  // Add this function to handle issue reporting from InUse component
  const handleIssueReportClick = (toolData) => {
    console.log('Received tool data for issue report:', toolData);
    setSelectedTool(toolData); // Store the complete tool data including unique_request_id
    setIsIssueModalVisible(true);
  };

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
              key: 'supervisor_responses',
              icon: <BellOutlined style={{ color: '#ffffff', fontSize: '18px' }} />,
              label: (
                <Badge count={supervisorResponses.filter(r =>
                  r.status === 'approved' &&
                  r.collected !== 'yes' &&
                  r.operator_id === currentUserInfo?.employee_id
                ).length} size="small">
                  <span style={{ color: '#ffffff', fontWeight: selectedMenu === 'supervisor_responses' ? '600' : '400' }}>Supervisor Responses</span>
                </Badge>
              ),
              style: {
                margin: '4px 12px',
                borderRadius: '8px',
                backgroundColor: selectedMenu === 'supervisor_responses' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                transition: 'all 0.3s ease',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  transform: 'translateX(5px)'
                },
              },
              onClick: () => {
                setSelectedMenu('supervisor_responses');
                setSupervisorResponsesVisible(true);
              }
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
            <Title level={3} style={{ margin: 0, color: '#1e88e5' }}>Tool Crib Operator Dashboard</Title>
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
                {currentUserInfo?.employee_name || 'Operator'}
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
          {/* Statistics Cards */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <TotalToolsUsed
                currentUserInfo={currentUserInfo}
                tools={tools}
                onCardClick={handleCardClick}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <InUse
                currentUserInfo={currentUserInfo}
                tools={tools}
                onToolReturn={(record) => {
                  setSelectedTool(record);
                  setIsSubmitModalVisible(true);
                }}
                onIssueReport={handleIssueReportClick}  // Use the new handler
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <ReturnedTools
                currentUserInfo={currentUserInfo}
                onCardClick={handleCardClick}
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <ReportedIssues
                currentUserInfo={currentUserInfo}
                onCardClick={handleCardClick}
              />
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
                  placeholder="Search by tool name, range, ID code, make..."
                  allowClear
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: 400,
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
              </Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleManualRefresh}
                loading={loading}
                style={{
                  background: '#1e88e5',
                  borderColor: '#1e88e5',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontFamily: 'Segoe UI, Roboto, sans-serif',
                  fontSize: '14px'
                }}
              >
                Refresh
              </Button>
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

            <Table
              columns={toolColumns}
              dataSource={filteredTools}
              rowKey="id"
              loading={loading}
              scroll={{ x: 1200, y: 'calc(100vh - 480px)' }}
              pagination={false}
              virtual={virtualScrollEnabled}
              locale={{
                emptyText: <EmptySearchState />
              }}
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
          </Card>

          {/* User Details Modal */}
          <Modal
            title="User Details"
            open={userDetailsVisible}
            onCancel={() => setUserDetailsVisible(false)}
            footer={null}
            width={600}
          >
            {selectedUser && (
              <Card>
                <Descriptions bordered column={1}>
                  <Descriptions.Item label="Name">{selectedUser.name}</Descriptions.Item>
                  <Descriptions.Item label="Employee ID">{selectedUser.id}</Descriptions.Item>
                  <Descriptions.Item label="Department">{selectedUser.department}</Descriptions.Item>
                  <Descriptions.Item label="Contact">{selectedUser.contact}</Descriptions.Item>
                  <Descriptions.Item label="Purpose">{selectedUser.purpose}</Descriptions.Item>
                  <Descriptions.Item label="Taken Time">{selectedUser.takenTime}</Descriptions.Item>
                  <Descriptions.Item label="Expected Return">{selectedUser.expectedReturn}</Descriptions.Item>
                </Descriptions>
              </Card>
            )}
          </Modal>

          {/* Tool Request Modal */}
          <Modal
            title={`Request Tool: ${selectedTool?.name}`}
            open={isRequestModalVisible}
            onCancel={() => {
              setIsRequestModalVisible(false);
              requestForm.resetFields();
            }}
            footer={null}
            width={600}
          >
            <Form
              form={requestForm}
              onFinish={async (values) => {
                try {
                  const payload = {
                    tool_sl_no: selectedTool.id,
                    operator_id: currentUserInfo.employee_id,
                    operator_name: currentUserInfo.employee_name,
                    department: currentUserInfo.department,
                    contact: currentUserInfo.contact,
                    purpose: values.purpose,
                    project_details: values.project_details
                  };

                  const response = await fetch(`${API_BASE_URL}/api/tool-requests`, {
                    method: 'POST',
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify(payload)
                  });

                  if (!response.ok) {
                    throw new Error('Failed to submit request');
                  }

                  message.success('Tool request submitted successfully');
                  setIsRequestModalVisible(false);
                  requestForm.resetFields();
                  fetchTools();
                } catch (error) {
                  console.error('Error submitting request:', error);
                  message.error('Failed to submit request');
                }
              }}
              layout="vertical"
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Name">
                    <Input value={currentUserInfo?.employee_name} disabled />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Employee ID">
                    <Input value={currentUserInfo?.employee_id} disabled />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Department">
                <Input value={currentUserInfo?.department} disabled />
              </Form.Item>

              <Form.Item label="Contact Number">
                <Input value={currentUserInfo?.contact} disabled />
              </Form.Item>

              <Form.Item
                name="purpose"
                label="Purpose of Use"
                rules={[{ required: true, message: 'Please describe the purpose' }]}
              >
                <Input.TextArea rows={4} placeholder="Enter the purpose of using this tool" />
              </Form.Item>

              <Form.Item
                name="project_details"
                label="Project Details"
                rules={[{ required: true, message: 'Please enter project details' }]}
              >
                <Input.TextArea rows={4} placeholder="Enter project details including timeline and requirements" />
              </Form.Item>

              <Form.Item>
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button onClick={() => {
                    setIsRequestModalVisible(false);
                    requestForm.resetFields();
                  }}>
                    Cancel
                  </Button>
                  <Button type="primary" htmlType="submit">
                    Submit Request
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Modal>

          {/* Issue Report Modal */}
          <Modal
            title={`Report Issue: ${selectedTool?.name}`}
            open={isIssueModalVisible}
            onCancel={() => {
              setIsIssueModalVisible(false);
              issueForm.resetFields();
              setSelectedTool(null);
            }}
            footer={null}
            width={600}
          >
            <Form
              form={issueForm}
              onFinish={handleIssueReport}
              layout="vertical"
            >
              <Form.Item
                name="severity"
                label="Issue Severity"
                rules={[{ required: true, message: 'Please select severity' }]}
                initialValue="low"
              >
                <Select>
                  <Option value="low">
                    <Badge status="success" text="Low - Minor issue" />
                  </Option>
                  <Option value="medium">
                    <Badge status="warning" text="Medium - Affects performance" />
                  </Option>
                  <Option value="high">
                    <Badge status="error" text="High - Unsafe/Unusable" />
                  </Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="category"
                label="Issue Category"
                rules={[{ required: true, message: 'Please select category' }]}
              >
                <Select>
                  <Option value="breakage">Breakage Required</Option>
                  <Option value="calibration">Calibration Required</Option>
                  <Option value="other">Other</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="description"
                label="Issue Description"
                rules={[{ required: true, message: 'Please describe the issue' }]}
              >
                <Input.TextArea
                  rows={4}
                  placeholder="Please provide detailed description of the issue..."
                />
              </Form.Item>

              {/* Add a hidden display of the unique_request_id for verification */}
              {selectedTool?.unique_request_id && (
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary">Request ID: {selectedTool.unique_request_id}</Text>
                </div>
              )}

              <Form.Item>
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button onClick={() => {
                    setIsIssueModalVisible(false);
                    issueForm.resetFields();
                    setSelectedTool(null);
                  }}>
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    danger
                    htmlType="submit"
                    loading={isSubmittingIssue}
                    disabled={!selectedTool?.unique_request_id}
                  >
                    Submit Issue Report
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Modal>

          {/* Submit Tool Modal */}
          <Modal
            title={
              <Space>
                <ToolOutlined />
                <span>Submit Tool: {selectedTool?.name || 'Unknown Tool'}</span>
              </Space>
            }
            open={isSubmitModalVisible}
            onCancel={() => {
              setIsSubmitModalVisible(false);
              setSelectedTool(null);
            }}
            footer={null}
            width={600}
          >
            <Form
              form={Form.useForm()[0]}
              onFinish={handleSubmitTool}
              layout="vertical"
              initialValues={{
                submittedBy: currentUserInfo?.employee_name || '',
                employeeId: currentUserInfo?.employee_id || '',
                department: currentUserInfo?.department || '',
                contact: currentUserInfo?.contact || '',
              }}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="submittedBy"
                    label="Submitted By"
                  >
                    <Input disabled />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="employeeId"
                    label="Employee ID"
                  >
                    <Input disabled />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="condition"
                label="Tool Condition"
                rules={[{ required: true, message: 'Please select tool condition' }]}
              >
                <Select>
                  <Option value="excellent">Excellent</Option>
                  <Option value="good">Good</Option>
                  <Option value="poor">Poor - Needs Maintenance</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="remarks"
                label="Remarks"
                rules={[{ required: true, message: 'Please provide remarks' }]}
              >
                <Input.TextArea
                  rows={4}
                  placeholder="Please provide any remarks about the tool's condition or usage..."
                />
              </Form.Item>

              <Form.Item>
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button onClick={() => {
                    setIsSubmitModalVisible(false);
                    setSelectedTool(null);
                  }}>
                    Cancel
                  </Button>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    Submit Tool
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Modal>

          {/* Category Details Modal */}
          <Modal
            title={
              <Space>
                {selectedCategory === 'in_use' && <ClockCircleOutlined style={{ color: '#fa8c16' }} />}
                {selectedCategory === 'returned' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                {selectedCategory === 'issues' && <WarningOutlined style={{ color: '#f5222d' }} />}
                {selectedCategory === 'total' && <DashboardOutlined style={{ color: '#1890ff' }} />}
                <span>
                  {selectedCategory === 'in_use' && 'Currently In Use Tools'}
                  {selectedCategory === 'returned' && 'Returned Tools'}
                  {selectedCategory === 'issues' && 'Reported Issues'}
                  {selectedCategory === 'total' && 'All Tools Usage History'}
                </span>
              </Space>
            }
            open={categoryDetailsVisible}
            onCancel={() => setCategoryDetailsVisible(false)}
            width={1000}
            footer={null}
          >
            <Table
              dataSource={categoryTools}
              rowKey={record => `${record.tool_sl_no}-${record.id}`}
              columns={categoryColumns}
              loading={loading}
              pagination={{
                pageSize: 10,
                showSizeChanger: false,
                hideOnSinglePage: true
              }}
              locale={{
                emptyText: <EmptyState category={selectedCategory} />
              }}
            />
          </Modal>

          {/* Supervisor Responses Modal */}
          <Modal
            title={
              <Space>
                <BellOutlined />
                <span>Supervisor Responses</span>
              </Space>
            }
            open={supervisorResponsesVisible}
            onCancel={() => setSupervisorResponsesVisible(false)}
            width={1000}
            footer={null}
          >
            <Table
              columns={supervisorResponseColumns}
              dataSource={supervisorResponses.filter(response =>
                response.operator_id === currentUserInfo?.employee_id
              )}
              rowKey="id"
              pagination={{
                pageSize: 5,
                showTotal: (total) => `Total ${total} responses`
              }}
              scroll={{ x: 1000 }}
            />
          </Modal>
        </Content>
      </Layout>
    </Layout>
  );
};

export default OperatorDashboard;