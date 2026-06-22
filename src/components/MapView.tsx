import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon, DivIcon, type LeafletMouseEvent } from 'leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import type { LatLngBounds } from './LocationAutocomplete';

interface Job {
  id: string;
  title: string;
  company_name: string;
  city: string;
  state: string;
  salary: string;
  lat: number | string | null;
  lng: number | string | null;
}

const greenMarkerSvg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41"><path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 22.2 12.5 41 12.5 41S25 22.2 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#38b653"/><circle cx="12.5" cy="12.5" r="5.5" fill="white"/></svg>`);

const jobIcon = new Icon({
  iconUrl: `data:image/svg+xml,${greenMarkerSvg}`,
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function makeBadgeIcon(count: number): DivIcon {
  const size = count < 10 ? 36 : count < 50 ? 44 : 52;
  const fontSize = count < 10 ? 14 : 13;
  return new DivIcon({
    html: `<div style="
      background: #38b653;
      color: white;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: ${fontSize}px;
      font-family: Inter, sans-serif;
      box-shadow: 0 2px 8px rgba(56, 182, 83, 0.4);
      border: 3px solid white;
    ">${count}</div>`,
    className: 'job-cluster-badge',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface Props {
  jobs: Job[];
  center?: [number, number];
  zoom?: number;
  bounds?: LatLngBounds | null;
  isMobile?: boolean;
}

const US_CENTER: [number, number] = [39.8283, -98.5795];
// Cap how many jobs a single co-located popup lists before collapsing to a count.
const MAX_POPUP_JOBS = 8;

function FlyToHandler({
  center,
  zoom,
  bounds,
}: {
  center: [number, number];
  zoom: number;
  bounds?: LatLngBounds | null;
}) {
  const map = useMap();
  const isFirstRun = useRef(true);
  const boundsKey = bounds ? bounds.flat().join(',') : '';
  useEffect(() => {
    // MapContainer's center/zoom props already position the map on mount.
    // Skipping the initial flyTo avoids a Leaflet internal projection bug
    // where the map's just-mounted state can produce NaN coordinates,
    // especially on mobile when the container has just become visible.
    if (isFirstRun.current) {
      isFirstRun.current = false;
      map.invalidateSize();
      return;
    }
    map.invalidateSize();
    // Prefer fitting place bounds (e.g. a whole state) when provided.
    if (bounds && bounds.flat().every(Number.isFinite)) {
      map.flyToBounds(bounds, { maxZoom: 13, padding: [40, 40], duration: 1.2 });
      return;
    }
    if (!Number.isFinite(center[0]) || !Number.isFinite(center[1]) || !Number.isFinite(zoom)) {
      return;
    }
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center[0], center[1], zoom, boundsKey]);
  return null;
}

function toCoord(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function toLatLng(lat: unknown, lng: unknown): [number, number] | null {
  const a = toCoord(lat);
  const b = toCoord(lng);
  return a !== null && b !== null ? [a, b] : null;
}

export default function MapView({ jobs, center = US_CENTER, zoom = 4, bounds = null, isMobile = false }: Props) {
  const validMarkers = jobs
    .map((job) => {
      const pos = toLatLng(job.lat, job.lng);
      return pos ? { job, pos } : null;
    })
    .filter((m): m is { job: Job; pos: [number, number] } => m !== null);

  const safeCenter = toLatLng(center[0], center[1]) ?? US_CENTER;
  const safeZoom = Number.isFinite(zoom) ? zoom : 4;

  // Group jobs that share a location so overlapping markers don't hide each other.
  // Rounding to 5 decimals (~1m) treats geocoded duplicates of the same address as one point.
  const groups = new Map<string, { pos: [number, number]; jobs: Job[] }>();
  for (const { job, pos } of validMarkers) {
    const key = `${pos[0].toFixed(5)},${pos[1].toFixed(5)}`;
    const existing = groups.get(key);
    if (existing) existing.jobs.push(job);
    else groups.set(key, { pos, jobs: [job] });
  }

  // On non-touch devices, open the popup on hover; tap/click works everywhere.
  // We deliberately do NOT close on mouseout so the cursor can reach the popup's
  // links without it flickering shut (a classic Leaflet hover pitfall).
  const hoverHandlers = isMobile
    ? undefined
    : { mouseover: (e: LeafletMouseEvent) => e.target.openPopup() };

  const renderedMarkers: React.ReactNode[] = [];
  for (const [key, group] of groups) {
    if (group.jobs.length === 1) {
      const job = group.jobs[0];
      renderedMarkers.push(
        <Marker key={job.id} position={group.pos} icon={jobIcon} eventHandlers={hoverHandlers}>
          <Popup>
            <div className="map-popup">
              <strong>{job.title}</strong>
              <p>{job.company_name}</p>
              <p>{job.city}, {job.state}</p>
              <p>{job.salary}</p>
              <Link to={`/jobs/${job.id}`}>View Details &rarr;</Link>
            </div>
          </Popup>
        </Marker>
      );
      continue;
    }

    // Co-located jobs: one badge whose popup lists every job at this point.
    const shown = group.jobs.slice(0, MAX_POPUP_JOBS);
    const extra = group.jobs.length - shown.length;
    renderedMarkers.push(
      <Marker
        key={`badge-${key}`}
        position={group.pos}
        icon={makeBadgeIcon(group.jobs.length)}
        eventHandlers={hoverHandlers}
      >
        <Popup>
          <div className="map-popup map-popup-list">
            <strong>{group.jobs.length} jobs at {group.jobs[0].city}, {group.jobs[0].state}</strong>
            <ul className="map-popup-jobs">
              {shown.map((job) => (
                <li key={job.id}>
                  <Link to={`/jobs/${job.id}`}>{job.title}</Link>
                  <span className="map-popup-job-company">{job.company_name}</span>
                </li>
              ))}
            </ul>
            {extra > 0 && (
              <p className="map-popup-more">+{extra} more at this location</p>
            )}
          </div>
        </Popup>
      </Marker>
    );
  }

  return (
    <MapContainer center={safeCenter} zoom={safeZoom} className="map-container">
      <FlyToHandler center={safeCenter} zoom={safeZoom} bounds={bounds} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {renderedMarkers}
    </MapContainer>
  );
}
