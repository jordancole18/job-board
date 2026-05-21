import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Icon, DivIcon } from 'leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';

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
}

function FlyToHandler({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const isFirstRun = useRef(true);
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
    if (!Number.isFinite(center[0]) || !Number.isFinite(center[1]) || !Number.isFinite(zoom)) {
      return;
    }
    map.invalidateSize();
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center[0], center[1], zoom]);
  return null;
}

// Manually spiderfies an expanded group: flies the map to it and collapses on zoom-out.
function ExpansionController({
  target,
  onCollapse,
}: {
  target: [number, number] | null;
  onCollapse: () => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    if (!Number.isFinite(target[0]) || !Number.isFinite(target[1])) return;
    const targetZoom = Math.max(map.getZoom(), EXPANDED_ZOOM);
    map.flyTo(target, targetZoom, { duration: 0.5 });
  }, [target?.[0], target?.[1]]);

  useMapEvents({
    zoomend: () => {
      if (map.getZoom() < EXPANDED_ZOOM - 1) onCollapse();
    },
  });
  return null;
}

const US_CENTER: [number, number] = [39.8283, -98.5795];
const EXPANDED_ZOOM = 15;
// At zoom 15, ~0.0009° latitude ≈ 100m ≈ 80px — enough to separate markers visibly.
const SPREAD_RADIUS_DEG = 0.0009;

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

function spreadOffsets(center: [number, number], count: number): [number, number][] {
  // Arrange markers in a circle around the shared location, starting at the top.
  // Longitude offset shrinks toward the poles so the circle stays circular on screen.
  const lngScale = 1 / Math.max(Math.cos((center[0] * Math.PI) / 180), 0.1);
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return [
      center[0] + SPREAD_RADIUS_DEG * Math.sin(angle),
      center[1] + SPREAD_RADIUS_DEG * Math.cos(angle) * lngScale,
    ] as [number, number];
  });
}

export default function MapView({ jobs, center = US_CENTER, zoom = 4 }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

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

  const expandedGroup = expandedKey ? groups.get(expandedKey) ?? null : null;

  const renderJobMarker = (job: Job, pos: [number, number]) => (
    <Marker key={job.id} position={pos} icon={jobIcon}>
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

  const renderedMarkers: React.ReactNode[] = [];
  for (const [key, group] of groups) {
    if (group.jobs.length === 1) {
      renderedMarkers.push(renderJobMarker(group.jobs[0], group.pos));
      continue;
    }
    if (expandedKey === key) {
      const offsets = spreadOffsets(group.pos, group.jobs.length);
      group.jobs.forEach((job, i) => renderedMarkers.push(renderJobMarker(job, offsets[i])));
      continue;
    }
    renderedMarkers.push(
      <Marker
        key={`badge-${key}`}
        position={group.pos}
        icon={makeBadgeIcon(group.jobs.length)}
        eventHandlers={{ click: () => setExpandedKey(key) }}
      />
    );
  }

  return (
    <MapContainer center={safeCenter} zoom={safeZoom} className="map-container">
      <FlyToHandler center={safeCenter} zoom={safeZoom} />
      <ExpansionController
        target={expandedGroup ? expandedGroup.pos : null}
        onCollapse={() => setExpandedKey(null)}
      />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {renderedMarkers}
    </MapContainer>
  );
}
