import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleAlert, ExternalLink, Loader2, LocateFixed, MapPin, Pencil, Search } from 'lucide-react';
import { api } from '../lib/api';
import { embedUrl, mapsLink, parseCoords } from '../lib/geo';
import { ease } from '../lib/motion';

/**
 * Pick an exact place: type the address and choose one of the suggestions, use the phone's current
 * location, or paste a Google Maps link. The value is { lat, lng, label } or null.
 */
export default function LocationPicker({ value, onChange, label = 'Search the place on the map', hint }) {
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState([]);
  const [open, setOpen] = useState(!value);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);
  const coords = parseCoords(query);

  useEffect(() => {
    const q = query.trim();
    const n = ++seq.current;
    if (q.length < 3 || coords) {
      setPlaces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { places } = await api.searchPlaces(q);
        if (n === seq.current) {
          setPlaces(places);
          setError(places.length ? '' : 'No match yet — add the area or city, or use your current location.');
        }
      } catch (e) {
        if (n === seq.current) setError(e.message);
      } finally {
        if (n === seq.current) setLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const choose = (place) => {
    onChange(place);
    setOpen(false);
    setQuery('');
    setPlaces([]);
    setError('');
  };

  const fromCoords = async ({ lat, lng }) => {
    let label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      label = (await api.reversePlace(lat, lng)).label || label;
    } catch {
      /* keep the coordinates as the label */
    }
    choose({ lat, lng, label });
  };

  const locate = () => {
    if (!navigator.geolocation) return setError('This browser can’t share its location. Search for the place instead.');
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await fromCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError('Location permission was denied. Allow it for this site, or search for the place.');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <div className="loc-picker">
      {value && !open ? (
        <motion.div className="loc-chosen" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }}>
          <div className="loc-chosen-head">
            <MapPin size={18} />
            <span>{value.label || `${value.lat}, ${value.lng}`}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
              <Pencil size={14} /> Change
            </button>
          </div>
          <iframe className="loc-map" title="Selected place on Google Maps" src={embedUrl(value)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          <a className="loc-open" href={mapsLink(value)} target="_blank" rel="noreferrer">
            <ExternalLink size={13} /> Open in Google Maps
          </a>
        </motion.div>
      ) : (
        <div className="loc-search">
          <label className="field">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder=" " autoComplete="off" />
            <span>{label}</span>
            <span className="loc-search-icon">{loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}</span>
          </label>
          <AnimatePresence>
            {(places.length > 0 || coords) && (
              <motion.ul className="loc-results" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                {coords && (
                  <li>
                    <button type="button" onClick={() => fromCoords(coords)}>
                      <LocateFixed size={15} /> Use this pin ({coords.lat.toFixed(5)}, {coords.lng.toFixed(5)})
                    </button>
                  </li>
                )}
                {places.map((p) => (
                  <li key={`${p.lat},${p.lng}`}>
                    <button type="button" onClick={() => choose(p)}>
                      <MapPin size={15} /> {p.label}
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
          <div className="loc-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={locate} disabled={locating}>
              {locating ? <Loader2 size={15} className="spin" /> : <LocateFixed size={15} />} Use my current location
            </button>
            {value && (
              <button type="button" className="link-btn" onClick={() => setOpen(false)}>
                Keep the current pin
              </button>
            )}
          </div>
          {error && (
            <p className="loc-error">
              <CircleAlert size={14} /> {error}
            </p>
          )}
          {hint && <p className="fine-print">{hint}</p>}
        </div>
      )}
    </div>
  );
}
