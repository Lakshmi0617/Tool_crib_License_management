import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, notification, Tag, DatePicker, Tooltip, Empty, Modal } from 'antd';
import { CheckOutlined, CloseOutlined, ToolOutlined, DownloadOutlined } from '@ant-design/icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const PendingRequestsDrawer = ({ currentUserInfo, pendingRequests, onRequestsChange }) => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([null, null]);

  const handleApprove = async (requestId) => {
    try {
      const requestBody = {
        officer_id: currentUserInfo?.employee_id,
        officer_name: currentUserInfo?.employee_name,
        status: 'approved'
      };

      const response = await fetch(`http://172.18.100.33:8000/new-tool-requests/${requestId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to approve request');
      }

      notification.success({
        message: 'Request Approved',
        description: 'Tool request has been approved successfully.',
      });

      const updatedRequest = await response.json();
      const newRequests = pendingRequests.map(req => 
        req.id === requestId ? updatedRequest : req
      );
      onRequestsChange(newRequests);
    } catch (error) {
      console.error('Error approving request:', error);
      notification.error({
        message: 'Approval Failed',
        description: error.message || 'Failed to approve tool request. Please try again.',
      });
    }
  };

  const handleReject = async (requestId) => {
    try {
      const requestBody = {
        officer_id: currentUserInfo?.employee_id,
        officer_name: currentUserInfo?.employee_name,
        status: 'rejected'
      };

      const response = await fetch(`http://172.18.100.33:8000/new-tool-requests/${requestId}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to reject request');
      }

      notification.success({
        message: 'Request Rejected',
        description: 'Tool request has been rejected.',
      });

      const updatedRequest = await response.json();
      const newRequests = pendingRequests.map(req => 
        req.id === requestId ? updatedRequest : req
      );
      onRequestsChange(newRequests);
    } catch (error) {
      console.error('Error rejecting request:', error);
      notification.error({
        message: 'Rejection Failed',
        description: error.message || 'Failed to reject tool request. Please try again.',
      });
    }
  };

  const downloadPDF = () => {
    if (filteredRequests.length === 0) {
      notification.warning({
        message: 'No Data Available',
        description: 'Sorry sir, the new tool request data is not available in the selected dates.',
      });
      return;
    }

    const doc = new jsPDF('l', 'mm', 'a4'); // landscape orientation
    
    // Add title
    doc.setFontSize(16);
    doc.text('Tool Requests Report', 14, 15);
    
    // Add generation date and date range
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 25);
    
    if (dateRange[0] && dateRange[1]) {
      doc.text(`Date Range: ${dateRange[0].format('DD/MM/YYYY')} - ${dateRange[1].format('DD/MM/YYYY')}`, 14, 30);
    }
    
    // Prepare table data
    const tableData = filteredRequests.map(record => [
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

    // Add table using autoTable
    autoTable(doc, {
      head: [[
        'Tool Description', 'Range', 'ID Code', 'Make', 'Qty', 'Location', 
        'Project #', 'Project Details', 'Supervisor', 'Sup. ID', 
        'Request Date', 'Response Date', 'Officer', 'Status'
      ]],
      body: tableData,
      startY: dateRange[0] && dateRange[1] ? 40 : 35,
      styles: { 
        fontSize: 8,
        cellPadding: 2
      },
      headStyles: { 
        fillColor: [66, 139, 202],
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 25 }, // Tool Description
        1: { cellWidth: 15 }, // Range
        2: { cellWidth: 15 }, // ID Code
        3: { cellWidth: 15 }, // Make
        4: { cellWidth: 10, halign: 'center' }, // Quantity
        5: { cellWidth: 15 }, // Location
        6: { cellWidth: 15 }, // Project #
        7: { cellWidth: 30 }, // Project Details
        8: { cellWidth: 20 }, // Supervisor
        9: { cellWidth: 15 }, // Supervisor ID
        10: { cellWidth: 20 }, // Request Date
        11: { cellWidth: 20 }, // Response Date
        12: { cellWidth: 20 }, // Officer
        13: { cellWidth: 15, halign: 'center' } // Status
      },
      margin: { left: 14, right: 14 },
      tableWidth: 'auto'
    });

    // Save the PDF
    const dateRangeText = dateRange[0] && dateRange[1] 
      ? `_${dateRange[0].format('DDMMYYYY')}_to_${dateRange[1].format('DDMMYYYY')}`
      : '';
    doc.save(`tool_requests${dateRangeText}_${new Date().toISOString().split('T')[0]}.pdf`);
    
    notification.success({
      message: 'PDF Downloaded',
      description: 'Tool requests report has been downloaded successfully.',
    });
  };

  // Filter requests based on date range
  const filteredRequests = pendingRequests.filter(request => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) return true;
    
    const requestDate = dayjs(request.request_date);
    return requestDate.isAfter(dateRange[0].startOf('day')) && 
           requestDate.isBefore(dateRange[1].endOf('day'));
  });

  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    
    // Check if dates are selected and no data is available
    if (dates && dates[0] && dates[1]) {
      const filteredData = pendingRequests.filter(request => {
        const requestDate = dayjs(request.request_date);
        return requestDate.isAfter(dates[0].startOf('day')) && 
               requestDate.isBefore(dates[1].endOf('day'));
      });
      
      if (filteredData.length === 0) {
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

  const columns = [
    {
      title: 'Tool Details',
      key: 'tool_details',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '13px' }}>
            {record.Item_Description}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            <div>Range: {record.Range_in_mm || 'N/A'}</div>
            <div>ID: {record.Identification_Code || 'N/A'}</div>
            <div>Make: {record.Make || 'N/A'}</div>
            <div>Location: {record.Location || 'N/A'}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Qty',
      dataIndex: 'Quantity',
      key: 'quantity',
      width: 60,
      align: 'center',
      render: (quantity) => (
        <Tag color="blue">{quantity}</Tag>
      ),
    },
    {
      title: 'Project Information',
      key: 'project_info',
      width: 180,
      render: (_, record) => (
        <div style={{ fontSize: '12px' }}>
          <div style={{ marginBottom: '6px' }}>
            <div style={{ fontWeight: 'bold', color: '#1890ff', marginBottom: '2px' }}>
              Project Number:
            </div>
            <div style={{ color: '#333', paddingLeft: '8px' }}>
              {record.project_number || 'N/A'}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 'bold', color: '#1890ff', marginBottom: '2px' }}>
              Project Details:
            </div>
            <div style={{ color: '#333', paddingLeft: '8px', wordBreak: 'break-word' }}>
              {record.project_details || 'No details provided'}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Supervisor',
      key: 'supervisor_details',
      width: 120,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{record.supervisor_name}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>ID: {record.supervisor_id}</div>
        </div>
      ),
    },
    {
      title: 'Request Date',
      dataIndex: 'request_date',
      key: 'request_date',
      width: 120,
      sorter: (a, b) => new Date(a.request_date) - new Date(b.request_date),
      sortDirections: ['descend', 'ascend'],
      defaultSortOrder: 'descend',
      render: (date) => (
        <div style={{ fontSize: '12px' }}>
          <div>{new Date(date).toLocaleDateString()}</div>
          <div style={{ color: '#666' }}>
            {new Date(date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
      ),
    },
    {
      title: 'Response Date',
      dataIndex: 'response_date',
      key: 'response_date',
      width: 120,
      render: (date) => (
        date ? (
          <div style={{ fontSize: '12px' }}>
            <div>{new Date(date).toLocaleDateString()}</div>
            <div style={{ color: '#666' }}>
              {new Date(date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
          </div>
        ) : (
          <Tag color="orange">Pending</Tag>
        )
      ),
    },
    {
      title: 'Officer',
      key: 'officer_details',
      width: 120,
      render: (_, record) => (
        record.officer_name ? (
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{record.officer_name}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>ID: {record.officer_id}</div>
          </div>
        ) : (
          <Tag color="default">Not Assigned</Tag>
        )
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 90,
      align: 'center',
      render: (_, record) => (
        <Tag 
          color={
            record.status === 'approved' ? 'success' :
            record.status === 'rejected' ? 'error' :
            'warning'
          }
        >
          {record.status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      align: 'center',
      render: (_, record) => (
        record.status === 'pending' ? (
          <Space size="small">
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleApprove(record.id)}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              Approve
            </Button>
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={() => handleReject(record.id)}
            >
              Reject
            </Button>
          </Space>
        ) : (
          <Tag color={record.status === 'approved' ? 'success' : 'error'}>
            {record.status === 'approved' ? 'Approved' : 'Rejected'}
          </Tag>
        )
      ),
    },
  ];

  return (
    <div style={{ padding: '16px', backgroundColor: '#fff' }}>
      {/* Header Section */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ToolOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
          <Text strong style={{ fontSize: '16px' }}>Tool Requests Management</Text>
          <Tag color="blue" style={{ marginLeft: '8px' }}>
            {pendingRequests.filter(req => req.status === 'pending').length} Total Pending
          </Tag>
          {filteredRequests.length !== pendingRequests.length && (
            <Tag color="green" style={{ marginLeft: '4px' }}>
              {filteredRequests.length} Filtered Results
            </Tag>
          )}
        </div>
        
        <Space>
          <RangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            placeholder={['Start Date', 'End Date']}
            format="DD/MM/YYYY"
            style={{ width: 240 }}
          />
          
          <Tooltip title="Download PDF Report">
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={downloadPDF}
              style={{ backgroundColor: '#1890ff', borderColor: '#1890ff' }}
            >
              Download PDF
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* Table or Empty State */}
      {filteredRequests.length === 0 ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '400px',
          backgroundColor: '#fafafa',
          borderRadius: '6px',
          border: '1px solid #d9d9d9'
        }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: '16px' }}>
                  Sorry sir, the new tool request data is not available in the selected dates
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  Please try selecting a different date range
                </Text>
              </div>
            }
          />
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={filteredRequests}
          rowKey="id"
          loading={loading}
          size="small"
          scroll={{ x: 1200, y: 'calc(100vh - 250px)' }}
          pagination={{
            pageSize: 50,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} requests`,
            showSizeChanger: true,
            pageSizeOptions: ['25', '50', '100', '200'],
            showQuickJumper: true,
          }}
          bordered
          style={{
            backgroundColor: '#fff',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        />
      )}
    </div>
  );
};

export default PendingRequestsDrawer;