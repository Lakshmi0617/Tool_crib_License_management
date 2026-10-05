import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Form,
  Input,
  Button,
  InputNumber,
  notification,
  Typography,
  Space,
  Tag,
  Table,
  Select,
  DatePicker,
  Modal,
  Tooltip
} from 'antd';
import { getAuthHeaders } from '../../config';
import {
  ToolOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  ProjectOutlined,
  NumberOutlined,
  PlusOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

// Export the getStatusTag function to be used in SupervisorDashboard
export const getStatusTag = (status) => {
  const statusConfig = {
    pending: { color: 'warning', icon: <ClockCircleOutlined />, text: 'Pending' },
    approved: { color: 'success', icon: <CheckCircleOutlined />, text: 'Approved' },
    rejected: { color: 'error', icon: <CloseCircleOutlined />, text: 'Rejected' }
  };
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <Tag color={config.color} icon={config.icon}>
      {config.text}
    </Tag>
  );
};

// Export the table columns to be used in SupervisorDashboard
export const getTableColumns = () => [
  {
    title: 'Tool Details',
    key: 'tool',
    width: 300,
    render: (_, record) => (
      <Space direction="vertical" size={0}>
        <Text strong>{record.Item_Description}</Text>
        <Text type="secondary">Range: {record.Range_in_mm}</Text>
        <Text type="secondary">ID Code: {record.Identification_Code}</Text>
        <Text type="secondary">Make: {record.Make}</Text>
        <Text type="secondary">
          <EnvironmentOutlined /> Location: {record.Location}
        </Text>
        <Text type="secondary">Quantity: {record.Quantity}</Text>
      </Space>
    ),
  },
  {
    title: 'Supervisor Request Details',
    key: 'request',
    width: 250,
    render: (_, record) => (
      <Space direction="vertical" size={0}>
        <Text>
          <UserOutlined /> Supervisor: {record.supervisor_name}
        </Text>
        <Text type="secondary">ID: {record.supervisor_id}</Text>
        <Text>
          <CalendarOutlined /> Request Date: {
            record.request_date ?
              new Date(record.request_date).toLocaleString() :
              'N/A'
          }
        </Text>
      </Space>
    ),
  },
  {
    title: 'Officer Response Details',
    key: 'officer',
    width: 250,
    render: (_, record) => {
      // Parse response date
      let responseDate = null;
      try {
        if (record.response_date) {
          responseDate = new Date(record.response_date);
          // Check if date is valid
          if (isNaN(responseDate.getTime())) {
            responseDate = null;
          }
        }
      } catch (e) {
        console.error('Error parsing response date:', e);
        responseDate = null;
      }

      return (
        <Space direction="vertical" size={0}>
          {record.officer_name ? (
            <>
              <Text>
                <UserOutlined /> Officer: {record.officer_name}
              </Text>
              <Text type="secondary">ID: {record.officer_id}</Text>
              <Text>
                <CalendarOutlined /> Response Date: {
                  responseDate ?
                    responseDate.toLocaleString() :
                    'Pending Response'
                }
              </Text>
            </>
          ) : (
            <>
              <Text type="secondary">No officer assigned</Text>
              <Text type="secondary">Awaiting response</Text>
            </>
          )}
        </Space>
      );
    },
  },
  {
    title: 'Status',
    key: 'status',
    width: 120,
    render: (_, record) => getStatusTag(record.status),
  },
  {
    title: 'Remarks',
    dataIndex: 'Remarks',
    key: 'remarks',
    width: 200,
  }
];

// Add new function for date filtering
export const getFilteredRequests = (requests, dateRange) => {
  if (!dateRange || !dateRange[0] || !dateRange[1]) return requests;

  return requests.filter(request => {
    const requestDate = dayjs(request.request_date);
    return requestDate.isAfter(dateRange[0].startOf('day')) &&
      requestDate.isBefore(dateRange[1].endOf('day'));
  });
};

// Add new function for PDF download
export const downloadRequestsPDF = (requests, dateRange) => {
  if (requests.length === 0) {
    notification.warning({
      message: 'No Data Available',
      description: 'No tool request data is available for the selected dates.',
    });
    return;
  }

  const doc = new jsPDF('l', 'mm', 'a4');

  // Add title
  doc.setFontSize(16);
  doc.text('New Tool Requests Report', 14, 15);

  // Add generation date and date range
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 25);

  if (dateRange[0] && dateRange[1]) {
    doc.text(`Date Range: ${dateRange[0].format('DD/MM/YYYY')} - ${dateRange[1].format('DD/MM/YYYY')}`, 14, 30);
  }

  // Prepare table data
  const tableData = requests.map(record => [
    record.Item_Description || '',
    record.Range_in_mm || 'N/A',
    record.Identification_Code || 'N/A',
    record.Make || 'N/A',
    record.Quantity || '',
    record.Location || 'N/A',
    record.project_number || 'N/A',
    record.project_details || 'No details',
    record.supervisor_name || '',
    record.supervisor_id || '',
    new Date(record.request_date).toLocaleDateString(),
    record.response_date ? new Date(record.response_date).toLocaleDateString() : 'Pending',
    record.officer_name || 'Not Assigned',
    record.status.toUpperCase()
  ]);

  // Add table
  autoTable(doc, {
    head: [[
      'Tool Description', 'Range', 'ID Code', 'Make', 'Qty', 'Location',
      'Project #', 'Project Details', 'Supervisor', 'Sup. ID',
      'Request Date', 'Response Date', 'Officer', 'Status'
    ]],
    body: tableData,
    startY: dateRange[0] && dateRange[1] ? 40 : 35,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 15 },
      2: { cellWidth: 15 },
      3: { cellWidth: 15 },
      4: { cellWidth: 10, halign: 'center' },
      5: { cellWidth: 15 },
      6: { cellWidth: 15 },
      7: { cellWidth: 30 },
      8: { cellWidth: 20 },
      9: { cellWidth: 15 },
      10: { cellWidth: 20 },
      11: { cellWidth: 20 },
      12: { cellWidth: 20 },
      13: { cellWidth: 15, halign: 'center' }
    },
    margin: { left: 14, right: 14 },
    tableWidth: 'auto'
  });

  // Save the PDF
  const dateRangeText = dateRange[0] && dateRange[1]
    ? `_${dateRange[0].format('DDMMYYYY')}_to_${dateRange[1].format('DDMMYYYY')}`
    : '';
  doc.save(`new_tool_requests${dateRangeText}_${new Date().toISOString().split('T')[0]}.pdf`);

  notification.success({
    message: 'PDF Downloaded',
    description: 'Tool requests report has been downloaded successfully.',
  });
};

// Export DateRangeFilter component
export const DateRangeFilter = ({ dateRange, onDateRangeChange }) => (
  <RangePicker
    value={dateRange}
    onChange={onDateRangeChange}
    placeholder={['Start Date', 'End Date']}
    format="DD/MM/YYYY"
    style={{ width: 240 }}
  />
);

// Export DownloadButton component
export const DownloadButton = ({ dateRange, requests }) => (
  <Tooltip title="Download PDF Report">
    <Button
      type="primary"
      icon={<DownloadOutlined />}
      onClick={() => downloadRequestsPDF(requests, dateRange)}
      style={{ backgroundColor: '#1890ff', borderColor: '#1890ff' }}
    >
      Download PDF
    </Button>
  </Tooltip>
);

const ToolRequestDrawer = ({ visible, onClose, currentUserInfo, onRequestSubmitted, pendingToolRequests, setPendingToolRequests }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [existingTools, setExistingTools] = useState([]);
  const [matchingTools, setMatchingTools] = useState([]);
  const [selectedTool, setSelectedTool] = useState(null);
  const [isExistingTool, setIsExistingTool] = useState(false);
  const [dateRange, setDateRange] = useState([null, null]);
  const [filteredRequests, setFilteredRequests] = useState([]);

  // Update filtered requests when date range or pending requests change
  useEffect(() => {
    setFilteredRequests(getFilteredRequests(pendingToolRequests, dateRange));
  }, [pendingToolRequests, dateRange]);

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

  // Fetch existing tools when drawer opens
  useEffect(() => {
    if (visible) {
      fetchExistingTools();
    }
  }, [visible]);

  const fetchExistingTools = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/tools', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch tools');
      const data = await response.json();
      setExistingTools(data);
    } catch (error) {
      console.error('Error fetching tools:', error);
      notification.error({
        message: 'Error',
        description: 'Failed to fetch existing tools.',
      });
    }
  };

  const handleItemDescriptionChange = (e) => {
    const value = e.target.value;
    form.setFieldValue('Item_Description', value);
    setIsExistingTool(false);

    if (value.trim()) {
      // Find matching tools based on input
      const matches = existingTools.filter(tool =>
        tool.Item_Description.toLowerCase().includes(value.toLowerCase())
      );

      if (matches.length > 0) {
        // Sort matches by Sl_no ascending
        const sortedMatches = [...matches].sort((a, b) => a.Sl_no - b.Sl_no);
        setMatchingTools(sortedMatches);
      } else {
        setMatchingTools([]);
        setSelectedTool(null);
      }
    } else {
      setMatchingTools([]);
      setSelectedTool(null);
    }
  };

  const selectTool = (tool) => {
    setSelectedTool(tool);
    setIsExistingTool(true);
    // Populate ALL available fields from the selected tool except Remarks
    form.setFieldsValue({
      Item_Description: tool.Item_Description || '',
      Range_in_mm: tool.Range_in_mm || '',
      Identification_Code: tool.Identification_Code || '',
      Make: tool.Make || '',
      Location: tool.Location || '',
      Gauge: tool.Gauge || '',
      Quantity: 1
    });
    setMatchingTools([]);
  };

  // Add a function to handle manual entry
  const handleManualEntry = () => {
    setSelectedTool(null);
    setIsExistingTool(false);
    setMatchingTools([]);
    // Enable all fields for manual entry
    const currentItemDescription = form.getFieldValue('Item_Description');
    form.setFieldsValue({
      Item_Description: currentItemDescription,
      Range_in_mm: '',
      Identification_Code: '',
      Make: '',
      Location: '',
      Gauge: '',
      Quantity: 1
    });
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const requestBody = {
        Item_Description: values.Item_Description,
        Range_in_mm: values.Range_in_mm,
        Identification_Code: values.Identification_Code,
        Make: values.Make,
        Quantity: values.Quantity,
        Location: values.Location,
        Gauge: values.Gauge || '',
        Remarks: values.Remarks || '',
        project_details: values.project_details || '',
        project_number: values.project_number || '',
        supervisor_id: currentUserInfo?.employee_id,
        supervisor_name: currentUserInfo?.employee_name,
        status: 'pending',
        tool_sl_no: selectedTool?.Sl_no // Add the Sl.no if it's an existing tool
      };

      const response = await fetch('http://localhost:8000/new-tool-requests', {
        method: 'POST',
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit tool request');
      }

      notification.success({
        message: 'Tool Request Submitted',
        description: 'Your request has been sent to the officer for review.',
      });

      form.resetFields();
      onClose();

      if (onRequestSubmitted) {
        await onRequestSubmitted();
      }
    } catch (error) {
      console.error('Error submitting tool request:', error);
      notification.error({
        message: 'Request Failed',
        description: error.message || 'Failed to submit tool request. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Reset form when drawer closes
  useEffect(() => {
    if (!visible) {
      form.resetFields();
      setSelectedTool(null);
      setMatchingTools([]);
      setIsExistingTool(false);
    }
  }, [visible, form]);

  return (
    <Drawer
      title={
        <Space>
          <ToolOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
          <Title level={4} style={{ margin: 0 }}>Request New Tool</Title>
        </Space>
      }
      placement="right"
      onClose={onClose}
      open={visible}
      width={520}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            onClick={() => form.submit()}
            icon={<SaveOutlined />}
            loading={loading}
          >
            Submit Request
          </Button>
        </Space>
      }
    >
      <div style={{ padding: '0 12px' }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark="optional"
          initialValues={{
            Quantity: 1
          }}
        >
          <Title level={5} style={{ marginBottom: '24px' }}>Tool Information</Title>

          <div style={{ position: 'relative' }}>
            <Form.Item
              name="Item_Description"
              label="Tool Name"
              rules={[{ required: true, message: 'Please enter tool name' }]}
            >
              <Input
                placeholder="Type tool name to search"
                onChange={handleItemDescriptionChange}
                size="large"
                prefix={<ToolOutlined style={{ color: '#bfbfbf' }} />}
              />
            </Form.Item>

            {matchingTools.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 1000,
                background: '#fff',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                <div style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #f0f0f0',
                  background: '#f9f9f9'
                }}>
                  <Button
                    type="link"
                    onClick={handleManualEntry}
                    icon={<PlusOutlined />}
                  >
                    Add as new tool
                  </Button>
                </div>
                {matchingTools.map((tool, index) => (
                  <div
                    key={tool.Sl_no}
                    style={{
                      padding: '12px',
                      cursor: 'pointer',
                      borderBottom: index < matchingTools.length - 1 ? '1px solid #f0f0f0' : 'none',
                      backgroundColor: selectedTool?.Sl_no === tool.Sl_no ? '#e6f7ff' : 'transparent'
                    }}
                    onClick={() => selectTool(tool)}
                    onMouseEnter={(e) => {
                      if (selectedTool?.Sl_no !== tool.Sl_no) {
                        e.target.style.backgroundColor = '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedTool?.Sl_no !== tool.Sl_no) {
                        e.target.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px'
                    }}>
                      <Tag color="blue">Sl.No: {tool.Sl_no}</Tag>
                      <div style={{ fontWeight: 500 }}>{tool.Item_Description}</div>
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#1890ff',
                      fontWeight: '500',
                      marginBottom: '2px'
                    }}>
                      Range: {tool.Range_in_mm || 'N/A'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      ID: {tool.Identification_Code || 'N/A'} | Make: {tool.Make || 'N/A'} | Location: {tool.Location || 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              name="Range_in_mm"
              label="Range (mm)"
              rules={[{ required: true, message: 'Please enter range' }]}
              style={{ width: '50%' }}
            >
              <Input
                placeholder="Enter range in mm"
                size="large"
                disabled={isExistingTool && selectedTool}
              />
            </Form.Item>

            <Form.Item
              name="Identification_Code"
              label="Identification Code"
              rules={[{ required: true, message: 'Please enter ID code' }]}
              style={{ width: '50%' }}
            >
              <Input
                placeholder="Enter ID code"
                size="large"
                disabled={isExistingTool && selectedTool}
              />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              name="Make"
              label="Make"
              rules={[{ required: true, message: 'Please enter make' }]}
              style={{ width: '50%' }}
            >
              <Input
                placeholder="Enter make"
                size="large"
                disabled={isExistingTool && selectedTool}
              />
            </Form.Item>

            <Form.Item
              name="Quantity"
              label="Quantity"
              rules={[{ required: true, message: 'Please enter quantity' }]}
              style={{ width: '50%' }}
            >
              <InputNumber
                min={1}
                placeholder="Enter quantity"
                size="large"
                style={{ width: '100%' }}
                disabled={false}
              />
            </Form.Item>
          </Space>

          <Form.Item
            name="Location"
            label="Location"
            rules={[{ required: true, message: 'Please enter location' }]}
          >
            <Input
              placeholder="Enter storage location"
              size="large"
              disabled={isExistingTool && selectedTool}
            />
          </Form.Item>

          <Form.Item
            name="Gauge"
            label="Gauge"
          >
            <Input
              placeholder="Enter gauge specifications (optional)"
              size="large"
              disabled={isExistingTool && selectedTool}
            />
          </Form.Item>

          <Title level={5} style={{ marginTop: '24px', marginBottom: '24px' }}>Project Information</Title>

          <Form.Item
            name="project_number"
            label="Project Number"
            rules={[{ required: true, message: 'Please enter project number' }]}
          >
            <Input
              placeholder="Enter project number"
              size="large"
              prefix={<NumberOutlined style={{ color: '#bfbfbf' }} />}
            />
          </Form.Item>

          <Form.Item
            name="project_details"
            label="Project Details"
            rules={[{ required: true, message: 'Please enter project details' }]}
          >
            <Input.TextArea
              placeholder="Enter project details"
              rows={3}
              showCount
              maxLength={200}
            />
          </Form.Item>

          <Form.Item
            name="Remarks"
            label="Remarks"
          >
            <Input.TextArea
              placeholder="Enter any additional remarks or special requirements"
              rows={4}
              showCount
              maxLength={500}
            />
          </Form.Item>
        </Form>

        <div style={{ marginTop: '24px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
          <Text type="secondary">
            This request will be reviewed by the Tool Crib Officer. You will be notified once it's approved.
          </Text>
        </div>
      </div>
    </Drawer>
  );
};

export default ToolRequestDrawer;