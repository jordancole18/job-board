/** Haversine distance in miles between two lat/lng points */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Rough zoom level for a given mile radius */
export function radiusToZoom(miles: number): number {
  if (miles <= 10) return 11;
  if (miles <= 25) return 10;
  if (miles <= 50) return 9;
  if (miles <= 100) return 8;
  if (miles <= 250) return 7;
  return 5;
}
