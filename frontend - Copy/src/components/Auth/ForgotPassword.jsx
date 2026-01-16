import React, { useState } from 'react';
import { api } from '../../services/api';

export default function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await api.forgotPassword(email);
      setMessage(res.message || 'If an account exists, a reset link was sent.');
    } catch {
      setMessage('Failed to send request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card shadow-lg border-0 rounded-4">
      <div className="card-body p-4">
        <h4 className="mb-3">Reset your password</h4>
        <p className="text-muted">Enter your account email and we'll send a reset link.</p>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          {message && <div className="alert alert-info">{message}</div>}

          <div className="d-flex gap-2">
            <button className="btn btn-primary" disabled={loading}>{loading ? 'Sending...' : 'Send reset link'}</button>
            <button type="button" className="btn btn-outline-secondary" onClick={onBack}>Back</button>
          </div>
        </form>
      </div>
    </div>
  );
}
