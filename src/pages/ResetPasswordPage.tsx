import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { supabase } from '../utils/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="page auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-header">
            <div style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#38b653', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <KeyRound size={24} color="white" />
            </div>
            <h2>Password updated</h2>
            <p className="auth-subtitle">Your password has been reset successfully.</p>
          </div>
          <button className="btn btn-primary btn-full" style={{ marginTop: '1.5rem' }} onClick={() => navigate('/dashboard')}>
            Continue to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#38b653', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
            <KeyRound size={24} color="white" />
          </div>
          <h2>Set new password</h2>
          <p className="auth-subtitle">Enter your new password below.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Min 6 characters"
              minLength={6}
              required
            />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input"
              placeholder="Confirm your password"
              minLength={6}
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
