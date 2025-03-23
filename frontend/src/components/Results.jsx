import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const Results = () => {
  const { resultId } = useParams();
  const navigate = useNavigate();

  const [result, setResult] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchResultData();
  }, [resultId]);

  const fetchResultData = async () => {
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error('Authentication required');
      }

      // Fetch the result details
      const resultResponse = await fetch(`http://localhost:8000/api/v1/submissions/results/exams/${resultId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!resultResponse.ok) {
        throw new Error('Failed to fetch result');
      }

      const resultData = await resultResponse.json();
      setResult(resultData);

      // Fetch exam details
      const examResponse = await fetch(`http://localhost:8000/api/v1/exams/${resultData.exam_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!examResponse.ok) {
        throw new Error('Failed to fetch exam details');
      }

      const examData = await examResponse.json();
      setExam(examData);

      // Fetch submissions for this result
      const submissionsResponse = await fetch(`http://localhost:8000/api/v1/submissions/student/${resultData.exam_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!submissionsResponse.ok) {
        throw new Error('Failed to fetch submissions');
      }

      const submissionsData = await submissionsResponse.json();
      setSubmissions(submissionsData);

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

  if (loading) {
    return <div className="text-center mt-10">Loading results...</div>;
  }

  if (error) {
    return (
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
    );
  }

  if (!result || !exam) {
    return <div className="text-center mt-10">Result not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <div className="border-b pb-4 mb-6">
        <h2 className="text-2xl font-bold">{exam.title} - Results</h2>
        <p className="text-gray-600">{exam.description}</p>
      </div>

      <div className="bg-gray-100 p-4 rounded-md mb-6">
        <div className="grid grid-cols-2 gap-4">
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
            <p className="font-semibold">{result.total_points} points ({result.percentage_score.toFixed(1)}%)</p>
          </div>
          <div>
            <p className="text-gray-600">Result:</p>
            <p className={`font-semibold ${result.passed ? 'text-green-600' : 'text-red-600'}`}>
              {result.passed ? 'PASSED' : 'FAILED'}
            </p>
          </div>
        </div>
      </div>

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
                <p className="mt-1">{submission.answer}</p>
              </div>

              {submission.question?.question_type !== 'descriptive' && (
                <div className="mt-2">
                  <p className="text-gray-600">Correct Answer:</p>
                  <p className="mt-1">{submission.question?.correct_answer}</p>
                </div>
              )}

              {submission.grading_feedback && (
                <div className="mt-2">
                  <p className="text-gray-600">Feedback:</p>
                  <p className="mt-1">{submission.grading_feedback}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700"
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
    </div>
  );
};

export default Results;