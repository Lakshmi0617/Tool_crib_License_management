import React, { useState, useEffect } from 'react';
import { DatePicker, Button, Space, Typography, message, Modal } from 'antd';
import { DownloadOutlined, FilterOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import jsPDF from 'jspdf';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const ToolRequestsHistory = ({ requests = [], onFilterChange, tools = [] }) => {
  const [dateRange, setDateRange] = useState(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filteredData, setFilteredData] = useState([]);
  const [noDataModalVisible, setNoDataModalVisible] = useState(false);

  // Function to filter data based on date range
  const filterDataByDateRange = (data, range) => {
    if (!range || !range[0] || !range[1]) return data;

    const startDateTime = range[0].startOf('day').toDate();
    const endDateTime = range[1].endOf('day').toDate();

    return data.filter(request => {
      const requestDate = new Date(request.request_date);
      return requestDate >= startDateTime && requestDate <= endDateTime;
    });
  };

  // Handle date range changes
  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    setIsFiltering(!!dates);

    if (!dates) {
      setFilteredData([]);
      onFilterChange(requests);
      return;
    }

    const filtered = filterDataByDateRange(requests, dates);
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
    onFilterChange(requests);
  };

  // Effect to handle auto-refresh updates
  useEffect(() => {
    if (!isFiltering) {
      onFilterChange(requests);
    } else if (dateRange) {
      const filtered = filterDataByDateRange(requests, dateRange);
      onFilterChange(filtered);
    }
  }, []);

  const handleShowAll = () => {
    setDateRange(null);
    setIsFiltering(false);
    setFilteredData([]);
    onFilterChange(requests);
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
      doc.text('Tool Requests Report', 15, 15);

      // Format date range for display
      let dateRangeText = 'All Dates';
      if (dateRange) {
        const startDateStr = dateRange[0].format('DD MMM YYYY');
        const endDateStr = dateRange[1].format('DD MMM YYYY');
        dateRangeText = `${startDateStr} to ${endDateStr}`;
        
        // Add date range as subtitle
        doc.setFontSize(10);
        doc.text(`Report Period: ${dateRangeText}`, 15, 22);
      }

      // Use filtered data if filtering is active, otherwise use all requests
      const dataToExport = isFiltering ? filteredData : requests;

      // Create table rows
      const rows = dataToExport.map(request => {
        // Find the tool details from the tools array
        const tool = tools.find(t => t.id === request.tool_sl_no) || {};
        
        // Format tool details exactly as in the main table
        const toolDetails = [
          tool.name || '',
          `Serial No: ${request.tool_sl_no}`,
          `Range: ${tool.range || ''}`,
          `ID Code: ${tool.identificationCode || ''}`,
          `Location: ${tool.location || ''}`
        ].join('\n');

        // Format operator details exactly as in the main table
        const operatorDetails = [
          request.operator_name || '',
          `ID: ${request.operator_id || ''}`,
          `Department: ${request.department || ''}`,
          `Contact: ${request.contact || ''}`
        ].join('\n');

        // Format date to show only date part (no time)
        const formattedDate = new Date(request.request_date).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });

        return [
          toolDetails,
          operatorDetails,
          formattedDate,
          request.purpose || '',
          request.project_details || '',
          request.status.toUpperCase()
        ];
      });

      // Table configuration
      const startY = 28;
      const headers = ['Tool Details', 'Operator Details', 'Request Date', 'Purpose', 'Project Details', 'Status'];
      
      // Calculate column widths based on content
      const maxContentLengths = rows.reduce((acc, row) => {
        row.forEach((cell, index) => {
          const cellLines = cell.split('\n');
          const maxLineLength = Math.max(...cellLines.map(line => line.length));
          acc[index] = Math.max(acc[index] || 0, maxLineLength);
        });
        return acc;
      }, headers.map(h => h.length));

      // Adjust column widths proportionally
      const totalWidth = 250;
      const minColWidth = 25;
      const colWidths = maxContentLengths.map(length => {
        return Math.max(minColWidth, Math.min(60, (length * 2.5)));
      });

      // Normalize column widths to fit total width
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

      // Save with timestamp to avoid caching issues
      const timestamp = new Date().getTime();
      doc.save(`tool-requests-report-${timestamp}.pdf`);
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
            <Text strong>Date Range:</Text>
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
            disabled={requests.length === 0}
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
          No tool request data is available for the specified dates.
        </p>
      </Modal>
    </>
  );
};

export default ToolRequestsHistory;
