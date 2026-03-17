import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, FileText, Star, Plus, Trash2, Download, Eye, Pencil, Check, X, Users, ShieldCheck, ShieldX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';

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
  preferred_location: string | null;
  resume_url: string | null;
  created_at: string;
}

interface FeaturedJob {
  id: string;
  title: string;
  company_name: string;
  city: string;
  state: string;
  is_featured: boolean;
  status: string;
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
  const [activeTab, setActiveTab] = useState<'tags' | 'submissions' | 'featured' | 'employers'>('employers');

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
  const [allJobs, setAllJobs] = useState<FeaturedJob[]>([]);

  // Employers state
  const [employers, setEmployers] = useState<Employer[]>([]);

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
      .select('id, title, company_name, city, state, is_featured, status')
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
          className={`dashboard-tab ${activeTab === 'featured' ? 'dashboard-tab-active' : ''}`}
          onClick={() => setActiveTab('featured')}
        >
          <Star size={16} /> Featured Jobs
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
                      {emp.is_admin ? (
                        <span className="status-badge" style={{ backgroundColor: 'rgba(56,182,83,0.1)', color: '#2d9a46' }}>
                          Admin
                        </span>
                      ) : (
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

      {/* Featured Jobs Management */}
      {activeTab === 'featured' && (
        <div className="admin-section">
          {allJobs.length === 0 ? (
            <div className="empty-state">
              <h3>No jobs posted yet</h3>
            </div>
          ) : (
            <div className="admin-featured-list">
              {allJobs.map((job) => (
                <div key={job.id} className={`admin-featured-item ${job.is_featured ? 'admin-featured-active' : ''}`}>
                  <div className="admin-featured-info">
                    <h4>{job.title}</h4>
                    <span className="text-muted">{job.company_name} &middot; {job.city}, {job.state}</span>
                  </div>
                  <div className="admin-featured-actions">
                    <span className={`status-badge ${job.status === 'active' ? '' : 'status-badge-muted'}`}
                      style={job.status === 'active' ? { backgroundColor: 'rgba(56,182,83,0.1)', color: '#2d9a46' } : { backgroundColor: 'rgba(107,114,128,0.1)', color: '#6b7280' }}
                    >
                      {job.status}
                    </span>
                    <button
                      className={`btn btn-sm ${job.is_featured ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => toggleFeatured(job.id, job.is_featured)}
                    >
                      <Star size={14} /> {job.is_featured ? 'Featured' : 'Make Featured'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
