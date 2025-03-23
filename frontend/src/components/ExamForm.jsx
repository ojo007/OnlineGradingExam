import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const ExamForm = ({ examData, onExamCreated }) => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const isEditing = !!examId;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration_minutes: 60,
    passing_score: 70,
    is_randomized: false,
    status: 'draft'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // If exam data is provided, use it to populate the form
    if (examData) {
      setFormData({
        title: examData.title || '',
        description: examData.description || '',
        duration_minutes: examData.duration_minutes || 60,
        passing_score: examData.passing_score || 70,
        is_randomized: examData.is_randomized || false,
        status: examData.status || 'draft'
      });
    }
    // If editing an existing exam but no data provided, fetch it
    else if (isEditing) {
      fetchExamData();
    }
  }, [examData, isEditing, examId]);

  const fetchExamData = async () => {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`http://localhost:8000/api/v1/exams/${examId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch exam data');
      }

      const data = await response.json();
      setFormData({
        title: data.title,
        description: data.description || '',
        duration_minutes: data.duration_minutes,
        passing_score: data.passing_score,
        is_randomized: data.is_randomized,
        status: data.status
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');

      const url = isEditing
        ? `http://localhost:8000/api/v1/exams/${examId}`
        : 'http://localhost:8000/api/v1/exams/';

      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save exam');
      }

      const savedExam = await response.json();

      if (isEditing) {
        // Show success message for edit
        setSuccess('Exam updated successfully!');
        setTimeout(() => setSuccess(''), 2000);
      } else {
        // Call callback with new exam ID
        if (onExamCreated) {
          onExamCreated(savedExam.id);
        }

        // For new exams, redirect to questions tab
        navigate(`/exams/${savedExam.id}/edit`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">{isEditing ? 'Edit Exam Details' : 'Create New Exam'}</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="title">
            Title*
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            rows="3"
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="duration_minutes">
            Duration (minutes)*
          </label>
          <input
            type="number"
            id="duration_minutes"
            name="duration_minutes"
            value={formData.duration_minutes}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            min="1"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="passing_score">
            Passing Score (%)*
          </label>
          <input
            type="number"
            id="passing_score"
            name="passing_score"
            value={formData.passing_score}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            min="0"
            max="100"
            required
          />
        </div>

        <div className="mb-4 flex items-center">
          <input
            type="checkbox"
            id="is_randomized"
            name="is_randomized"
            checked={formData.is_randomized}
            onChange={handleChange}
            className="mr-2"
          />
          <label className="text-gray-700" htmlFor="is_randomized">
            Randomize Questions
          </label>
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 mb-2" htmlFor="status">
            Status*
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            required
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/exams')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? 'Saving...' : isEditing ? 'Update Exam' : 'Create Exam'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExamForm;