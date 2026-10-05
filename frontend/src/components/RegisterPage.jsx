import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, User, Lock, Building, Phone, Briefcase, Award, Mail, MapPin } from 'lucide-react';
import { Modal } from 'antd';
import cmtiLogo from '../assets/cmtis.png';
import loginBg from '../assets/login.png';
import { API_BASE_URL } from '../config';

const RegisterPage = ({ onLogin, isRegister = false, showResetForm: initialShowReset = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isRegisterMode = isRegister || location.pathname === '/register';

  // Login & Shared state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResetForm, setShowResetForm] = useState(initialShowReset);
  const [resetToken, setResetToken] = useState('');
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');

  // Register state
  const [regEmployeeId, setRegEmployeeId] = useState('');
  const [regEmployeeName, setRegEmployeeName] = useState('');
  const [regRole, setRegRole] = useState('operator');
  const [regDepartment, setRegDepartment] = useState('');
  const [regContact, setRegContact] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCompanyOption, setRegCompanyOption] = useState('');
  const [regCustomCompanyName, setRegCustomCompanyName] = useState('');
  const [regCompanyEmail, setRegCompanyEmail] = useState('');
  const [regCompanyAddress, setRegCompanyAddress] = useState('');
  const [companies, setCompanies] = useState([]);

  // Form refs for login
  const employeeIdRef = useRef();
  const passwordRef = useRef();
  const newPasswordRef = useRef();

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser && !isRegisterMode) {
      try {
        const user = JSON.parse(storedUser);
        const dashboardPath = `/${user.role.toLowerCase()}-dashboard`;
        navigate(dashboardPath);
      } catch (error) {
        console.error('Error parsing stored user:', error);
      }
    }
  }, [isRegisterMode, navigate]);

  useEffect(() => {
    // Fetch companies for registration dropdown
    const fetchCompanies = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/companies`);
        if (response.ok) {
          const data = await response.json();
          setCompanies(data);
        }
      } catch (err) {
        console.error('Failed to fetch companies:', err);
      }
    };
    fetchCompanies();
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

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      let targetCompanyId = null;

      if (regCompanyOption === 'new') {
        if (!regCustomCompanyName.trim()) {
          setError('Please enter a valid company name.');
          setIsLoading(false);
          return;
        }

        // Check if existing company matches
        const existingComp = companies.find(
          c => c.company_name.toLowerCase() === regCustomCompanyName.trim().toLowerCase()
        );

        if (existingComp) {
          targetCompanyId = existingComp.id;
        } else {
          // Create new company
          const createCompRes = await fetch(`${API_BASE_URL}/companies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              company_name: regCustomCompanyName.trim(),
              address: regCompanyAddress.trim(),
              phone: regContact || '',
              email: regCompanyEmail.trim()
            })
          });

          if (!createCompRes.ok) {
            const compErr = await createCompRes.json();
            throw new Error(compErr.detail || 'Failed to create company.');
          }

          const newCompData = await createCompRes.json();
          targetCompanyId = newCompData.id;
        }
      } else if (regCompanyOption) {
        targetCompanyId = parseInt(regCompanyOption, 10);
      } else {
        setError('Please select or specify a company.');
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: regEmployeeId,
          employee_name: regEmployeeName,
          role: regRole,
          department: regDepartment,
          contact: regContact,
          company_id: targetCompanyId,
          email: regCompanyEmail.trim(),
          address: regCompanyAddress.trim(),
          password: regPassword
        })
      });

      if (response.ok) {
        setSuccess('Registration successful! Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 1500);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Registration failed. Please try again.');
      }
    } catch (error) {
      setError(error.message || 'Network error during registration.');
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
        padding: '35px 40px',
        width: '100%',
        maxWidth: isRegisterMode ? '520px' : '450px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        position: 'relative',
        zIndex: 1,
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* CMTI Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          <img
            src={cmtiLogo}
            alt="CMTI Logo"
            style={{
              width: '140px',
              height: 'auto',
              marginBottom: '10px'
            }}
          />
          <h2 style={{
            color: '#1e293b',
            margin: '0',
            fontSize: '22px',
            fontWeight: '600'
          }}>Tool Crib Management System</h2>
          <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '14px' }}>
            {isRegisterMode ? 'Create a new user account' : 'Sign in to access your dashboard'}
          </p>
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
          style={{ top: '30%' }}
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p style={{ margin: 0, color: '#1f2937', fontSize: '16px', lineHeight: '1.5' }}>
              {errorModalMessage}
            </p>
          </div>
        </Modal>

        {isRegisterMode ? (
          /* Registration Form */
          <form onSubmit={handleRegister}>
            {error && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <span style={{ color: '#dc2626', fontSize: '14px' }}>{error}</span>
              </div>
            )}

            {success && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <span style={{ color: '#16a34a', fontSize: '14px' }}>{success}</span>
              </div>
            )}

            {/* Employee ID */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#374151', fontSize: '14px', fontWeight: '600' }}>
                Employee ID
              </label>
              <div style={{ position: 'relative' }}>
                <User style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                <input
                  type="text"
                  value={regEmployeeId}
                  onChange={(e) => setRegEmployeeId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 42px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '15px',
                    backgroundColor: '#f9fafb',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter employee ID"
                  required
                />
              </div>
            </div>

            {/* Employee Name */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#374151', fontSize: '14px', fontWeight: '600' }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <Award style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                <input
                  type="text"
                  value={regEmployeeName}
                  onChange={(e) => setRegEmployeeName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 42px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '15px',
                    backgroundColor: '#f9fafb',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter full name"
                  required
                />
              </div>
            </div>

            {/* Role */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#374151', fontSize: '14px', fontWeight: '600' }}>
                Role
              </label>
              <div style={{ position: 'relative' }}>
                <Briefcase style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 42px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '15px',
                    backgroundColor: '#f9fafb',
                    boxSizing: 'border-box',
                    cursor: 'pointer'
                  }}
                  required
                >
                  <option value="operator">Operator</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="officer">Officer</option>
                </select>
              </div>
            </div>

            {/* Department */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#374151', fontSize: '14px', fontWeight: '600' }}>
                Department
              </label>
              <div style={{ position: 'relative' }}>
                <Building style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                <input
                  type="text"
                  value={regDepartment}
                  onChange={(e) => setRegDepartment(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 42px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '15px',
                    backgroundColor: '#f9fafb',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter department name"
                  required
                />
              </div>
            </div>

            {/* Contact */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#374151', fontSize: '14px', fontWeight: '600' }}>
                Contact Number
              </label>
              <div style={{ position: 'relative' }}>
                <Phone style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                <input
                  type="text"
                  value={regContact}
                  onChange={(e) => setRegContact(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 42px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '15px',
                    backgroundColor: '#f9fafb',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter 10-digit contact number"
                  pattern="\d{10}"
                  required
                />
              </div>
            </div>

            {/* Email ID */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#374151', fontSize: '14px', fontWeight: '600' }}>
                Email ID
              </label>
              <div style={{ position: 'relative' }}>
                <Mail style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                <input
                  type="email"
                  value={regCompanyEmail}
                  onChange={(e) => setRegCompanyEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 42px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '15px',
                    backgroundColor: '#f9fafb',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter email ID"
                  required
                />
              </div>
            </div>

            {/* Company Select/New */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#374151', fontSize: '14px', fontWeight: '600' }}>
                Company Name
              </label>
              <div style={{ position: 'relative' }}>
                <Building style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                <select
                  value={regCompanyOption}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRegCompanyOption(val);
                    if (val && val !== 'new') {
                      const selectedComp = companies.find(c => c.id === parseInt(val, 10));
                      if (selectedComp) {
                        if (selectedComp.email && !selectedComp.email.startsWith('info@')) {
                          setRegCompanyEmail(selectedComp.email);
                        }
                        if (selectedComp.address) {
                          setRegCompanyAddress(selectedComp.address);
                        }
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 42px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '15px',
                    backgroundColor: '#f9fafb',
                    boxSizing: 'border-box',
                    cursor: 'pointer'
                  }}
                  required
                >
                  <option value="">-- Select Company --</option>
                  {companies.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.company_name}
                    </option>
                  ))}
                  <option value="new">+ Add New Company</option>
                </select>
              </div>
            </div>

            {/* Custom Company Name (if new chosen) */}
            {regCompanyOption === 'new' && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '6px', color: '#374151', fontSize: '14px', fontWeight: '600' }}>
                  New Company Name
                </label>
                <input
                  type="text"
                  value={regCustomCompanyName}
                  onChange={(e) => setRegCustomCompanyName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '15px',
                    backgroundColor: '#f9fafb',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter new company name"
                  required
                />
              </div>
            )}

            {/* Company Address */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#374151', fontSize: '14px', fontWeight: '600' }}>
                Company Address
              </label>
              <div style={{ position: 'relative' }}>
                <MapPin style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                <input
                  type="text"
                  value={regCompanyAddress}
                  onChange={(e) => setRegCompanyAddress(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 42px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '15px',
                    backgroundColor: '#f9fafb',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Enter company address"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#374151', fontSize: '14px', fontWeight: '600' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 42px 10px 42px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    fontSize: '15px',
                    backgroundColor: '#f9fafb',
                    boxSizing: 'border-box'
                  }}
                  placeholder="Set password (min 6 characters)"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9ca3af'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                background: isLoading ? '#9ca3af' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: 'white',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                marginBottom: '16px'
              }}
            >
              {isLoading ? 'Creating Account...' : 'Register'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <span style={{ color: '#64748b', fontSize: '14px' }}>Already have an account? </span>
              <Link
                to="/login"
                style={{
                  color: '#4f46e5',
                  fontWeight: '600',
                  textDecoration: 'none'
                }}
              >
                Sign In
              </Link>
            </div>
          </form>
        ) : showResetForm ? (
          /* Reset Password Form */
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
                type="button"
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
          /* Login Form */
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
                marginBottom: '16px'
              }}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <span style={{ color: '#64748b', fontSize: '14px' }}>Don't have an account? </span>
              <Link
                to="/register"
                style={{
                  color: '#4f46e5',
                  fontWeight: '600',
                  textDecoration: 'none'
                }}
              >
                Register
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default RegisterPage;