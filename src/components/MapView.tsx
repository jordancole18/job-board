import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Icon, DivIcon, point } from 'leaflet';
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

function createClusterIcon(cluster: { getChildCount: () => number }) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 36 : count < 50 ? 44 : 52;
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
      font-size: ${count < 10 ? '14px' : '13px'};
      font-family: Inter, sans-serif;
      box-shadow: 0 2px 8px rgba(56, 182, 83, 0.4);
      border: 3px solid white;
    ">${count}</div>`,
    className: 'custom-cluster-icon',
    iconSize: point(size, size, true),
  });
}

interface Props {
  jobs: Job[];
  center?: [number, number];
  zoom?: number;
}

function FlyToHandler({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
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

  const markers = validMarkers.map(({ job, pos }) => (
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
  ));

  return (
    <MapContainer center={safeCenter} zoom={safeZoom} className="map-container">
      <FlyToHandler center={safeCenter} zoom={safeZoom} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {validMarkers.length > 1 ? (
        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterIcon}
          maxClusterRadius={50}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
        >
          {markers}
        </MarkerClusterGroup>
      ) : (
        markers
      )}
    </MapContainer>
  );
}
