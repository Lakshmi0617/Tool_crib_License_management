import React, { useState, useEffect } from 'react';
import { Card, Statistic, Space, Typography, message } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import axios from 'axios';
import { getAuthHeaders } from '../../config';

const { Text } = Typography;

const ReportedIssues = ({ currentUserInfo, onCardClick }) => {
  const [issuesCount, setIssuesCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchIssuesCount = async () => {
    if (!currentUserInfo?.employee_id) return;

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8000/api/tool-issues/${currentUserInfo.employee_id}?officer_status=approved`, { headers: getAuthHeaders() });

      if (!response.ok) {
        throw new Error('Failed to fetch issues data');
      }

      const data = await response.json();
      setIssuesCount(data.length);
      // setIssues(data); // This line was not in the new_code, so it's removed.
    } catch (error) {
      console.error('Error fetching issues count:', error);
      message.error('Failed to fetch issues data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssuesCount();
  }, [currentUserInfo]);

  return (
    <Card
      hoverable
      onClick={() => onCardClick('issues')}
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
      }}
      bodyStyle={{ padding: '16px' }}
    >
      <Statistic
        title={
          <Space align="center" style={{ marginBottom: 8 }}>
            <WarningOutlined style={{ fontSize: '20px', color: '#c62828' }} />
            <Text strong style={{ color: '#c62828', fontSize: '14px', fontFamily: 'Segoe UI, Roboto, sans-serif' }}>
              Reported Issues
            </Text>
          </Space>
        }
        value={issuesCount}
        loading={false} // Never show loading state in the UI
        valueStyle={{
          color: '#c62828',
          fontSize: '28px',
          fontWeight: '600',
          fontFamily: 'Segoe UI, Roboto, sans-serif',
          opacity: loading ? 0.7 : 1, // Subtle opacity change during loading
          transition: 'opacity 0.3s ease' // Smooth transition for opacity changes
        }}
      />
    </Card>
  );
};

export default ReportedIssues; 