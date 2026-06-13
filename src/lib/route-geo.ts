// Geometry helpers for rider routing.
import type { ParsedCoords } from "./geo";

const R = 6371; // km

export function haversineKm(a: ParsedCoords, b: ParsedCoords): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Build a Google Maps directions URL with multiple stops, in the order given.
 * `origin` is optional — when omitted, Maps uses "your current location".
 */
export function multiStopDirections(stops: ParsedCoords[], origin?: ParsedCoords): string {
  if (stops.length === 0) return "https://www.google.com/maps";
  const dest = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1).map((s) => `${s.lat},${s.lng}`).join("|");
  const params = new URLSearchParams({
    api: "1",
    destination: `${dest.lat},${dest.lng}`,
    travelmode: "driving",
  });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  if (waypoints) params.set("waypoints", waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Browser geolocation as a Promise. */
export function getCurrentPosition(): Promise<ParsedCoords | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation)
    return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}
