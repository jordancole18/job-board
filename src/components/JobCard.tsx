import { Link } from 'react-router-dom';
import { MapPin, DollarSign, Clock, Star } from 'lucide-react';

interface Props {
  id: string;
  title: string;
  companyName: string;
  city: string;
  state: string;
  salary: string;
  jobType: string;
  createdAt: string;
  isFeatured?: boolean;
  tags?: { name: string; color: string }[];
}

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  'full-time': { bg: 'rgba(56,182,83,0.1)', text: '#2d9a46' },
  'part-time': { bg: 'rgba(99,102,241,0.1)', text: '#6366f1' },
  contract: { bg: 'rgba(249,115,22,0.1)', text: '#ea580c' },
  remote: { bg: 'rgba(59,130,246,0.1)', text: '#2563eb' },
};

export default function JobCard({ id, title, companyName, city, state, salary, jobType, createdAt, isFeatured, tags }: Props) {
  const daysAgo = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  const timeLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1d ago' : `${daysAgo}d ago`;
  const colorIndex = companyName.charCodeAt(0) % AVATAR_COLORS.length;
  const avatarColor = AVATAR_COLORS[colorIndex];
  const typeStyle = TYPE_STYLES[jobType] || { bg: 'rgba(107,114,128,0.1)', text: '#6b7280' };

  return (
    <Link to={`/jobs/${id}`} className={`job-card ${isFeatured ? 'job-card-featured' : ''}`}>
      {isFeatured && (
        <div className="featured-badge">
          <Star size={12} /> Featured
        </div>
      )}
      <div className="job-card-avatar" style={{ backgroundColor: avatarColor }}>
        {companyName.charAt(0)}
      </div>
      <div className="job-card-body">
        <h3 className="job-card-title">{title}</h3>
        <p className="job-card-company">{companyName}</p>
        <div className="job-card-meta">
          <span className="job-card-meta-item">
            <MapPin size={14} /> {city}, {state}
          </span>
          <span className="job-card-meta-item">
            <DollarSign size={14} /> {salary}
          </span>
          <span className="job-card-meta-item">
            <Clock size={14} /> {timeLabel}
          </span>
        </div>
        {tags && tags.length > 0 && (
          <div className="job-card-tags">
            {tags.map((tag) => (
              <span key={tag.name} className="job-card-tag" style={{ backgroundColor: tag.color + '18', color: tag.color }}>
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="job-card-actions">
        <span
          className="job-type-badge"
          style={{ backgroundColor: typeStyle.bg, color: typeStyle.text }}
        >
          {jobType}
        </span>
      </div>
    </Link>
  );
}
