import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
// At the top of the file, add import
import { API_URL } from '../../services/api';

function TakeExam({ token, dashboardData, user, onExamComplete }) {
  const [examStarted, setExamStarted] = useState(false);
  const [examId, setExamId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedExam, setSelectedExam] = useState(null);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // DEBUG: Log incoming user and dashboard data to help diagnose student id issues
  useEffect(() => {
    try {
      console.log('TakeExam mounted - user:', user);
      console.log('TakeExam mounted - dashboardData:', dashboardData);
    } catch (e) {
      // ignore
    }
  }, []);

  const startExam = async (selectedExamData = null) => {
    setLoading(true);
    setError('');

    try {
      // Resolve student id from common sources (user prop, dashboardData, or fields)
      // Prefer explicit student_id if available; otherwise send the authenticated user's email so backend can resolve
      let studentId = user?.student_id || user?.id || dashboardData?.student_id || dashboardData?.studentId || dashboardData?.id || null;

      if (!studentId) {
        // send full email (user.sub) so backend can resolve the student record
        studentId = user?.email || user?.email || dashboardData?.email || null;
      }

      if (!studentId) {
        setError('Student ID not found. Please complete your profile.');
        setLoading(false);
        return;
      }

      if (!selectedExamData) {
        setError('Please select an exam first.');
        setLoading(false);
        return;
      }

      // DEBUG: log request details for /api/exams/start
      try {
        console.log('Calling /api/exams/start', {
          url: `${API_URL}/api/exams/start`,
          student_id: studentId,
          exam: selectedExamData
        });
      } catch (e) {}

      const data = await api.startExam(token, studentId, selectedExamData);

      if (data.exam_id) {
        setExamId(data.exam_id);
        setExamStarted(true);
        connectWebSocket(data.exam_id);
      } else {
        setError(data.detail || 'Could not start exam');
      }
    } catch (err) {
      setError('Error starting exam. Please check if exam is scheduled and profile is complete.');
      console.error('Start exam error:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = (examId) => {
      const wsUrl = API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
      const ws = new WebSocket(`${wsUrl}/api/exams/ws/${examId}?token=${token}&mode=text`);

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'question') {
        setMessages(prev => [...prev, { role: 'ai', content: data.content }]);
        setQuestionStartTime(Date.now());
      } else if (data.type === 'exam_complete') {
        setMessages(prev => [...prev, {
          role: 'system',
          content: '🎉 Exam completed! Check your results in the Results tab.'
        }]);
        ws.close();
        setExamStarted(false);
        // Refresh dashboard data to update upcoming/completed exams
        if (onExamComplete) {
          onExamComplete();
        }
      } else if (data.error) {
        setMessages(prev => [...prev, {
          role: 'system',
          content: `❌ Error: ${data.error}`
        }]);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection error. Please refresh and try again.');
    };

    wsRef.current = ws;
  };

  const sendAnswer = () => {
    if (!currentAnswer.trim() || !wsRef.current) return;

    const responseTime = (Date.now() - questionStartTime) / 1000;

    wsRef.current.send(JSON.stringify({
      type: 'answer',
      mode: 'text',
      content: currentAnswer,
      response_time: responseTime
    }));

    setMessages(prev => [...prev, { role: 'student', content: currentAnswer }]);
    setCurrentAnswer('');
  };

  const endExam = () => {
    if (window.confirm('Are you sure you want to end the exam?')) {
      wsRef.current?.send(JSON.stringify({ type: 'end_exam' }));
    }
  };

  if (!examStarted) {
    return (
      <div className="row justify-content-center">
        <div className="col-lg-6">
          <div className="card border-0 shadow-lg">
            <div className="card-body text-center p-5">
              <div className="mb-4" style={{ fontSize: '64px' }}>📚</div>
              <h3 className="fw-bold mb-3">Ready for Your Exam?</h3>
              <p className="text-muted mb-4">
                This is an <strong className="text-primary">AI-proctored oral examination</strong>.
                You'll have a conversation with our intelligent AI examiner about your project.
              </p>

              {error && (
                <div className="alert alert-danger">
                  <strong>❌ Error:</strong> {error}
                </div>
              )}

              {dashboardData && !dashboardData.profile_complete && (
                <div className="alert alert-warning">
                  <strong>⚠️ Warning:</strong> Please complete your profile first!
                </div>
              )}

              {dashboardData && dashboardData.upcoming_exams && dashboardData.upcoming_exams.length === 0 && (
                <div className="alert alert-info">
                  <strong>ℹ️ Info:</strong> No exam scheduled yet. Please wait for your instructor to schedule an exam.
                </div>
              )}

              <div className="alert alert-info">
                <strong>💡 Tip:</strong> Make sure:
                <ul className="text-start mt-2 mb-0">
                  <li>Your profile is complete</li>
                  <li>Exam is scheduled by instructor</li>
                  <li>Current time is within exam window</li>
                  <li>You know your Student ID</li>
                </ul>
              </div>

              {/* Exam Selection */}
              {dashboardData && dashboardData.upcoming_exams && dashboardData.upcoming_exams.length > 0 && (
                <div className="mb-4">
                  <h5 className="fw-bold mb-3">📋 Available Exams</h5>
                  <div className="row g-3">
                    {dashboardData.upcoming_exams.map((exam, idx) => (
                      <div key={idx} className="col-12">
                        <div
                          className={`card h-100 cursor-pointer border-2 ${
                            selectedExam === idx ? 'border-primary bg-light' : 'border-secondary'
                          }`}
                          onClick={() => !exam.is_completed && setSelectedExam(idx)}
                          style={{
                            cursor: exam.is_completed ? 'not-allowed' : 'pointer',
                            transition: 'all 0.3s',
                            opacity: exam.is_completed ? 0.7 : 1
                          }}
                        >
                          <div className="card-body">
                            <div className="d-flex justify-content-between align-items-start">
                              <div className="flex-grow-1">
                                <h6 className="fw-bold mb-2">
                                  <span className="badge bg-secondary me-2">Exam #{exam.exam_number || idx + 1}</span>
                                  {exam.type === 'pdf' ? '📚 ' : '🤖 '}
                                  {exam.exam_name || (exam.type === 'pdf' ? 'PDF-Based Exam' : 'Project-Based Exam')}
                                  {exam.is_completed && <span className="badge bg-success ms-2">✓ Completed</span>}
                                </h6>
                                <small className="text-muted d-block">
                                  {exam.type === 'pdf' ? (
                                    <>
                                      <div>📅 Start: {exam.start_time ? new Date(exam.start_time).toLocaleString() : 'Not scheduled'}</div>
                                      {exam.end_time && (
                                        <div>📅 End: {new Date(exam.end_time).toLocaleString()}</div>
                                      )}
                                      {exam.duration && (
                                        <div>⏱️ Duration: {exam.duration} minutes</div>
                                      )}
                                      {exam.is_completed && (
                                        <div className="text-success fw-semibold mt-2">You have already completed this exam</div>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <div>📅 {new Date(exam.start_time).toLocaleString()}</div>
                                      <div>⏱️ Duration: {exam.duration} minutes</div>
                                    </>
                                  )}
                                </small>
                              </div>
                              <div>
                                <input
                                  type="radio"
                                  name="exam-select"
                                  checked={selectedExam === idx}
                                  onChange={() => !exam.is_completed && setSelectedExam(idx)}
                                  disabled={exam.is_completed}
                                  style={{ width: '20px', height: '20px', cursor: exam.is_completed ? 'not-allowed' : 'pointer' }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary btn-lg"
                onClick={() => startExam(selectedExam !== null ? dashboardData.upcoming_exams[selectedExam] : null)}
                disabled={loading || selectedExam === null}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Starting...
                  </>
                ) : (
                  '▶️ Start Selected Exam'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="row justify-content-center">
      <div className="col-lg-10">
        <div className="card border-0 shadow-lg">
          <div className="card-header text-white p-3"
               style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center">
                <span className="me-2" style={{ fontSize: '32px' }}>🤖</span>
                <div>
                  <h6 className="mb-0 fw-bold">AI Examiner</h6>
                  <small className="opacity-75">🟢 Online</small>
                </div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={endExam}>
                ⏹️ End Exam
              </button>
            </div>
          </div>

          <div className="card-body bg-light" style={{ height: '500px', overflowY: 'auto' }}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`d-flex mb-3 ${msg.role === 'student' ? 'justify-content-end' : 'justify-content-start'}`}>
                <div
                  className={`p-3 rounded-3 ${
                    msg.role === 'ai' ? 'bg-white shadow-sm' :
                    msg.role === 'student' ? 'text-white' :
                    'bg-success text-white text-center w-100'
                  }`}
                  style={{
                    maxWidth: '70%',
                    background: msg.role === 'student'
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : undefined
                  }}
                >
                  {msg.role === 'ai' && (
                    <small className="text-primary fw-semibold d-block mb-1">AI Examiner</small>
                  )}
                  <p className="mb-0">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="card-footer bg-white p-3">
            <div className="input-group">
              <input
                type="text"
                className="form-control form-control-lg"
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendAnswer()}
                placeholder="Type your answer here..."
              />
              <button className="btn btn-primary" onClick={sendAnswer}>
                ➤ Send
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    );
}
export default TakeExam;
