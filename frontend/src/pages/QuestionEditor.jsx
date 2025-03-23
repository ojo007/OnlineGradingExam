import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import QuestionForm from '../components/QuestionForm';

const QuestionEditor = () => {
  const { examId, questionId } = useParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [examTitle, setExamTitle] = useState('');

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

        // Check if user is a teacher or admin
        if (userData.role !== 'teacher' && userData.role !== 'admin') {
          navigate('/dashboard');
          return;
        }

        setUserData(userData);

        // Fetch exam details to get the title
        const examResponse = await fetch(`http://localhost:8000/api/v1/exams/${examId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!examResponse.ok) {
          throw new Error('Failed to fetch exam details');
        }

        const examData = await examResponse.json();
        setExamTitle(examData.title);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [examId, questionId, navigate]);

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
          <h1 className="text-2xl font-bold">
            {questionId ? 'Edit Question' : 'Add New Question'}
          </h1>
          <p className="text-gray-600">
            For exam: {examTitle}
          </p>
        </div>

        <QuestionForm />
      </div>
    </div>
  );
};

export default QuestionEditor;