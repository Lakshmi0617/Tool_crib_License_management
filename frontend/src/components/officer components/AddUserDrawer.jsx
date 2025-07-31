import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
  notification,
  Divider,
  Table,
  Tag,
  Modal,
  Card,
  Drawer
} from 'antd';
import {
  UserOutlined,
  IdcardOutlined,
  PhoneOutlined,
  BankOutlined,
  LockOutlined,
  TeamOutlined,
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const AddUserDrawer = ({ visible, onClose }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('http://172.18.100.33:8000/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to fetch users',
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Initial fetch when component mounts
  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const response = await fetch('http://172.18.100.33:8000/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_name: values.employee_name,
          employee_id: values.employee_id,
          password: values.password,
          role: values.role,
          department: values.department,
          contact: values.contact
        })
      });

      if (response.ok) {
        notification.success({
          message: 'Success',
          description: 'User added successfully!',
        });
        form.resetFields();
        setShowAddForm(false);
        fetchUsers(); // Only refresh after successful add
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to add user');
      }
    } catch (error) {
      notification.error({
        message: 'Error',
        description: error.message || 'Failed to add user. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (employeeId) => {
    Modal.confirm({
      title: 'Delete User',
      content: 'Are you sure you want to delete this user?',
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          const response = await fetch(`http://172.18.100.33:8000/users/${employeeId}`, {
            method: 'DELETE',
          });
          if (!response.ok) throw new Error('Failed to delete user');
          notification.success({
            message: 'Success',
            description: 'User deleted successfully!',
          });
          fetchUsers(); // Only refresh after successful delete
        } catch (error) {
          notification.error({
            message: 'Error',
            description: 'Failed to delete user',
          });
        }
      },
    });
  };

  const columns = [
    {
      title: 'Employee ID',
      dataIndex: 'employee_id',
      key: 'employee_id',
      width: 120,
    },
    {
      title: 'Name',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 200,
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role) => (
        <Tag color={
          role === 'officer' ? 'blue' :
          role === 'supervisor' ? 'green' :
          'orange'
        }>
          {role.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      width: 150,
    },
    {
      title: 'Contact',
      dataIndex: 'contact',
      key: 'contact',
      width: 150,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.employee_id)}
            size="small"
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Space align="center" style={{ marginBottom: '16px', justifyContent: 'space-between', width: '100%' }}>
              <Space>
                <UserOutlined style={{ color: '#1890ff' }} />
                <Text strong>User Management</Text>
              </Space>
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setShowAddForm(true)}
                >
                  Add User
                </Button>
              </Space>
            </Space>
          </div>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="employee_id"
        loading={loading || refreshing}
        size="small"
        scroll={{ x: 900, y: 'calc(100vh - 280px)' }}
        pagination={{
          pageSize: 50,
          showTotal: (total) => `Total ${total} users`,
          showSizeChanger: true,
          pageSizeOptions: ['50', '100', '200', '500'],
        }}
      />

      <Drawer
        title={
          <Space>
            <PlusOutlined style={{ color: '#1890ff' }} />
            <Title level={4} style={{ margin: 0 }}>Add New User</Title>
          </Space>
        }
        width={520}
        onClose={() => setShowAddForm(false)}
        open={showAddForm}
        bodyStyle={{ paddingBottom: 80 }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ role: 'operator' }}
        >
          <div style={{ marginBottom: 24 }}>
            <Text type="secondary">
              Add new operator or supervisor details. All fields are required.
            </Text>
          </div>

          <Form.Item
            name="employee_name"
            label="Employee Name"
            rules={[{ required: true, message: 'Please enter employee name' }]}
          >
            <Input
              prefix={<UserOutlined className="site-form-item-icon" />}
              placeholder="Enter full name"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="employee_id"
            label="Employee ID"
            rules={[{ required: true, message: 'Please enter employee ID' }]}
          >
            <Input
              prefix={<IdcardOutlined className="site-form-item-icon" />}
              placeholder="Enter employee ID"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="department"
            label="Department"
            rules={[{ required: true, message: 'Please enter department' }]}
          >
            <Input
              prefix={<BankOutlined className="site-form-item-icon" />}
              placeholder="Enter department"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="contact"
            label="Contact Number"
            rules={[
              { required: true, message: 'Please enter contact number' },
              { pattern: /^\d{10}$/, message: 'Please enter a valid 10-digit number' }
            ]}
          >
            <Input
              prefix={<PhoneOutlined className="site-form-item-icon" />}
              placeholder="Enter 10-digit contact number"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Please select role' }]}
          >
            <Select
              size="large"
              placeholder="Select role"
              suffixIcon={<TeamOutlined />}
            >
              <Option value="operator">Operator</Option>
              <Option value="supervisor">Supervisor</Option>
              <Option value="officer">Officer</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="password"
            label="Initial Password"
            rules={[
              { required: true, message: 'Please enter initial password' },
              { min: 6, message: 'Password must be at least 6 characters' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="site-form-item-icon" />}
              placeholder="Set initial password"
              size="large"
            />
          </Form.Item>

          <Divider />

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                Add User
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default AddUserDrawer; 