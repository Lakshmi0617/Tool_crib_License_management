import React, { useState, useEffect } from 'react';
import {
  Card,
  Statistic,
  Space,
  Typography,
  Modal,
  Table,
  Tag,
  message
} from 'antd';
import {
  CheckCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Text } = Typography;

const ReturnedTools = ({ currentUserInfo, onCardClick }) => {
  const [categoryDetailsVisible, setCategoryDetailsVisible] = useState(false);
  const [categoryTools, setCategoryTools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [returnedCount, setReturnedCount] = useState(0);

  // Function to fetch and update returned tools data
  const fetchReturnedTools = async () => {
    if (!currentUserInfo?.employee_id) return;

    try {
      setLoading(true);
      
      const response = await fetch(`http://172.18.100.33:8000/api/tool-returns/operator/${currentUserInfo.employee_id}?status=collected`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const data = await response.json();
      setReturnedCount(data.length);
      setCategoryTools(data);
    } catch (error) {
      console.error('Error fetching returned tools:', error);
      message.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when component mounts or currentUserInfo changes
  useEffect(() => {
    fetchReturnedTools();
  }, [currentUserInfo]);

  const handleCardClick = () => {
    if (onCardClick) {
      onCardClick('returned');
    }
  };

  // Empty state component
  const EmptyState = () => (
    <div style={{ textAlign: 'center', padding: '24px' }}>
      <Space direction="vertical" size="large">
        <CheckCircleOutlined style={{ fontSize: '32px', color: '#52c41a' }} />
        <Text type="secondary" style={{ fontSize: '16px' }}>
          No tools have been returned yet
        </Text>
      </Space>
    </div>
  );

  return (
    <Card 
      hoverable 
      onClick={handleCardClick}
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
      }}
      bodyStyle={{ padding: '16px' }}
    >
      <Statistic
        title={
          <Space align="center" style={{ marginBottom: 8 }}>
            <CheckCircleOutlined style={{ fontSize: '20px', color: '#2e7d32' }} />
            <Text strong style={{ color: '#2e7d32', fontSize: '14px', fontFamily: 'Segoe UI, Roboto, sans-serif' }}>
              Returned Tools
            </Text>
          </Space>
        }
        value={returnedCount}
        valueStyle={{ color: '#2e7d32', fontSize: '28px', fontWeight: '600', fontFamily: 'Segoe UI, Roboto, sans-serif' }}
      />
    </Card>
  );
};

export default ReturnedTools;
