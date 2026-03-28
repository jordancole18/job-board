import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, MapPin, DollarSign } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { haversineDistance, radiusToZoom } from '../utils/distance';
import MapView from '../components/MapView';
import LocationAutocomplete from '../components/LocationAutocomplete';

interface JobTag {
  tag_id: string;
}

interface Job {
  id: string;
  title: string;
  company_name: string;
  city: string;
  state: string;
  salary: string;
  job_type: string;
  lat: number;
  lng: number;
  job_tags: JobTag[];
}

interface TagOption {
  id: string;
  name: string;
}

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  remote: { bg: 'rgba(59,130,246,0.1)', text: '#2563eb' },
  hybrid: { bg: 'rgba(99,102,241,0.1)', text: '#6366f1' },
  'in-office': { bg: 'rgba(56,182,83,0.1)', text: '#2d9a46' },
  contract: { bg: 'rgba(249,115,22,0.1)', text: '#ea580c' },
};

const RADIUS_OPTIONS = [
  { label: 'Any distance', value: 0 },
  { label: '10 miles', value: 10 },
  { label: '25 miles', value: 25 },
  { label: '50 miles', value: 50 },
  { label: '100 miles', value: 100 },
  { label: '250 miles', value: 250 },
];

const US_CENTER: [number, number] = [39.8283, -98.5795];

export default function MapPage() {
  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [keyword, setKeyword] = useState(searchParams.get('q') || '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '');
  const [tagFilter, setTagFilter] = useState(searchParams.get('tag') || '');
  const [radius, setRadius] = useState(0);
  const [locationCenter, setLocationCenter] = useState<[number, number] | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number]>(US_CENTER);
  const [mapZoom, setMapZoom] = useState(4);
  const [hoveredJob, setHoveredJob] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [jobsRes, tagsRes] = await Promise.all([
        supabase.from('jobs').select('id, title, company_name, city, state, salary, job_type, lat, lng, job_tags(tag_id)').eq('status', 'active'),
        supabase.from('tags').select('id, name').order('name'),
      ]);
      if (jobsRes.data) setJobs(jobsRes.data as Job[]);
      if (tagsRes.data) setTags(tagsRes.data);
      setLoading(false);
    }
    load();

    // Auto-geocode location from URL params
    const locationParam = searchParams.get('location');
    if (locationParam) {
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationParam)}&countrycodes=us&limit=1`,
        { headers: { 'User-Agent': 'JobBoardMVP/1.0' } }
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            const parts = data[0].display_name.split(',');
            const label = parts.slice(0, 2).map((p: string) => p.trim()).join(', ');
            setLocationCenter([lat, lng]);
            setLocationLabel(label);
            setMapCenter([lat, lng]);
            setMapZoom(10);
          }
        })
        .catch(() => {});
    }
  }, []);

  function handleLocationSelect(lat: number, lng: number, label: string) {
    setLocationCenter([lat, lng]);
    setLocationLabel(label);
    const zoom = radius > 0 ? radiusToZoom(radius) : 10;
    setMapCenter([lat, lng]);
    setMapZoom(zoom);
  }

  function handleLocationClear() {
    setLocationCenter(null);
    setLocationLabel('');
    setMapCenter(US_CENTER);
    setMapZoom(4);
  }

  function handleRadiusChange(value: number) {
    setRadius(value);
    if (locationCenter) {
      setMapZoom(value > 0 ? radiusToZoom(value) : 10);
    }
  }

  const filtered = jobs.filter((job) => {
    const matchesKeyword =
      !keyword ||
      job.title.toLowerCase().includes(keyword.toLowerCase()) ||
      job.company_name.toLowerCase().includes(keyword.toLowerCase());
    const matchesType = !typeFilter || job.job_type === typeFilter;
    const matchesTag = !tagFilter || job.job_tags?.some((jt) => jt.tag_id === tagFilter);
    const matchesRadius =
      !locationCenter ||
      radius === 0 ||
      haversineDistance(locationCenter[0], locationCenter[1], job.lat, job.lng) <= radius;
    return matchesKeyword && matchesType && matchesTag && matchesRadius;
  });

  return (
    <div className="explore-page">
      <div className="explore-sidebar">
        <div className="explore-sidebar-header">
          <h2>Explore Jobs</h2>
          <span className="explore-count">{filtered.length} results</span>
        </div>

        <div className="explore-filters">
          <LocationAutocomplete
            onSelect={handleLocationSelect}
            onClear={handleLocationClear}
          />

          {locationCenter && (
            <div className="explore-radius-row">
              <span className="explore-radius-label">Within</span>
              <select
                value={radius}
                onChange={(e) => handleRadiusChange(Number(e.target.value))}
                className="input explore-radius-select"
              >
                {RADIUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {locationLabel && (
                <span className="explore-radius-of">of {locationLabel}</span>
              )}
            </div>
          )}

          <div className="explore-keyword-row">
            <div className="explore-search">
              <Search size={16} className="explore-search-icon" />
              <input
                type="text"
                placeholder="Filter by job title or company..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="explore-search-input"
              />
            </div>
          </div>

          <div className="explore-keyword-row">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input explore-type-select"
            >
              <option value="">All Types</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="in-office">In-Office</option>
              <option value="contract">Contract</option>
            </select>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="input explore-type-select"
            >
              <option value="">All Categories</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="explore-list">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="explore-empty">
              {locationCenter && radius > 0
                ? `No jobs within ${radius} miles`
                : 'No jobs found'}
            </div>
          ) : (
            filtered.map((job) => {
              const color = AVATAR_COLORS[job.company_name.charCodeAt(0) % AVATAR_COLORS.length];
              const ts = TYPE_STYLES[job.job_type] || { bg: 'rgba(107,114,128,0.1)', text: '#6b7280' };
              const dist = locationCenter
                ? haversineDistance(locationCenter[0], locationCenter[1], job.lat, job.lng)
                : null;
              return (
                <Link
                  to={`/jobs/${job.id}`}
                  key={job.id}
                  className={`explore-card ${hoveredJob === job.id ? 'explore-card-active' : ''}`}
                  onMouseEnter={() => setHoveredJob(job.id)}
                  onMouseLeave={() => setHoveredJob(null)}
                >
                  <div className="explore-card-top">
                    <div className="explore-card-avatar" style={{ backgroundColor: color }}>
                      {job.company_name.charAt(0)}
                    </div>
                    <div className="explore-card-info">
                      <span className="explore-card-company">{job.company_name}</span>
                      <span
                        className="job-type-badge"
                        style={{ backgroundColor: ts.bg, color: ts.text, fontSize: '0.65rem', padding: '2px 8px' }}
                      >
                        {job.job_type}
                      </span>
                    </div>
                  </div>
                  <h4 className="explore-card-title">{job.title}</h4>
                  <div className="explore-card-meta">
                    <span><MapPin size={12} /> {job.city}, {job.state}</span>
                    <span><DollarSign size={12} /> {job.salary}</span>
                    {dist !== null && (
                      <span className="explore-card-distance">{Math.round(dist)} mi</span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>

      <div className="explore-map">
        {loading ? (
          <div className="loading">Loading map...</div>
        ) : (
          <MapView jobs={filtered} center={mapCenter} zoom={mapZoom} />
        )}
      </div>
    </div>
  );
}
