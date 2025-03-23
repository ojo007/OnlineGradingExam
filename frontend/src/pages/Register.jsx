import React from 'react';
import { Link } from 'react-router-dom';
import RegisterForm from '../components/RegisterForm';

const Register = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center">
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Online Exam System</h1>
          <p className="text-gray-600 mt-2">Create a new account</p>
        </div>

        <RegisterForm />

        <div className="text-center mt-4">
          <p className="text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-800">
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;