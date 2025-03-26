import React, { useState, useEffect } from 'react';

const GradingDetails = ({ submissionData }) => {
  if (!submissionData || !submissionData.grading_details) {
    return <div className="text-gray-500 italic">No detailed grading information available</div>;
  }

  // Handle MCQ/True-False questions
  if (submissionData.question_type === 'multiple_choice' || submissionData.question_type === 'true_false') {
    const { correct_options, selected_option, is_correct } = submissionData.grading_details;

    return (
      <div className="p-4 bg-gray-50 rounded-md">
        <h4 className="font-semibold mb-2">Grading Details</h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Selected Answer:</span>
            <span className="font-medium">{selected_option}</span>
          </div>
          <div className="flex justify-between">
            <span>Correct Answer:</span>
            <span className="font-medium">{Array.isArray(correct_options) ? correct_options.join(', ') : correct_options}</span>
          </div>
          <div className="flex justify-between">
            <span>Status:</span>
            <span className={`font-medium ${is_correct ? 'text-green-600' : 'text-red-600'}`}>
              {is_correct ? 'Correct' : 'Incorrect'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Short Answer or Descriptive questions
  const {
    method,
    combined_score,
    basic_keyword_score,
    string_similarity,
    nlp_keyword_score,
    semantic_score,
    threshold_applied,
    features_available
  } = submissionData.grading_details;

  return (
    <div className="p-4 bg-gray-50 rounded-md">
      <h4 className="font-semibold mb-2">Grading Details</h4>

      <div className="mb-3">
        <div className="text-sm text-gray-500 mb-1">Grading Method</div>
        <div className="font-medium">{method || 'Basic Text Matching'}</div>
      </div>

      <div className="mb-4">
        <div className="text-sm text-gray-500 mb-1">Score Breakdown</div>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b">
              <td className="py-2">Combined Score:</td>
              <td className="py-2 text-right font-medium">{combined_score ? (combined_score * 100).toFixed(1) + '%' : 'N/A'}</td>
            </tr>

            <tr className="border-b">
              <td className="py-2">Basic Keyword Match:</td>
              <td className="py-2 text-right">{basic_keyword_score ? (basic_keyword_score * 100).toFixed(1) + '%' : 'N/A'}</td>
            </tr>

            <tr className="border-b">
              <td className="py-2">String Similarity:</td>
              <td className="py-2 text-right">{string_similarity ? (string_similarity * 100).toFixed(1) + '%' : 'N/A'}</td>
            </tr>

            {features_available?.nlp_processing && (
              <tr className="border-b">
                <td className="py-2">NLP Keyword Match:</td>
                <td className="py-2 text-right">{nlp_keyword_score ? (nlp_keyword_score * 100).toFixed(1) + '%' : 'N/A'}</td>
              </tr>
            )}

            {features_available?.semantic_similarity && (
              <tr className="border-b">
                <td className="py-2">Semantic Similarity:</td>
                <td className="py-2 text-right">{semantic_score ? (semantic_score * 100).toFixed(1) + '%' : 'N/A'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {threshold_applied && (
        <div className="mb-3">
          <div className="text-sm text-gray-500 mb-1">Threshold Applied</div>
          <div className="font-medium">
            {threshold_applied.description} (Score &gt;= {threshold_applied.threshold * 100}%)
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${combined_score * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      )}
    </div>
  );
};

const GradingVisualizer = ({ resultId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [examResult, setExamResult] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);

  useEffect(() => {
    const fetchExamReport = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');

        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch(`http://localhost:8000/api/v1/submissions/report/exam/${resultId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch exam report');
        }

        const data = await response.json();
        setExamResult(data);

        // If there are submissions, set the first one as selected
        if (data.submissions && data.submissions.length > 0) {
          setSelectedQuestionId(data.submissions[0].question_id);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchExamReport();
  }, [resultId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  if (!examResult) {
    return (
      <div className="text-center p-10">
        <p className="text-lg">No result data found.</p>
      </div>
    );
  }

  // Find selected submission
  const selectedSubmission = examResult.submissions.find(
    sub => sub.question_id === selectedQuestionId
  );

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b">
        <h2 className="text-xl font-bold">Exam Result Analysis</h2>
        <div className="flex text-sm text-gray-500 mt-1">
          <div className="mr-4">Score: {examResult.percentage_score.toFixed(1)}%</div>
          <div className="mr-4">Points: {examResult.total_points}</div>
          <div className={examResult.passed ? 'text-green-600' : 'text-red-600'}>
            {examResult.passed ? 'PASSED' : 'FAILED'}
          </div>
        </div>
      </div>

      <div className="border-b">
        <nav className="flex">
          <button
            className={`py-3 px-4 ${
              activeTab === 'overview'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`py-3 px-4 ${
              activeTab === 'questions'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('questions')}
          >
            Questions
          </button>
        </nav>
      </div>

      <div className="p-6">
        {activeTab === 'overview' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Performance by Question Type</h3>
            {Object.entries(examResult.question_type_summary).map(([type, data]) => (
              <div key={type} className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">{type.replace('_', ' ')} Questions</h4>
                  <div className="text-sm">
                    {data.points_earned}/{data.max_points} points ({data.percentage}%)
                  </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: `${data.percentage}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.questions.map((q) => (
                    <div
                      key={q.question_id}
                      className="border rounded-md p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setSelectedQuestionId(q.question_id);
                        setActiveTab('questions');
                      }}
                    >
                      <div className="text-sm mb-1">Question {q.question_id}</div>
                      <div className="flex justify-between">
                        <div>{q.points_earned}/{q.max_points} points</div>
                        <div className={
                          q.percentage >= 90 ? 'text-green-600' :
                          q.percentage >= 70 ? 'text-yellow-600' :
                          'text-red-600'
                        }>
                          {q.percentage}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 border-r pr-6">
              <h3 className="text-lg font-semibold mb-4">Questions</h3>
              <div className="space-y-2">
                {examResult.submissions.map((submission) => (
                  <div
                    key={submission.question_id}
                    className={`p-3 rounded-md cursor-pointer ${
                      selectedQuestionId === submission.question_id
                        ? 'bg-blue-100 border border-blue-300'
                        : 'hover:bg-gray-100 border'
                    }`}
                    onClick={() => setSelectedQuestionId(submission.question_id)}
                  >
                    <div className="text-sm mb-1">Question {submission.question_id}</div>
                    <div className="flex justify-between">
                      <div>{submission.points_earned}/{submission.max_points} points</div>
                      <div className={
                        submission.percentage >= 90 ? 'text-green-600' :
                        submission.percentage >= 70 ? 'text-yellow-600' :
                        'text-red-600'
                      }>
                        {submission.percentage}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              {selectedSubmission ? (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Question Details</h3>

                  <div className="mb-4">
                    <div className="text-sm text-gray-500 mb-1">Question</div>
                    <div className="p-3 border rounded-md bg-gray-50">
                      {selectedSubmission.question_text}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-sm text-gray-500 mb-1">Your Answer</div>
                    <div className="p-3 border rounded-md">
                      {selectedSubmission.student_answer}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-sm text-gray-500 mb-1">Correct Answer</div>
                    <div className="p-3 border rounded-md bg-gray-50">
                      {selectedSubmission.correct_answer}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-sm text-gray-500 mb-1">Score</div>
                    <div className="flex items-center">
                      <div className="font-medium text-lg mr-4">
                        {selectedSubmission.points_earned}/{selectedSubmission.max_points} points
                        ({selectedSubmission.percentage}%)
                      </div>
                      <div className={`px-2 py-1 rounded text-sm font-medium ${
                        selectedSubmission.is_correct
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedSubmission.is_correct ? 'CORRECT' : 'INCORRECT'}
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="text-sm text-gray-500 mb-1">Feedback</div>
                    <div className="p-3 border rounded-md">
                      {selectedSubmission.grading_feedback || 'No feedback provided'}
                    </div>
                  </div>

                  <GradingDetails submissionData={selectedSubmission} />
                </div>
              ) : (
                <div className="text-center p-10 text-gray-500">
                  Select a question to view details
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GradingVisualizer;