import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, FileText, Star, Plus, Trash2, Download, Eye, Pencil, Check, X, Users, ShieldCheck, ShieldX, Crown, Briefcase, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { JOB_TYPE_OPTIONS, ARRANGEMENT_OPTIONS } from '../constants/jobStyles';

interface TagItem {
  id: string;
  name: string;
  color: string;
}

interface Submission {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  looking_for: string | null;
  timeline: string | null;
  preferred_location: string | null;
  resume_url: string | null;
  created_at: string;
}

interface AdminJob {
  id: string;
  title: string;
  company_name: string;
  description: string;
  requirements: string;
  salary: string;
  address: string;
  city: string;
  state: string;
  job_type: string;
  work_arrangement: string;
  is_featured: boolean;
  status: string;
  created_at: string;
}

interface Employer {
  id: string;
  user_id: string;
  company_name: string;
  is_admin: boolean;
  is_approved: boolean;
  created_at: string;
}

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tags' | 'submissions' | 'jobs' | 'employers' | 'settings'>('employers');

  // Tags state
  const [tags, setTags] = useState<TagItem[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');

  // Submissions state
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  // Featured jobs state
  const [allJobs, setAllJobs] = useState<AdminJob[]>([]);

  // Employers state
  const [employers, setEmployers] = useState<Employer[]>([]);

  // Job editing state
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editJobForm, setEditJobForm] = useState({
    title: '', description: '', requirements: '', salary: '',
    job_type: '', work_arrangement: '', address: '', city: '', state: '',
  });

  // Settings state
  const [notificationEmail, setNotificationEmail] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      navigate('/dashboard');
      return;
    }
    loadTags();
    loadSubmissions();
    loadJobs();
    loadEmployers();
    loadSettings();
  }, [user, isAdmin, authLoading]);

  async function loadTags() {
    const { data } = await supabase.from('tags').select('*').order('name');
    if (data) setTags(data);
  }

  async function loadSubmissions() {
    const { data } = await supabase
      .from('general_submissions')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setSubmissions(data);
    setSubmissionsLoading(false);
  }

  async function loadJobs() {
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setAllJobs(data);
  }

  async function loadEmployers() {
    const { data } = await supabase
      .from('employers')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setEmployers(data);
  }

  async function toggleApproval(employerId: string, currentlyApproved: boolean) {
    await supabase.from('employers').update({ is_approved: !currentlyApproved }).eq('id', employerId);
    setEmployers((prev) => prev.map((e) => e.id === employerId ? { ...e, is_approved: !currentlyApproved } : e));
  }

  async function toggleAdmin(employerId: string, currentlyAdmin: boolean) {
    const action = currentlyAdmin ? 'remove admin privileges from' : 'grant admin privileges to';
    if (!confirm(`Are you sure you want to ${action} this employer?`)) return;
    const updates: { is_admin: boolean; is_approved?: boolean } = { is_admin: !currentlyAdmin };
    if (!currentlyAdmin) updates.is_approved = true;
    await supabase.from('employers').update(updates).eq('id', employerId);
    setEmployers((prev) => prev.map((e) => e.id === employerId ? { ...e, is_admin: !currentlyAdmin, ...(updates.is_approved ? { is_approved: true } : {}) } : e));
  }

  async function addTag() {
    if (!newTagName.trim()) return;
    const { data, error } = await supabase
      .from('tags')
      .insert({ name: newTagName.trim(), color: newTagColor })
      .select()
      .single();
    if (!error && data) {
      setTags((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagName('');
    }
  }

  async function deleteTag(id: string) {
    if (!confirm('Delete this category? It will be removed from all jobs.')) return;
    await supabase.from('tags').delete().eq('id', id);
    setTags((prev) => prev.filter((t) => t.id !== id));
  }

  async function updateTagName(id: string) {
    const trimmed = editingTagName.trim();
    if (!trimmed) return;
    const { error } = await supabase.from('tags').update({ name: trimmed }).eq('id', id);
    if (!error) {
      setTags((prev) => prev.map((t) => t.id === id ? { ...t, name: trimmed } : t).sort((a, b) => a.name.localeCompare(b.name)));
    }
    setEditingTagId(null);
    setEditingTagName('');
  }

  async function toggleFeatured(jobId: string, current: boolean) {
    await supabase.from('jobs').update({ is_featured: !current }).eq('id', jobId);
    setAllJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, is_featured: !current } : j));
  }

  async function deleteJob(jobId: string) {
    if (!confirm('Delete this job posting? All applications and views will also be removed.')) return;
    await supabase.from('job_tags').delete().eq('job_id', jobId);
    await supabase.from('applications').delete().eq('job_id', jobId);
    await supabase.from('job_views').delete().eq('job_id', jobId);
    await supabase.from('jobs').delete().eq('id', jobId);
    setAllJobs((prev) => prev.filter((j) => j.id !== jobId));
  }


  async function updateJobStatus(jobId: string, status: string) {
    await supabase.from('jobs').update({ status }).eq('id', jobId);
    setAllJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status } : j));
  }

  function startEditingJob(job: AdminJob) {
    setEditJobForm({
      title: job.title, description: job.description, requirements: job.requirements,
      salary: job.salary, job_type: job.job_type, work_arrangement: job.work_arrangement,
      address: job.address || '', city: job.city, state: job.state,
    });
    setEditingJobId(job.id);
  }

  async function saveJobEdit(jobId: string) {
    const { error } = await supabase.from('jobs').update({
      title: editJobForm.title,
      description: editJobForm.description,
      requirements: editJobForm.requirements,
      salary: editJobForm.salary,
      job_type: editJobForm.job_type,
      work_arrangement: editJobForm.work_arrangement,
      address: editJobForm.address,
      city: editJobForm.city,
      state: editJobForm.state,
    }).eq('id', jobId);
    if (error) {
      alert('Failed to save: ' + error.message);
      return;
    }
    setAllJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, ...editJobForm } : j));
    setEditingJobId(null);
  }

  async function downloadFile(storagePath: string) {
    const { data, error } = await supabase.storage
      .from('applications')
      .createSignedUrl(storagePath, 300);
    if (error || !data?.signedUrl) {
      alert(`Download failed: ${error?.message || 'Unknown error'}`);
      return;
    }
    window.open(data.signedUrl, '_blank');
  }

  async function loadSettings() {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'approval_notification_email')
      .single();
    if (data) setNotificationEmail(data.value);
  }

  async function saveNotificationEmail() {
    await supabase
      .from('site_settings')
      .update({ value: notificationEmail, updated_at: new Date().toISOString() })
      .eq('key', 'approval_notification_email');
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  }

  if (authLoading || !user || !isAdmin) return <div className="page"><div className="loading">Loading...</div></div>;

  return (
    <div className="page">
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <p className="admin-subtitle">Manage categories, review submissions, and control featured jobs.</p>
      </div>

      <div className="dashboard-tabs">
        <button
          className={`dashboard-tab ${activeTab === 'employers' ? 'dashboard-tab-active' : ''}`}
          onClick={() => setActiveTab('employers')}
        >
          <Users size={16} /> Employers
          {employers.filter((e) => !e.is_approved && !e.is_admin).length > 0 && (
            <span className="tab-badge">{employers.filter((e) => !e.is_approved && !e.is_admin).length}</span>
          )}
        </button>
        <button
          className={`dashboard-tab ${activeTab === 'tags' ? 'dashboard-tab-active' : ''}`}
          onClick={() => setActiveTab('tags')}
        >
          <Tag size={16} /> Categories
        </button>
        <button
          className={`dashboard-tab ${activeTab === 'submissions' ? 'dashboard-tab-active' : ''}`}
          onClick={() => setActiveTab('submissions')}
        >
          <FileText size={16} /> Resume Submissions
          {submissions.length > 0 && <span className="tab-badge">{submissions.length}</span>}
        </button>
        <button
          className={`dashboard-tab ${activeTab === 'jobs' ? 'dashboard-tab-active' : ''}`}
          onClick={() => setActiveTab('jobs')}
        >
          <Briefcase size={16} /> Job Postings
          {allJobs.length > 0 && <span className="tab-badge">{allJobs.length}</span>}
        </button>
        <button
          className={`dashboard-tab ${activeTab === 'settings' ? 'dashboard-tab-active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={16} /> Settings
        </button>
      </div>

      {/* Employers Management */}
      {activeTab === 'employers' && (
        <div className="admin-section">
          {employers.length === 0 ? (
            <div className="empty-state">
              <h3>No employer accounts yet</h3>
            </div>
          ) : (
            <div className="admin-employers-list">
              {employers.map((emp) => {
                const color = AVATAR_COLORS[emp.company_name.charCodeAt(0) % AVATAR_COLORS.length];
                return (
                  <div key={emp.id} className={`admin-employer-item ${!emp.is_approved ? 'admin-employer-pending' : ''}`}>
                    <div className="admin-employer-info">
                      <div className="ej-app-avatar" style={{ backgroundColor: color }}>
                        {emp.company_name.charAt(0)}
                      </div>
                      <div>
                        <strong>{emp.company_name}</strong>
                        <span className="ej-app-email">
                          Joined {new Date(emp.created_at).toLocaleDateString()}
                          {emp.is_admin && ' · Admin'}
                        </span>
                      </div>
                    </div>
                    <div className="admin-employer-actions">
                      {!emp.is_admin && (
                        <button
                          className={`btn btn-sm ${emp.is_approved ? 'btn-outline' : 'btn-primary'}`}
                          onClick={() => toggleApproval(emp.id, emp.is_approved)}
                        >
                          {emp.is_approved ? (
                            <><ShieldX size={14} /> Revoke</>
                          ) : (
                            <><ShieldCheck size={14} /> Approve</>
                          )}
                        </button>
                      )}
                      {emp.user_id === user!.id ? (
                        <span className="status-badge" style={{ backgroundColor: 'rgba(56,182,83,0.1)', color: '#2d9a46' }}>
                          <Crown size={12} /> You
                        </span>
                      ) : (
                        <button
                          className={`btn btn-sm ${emp.is_admin ? 'btn-danger' : 'btn-outline'}`}
                          onClick={() => toggleAdmin(emp.id, emp.is_admin)}
                        >
                          <Crown size={14} /> {emp.is_admin ? 'Remove Admin' : 'Make Admin'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tags Management */}
      {activeTab === 'tags' && (
        <div className="admin-section">
          <div className="admin-add-row">
            <input
              className="input"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="New category name..."
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
            />
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              className="color-picker"
            />
            <button className="btn btn-primary" onClick={addTag} disabled={!newTagName.trim()}>
              <Plus size={16} /> Add
            </button>
          </div>

          <div className="admin-tags-list">
            {tags.map((tag) => (
              <div key={tag.id} className="admin-tag-item">
                <div className="admin-tag-info">
                  <span className="admin-tag-dot" style={{ backgroundColor: tag.color }} />
                  {editingTagId === tag.id ? (
                    <input
                      className="input admin-tag-edit-input"
                      value={editingTagName}
                      onChange={(e) => setEditingTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') updateTagName(tag.id);
                        if (e.key === 'Escape') { setEditingTagId(null); setEditingTagName(''); }
                      }}
                      autoFocus
                    />
                  ) : (
                    <span>{tag.name}</span>
                  )}
                </div>
                <div className="admin-tag-actions">
                  {editingTagId === tag.id ? (
                    <>
                      <button className="btn-icon" onClick={() => updateTagName(tag.id)} title="Save">
                        <Check size={16} />
                      </button>
                      <button className="btn-icon" onClick={() => { setEditingTagId(null); setEditingTagName(''); }} title="Cancel">
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn-icon" onClick={() => { setEditingTagId(tag.id); setEditingTagName(tag.name); }} title="Rename">
                        <Pencil size={16} />
                      </button>
                      <button className="btn-icon btn-icon-danger" onClick={() => deleteTag(tag.id)} title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {tags.length === 0 && (
              <p className="text-muted">No categories yet. Add one above.</p>
            )}
          </div>
        </div>
      )}

      {/* General Submissions */}
      {activeTab === 'submissions' && (
        <div className="admin-section">
          {submissionsLoading ? (
            <div className="loading">Loading submissions...</div>
          ) : submissions.length === 0 ? (
            <div className="empty-state">
              <h3>No submissions yet</h3>
              <p>Resume submissions from candidates will appear here.</p>
            </div>
          ) : (
            <div className="admin-submissions-grid">
              {submissions.map((sub) => {
                const initials = `${sub.first_name.charAt(0)}${sub.last_name.charAt(0)}`;
                const color = AVATAR_COLORS[(sub.first_name.charCodeAt(0) + sub.last_name.charCodeAt(0)) % AVATAR_COLORS.length];
                return (
                  <div key={sub.id} className="ej-app-card">
                    <div className="ej-app-header">
                      <div className="ej-app-avatar" style={{ backgroundColor: color }}>
                        {initials}
                      </div>
                      <div className="ej-app-info">
                        <strong>{sub.first_name} {sub.last_name}</strong>
                        <span className="ej-app-email">{sub.email}</span>
                      </div>
                      <span className="ej-app-date">{new Date(sub.created_at).toLocaleDateString()}</span>
                    </div>

                    {sub.phone && <p className="ej-app-detail"><strong>Phone:</strong> {sub.phone}</p>}
                    {sub.looking_for && <p className="ej-app-detail"><strong>Looking for:</strong> {sub.looking_for}</p>}
                    {sub.timeline && <p className="ej-app-detail"><strong>Timeline:</strong> {sub.timeline}</p>}
                    {sub.preferred_location && <p className="ej-app-detail"><strong>Preferred location:</strong> {sub.preferred_location}</p>}

                    <div className="ej-app-files">
                      {sub.resume_url && (
                        <button onClick={() => downloadFile(sub.resume_url!)} className="file-link" type="button">
                          <Download size={14} /> Resume
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedSubmission(selectedSubmission?.id === sub.id ? null : sub)}
                        className="btn btn-outline btn-sm"
                        type="button"
                      >
                        <Eye size={14} /> {selectedSubmission?.id === sub.id ? 'Hide' : 'Details'}
                      </button>
                    </div>

                    {selectedSubmission?.id === sub.id && (
                      <div className="submission-detail-expanded">
                        <div className="billing-detail-row"><span>Email</span><strong>{sub.email}</strong></div>
                        {sub.phone && <div className="billing-detail-row"><span>Phone</span><strong>{sub.phone}</strong></div>}
                        {sub.looking_for && <div className="billing-detail-row"><span>Looking For</span><strong>{sub.looking_for}</strong></div>}
                        {sub.timeline && <div className="billing-detail-row"><span>Timeline</span><strong>{sub.timeline}</strong></div>}
                        {sub.preferred_location && <div className="billing-detail-row"><span>Location</span><strong>{sub.preferred_location}</strong></div>}
                        <div className="billing-detail-row"><span>Submitted</span><strong>{new Date(sub.created_at).toLocaleString()}</strong></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Job Postings Management */}
      {activeTab === 'jobs' && (
        <div className="admin-section">
          {allJobs.length === 0 ? (
            <div className="empty-state">
              <h3>No jobs posted yet</h3>
            </div>
          ) : (
            <div className="admin-featured-list">
              {allJobs.map((job) => (
                <div key={job.id} className={`admin-featured-item ${job.is_featured ? 'admin-featured-active' : ''}`}>
                  {editingJobId === job.id ? (
                    <div style={{ width: '100%' }}>
                      <div className="form-group">
                        <label>Title</label>
                        <input className="input" value={editJobForm.title} onChange={(e) => setEditJobForm((f) => ({ ...f, title: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>Description</label>
                        <textarea className="input textarea" value={editJobForm.description} onChange={(e) => setEditJobForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
                      </div>
                      <div className="form-group">
                        <label>Requirements</label>
                        <textarea className="input textarea" value={editJobForm.requirements} onChange={(e) => setEditJobForm((f) => ({ ...f, requirements: e.target.value }))} rows={2} />
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Salary</label>
                          <input className="input" value={editJobForm.salary} onChange={(e) => setEditJobForm((f) => ({ ...f, salary: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label>Job Type</label>
                          <select className="input" value={editJobForm.job_type} onChange={(e) => setEditJobForm((f) => ({ ...f, job_type: e.target.value }))}>
                            {JOB_TYPE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Work Arrangement</label>
                          <select className="input" value={editJobForm.work_arrangement} onChange={(e) => setEditJobForm((f) => ({ ...f, work_arrangement: e.target.value }))}>
                            {ARRANGEMENT_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Address</label>
                          <input className="input" value={editJobForm.address} onChange={(e) => setEditJobForm((f) => ({ ...f, address: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label>City</label>
                          <input className="input" value={editJobForm.city} onChange={(e) => setEditJobForm((f) => ({ ...f, city: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label>State</label>
                          <input className="input" value={editJobForm.state} onChange={(e) => setEditJobForm((f) => ({ ...f, state: e.target.value }))} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button className="btn btn-sm btn-primary" onClick={() => saveJobEdit(job.id)}>
                          <Check size={14} /> Save
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={() => setEditingJobId(null)}>
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="admin-featured-info">
                        <h4>{job.title}</h4>
                        <span className="text-muted">
                          {job.company_name} &middot; {job.city}, {job.state} &middot; {job.work_arrangement} &middot; {job.job_type} &middot; Posted {new Date(job.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="admin-featured-actions">
                        <select
                          value={job.status}
                          onChange={(e) => updateJobStatus(job.id, e.target.value)}
                          className="filter-select"
                          style={job.status === 'active' ? { backgroundColor: 'rgba(56,182,83,0.1)', color: '#2d9a46' } : { backgroundColor: 'rgba(107,114,128,0.1)', color: '#6b7280' }}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="filled">Filled</option>
                        </select>
                        <button
                          className={`btn btn-sm ${job.is_featured ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => toggleFeatured(job.id, job.is_featured)}
                        >
                          <Star size={14} /> {job.is_featured ? 'Featured' : 'Feature'}
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => startEditingJob(job)}
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => deleteJob(job.id)}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings */}
      {activeTab === 'settings' && (
        <div className="admin-section">
          <h3 style={{ marginBottom: '1rem' }}>Notification Settings</h3>
          <div className="form-card">
            <div className="form-group">
              <label>Employer Approval Notification Email</label>
              <p className="form-hint">When a new employer signs up, a notification will be sent to this email address. Leave blank to disable.</p>
              <input
                className="input"
                type="email"
                placeholder="admin@example.com"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={saveNotificationEmail}>
                Save
              </button>
              {settingsSaved && <span style={{ color: '#2d9a46', fontWeight: 500 }}>Saved!</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
