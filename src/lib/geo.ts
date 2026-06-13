// Helpers for capturing & opening real-world locations.

export interface ParsedCoords {
  lat: number;
  lng: number;
}

/**
 * Try to extract lat,lng from a pasted Google Maps URL or "lat, lng" text.
 * Supports common Google Maps URL shapes:
 *   https://www.google.com/maps/place/.../@-1.2345,36.7890,17z
 *   https://www.google.com/maps?q=-1.2345,36.7890
 *   https://maps.google.com/?ll=-1.2345,36.7890
 *   https://goo.gl/maps/xyz  → cannot resolve client-side, returns null
 *   "-1.2345, 36.7890"
 */
export function parseCoords(input: string): ParsedCoords | null {
  if (!input) return null;
  const s = input.trim();

  // Plain "lat,lng"
  const plain = s.match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (plain) {
    const lat = parseFloat(plain[1]);
    const lng = parseFloat(plain[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // @lat,lng,zoom in path
  const at = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) {
    const lat = parseFloat(at[1]);
    const lng = parseFloat(at[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // ?q=lat,lng or &q=lat,lng
  const q = s.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (q) {
    const lat = parseFloat(q[1]);
    const lng = parseFloat(q[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // ?ll=lat,lng
  const ll = s.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (ll) {
    const lat = parseFloat(ll[1]);
    const lng = parseFloat(ll[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // !3dLAT!4dLNG (Google place data param)
  const d = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (d) {
    const lat = parseFloat(d[1]);
    const lng = parseFloat(d[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  return null;
}

export function isValidLatLng(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Build a Google Maps directions/search URL for a parcel location. */
export function googleMapsUrl(opts: {
  lat?: number | null;
  lng?: number | null;
  landmark?: string | null;
  fallback?: string | null;
}): string {
  if (opts.lat != null && opts.lng != null && isValidLatLng(Number(opts.lat), Number(opts.lng))) {
    return `https://www.google.com/maps/dir/?api=1&destination=${opts.lat},${opts.lng}`;
  }
  const q = opts.landmark || opts.fallback || "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
