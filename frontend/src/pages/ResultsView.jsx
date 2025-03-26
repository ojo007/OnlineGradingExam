import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import GradingVisualizer from '../components/GradingVisualizer';

const ResultsView = () => {
  const { resultId } = useParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [result, setResult] = useState(null);
  const [exam, setExam] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visualizationMode, setVisualizationMode] = useState('standard'); // 'standard' or 'detailed'
  const [calculatedScore, setCalculatedScore] = useState(null); // Added state for updated score

  useEffect(() => {
    fetchResultData();
  }, [resultId]);

  const fetchResultData = async () => {
    try {
      setLoading(true);
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

      // First get the specific result by ID
      const resultResponse = await fetch(`http://localhost:8000/api/v1/submissions/results/${resultId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!resultResponse.ok) {
        // If specific endpoint not available, try fetching from user results
        const userResultsResponse = await fetch(`http://localhost:8000/api/v1/submissions/results/users/${userData.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!userResultsResponse.ok) {
          throw new Error('Failed to fetch result');
        }

        const allResults = await userResultsResponse.json();
        const specificResult = allResults.find(r => r.id === parseInt(resultId));

        if (!specificResult) {
          throw new Error('Result not found');
        }

        setResult(specificResult);

        // Now fetch the exam using the exam_id from the result
        if (specificResult.exam_id) {
          const examResponse = await fetch(`http://localhost:8000/api/v1/exams/${specificResult.exam_id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (examResponse.ok) {
            const examData = await examResponse.json();
            setExam(examData);
          }
        }
      } else {
        // If we have a specific endpoint for fetching a result
        const resultData = await resultResponse.json();
        setResult(resultData);

        // Fetch exam data if we have an exam_id
        if (resultData.exam_id) {
          const examResponse = await fetch(`http://localhost:8000/api/v1/exams/${resultData.exam_id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (examResponse.ok) {
            const examData = await examResponse.json();
            setExam(examData);
          }
        }
      }

      // Fetch report data to get updated score calculation
      const reportResponse = await fetch(`http://localhost:8000/api/v1/submissions/report/exam/${resultId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (reportResponse.ok) {
        const reportData = await reportResponse.json();

        // Save the recalculated scores
        if (reportData.total_points !== undefined && reportData.percentage_score !== undefined) {
          setCalculatedScore({
            total_points: reportData.total_points,
            percentage_score: reportData.percentage_score,
            passed: reportData.passed
          });
        }
      }

      // Fetch submissions for this exam
      if (result && result.exam_id) {
        const submissionsResponse = await fetch(`http://localhost:8000/api/v1/submissions/student/${result.exam_id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (submissionsResponse.ok) {
          const submissionsData = await submissionsResponse.json();
          setSubmissions(submissionsData);
        }
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

  const toggleVisualizationMode = () => {
    setVisualizationMode(prev => prev === 'standard' ? 'detailed' : 'standard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header isLoggedIn={!!userData} userRole={userData?.role} />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mt-10">
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
        {error ? (
          <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        ) : !result ? (
          <div className="text-center mt-10">Result not found</div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Exam Results</h1>
              <button
                onClick={toggleVisualizationMode}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
              >
                <span>{visualizationMode === 'standard' ? 'Show Detailed Analysis' : 'Show Standard View'}</span>
              </button>
            </div>

            {visualizationMode === 'detailed' ? (
              // Detailed grading visualization
              <GradingVisualizer resultId={resultId} />
            ) : (
              // Standard result view
              <>
                <div className="bg-white shadow-md rounded-md overflow-hidden mb-6">
                  <div className="border-b pb-4 pt-5 px-6">
                    <h2 className="text-2xl font-bold">{exam ? exam.title : 'Exam'} - Results</h2>
                    {exam && <p className="text-gray-600 mt-1">{exam.description}</p>}
                  </div>

                  <div className="bg-gray-100 p-4 m-6 rounded-md">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-600">Started:</p>
                        <p className="font-semibold">{formatDateTime(result.started_at)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Completed:</p>
                        <p className="font-semibold">{formatDateTime(result.completed_at)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Score:</p>
                        <p className="font-semibold">
                          {calculatedScore ? calculatedScore.total_points : result.total_points} points
                          ({(calculatedScore ? calculatedScore.percentage_score : result.percentage_score).toFixed(1)}%)
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Result:</p>
                        <p className={`font-semibold ${
                          (calculatedScore ? calculatedScore.passed : result.passed) ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {(calculatedScore ? calculatedScore.passed : result.passed) ? 'PASSED' : 'FAILED'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 pb-6">
                    <h3 className="text-xl font-semibold mb-4">Question Details</h3>

                    {submissions.length === 0 ? (
                      <p>No submissions found for this exam.</p>
                    ) : (
                      <div className="space-y-6">
                        {submissions.map((submission, index) => (
                          <div key={submission.id} className="border rounded-md p-4">
                            <div className="flex justify-between items-start">
                              <h4 className="font-semibold">Question {index + 1}: {submission.question?.text}</h4>
                              <div className={`px-2 py-1 rounded-md text-sm font-semibold ${
                                submission.is_correct ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {submission.points_earned} / {submission.question?.points} points
                              </div>
                            </div>

                            <div className="mt-2">
                              <p className="text-gray-600">Your Answer:</p>
                              <p className="mt-1 p-2 bg-gray-50 rounded">{submission.answer}</p>
                            </div>

                            {submission.question?.question_type !== 'descriptive' && (
                              <div className="mt-2">
                                <p className="text-gray-600">Correct Answer:</p>
                                <p className="mt-1 p-2 bg-gray-50 rounded">{submission.question?.correct_answer}</p>
                              </div>
                            )}

                            {submission.grading_feedback && (
                              <div className="mt-2">
                                <p className="text-gray-600">Feedback:</p>
                                <p className="mt-1 p-2 bg-gray-50 rounded whitespace-pre-line">{submission.grading_feedback}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 flex justify-between">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Back to Dashboard
                  </button>
                  <button
                    onClick={() => navigate('/exams')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    View Available Exams
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsView;