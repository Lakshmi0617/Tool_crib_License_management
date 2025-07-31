import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { Modal } from 'antd';
import axios from 'axios';
import cmtiLogo from '../assets/cmtis.png';
import loginBg from '../assets/login.png';

const API_BASE_URL = 'http://172.18.100.33:8000';

const LoginPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [success, setSuccess] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');

  // Form refs
  const employeeIdRef = useRef();
  const passwordRef = useRef();
  const newPasswordRef = useRef();

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      try {
        const user = JSON.parse(storedUser);
        const dashboardPath = `/${user.role.toLowerCase()}-dashboard`;
        navigate(dashboardPath);
      } catch (error) {
        console.error('Error parsing stored user:', error);
      }
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: employeeIdRef.current.value,
          password: passwordRef.current.value
        })
      });

      if (response.ok) {
        const userData = await response.json();
        onLogin(userData.user);
        localStorage.setItem('token', userData.access_token);
        localStorage.setItem('user', JSON.stringify(userData.user));
        
        // Navigate based on role
        const dashboardPath = `/${userData.user.role.toLowerCase()}-dashboard`;
        navigate(dashboardPath);
      } else {
        const errorData = await response.json();
        if (errorData.detail && (errorData.detail.includes('supervisor') || errorData.detail.includes('officer'))) {
          // Show modal for supervisor/officer already logged in
          setErrorModalMessage(errorData.detail);
          setErrorModalVisible(true);
        } else {
          setError(errorData.detail || 'Login failed. Please check your credentials.');
        }
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!employeeIdRef.current.value) {
      setError('Please enter your Employee ID');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_BASE_URL}/forgot-password?employee_id=${employeeIdRef.current.value}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (response.ok) {
        setResetToken(data.reset_token);
        setShowResetForm(true);
        setSuccess('Reset token generated. Please enter your new password.');
      } else {
        setError(data.detail || 'Failed to process request.');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const newPassword = newPasswordRef.current.value;
    
    if (!newPassword) {
      setError('Please enter a new password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/reset-password?token=${resetToken}&new_password=${newPassword}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        setSuccess('Password updated successfully!');
        setTimeout(() => {
          setShowResetForm(false);
          setResetToken('');
          setSuccess('');
          navigate('/login');
        }, 2000);
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to reset password.');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundImage: `url(${loginBg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      padding: '20px'
    }}>
      {/* Add a blur overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backdropFilter: 'blur(8px)',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
      }} />
      
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '20px',
        padding: '40px',
        width: '100%',
        maxWidth: '450px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        position: 'relative',
        zIndex: 1
      }}>
        {/* CMTI Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: '30px'
        }}>
          <img 
            src={cmtiLogo} 
            alt="CMTI Logo" 
            style={{
              width: '150px',
              height: 'auto',
              marginBottom: '15px'
            }}
          />
          <h2 style={{
            color: '#1e293b',
            margin: '0',
            fontSize: '24px',
            fontWeight: '600'
          }}>Tool Crib Management System</h2>
        </div>

        {/* Error Modal */}
        <Modal
          title={<span style={{ color: '#dc2626', fontWeight: 600 }}>Access Denied</span>}
          open={errorModalVisible}
          onOk={() => setErrorModalVisible(false)}
          onCancel={() => setErrorModalVisible(false)}
          okText="OK"
          cancelButtonProps={{ style: { display: 'none' } }}
          centered
          maskClosable={false}
          style={{
            top: '30%'
          }}
          bodyStyle={{
            padding: '20px',
            fontSize: '16px',
            textAlign: 'center'
          }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '8px'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p style={{
              margin: 0,
              color: '#1f2937',
              fontSize: '16px',
              lineHeight: '1.5'
            }}>{errorModalMessage}</p>
          </div>
        </Modal>

        {showResetForm ? (
          // Reset Password Form
          <form onSubmit={handleResetPassword}>
            {success && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px'
              }}>
                <span style={{ color: '#16a34a' }}>{success}</span>
              </div>
            )}

            {!resetToken && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>Employee ID</label>
                <div style={{ position: 'relative' }}>
                  <User style={{
                    position: 'absolute',
                    left: '15px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af'
                  }} size={20} />
                  <input
                    type="text"
                    ref={employeeIdRef}
                    style={{
                      width: '100%',
                      padding: '12px 45px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '12px',
                      fontSize: '16px',
                      backgroundColor: '#f9fafb',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Enter your employee ID"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>
            )}

            {resetToken && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                <p style={{ color: '#475569', marginBottom: '8px' }}>Your Reset Token:</p>
                <code style={{
                  background: '#f1f5f9',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  color: '#0f172a',
                  fontSize: '16px',
                  wordBreak: 'break-all'
                }}>{resetToken}</code>
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#374151',
                fontSize: '14px',
                fontWeight: '600'
              }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock style={{
                  position: 'absolute',
                  left: '15px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }} size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  ref={newPasswordRef}
                  style={{
                    width: '100%',
                    padding: '12px 45px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '16px',
                    backgroundColor: '#f9fafb',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter your new password"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle-button"
                  style={{
                    position: 'absolute',
                    right: '15px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9ca3af'
                  }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px'
              }}>
                <span style={{ color: '#dc2626' }}>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                background: isLoading ? '#9ca3af' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: 'white',
                border: 'none',
                padding: '14px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                marginBottom: '20px'
              }}
            >
              {isLoading ? 'Resetting Password...' : 'Reset Password'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => {
                  setShowResetForm(false);
                  setResetToken('');
                  setError('');
                  setSuccess('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4f46e5',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Back to Login
              </button>
            </div>
          </form>
        ) : (
          // Login Form
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#374151',
                fontSize: '14px',
                fontWeight: '600'
              }}>Employee ID</label>
              <div style={{ position: 'relative' }}>
                <User style={{
                  position: 'absolute',
                  left: '15px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }} size={20} />
                <input
                  type="text"
                  ref={employeeIdRef}
                  style={{
                    width: '100%',
                    padding: '12px 45px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '16px',
                    backgroundColor: '#f9fafb',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter your employee ID"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#374151',
                fontSize: '14px',
                fontWeight: '600'
              }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock style={{
                  position: 'absolute',
                  left: '15px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }} size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  ref={passwordRef}
                  style={{
                    width: '100%',
                    padding: '12px 45px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    fontSize: '16px',
                    backgroundColor: '#f9fafb',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle-button"
                  style={{
                    position: 'absolute',
                    right: '15px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9ca3af'
                  }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px'
              }}>
                <span style={{ color: '#dc2626' }}>{error}</span>
              </div>
            )}

            {success && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px'
              }}>
                <span style={{ color: '#16a34a' }}>{success}</span>
              </div>
            )}

            <div style={{
              textAlign: 'right',
              marginBottom: '20px'
            }}>
              <button
                type="button"
                onClick={handleForgotPassword}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4f46e5',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                background: isLoading ? '#9ca3af' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: 'white',
                border: 'none',
                padding: '14px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                marginBottom: '20px'
              }}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;