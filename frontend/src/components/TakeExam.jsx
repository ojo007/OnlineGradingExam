import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const TakeExam = () => {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchExamData();
  }, [examId]);

  useEffect(() => {
    // Set up timer if exam is loaded
    if (exam && exam.duration_minutes) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [exam]);

  const fetchExamData = async () => {
    try {
      const token = localStorage.getItem('token');

      // Fetch exam details
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

      // Set initial time remaining
      setTimeRemaining(examData.duration_minutes * 60);

      // Fetch questions for this exam
      const questionsResponse = await fetch(`http://localhost:8000/api/v1/exams/${examId}/questions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!questionsResponse.ok) {
        throw new Error('Failed to fetch questions');
      }

      const questionsData = await questionsResponse.json();

      // Sort questions by order if not randomized
      const sortedQuestions = examData.is_randomized
        ? [...questionsData].sort(() => Math.random() - 0.5)
        : [...questionsData].sort((a, b) => a.order - b.order);

      setQuestions(sortedQuestions);

      // Initialize answers object
      const initialAnswers = {};
      sortedQuestions.forEach(q => {
        initialAnswers[q.id] = '';
      });
      setAnswers(initialAnswers);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers({
      ...answers,
      [questionId]: value
    });
  };

  const goToNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const goToPrevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmitExam = async () => {
  if (submitting) return;

  const allQuestionsAnswered = questions.every(q => answers[q.id] !== '');

  if (!allQuestionsAnswered) {
    const confirmSubmit = window.confirm(
      'You have not answered all questions. Are you sure you want to submit?'
    );

    if (!confirmSubmit) {
      return;
    }
  }

  setSubmitting(true);

  try {
    const token = localStorage.getItem('token');

    // Format the submission data
    const submissions = Object.keys(answers).map(questionId => ({
      question_id: parseInt(questionId),
      answer: answers[questionId]
    }));

    const payload = {
      exam_id: parseInt(examId), // Make sure examId is defined and not undefined
      submissions
    };

    console.log("Submitting exam payload:", payload); // Add logging

    const response = await fetch('http://localhost:8000/api/v1/submissions/exam', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to submit exam');
    }

    const result = await response.json();
    console.log("Submission result:", result); // Add logging

    // Navigate to results page with the result ID, not the exam ID
    if (result && result.id) {
      navigate(`/results/${result.id}`, { state: { result } });
    } else {
      // If no result ID, navigate to a safe location
      navigate('/dashboard');
    }

  } catch (err) {
    console.error("Error submitting exam:", err); // Add logging
    setError(err.message);
    setSubmitting(false);
  }
};

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  const renderQuestionContent = () => {
    if (questions.length === 0) return null;

    const question = questions[currentQuestion];

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">
          Question {currentQuestion + 1}: {question.text}
        </h3>

        <div className="mt-4">
          {question.question_type === 'multiple_choice' && (
            <div className="space-y-2">
              {question.options.map((option) => (
                <label key={option.id} className="flex items-start p-2 border rounded-md hover:bg-gray-50">
                  <input
                    type="radio"
                    name={`question_${question.id}`}
                    value={option.id}
                    checked={answers[question.id] === option.id}
                    onChange={() => handleAnswerChange(question.id, option.id)}
                    className="mt-1 mr-2"
                  />
                  <div>
                    <span className="font-medium">{option.id}:</span> {option.text}
                  </div>
                </label>
              ))}
            </div>
          )}

          {question.question_type === 'true_false' && (
            <div className="space-y-2">
              <label className="flex items-center p-2 border rounded-md hover:bg-gray-50">
                <input
                  type="radio"
                  name={`question_${question.id}`}
                  value="true"
                  checked={answers[question.id] === 'true'}
                  onChange={() => handleAnswerChange(question.id, 'true')}
                  className="mr-2"
                />
                True
              </label>
              <label className="flex items-center p-2 border rounded-md hover:bg-gray-50">
                <input
                  type="radio"
                  name={`question_${question.id}`}
                  value="false"
                  checked={answers[question.id] === 'false'}
                  onChange={() => handleAnswerChange(question.id, 'false')}
                  className="mr-2"
                />
                False
              </label>
            </div>
          )}

          {(question.question_type === 'short_answer' || question.question_type === 'descriptive') && (
            <textarea
              value={answers[question.id]}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={question.question_type === 'descriptive' ? 6 : 3}
              placeholder="Enter your answer here..."
            />
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="text-center mt-10">Loading exam...</div>;
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        <button
          onClick={() => navigate('/exams')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Back to Exams
        </button>
      </div>
    );
  }

  if (!exam) {
    return <div className="text-center mt-10">Exam not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold">{exam.title}</h2>
        <div className="text-xl font-semibold text-red-600">
          Time Remaining: {formatTime(timeRemaining)}
        </div>
      </div>

      {questions.length > 0 ? (
        <>
          <div className="grid grid-cols-8 gap-2 mb-6">
            {questions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => setCurrentQuestion(index)}
                className={`p-2 border rounded-md text-center ${
                  currentQuestion === index
                    ? 'bg-blue-600 text-white'
                    : answers[q.id]
                      ? 'bg-green-100'
                      : 'bg-gray-100'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          {renderQuestionContent()}

          <div className="flex justify-between mt-6">
            <button
              onClick={goToPrevQuestion}
              disabled={currentQuestion === 0}
              className={`px-4 py-2 border rounded-md ${
                currentQuestion === 0 ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Previous
            </button>

            {currentQuestion < questions.length - 1 ? (
              <button
                onClick={goToNextQuestion}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmitExam}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                {submitting ? 'Submitting...' : 'Submit Exam'}
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="text-center p-6">
          <p className="text-lg">This exam has no questions.</p>
          <button
            onClick={() => navigate('/exams')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Exams
          </button>
        </div>
      )}
    </div>
  );
};

export default TakeExam;