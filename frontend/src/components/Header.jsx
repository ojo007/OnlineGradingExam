import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Header = ({ isLoggedIn, userRole }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear token from localStorage
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <header className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold">Online Exam System</h1>

        <nav>
          <ul className="flex space-x-6">
            {isLoggedIn ? (
              <>
                <li><Link to="/dashboard">Dashboard</Link></li>

                {/* Show these links only for teachers and admins */}
                {(userRole === 'teacher' || userRole === 'admin') && (
                  <>
                    <li><Link to="/exams/create">Create Exam</Link></li>
                    <li><Link to="/exams">Manage Exams</Link></li>
                  </>
                )}

                {/* For students */}
                {userRole === 'student' && (
                  <li><Link to="/exams/active">Available Exams</Link></li>
                )}

                <li><Link to="/results">My Results</Link></li>
                <li><button onClick={handleLogout}>Logout</button></li>
              </>
            ) : (
              <>
                <li><Link to="/login">Login</Link></li>
                <li><Link to="/register">Register</Link></li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header;