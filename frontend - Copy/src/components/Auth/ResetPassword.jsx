import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function ResetPassword({ onBack, presetToken }) {
  const [token, setToken] = useState(presetToken || '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!presetToken) {
      // attempt to read token from querystring
      const params = new URLSearchParams(window.location.search);
      const t = params.get('token');
      if (t) setToken(t);
    }
  }, [presetToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await api.resetPassword(token, password);
      setMessage(res.message || 'Password reset successful. Please login.');
    } catch {
      setMessage('Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card shadow-lg border-0 rounded-4">
      <div className="card-body p-4">
        <h4 className="mb-3">Set a new password</h4>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Reset Token</label>
            <input type="text" className="form-control" value={token} onChange={(e) => setToken(e.target.value)} required />
          </div>

          <div className="mb-3">
            <label className="form-label">New password</label>
            <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {message && <div className="alert alert-info">{message}</div>}

          <div className="d-flex gap-2">
            <button className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save password'}</button>
            <button type="button" className="btn btn-outline-secondary" onClick={onBack}>Back</button>
          </div>
        </form>
      </div>
    </div>
  );
}
