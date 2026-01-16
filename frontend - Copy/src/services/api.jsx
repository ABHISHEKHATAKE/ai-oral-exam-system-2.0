const API_URL = 'https://ai-oral-exam-system-2-0-6.onrender.com' || 'http://localhost:8000';

export const api = {
  // Auth
  signup: async (userData) => {
    const response = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return response.json();
  },

  login: async (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${API_URL}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData
    });
    return response.json();
  },

  // Student APIs
  createProfile: async (token, profileData) => {
    const response = await fetch(`${API_URL}/api/student/profile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(profileData)
    });
    return response.json();
  },

  getStudentDashboard: async (token) => {
    const response = await fetch(`${API_URL}/api/student/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  },

  startExam: async (token, studentId, examData = null) => {
    const requestBody = { student_id: studentId };
    if (examData) {
      requestBody.exam_data = examData;
    }
    const response = await fetch(`${API_URL}/api/exams/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    return response.json();
  },

  processAnswer: async (examId, answer, responseTime, token) => {
    const response = await fetch(`${API_URL}/api/exams/process_answer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        exam_id: examId,
        answer: answer,
        response_time: responseTime
      })
    });
    return response.json();
  },

  getStudentResults: async (token) => {
    const response = await fetch(`${API_URL}/api/student/results`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  },

  changeStudentId: async (token, payload) => {
    const response = await fetch(`${API_URL}/api/student/change-id`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return response.json();
  },

  // Instructor APIs
  getInstructorDashboard: async (token) => {
    const response = await fetch(`${API_URL}/api/instructor/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  },

  getStudents: async (token) => {
    const response = await fetch(`${API_URL}/api/instructor/students`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  },

  scheduleExam: async (token, scheduleData) => {
    const response = await fetch(`${API_URL}/api/instructor/schedule-exam`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(scheduleData)
    });
    return response.json();
  },

  getExamResult: async (token, examId) => {
    const response = await fetch(`${API_URL}/api/instructor/results/${examId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
  },


  uploadPDF: async (token, file, instruction) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('instruction', instruction);

    const response = await fetch(`${API_URL}/api/instructor/upload_pdf`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    return response.json();
  },

  schedulePDFExam: async (token, examData) => {
    const formData = new FormData();
    formData.append('student_id', examData.student_id);
    formData.append('file', examData.pdf_file);
    formData.append('instruction', examData.instruction);
    formData.append('exam_name', examData.exam_name);
    
    if (examData.start_time) {
      formData.append('start_time', examData.start_time);
    }
    if (examData.duration_minutes) {
      formData.append('duration_minutes', examData.duration_minutes);
    }

    const response = await fetch(`${API_URL}/api/instructor/schedule-pdf-exam`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    return response.json();
  }
};

// Export API_URL for WebSocket connections
export { API_URL };
