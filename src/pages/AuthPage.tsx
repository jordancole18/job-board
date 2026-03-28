import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isSignUp) {
      if (!companyName.trim()) {
        setError('Company name is required');
        setLoading(false);
        return;
      }
      const result = await signUp(email, password, companyName.trim());
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
            <button onClick={() => { setCheckEmail(false); setIsSignUp(true); }} className="link-btn">
              try again
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
          <h2>{isSignUp ? 'Create your account' : 'Welcome back'}</h2>
          <p className="auth-subtitle">
            {isSignUp ? 'Start posting jobs in minutes' : 'Sign in to manage your job postings'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <div className="form-group">
              <label>Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="input"
                placeholder="Your company name"
                required
              />
            </div>
          )}
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@company.com"
              required
            />
          </div>
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
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>

        <p className="auth-toggle">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => { setIsSignUp(!isSignUp); setError(''); }} className="link-btn">
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}
