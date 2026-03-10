import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, DollarSign, Upload, CheckCircle } from 'lucide-react';
import { supabase } from '../utils/supabase';

interface Job {
  id: string;
  title: string;
  company_name: string;
  salary: string;
  job_type: string;
  city: string;
  state: string;
}

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

export default function ApplyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('jobs')
        .select('id, title, company_name, salary, job_type, city, state')
        .eq('id', id)
        .single();
      setJob(data);
      setLoading(false);
    }
    load();
  }, [id]);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function uploadFile(file: File, folder: string): Promise<{ path: string | null; error: string | null }> {
    const ext = file.name.split('.').pop();
    const filePath = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('applications').upload(filePath, file);
    if (error) return { path: null, error: error.message };
    return { path: filePath, error: null };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (!resumeFile) {
      setError('Please upload your resume.');
      setSubmitting(false);
      return;
    }

    const resume = await uploadFile(resumeFile, 'resumes');
    if (resume.error) {
      setError(`Resume upload failed: ${resume.error}`);
      setSubmitting(false);
      return;
    }

    let coverLetterPath: string | null = null;
    if (coverLetterFile) {
      const cl = await uploadFile(coverLetterFile, 'cover-letters');
      if (cl.error) {
        setError(`Cover letter upload failed: ${cl.error}`);
        setSubmitting(false);
        return;
      }
      coverLetterPath = cl.path;
    }

    const { error: insertError } = await supabase.from('applications').insert({
      job_id: id,
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email,
      phone: form.phone,
      resume_url: resume.path,
      cover_letter_url: coverLetterPath,
    });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  if (loading) return <div className="page"><div className="loading">Loading...</div></div>;
  if (!job) return <div className="page"><div className="empty-state"><h3>Job not found</h3><Link to="/">Back to jobs</Link></div></div>;

  const avatarColor = AVATAR_COLORS[job.company_name.charCodeAt(0) % AVATAR_COLORS.length];

  if (submitted) {
    return (
      <div className="page apply-page">
        <div className="apply-success-card">
          <div className="apply-success-icon">
            <CheckCircle size={48} />
          </div>
          <h2>Application Submitted!</h2>
          <p>
            Your application for <strong>{job.title}</strong> at <strong>{job.company_name}</strong> has been received.
            The employer will review it and reach out if there's a match.
          </p>
          <div className="apply-success-actions">
            <Link to={`/jobs/${id}`} className="btn btn-outline">Back to Job</Link>
            <Link to="/" className="btn btn-primary">Browse More Jobs</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page apply-page">
      <Link to={`/jobs/${id}`} className="back-link">
        <ArrowLeft size={16} /> Back to job details
      </Link>

      <div className="apply-layout">
        <div className="apply-job-summary">
          <div className="apply-job-avatar" style={{ backgroundColor: avatarColor }}>
            {job.company_name.charAt(0)}
          </div>
          <div>
            <h3 className="apply-job-title">{job.title}</h3>
            <p className="apply-job-company">{job.company_name}</p>
          </div>
          <div className="apply-job-details">
            <span><MapPin size={14} /> {job.city}, {job.state}</span>
            <span><DollarSign size={14} /> {job.salary}</span>
          </div>
        </div>

        <div className="apply-form-card">
          <div className="apply-form-header">
            <h2>Apply for this position</h2>
            <p>Fill in your details and upload your documents below.</p>
          </div>

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

            <div className="form-group">
              <label>Cover Letter (optional)</label>
              <div
                className={`file-drop ${coverLetterFile ? 'file-drop-active' : ''}`}
                onClick={() => document.getElementById('cover-input')?.click()}
              >
                <input
                  id="cover-input"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setCoverLetterFile(e.target.files?.[0] ?? null)}
                  hidden
                />
                {coverLetterFile ? (
                  <div className="file-drop-selected">
                    <Upload size={18} />
                    <span>{coverLetterFile.name}</span>
                    <button
                      type="button"
                      className="file-drop-remove"
                      onClick={(e) => { e.stopPropagation(); setCoverLetterFile(null); }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="file-drop-empty">
                    <Upload size={24} />
                    <span>Click to upload a cover letter</span>
                    <span className="file-drop-hint">PDF, DOC, or DOCX</span>
                  </div>
                )}
              </div>
            </div>

            {error && <p className="error-text">{error}</p>}

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={submitting}>
              {submitting ? 'Submitting Application...' : 'Submit Application'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
