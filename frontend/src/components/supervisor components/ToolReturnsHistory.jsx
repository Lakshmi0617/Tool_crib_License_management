import React, { useState, useEffect } from 'react';
import {
  Space,
  Button,
  DatePicker,
  message,
  Typography,
  Modal
} from 'antd';
import {
  DownloadOutlined,
  FilterOutlined,
  ReloadOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const ToolReturnsHistory = ({ returns = [], onFilterChange, tools = [] }) => {
  const [dateRange, setDateRange] = useState(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [noDataModalVisible, setNoDataModalVisible] = useState(false);

  // Function to filter data based on date range
  const filterDataByDateRange = (data, range) => {
    if (!range || !range[0] || !range[1]) return data;

    const startDateTime = range[0].startOf('day').toDate();
    const endDateTime = range[1].endOf('day').toDate();

    return data.filter(item => {
      const requestDate = new Date(item.request_date);
      return requestDate >= startDateTime && requestDate <= endDateTime;
    });
  };

  // Handle date range changes
  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    setIsFiltering(!!dates);

    if (!dates) {
      onFilterChange(returns);
      return;
    }

    const filtered = filterDataByDateRange(returns, dates);
    onFilterChange(filtered);

    // Show modal if no data available for selected dates
    if (filtered.length === 0) {
      setNoDataModalVisible(true);
    }
  };

  // Handle modal close - Reset everything and show all data immediately
  const handleModalClose = () => {
    setNoDataModalVisible(false);
    setDateRange(null);
    setIsFiltering(false);
    onFilterChange(returns); // Immediately update with all data
  };

  // Effect to handle auto-refresh updates
  useEffect(() => {
    if (!isFiltering) {
      onFilterChange(returns);
    } else if (dateRange) {
      const filtered = filterDataByDateRange(returns, dateRange);
      onFilterChange(filtered);
    }
  }, [returns]);

  // Handle show all - Reset everything and show all data immediately
  const handleShowAll = () => {
    setDateRange(null);
    setIsFiltering(false);
    onFilterChange(returns); // Immediately update with all data
  };

  const downloadPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      // Title with date range
      doc.setFontSize(14);
      doc.text('Tool Returns History Report', 15, 15);

      // Format date range for display
      let dateRangeText = 'All Dates';
      if (dateRange) {
        const startDateStr = dateRange[0].format('DD MMM YYYY');
        const endDateStr = dateRange[1].format('DD MMM YYYY');
        dateRangeText = `${startDateStr} to ${endDateStr}`;
        
        doc.setFontSize(10);
        doc.text(`Report Period: ${dateRangeText}`, 15, 22);
      }

      // Use filtered data if filtering is active, otherwise use all returns
      const dataToExport = isFiltering ? filterDataByDateRange(returns, dateRange) : returns;

      // Define the columns for the PDF
      const columns = [
        'Tool Details',
        'Operator Details',
        'Purpose',
        'Project Details',
        'Request Date',
        'Condition',
        'Remarks',
        'Supervisor Details',
        'Status'
      ];

      // Prepare the data
      const rows = dataToExport.map(item => {
        const tool = tools.find(t => t.id === item.tool_sl_no) || {};
        
        // Format tool details
        const toolDetails = [
          tool.name || 'Unknown',
          `SN: ${item.tool_sl_no}`,
          `Range: ${tool.range || 'N/A'}`,
          `ID Code: ${tool.identificationCode || 'N/A'}`,
          `Location: ${tool.location || 'N/A'}`
        ].join('\n');

        // Format operator details
        const operatorDetails = [
          item.operator_name || 'N/A',
          `ID: ${item.operator_id || 'N/A'}`,
          `Dept: ${item.department || 'N/A'}`,
          `Contact: ${item.contact || 'N/A'}`
        ].join('\n');

        // Format supervisor details
        const supervisorDetails = [
          item.supervisor_name || 'N/A',
          `ID: ${item.supervisor_id || 'N/A'}`
        ].join('\n');

        return [
          toolDetails,
          operatorDetails,
          item.purpose || '-',
          item.project_details || '-',
          new Date(item.request_date).toLocaleDateString('en-GB'),
          item.condition_on_return || '-',
          item.remarks || '-',
          supervisorDetails,
          item.status.toUpperCase()
        ];
      });

      // Generate the table using the imported autoTable
      autoTable(doc, {
        head: [columns],
        body: rows,
        startY: 28,
        styles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 35 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
          5: { cellWidth: 25 },
          6: { cellWidth: 25 },
          7: { cellWidth: 30 },
          8: { cellWidth: 20 }
        },
        headStyles: {
          fillColor: [30, 136, 229],
          textColor: 255,
          fontSize: 8,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        margin: { top: 15 }
      });

      // Save with timestamp to avoid caching issues
      const timestamp = new Date().getTime();
      doc.save(`tool-returns-history-${timestamp}.pdf`);
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
            onClick={downloadPDF}
            disabled={returns.length === 0}
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
          No tool return data is available for the specified dates.
        </p>
      </Modal>
    </>
  );
};

export default ToolReturnsHistory;
