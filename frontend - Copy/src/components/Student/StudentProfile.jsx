import React, { useState } from 'react';
import { api } from '../../services/api';

function StudentProfile({ token, user, onProfileCreated }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    student_id: '',
    name: '',
    project_title: '',
    project_description: '',
    technologies: '',
    metrics: '',
    case_study: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!formData.student_id.trim()) {
      alert('❌ Student ID is required');
      return;
    }
    if (!formData.name.trim()) {
      alert('❌ Full Name is required');
      return;
    }
    if (!formData.project_title.trim()) {
      alert('❌ Project Title is required');
      return;
    }

    setLoading(true);

    const payload = {
      student_id: formData.student_id.trim(),
      name: formData.name.trim(),
      project_title: formData.project_title.trim(),
      project_description: formData.project_description.trim(),
      technologies: formData.technologies.split(',').map(t => t.trim()).filter(t => t),
      metrics: formData.metrics.split(',').map(m => m.trim()).filter(m => m),
      case_study: formData.case_study.trim()
    };

    try {
      const response = await api.createProfile(token, payload);
      alert('✅ Profile created successfully!');
      if (onProfileCreated) {
        onProfileCreated();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Unknown error occurred';
      alert('❌ Error creating profile: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="row justify-content-center">
      <div className="col-lg-8">
        <div className="card border-0 shadow-lg">
          <div className="card-header bg-primary text-white">
            <h4 className="mb-0">👤 Create Your Profile</h4>
          </div>
          <div className="card-body p-4">
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Student ID *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.student_id}
                    onChange={(e) => setFormData({...formData, student_id: e.target.value})}
                    placeholder="S12345"
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Full Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold">Project Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.project_title}
                    onChange={(e) => setFormData({...formData, project_title: e.target.value})}
                    placeholder="AI Chatbot System"
                    required
                  />
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold">Project Description *</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    value={formData.project_description}
                    onChange={(e) => setFormData({...formData, project_description: e.target.value})}
                    placeholder="Describe your project in detail..."
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Technologies (comma-separated) *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.technologies}
                    onChange={(e) => setFormData({...formData, technologies: e.target.value})}
                    placeholder="Python, FastAPI, React"
                    required
                  />
                  <small className="text-muted">Example: Python, TensorFlow, React</small>
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Metrics (comma-separated) *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.metrics}
                    onChange={(e) => setFormData({...formData, metrics: e.target.value})}
                    placeholder="Accuracy, Precision, Recall"
                    required
                  />
                  <small className="text-muted">Example: Accuracy, F1-Score</small>
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold">Case Study *</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    value={formData.case_study}
                    onChange={(e) => setFormData({...formData, case_study: e.target.value})}
                    placeholder="Describe a real-world application or use case..."
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg w-100 mt-4"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Creating Profile...
                  </>
                ) : (
                  'Create Profile'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentProfile;