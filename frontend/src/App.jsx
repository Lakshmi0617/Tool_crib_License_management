// App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import axios from 'axios';
import RegisterPage from './components/RegisterPage'
import OperatorDashboard from './components/OperatorDashboard'
import SupervisorDashboard from './components/SupervisorDashboard'
import OfficerDashboard from './components/OfficerDashboard'
import './App.css'

// API base URL
const API_BASE_URL = 'http://172.18.100.33:8000';

// Utility function for making API calls
export const fetchApi = async (endpoint, options = {}) => {
  const defaultOptions = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
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
    const error = await response.json().catch(() => ({
      detail: 'An error occurred while fetching the data.'
    }));
    throw new Error(error.detail || 'An error occurred while fetching the data.');
  }

  return response.json();
};

function App() {
  const [userInfo, setUserInfo] = useState(null)

  // Session timeout in milliseconds (4 hours)
  const SESSION_TIMEOUT = 4 * 60 * 60 * 1000;

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

        // Check if the session is still valid (within timeout period and token not expired)
        if (tokenData && 
            tokenData.exp * 1000 > now && 
            (now - lastActivityTime) < SESSION_TIMEOUT) {
          setUserInfo(parsedUser);
          // Update last activity time
          localStorage.setItem('lastActivity', now.toString());
        } else {
          // Session expired, clear auth data
          handleLogout();
        }
      } catch (error) {
        console.error('Error parsing stored user:', error);
        handleLogout();
      }
    }
  }, []);

  // Update last activity time periodically while the app is open
  useEffect(() => {
    if (userInfo) {
      const activityInterval = setInterval(() => {
        localStorage.setItem('lastActivity', Date.now().toString());
      }, 60000); // Update every minute

      return () => clearInterval(activityInterval);
    }
  }, [userInfo]);

  // Helper function to parse JWT token
  const parseJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error parsing JWT:', error);
      return null;
    }
  };

  const handleLogin = (data) => {
    setUserInfo(data);
    localStorage.setItem('user', JSON.stringify(data));
    localStorage.setItem('token', data.token);
    localStorage.setItem('lastActivity', Date.now().toString());
  }

  const handleLogout = () => {
    setUserInfo(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastActivity');
  }

  // Function to redirect based on user role
  const getDashboardPath = (role) => {
    switch(role?.toLowerCase()) {
      case 'operator':
        return '/operator-dashboard'
      case 'supervisor':
        return '/supervisor-dashboard'
      case 'officer':
        return '/officer-dashboard'
      default:
        return '/login'
    }
  }

  // Function to check if user is authenticated and has correct role
  const isAuthorized = (requiredRole) => {
    const token = localStorage.getItem('token');
    const lastActivity = localStorage.getItem('lastActivity');
    if (!userInfo || !token || !lastActivity) return false;
    
    // Check session validity
    const now = Date.now();
    const lastActivityTime = parseInt(lastActivity, 10);
    const tokenData = parseJwt(token);
    
    if (!tokenData || 
        tokenData.exp * 1000 <= now || 
        (now - lastActivityTime) >= SESSION_TIMEOUT) {
      handleLogout();
      return false;
    }
    
    if (requiredRole && userInfo.role.toLowerCase() !== requiredRole) return false;
    return true;
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
              <OfficerDashboard userInfo={userInfo} onLogout={handleLogout} /> : 
              <Navigate to="/login" />
          } />
        </Routes>
      </div>
    </Router>
  )
}

export default App
