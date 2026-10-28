/** Straight-line distance in km between two { lat, lng } points (good enough to see who is closest). */
export function distanceKm(a, b) {
  if (!a || !b) return null;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export const kmText = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`);

// Google Maps links: the exact pin when there is one, otherwise a search for the typed address.
export const mapsLink = (loc, address = '') =>
  `https://www.google.com/maps/search/?api=1&query=${loc ? `${loc.lat},${loc.lng}` : encodeURIComponent(address)}`;
export const directionsLink = (from, to) => `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}`;
export const embedUrl = (loc) => `https://maps.google.com/maps?q=${loc.lat},${loc.lng}&z=15&output=embed`;

/** Coordinates typed in ("30.90, 75.85") or inside a pasted Google Maps link. */
export function parseCoords(text) {
  const t = String(text || '');
  const patterns = [/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/, /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, /[?&](?:q|query|ll|destination)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, /^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/];
  for (const re of patterns) {
    const m = re.exec(t);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}
