import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, Users, Eye, ChevronRight, CreditCard, Clock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';

interface Job {
  id: string;
  title: string;
  city: string;
  state: string;
  job_type: string;
  work_arrangement: string;
  status: string;
  expires_at: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'rgba(56,182,83,0.1)', text: '#2d9a46', label: 'Active' },
  inactive: { bg: 'rgba(107,114,128,0.1)', text: '#6b7280', label: 'Inactive' },
  filled: { bg: 'rgba(99,102,241,0.1)', text: '#6366f1', label: 'Filled' },
  expired: { bg: 'rgba(239,68,68,0.1)', text: '#dc2626', label: 'Expired' },
};

function expiryLabel(expiresAt: string): string {
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (days <= 0) return 'Expires today';
  if (days === 1) return 'Expires in 1 day';
  return `Expires in ${days} days`;
}

export default function DashboardPage() {
  const { user, companyName, isApproved, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [appCounts, setAppCounts] = useState<Record<string, number>>({});
  const [totalViews, setTotalViews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'jobs' | 'billing'>('jobs');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    loadData();
  }, [user, authLoading]);

  async function loadData() {
    const { data: jobData } = await supabase
      .from('jobs')
      .select('id, title, city, state, job_type, work_arrangement, status, expires_at, created_at')
      .eq('employer_id', user!.id)
      .order('created_at', { ascending: false });

    if (jobData) {
      setJobs(jobData);
      const jobIds = jobData.map((j) => j.id);

      if (jobIds.length > 0) {
        const { data: appData } = await supabase
          .from('applications')
          .select('job_id')
          .in('job_id', jobIds);

        if (appData) {
          const counts: Record<string, number> = {};
          appData.forEach((a) => {
            counts[a.job_id] = (counts[a.job_id] || 0) + 1;
          });
          setAppCounts(counts);
        }

        const { data: viewData } = await supabase
          .from('job_views')
          .select('id')
          .in('job_id', jobIds);

        setTotalViews(viewData?.length || 0);
      }
    }
    setLoading(false);
  }

  async function updateJobStatus(job: Job, status: string) {
    // Reactivating a job whose expiry has already passed must reset the clock,
    // or the daily cron would re-expire it within 24h. Route that through renew.
    if (status === 'active' && new Date(job.expires_at).getTime() <= Date.now()) {
      return renewJob(job.id);
    }
    await supabase.from('jobs').update({ status }).eq('id', job.id);
    setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status } : j));
  }

  async function renewJob(jobId: string) {
    const { data, error } = await supabase.rpc('renew_job', { p_job_id: jobId });
    if (error || !data) {
      console.error('Renew failed:', error?.message);
      return;
    }
    setJobs((prev) => prev.map((j) =>
      j.id === jobId ? { ...j, status: data.status, expires_at: data.expires_at } : j
    ));
  }

  if (!user) return null;

  const activeJobs = jobs.filter((j) => j.status === 'active');
  const totalApps = Object.values(appCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="page">
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          {companyName && <div className="dashboard-avatar">{companyName.charAt(0)}</div>}
          <div>
            <h2>Dashboard</h2>
            {companyName && <p className="dashboard-company">{companyName}</p>}
          </div>
        </div>
        {isApproved ? (
          <Link to="/post-job" className="btn btn-primary">+ Post New Job</Link>
        ) : (
          <span className="btn btn-outline btn-disabled" title="Pending admin approval">
            <Clock size={14} /> Pending Approval
          </span>
        )}
      </div>

      <a href="mailto:support@associationcareers.realestate" className="dashboard-support-link">
        <Mail size={14} /> Need help? Contact Support
      </a>

      {!isApproved && (
        <div className="pending-approval-banner">
          <Clock size={18} />
          <p>Your account is pending admin approval. Once approved, you'll be able to post jobs.</p>
        </div>
      )}

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(56,182,83,0.1)' }}>
            <Briefcase size={22} color="#38b653" />
          </div>
          <span className="stat-number">{activeJobs.length}</span>
          <span className="stat-label">Active Jobs</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.1)' }}>
            <Users size={22} color="#10b981" />
          </div>
          <span className="stat-number">{totalApps}</span>
          <span className="stat-label">Total Applications</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(249,115,22,0.1)' }}>
            <Eye size={22} color="#f97316" />
          </div>
          <span className="stat-number">{totalViews}</span>
          <span className="stat-label">Total Views</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button
          className={`dashboard-tab ${activeTab === 'jobs' ? 'dashboard-tab-active' : ''}`}
          onClick={() => setActiveTab('jobs')}
        >
          <Briefcase size={16} /> My Jobs
        </button>
        <button
          className={`dashboard-tab ${activeTab === 'billing' ? 'dashboard-tab-active' : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          <CreditCard size={16} /> Billing
        </button>
      </div>

      {activeTab === 'jobs' && (
        <>
          {loading ? (
            <div className="loading">Loading your jobs...</div>
          ) : jobs.length === 0 ? (
            <div className="empty-state">
              <h3>No job postings yet</h3>
              <p>{isApproved ? 'Create your first job posting to start receiving applications.' : 'Your account is pending approval. You\'ll be able to post once approved.'}</p>
              {isApproved && <Link to="/post-job" className="btn btn-primary">Post a Job</Link>}
            </div>
          ) : (
            <div className="dashboard-jobs">
              {jobs.map((job) => {
                const apps = appCounts[job.id] || 0;
                const daysAgo = Math.floor((Date.now() - new Date(job.created_at).getTime()) / 86400000);
                const timeLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1d ago' : `${daysAgo}d ago`;
                const statusStyle = STATUS_STYLES[job.status] || STATUS_STYLES.active;
                return (
                  <div key={job.id} className={`dash-job-row ${job.status !== 'active' ? 'dash-job-inactive' : ''}`}>
                    <Link to={`/employer/jobs/${job.id}`} className="dash-job-link">
                      <div className="dash-job-left">
                        <h3>{job.title}</h3>
                        <span className="dashboard-job-meta">
                          {job.city}, {job.state} &middot; {job.work_arrangement} &middot; {job.job_type} &middot; {timeLabel}
                          {job.status === 'active' && <> &middot; {expiryLabel(job.expires_at)}</>}
                        </span>
                      </div>
                      <div className="dash-job-right">
                        <span
                          className="status-badge"
                          style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
                        >
                          {statusStyle.label}
                        </span>
                        <span className="app-count">
                          <Users size={13} /> {apps}
                        </span>
                        <ChevronRight size={18} className="dash-job-chevron" />
                      </div>
                    </Link>
                    <div className="dash-job-status-controls">
                      {job.status === 'expired' ? (
                        // Expired is a terminal, system-set state — not a manual
                        // option. Reactivation must go through renew (resets clock).
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={(e) => { e.stopPropagation(); renewJob(job.id); }}
                        >
                          Renew 30 days
                        </button>
                      ) : (
                        <select
                          value={job.status}
                          onChange={(e) => updateJobStatus(job, e.target.value)}
                          className="status-select"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="filled">Filled</option>
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'billing' && (
        <div className="billing-section">
          <div className="billing-card">
            <div className="billing-plan-badge">Free Trial</div>
            <h3>You're on the Free Trial</h3>
            <p>Post unlimited job listings and receive applications at no cost during the trial period.</p>
            <div className="billing-details">
              <div className="billing-detail-row">
                <span>Plan</span>
                <strong>Free Trial</strong>
              </div>
              <div className="billing-detail-row">
                <span>Job Postings</span>
                <strong>Unlimited</strong>
              </div>
              <div className="billing-detail-row">
                <span>Applications</span>
                <strong>Unlimited</strong>
              </div>
              <div className="billing-detail-row">
                <span>Monthly Cost</span>
                <strong>$0.00</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
