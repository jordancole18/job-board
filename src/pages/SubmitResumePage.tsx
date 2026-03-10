import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, CheckCircle, FileText } from 'lucide-react';
import { supabase } from '../utils/supabase';

export default function SubmitResumePage() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    lookingFor: '',
    preferredLocation: '',
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    let resumePath: string | null = null;
    if (resumeFile) {
      const ext = resumeFile.name.split('.').pop();
      const filePath = `general-submissions/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('applications').upload(filePath, resumeFile);
      if (uploadError) {
        setError(`Resume upload failed: ${uploadError.message}`);
        setSubmitting(false);
        return;
      }
      resumePath = filePath;
    }

    const { error: insertError } = await supabase.from('general_submissions').insert({
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email,
      phone: form.phone || null,
      looking_for: form.lookingFor || null,
      preferred_location: form.preferredLocation || null,
      resume_url: resumePath,
    });

    if (insertError) {
      setError(insertError.message);
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
      <div className="submit-resume-header">
        <div className="submit-resume-icon">
          <FileText size={32} />
        </div>
        <h1>Submit Your Resume</h1>
        <p>
          Don't see a position that fits? Submit your resume and we'll keep it on file.
          If a matching opportunity opens up, we'll reach out to you directly.
        </p>
        <p className="submit-resume-confidential">
          Your information is kept confidential.
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
              value={form.lookingFor}
              onChange={(e) => update('lookingFor', e.target.value)}
              placeholder="e.g. Government Affairs Director, looking to advance from a small association to a larger one..."
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Preferred Location (optional)</label>
            <input
              className="input"
              value={form.preferredLocation}
              onChange={(e) => update('preferredLocation', e.target.value)}
              placeholder="e.g. Anywhere in the US, West Coast, Atlanta, GA..."
            />
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

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Resume'}
          </button>
        </form>
      </div>
    </div>
  );
}
