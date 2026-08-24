import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, Users, Eye, ChevronRight, CreditCard, Clock, Mail, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import type { EmployerAltName } from '../types';

interface Job {
  id: string;
  title: string;
  city: string;
  state: string;
  job_type: string;
  work_arrangement: string;
  status: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'rgba(56,182,83,0.1)', text: '#2d9a46', label: 'Active' },
  inactive: { bg: 'rgba(107,114,128,0.1)', text: '#6b7280', label: 'Inactive' },
  filled: { bg: 'rgba(99,102,241,0.1)', text: '#6366f1', label: 'Filled' },
};

const ALT_NAME_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'rgba(245,158,11,0.12)', text: '#b45309', label: 'Awaiting approval' },
  approved: { bg: 'rgba(56,182,83,0.1)', text: '#2d9a46', label: 'Approved' },
  declined: { bg: 'rgba(239,68,68,0.1)', text: '#dc2626', label: 'Declined' },
};

export default function DashboardPage() {
  const { user, companyName, isApproved, isStateAssociation, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [altNames, setAltNames] = useState<EmployerAltName[]>([]);
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
      .select('id, title, city, state, job_type, work_arrangement, status, created_at')
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

  // isStateAssociation resolves after AuthContext loads the employer row, which
  // is later than the initial loadData(), so this gets its own effect.
  useEffect(() => {
    if (!isStateAssociation) return;
    supabase
      .from('employer_alt_names')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setAltNames(data);
      });
  }, [isStateAssociation]);

  async function updateJobStatus(jobId: string, status: string) {
    await supabase.from('jobs').update({ status }).eq('id', jobId);
    setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status } : j));
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

      {isStateAssociation && altNames.length > 0 && (
        <div className="alt-name-card">
          <div className="alt-name-card-head">
            <Building2 size={16} />
            <h3>Local Association Names</h3>
          </div>
          <p className="alt-name-card-hint">
            Names you've asked to post under on behalf of a local association. Listings publish
            as <strong>{companyName}</strong> until a name is approved, then switch over
            automatically.
          </p>
          <div className="alt-name-list">
            {altNames.map((an) => {
              const style = ALT_NAME_STATUS_STYLES[an.status] || ALT_NAME_STATUS_STYLES.pending;
              return (
                <div key={an.id} className="alt-name-row">
                  <div>
                    <strong>{an.name}</strong>
                    <span className="alt-name-meta">
                      Requested {new Date(an.created_at).toLocaleDateString()}
                      {an.status === 'declined' && an.review_note && ` · ${an.review_note}`}
                    </span>
                  </div>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: style.bg, color: style.text }}
                  >
                    {style.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                      <select
                        value={job.status}
                        onChange={(e) => updateJobStatus(job.id, e.target.value)}
                        className="status-select"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="filled">Filled</option>
                      </select>
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
