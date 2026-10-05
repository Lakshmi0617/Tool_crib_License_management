// App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import RegisterPage from './components/RegisterPage'
import OperatorDashboard from './components/OperatorDashboard'
import SupervisorDashboard from './components/SupervisorDashboard'
import OfficerDashboard from './components/OfficerDashboard'
import LicenseModal from './components/LicenseModal'
import LicenseBanner from './components/LicenseBanner'
import './App.css'

// API base URL
const API_BASE_URL = 'http://localhost:8000';

// Global handler for automatic logout on session expiration
let globalLogoutHandler = null;
let globalLicenseErrorHandler = null;

// Utility function for making API calls with JWT Authorization and License Check
export const fetchApi = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

  const defaultOptions = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...authHeaders,
    },
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      detail: 'An error occurred while fetching data.'
    }));

    // Handle 401 Unauthorized (JWT Token Expired or Invalid)
    if (response.status === 401) {
      if (globalLogoutHandler) {
        globalLogoutHandler('Session expired or token invalid. Please log in again.');
      }
      throw new Error(errorData.detail || 'Session expired. Please log in again.');
    }

    // Handle 403 Forbidden due to License Error
    if (response.status === 403 && (errorData.code === 'LICENSE_EXPIRED' || errorData.code === 'LICENSE_INVALID')) {
      if (globalLicenseErrorHandler) {
        globalLicenseErrorHandler(errorData.detail || 'Software License Required.');
      }
      throw new Error(errorData.detail || 'Software License Invalid or Expired.');
    }

    throw new Error(errorData.detail || 'An error occurred while fetching the data.');
  }

  return response.json();
};

function App() {
  const [userInfo, setUserInfo] = useState(null);
  const [licenseBlocking, setLicenseBlocking] = useState(false);
  const [licenseLoading, setLicenseLoading] = useState(true);
  const [licenseStatusInfo, setLicenseStatusInfo] = useState(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  // Inactivity timeout in milliseconds (15 minutes)
  const INACTIVITY_TIMEOUT = 15 * 60 * 1000;

  // Helper function to parse JWT token
  const parseJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error parsing JWT:', error);
      return null;
    }
  };

  const handleLogout = useCallback((message) => {
    const empId = userInfo?.employee_id || JSON.parse(localStorage.getItem('user') || '{}')?.employee_id;
    if (empId) {
      // Call logout endpoint asynchronously
      fetch(`${API_BASE_URL}/logout?employee_id=${encodeURIComponent(empId)}`, { method: 'POST' }).catch(() => { });
    }

    setUserInfo(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastActivity');

    if (message) {
      alert(message);
    }
  }, [userInfo]);

  const handleLicenseError = useCallback((message) => {
    setLicenseBlocking(true);
  }, []);

  // Register global handlers
  useEffect(() => {
    globalLogoutHandler = handleLogout;
    globalLicenseErrorHandler = handleLicenseError;
  }, [handleLogout, handleLicenseError]);

  // Check Software License Status on startup and periodically
  const checkLicenseStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/license/status`).then(r => r.json());
      setLicenseStatusInfo(res);
      if (!res.is_valid) {
        setLicenseBlocking(true);
      } else {
        setLicenseBlocking(false);
      }
    } catch (e) {
      console.error('Failed to check license status:', e);
      setLicenseBlocking(true);
    } finally {
      setLicenseLoading(false);
    }
  };

  useEffect(() => {
    checkLicenseStatus();
    const interval = setInterval(checkLicenseStatus, 5 * 60 * 1000); // Check every 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Load user info from localStorage on initial mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const lastActivity = localStorage.getItem('lastActivity');

    if (token && storedUser && lastActivity) {
      try {
        const parsedUser = JSON.parse(storedUser);
        const tokenData = parseJwt(token);
        const now = Date.now();
        const lastActivityTime = parseInt(lastActivity, 10);

        // Check if session is valid (JWT not expired and inactivity threshold not exceeded)
        if (tokenData &&
          tokenData.exp * 1000 > now &&
          (now - lastActivityTime) < INACTIVITY_TIMEOUT) {
          setUserInfo(parsedUser);
          localStorage.setItem('lastActivity', now.toString());
        } else {
          handleLogout('Session expired. Please log in again.');
        }
      } catch (error) {
        console.error('Error loading stored session:', error);
        handleLogout();
      }
    }
  }, []);

  // Track User Activity for Automatic Inactivity Logout
  useEffect(() => {
    if (!userInfo) return;

    const resetInactivityTimer = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
    };

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach(event => window.addEventListener(event, resetInactivityTimer));

    // Periodic check for inactivity timeout and real-time JWT token expiry
    const inactivityInterval = setInterval(() => {
      const token = localStorage.getItem('token');
      const lastActivity = localStorage.getItem('lastActivity');
      const now = Date.now();

      if (token && lastActivity) {
        const tokenData = parseJwt(token);
        const lastActivityTime = parseInt(lastActivity, 10);

        // 1. JWT Expiration Check
        if (!tokenData || tokenData.exp * 1000 <= now) {
          handleLogout('Your JWT session token has expired. You have been automatically logged out.');
          return;
        }

        // 2. Inactivity Timeout Check
        if ((now - lastActivityTime) >= INACTIVITY_TIMEOUT) {
          handleLogout('You have been automatically logged out due to 15 minutes of inactivity.');
          return;
        }
      }
    }, 10000); // Check every 10 seconds

    return () => {
      activityEvents.forEach(event => window.removeEventListener(event, resetInactivityTimer));
      clearInterval(inactivityInterval);
    };
  }, [userInfo, handleLogout]);

  const handleLogin = (data) => {
    const userObj = data.user || data;
    const tokenStr = data.access_token || data.token;
    setUserInfo(userObj);
    localStorage.setItem('user', JSON.stringify(userObj));
    localStorage.setItem('token', tokenStr);
    localStorage.setItem('lastActivity', Date.now().toString());
  };

  const getDashboardPath = (role) => {
    switch (role?.toLowerCase()) {
      case 'operator':
        return '/operator-dashboard';
      case 'supervisor':
        return '/supervisor-dashboard';
      case 'officer':
        return '/officer-dashboard';
      default:
        return '/login';
    }
  };

  const isAuthorized = (requiredRole) => {
    const token = localStorage.getItem('token');
    const lastActivity = localStorage.getItem('lastActivity');
    if (!userInfo || !token || !lastActivity) return false;

    const now = Date.now();
    const lastActivityTime = parseInt(lastActivity, 10);
    const tokenData = parseJwt(token);

    if (!tokenData ||
      tokenData.exp * 1000 <= now ||
      (now - lastActivityTime) >= INACTIVITY_TIMEOUT) {
      return false;
    }

    if (requiredRole && userInfo.role.toLowerCase() !== requiredRole) return false;
    return true;
  };

  if (licenseLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#0f172a',
        color: '#ffffff',
        fontFamily: "'Segoe UI', Roboto, sans-serif"
      }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '12px' }}>
          🔒 Verifying Software License...
        </div>
        <div style={{ opacity: 0.7, fontSize: '0.95rem' }}>
          Checking license key activation for this machine...
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div style={{
        width: '100vw',
        minHeight: '100vh',
        margin: 0,
        padding: 0,
        overflow: 'hidden'
      }}>
        {/* License Expiration Banner */}
        <LicenseBanner
          statusInfo={licenseStatusInfo}
          onOpenModal={() => setShowLicenseModal(true)}
        />

        {/* Blocking License Modal if Unlicensed or Expired */}
        <LicenseModal
          isOpen={showLicenseModal || licenseBlocking}
          isBlocking={licenseBlocking}
          onClose={() => setShowLicenseModal(false)}
          onActivated={() => {
            setLicenseBlocking(false);
            setShowLicenseModal(false);
            checkLicenseStatus();
          }}
        />

        {!licenseBlocking && (
          <Routes>
            {/* Login Routes */}
            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="/login" element={
              userInfo ? <Navigate to={getDashboardPath(userInfo.role)} /> :
                <RegisterPage onLogin={handleLogin} isRegister={false} />
            } />
            <Route path="/register" element={<RegisterPage onLogin={handleLogin} isRegister={true} />} />
            <Route path="/forgot-password" element={<RegisterPage onLogin={handleLogin} isRegister={false} showResetForm={true} />} />

            {/* Dashboard Routes with role-based authorization */}
            <Route path="/operator-dashboard" element={
              isAuthorized('operator') ?
                <OperatorDashboard userInfo={userInfo} onLogout={handleLogout} /> :
                <Navigate to="/login" />
            } />
            <Route path="/supervisor-dashboard" element={
              isAuthorized('supervisor') ?
                <SupervisorDashboard userInfo={userInfo} onLogout={handleLogout} /> :
                <Navigate to="/login" />
            } />
            <Route path="/officer-dashboard" element={
              isAuthorized('officer') ?
                <OfficerDashboard userInfo={userInfo} onLogout={handleLogout} onOpenLicenseModal={() => setShowLicenseModal(true)} /> :
                <Navigate to="/login" />
            } />
          </Routes>
        )}
      </div>
    </Router>
  );
}

export default App;
