import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import { Link } from 'react-router-dom';

interface Job {
  id: string;
  title: string;
  company_name: string;
  city: string;
  state: string;
  salary: string;
  lat: number;
  lng: number;
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
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center[0], center[1], zoom]);
  return null;
}

export default function MapView({ jobs, center = [39.8283, -98.5795], zoom = 4 }: Props) {
  return (
    <MapContainer center={center} zoom={zoom} className="map-container">
      <FlyToHandler center={center} zoom={zoom} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {jobs.map((job) => (
        <Marker key={job.id} position={[job.lat, job.lng]} icon={jobIcon}>
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
      ))}
    </MapContainer>
  );
}
