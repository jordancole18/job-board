import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search, MapPin, DollarSign, List, Map } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { haversineDistance, radiusToZoom } from '../utils/distance';
import { getArrangementStyle, getJobTypeStyle, JOB_TYPE_OPTIONS, ARRANGEMENT_OPTIONS } from '../constants/jobStyles';
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
  work_arrangement: string;
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
  const [arrangementFilter, setArrangementFilter] = useState(searchParams.get('arrangement') || '');
  const [tagFilter, setTagFilter] = useState(searchParams.get('tag') || '');
  const [radius, setRadius] = useState(0);
  const [locationCenter, setLocationCenter] = useState<[number, number] | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [mapCenter, setMapCenter] = useState<[number, number]>(US_CENTER);
  const [mapZoom, setMapZoom] = useState(4);
  const [hoveredJob, setHoveredJob] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');

  useEffect(() => {
    async function load() {
      const [jobsRes, tagsRes] = await Promise.all([
        supabase.from('jobs').select('id, title, company_name, city, state, salary, job_type, work_arrangement, lat, lng, job_tags(tag_id)').eq('status', 'active'),
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
    const matchesArrangement = !arrangementFilter || job.work_arrangement === arrangementFilter;
    const matchesTag = !tagFilter || job.job_tags?.some((jt) => jt.tag_id === tagFilter);
    const matchesRadius =
      !locationCenter ||
      radius === 0 ||
      haversineDistance(locationCenter[0], locationCenter[1], job.lat, job.lng) <= radius;
    return matchesKeyword && matchesType && matchesArrangement && matchesTag && matchesRadius;
  });

  return (
    <div className="explore-page">
      <Helmet>
        <title>Search Jobs by Map - Association Careers</title>
        <meta name="description" content="Search association career opportunities by location on an interactive map. Filter by job type, work arrangement, and category." />
      </Helmet>
      <div className="explore-mobile-toggle">
        <button
          className={`explore-toggle-btn ${mobileView === 'list' ? 'explore-toggle-active' : ''}`}
          onClick={() => setMobileView('list')}
        >
          <List size={16} /> List
        </button>
        <button
          className={`explore-toggle-btn ${mobileView === 'map' ? 'explore-toggle-active' : ''}`}
          onClick={() => setMobileView('map')}
        >
          <Map size={16} /> Map
        </button>
      </div>
      <div className={`explore-sidebar explore-mobile-${mobileView === 'list' ? 'show' : 'hide'}`}>
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
              {JOB_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={arrangementFilter}
              onChange={(e) => setArrangementFilter(e.target.value)}
              className="input explore-type-select"
            >
              <option value="">All Arrangements</option>
              {ARRANGEMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="explore-keyword-row">
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="input explore-type-select"
              style={{ flex: 1 }}
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
              const arrStyle = getArrangementStyle(job.work_arrangement);
              const jtStyle = getJobTypeStyle(job.job_type);
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
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <span
                          className="job-type-badge"
                          style={{ backgroundColor: arrStyle.bg, color: arrStyle.text, fontSize: '0.65rem', padding: '2px 8px' }}
                        >
                          {job.work_arrangement}
                        </span>
                        <span
                          className="job-type-badge"
                          style={{ backgroundColor: jtStyle.bg, color: jtStyle.text, fontSize: '0.65rem', padding: '2px 8px' }}
                        >
                          {job.job_type}
                        </span>
                      </div>
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

      <div className={`explore-map explore-mobile-${mobileView === 'map' ? 'show' : 'hide'}`}>
        {loading ? (
          <div className="loading">Loading map...</div>
        ) : (
          <MapView jobs={filtered} center={mapCenter} zoom={mapZoom} />
        )}
      </div>
    </div>
  );
}
