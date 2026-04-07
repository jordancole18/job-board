import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Mail, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { US_STATES } from '../constants/usStates';

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      setResetSent(true);
      return;
    }

    if (mode === 'signup') {
      if (!companyName.trim()) {
        setError('Association name is required');
        setLoading(false);
        return;
      }
      if (!firstName.trim() || !lastName.trim()) {
        setError('First and last name are required');
        setLoading(false);
        return;
      }
      const result = await signUp(email, password, {
        companyName: companyName.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        title: title.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state || undefined,
        zip: zip.trim() || undefined,
      });
      if (result === 'check_email') {
        setCheckEmail(true);
        setLoading(false);
        return;
      }
      if (result) {
        setError(result);
        setLoading(false);
        return;
      }
    } else {
      const err = await signIn(email, password);
      if (err) {
        setError(err);
        setLoading(false);
        return;
      }
    }

    navigate('/dashboard');
  }

  if (checkEmail) {
    return (
      <div className="page auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-header">
            <div style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#38b653', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <Mail size={24} color="white" />
            </div>
            <h2>Check your email</h2>
            <p className="auth-subtitle">
              We sent a confirmation link to <strong>{email}</strong>. Click the link in the email to activate your account.
            </p>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '1.5rem' }}>
            Didn't receive it? Check your spam folder or{' '}
            <button onClick={() => { setCheckEmail(false); setMode('signup'); }} className="link-btn">
              try again
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (resetSent) {
    return (
      <div className="page auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-header">
            <div style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#38b653', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <KeyRound size={24} color="white" />
            </div>
            <h2>Check your email</h2>
            <p className="auth-subtitle">
              We sent a password reset link to <strong>{email}</strong>. Click the link to set a new password.
            </p>
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '1.5rem' }}>
            <button onClick={() => { setResetSent(false); setMode('signin'); setError(''); }} className="link-btn">
              Back to sign in
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <rect width="52" height="52" rx="16" fill="#38b653" />
              <Briefcase x="14" y="14" width="24" height="24" color="white" strokeWidth={1.5} />
            </svg>
          </div>
          <h2>{mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Welcome back'}</h2>
          <p className="auth-subtitle">
            {mode === 'signup' ? 'Start posting jobs in minutes' : mode === 'forgot' ? 'Enter your email and we\'ll send a reset link' : 'Sign in to manage your job postings'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="input"
                    placeholder="Jane"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="input"
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Title (optional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  placeholder="e.g. Executive Director"
                />
              </div>
              <div className="form-group">
                <label>Association Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="input"
                  placeholder="Your association name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Address (optional)</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="input"
                  placeholder="Street address"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>City (optional)</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="input"
                    placeholder="City"
                  />
                </div>
                <div className="form-group">
                  <label>State (optional)</label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="input"
                  >
                    <option value="">Select state...</option>
                    {US_STATES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Zip (optional)</label>
                  <input
                    type="text"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    className="input"
                    placeholder="Zip"
                    maxLength={10}
                  />
                </div>
              </div>
            </>
          )}
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@association.org"
              required
            />
            {mode === 'signup' && (
              <p className="auth-email-disclaimer">
                <strong>Important:</strong> This platform is exclusively for real estate association professionals. To be approved, you must register using your association-issued email address. Personal email accounts (Gmail, Yahoo, etc.) will not be approved.
              </p>
            )}
          </div>
          {mode !== 'forgot' && (
            <div className="form-group">
              <label>Password</label>
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
          )}
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Send Reset Link' : 'Sign In'}
          </button>
        </form>

        {mode === 'signin' && (
          <p style={{ textAlign: 'center', marginTop: '0.75rem' }}>
            <button onClick={() => { setMode('forgot'); setError(''); }} className="link-btn" style={{ fontSize: '0.875rem' }}>
              Forgot your password?
            </button>
          </p>
        )}

        <div className="auth-divider"><span>or</span></div>

        <p className="auth-toggle">
          {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); }} className="link-btn">
            {mode === 'signup' ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}
