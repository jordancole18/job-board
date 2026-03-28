import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, DollarSign, Calendar, MapPinned } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { getArrangementStyle, getJobTypeStyle } from '../constants/jobStyles';
import MapView from '../components/MapView';

interface JobTag {
  tags: { name: string; color: string };
}

interface Job {
  id: string;
  title: string;
  company_name: string;
  description: string;
  requirements: string;
  salary: string;
  job_type: string;
  work_arrangement: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  created_at: string;
  job_tags: JobTag[];
}

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];


export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('jobs')
        .select('*, job_tags(tags(name, color))')
        .eq('id', id)
        .single();
      setJob(data as Job | null);
      setLoading(false);
      if (data) {
        supabase.from('job_views').insert({ job_id: data.id }).then(({ error }) => {
          if (error) console.error('Failed to record view:', error.message);
        });
      }
    }
    load();
  }, [id]);

  if (loading) return <div className="page"><div className="loading">Loading...</div></div>;
  if (!job) return <div className="page"><div className="empty-state"><h3>Job not found</h3><Link to="/">Back to jobs</Link></div></div>;

  const daysAgo = Math.floor((Date.now() - new Date(job.created_at).getTime()) / 86400000);
  const timeLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;
  const avatarColor = AVATAR_COLORS[job.company_name.charCodeAt(0) % AVATAR_COLORS.length];
  const arrangementStyle = getArrangementStyle(job.work_arrangement);
  const typeStyle = getJobTypeStyle(job.job_type);
  const tags = job.job_tags?.map((jt) => jt.tags).filter(Boolean) || [];

  return (
    <div className="page">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} /> Back to jobs
      </Link>

      <div className="job-detail">
        <div className="job-detail-main">
          <div className="job-detail-header">
            <div className="job-detail-header-left">
              <div className="job-detail-avatar" style={{ backgroundColor: avatarColor }}>
                {job.company_name.charAt(0)}
              </div>
              <div>
                <h1>{job.title}</h1>
                <p className="job-detail-company">{job.company_name}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="job-type-badge" style={{ backgroundColor: arrangementStyle.bg, color: arrangementStyle.text }}>
                {job.work_arrangement}
              </span>
              <span className="job-type-badge" style={{ backgroundColor: typeStyle.bg, color: typeStyle.text }}>
                {job.job_type}
              </span>
            </div>
          </div>

          <div className="job-detail-meta">
            <span className="job-detail-meta-item">
              <MapPin size={16} /> {job.address ? `${job.address}, ` : ''}{job.city}, {job.state}
            </span>
            <span className="job-detail-meta-item">
              <DollarSign size={16} /> {job.salary}
            </span>
            <span className="job-detail-meta-item">
              <Calendar size={16} /> Posted {timeLabel}
            </span>
          </div>

          {tags.length > 0 && (
            <div className="job-detail-tags">
              {tags.map((tag) => (
                <span key={tag.name} className="job-card-tag" style={{ backgroundColor: tag.color + '18', color: tag.color }}>
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          <div className="job-detail-section">
            <h3>Description</h3>
            <p>{job.description}</p>
          </div>

          <div className="job-detail-section">
            <h3>Requirements</h3>
            <p>{job.requirements}</p>
          </div>

          <div className="job-detail-cta">
            <Link to={`/jobs/${id}/apply`} className="btn btn-primary btn-apply">
              Apply Now
            </Link>
            <p className="cta-hint">Takes less than 2 minutes</p>
          </div>
        </div>

        <div className="job-detail-sidebar">
          <h3><MapPinned size={16} /> Location</h3>
          <MapView jobs={[job]} center={[job.lat, job.lng]} zoom={12} />
        </div>
      </div>
    </div>
  );
}
