import L from 'leaflet';

// Leaflet throws "Invalid LatLng object" when handed NaN/undefined coords. That
// crash can come from third-party plugins (e.g. marker clustering) and bypass
// our own validation. Replace the constructor with a tolerant version that
// substitutes (0, 0) and warns, so the UI degrades gracefully instead of dying.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OriginalLatLng: any = L.LatLng;

// Match Leaflet's own check (isNaN). We must allow ±Infinity through because
// leaflet.markercluster initializes a static `_mapBoundsInfinite` with
// `new L.LatLng(±Infinity, ±Infinity)` at module load — substituting those
// would silently break all marker visibility math.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SafeLatLng(this: any, lat: number, lng: number, alt?: number) {
  let safeLat = lat;
  let safeLng = lng;
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(safeLat as number) || isNaN(safeLng as number)) {
    if (typeof console !== 'undefined') {
      console.warn('[leafletPatch] Substituting (0,0) for NaN LatLng', { lat, lng });
    }
    safeLat = 0;
    safeLng = 0;
  }
  return alt === undefined
    ? new OriginalLatLng(safeLat, safeLng)
    : new OriginalLatLng(safeLat, safeLng, alt);
}

SafeLatLng.prototype = OriginalLatLng.prototype;
(L as unknown as { LatLng: unknown }).LatLng = SafeLatLng;

const originalLatLngFactory = L.latLng;
(L as unknown as { latLng: typeof originalLatLngFactory }).latLng = function patchedLatLng(
  ...args: Parameters<typeof originalLatLngFactory>
) {
  try {
    return originalLatLngFactory(...args);
  } catch (err) {
    console.warn('[leafletPatch] latLng factory caught', err);
    return originalLatLngFactory(0, 0);
  }
} as typeof originalLatLngFactory;

export const LEAFLET_PATCH_VERSION = '2026-04-26-2';
