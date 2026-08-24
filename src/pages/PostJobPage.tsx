import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Building2, Plus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { geocodeAddress, normalizeState } from '../utils/geocode';
import { JOB_TYPE_OPTIONS, ARRANGEMENT_OPTIONS } from '../constants/jobStyles';
import { US_STATES } from '../constants/usStates';
import type { EmployerAltName } from '../types';

interface TagOption {
  id: string;
  name: string;
  color: string;
}

export default function PostJobPage() {
  const { user, companyName, isAdmin, isApproved, isStateAssociation, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tags, setTags] = useState<TagOption[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // Local association names this state association may post under.
  const [altNames, setAltNames] = useState<EmployerAltName[]>([]);
  const [altNameId, setAltNameId] = useState('');
  const [requestingName, setRequestingName] = useState(false);
  const [newAltName, setNewAltName] = useState('');
  const [altNameError, setAltNameError] = useState('');
  const [altNameSaving, setAltNameSaving] = useState(false);
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

  useEffect(() => {
    if (!isStateAssociation) return;
    loadAltNames();
  }, [isStateAssociation]);

  async function loadAltNames() {
    const { data } = await supabase
      .from('employer_alt_names')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setAltNames(data);
  }

  async function requestAltName() {
    const trimmed = newAltName.trim();
    if (!trimmed) return;
    setAltNameError('');
    setAltNameSaving(true);

    // employer_id is the employers row id, not the auth user id.
    const { data: employer } = await supabase
      .from('employers')
      .select('id')
      .eq('user_id', user!.id)
      .single();

    if (!employer) {
      setAltNameError('Could not load your association record. Please refresh and try again.');
      setAltNameSaving(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from('employer_alt_names')
      .insert({ employer_id: employer.id, name: trimmed })
      .select()
      .single();

    if (insertError) {
      setAltNameError(
        insertError.code === '23505'
          ? 'You have already requested that name.'
          : insertError.message
      );
      setAltNameSaving(false);
      return;
    }

    setAltNames((prev) => [data, ...prev]);
    setAltNameId(data.id);
    setNewAltName('');
    setRequestingName(false);
    setAltNameSaving(false);
  }

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

    // company_name is only a proposal — jobs_apply_alt_name() resolves the
    // published name from the linked request's approval status.
    const { data: jobData, error: insertError } = await supabase.from('jobs').insert({
      employer_id: user!.id,
      company_name: jobCompanyName,
      alt_name_id: altNameId || null,
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

  const selectedAltName = altNames.find((an) => an.id === altNameId) || null;

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

          {isStateAssociation && (
            <div className="form-group">
              <label><Building2 size={14} /> Posting for a local association?</label>
              <p className="form-hint">
                Leave this as your own association unless you're hiring on behalf of a local
                association. Names need a one-time approval from Paramount before they appear
                on the listing.
              </p>
              <select
                className="input"
                value={altNameId}
                onChange={(e) => setAltNameId(e.target.value)}
              >
                <option value="">{companyName} (your association)</option>
                {altNames.map((an) => (
                  <option key={an.id} value={an.id}>
                    {an.name}
                    {an.status === 'pending' && ' — awaiting approval'}
                    {an.status === 'declined' && ' — declined'}
                  </option>
                ))}
              </select>

              {selectedAltName?.status === 'pending' && (
                <p className="form-hint form-hint-warning">
                  This name is still awaiting approval, so the listing will publish as
                  <strong> {companyName}</strong> and switch to <strong>{selectedAltName.name}</strong>
                  {' '}once it's approved.
                </p>
              )}
              {selectedAltName?.status === 'declined' && (
                <p className="error-text">
                  This name was declined
                  {selectedAltName.review_note ? `: ${selectedAltName.review_note}` : '.'} The
                  listing will publish as {companyName}.
                </p>
              )}

              {requestingName ? (
                <div className="alt-name-request">
                  <input
                    className="input"
                    value={newAltName}
                    onChange={(e) => setNewAltName(e.target.value)}
                    placeholder="e.g. Three Rivers Association of REALTORS"
                    maxLength={200}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); requestAltName(); }
                      if (e.key === 'Escape') { setRequestingName(false); setAltNameError(''); }
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={requestAltName}
                    disabled={!newAltName.trim() || altNameSaving}
                  >
                    {altNameSaving ? 'Sending...' : 'Request'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => { setRequestingName(false); setAltNameError(''); }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-outline alt-name-add-btn"
                  onClick={() => setRequestingName(true)}
                >
                  <Plus size={14} /> Request a local association name
                </button>
              )}
              {altNameError && <p className="error-text">{altNameError}</p>}
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
