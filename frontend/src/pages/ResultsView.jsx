import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Results from '../components/Results';

const ResultsView = () => {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canViewResult, setCanViewResult] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
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

        // If teacher or admin, they can view all results
        if (userData.role === 'teacher' || userData.role === 'admin') {
          setCanViewResult(true);
          return;
        }

        // For students, check if this is their result
        if (userData.role === 'student' && resultId) {
          const resultResponse = await fetch(`http://localhost:8000/api/v1/submissions/results/users/${userData.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!resultResponse.ok) {
            throw new Error('Failed to fetch results');
          }

          const results = await resultResponse.json();
          const isUserResult = results.some(r => r.id === parseInt(resultId));

          if (!isUserResult) {
            setError('You do not have permission to view this result');
            return;
          }

          setCanViewResult(true);
        }

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [resultId, navigate]);

  if (loading) {
    return <div className="text-center p-10">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header isLoggedIn={!!userData} userRole={userData?.role} />

      <div className="container mx-auto px-4 py-8">
        {error ? (
          <div className="max-w-lg mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
            <div className="text-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : canViewResult ? (
          <Results />
        ) : (
          <div className="text-center p-10">
            <p className="text-xl">You are not authorized to view this result.</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsView;