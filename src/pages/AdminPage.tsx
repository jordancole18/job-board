import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, FileText, Star, Plus, Trash2, Download, Eye, Pencil, Check, X, Users, ShieldCheck, ShieldX, Crown, Briefcase, Settings, Search, Ban, Mail, ChevronRight, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { JOB_TYPE_OPTIONS, ARRANGEMENT_OPTIONS } from '../constants/jobStyles';
import { US_STATES } from '../constants/usStates';

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
  employer_id: string;
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

// Applications across every job. Admins gained SELECT on `applications` and
// `job_views` in 20260824000000 so Paramount can see which associations are
// actually pulling in candidates.
interface AdminApplication {
  id: string;
  job_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  rating: string;
  resume_url: string | null;
  cover_letter_url: string | null;
  created_at: string;
}

interface Employer {
  id: string;
  user_id: string;
  company_name: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  is_admin: boolean;
  is_approved: boolean;
  is_disabled: boolean;
  created_at: string;
}

interface AuthUser {
  id: string;
  email: string | null;
  email_confirmed_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
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

  // Engagement state — applications and view counts across all jobs, used for
  // the per-association resume counts in the Users tab and the per-posting
  // counts in the Job Postings tab.
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [expandedEmployerId, setExpandedEmployerId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // Employers state
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [employerSearch, setEmployerSearch] = useState('');
  // Auth users (from Supabase Auth) — used to show email-verification status
  // and surface signups that haven't verified yet (no employer row exists).
  const [authUsers, setAuthUsers] = useState<AuthUser[]>([]);

  // Job editing state
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editJobForm, setEditJobForm] = useState({
    title: '', description: '', requirements: '', salary: '',
    job_type: '', work_arrangement: '', address: '', city: '', state: '',
  });
  const [editJobTags, setEditJobTags] = useState<string[]>([]);

  // Employer editing state
  const [editingEmployerId, setEditingEmployerId] = useState<string | null>(null);
  const [editEmployerForm, setEditEmployerForm] = useState({
    first_name: '', last_name: '', title: '', company_name: '',
    email: '', address: '', city: '', state: '', zip: '',
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
    loadEngagement();
    loadEmployers();
    loadAuthUsers();
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

  // One pass over applications + job_views, tallied client-side. At the board's
  // current scale (tens of employers) this is a couple of small payloads; if it
  // grows, swap to a SECURITY DEFINER count function.
  async function loadEngagement() {
    const { data: appData } = await supabase
      .from('applications')
      .select('id, job_id, first_name, last_name, email, phone, status, rating, resume_url, cover_letter_url, created_at')
      .order('created_at', { ascending: false });
    if (appData) setApplications(appData);

    const { data: viewData } = await supabase.from('job_views').select('job_id');
    if (viewData) {
      const counts: Record<string, number> = {};
      viewData.forEach((v) => { counts[v.job_id] = (counts[v.job_id] || 0) + 1; });
      setViewCounts(counts);
    }
  }

  async function loadEmployers() {
    const { data } = await supabase
      .from('employers')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setEmployers(data);
  }

  async function loadAuthUsers() {
    const { data, error } = await supabase.functions.invoke('list-users');
    if (error || (data && (data as { error?: string }).error)) return;
    const users = (data as { users?: AuthUser[] }).users;
    if (users) setAuthUsers(users);
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

  async function toggleDisabled(employerId: string, currentlyDisabled: boolean) {
    const action = currentlyDisabled ? 'enable' : 'disable';
    if (!confirm(`Are you sure you want to ${action} this user? ${!currentlyDisabled ? 'They will be signed out and unable to log in.' : ''}`)) return;
    await supabase.from('employers').update({ is_disabled: !currentlyDisabled }).eq('id', employerId);
    setEmployers((prev) => prev.map((e) => e.id === employerId ? { ...e, is_disabled: !currentlyDisabled } : e));
  }

  // supabase.functions.invoke returns a generic "non-2xx status code" message
  // on 4xx/5xx and hides the function's JSON body (it's on error.context, the
  // Response). Pull out the real { error } message so admins see the reason.
  async function invokeError(
    error: { message?: string; context?: unknown } | null,
    data: unknown
  ): Promise<string | null> {
    const inline = (data as { error?: string } | null)?.error;
    if (inline) return inline;
    if (!error) return null;
    const ctx = error.context as { json?: () => Promise<unknown> } | undefined;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = (await ctx.json()) as { error?: string };
        if (body?.error) return body.error;
      } catch {
        /* body wasn't JSON — fall through */
      }
    }
    return error.message || 'Unknown error';
  }

  async function deleteEmployer(employerId: string) {
    if (!confirm('Permanently delete this user and all their job postings, applications, and data? This cannot be undone.')) return;
    const emp = employers.find((e) => e.id === employerId);
    if (!emp) return;
    // Deletion runs in an edge function: removing the Supabase Auth user
    // requires the service role, which the browser can't hold. The function
    // also cleans up the employer's jobs/applications/data.
    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: { userId: emp.user_id },
    });
    const errMsg = await invokeError(error, data);
    if (errMsg) {
      alert('Failed to delete account: ' + errMsg);
      return;
    }
    const removedJobIds = new Set(allJobs.filter((j) => j.employer_id === emp.user_id).map((j) => j.id));
    setEmployers((prev) => prev.filter((e) => e.id !== employerId));
    setAuthUsers((prev) => prev.filter((u) => u.id !== emp.user_id));
    setAllJobs((prev) => prev.filter((j) => !removedJobIds.has(j.id)));
    setApplications((prev) => prev.filter((a) => !removedJobIds.has(a.job_id)));
    if (expandedEmployerId === emp.user_id) setExpandedEmployerId(null);
  }

  // Delete an auth user that has no employer profile yet (e.g. never verified).
  async function deleteAuthUser(userId: string) {
    if (!confirm('Permanently delete this unverified account? This cannot be undone.')) return;
    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: { userId },
    });
    const errMsg = await invokeError(error, data);
    if (errMsg) {
      alert('Failed to delete account: ' + errMsg);
      return;
    }
    setAuthUsers((prev) => prev.filter((u) => u.id !== userId));
  }

  // Resend the signup confirmation email. If altEmail is given, the account's
  // login email is changed to it first (fixes typos), then the link is sent there.
  async function resendVerification(userId: string, altEmail?: string) {
    const { data, error } = await supabase.functions.invoke('resend-verification', {
      body: { userId, altEmail: altEmail ?? null },
    });
    const errMsg = await invokeError(error, data);
    if (errMsg) {
      alert('Failed to resend verification: ' + errMsg);
      return;
    }
    const sentTo = (data as { email?: string }).email;
    if (altEmail && sentTo) {
      setAuthUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, email: sentTo } : u)));
    }
    alert('Verification email sent to ' + sentTo);
  }

  function resendVerificationToAlt(userId: string, currentEmail: string | null) {
    const alt = window.prompt(
      'Send the verification link to a different email? This changes the account\'s login email to the address you enter.',
      currentEmail || ''
    );
    if (alt === null) return;
    const trimmed = alt.trim();
    if (!trimmed) return;
    resendVerification(userId, trimmed);
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
    setApplications((prev) => prev.filter((a) => a.job_id !== jobId));
    setViewCounts((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
    if (expandedJobId === jobId) setExpandedJobId(null);
  }


  async function updateJobStatus(jobId: string, status: string) {
    await supabase.from('jobs').update({ status }).eq('id', jobId);
    setAllJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status } : j));
  }

  async function startEditingJob(job: AdminJob) {
    setEditJobForm({
      title: job.title, description: job.description, requirements: job.requirements,
      salary: job.salary, job_type: job.job_type, work_arrangement: job.work_arrangement,
      address: job.address || '', city: job.city, state: job.state,
    });
    // Load current tags for this job
    const { data: jobTags } = await supabase
      .from('job_tags')
      .select('tag_id')
      .eq('job_id', job.id);
    setEditJobTags(jobTags?.map((jt) => jt.tag_id) || []);
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
    // Update tags: delete all, re-insert selected
    await supabase.from('job_tags').delete().eq('job_id', jobId);
    if (editJobTags.length > 0) {
      await supabase.from('job_tags').insert(
        editJobTags.map((tagId) => ({ job_id: jobId, tag_id: tagId }))
      );
    }
    setAllJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, ...editJobForm } : j));
    setEditingJobId(null);
  }

  async function deleteSubmission(sub: Submission) {
    if (!confirm(`Delete submission from ${sub.first_name} ${sub.last_name}? This cannot be undone.`)) return;
    if (sub.resume_url) {
      const { error: storageError } = await supabase.storage.from('applications').remove([sub.resume_url]);
      if (storageError) console.warn('Storage cleanup failed:', storageError.message);
    }
    const { error } = await supabase.from('general_submissions').delete().eq('id', sub.id);
    if (error) {
      alert('Failed to delete: ' + error.message);
      return;
    }
    setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
    if (selectedSubmission?.id === sub.id) setSelectedSubmission(null);
  }

  function startEditingEmployer(emp: Employer) {
    setEditEmployerForm({
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      title: emp.title || '',
      company_name: emp.company_name,
      email: emp.email || '',
      address: emp.address || '',
      city: emp.city || '',
      state: emp.state || '',
      zip: emp.zip || '',
    });
    setEditingEmployerId(emp.id);
  }

  async function saveEmployerEdit(employerId: string) {
    const { error } = await supabase.from('employers').update({
      first_name: editEmployerForm.first_name || null,
      last_name: editEmployerForm.last_name || null,
      title: editEmployerForm.title || null,
      company_name: editEmployerForm.company_name,
      email: editEmployerForm.email || null,
      address: editEmployerForm.address || null,
      city: editEmployerForm.city || null,
      state: editEmployerForm.state || null,
      zip: editEmployerForm.zip || null,
    }).eq('id', employerId);
    if (error) {
      alert('Failed to save: ' + error.message);
      return;
    }
    setEmployers((prev) => prev.map((e) => e.id === employerId ? { ...e, ...editEmployerForm } : e));
    setEditingEmployerId(null);
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

  // One unified user list. Supabase Auth is the source of truth for who
  // exists and their email-verification status; the employer row (when it
  // exists) adds profile/approval/admin data. Merge both keyed by user id so
  // a single list renders even if one source is briefly unavailable.
  const authByUserId = new Map(authUsers.map((u) => [u.id, u]));
  const rowByUserId = new Map<string, { userId: string; emp: Employer | null; au: AuthUser | null }>();
  employers.forEach((emp) => rowByUserId.set(emp.user_id, { userId: emp.user_id, emp, au: authByUserId.get(emp.user_id) ?? null }));
  authUsers.forEach((au) => { if (!rowByUserId.has(au.id)) rowByUserId.set(au.id, { userId: au.id, emp: null, au }); });

  const userRows = [...rowByUserId.values()]
    .filter(({ emp, au }) => {
      if (!employerSearch) return true;
      const q = employerSearch.toLowerCase();
      return (emp?.company_name.toLowerCase().includes(q) ?? false) ||
        (au?.email || emp?.email || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      // Unverified accounts first (they need attention), then newest first.
      const av = a.au && !a.au.email_confirmed_at ? 0 : 1;
      const bv = b.au && !b.au.email_confirmed_at ? 0 : 1;
      if (av !== bv) return av - bv;
      const ad = a.emp?.created_at || a.au?.created_at || '';
      const bd = b.emp?.created_at || b.au?.created_at || '';
      return ad < bd ? 1 : -1;
    });

  const unverifiedCount = userRows.filter((r) => r.au && !r.au.email_confirmed_at).length;

  // Engagement rollups. jobs.employer_id is the auth user id, which is the same
  // key userRows is built on, so postings join straight onto a user row.
  const appsByJobId = new Map<string, AdminApplication[]>();
  applications.forEach((a) => {
    const list = appsByJobId.get(a.job_id);
    if (list) list.push(a); else appsByJobId.set(a.job_id, [a]);
  });

  const jobsByUserId = new Map<string, AdminJob[]>();
  allJobs.forEach((j) => {
    const list = jobsByUserId.get(j.employer_id);
    if (list) list.push(j); else jobsByUserId.set(j.employer_id, [j]);
  });

  function engagementFor(userId: string) {
    const userJobs = jobsByUserId.get(userId) || [];
    let resumes = 0;
    let views = 0;
    userJobs.forEach((j) => {
      resumes += appsByJobId.get(j.id)?.length || 0;
      views += viewCounts[j.id] || 0;
    });
    return { jobs: userJobs, postings: userJobs.length, resumes, views };
  }

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
          <Users size={16} /> Users
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
          <div className="explore-keyword-row" style={{ marginBottom: '1rem' }}>
            <div className="explore-search" style={{ flex: 1 }}>
              <Search size={16} className="explore-search-icon" />
              <input
                type="text"
                placeholder="Search by company name or email..."
                value={employerSearch}
                onChange={(e) => setEmployerSearch(e.target.value)}
                className="explore-search-input"
              />
            </div>
          </div>
          {unverifiedCount > 0 && (
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#b45309' }}>
              <Mail size={13} style={{ verticalAlign: 'text-bottom' }} /> {unverifiedCount} {unverifiedCount === 1 ? 'account is' : 'accounts are'} awaiting email verification
            </p>
          )}
          {userRows.length === 0 ? (
            <div className="empty-state">
              <h3>No accounts yet</h3>
            </div>
          ) : (
            <div className="admin-employers-list">
              {userRows.map(({ userId, emp, au }) => {
                const verified = au ? !!au.email_confirmed_at : null;

                // Auth-only account — signed up but no employer profile yet.
                if (!emp) {
                  const email = au?.email || null;
                  return (
                    <div key={userId} className="admin-employer-item admin-employer-pending">
                      <div className="admin-employer-info">
                        <div className="ej-app-avatar" style={{ backgroundColor: verified ? '#2d9a46' : '#b45309' }}>
                          {(email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong>{email || 'Unknown email'}</strong>
                          {verified === false && (
                            <span className="status-badge" style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#b45309', marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                              <Mail size={10} /> Awaiting verification
                            </span>
                          )}
                          {verified === true && (
                            <span className="status-badge" style={{ backgroundColor: 'rgba(56,182,83,0.1)', color: '#2d9a46', marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                              <Check size={10} /> Verified
                            </span>
                          )}
                          <span className="ej-app-email">
                            {au?.created_at && <>Signed up {new Date(au.created_at).toLocaleDateString()} · </>}
                            No profile yet
                          </span>
                        </div>
                      </div>
                      <div className="admin-employer-actions">
                        {verified === false && (
                          <>
                            <button className="btn btn-sm btn-outline" onClick={() => resendVerification(userId)}>
                              <Mail size={14} /> Resend
                            </button>
                            <button className="btn btn-sm btn-outline" onClick={() => resendVerificationToAlt(userId, email)}>
                              <Pencil size={14} /> Resend to…
                            </button>
                          </>
                        )}
                        <button className="btn btn-sm btn-danger" onClick={() => deleteAuthUser(userId)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                }

                const color = AVATAR_COLORS[emp.company_name.charCodeAt(0) % AVATAR_COLORS.length];
                const emailVerified = verified;
                const eng = engagementFor(emp.user_id);
                return (
                  <div key={userId} className={`admin-employer-item ${!emp.is_approved ? 'admin-employer-pending' : ''}`} style={emp.is_disabled ? { opacity: 0.5 } : {}}>
                    {editingEmployerId === emp.id ? (
                      <div style={{ width: '100%' }}>
                        <div className="form-row">
                          <div className="form-group">
                            <label>First Name</label>
                            <input className="input" value={editEmployerForm.first_name} onChange={(e) => setEditEmployerForm((f) => ({ ...f, first_name: e.target.value }))} />
                          </div>
                          <div className="form-group">
                            <label>Last Name</label>
                            <input className="input" value={editEmployerForm.last_name} onChange={(e) => setEditEmployerForm((f) => ({ ...f, last_name: e.target.value }))} />
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Title</label>
                            <input className="input" value={editEmployerForm.title} onChange={(e) => setEditEmployerForm((f) => ({ ...f, title: e.target.value }))} />
                          </div>
                          <div className="form-group">
                            <label>Association Name</label>
                            <input className="input" value={editEmployerForm.company_name} onChange={(e) => setEditEmployerForm((f) => ({ ...f, company_name: e.target.value }))} />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Email</label>
                          <input className="input" type="email" value={editEmployerForm.email} onChange={(e) => setEditEmployerForm((f) => ({ ...f, email: e.target.value }))} />
                        </div>
                        <div className="form-group">
                          <label>Address</label>
                          <input className="input" value={editEmployerForm.address} onChange={(e) => setEditEmployerForm((f) => ({ ...f, address: e.target.value }))} />
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>City</label>
                            <input className="input" value={editEmployerForm.city} onChange={(e) => setEditEmployerForm((f) => ({ ...f, city: e.target.value }))} />
                          </div>
                          <div className="form-group">
                            <label>State</label>
                            <select className="input" value={editEmployerForm.state} onChange={(e) => setEditEmployerForm((f) => ({ ...f, state: e.target.value }))}>
                              <option value="">Select state...</option>
                              {US_STATES.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Zip</label>
                            <input className="input" value={editEmployerForm.zip} onChange={(e) => setEditEmployerForm((f) => ({ ...f, zip: e.target.value }))} maxLength={10} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <button className="btn btn-sm btn-primary" onClick={() => saveEmployerEdit(emp.id)}>
                            <Check size={14} /> Save
                          </button>
                          <button className="btn btn-sm btn-outline" onClick={() => setEditingEmployerId(null)}>
                            <X size={14} /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="admin-employer-info">
                          <div className="ej-app-avatar" style={{ backgroundColor: emp.is_disabled ? '#6b7280' : color }}>
                            {emp.company_name.charAt(0)}
                          </div>
                          <div>
                            <strong>{emp.company_name}</strong>
                            {emp.first_name && emp.last_name && (
                              <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                ({emp.first_name} {emp.last_name}{emp.title ? `, ${emp.title}` : ''})
                              </span>
                            )}
                            {emp.is_disabled && (
                              <span className="status-badge" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#dc2626', marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                                <Ban size={10} /> Disabled
                              </span>
                            )}
                            {emailVerified === false && (
                              <span className="status-badge" style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#b45309', marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                                <Mail size={10} /> Awaiting verification
                              </span>
                            )}
                            {emailVerified === true && (
                              <span className="status-badge" style={{ backgroundColor: 'rgba(56,182,83,0.1)', color: '#2d9a46', marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                                <Check size={10} /> Verified
                              </span>
                            )}
                            <span className="ej-app-email">
                              {emp.email && <>{emp.email} · </>}
                              Joined {new Date(emp.created_at).toLocaleDateString()}
                              {emp.is_admin && ' · Admin'}
                            </span>
                            <span className="admin-engagement-row">
                              <button
                                type="button"
                                className="admin-engagement-toggle"
                                onClick={() => {
                                  setExpandedEmployerId(expandedEmployerId === userId ? null : userId);
                                  setExpandedJobId(null);
                                }}
                                disabled={eng.postings === 0}
                                title={eng.postings === 0 ? 'No postings yet' : 'Show postings and resumes'}
                              >
                                {expandedEmployerId === userId ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                <Briefcase size={12} /> {eng.postings} {eng.postings === 1 ? 'posting' : 'postings'}
                              </button>
                              <span className={`admin-engagement-stat ${eng.resumes > 0 ? 'admin-engagement-stat-live' : ''}`}>
                                <FileText size={12} /> {eng.resumes} {eng.resumes === 1 ? 'resume' : 'resumes'}
                              </span>
                              <span className="admin-engagement-stat">
                                <Eye size={12} /> {eng.views} {eng.views === 1 ? 'view' : 'views'}
                              </span>
                            </span>
                          </div>
                        </div>
                        {emp.user_id === user!.id ? (
                          <div className="admin-employer-actions">
                            <span className="status-badge" style={{ backgroundColor: 'rgba(56,182,83,0.1)', color: '#2d9a46' }}>
                              <Crown size={12} /> You
                            </span>
                          </div>
                        ) : (
                          <div className="admin-employer-actions">
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => startEditingEmployer(emp)}
                            >
                              <Pencil size={14} /> Edit
                            </button>
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
                            <button
                              className={`btn btn-sm ${emp.is_disabled ? 'btn-primary' : 'btn-outline'}`}
                              onClick={() => toggleDisabled(emp.id, emp.is_disabled)}
                            >
                              {emp.is_disabled ? (
                                <><ShieldCheck size={14} /> Enable</>
                              ) : (
                                <><Ban size={14} /> Disable</>
                              )}
                            </button>
                            <button
                              className={`btn btn-sm ${emp.is_admin ? 'btn-danger' : 'btn-outline'}`}
                              onClick={() => toggleAdmin(emp.id, emp.is_admin)}
                            >
                              <Crown size={14} /> {emp.is_admin ? 'Remove Admin' : 'Make Admin'}
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => deleteEmployer(emp.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                        {expandedEmployerId === userId && (
                          <div className="admin-engagement-panel">
                            {eng.jobs.map((job) => {
                              const jobApps = appsByJobId.get(job.id) || [];
                              const jobViews = viewCounts[job.id] || 0;
                              const jobOpen = expandedJobId === job.id;
                              return (
                                <div key={job.id} className="admin-engagement-job">
                                  <button
                                    type="button"
                                    className="admin-engagement-job-head"
                                    onClick={() => setExpandedJobId(jobOpen ? null : job.id)}
                                  >
                                    {jobOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <span className="admin-engagement-job-title">{job.title}</span>
                                    <span className="text-muted">
                                      {job.city}, {job.state} · {job.status} · posted {new Date(job.created_at).toLocaleDateString()}
                                    </span>
                                    <span className={`admin-engagement-stat ${jobApps.length > 0 ? 'admin-engagement-stat-live' : ''}`}>
                                      <FileText size={12} /> {jobApps.length}
                                    </span>
                                    <span className="admin-engagement-stat">
                                      <Eye size={12} /> {jobViews}
                                    </span>
                                  </button>
                                  {jobOpen && (
                                    jobApps.length === 0 ? (
                                      <p className="admin-engagement-empty">No resumes submitted to this posting yet.</p>
                                    ) : (
                                      <div className="admin-engagement-apps">
                                        {jobApps.map((a) => (
                                          <div key={a.id} className="admin-engagement-app">
                                            <div>
                                              <strong>{a.first_name} {a.last_name}</strong>
                                              <span className="ej-app-email">
                                                {a.email}
                                                {a.phone && <> · {a.phone}</>}
                                                {' · '}{new Date(a.created_at).toLocaleDateString()}
                                              </span>
                                            </div>
                                            <div className="admin-engagement-app-files">
                                              {a.resume_url && (
                                                <button type="button" className="file-link" onClick={() => downloadFile(a.resume_url!)}>
                                                  <Download size={13} /> Resume
                                                </button>
                                              )}
                                              {a.cover_letter_url && (
                                                <button type="button" className="file-link" onClick={() => downloadFile(a.cover_letter_url!)}>
                                                  <Download size={13} /> Cover Letter
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
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
                      <button onClick={() => deleteSubmission(sub)} className="btn btn-danger btn-sm" type="button">
                        <Trash2 size={14} /> Delete
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
                          <select className="input" value={editJobForm.state} onChange={(e) => setEditJobForm((f) => ({ ...f, state: e.target.value }))}>
                            <option value="">Select state...</option>
                            {US_STATES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {tags.length > 0 && (
                        <div className="form-group">
                          <label>Categories</label>
                          <div className="tag-picker">
                            {tags.map((tag) => (
                              <button
                                key={tag.id}
                                type="button"
                                className={`tag-pill ${editJobTags.includes(tag.id) ? 'tag-pill-active' : ''}`}
                                style={editJobTags.includes(tag.id) ? { backgroundColor: tag.color, borderColor: tag.color, color: 'white' } : { borderColor: tag.color, color: tag.color }}
                                onClick={() => setEditJobTags((prev) => prev.includes(tag.id) ? prev.filter((t) => t !== tag.id) : [...prev, tag.id])}
                              >
                                {tag.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
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
                        <span className="admin-engagement-row">
                          <span className={`admin-engagement-stat ${(appsByJobId.get(job.id)?.length || 0) > 0 ? 'admin-engagement-stat-live' : ''}`}>
                            <FileText size={12} /> {appsByJobId.get(job.id)?.length || 0} {(appsByJobId.get(job.id)?.length || 0) === 1 ? 'resume' : 'resumes'}
                          </span>
                          <span className="admin-engagement-stat">
                            <Eye size={12} /> {viewCounts[job.id] || 0} {(viewCounts[job.id] || 0) === 1 ? 'view' : 'views'}
                          </span>
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
