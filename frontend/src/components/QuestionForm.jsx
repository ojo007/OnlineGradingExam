import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const QuestionForm = () => {
  const { examId, questionId } = useParams();
  const navigate = useNavigate();
  const isEditing = !!questionId;

  const [formData, setFormData] = useState({
    exam_id: examId,
    text: '',
    question_type: 'multiple_choice',
    points: 1,
    order: 1,
    options: [
      { id: 'A', text: '', is_correct: false },
      { id: 'B', text: '', is_correct: false },
      { id: 'C', text: '', is_correct: false },
      { id: 'D', text: '', is_correct: false }
    ],
    correct_answer: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [questions, setQuestions] = useState([]);
  const [examTitle, setExamTitle] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fetch existing questions for the exam
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const token = localStorage.getItem('token');

        // Fetch exam details to get the title
        const examResponse = await fetch(`http://localhost:8000/api/v1/exams/${examId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (examResponse.ok) {
          const examData = await examResponse.json();
          setExamTitle(examData.title);
        }

        // Fetch questions for this exam
        const questionsResponse = await fetch(`http://localhost:8000/api/v1/exams/${examId}/questions`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (questionsResponse.ok) {
          const questionsData = await questionsResponse.json();
          setQuestions(questionsData);

          // Set next question order
          if (questionsData.length > 0 && !isEditing) {
            const maxOrder = Math.max(...questionsData.map(q => q.order || 0));
            setFormData(prev => ({
              ...prev,
              order: maxOrder + 1
            }));
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };

    fetchQuestions();
  }, [examId, isEditing]);

  // If editing an existing question, fetch its data
  useEffect(() => {
    if (isEditing) {
      fetchQuestionData();
    }
  }, [questionId]);

  const fetchQuestionData = async () => {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`http://localhost:8000/api/v1/exams/questions/${questionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch question data');
      }

      const data = await response.json();

      // Format the data to match our form structure
      setFormData({
        exam_id: data.exam_id,
        text: data.text,
        question_type: data.question_type,
        points: data.points,
        order: data.order || 1,
        options: data.options || [
          { id: 'A', text: '', is_correct: false },
          { id: 'B', text: '', is_correct: false },
          { id: 'C', text: '', is_correct: false },
          { id: 'D', text: '', is_correct: false }
        ],
        correct_answer: data.correct_answer || ''
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;

    if (type === 'radio' && name.startsWith('correct_option_')) {
      // Handle radio button selection for correct option
      const optionId = name.replace('correct_option_', '');

      setFormData((prev) => ({
        ...prev,
        options: prev.options.map(option => ({
          ...option,
          is_correct: option.id === optionId
        }))
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...formData.options];
    newOptions[index] = {
      ...newOptions[index],
      [field]: value
    };

    setFormData({
      ...formData,
      options: newOptions
    });
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Are you sure you want to delete this question?')) {
      return;
    }

    setDeleteLoading(true);
    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`http://localhost:8000/api/v1/exams/questions/${questionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete question');
      }

      // Remove the question from the list
      setQuestions(questions.filter(q => q.id !== questionId));
      setSuccess('Question deleted successfully');

      // Wait 2 seconds then clear success message
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');

      // Prepare the request payload
      const payload = { ...formData };

      // For true/false and short answer types, we don't need options
      if (formData.question_type === 'true_false' || formData.question_type === 'short_answer') {
        delete payload.options;
      }

      const url = isEditing
        ? `http://localhost:8000/api/v1/exams/questions/${questionId}`
        : `http://localhost:8000/api/v1/exams/questions/`;

      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save question');
      }

      const savedQuestion = await response.json();

      if (isEditing) {
        // Navigate back to exam page if editing
        navigate(`/exams/${examId}/edit`);
      } else {
        // Refresh the questions list
        const updatedQuestionsResponse = await fetch(`http://localhost:8000/api/v1/exams/${examId}/questions`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (updatedQuestionsResponse.ok) {
          const updatedQuestions = await updatedQuestionsResponse.json();
          setQuestions(updatedQuestions);
        }

        // Reset form for next question
        setFormData({
          exam_id: examId,
          text: '',
          question_type: 'multiple_choice',
          points: 1,
          order: formData.order + 1,
          options: [
            { id: 'A', text: '', is_correct: false },
            { id: 'B', text: '', is_correct: false },
            { id: 'C', text: '', is_correct: false },
            { id: 'D', text: '', is_correct: false }
          ],
          correct_answer: ''
        });

        // Show success message
        setSuccess('Question added successfully! You can add another question or click "Done" when finished.');

        // Scroll to top
        window.scrollTo(0, 0);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderQuestionFields = () => {
    switch (formData.question_type) {
      case 'multiple_choice':
        return (
          <div className="mt-4 border p-4 rounded-md">
            <h3 className="font-semibold mb-2">Options</h3>
            {formData.options.map((option, index) => (
              <div key={option.id} className="mb-3 flex items-center">
                <input
                  type="radio"
                  id={`correct_option_${option.id}`}
                  name={`correct_option_${option.id}`}
                  checked={option.is_correct}
                  onChange={handleChange}
                  className="mr-2"
                />
                <label className="w-8">{option.id}:</label>
                <input
                  type="text"
                  value={option.text}
                  onChange={(e) => handleOptionChange(index, 'text', e.target.value)}
                  className="flex-grow px-3 py-1 border border-gray-300 rounded-md"
                  placeholder={`Option ${option.id}`}
                />
              </div>
            ))}
          </div>
        );

      case 'true_false':
        return (
          <div className="mt-4">
            <label className="block text-gray-700 mb-2">Correct Answer:</label>
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="correct_answer"
                  value="true"
                  checked={formData.correct_answer === 'true'}
                  onChange={handleChange}
                  className="mr-2"
                />
                True
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="correct_answer"
                  value="false"
                  checked={formData.correct_answer === 'false'}
                  onChange={handleChange}
                  className="mr-2"
                />
                False
              </label>
            </div>
          </div>
        );

      case 'short_answer':
      case 'descriptive':
        return (
          <div className="mt-4">
            <label className="block text-gray-700 mb-2" htmlFor="correct_answer">
              Correct Answer:
            </label>
            <textarea
              id="correct_answer"
              name="correct_answer"
              value={formData.correct_answer}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows="3"
              placeholder="Enter the correct answer or keywords"
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">{isEditing ? 'Edit Question' : 'Add Question'}</h2>
      <p className="text-gray-600 mb-6">For exam: {examTitle}</p>

      {/* Display existing questions */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Questions in this Exam ({questions.length})</h3>
        {questions.length > 0 ? (
          <div className="border rounded-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Question</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {questions.map((question, index) => (
                  <tr key={question.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap">{index + 1}</td>
                    <td className="px-4 py-2">
                      {question.text.length > 50
                        ? `${question.text.substring(0, 50)}...`
                        : question.text}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {question.question_type.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{question.points}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-right">
                      <button
                        onClick={() => navigate(`/exams/${examId}/questions/${question.id}`)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(question.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600">No questions added yet.</p>
        )}
      </div>

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="text">
            Question Text*
          </label>
          <textarea
            id="text"
            name="text"
            value={formData.text}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            rows="3"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="question_type">
            Question Type*
          </label>
          <select
            id="question_type"
            name="question_type"
            value={formData.question_type}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            required
          >
            <option value="multiple_choice">Multiple Choice</option>
            <option value="true_false">True/False</option>
            <option value="short_answer">Short Answer</option>
            <option value="descriptive">Descriptive</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="points">
            Points*
          </label>
          <input
            type="number"
            id="points"
            name="points"
            value={formData.points}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            min="0"
            step="0.5"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="order">
            Display Order
          </label>
          <input
            type="number"
            id="order"
            name="order"
            value={formData.order}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            min="1"
          />
        </div>

        {renderQuestionFields()}

        <div className="flex justify-end space-x-4 mt-6">
          <button
            type="button"
            onClick={() => navigate(`/exams/${examId}/edit`)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Question'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/exams/${examId}/edit`)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Done Adding Questions
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuestionForm;