import { useEffect, useState, useMemo } from 'react';
import { Search, MapPin, Briefcase, Tag } from 'lucide-react';
import { supabase } from '../utils/supabase';
import JobCard from '../components/JobCard';

interface JobTag {
  tag_id: string;
  tags: { name: string; color: string };
}

interface Job {
  id: string;
  title: string;
  company_name: string;
  description: string;
  salary: string;
  job_type: string;
  city: string;
  state: string;
  status: string;
  is_featured: boolean;
  created_at: string;
  job_tags: JobTag[];
}

interface TagOption {
  id: string;
  name: string;
  color: string;
}

export default function HomePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  useEffect(() => {
    Promise.all([fetchJobs(), fetchTags()]).then(() => setLoading(false));
  }, []);

  async function fetchJobs() {
    const { data, error } = await supabase
      .from('jobs')
      .select('*, job_tags(tag_id, tags(name, color))')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (!error && data) setJobs(data as Job[]);
  }

  async function fetchTags() {
    const { data } = await supabase
      .from('tags')
      .select('id, name, color')
      .order('name');
    if (data) setTags(data);
  }

  function getJobTags(job: Job) {
    return job.job_tags?.map((jt) => jt.tags).filter(Boolean) || [];
  }

  const filtered = useMemo(() => jobs.filter((job) => {
    const matchesSearch =
      !search ||
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.company_name.toLowerCase().includes(search.toLowerCase()) ||
      job.description.toLowerCase().includes(search.toLowerCase());
    const matchesLocation =
      !locationFilter ||
      job.city.toLowerCase().includes(locationFilter.toLowerCase()) ||
      job.state.toLowerCase().includes(locationFilter.toLowerCase());
    const matchesType = !typeFilter || job.job_type === typeFilter;
    const matchesTag = !tagFilter || job.job_tags?.some((jt) => jt.tag_id === tagFilter);
    return matchesSearch && matchesLocation && matchesType && matchesTag;
  }), [jobs, search, locationFilter, typeFilter, tagFilter]);

  const featuredJobs = useMemo(() => jobs.filter((j) => j.is_featured), [jobs]);
  const nonFeatured = useMemo(() => filtered.filter((j) => !j.is_featured || tagFilter || search || locationFilter || typeFilter), [filtered, tagFilter, search, locationFilter, typeFilter]);

  // Count jobs per tag
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    jobs.forEach((job) => {
      job.job_tags?.forEach((jt) => {
        counts[jt.tag_id] = (counts[jt.tag_id] || 0) + 1;
      });
    });
    return counts;
  }, [jobs]);

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <span className="hero-badge">Trusted by realtor associations nationwide</span>
          <h1>Find Your Next <span className="hero-highlight">Career Move</span></h1>
          <p>Browse {jobs.length} open positions from associations across the United States</p>
        </div>
        <div className="hero-search">
          <div className="hero-search-bar">
            <div className="hero-search-field">
              <Search size={18} className="hero-search-icon" />
              <input
                type="text"
                placeholder="Job title or keyword..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="hero-search-input"
              />
            </div>
            <div className="hero-search-field">
              <MapPin size={18} className="hero-search-icon" />
              <input
                type="text"
                placeholder="City or state..."
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="hero-search-input"
              />
            </div>
            <div className="hero-search-field">
              <Briefcase size={18} className="hero-search-icon" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="hero-search-select"
              >
                <option value="">All Types</option>
                <option value="full-time">Full-Time</option>
                <option value="part-time">Part-Time</option>
                <option value="contract">Contract</option>
                <option value="remote">Remote</option>
              </select>
            </div>
            <div className="hero-search-field">
              <Tag size={18} className="hero-search-icon" />
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="hero-search-select"
              >
                <option value="">All Categories</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary hero-search-btn" onClick={() => {}}>
              Search
            </button>
          </div>
        </div>
      </section>

      <section className="categories-section">
        <div className="section-header">
          <h2>Popular Categories</h2>
        </div>
        <div className="categories-grid">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className={`category-card ${tagFilter === tag.id ? 'category-card-active' : ''}`}
              onClick={() => setTagFilter(tagFilter === tag.id ? '' : tag.id)}
            >
              <div className="category-icon" style={{ backgroundColor: tag.color + '18', color: tag.color }}>
                <Briefcase size={22} />
              </div>
              <div>
                <div className="category-name">{tag.name}</div>
                <div className="category-count">
                  {tagCounts[tag.id] || 0} positions
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="page">
        {/* Featured Jobs */}
        {featuredJobs.length > 0 && !search && !locationFilter && !typeFilter && !tagFilter && (
          <div className="featured-section">
            <div className="section-header">
              <h2>Featured Jobs</h2>
            </div>
            <div className="job-grid">
              {featuredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  id={job.id}
                  title={job.title}
                  companyName={job.company_name}
                  city={job.city}
                  state={job.state}
                  salary={job.salary}
                  jobType={job.job_type}
                  createdAt={job.created_at}
                  isFeatured
                  tags={getJobTags(job)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recent / Filtered Jobs */}
        <div className="section-header">
          <h2>{search || locationFilter || typeFilter || tagFilter ? 'Search Results' : 'Recent Job Listings'}</h2>
          <span className="results-count">{nonFeatured.length} job{nonFeatured.length !== 1 ? 's' : ''} found</span>
        </div>

        {loading ? (
          <div className="skeleton-grid">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-circle" />
                <div style={{ flex: 1 }}>
                  <div className="skeleton-row skeleton-row-medium" />
                  <div className="skeleton-row skeleton-row-short" />
                  <div className="skeleton-row" />
                </div>
              </div>
            ))}
          </div>
        ) : nonFeatured.length === 0 ? (
          <div className="empty-state">
            <h3>No jobs found</h3>
            <p>Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="job-grid">
            {nonFeatured.map((job) => (
              <JobCard
                key={job.id}
                id={job.id}
                title={job.title}
                companyName={job.company_name}
                city={job.city}
                state={job.state}
                salary={job.salary}
                jobType={job.job_type}
                createdAt={job.created_at}
                tags={getJobTags(job)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
