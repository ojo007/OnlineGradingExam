import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, useNavigate } from 'react-router-dom';
import AppRoutes from './routes';

// We need to wrap our main component in a Router context provider
// and use a child component that can access the useNavigate hook
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

// This component will have access to routing hooks
function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated on app load
    const checkAuth = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        setIsAuthenticated(false);
        setUserRole(null);
        setLoading(false);
        return;
      }

      try {
        // Verify token by making a request to the backend
        const response = await fetch('http://localhost:8000/api/v1/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Token invalid');
        }

        const userData = await response.json();
        setIsAuthenticated(true);
        setUserRole(userData.role);
      } catch (error) {
        console.error('Authentication error:', error);
        // Clear invalid token
        localStorage.removeItem('token');
        setIsAuthenticated(false);
        setUserRole(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Function to handle login
  const handleLogin = (token, role) => {
    console.log('handleLogin called with role:', role);
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
    setUserRole(role);
  };

  // Function to handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setUserRole(null);
    // Important: Navigate to login page after logout
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AppRoutes
      isAuthenticated={isAuthenticated}
      userRole={userRole}
      onLogin={handleLogin}
      onLogout={handleLogout}
    />
  );
}

export default App;