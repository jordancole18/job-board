import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search, MapPin, DollarSign, List, Map } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { haversineDistance, radiusToZoom } from '../utils/distance';
import { getArrangementStyle, getJobTypeStyle, JOB_TYPE_OPTIONS, ARRANGEMENT_OPTIONS } from '../constants/jobStyles';
import SafeMapView from '../components/SafeMapView';
import LocationAutocomplete, { type LatLngBounds } from '../components/LocationAutocomplete';

interface JobTag {
  tag_id: string;
  tags: { name: string } | null;
}

interface Job {
  id: string;
  title: string;
  company_name: string;
  description: string;
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
  // Bounds of the selected place (e.g. a whole state). When set and no radius is
  // chosen, the map fits these bounds so a state query frames the state, not a city.
  const [locationBounds, setLocationBounds] = useState<LatLngBounds | null>(null);
  const [mapBounds, setMapBounds] = useState<LatLngBounds | null>(null);
  const [hoveredJob, setHoveredJob] = useState<string | null>(null);
  // Land on the map pane when arriving via "Search By Map" (?view=map);
  // keyword/category entries still default to the list on mobile.
  const [mobileView, setMobileView] = useState<'list' | 'map'>(
    searchParams.get('view') === 'map' ? 'map' : 'list'
  );
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Only mount the map when its container is actually visible. Leaflet crashes
  // when initialized inside a display:none element (0x0 dimensions).
  const mapVisible = !isMobile || mobileView === 'map';

  useEffect(() => {
    async function load() {
      const [jobsRes, tagsRes] = await Promise.all([
        supabase.from('jobs').select('id, title, company_name, description, city, state, salary, job_type, work_arrangement, lat, lng, job_tags(tag_id, tags(name))').eq('status', 'active'),
        supabase.from('tags').select('id, name').order('name'),
      ]);
      // Supabase infers the nested tags() relation as an array, but a to-one
      // FK returns a single object at runtime — cast through unknown to match.
      if (jobsRes.data) setJobs(jobsRes.data as unknown as Job[]);
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
            const bb: string[] | undefined = data[0].boundingbox;
            const bounds: LatLngBounds | null =
              bb && bb.length >= 4 && bb.map(Number).every(Number.isFinite)
                ? [[Number(bb[0]), Number(bb[2])], [Number(bb[1]), Number(bb[3])]]
                : null;
            setLocationCenter([lat, lng]);
            setLocationLabel(label);
            setLocationBounds(bounds);
            setMapCenter([lat, lng]);
            if (bounds) setMapBounds(bounds);
            else setMapZoom(10);
          }
        })
        .catch(() => {});
    }
  }, []);

  function handleLocationSelect(lat: number, lng: number, label: string, bounds: LatLngBounds | null) {
    setLocationCenter([lat, lng]);
    setLocationLabel(label);
    setLocationBounds(bounds);
    setMapCenter([lat, lng]);
    if (radius > 0) {
      // Radius selection wins: zoom to the radius around the point.
      setMapBounds(null);
      setMapZoom(radiusToZoom(radius));
    } else if (bounds) {
      // No radius: fit the place's bounds (state -> state view, city -> city view).
      setMapBounds(bounds);
    } else {
      setMapBounds(null);
      setMapZoom(10);
    }
  }

  function handleLocationClear() {
    setLocationCenter(null);
    setLocationLabel('');
    setLocationBounds(null);
    setMapBounds(null);
    setMapCenter(US_CENTER);
    setMapZoom(4);
  }

  function handleRadiusChange(value: number) {
    setRadius(value);
    if (!locationCenter) return;
    if (value > 0) {
      // Radius takes precedence over the place bounds.
      setMapBounds(null);
      setMapZoom(radiusToZoom(value));
    } else if (locationBounds) {
      // Cleared the radius: re-fit the place's bounds.
      setMapBounds(locationBounds);
    } else {
      setMapBounds(null);
      setMapZoom(10);
    }
  }

  const filtered = jobs.filter((job) => {
    const kw = keyword.toLowerCase();
    const matchesKeyword =
      !keyword ||
      job.title.toLowerCase().includes(kw) ||
      job.company_name.toLowerCase().includes(kw) ||
      (job.description ?? '').toLowerCase().includes(kw) ||
      (job.job_tags ?? []).some((jt) => jt.tags?.name?.toLowerCase().includes(kw));
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
                placeholder="Filter by title, company, or category..."
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
        ) : mapVisible ? (
          <SafeMapView jobs={filtered} center={mapCenter} zoom={mapZoom} bounds={mapBounds} isMobile={isMobile} />
        ) : null}
      </div>
    </div>
  );
}
