import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
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

const US_CENTER: [number, number] = [39.8283, -98.5795];

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

export default function MapView({ jobs, center = US_CENTER, zoom = 4 }: Props) {
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

  const markers = Array.from(groups.values()).map(({ pos, jobs: jobsHere }) => (
    <Marker key={jobsHere.map((j) => j.id).join('|')} position={pos} icon={jobIcon}>
      <Popup>
        {jobsHere.length === 1 ? (
          <div className="map-popup">
            <strong>{jobsHere[0].title}</strong>
            <p>{jobsHere[0].company_name}</p>
            <p>{jobsHere[0].city}, {jobsHere[0].state}</p>
            <p>{jobsHere[0].salary}</p>
            <Link to={`/jobs/${jobsHere[0].id}`}>View Details &rarr;</Link>
          </div>
        ) : (
          <div className="map-popup map-popup-multi">
            <strong>{jobsHere.length} jobs at this location</strong>
            <ul className="map-popup-list">
              {jobsHere.map((job) => (
                <li key={job.id}>
                  <Link to={`/jobs/${job.id}`}>
                    <span className="map-popup-list-title">{job.title}</span>
                    <span className="map-popup-list-meta">{job.company_name} &middot; {job.salary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Popup>
    </Marker>
  ));

  return (
    <MapContainer center={safeCenter} zoom={safeZoom} className="map-container">
      <FlyToHandler center={safeCenter} zoom={safeZoom} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {markers}
    </MapContainer>
  );
}
