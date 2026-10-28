// Place search for the venue / team member location picker.
// Uses Photon (OpenStreetMap data, free, no key), biased towards Punjab. Results are cached for a day.
const PHOTON = process.env.PHOTON_URL || 'https://photon.komoot.io';
const BIAS = { lat: 30.9, lon: 75.85 };
const cache = new Map();
const DAY = 24 * 60 * 60 * 1000;

async function cached(key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DAY) return hit.value;
  const value = await load();
  if (cache.size > 2000) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function photon(path) {
  const res = await fetch(`${PHOTON}${path}`, { headers: { 'User-Agent': 'kirtan-sewa-booking/1.0' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  return res.json();
}

function labelOf(p) {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const parts = [p.name, street !== p.name && street, p.district, p.city || p.town || p.village, p.county !== p.city && p.county, p.state, p.postcode, p.country];
  return [...new Set(parts.filter(Boolean))].join(', ');
}

const toPlace = (f) => ({ label: labelOf(f.properties || {}), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] });

export function searchPlaces(q) {
  const query = q.trim().toLowerCase();
  return cached(`s:${query}`, async () => {
    const data = await photon(`/api/?q=${encodeURIComponent(query)}&limit=6&lang=en&lat=${BIAS.lat}&lon=${BIAS.lon}`);
    return (data.features || []).map(toPlace).filter((p) => p.label);
  });
}

export function reversePlace(lat, lng) {
  return cached(`r:${lat.toFixed(5)},${lng.toFixed(5)}`, async () => {
    const data = await photon(`/reverse?lat=${lat}&lon=${lng}&lang=en`);
    const f = data.features?.[0];
    return f ? labelOf(f.properties || {}) : '';
  });
}
