import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Loader2, Minus, Play, Plus, Search, Square, Star } from 'lucide-react';
import { GURBANI_BOOKS } from '../../shared/gurbani';
import { api } from '../lib/api';
import { readStore, writeStore } from '../lib/storage';
import { rememberGurbaniSearch, toggleGurbaniFavourite, useGurbaniLibrary } from '../lib/gurbaniLibrary';
import { DEFAULTS, FIRST_STRING, OCTAVES, SCALES, Tanpura } from '../lib/tanpura';
import { GurbaniLanguageButton, GurbaniLanguageProvider, GurbaniReadingDisplay, GurbaniReadingExtras } from './GurbaniDisplay';
import GurbaniText from './GurbaniText';
import '../styles/gurbani.css';
import '../styles/tanpura.css';

const SETTINGS_KEY = 'sewa.tanpura';
const TEXT_SIZE_KEY = 'sewa.gurbani.textSize'; // shared with the Gurbani pages
const TEXT_SIZES = [100, 115, 130, 145, 160];
const LIVE_MIN_LENGTH = 3;

function savedSettings() {
  const saved = readStore(SETTINGS_KEY, {});
  const s = { ...DEFAULTS };
  if (SCALES.some((x) => x.id === saved.scale)) s.scale = saved.scale;
  if (OCTAVES[saved.octave]) s.octave = saved.octave;
  if (FIRST_STRING[saved.first]) s.first = saved.first;
  for (const [key, min, max] of [['cycle', 2.6, 7], ['volume', 0, 1], ['fine', -50, 50]]) {
    if (typeof saved[key] === 'number' && saved[key] >= min && saved[key] <= max) s[key] = saved[key];
  }
  return s;
}

const scaleName = (s) => `${SCALES[s.scale].name} · ${SCALES[s.scale].harmonium}`;

/* ---------------- Tanpura controls ---------------- */

function Strings({ engine, playing, first }) {
  const [hits, setHits] = useState([0, 0, 0, 0]);
  useEffect(() => {
    const timers = new Set();
    const off = engine.onPluck((index, delay) => {
      const t = setTimeout(() => {
        timers.delete(t);
        setHits((h) => h.map((n, i) => (i === index ? n + 1 : n)));
      }, delay * 1000);
      timers.add(t);
    });
    return () => {
      off();
      timers.forEach(clearTimeout);
    };
  }, [engine]);
  const labels = [FIRST_STRING[first].label, 'Sa', 'Sa', 'Low Sa'];
  return (
    <div className={`tanpura-strings${playing ? ' playing' : ''}`} aria-hidden="true">
      {labels.map((label, i) => (
        <div key={i} className={`tanpura-string s${i}`}>
          <span key={hits[i]} className={hits[i] ? 'plucked' : ''} />
          <em>{label}</em>
        </div>
      ))}
    </div>
  );
}

function TanpuraPanel({ engine, settings, change, playing, toggle, busy }) {
  const current = SCALES[settings.scale];
  return (
    <section className="tanpura-card glass" aria-labelledby="tanpura-title">
      <div className="tanpura-head">
        <div>
          <span className="eyebrow">Riyaz</span>
          <h2 id="tanpura-title">Tanpura</h2>
          <p className="muted">Pick your scale, press play, and read a shabad below while it plays.</p>
        </div>
        <button type="button" className={`tanpura-play${playing ? ' on' : ''}`} onClick={toggle} disabled={busy} aria-pressed={playing}
          aria-label={playing ? 'Stop tanpura' : `Play tanpura in ${current.name}`}>
          {busy ? <Loader2 size={26} className="spin" /> : playing ? <Square size={24} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
        </button>
      </div>

      <Strings engine={engine} playing={playing} first={settings.first} />

      <div className="tanpura-now" aria-live="polite">
        <strong>{current.name}</strong>
        <span>{current.harmonium} · {FIRST_STRING[settings.first].label} tuning · {OCTAVES[settings.octave]}</span>
      </div>

      <div className="tanpura-group">
        <span className="tanpura-label" id="tanpura-scale">Scale (Sa)</span>
        <div className="tanpura-scales" role="radiogroup" aria-labelledby="tanpura-scale">
          {SCALES.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={settings.scale === s.id}
              className={`${s.name.includes('#') ? 'kali' : 'safed'}${settings.scale === s.id ? ' active' : ''}`}
              onClick={() => change({ scale: s.id })}>
              <strong>{s.name}</strong>
              <small>{s.harmonium}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="tanpura-row">
        <div className="tanpura-group">
          <span className="tanpura-label" id="tanpura-first">First string</span>
          <div className="tanpura-seg" role="radiogroup" aria-labelledby="tanpura-first">
            {Object.entries(FIRST_STRING).map(([id, x]) => (
              <button key={id} type="button" role="radio" aria-checked={settings.first === id} className={settings.first === id ? 'active' : ''} onClick={() => change({ first: id })}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <div className="tanpura-group">
          <span className="tanpura-label" id="tanpura-octave">Octave</span>
          <div className="tanpura-seg" role="radiogroup" aria-labelledby="tanpura-octave">
            {Object.entries(OCTAVES).map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={settings.octave === Number(id)} className={settings.octave === Number(id) ? 'active' : ''}
                onClick={() => change({ octave: Number(id) })}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="tanpura-sliders">
        <label>
          <span>Volume <em>{Math.round(settings.volume * 100)}%</em></span>
          <input type="range" min="0" max="1" step="0.01" value={settings.volume} onChange={(e) => change({ volume: Number(e.target.value) })} />
        </label>
        <label>
          <span>Speed <em>{settings.cycle.toFixed(1)} s / round</em></span>
          <input type="range" min="2.6" max="7" step="0.1" value={9.6 - settings.cycle} onChange={(e) => change({ cycle: Math.round((9.6 - Number(e.target.value)) * 10) / 10 })} />
        </label>
        <label>
          <span>
            Fine tune <em>{settings.fine > 0 ? '+' : ''}{settings.fine} cents</em>
            {settings.fine !== 0 && <button type="button" className="gurbani-text-button" onClick={() => change({ fine: 0 })}>Reset</button>}
          </span>
          <input type="range" min="-50" max="50" step="1" value={settings.fine} onChange={(e) => change({ fine: Number(e.target.value) })} />
        </label>
      </div>
    </section>
  );
}

/* ---------------- Shabad reader ---------------- */

function ShabadList({ lines, onOpen }) {
  return (
    <GurbaniReadingDisplay ids={lines.map(({ id }) => id)} hasRoman>
      <ul className="gurbani-result-list tanpura-results">
        {lines.map((line) => (
          <li key={line.shabadId + line.id}>
            <button type="button" className="gurbani-result" onClick={() => onOpen(line)}>
              <span className="gurbani-result-ang">{line.book === 'dasam' ? 'Sri Dasam Granth · Panna' : 'Ang'} {line.ang}</span>
              <span lang="pa-Guru" className="gurmukhi gurbani-verse"><GurbaniText text={line.text} /></span>
              {line.roman && <span className="gurbani-roman" lang="pa-Latn"><GurbaniText text={line.roman} /></span>}
              <GurbaniReadingExtras id={line.id} roman={line.roman} romanShown />
            </button>
          </li>
        ))}
      </ul>
    </GurbaniReadingDisplay>
  );
}

function ShabadSearch({ onOpen }) {
  const { favourites, history } = useGurbaniLibrary();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const typed = query.trim();
  const ready = (typed.match(/[\p{L}\p{M}]/gu)?.length || 0) >= LIVE_MIN_LENGTH;
  const key = `${typed}:${page}:${attempt}`;

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api.searchGurbani(typed, page, controller.signal).then(
        (data) => { if (!controller.signal.aborted) setResponse({ key, data }); },
        (error) => { if (!controller.signal.aborted) setResponse({ key, error: error.message }); },
      );
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, ready, typed, page]);

  const current = response?.key === key ? response : null;
  const results = current?.data?.results;
  const open = (line) => {
    rememberGurbaniSearch(line);
    onOpen(line);
  };

  return (
    <>
      <form className="tanpura-search" role="search" aria-label="Find a shabad" onSubmit={(e) => e.preventDefault()}>
        <Search size={18} aria-hidden="true" />
        <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} maxLength={160}
          placeholder="ਤੇਰਾ ਕੀਤਾ  ·  tera kita  ·  first letters" aria-label="Search a shabad in Gurmukhi or Romanized Punjabi"
          enterKeyHint="search" autoComplete="off" autoCapitalize="off" spellCheck={false} />
      </form>

      {ready ? (
        <div className="tanpura-found">
          {!current && <p role="status" className="muted">Searching…</p>}
          {current?.error && <p role="alert">{current.error} <button type="button" className="gurbani-text-button" onClick={() => setAttempt((n) => n + 1)}>Try again</button></p>}
          {results?.length === 0 && <p role="status" className="muted">No shabads found for “{typed}”. Try fewer words or a different spelling.</p>}
          {results?.length > 0 && <ShabadList lines={results} onOpen={open} />}
          {results && (page > 1 || current.data.hasMore) && (
            <nav className="gurbani-pagination" aria-label="Search result pages">
              <button className="btn btn-ghost btn-sm" type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span>Page {page}</span>
              <button className="btn btn-ghost btn-sm" type="button" disabled={!current.data.hasMore} onClick={() => setPage(page + 1)}>Next</button>
            </nav>
          )}
        </div>
      ) : (
        <>
          <p className="muted tanpura-hint">Type {LIVE_MIN_LENGTH} letters of any line — in Gurmukhi, Romanized Punjabi, or the first letter of each word.</p>
          {favourites.length > 0 && (
            <div className="tanpura-saved">
              <h4><Star size={15} /> Favourite shabads</h4>
              <ShabadList lines={favourites} onOpen={onOpen} />
            </div>
          )}
          {history.length > 0 && (
            <div className="tanpura-saved">
              <h4><BookOpen size={15} /> Recently opened</h4>
              <ShabadList lines={history.slice(0, 6)} onOpen={onOpen} />
            </div>
          )}
        </>
      )}
    </>
  );
}

function ShabadView({ line, onBack }) {
  const { favourites } = useGurbaniLibrary();
  const [response, setResponse] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const book = line.book === 'dasam' ? 'dasam' : 'sggs';
  const saved = favourites.some((x) => x.shabadId === line.shabadId);

  useEffect(() => {
    const controller = new AbortController();
    setResponse(null);
    api.gurbaniShabad(line.shabadId, book, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setResponse({ data }); },
      (error) => { if (!controller.signal.aborted) setResponse({ error: error.message, missing: error.status === 404 }); },
    );
    return () => controller.abort();
  }, [line.shabadId, book, attempt]);

  const lines = response?.data?.lines;
  const firstAng = lines?.[0]?.ang;
  const lastAng = lines?.at(-1)?.ang;

  return (
    <div className="tanpura-shabad">
      <div className="tanpura-shabad-bar">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}><ArrowLeft size={16} /> Back</button>
        {lines && <span className="muted">{GURBANI_BOOKS[book].title} · {GURBANI_BOOKS[book].pageLabel} {firstAng}{firstAng === lastAng ? '' : `–${lastAng}`}</span>}
        <button type="button" className="icon-btn gurbani-favourite-toggle" data-saved={saved} aria-label={saved ? 'Remove from favourites' : 'Add to favourites'}
          onClick={() => toggleGurbaniFavourite(line)}>
          <Star size={18} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      {!response && <p role="status" className="muted">Loading shabad…</p>}
      {response?.error && (
        <p role="alert">{response.error} {!response.missing && <button className="gurbani-text-button" type="button" onClick={() => setAttempt((n) => n + 1)}>Try again</button>}</p>
      )}
      {lines && (
        <GurbaniReadingDisplay ids={lines.map(({ id }) => id)} hasRoman>
          <article className="gurbani-shabad" aria-label="Shabad">
            {lines.map((l) => (
              <div key={l.id} className={`gurbani-shabad-line${l.id === line.id ? ' gurbani-matched-line' : ''}`}>
                <p lang="pa-Guru" className="gurmukhi gurbani-verse"><GurbaniText text={l.text} /></p>
                <GurbaniReadingExtras id={l.id} roman={l.roman} />
              </div>
            ))}
          </article>
        </GurbaniReadingDisplay>
      )}
    </div>
  );
}

function ShabadReader({ settings, playing, toggle, busy }) {
  const [open, setOpen] = useState(null);
  const [sizeIndex, setSizeIndex] = useState(() => Math.max(0, TEXT_SIZES.indexOf(readStore(TEXT_SIZE_KEY, 100))));
  const top = useRef(null);
  const size = (next) => {
    setSizeIndex(next);
    writeStore(TEXT_SIZE_KEY, TEXT_SIZES[next]);
  };
  const show = (line) => {
    setOpen(line);
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <section className="tanpura-reader glass" aria-labelledby="tanpura-reader-title" style={{ '--gurbani-text-scale': TEXT_SIZES[sizeIndex] / 100 }} ref={top}>
      <div className="tanpura-mini">
        <button type="button" className={`tanpura-mini-play${playing ? ' on' : ''}`} onClick={toggle} disabled={busy} aria-label={playing ? 'Stop tanpura' : 'Play tanpura'}>
          {busy ? <Loader2 size={15} className="spin" /> : playing ? <Square size={13} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </button>
        <span className="tanpura-mini-name">Tanpura · {scaleName(settings)}{playing && <i className="tanpura-dot" />}</span>
        <div className="tanpura-mini-tools">
          <button type="button" className="icon-btn" aria-label="Smaller text" disabled={sizeIndex === 0} onClick={() => size(sizeIndex - 1)}><Minus size={15} /></button>
          <span aria-live="polite">{TEXT_SIZES[sizeIndex]}%</span>
          <button type="button" className="icon-btn" aria-label="Bigger text" disabled={sizeIndex === TEXT_SIZES.length - 1} onClick={() => size(sizeIndex + 1)}><Plus size={15} /></button>
          <GurbaniLanguageButton />
        </div>
      </div>
      <h3 id="tanpura-reader-title"><BookOpen size={18} /> Read a shabad</h3>
      {open ? <ShabadView line={open} onBack={() => setOpen(null)} /> : <ShabadSearch onOpen={show} />}
      <p className="gurbani-credit">Gurbani from <a href="https://github.com/shabados/database/releases/tag/4.8.7" target="_blank" rel="noreferrer">Shabad OS</a> · CC BY-SA 4.0</p>
    </section>
  );
}

/* ---------------- The tab ---------------- */

export default function TeamTanpura() {
  const [settings, setSettings] = useState(savedSettings);
  const [engine] = useState(() => new Tanpura(settings));
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => engine.close(), [engine]);

  const change = (next) => {
    setSettings((s) => {
      const merged = { ...s, ...next };
      writeStore(SETTINGS_KEY, merged);
      return merged;
    });
    engine.update(next);
  };

  const toggle = async () => {
    if (playing) {
      engine.stop();
      setPlaying(false);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await engine.start();
      setPlaying(true);
    } catch (e) {
      setError(e.message || 'Could not start the tanpura.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <GurbaniLanguageProvider>
      <div className="tanpura-tab">
        <TanpuraPanel engine={engine} settings={settings} change={change} playing={playing} toggle={toggle} busy={busy} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <ShabadReader settings={settings} playing={playing} toggle={toggle} busy={busy} />
      </div>
    </GurbaniLanguageProvider>
  );
}
