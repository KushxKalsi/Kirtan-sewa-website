import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CircleAlert, ExternalLink, Keyboard, Loader2, LocateFixed, MapPin, Pencil, Search } from 'lucide-react';
import { api } from '../lib/api';
import { embedUrl, hasPin, mapsLink, parseCoords } from '../lib/geo';
import { ease } from '../lib/motion';

/**
 * Pick an exact place: type the address and choose one of the suggestions, use the phone's current
 * location, or paste a Google Maps link. If the place can't be found, the address can be typed by hand.
 * The value is { lat, lng, label }, { label, manual: true } (typed, no pin) or null.
 */
export default function LocationPicker({ value, onChange, label = 'Search the place on the map', hint }) {
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState([]);
  const [open, setOpen] = useState(!value);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [typing, setTyping] = useState(false); // typing the address by hand
  const [typed, setTyped] = useState('');
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
          setError(places.length ? '' : 'No match yet — add the area or city, use your current location, or type the address yourself.');
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
    setTyping(false);
  };
  const useTyped = () => {
    const label = typed.trim().replace(/\s+/g, ' ');
    if (label.length < 5) return setError('Please type the full address — house / street, area and city.');
    choose({ label, manual: true });
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
            <span>
              {value.label || `${value.lat}, ${value.lng}`}
              {!hasPin(value) && <small className="loc-typed">Typed by hand · no map pin</small>}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setOpen(true);
                if (!hasPin(value)) {
                  setTyping(true);
                  setTyped(value.label || '');
                }
              }}
            >
              <Pencil size={14} /> Change
            </button>
          </div>
          {hasPin(value) && <iframe className="loc-map" title="Selected place on Google Maps" src={embedUrl(value)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
          <a className="loc-open" href={mapsLink(value)} target="_blank" rel="noreferrer">
            <ExternalLink size={13} /> {hasPin(value) ? 'Open in Google Maps' : 'Search it on Google Maps'}
          </a>
        </motion.div>
      ) : typing ? (
        <div className="loc-search">
          <label className="field">
            <textarea value={typed} onChange={(e) => setTyped(e.target.value)} placeholder=" " rows={3} maxLength={300} autoFocus />
            <span>Type the full address</span>
          </label>
          <div className="loc-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={useTyped}>
              <Check size={15} /> Use this address
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setTyping(false);
                setError('');
              }}
            >
              Search the map instead
            </button>
          </div>
          {error && (
            <p className="loc-error">
              <CircleAlert size={14} /> {error}
            </p>
          )}
          <p className="fine-print">Add the house / street, area, city and a landmark so it can be found.</p>
        </div>
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
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setTyping(true);
                setTyped(query);
                setError('');
              }}
            >
              <Keyboard size={13} /> Can’t find it? Type the address
            </button>
            {value && (
              <button type="button" className="link-btn" onClick={() => setOpen(false)}>
                Keep the current {hasPin(value) ? 'pin' : 'address'}
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
