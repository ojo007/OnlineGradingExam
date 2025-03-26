import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';

const AllResults = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [results, setResults] = useState([]);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

        // Fetch exam details if examId is provided
        if (examId) {
          const examResponse = await fetch(`http://localhost:8000/api/v1/exams/${examId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!examResponse.ok) {
            throw new Error('Failed to fetch exam details');
          }

          const examData = await examResponse.json();
          setExam(examData);

          // Fetch results for this specific exam
          const resultsEndpoint = userData.role === 'student'
            ? `http://localhost:8000/api/v1/submissions/results/users/${userData.id}`
            : `http://localhost:8000/api/v1/submissions/results/exams/${examId}`;

          const resultsResponse = await fetch(resultsEndpoint, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!resultsResponse.ok) {
            throw new Error('Failed to fetch results');
          }

          let resultsData = await resultsResponse.json();

          // If student, filter for the current exam
          if (userData.role === 'student') {
            resultsData = resultsData.filter(result => result.exam_id === parseInt(examId));
          }

          // Enhance results with student and exam details
          const enhancedResults = await Promise.all(resultsData.map(async (result) => {
            let studentData = result.student;
            let examData = examId ? examData : result.exam;
            let calculatedScore = null;

            // If student details not included, fetch them
            if (!studentData || !studentData.username) {
              studentData = {
                username: `Student ${result.student_id}`,
                full_name: `Student ${result.student_id}`
              };
            }

            // Fetch report data to get updated score calculation
            try {
              const reportResponse = await fetch(`http://localhost:8000/api/v1/submissions/report/exam/${result.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });

              if (reportResponse.ok) {
                const reportData = await reportResponse.json();
                if (reportData.total_points !== undefined && reportData.percentage_score !== undefined) {
                  calculatedScore = {
                    total_points: reportData.total_points,
                    percentage_score: reportData.percentage_score,
                    passed: reportData.passed
                  };
                }
              }
            } catch (error) {
              console.error("Error fetching report:", error);
            }

            return {
              ...result,
              student: studentData,
              exam: examData,
              calculatedScore: calculatedScore
            };
          }));

          setResults(enhancedResults);
        } else {
          // Fetch all results depending on user role
          const resultsEndpoint = userData.role === 'student'
            ? `http://localhost:8000/api/v1/submissions/results/users/${userData.id}`
            : `http://localhost:8000/api/v1/submissions/results/all`;

          const resultsResponse = await fetch(resultsEndpoint, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!resultsResponse.ok) {
            throw new Error('Failed to fetch results');
          }

          const resultsData = await resultsResponse.json();

          // For each result, fetch the exam details if not included
          const enhancedResults = await Promise.all(resultsData.map(async (result) => {
            let studentData = result.student;
            let examData = result.exam;
            let calculatedScore = null;

            // If student details not included, use a placeholder
            if (!studentData || !studentData.username) {
              studentData = {
                username: `Student ${result.student_id}`,
                full_name: `Student ${result.student_id}`
              };
            }

            // If exam details not included, fetch them
            if (!examData || !examData.title) {
              try {
                const examResponse = await fetch(`http://localhost:8000/api/v1/exams/${result.exam_id}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                if (examResponse.ok) {
                  examData = await examResponse.json();
                } else {
                  examData = { title: `Exam ${result.exam_id}` };
                }
              } catch (error) {
                console.error("Error fetching exam details:", error);
                examData = { title: `Exam ${result.exam_id}` };
              }
            }

            // Fetch report data to get updated score calculation
            try {
              const reportResponse = await fetch(`http://localhost:8000/api/v1/submissions/report/exam/${result.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });

              if (reportResponse.ok) {
                const reportData = await reportResponse.json();
                if (reportData.total_points !== undefined && reportData.percentage_score !== undefined) {
                  calculatedScore = {
                    total_points: reportData.total_points,
                    percentage_score: reportData.percentage_score,
                    passed: reportData.passed
                  };
                }
              }
            } catch (error) {
              console.error("Error fetching report:", error);
            }

            return {
              ...result,
              student: studentData,
              exam: examData,
              calculatedScore: calculatedScore
            };
          }));

          setResults(enhancedResults);
        }

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [examId, navigate]);

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header isLoggedIn={!!userData} userRole={userData?.role} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center p-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading results...</p>
          </div>
        </div>
      </div>
    );
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
            {exam ? `Results for ${exam.title}` : userData?.role === 'student' ? 'My Results' : 'All Exam Results'}
          </h1>
          {exam && (
            <p className="text-gray-600">
              Passing score: {exam.passing_score}%
            </p>
          )}
        </div>

        {results.length === 0 ? (
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <p className="text-lg">No results found.</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {userData?.role !== 'student' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.map((result) => (
                  <tr key={result.id}>
                    {userData?.role !== 'student' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {result.student?.full_name || result.student?.username || `Student ${result.student_id}`}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {result.exam?.title || `Exam ${result.exam_id}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {result.calculatedScore ? result.calculatedScore.percentage_score.toFixed(1) : result.percentage_score.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-500">
                        {result.calculatedScore ? result.calculatedScore.total_points : result.total_points} points
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        (result.calculatedScore ? result.calculatedScore.passed : result.passed) ?
                          'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {(result.calculatedScore ? result.calculatedScore.passed : result.passed) ? 'PASSED' : 'FAILED'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(result.completed_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link to={`/results/${result.id}`} className="text-blue-600 hover:text-blue-900">
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllResults;