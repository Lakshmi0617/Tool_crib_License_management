import React, { useState, useEffect } from 'react';
import { DatePicker, Button, Space, Typography, message, Modal, Table, Tag, Card, Divider } from 'antd';
import { DownloadOutlined, FilterOutlined, ReloadOutlined, WarningOutlined, EnvironmentOutlined, ToolOutlined } from '@ant-design/icons';
import jsPDF from 'jspdf';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const ItemIssuesHistory = () => {
  const [issues, setIssues] = useState([]);
  const [dateRange, setDateRange] = useState(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filteredData, setFilteredData] = useState([]);
  const [noDataModalVisible, setNoDataModalVisible] = useState(false);
  const [filterType, setFilterType] = useState('report_to_officer'); // or 'officer_to_supervisor'
  const [loading, setLoading] = useState(false);

  // Fetch issues data
  const fetchIssues = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://172.18.100.33:8000/api/tool-issues/all');
      if (!response.ok) {
        throw new Error('Failed to fetch issues');
      }
      const data = await response.json();
      
      // Sort data by report date in descending order
      const sortedData = data.sort((a, b) => 
        new Date(b.report_date) - new Date(a.report_date)
      );
      
      setIssues(sortedData);
      if (!isFiltering) {
        setFilteredData(sortedData);
      }
    } catch (error) {
      console.error('Error fetching issues:', error);
      message.error('Failed to fetch issues data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  // Function to filter data based on date range and filter type
  const filterDataByDateRange = (data, range, type) => {
    if (!range || !range[0] || !range[1]) return data;

    const startDateTime = range[0].startOf('day').toDate();
    const endDateTime = range[1].endOf('day').toDate();

    return data.filter(issue => {
      if (type === 'report_to_officer') {
        const reportDate = new Date(issue.report_date);
        const officerApprovalDate = issue.officer_approval_date ? new Date(issue.officer_approval_date) : null;
        return reportDate >= startDateTime && 
               reportDate <= endDateTime && 
               officerApprovalDate;
      } else {
        const officerApprovalDate = issue.officer_approval_date ? new Date(issue.officer_approval_date) : null;
        const supervisorApprovalDate = issue.supervisor_approval_date ? new Date(issue.supervisor_approval_date) : null;
        return officerApprovalDate && 
               supervisorApprovalDate &&
               officerApprovalDate >= startDateTime && 
               officerApprovalDate <= endDateTime;
      }
    });
  };

  // Handle date range changes
  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    setIsFiltering(!!dates);

    if (!dates) {
      setFilteredData(issues);
      return;
    }

    const filtered = filterDataByDateRange(issues, dates, filterType);
    setFilteredData(filtered);

    // Show modal if no data available for selected dates
    if (filtered.length === 0) {
      setNoDataModalVisible(true);
    }
  };

  const handleShowAll = () => {
    setDateRange(null);
    setIsFiltering(false);
    setFilteredData(issues);
  };

const handleDownloadPDF = () => {
  try {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Title
    doc.setFontSize(14);
    doc.text('Tool Issues Report', 15, 15);

    // Add filter info
    doc.setFontSize(10);
    doc.text(`Filter Type: ${filterType === 'report_to_officer' ? 'Report to Officer Approval' : 'Officer to Supervisor Approval'}`, 15, 22);
    if (dateRange) {
      doc.text(`Date Range: ${dateRange[0].format('DD/MM/YYYY')} - ${dateRange[1].format('DD/MM/YYYY')}`, 15, 28);
    }

    // Define compact column headers and widths
    const startY = dateRange ? 35 : 30;
    const margin = 10;
    const headerHeight = 8;
    
    const headers = [
      { title: 'Tool Info', width: 35 },
      { title: 'Operator', width: 35 },
      { title: 'Issue Details', width: 45 },
      { title: 'Report Date', width: 30 },
      { title: 'Officer', width: 35 },
      { title: 'Supervisor', width: 35 }
    ];

    // Calculate total width
    const totalWidth = headers.reduce((sum, header) => sum + header.width, 0);

    // Draw header background
    doc.setFillColor(33, 150, 243);
    doc.rect(margin, startY, totalWidth, headerHeight, 'F');

    // Draw headers
    let currentX = margin;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    headers.forEach((header, index) => {
      const textWidth = doc.getStringUnitWidth(header.title) * doc.getFontSize() / doc.internal.scaleFactor;
      const textX = currentX + (header.width - textWidth) / 2;
      doc.text(header.title, textX, startY + 5.5);
      
      // Draw vertical lines
      if (index < headers.length - 1) {
        doc.setDrawColor(255, 255, 255);
        doc.line(currentX + header.width, startY, currentX + header.width, startY + headerHeight);
      }
      currentX += header.width;
    });

    let currentY = startY + headerHeight;
    const data = isFiltering ? filteredData : issues;
    const rowHeight = 22; // Reduced from 30
    
    // Reset colors for data
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(200, 200, 200);
    doc.setFontSize(7); // Smaller font size

    data.forEach((issue, index) => {
      // Check if we need a new page
      if (currentY + rowHeight > doc.internal.pageSize.height - 15) {
        doc.addPage();
        currentY = 20;
        
        // Redraw headers on new page
        doc.setFillColor(33, 150, 243);
        doc.rect(margin, currentY, totalWidth, headerHeight, 'F');
        
        let headerX = margin;
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        headers.forEach((header, idx) => {
          const textWidth = doc.getStringUnitWidth(header.title) * doc.getFontSize() / doc.internal.scaleFactor;
          const textX = headerX + (header.width - textWidth) / 2;
          doc.text(header.title, textX, currentY + 5.5);
          
          if (idx < headers.length - 1) {
            doc.setDrawColor(255, 255, 255);
            doc.line(headerX + header.width, currentY, headerX + header.width, currentY + headerHeight);
          }
          headerX += header.width;
        });
        
        currentY += headerHeight;
        doc.setTextColor(0, 0, 0);
        doc.setDrawColor(200, 200, 200);
        doc.setFontSize(7);
      }

      // Alternating row background
      if (index % 2 === 1) {
        doc.setFillColor(248, 248, 248);
        doc.rect(margin, currentY, totalWidth, rowHeight, 'F');
      }

      currentX = margin;
      const baseY = currentY;

      // Tool Info column
      doc.rect(currentX, currentY, headers[0].width, rowHeight);
      doc.setFont(undefined, 'bold');
      doc.text('Allen Key', currentX + 1, currentY + 4);
      doc.setFont(undefined, 'normal');
      doc.text([
        `S/N: ${issue.tool_sl_no}`,
        `Range: ${issue.range || '3.5mm'}`,
        `Code: ${issue.identificationCode || 'N/A'}`,
        `Loc: ${issue.location || 'N/A'}`
      ], currentX + 1, currentY + 8, { maxWidth: headers[0].width - 2 });
      currentX += headers[0].width;

      // Operator column
      doc.rect(currentX, currentY, headers[1].width, rowHeight);
      doc.setFont(undefined, 'bold');
      doc.text(issue.operator_name, currentX + 1, currentY + 4);
      doc.setFont(undefined, 'normal');
      doc.text([
        `ID: ${issue.operator_id}`,
        `Dept: ${issue.department || 'N/A'}`,
        `Contact: ${issue.contact || 'N/A'}`
      ], currentX + 1, currentY + 8, { maxWidth: headers[1].width - 2 });
      currentX += headers[1].width;

      // Issue Details column
      doc.rect(currentX, currentY, headers[2].width, rowHeight);
      doc.text([
        `Severity: ${issue.severity.toUpperCase()}`,
        `Category: ${issue.category}`,
        `Desc: ${issue.description}`,
        `Purpose: ${issue.purpose}`,
        `Project: ${issue.project_details}`
      ], currentX + 1, currentY + 4, { maxWidth: headers[2].width - 2 });
      currentX += headers[2].width;

      // Report Date column
      doc.rect(currentX, currentY, headers[3].width, rowHeight);
      const reportDate = new Date(issue.report_date);
      doc.text([
        reportDate.toLocaleDateString('en-GB'),
        reportDate.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        })
      ], currentX + 1, currentY + 6, { maxWidth: headers[3].width - 2 });
      currentX += headers[3].width;

      // Officer column
      doc.rect(currentX, currentY, headers[4].width, rowHeight);
      doc.setFont(undefined, 'bold');
      doc.text(issue.officer_name, currentX + 1, currentY + 4);
      doc.setFont(undefined, 'normal');
      const officerDate = new Date(issue.officer_approval_date);
      doc.text([
        `ID: ${issue.officer_id}`,
        officerDate.toLocaleDateString('en-GB'),
        officerDate.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        }),
        `Status: ${issue.officer_status?.toUpperCase()}`
      ], currentX + 1, currentY + 8, { maxWidth: headers[4].width - 2 });
      currentX += headers[4].width;

      // Supervisor column
      doc.rect(currentX, currentY, headers[5].width, rowHeight);
      doc.setFont(undefined, 'bold');
      doc.text(issue.supervisor_name, currentX + 1, currentY + 4);
      doc.setFont(undefined, 'normal');
      if (issue.supervisor_approval_date) {
        const supervisorDate = new Date(issue.supervisor_approval_date);
        doc.text([
          `ID: ${issue.supervisor_id}`,
          supervisorDate.toLocaleDateString('en-GB'),
          supervisorDate.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          }),
          `Status: ${issue.supervisor_status?.toUpperCase()}`
        ], currentX + 1, currentY + 8, { maxWidth: headers[5].width - 2 });
      } else {
        doc.text([
          `ID: ${issue.supervisor_id}`,
          'Pending',
          '',
          `Status: ${issue.supervisor_status?.toUpperCase()}`
        ], currentX + 1, currentY + 8, { maxWidth: headers[5].width - 2 });
      }

      currentY += rowHeight;
    });

    // Add footer with summary
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Total Issues: ${data.length}`, margin, doc.internal.pageSize.height - 15);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin + 50, doc.internal.pageSize.height - 15);
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 15);
    }

    // Save the PDF
    const timestamp = new Date().toISOString().slice(0, 10);
    const filterTypeStr = filterType === 'report_to_officer' ? 'ReportToOfficer' : 'OfficerToSupervisor';
    doc.save(`ToolIssuesReport_${filterTypeStr}_${timestamp}.pdf`);
    message.success('PDF downloaded successfully');
  } catch (error) {
    console.error('Error generating PDF:', error);
    message.error('Failed to download PDF');
  }
};

  const columns = [
    {
      title: 'Tool Details',
      key: 'tool_details',
      width: 180,
      render: (_, record) => (
        <div style={{ 
          background: '#f9f9f9', 
          padding: '8px',
          borderRadius: '4px',
        }}>
          <div style={{ fontWeight: 500, marginBottom: '4px' }}>Allen Key</div>
          <div style={{ color: '#666', fontSize: '13px' }}>Serial No: {record.tool_sl_no}</div>
          <div style={{ color: '#666', fontSize: '13px' }}>Range: {record.range || '3.5 mm'}</div>
          <div style={{ color: '#666', fontSize: '13px' }}>ID Code: {record.identificationCode || 'N/A'}</div>
          <div style={{ color: '#666', fontSize: '13px' }}>
            <EnvironmentOutlined style={{ fontSize: '12px' }} /> Location: {record.location || 'N/A'}
          </div>
        </div>
      ),
    },
    {
      title: 'Operator Details',
      key: 'operator_details',
      width: 180,
      render: (_, record) => (
        <div style={{ 
          background: '#f9f9f9', 
          padding: '8px',
          borderRadius: '4px',
        }}>
          <div style={{ fontWeight: 500, marginBottom: '4px' }}>{record.operator_name}</div>
          <div style={{ color: '#666', fontSize: '13px' }}>ID: {record.operator_id}</div>
          <div style={{ color: '#666', fontSize: '13px' }}>Department: {record.department || 'N/A'}</div>
          <div style={{ color: '#666', fontSize: '13px' }}>Contact: {record.contact || 'N/A'}</div>
        </div>
      ),
    },
    {
      title: 'Issue Details',
      key: 'issue_details',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <div>
            <Text>Severity: </Text>
            <Tag color={
              record.severity === 'high' ? 'red' :
              record.severity === 'medium' ? 'orange' :
              'green'
            } style={{ fontSize: '12px', padding: '0 4px' }}>
              {record.severity.toUpperCase()}
            </Tag>
          </div>
          <div>
            <Text>Category: </Text>
            <Tag color="blue" style={{ fontSize: '12px', padding: '0 4px' }}>{record.category}</Tag>
          </div>
          <div style={{ color: '#666', fontSize: '13px' }}>
            <Text strong>Description:</Text> {record.description}
          </div>
          <div style={{ color: '#666', fontSize: '13px' }}>
            <Text strong>Purpose:</Text> {record.purpose}
          </div>
          <div style={{ color: '#666', fontSize: '13px' }}>
            <Text strong>Project Details:</Text> {record.project_details}
          </div>
        </Space>
      ),
    },
    {
      title: 'Report Date',
      key: 'report_date',
      width: 150,
      render: (_, record) => (
        <div style={{ fontSize: '13px' }}>
          {new Date(record.report_date).toLocaleString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
          })}
        </div>
      ),
    },
    {
      title: 'Officer Details',
      key: 'officer_details',
      width: 180,
      render: (_, record) => (
        <div>
          <div style={{ marginBottom: '2px' }}>{record.officer_name}</div>
          <div style={{ color: '#666', fontSize: '13px' }}>ID: {record.officer_id}</div>
          <div style={{ color: '#666', fontSize: '13px' }}>
            {new Date(record.officer_approval_date).toLocaleString('en-US', {
              year: 'numeric',
              month: 'numeric',
              day: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
              hour12: true
            })}
          </div>
          <Tag 
            color={record.officer_status?.toLowerCase() === 'rejected' ? 'error' : 'success'}
            style={{ 
              fontSize: '12px', 
              padding: '0 4px',
              marginTop: '4px'
            }}
          >
            {record.officer_status?.toUpperCase()}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Supervisor Details',
      key: 'supervisor_details',
      width: 180,
      render: (_, record) => (
        <div>
          <div style={{ marginBottom: '2px' }}>{record.supervisor_name}</div>
          <div style={{ color: '#666', fontSize: '13px' }}>ID: {record.supervisor_id}</div>
          <div style={{ color: '#666', fontSize: '13px' }}>
            {record.supervisor_approval_date ? 
              new Date(record.supervisor_approval_date).toLocaleString('en-US', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
              }) : 'Pending'}
          </div>
          <Tag 
            color={record.supervisor_status?.toLowerCase() === 'rejected' ? 'error' : 'success'}
            style={{ 
              fontSize: '12px', 
              padding: '0 4px',
              marginTop: '4px'
            }}
          >
            {record.supervisor_status?.toUpperCase()}
          </Tag>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Space align="center" style={{ marginBottom: '16px' }}>
              <ToolOutlined style={{ color: '#1890ff' }} />
              <Text strong>Tool Issues History</Text>
            </Space>
          </div>

          <div>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <FilterOutlined style={{ color: '#1890ff', marginRight: '8px' }} />
                <Text>Filter Type:</Text>
                <Button.Group style={{ marginLeft: '8px' }}>
                  <Button 
                    type={filterType === 'report_to_officer' ? 'primary' : 'default'}
                    onClick={() => setFilterType('report_to_officer')}
                    size="small"
                  >
                    Report to Officer Approval
                  </Button>
                  <Button 
                    type={filterType === 'officer_to_supervisor' ? 'primary' : 'default'}
                    onClick={() => setFilterType('officer_to_supervisor')}
                    size="small"
                  >
                    Officer to Supervisor Approval
                  </Button>
                </Button.Group>
              </div>

              <Divider style={{ margin: '16px 0 8px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <Text>Date Range:</Text>
                  <RangePicker
                    onChange={handleDateRangeChange}
                    value={dateRange}
                    style={{ width: '280px' }}
                    size="small"
                    placeholder={['Start Date', 'End Date']}
                  />
                  <Button 
                    icon={<ReloadOutlined />} 
                    onClick={handleShowAll}
                    size="small"
                  >
                    Show All
                  </Button>
                </Space>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadPDF}
                  disabled={filteredData.length === 0}
                  size="small"
                >
                  Download PDF
                </Button>
              </div>
            </Space>
          </div>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={filteredData}
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

      <Modal
        title={
          <Space>
            <WarningOutlined style={{ color: '#faad14' }} />
            <span>No Data Available</span>
          </Space>
        }
        open={noDataModalVisible}
        onCancel={() => {
          setNoDataModalVisible(false);
          setDateRange(null);
          setIsFiltering(false);
          setFilteredData(issues);
        }}
        footer={[
          <Button key="ok" type="primary" onClick={() => {
            setNoDataModalVisible(false);
            setDateRange(null);
            setIsFiltering(false);
            setFilteredData(issues);
          }}>
            OK
          </Button>
        ]}
        maskClosable={false}
      >
        <p style={{ fontSize: '16px', marginTop: '20px' }}>
          No issues data is available for the selected date range.
        </p>
      </Modal>
    </div>
  );
};

export default ItemIssuesHistory;
