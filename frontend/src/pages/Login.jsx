import React from 'react';
import { Link } from 'react-router-dom';
import LoginForm from '../components/LoginForm';

const Login = ({ onLogin }) => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center">
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Online Exam System</h1>
          <p className="text-gray-600 mt-2">Log in to your account</p>
        </div>

        <LoginForm onLogin={onLogin} />

        <div className="text-center mt-4">
          <p className="text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-800">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;