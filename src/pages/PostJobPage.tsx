import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { geocodeAddress, normalizeState } from '../utils/geocode';
import { JOB_TYPE_OPTIONS, ARRANGEMENT_OPTIONS } from '../constants/jobStyles';
import { US_STATES } from '../constants/usStates';

interface TagOption {
  id: string;
  name: string;
  color: string;
}

export default function PostJobPage() {
  const { user, companyName, isAdmin, isApproved, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tags, setTags] = useState<TagOption[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    requirements: '',
    salary: '',
    jobType: 'full-time' as string,
    workArrangement: 'on-site' as string,
    companyNameOverride: '',
    address: '',
    city: '',
    state: '',
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate('/auth');
  }, [user, authLoading]);

  useEffect(() => {
    supabase.from('tags').select('id, name, color').order('name').then(({ data }) => {
      if (data) setTags(data);
    });
  }, []);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const state = normalizeState(form.state);
    const geo = await geocodeAddress(form.city, state);
    if (!geo) {
      setError('Could not geocode the location. Please check the city and state.');
      setLoading(false);
      return;
    }

    const jobCompanyName = isAdmin && form.companyNameOverride.trim()
      ? form.companyNameOverride.trim()
      : companyName;

    const { data: jobData, error: insertError } = await supabase.from('jobs').insert({
      employer_id: user!.id,
      company_name: jobCompanyName,
      title: form.title,
      description: form.description,
      requirements: form.requirements,
      salary: form.salary,
      job_type: form.jobType,
      work_arrangement: form.workArrangement,
      address: form.address,
      city: form.city,
      state,
      lat: geo.lat,
      lng: geo.lng,
    }).select('id').single();

    if (insertError || !jobData) {
      setError(insertError?.message || 'Failed to create job');
      setLoading(false);
      return;
    }

    // Insert tags
    if (selectedTags.length > 0) {
      await supabase.from('job_tags').insert(
        selectedTags.map((tagId) => ({ job_id: jobData.id, tag_id: tagId }))
      );
    }

    navigate('/dashboard');
  }

  if (authLoading || !user) return <div className="page"><div className="loading">Loading...</div></div>;

  if (!isApproved) {
    return (
      <div className="page">
        <div className="page-header">
          <Link to="/dashboard" className="back-link">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
        </div>
        <div className="pending-approval-card">
          <div className="pending-approval-icon"><Clock size={40} /></div>
          <h2>Account Pending Approval</h2>
          <p>Your employer account is awaiting admin approval. Once approved, you'll be able to create job postings.</p>
          <Link to="/dashboard" className="btn btn-outline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/dashboard" className="back-link">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <h1 className="page-title">Post a New Job</h1>
        <p className="page-subtitle">Fill in the details below. Your listing will go live immediately.</p>
      </div>

      <div className="form-card">
        <form onSubmit={handleSubmit}>
          {isAdmin && (
            <div className="form-group">
              <label>Company Name</label>
              <input className="input" value={form.companyNameOverride} onChange={(e) => update('companyNameOverride', e.target.value)} placeholder={companyName || 'Leave blank to use your company name'} />
              <p className="form-hint">Admin: enter any company name, or leave blank to use yours.</p>
            </div>
          )}

          <div className="form-group">
            <label>Job Title</label>
            <input className="input" required value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Government Affairs Director" />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea className="input textarea" required value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Describe the role, responsibilities..." rows={5} />
          </div>

          <div className="form-group">
            <label>Requirements</label>
            <textarea className="input textarea" required value={form.requirements} onChange={(e) => update('requirements', e.target.value)} placeholder="Skills, experience, qualifications..." rows={3} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Salary Range</label>
              <input className="input" required value={form.salary} onChange={(e) => update('salary', e.target.value)} placeholder="e.g. $100,000 - $130,000" />
            </div>
            <div className="form-group">
              <label>Job Type</label>
              <select className="input" value={form.jobType} onChange={(e) => update('jobType', e.target.value)}>
                {JOB_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Work Arrangement</label>
              <select className="input" value={form.workArrangement} onChange={(e) => update('workArrangement', e.target.value)}>
                {ARRANGEMENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {tags.length > 0 && (
            <div className="form-group">
              <label>Categories</label>
              <p className="form-hint">Select the categories that best describe this position.</p>
              <div className="tag-picker">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`tag-pill ${selectedTags.includes(tag.id) ? 'tag-pill-active' : ''}`}
                    style={selectedTags.includes(tag.id) ? { backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color } : {}}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Street Address</label>
            <input className="input" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="123 Main St" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>City</label>
              <input className="input" required value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="San Francisco" />
            </div>
            <div className="form-group">
              <label>State</label>
              <select className="input" required value={form.state} onChange={(e) => update('state', e.target.value)}>
                <option value="">Select state...</option>
                {US_STATES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? 'Publishing...' : 'Publish Job'}
          </button>
        </form>
      </div>
    </div>
  );
}
