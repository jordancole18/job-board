import L from 'leaflet';

// Leaflet throws "Invalid LatLng object" when handed NaN/undefined coords. That
// crash can come from third-party plugins (e.g. marker clustering) and bypass
// our own validation. Replace the constructor with a tolerant version that
// substitutes (0, 0) and warns, so the UI degrades gracefully instead of dying.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OriginalLatLng: any = L.LatLng;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SafeLatLng(this: any, lat: number, lng: number, alt?: number) {
  let safeLat = lat;
  let safeLng = lng;
  if (!Number.isFinite(safeLat) || !Number.isFinite(safeLng)) {
    if (typeof console !== 'undefined') {
      console.warn('[leafletPatch] Substituting (0,0) for invalid LatLng', { lat, lng });
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

export const LEAFLET_PATCH_VERSION = '2026-04-26-1';
