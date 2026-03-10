import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, Users, Clock, Download, Trash2, MapPin, ChevronLeft, ChevronRight, Star, Mail, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';

interface Job {
  id: string;
  title: string;
  company_name: string;
  city: string;
  state: string;
  salary: string;
  job_type: string;
  status: string;
  description: string;
  requirements: string;
  created_at: string;
}

interface Application {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  resume_text: string | null;
  resume_url: string | null;
  cover_letter: string | null;
  cover_letter_url: string | null;
  status: string;
  rating: string;
  created_at: string;
}

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

const STATUS_OPTIONS = [
  { value: 'unread', label: 'Unread', color: '#6b7280' },
  { value: 'read', label: 'Read', color: '#3b82f6' },
  { value: 'contacted', label: 'Contacted', color: '#22c55e' },
];

const RATING_OPTIONS = [
  { value: 'none', label: 'No Rating' },
  { value: 'high_potential', label: 'High Potential' },
  { value: 'low_potential', label: 'Low Potential' },
];

export default function EmployerJobPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [viewCount, setViewCount] = useState(0);
  const [viewsThisWeek, setViewsThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeAppIndex, setActiveAppIndex] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    loadData();
  }, [user, authLoading, id]);

  async function loadData() {
    const [jobRes, appsRes, viewsRes] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', id).eq('employer_id', user!.id).single(),
      supabase.from('applications').select('*').eq('job_id', id).order('created_at', { ascending: false }),
      supabase.from('job_views').select('viewed_at').eq('job_id', id),
    ]);

    if (!jobRes.data) {
      navigate('/dashboard');
      return;
    }

    setJob(jobRes.data);
    setApplications(appsRes.data || []);

    const views = viewsRes.data || [];
    setViewCount(views.length);
    const weekAgo = Date.now() - 7 * 86400000;
    setViewsThisWeek(views.filter((v) => new Date(v.viewed_at).getTime() > weekAgo).length);

    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm('Delete this job posting? All applications will also be removed.')) return;
    await supabase.from('job_tags').delete().eq('job_id', id);
    await supabase.from('applications').delete().eq('job_id', id);
    await supabase.from('job_views').delete().eq('job_id', id);
    await supabase.from('jobs').delete().eq('id', id);
    navigate('/dashboard');
  }

  async function updateJobStatus(status: string) {
    await supabase.from('jobs').update({ status }).eq('id', id);
    setJob((prev) => prev ? { ...prev, status } : prev);
  }

  async function updateAppStatus(appId: string, status: string) {
    await supabase.from('applications').update({ status }).eq('id', appId);
    setApplications((prev) => prev.map((a) => a.id === appId ? { ...a, status } : a));
  }

  async function updateAppRating(appId: string, rating: string) {
    await supabase.from('applications').update({ rating }).eq('id', appId);
    setApplications((prev) => prev.map((a) => a.id === appId ? { ...a, rating } : a));
  }

  async function markAsRead(appId: string) {
    const app = applications.find((a) => a.id === appId);
    if (app && app.status === 'unread') {
      await updateAppStatus(appId, 'read');
    }
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

  function openAppDetail(index: number) {
    setActiveAppIndex(index);
    markAsRead(filteredApps[index].id);
  }

  const filteredApps = applications.filter((app) => {
    if (statusFilter && app.status !== statusFilter) return false;
    if (ratingFilter && app.rating !== ratingFilter) return false;
    return true;
  });

  if (!user) return null;
  if (loading) return <div className="page"><div className="loading">Loading...</div></div>;
  if (!job) return <div className="page"><div className="empty-state"><h3>Job not found</h3></div></div>;

  const daysAgo = Math.floor((Date.now() - new Date(job.created_at).getTime()) / 86400000);
  const timeLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;
  const conversionRate = viewCount > 0 ? ((applications.length / viewCount) * 100).toFixed(1) : '0';
  const unreadCount = applications.filter((a) => a.status === 'unread').length;

  const activeApp = activeAppIndex !== null ? filteredApps[activeAppIndex] : null;

  return (
    <div className="page">
      <Link to="/dashboard" className="back-link">
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      <div className="ej-header">
        <div className="ej-header-left">
          <h1>{job.title}</h1>
          <div className="ej-header-meta">
            <span><MapPin size={14} /> {job.city}, {job.state}</span>
            <span>{job.job_type}</span>
            <span>{job.salary}</span>
            <span>Posted {timeLabel}</span>
          </div>
        </div>
        <div className="ej-header-actions">
          <select
            value={job.status}
            onChange={(e) => updateJobStatus(e.target.value)}
            className="status-select"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="filled">Filled</option>
          </select>
          <button onClick={handleDelete} className="btn btn-danger">
            <Trash2 size={14} /> Delete Job
          </button>
        </div>
      </div>

      <div className="ej-stats">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(56,182,83,0.1)' }}>
            <Eye size={22} color="#38b653" />
          </div>
          <span className="stat-number">{viewCount}</span>
          <span className="stat-label">Total Views</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.1)' }}>
            <Users size={22} color="#10b981" />
          </div>
          <span className="stat-number">{applications.length}</span>
          <span className="stat-label">Applications</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(249,115,22,0.1)' }}>
            <Clock size={22} color="#f97316" />
          </div>
          <span className="stat-number">{viewsThisWeek}</span>
          <span className="stat-label">Views This Week</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(139,92,246,0.1)' }}>
            <Users size={22} color="#8b5cf6" />
          </div>
          <span className="stat-number">{conversionRate}%</span>
          <span className="stat-label">Apply Rate</span>
        </div>
      </div>

      <div className="ej-section">
        <div className="ej-section-header">
          <h2>Applications ({applications.length}){unreadCount > 0 && <span className="unread-badge">{unreadCount} new</span>}</h2>
          <div className="ej-filters">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
              <option value="">All Status</option>
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)} className="filter-select">
              <option value="">All Ratings</option>
              {RATING_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        {filteredApps.length === 0 ? (
          <div className="empty-state">
            <h3>{applications.length === 0 ? 'No applications yet' : 'No matching applications'}</h3>
            <p>{applications.length === 0 ? 'Share your job posting to start receiving applications.' : 'Try adjusting your filters.'}</p>
          </div>
        ) : (
          <div className="ej-app-grid">
            {filteredApps.map((app, index) => {
              const initials = `${app.first_name.charAt(0)}${app.last_name.charAt(0)}`;
              const color = AVATAR_COLORS[(app.first_name.charCodeAt(0) + app.last_name.charCodeAt(0)) % AVATAR_COLORS.length];
              const statusOpt = STATUS_OPTIONS.find((s) => s.value === app.status);
              return (
                <div key={app.id} className={`ej-app-card ${app.status === 'unread' ? 'ej-app-card-unread' : ''}`}>
                  <div className="ej-app-header">
                    <div className="ej-app-avatar" style={{ backgroundColor: color }}>
                      {initials}
                    </div>
                    <div className="ej-app-info">
                      <strong>{app.first_name} {app.last_name}</strong>
                      <span className="ej-app-email">{app.email}</span>
                    </div>
                    <div className="ej-app-header-right">
                      {app.rating === 'high_potential' && (
                        <span className="rating-badge rating-high"><Star size={12} /> High</span>
                      )}
                      {app.rating === 'low_potential' && (
                        <span className="rating-badge rating-low">Low</span>
                      )}
                      <span className="app-status-dot" style={{ backgroundColor: statusOpt?.color }} title={statusOpt?.label} />
                      <span className="ej-app-date">{new Date(app.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {app.phone && (
                    <p className="ej-app-detail"><strong>Phone:</strong> {app.phone}</p>
                  )}

                  <div className="ej-app-controls">
                    <select
                      value={app.status}
                      onChange={(e) => updateAppStatus(app.id, e.target.value)}
                      className="filter-select"
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <select
                      value={app.rating}
                      onChange={(e) => updateAppRating(app.id, e.target.value)}
                      className="filter-select"
                    >
                      {RATING_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>

                  <div className="ej-app-files">
                    {app.resume_url && (
                      <button onClick={() => downloadFile(app.resume_url!)} className="file-link" type="button">
                        <Download size={14} /> Resume
                      </button>
                    )}
                    {app.cover_letter_url && (
                      <button onClick={() => downloadFile(app.cover_letter_url!)} className="file-link" type="button">
                        <Download size={14} /> Cover Letter
                      </button>
                    )}
                    <button onClick={() => openAppDetail(index)} className="btn btn-outline btn-sm" type="button">
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick navigation detail modal */}
      {activeApp && activeAppIndex !== null && (
        <div className="app-detail-overlay" onClick={() => setActiveAppIndex(null)}>
          <div className="app-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="app-detail-nav">
              <button
                className="btn btn-outline btn-sm"
                disabled={activeAppIndex <= 0}
                onClick={() => {
                  const next = activeAppIndex - 1;
                  setActiveAppIndex(next);
                  markAsRead(filteredApps[next].id);
                }}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span className="app-detail-counter">{activeAppIndex + 1} of {filteredApps.length}</span>
              <button
                className="btn btn-outline btn-sm"
                disabled={activeAppIndex >= filteredApps.length - 1}
                onClick={() => {
                  const next = activeAppIndex + 1;
                  setActiveAppIndex(next);
                  markAsRead(filteredApps[next].id);
                }}
              >
                Next <ChevronRight size={16} />
              </button>
              <button className="app-detail-close" onClick={() => setActiveAppIndex(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="app-detail-content">
              <div className="app-detail-header">
                <div className="ej-app-avatar" style={{
                  backgroundColor: AVATAR_COLORS[(activeApp.first_name.charCodeAt(0) + activeApp.last_name.charCodeAt(0)) % AVATAR_COLORS.length]
                }}>
                  {activeApp.first_name.charAt(0)}{activeApp.last_name.charAt(0)}
                </div>
                <div>
                  <h2>{activeApp.first_name} {activeApp.last_name}</h2>
                  <p className="ej-app-email">{activeApp.email}</p>
                  {activeApp.phone && <p><Mail size={14} /> {activeApp.phone}</p>}
                </div>
              </div>

              <div className="app-detail-controls">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={activeApp.status}
                    onChange={(e) => updateAppStatus(activeApp.id, e.target.value)}
                    className="filter-select"
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Rating</label>
                  <select
                    value={activeApp.rating}
                    onChange={(e) => updateAppRating(activeApp.id, e.target.value)}
                    className="filter-select"
                  >
                    {RATING_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="app-detail-files">
                {activeApp.resume_url && (
                  <button onClick={() => downloadFile(activeApp.resume_url!)} className="btn btn-primary" type="button">
                    <Download size={16} /> Download Resume
                  </button>
                )}
                {activeApp.cover_letter_url && (
                  <button onClick={() => downloadFile(activeApp.cover_letter_url!)} className="btn btn-outline" type="button">
                    <Download size={16} /> Download Cover Letter
                  </button>
                )}
              </div>

              {activeApp.resume_text && !activeApp.resume_url && (
                <div className="app-detail-text">
                  <h3>Resume</h3>
                  <p>{activeApp.resume_text}</p>
                </div>
              )}
              {activeApp.cover_letter && !activeApp.cover_letter_url && (
                <div className="app-detail-text">
                  <h3>Cover Letter</h3>
                  <p>{activeApp.cover_letter}</p>
                </div>
              )}

              <p className="app-detail-date">Applied on {new Date(activeApp.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
