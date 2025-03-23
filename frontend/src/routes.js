import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ExamCreator from './pages/ExamCreator';
import ExamView from './pages/ExamView';
import ResultsView from './pages/ResultsView';
import QuestionEditor from './pages/QuestionEditor';
import AllResults from './pages/AllResults';
import ExamList from './components/ExamList';
import Header from './components/Header';

// Protected route component
const ProtectedRoute = ({
  children,
  isAuthenticated,
  userRole,  // Added userRole parameter
  allowedRoles = [],
  redirectPath = '/login'
}) => {
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to login if not authenticated
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    // Redirect to dashboard if not authorized for this role
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const AppRoutes = ({ isAuthenticated, userRole, onLogin, onLogout }) => {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Login onLogin={onLogin} />
          )
        }
      />
      <Route
        path="/register"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Register />
          )
        }
      />

      {/* Protected routes for all authenticated users */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} userRole={userRole}>
            <Dashboard userRole={userRole} onLogout={onLogout} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/exams"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} userRole={userRole}>
            <>
              <Header isLoggedIn={isAuthenticated} userRole={userRole} />
              <div className="container mx-auto px-4 py-8">
                <ExamList userRole={userRole} />
              </div>
            </>
          </ProtectedRoute>
        }
      />

      {/* Student routes */}
      <Route
        path="/exams/:examId/take"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} userRole={userRole}>
            <ExamView />
          </ProtectedRoute>
        }
      />

      <Route
        path="/results/:resultId"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} userRole={userRole}>
            <ResultsView />
          </ProtectedRoute>
        }
      />

      <Route
        path="/results"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} userRole={userRole}>
            <AllResults />
          </ProtectedRoute>
        }
      />

      {/* Teacher/Admin routes */}
      <Route
        path="/exams/create"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            userRole={userRole}
            allowedRoles={['teacher', 'admin']}
          >
            <ExamCreator />
          </ProtectedRoute>
        }
      />

      <Route
        path="/exams/:examId/edit"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            userRole={userRole}
            allowedRoles={['teacher', 'admin']}
          >
            <ExamCreator />
          </ProtectedRoute>
        }
      />

      <Route
        path="/exams/:examId/questions"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            userRole={userRole}
            allowedRoles={['teacher', 'admin']}
          >
            <QuestionEditor />
          </ProtectedRoute>
        }
      />

      <Route
        path="/exams/:examId/questions/:questionId"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            userRole={userRole}
            allowedRoles={['teacher', 'admin']}
          >
            <QuestionEditor />
          </ProtectedRoute>
        }
      />

      <Route
        path="/exams/:examId/results"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            userRole={userRole}
            allowedRoles={['teacher', 'admin']}
          >
            <AllResults />
          </ProtectedRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/users"
        element={
          <ProtectedRoute
            isAuthenticated={isAuthenticated}
            userRole={userRole}
            allowedRoles={['admin']}
          >
            <div>Users Management (Admin only)</div>
          </ProtectedRoute>
        }
      />

      {/* Redirect from root to dashboard or login */}
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* 404 Not Found */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-gray-800">404</h1>
              <p className="text-xl mt-4">Page not found</p>
              <button
                onClick={() => window.history.back()}
                className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Go Back
              </button>
            </div>
          </div>
        }
      />
    </Routes>
  );
};

export default AppRoutes;