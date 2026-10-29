import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Upload, CheckCircle, FileText } from 'lucide-react';
import { supabase } from '../utils/supabase';
import TurnstileWidget, { TURNSTILE_SITE_KEY } from '../components/TurnstileWidget';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function SubmitResumePage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    lookingFor: '',
    timeline: '',
    preferredLocation: '',
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!captchaToken) {
      setError('Please complete the verification check.');
      return;
    }
    setSubmitting(true);

    const ALLOWED_TYPES = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

    let resume: { type: string; data: string } | null = null;
    if (resumeFile) {
      if (!ALLOWED_TYPES.includes(resumeFile.type)) {
        setError('Only PDF, DOC, and DOCX files are allowed.');
        setSubmitting(false);
        return;
      }
      if (resumeFile.size > MAX_FILE_SIZE) {
        setError('File must be under 5 MB.');
        setSubmitting(false);
        return;
      }
      // The function uploads the file after the CAPTCHA passes, so there's no
      // direct storage write from the browser.
      try {
        resume = { type: resumeFile.type, data: await fileToBase64(resumeFile) };
      } catch {
        setError('We couldn\'t read that file. Please re-select it and try again.');
        setSubmitting(false);
        return;
      }
    }

    const { data, error: submitError } = await supabase.functions.invoke('submit-resume', {
      body: {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || null,
        lookingFor: form.lookingFor,
        timeline: form.timeline || null,
        preferredLocation: form.preferredLocation,
        resume,
        captchaToken,
      },
    });

    if (submitError || !data?.success) {
      // Non-2xx responses surface as an error whose body holds the function's message.
      let code = data?.error as string | undefined;
      const response = (submitError as { context?: Response } | null)?.context;
      if (!code && response && typeof response.json === 'function') {
        code = (await response.json().catch(() => null))?.error;
      }
      console.error('Submission error:', code ?? submitError?.message);
      const captchaFailed = code === 'captcha_failed' || code === 'captcha_required';
      setError(
        captchaFailed
          ? 'We couldn\'t verify you\'re human. Please complete the check and try again.'
          : code && /files? |File /.test(code)
            ? code
            : 'Something went wrong. Please try again.'
      );
      // Turnstile tokens are single-use, so a failed attempt needs a fresh one.
      setCaptchaToken(null);
      setCaptchaResetKey((k) => k + 1);
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="page apply-page">
        <div className="apply-success-card">
          <div className="apply-success-icon">
            <CheckCircle size={48} />
          </div>
          <h2>Resume Submitted!</h2>
          <p>
            Thank you for submitting your resume. We've received your information and will reach out
            if a matching opportunity becomes available.
          </p>
          <div className="apply-success-actions">
            <Link to="/" className="btn btn-primary">Browse Open Positions</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page apply-page">
      <Helmet>
        <title>Submit Your Resume - Association Careers</title>
        <meta name="description" content="Submit your resume confidentially to be considered for association career opportunities across the United States." />
      </Helmet>
      <div className="submit-resume-header">
        <div className="submit-resume-icon">
          <FileText size={32} />
        </div>
        <h1>Become a Candidate</h1>
        <p>
          Don't see a position that fits? Submit your information and we'll keep it on file.
          If a matching opportunity opens up, we'll reach out to you directly.
        </p>
        <p className="submit-resume-confidential">
          Rest assured, your information is always kept 100% Confidential.
        </p>
      </div>

      <div className="apply-form-card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>First Name</label>
              <input
                className="input"
                required
                value={form.firstName}
                onChange={(e) => update('firstName', e.target.value)}
                placeholder="Jane"
              />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input
                className="input"
                required
                value={form.lastName}
                onChange={(e) => update('lastName', e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input
                className="input"
                type="email"
                required
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="jane@example.com"
              />
            </div>
            <div className="form-group">
              <label>Phone (optional)</label>
              <input
                className="input"
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div className="form-group">
            <label>What type of role are you looking for?</label>
            <textarea
              className="input textarea"
              required
              value={form.lookingFor}
              onChange={(e) => update('lookingFor', e.target.value)}
              placeholder="e.g. Government Affairs Director, looking to advance from a small association to a larger one..."
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>When are you looking to make a change?</label>
              <select
                className="input"
                value={form.timeline}
                onChange={(e) => update('timeline', e.target.value)}
              >
                <option value="">Select a timeframe...</option>
                <option value="Immediately">Immediately</option>
                <option value="Within 1-3 months">Within 1-3 months</option>
                <option value="Within 3-6 months">Within 3-6 months</option>
                <option value="Within 6-12 months">Within 6-12 months</option>
                <option value="Just exploring">Just exploring</option>
              </select>
            </div>
            <div className="form-group">
              <label>Preferred Location</label>
              <input
                className="input"
                required
                value={form.preferredLocation}
                onChange={(e) => update('preferredLocation', e.target.value)}
                placeholder="e.g. Anywhere in the US, West Coast, Atlanta, GA..."
              />
            </div>
          </div>

          <div className="form-group">
            <label>Resume</label>
            <div
              className={`file-drop ${resumeFile ? 'file-drop-active' : ''}`}
              onClick={() => document.getElementById('resume-input')?.click()}
            >
              <input
                id="resume-input"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                hidden
              />
              {resumeFile ? (
                <div className="file-drop-selected">
                  <Upload size={18} />
                  <span>{resumeFile.name}</span>
                  <button
                    type="button"
                    className="file-drop-remove"
                    onClick={(e) => { e.stopPropagation(); setResumeFile(null); }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="file-drop-empty">
                  <Upload size={24} />
                  <span>Click to upload your resume</span>
                  <span className="file-drop-hint">PDF, DOC, or DOCX</span>
                </div>
              )}
            </div>
          </div>

          {TURNSTILE_SITE_KEY ? (
            <div className="form-group">
              <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaResetKey} />
              {!captchaToken && (
                <p className="file-drop-hint" id="captcha-hint">
                  Complete the verification above to enable Submit. If it doesn't appear, disable
                  ad blockers for this page and reload.
                </p>
              )}
            </div>
          ) : (
            <p className="error-text" role="alert">
              Verification is temporarily unavailable. Please try again later or contact support.
            </p>
          )}

          {error && <p className="error-text" role="alert">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={submitting || !captchaToken}
            aria-describedby={captchaToken ? undefined : 'captcha-hint'}
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}
