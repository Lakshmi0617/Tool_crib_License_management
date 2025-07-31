import React, { useState, useEffect } from 'react';
import { DatePicker, Button, Space, Typography, message, Modal } from 'antd';
import { DownloadOutlined, FilterOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import jsPDF from 'jspdf';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const IssuesHistory = ({ issues = [], onFilterChange, tools = [] }) => {
  const [dateRange, setDateRange] = useState(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filteredData, setFilteredData] = useState([]);
  const [noDataModalVisible, setNoDataModalVisible] = useState(false);

  // Function to filter data based on date range
  const filterDataByDateRange = (data, range) => {
    if (!range || !range[0] || !range[1]) return data;

    const startDateTime = range[0].startOf('day').toDate();
    const endDateTime = range[1].endOf('day').toDate();

    return data.filter(issue => {
      // Check both officer and supervisor approval dates
      const officerApprovalDate = issue.officer_approval_date ? new Date(issue.officer_approval_date) : null;
      const supervisorApprovalDate = issue.supervisor_approval_date ? new Date(issue.supervisor_approval_date) : null;

      // If filtering by officer approval date
      if (officerApprovalDate) {
        return officerApprovalDate >= startDateTime && officerApprovalDate <= endDateTime;
      }
      // If filtering by supervisor approval date
      if (supervisorApprovalDate) {
        return supervisorApprovalDate >= startDateTime && supervisorApprovalDate <= endDateTime;
      }

      return false;
    });
  };

  // Handle date range changes
  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    setIsFiltering(!!dates);

    if (!dates) {
      setFilteredData([]);
      onFilterChange(issues);
      return;
    }

    const filtered = filterDataByDateRange(issues, dates);
    setFilteredData(filtered);
    onFilterChange(filtered);

    // Show modal if no data available for selected dates
    if (filtered.length === 0) {
      setNoDataModalVisible(true);
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setNoDataModalVisible(false);
    setDateRange(null);
    setIsFiltering(false);
    setFilteredData([]);
    onFilterChange(issues);
  };

  // Effect to handle auto-refresh updates
  useEffect(() => {
    if (!isFiltering) {
      onFilterChange(issues);
    } else if (dateRange) {
      const filtered = filterDataByDateRange(issues, dateRange);
      setFilteredData(filtered);
      onFilterChange(filtered);
    }
  }, []);

  const handleShowAll = () => {
    setDateRange(null);
    setIsFiltering(false);
    setFilteredData([]);
    onFilterChange(issues);
  };

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      // Title with date range
      doc.setFontSize(14);
      doc.text('Tool Issues Report', 15, 15);

      // Format date range for display
      let dateRangeText = 'All Dates';
      if (dateRange) {
        const startDateStr = dateRange[0].format('DD MMM YYYY');
        const endDateStr = dateRange[1].format('DD MMM YYYY');
        dateRangeText = `${startDateStr} to ${endDateStr}`;
        
        doc.setFontSize(10);
        doc.text(`Report Period: ${dateRangeText}`, 15, 22);
      }

      const dataToExport = isFiltering ? filteredData : issues;

      // Create table rows
      const rows = dataToExport.map(issue => {
        const tool = tools.find(t => t.id === issue.tool_sl_no) || {};
        
        // Format tool details
        const toolDetails = [
          tool.name || '',
          `Serial No: ${issue.tool_sl_no}`,
          `Range: ${tool.range || ''}`,
          `ID Code: ${tool.identificationCode || ''}`,
          `Location: ${tool.location || ''}`
        ].join('\n');

        // Format operator details
        const operatorDetails = [
          issue.operator_name || '',
          `ID: ${issue.operator_id || ''}`,
          `Department: ${issue.department || ''}`,
          `Contact: ${issue.contact || ''}`
        ].join('\n');

        // Format officer details
        const officerDetails = [
          issue.officer_name || '',
          `ID: ${issue.officer_id || ''}`
        ].join('\n');

        // Format supervisor details
        const supervisorDetails = [
          issue.supervisor_name || '',
          `ID: ${issue.supervisor_id || ''}`
        ].join('\n');

        // Format dates
        const requestDate = new Date(issue.report_date).toLocaleDateString('en-GB');
        const officerApprovalDate = issue.officer_approval_date ? 
          new Date(issue.officer_approval_date).toLocaleDateString('en-GB') : 'N/A';
        const supervisorApprovalDate = issue.supervisor_approval_date ? 
          new Date(issue.supervisor_approval_date).toLocaleDateString('en-GB') : 'N/A';

        return [
          toolDetails,
          operatorDetails,
          requestDate,
          issue.purpose || '',
          issue.project_details || '',
          issue.severity.toUpperCase(),
          issue.category || '',
          officerDetails,
          officerApprovalDate,
          supervisorDetails,
          supervisorApprovalDate
        ];
      });

      // Table configuration
      const startY = 28;
      const headers = [
        'Tool Details', 
        'Operator Details', 
        'Request Date', 
        'Purpose', 
        'Project Details',
        'Issue Severity',
        'Issue Category',
        'Officer Details',
        'Officer Approval',
        'Supervisor Details',
        'Supervisor Approval'
      ];
      
      // Calculate column widths
      const maxContentLengths = rows.reduce((acc, row) => {
        row.forEach((cell, index) => {
          const cellLines = cell.split('\n');
          const maxLineLength = Math.max(...cellLines.map(line => line.length));
          acc[index] = Math.max(acc[index] || 0, maxLineLength);
        });
        return acc;
      }, headers.map(h => h.length));

      // Adjust column widths proportionally
      const totalWidth = 270;
      const minColWidth = 20;
      const colWidths = maxContentLengths.map(length => {
        return Math.max(minColWidth, Math.min(40, (length * 2)));
      });

      // Normalize column widths
      const totalCurrentWidth = colWidths.reduce((a, b) => a + b, 0);
      const scaleFactor = totalWidth / totalCurrentWidth;
      const finalColWidths = colWidths.map(w => Math.round(w * scaleFactor));

      const baseRowHeight = 5;
      const headerHeight = 8;
      const fontSize = 7;
      const headerFontSize = 8;
      const cellPadding = 2;
      let currentY = startY;

      // Draw table headers
      doc.setFillColor(33, 150, 243);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(headerFontSize);
      doc.setFont(undefined, 'bold');

      let currentX = 15;
      doc.rect(currentX, currentY, finalColWidths.reduce((a, b) => a + b, 0), headerHeight, 'F');
      
      headers.forEach((header, i) => {
        doc.text(header, currentX + cellPadding, currentY + 5.5);
        currentX += finalColWidths[i];
      });

      // Draw table rows
      currentY += headerHeight;
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(fontSize);

      rows.forEach((row, rowIndex) => {
        const linesPerCell = row.map(cell => cell.split('\n').length);
        const maxLines = Math.max(...linesPerCell);
        const calculatedHeight = Math.max(baseRowHeight * maxLines, 15);

        // Alternate row background
        if (rowIndex % 2 === 0) {
          doc.setFillColor(245, 245, 245);
          doc.rect(15, currentY, finalColWidths.reduce((a, b) => a + b, 0), calculatedHeight, 'F');
        }

        let x = 15;
        row.forEach((cell, colIndex) => {
          // Draw cell border
          doc.setDrawColor(200, 200, 200);
          doc.rect(x, currentY, finalColWidths[colIndex], calculatedHeight);
          
          // Handle multi-line cells
          const lines = cell.split('\n');
          lines.forEach((line, lineIndex) => {
            doc.text(line.trim(), x + cellPadding, currentY + 4 + (lineIndex * baseRowHeight));
          });
          x += finalColWidths[colIndex];
        });
        currentY += calculatedHeight;

        // Add page if needed
        if (currentY > doc.internal.pageSize.height - 15) {
          doc.addPage();
          currentY = 15;
        }
      });

      // Save with timestamp
      const timestamp = new Date().getTime();
      doc.save(`tool-issues-report-${timestamp}.pdf`);
      message.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      message.error('Failed to download PDF');
    }
  };

  return (
    <>
      <div style={{ 
        padding: '16px', 
        background: '#f5f5f5', 
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <Space size="large" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <FilterOutlined style={{ color: '#1890ff' }} />
            <Text strong>Filter by Approval Dates:</Text>
            <RangePicker
              onChange={handleDateRangeChange}
              value={dateRange}
              style={{ width: '300px' }}
              placeholder={['From Date', 'To Date']}
            />
            <Button 
              icon={<ReloadOutlined />} 
              onClick={handleShowAll}
            >
              Show All
            </Button>
          </Space>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownloadPDF}
            disabled={issues.length === 0}
          >
            Download PDF
          </Button>
        </Space>
      </div>

      {/* No Data Modal */}
      <Modal
        title={
          <Space>
            <WarningOutlined style={{ color: '#faad14' }} />
            <span>No Data Available</span>
          </Space>
        }
        open={noDataModalVisible}
        onCancel={handleModalClose}
        footer={[
          <Button key="ok" type="primary" onClick={handleModalClose}>
            OK
          </Button>
        ]}
        maskClosable={false}
      >
        <p style={{ fontSize: '16px', marginTop: '20px' }}>
          No issue data is available for the specified dates.
        </p>
      </Modal>
    </>
  );
};

export default IssuesHistory;
