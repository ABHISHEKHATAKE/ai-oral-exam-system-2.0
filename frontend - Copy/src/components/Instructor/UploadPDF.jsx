import React, { useState } from 'react';
import { api } from '../../services/api';

function UploadPDF({ token, students = [], onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [instruction, setInstruction] = useState('');
  const [examName, setExamName] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [useScheduling, setUseScheduling] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Please select a valid PDF file');
      setFile(null);
    }
  };

  const handleStudentToggle = (studentId) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a PDF file');
      return;
    }

    if (!examName.trim()) {
      setError('Please enter an exam name');
      return;
    }

    if (!instruction.trim()) {
      setError('Please enter an instruction (e.g., "chapter 1 to chapter 3" or "3.2.4")');
      return;
    }

    if (selectedStudents.length === 0) {
      setError('Please select at least one student');
      return;
    }

    if (useScheduling && !startTime) {
      setError('Please provide start time for scheduled exams');
      return;
    }

    if (useScheduling && !durationMinutes) {
      setError('Please provide duration for scheduled exams');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const uploadPromises = selectedStudents.map(studentId => {
        // Convert datetime-local format to backend format if provided
        let formattedStartTime = null;
        if (useScheduling && startTime) {
          formattedStartTime = startTime; // Send as-is, backend will handle it
        }
        
        return api.schedulePDFExam(token, {
          student_id: studentId,
          pdf_file: file,
          instruction: instruction,
          exam_name: examName,
          start_time: formattedStartTime,
          duration_minutes: useScheduling ? parseInt(durationMinutes) : null
        });
      });

      const results = await Promise.all(uploadPromises);
      
      // Check if all uploads were successful
      const hasErrors = results.some(r => r.error || (r.detail && r.detail.startsWith('Failed')));
      
      if (!hasErrors && results.length > 0) {
        setSuccess(`✅ Successfully scheduled "${examName}" for ${selectedStudents.length} student(s)`);
        setFile(null);
        setExamName('');
        setInstruction('');
        setSelectedStudents([]);
        setUseScheduling(false);
        setStartTime('');
        setDurationMinutes('');
        
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      } else {
        const errorMsg = results.find(r => r.error || r.detail)?.error || results.find(r => r.error || r.detail)?.detail || 'Unknown error';
        setError(errorMsg);
      }
    } catch (err) {
      setError(`Error scheduling exam: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      backgroundColor: '#fff', 
      borderRadius: '10px', 
      padding: '30px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h3 style={{ 
        marginBottom: '25px',
        background: 'linear-gradient(135deg, #764ba2 0%, #f093fb 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        fontWeight: '700'
      }}>
        📚 Schedule PDF-Based Exam
      </h3>

      <form onSubmit={handleUpload}>
        {/* Exam Name */}
        <div className="mb-4">
          <label className="form-label fw-600">Exam Name</label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g., 'Neural Networks Fundamentals' or 'Module 5 Assessment'"
            value={examName}
            onChange={(e) => setExamName(e.target.value)}
            disabled={loading}
            style={{
              borderRadius: '8px',
              padding: '12px',
              borderColor: examName ? '#764ba2' : '#dee2e6'
            }}
          />
          <small className="text-muted mt-2 d-block">
            This name will be visible to students
          </small>
        </div>

        {/* File Upload */}
        <div className="mb-4">
          <label className="form-label fw-600">Select PDF File</label>
          <input
            type="file"
            className="form-control"
            accept=".pdf"
            onChange={handleFileChange}
            disabled={loading}
            style={{
              borderRadius: '8px',
              padding: '12px',
              borderColor: file ? '#764ba2' : '#dee2e6',
              backgroundColor: file ? '#f8f4ff' : '#fff'
            }}
          />
          {file && (
            <small className="text-success mt-2 d-block">
              ✓ Selected: {file.name}
            </small>
          )}
        </div>

        {/* Instruction Input */}
        <div className="mb-4">
          <label className="form-label fw-600">Instruction/Topic</label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g., 'chapter 1 to chapter 3' or '3.2.4'"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={loading}
            style={{
              borderRadius: '8px',
              padding: '12px',
              borderColor: instruction ? '#764ba2' : '#dee2e6'
            }}
          />
          <small className="text-muted mt-2 d-block">
            💡 Tip: Use chapter ranges (e.g., "chapter 1 to chapter 3") or specific topics (e.g., "2.3.1")
          </small>
        </div>

        {/* Scheduling Toggle */}
        <div className="mb-4">
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id="use-scheduling"
              checked={useScheduling}
              onChange={(e) => setUseScheduling(e.target.checked)}
              disabled={loading}
            />
            <label className="form-check-label fw-600" htmlFor="use-scheduling">
              Schedule exam with date/time (Optional)
            </label>
          </div>
        </div>

        {/* Scheduling Fields */}
        {useScheduling && (
          <>
            <div className="mb-4">
              <label className="form-label fw-600">Start Time</label>
              <input
                type="datetime-local"
                className="form-control"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={loading}
                style={{
                  borderRadius: '8px',
                  padding: '12px'
                }}
              />
              <small className="text-muted mt-2 d-block">
                When should the exam become available?
              </small>
            </div>

            <div className="mb-4">
              <label className="form-label fw-600">Duration (Minutes)</label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g., 60"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                disabled={loading}
                style={{
                  borderRadius: '8px',
                  padding: '12px'
                }}
              />
              <small className="text-muted mt-2 d-block">
                How long should the exam be available?
              </small>
            </div>
          </>
        )}

        {/* Student Selection */}
        <div className="mb-4">
          <label className="form-label fw-600">Select Students</label>
          <div style={{
            backgroundColor: '#f8f4ff',
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            padding: '15px',
            maxHeight: '250px',
            overflowY: 'auto'
          }}>
            {students.length === 0 ? (
              <p className="text-muted mb-0">No students available</p>
            ) : (
              students.map(student => (
                <div key={student.student_id} className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`student-${student.student_id}`}
                    checked={selectedStudents.includes(student.student_id)}
                    onChange={() => handleStudentToggle(student.student_id)}
                    disabled={loading}
                  />
                  <label className="form-check-label" htmlFor={`student-${student.student_id}`}>
                    <strong>{student.name}</strong>
                    <br />
                    <small className="text-muted">{student.email}</small>
                  </label>
                </div>
              ))
            )}
          </div>
          <small className="text-muted mt-2 d-block">
            Selected: {selectedStudents.length} student(s)
          </small>
        </div>

        {/* Error Message */}
        {error && (
          <div className="alert alert-danger mb-4" role="alert">
            <strong>⚠️ Error:</strong> {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="alert alert-success mb-4" role="alert">
            {success}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !file || !examName.trim() || !instruction.trim() || selectedStudents.length === 0}
          className="btn w-100 fw-600"
          style={{
            background: loading ? '#ccc' : 'linear-gradient(135deg, #764ba2 0%, #f093fb 100%)',
            color: '#fff',
            border: 'none',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s'
          }}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2"></span>
              Scheduling...
            </>
          ) : (
            '🚀 Schedule Exam'
          )}
        </button>
      </form>
    </div>
  );
}

export default UploadPDF;

