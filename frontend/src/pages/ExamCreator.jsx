import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import ExamForm from '../components/ExamForm';

const ExamCreator = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

        // Check if user is a teacher or admin
        if (userData.role !== 'teacher' && userData.role !== 'admin') {
          navigate('/dashboard');
          return;
        }

        setUserData(userData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

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

        <div className="mb-6">
          <h1 className="text-2xl font-bold">{examId ? 'Edit Exam' : 'Create New Exam'}</h1>
          <p className="text-gray-600">
            {examId ? 'Update exam details and questions' : 'Set up a new exam for your students'}
          </p>
        </div>

        <ExamForm />
      </div>
    </div>
  );
};

export default ExamCreator;