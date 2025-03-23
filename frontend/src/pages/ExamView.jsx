import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import TakeExam from '../components/TakeExam';

const ExamView = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canTakeExam, setCanTakeExam] = useState(false);

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

        // Fetch exam data
        const examResponse = await fetch(`http://localhost:8000/api/v1/exams/${examId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!examResponse.ok) {
          throw new Error('Failed to fetch exam');
        }

        const examData = await examResponse.json();
        setExam(examData);

        // Check if student can take this exam
        if (userData.role === 'student') {
          // Check if exam is active
          if (examData.status !== 'active') {
            setError('This exam is not currently active');
            return;
          }

          // Check if student has already taken this exam
          const resultResponse = await fetch(`http://localhost:8000/api/v1/submissions/results/users/${userData.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (resultResponse.ok) {
            const results = await resultResponse.json();
            const hasAlreadyTaken = results.some(r => r.exam_id === parseInt(examId));

            if (hasAlreadyTaken) {
              setError('You have already taken this exam');
              return;
            }
          }

          setCanTakeExam(true);
        } else if (userData.role === 'teacher' || userData.role === 'admin') {
          // Teachers and admins can preview exams
          setCanTakeExam(true);
        }

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [examId, navigate]);

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
                onClick={() => navigate('/exams')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Back to Exams
              </button>
            </div>
          </div>
        ) : canTakeExam ? (
          <TakeExam />
        ) : (
          <div className="text-center p-10">
            <p className="text-xl">You are not authorized to take this exam.</p>
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

export default ExamView;