import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Space, message } from 'antd';
import { UserOutlined, LockOutlined, DesktopOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        message.success('Login successful!');
        navigate('/dashboard');
      } else {
        const errorData = await response.json();
        message.error(errorData.error || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      message.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #232f3e 0%, #37475a 100%)',
      }}
    >
      <Card
        style={{
          width: 450,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          borderRadius: 12,
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          {/* Logo and Title */}
          <div>
            <DesktopOutlined
              style={{
                fontSize: 48,
                color: '#ff9900',
                marginBottom: 16,
              }}
            />
            <Title level={2} style={{ margin: 0, color: '#232f3e' }}>
              WorkSpaces Inventory
            </Title>
            <Text type="secondary">Sign in to your account</Text>
          </div>

          {/* Login Form */}
          <Form
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
            layout="vertical"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: 'Please input your username!' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: 'rgba(0,0,0,.25)' }} />}
                placeholder="Username"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please input your password!' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: 'rgba(0,0,0,.25)' }} />}
                placeholder="Password"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{
                  height: 45,
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                Sign In
              </Button>
            </Form.Item>
          </Form>

          {/* Footer Text */}
          <div style={{ marginTop: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Default credentials: admin / Admin@2024
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
}

export default Login;
