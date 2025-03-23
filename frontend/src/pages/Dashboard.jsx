import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import ExamList from '../components/ExamList';

const Dashboard = ({ userRole, onLogout }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recentExams, setRecentExams] = useState([]);
  const [recentResults, setRecentResults] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          navigate('/login');
          return;
        }

        // Fetch current user's data
        const userResponse = await fetch('http://localhost:8000/api/v1/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!userResponse.ok) {
          if (userResponse.status === 401) {
            localStorage.removeItem('token');
            navigate('/login');
            return;
          }
          throw new Error('Failed to fetch user data');
        }

        const userData = await userResponse.json();
        setUserData(userData);

        // Fetch recent exams
        const examResponse = await fetch('http://localhost:8000/api/v1/exams/?limit=5', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (examResponse.ok) {
          const examData = await examResponse.json();
          setRecentExams(examData);
        }

        // Fetch recent results for students
        if (userData.role === 'student') {
          const resultsResponse = await fetch(`http://localhost:8000/api/v1/submissions/results/users/${userData.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (resultsResponse.ok) {
            const resultsData = await resultsResponse.json();
            setRecentResults(resultsData);
          }
        }

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const renderStudentDashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Available Exams</h3>
        {recentExams.length > 0 ? (
          <div className="space-y-3">
            {recentExams
              .filter(exam => exam.status === 'active' || exam.status === 'published')
              .map(exam => (
                <div key={exam.id} className="border-b pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{exam.title}</h4>
                      <p className="text-sm text-gray-600">Duration: {exam.duration_minutes} minutes</p>
                    </div>
                    <button
                      onClick={() => navigate(`/exams/${exam.id}/take`)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md"
                    >
                      Take Exam
                    </button>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-gray-600">No exams currently available.</p>
        )}
        <button
          onClick={() => navigate('/exams')}
          className="mt-4 text-blue-600 hover:text-blue-800"
        >
          View all exams
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Recent Results</h3>
        {recentResults.length > 0 ? (
          <div className="space-y-3">
            {recentResults.slice(0, 5).map(result => (
              <div key={result.id} className="border-b pb-3">
                <div className="flex justify-between">
                  <div>
                    <h4 className="font-medium">{result.exam?.title || 'Exam'}</h4>
                    <p className="text-sm text-gray-600">
                      Score: {result.percentage_score.toFixed(1)}% |
                      Completed: {formatDate(result.completed_at)}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    result.passed
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {result.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No exam results yet.</p>
        )}
        <button
          onClick={() => navigate('/results')}
          className="mt-4 text-blue-600 hover:text-blue-800"
        >
          View all results
        </button>
      </div>
    </div>
  );

  const renderTeacherDashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Your Exams</h3>
        {recentExams.length > 0 ? (
          <div className="space-y-3">
            {recentExams.slice(0, 5).map(exam => (
              <div key={exam.id} className="border-b pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{exam.title}</h4>
                    <p className="text-sm text-gray-600">
                      Status: {exam.status.toUpperCase()} |
                      Created: {formatDate(exam.created_at)}
                    </p>
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={() => navigate(`/exams/${exam.id}/edit`)}
                      className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-md"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => navigate(`/exams/${exam.id}/results`)}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-md"
                    >
                      Results
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">You haven't created any exams yet.</p>
        )}
        <div className="mt-4 flex space-x-4">
          <button
            onClick={() => navigate('/exams')}
            className="text-blue-600 hover:text-blue-800"
          >
            View all exams
          </button>
          <button
            onClick={() => navigate('/exams/create')}
            className="text-green-600 hover:text-green-800"
          >
            Create new exam
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="space-y-4">
          <button
            onClick={() => navigate('/exams/create')}
            className="w-full p-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center"
          >
            <span>Create New Exam</span>
          </button>

          <button
            onClick={() => navigate('/exams')}
            className="w-full p-3 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center"
          >
            <span>Manage Existing Exams</span>
          </button>

          <button
            onClick={() => navigate('/results')}
            className="w-full p-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center justify-center"
          >
            <span>View All Student Results</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderAdminDashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">System Overview</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-md">
            <p className="text-sm text-gray-600">Total Exams</p>
            <p className="text-2xl font-semibold">{recentExams.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-md">
            <p className="text-sm text-gray-600">Active Exams</p>
            <p className="text-2xl font-semibold">
              {recentExams.filter(exam => exam.status === 'active').length}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-md">
            <p className="text-sm text-gray-600">Users</p>
            <p className="text-2xl font-semibold">-</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-md">
            <p className="text-sm text-gray-600">Submissions</p>
            <p className="text-2xl font-semibold">-</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="space-y-4">
          <button
            onClick={() => navigate('/users')}
            className="w-full p-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center"
          >
            <span>Manage Users</span>
          </button>

          <button
            onClick={() => navigate('/exams')}
            className="w-full p-3 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center"
          >
            <span>Manage Exams</span>
          </button>

          <button
            onClick={() => navigate('/system/settings')}
            className="w-full p-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center justify-center"
          >
            <span>System Settings</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="text-center p-10">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header isLoggedIn={!!userData} userRole={userData?.role} />

      <div className="container mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-2xl font-bold">Welcome, {userData?.full_name || userData?.username}</h1>
          <p className="text-gray-600">
            Role: {userData?.role.charAt(0).toUpperCase() + userData?.role.slice(1)}
          </p>
        </div>

        {userData?.role === 'student' && renderStudentDashboard()}
        {userData?.role === 'teacher' && renderTeacherDashboard()}
        {userData?.role === 'admin' && renderAdminDashboard()}
      </div>
    </div>
  );
};

export default Dashboard;