import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, Navigate, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, Delete, Folder, History, Keyboard, Search, Star } from 'lucide-react';
import { GURBANI_BOOKS } from '../../shared/gurbani';
import { api } from '../lib/api';
import { clearGurbaniHistory, rememberGurbaniSearch, toggleGurbaniFavourite, useGurbaniLibrary } from '../lib/gurbaniLibrary';
import GurbaniShabadLink from '../components/GurbaniShabadLink';
import GurbaniText from '../components/GurbaniText';
import GurbaniPage from './GurbaniPage';
import { GurbaniPlaylistProvider, GurbaniPlaylists, SaveShabadButton } from './GurbaniPlaylists';
import { GurbaniAng, GurbaniPaath, GurbaniRead } from './GurbaniRead';
import '../styles/gurbani.css';

const MAX_QUERY_LENGTH = 160;
const LIVE_MIN_LENGTH = 3;
const DASHBOARD_BACK = { to: '/gurbani', label: 'Back to Gurbani' };
const LETTER_KEYS = [
  'ੳ ਅ ੲ ਸ ਹ ਤ ਥ ਦ ਧ ਨ',
  'ਕ ਖ ਗ ਘ ਙ ਪ ਫ ਬ ਭ ਮ',
  'ਚ ਛ ਜ ਝ ਞ ਯ ਰ ਲ ਵ ੜ',
  'ਟ ਠ ਡ ਢ ਣ',
].join(' ').split(' ');
const SYMBOL_KEYS = [
  '੧ ੨ ੩ ੪ ੫ ੬ ੭ ੮ ੯ ੦',
  'ੇ ੈ ਿ ੀ ਾ ਂ ੁ ੂ ੰ ੱ',
  '੍ ੋ ੌ ਼ ੑ ੵ ਸ਼ ਜ਼ ਖ਼ ਫ਼',
  'ਗ਼ ਲ਼ ੴ । ॥ ਆ ਇ ਈ ਉ ਊ',
  'ਏ ਐ ਓ ਔ',
].join(' ').split(' ');

function GurmukhiKeyboard({ onKey, onPhoneKeyboard, canSearch }) {
  const [symbols, setSymbols] = useState(false);
  const keepCaret = (event) => event.preventDefault();

  return (
    <div className="gurbani-keyboard" id="gurmukhi-keys" role="group" aria-label="Punjabi keyboard keys">
      <div className="gurbani-key-grid">
        {(symbols ? SYMBOL_KEYS : LETTER_KEYS).map((key) => (
          <button key={key} type="button" className="gurmukhi" lang="pa-Guru" onMouseDown={keepCaret} onClick={(event) => onKey(key, event.detail > 0)}>
            {/\p{M}/u.test(key) ? `◌${key}` : key}
          </button>
        ))}
        <button className="gurbani-key-delete" type="button" aria-label="Backspace" onMouseDown={keepCaret} onClick={(event) => onKey('', event.detail > 0)}>
          <Delete size={19} aria-hidden="true" />
        </button>
      </div>
      <div className="gurbani-key-controls">
        <button type="button" aria-label={symbols ? 'Show Punjabi letters' : 'Show numbers and symbols'} onMouseDown={keepCaret} onClick={() => setSymbols((shown) => !shown)}>
          {symbols ? <span className="gurmukhi" lang="pa-Guru">ੳਅੲ</span> : '123'}
        </button>
        <button type="button" aria-label="English / phone keyboard" onMouseDown={keepCaret} onClick={onPhoneKeyboard}>
          <Keyboard size={17} aria-hidden="true" />
        </button>
        <button type="button" onMouseDown={keepCaret} onClick={(event) => onKey(' ', event.detail > 0)}>Space</button>
        <button type="submit" disabled={!canSearch} onMouseDown={keepCaret}>Search</button>
      </div>
    </div>
  );
}

function GurbaniDashboard() {
  const [params] = useSearchParams();
  const { search } = useLocation();
  if (params.has('q')) return <Navigate to={{ pathname: '/gurbani/search', search }} replace />;
  return (
    <GurbaniPage title="Gurbani" gurmukhi="ਗੁਰਬਾਣੀ">
      <nav className="gurbani-choices" aria-label="Gurbani options">
        <Link className="gurbani-choice" to="/gurbani/read">
          <BookOpen size={25} aria-hidden="true" />
          <strong>Read</strong>
          <span>Open a paath or read Sri Guru Granth Sahib Ji and Sri Dasam Granth.</span>
        </Link>
        <Link className="gurbani-choice" to="/gurbani/search">
          <Search size={25} aria-hidden="true" />
          <strong>Search</strong>
          <span>Find a shabad in Gurmukhi or Romanized Punjabi.</span>
        </Link>
        <Link className="gurbani-choice" to="/gurbani/playlists">
          <Folder size={25} aria-hidden="true" />
          <strong>Playlists</strong>
          <span>Organize saved shabads and pages into folders.</span>
        </Link>
      </nav>
    </GurbaniPage>
  );
}

function FavouriteButton({ line, saved, showLabel = false }) {
  const label = saved ? 'Remove from favourites' : 'Add to favourites';
  return (
    <button type="button" className={`${showLabel ? 'btn btn-ghost btn-sm' : 'icon-btn'} gurbani-favourite-toggle`}
      data-saved={saved} aria-label={label} title={showLabel ? undefined : label} onClick={() => toggleGurbaniFavourite(line)}>
      <Star size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
      {showLabel && label}
    </button>
  );
}

function ShabadResults({ lines, favourites, context, recordHistory, previewScript, liveQuery }) {
  const savedIds = new Set(favourites.map((line) => line.shabadId));
  return (
    <ul className={`gurbani-result-list${previewScript ? ' gurbani-compact-results' : ''}`} aria-label={previewScript ? 'Matching shabads' : undefined}>
      {lines.map((line) => (
        <li className="gurbani-shabad-result" key={line.shabadId}>
          <GurbaniShabadLink line={line} context={context} previewScript={previewScript}
            onClick={recordHistory ? () => rememberGurbaniSearch(line) : undefined} />
          <div className="gurbani-result-actions">
            <SaveShabadButton line={line} query={liveQuery} compact />
            <FavouriteButton line={line} saved={savedIds.has(line.shabadId)} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const SEARCH_VIEWS = [
  { id: 'search', label: 'Search', Icon: Search },
  { id: 'history', label: 'History', Icon: History },
  { id: 'favourites', label: 'Favourites', Icon: Star },
];

function SearchViews({ current, params }) {
  return (
    <nav className="gurbani-search-views" aria-label="Gurbani search views">
      {SEARCH_VIEWS.map(({ id, label, Icon }) => {
        const next = new URLSearchParams(params);
        if (id === 'search') next.delete('view');
        else next.set('view', id);
        return (
          <Link key={id} className="btn btn-ghost btn-sm" to={{ search: next.toString() }} aria-current={current === id ? 'page' : undefined}>
            <Icon size={16} aria-hidden="true" /> {label}
          </Link>
        );
      })}
      <Link className="btn btn-ghost btn-sm" to="/gurbani/playlists">
        <Folder size={16} aria-hidden="true" /> Playlists
      </Link>
    </nav>
  );
}

function SearchHistory({ history }) {
  return (
    <section className="gurbani-search-library" aria-labelledby="gurbani-history-title">
      <header>
        <h2 id="gurbani-history-title">Search history</h2>
        {history.length > 0 && <button type="button" className="gurbani-text-button" onClick={clearGurbaniHistory}>Clear history</button>}
      </header>
      {history.length ? (
        <ul className="gurbani-result-list">
          {history.map((line) => (
            <li key={line.id}><GurbaniShabadLink line={line} context={{ view: 'history' }} /></li>
          ))}
        </ul>
      ) : <p role="status">Lines you open from search results will appear here.</p>}
    </section>
  );
}

function GurbaniSearch() {
  const [params, setParams] = useSearchParams();
  const requestedView = params.get('view');
  const view = requestedView === 'history' || requestedView === 'favourites' ? requestedView : 'search';
  const { history, favourites } = useGurbaniLibrary();
  const query = (params.get('q') || '').trim().slice(0, MAX_QUERY_LENGTH);
  const rawPage = params.get('page') || '';
  const page = /^[1-9][0-9]{0,2}$/.test(rawPage) ? Number(rawPage) : 1;
  const [draft, setDraft] = useState(query);
  const [phoneKeyboard, setPhoneKeyboard] = useState(false);
  const [showKeys, setShowKeys] = useState(!query);
  const [composing, setComposing] = useState(false);
  const [response, setResponse] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const input = useRef(null);
  const resultsHeading = useRef(null);
  const resultsList = useRef(null);
  const pendingCaret = useRef(null);
  const typed = draft.trim();
  const editing = typed !== query;
  const previewing = view === 'search' && editing && !composing && (typed.match(/[\p{L}\p{M}]/gu)?.length || 0) >= LIVE_MIN_LENGTH;
  const previewScript = /\p{Script=Gurmukhi}/u.test(typed) ? 'gurmukhi' : 'roman';
  const activeQuery = view === 'search' ? (previewing ? typed : editing ? '' : query) : '';
  const activePage = previewing ? 1 : page;
  const responseKey = JSON.stringify([activeQuery, activePage, attempt]);
  const currentResponse = response?.key === responseKey ? response : null;

  useEffect(() => setDraft(query), [query]);

  useEffect(() => {
    if (!activeQuery) return;
    const controller = new AbortController();
    function load() {
      api.searchGurbani(activeQuery, activePage, controller.signal).then(
        (data) => { if (!controller.signal.aborted) setResponse({ key: responseKey, data }); },
        (error) => { if (!controller.signal.aborted) setResponse({ key: responseKey, error: error.message }); },
      );
    }
    const timer = previewing ? setTimeout(load, 220) : null;
    if (timer === null) load();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeQuery, activePage, previewing, responseKey]);

  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    input.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [draft]);

  function setKeyboard(usePhone) {
    if (usePhone) {
      input.current.blur();
      flushSync(() => {
        setPhoneKeyboard(true);
        setShowKeys(false);
      });
      input.current.focus({ preventScroll: true });
    } else {
      input.current.blur();
      setPhoneKeyboard(false);
      setShowKeys(true);
    }
  }

  function editWithKey(key, focusInput) {
    const field = input.current;
    const end = field.selectionEnd ?? draft.length;
    let start = field.selectionStart ?? end;
    if (!key && start === end) start -= [...draft.slice(0, start)].at(-1)?.length || 0;
    const next = draft.slice(0, start) + key + draft.slice(end);
    if (next.length > MAX_QUERY_LENGTH) return;
    if (focusInput) field.focus({ preventScroll: true });
    const caret = start + key.length;
    if (next === draft) {
      field.setSelectionRange(caret, caret);
    } else {
      pendingCaret.current = caret;
      setDraft(next);
    }
  }

  function submit(text) {
    const value = text.trim().slice(0, MAX_QUERY_LENGTH);
    if (!value) return;
    input.current?.blur();
    setShowKeys(false);
    setDraft(value);
    if (value !== query || page !== 1 || view !== 'search') setParams({ q: value });
    else if (currentResponse?.error) setAttempt((count) => count + 1);
  }

  function changePage(nextPage) {
    setParams(nextPage === 1 ? { q: activeQuery } : { q: activeQuery, page: nextPage });
    resultsHeading.current?.focus({ preventScroll: showKeys });
    if (resultsList.current) resultsList.current.scrollTop = 0;
  }

  const results = currentResponse?.data?.results;
  const views = <SearchViews current={view} params={params} />;

  if (view !== 'search') {
    return (
      <GurbaniPage title="Gurbani search" back={DASHBOARD_BACK} adjustableText>
        {views}
        {view === 'history' ? <SearchHistory history={history} /> : (
          <section className="gurbani-search-library" aria-labelledby="gurbani-favourites-title">
            <header><h2 id="gurbani-favourites-title">Favourite shabads</h2></header>
            {favourites.length ? <ShabadResults lines={favourites} favourites={favourites} context={params} /> : (
              <p role="status">Tap the star beside a shabad to save it here.</p>
            )}
          </section>
        )}
      </GurbaniPage>
    );
  }

  const resultsPanel = activeQuery && (
    <section className={`gurbani-results${showKeys ? ' gurbani-results-with-keys' : ''}`} aria-labelledby="gurbani-results-title">
      <h2 id="gurbani-results-title" tabIndex={-1} ref={resultsHeading}>{showKeys ? 'Matching shabads' : 'Search results'}</h2>
      <div className={showKeys ? 'gurbani-suggestions-with-keys' : undefined} data-lenis-prevent={showKeys ? '' : undefined} ref={resultsList}>
        {!currentResponse && <p role="status">Searching…</p>}
        {currentResponse?.error && <p role="alert">{currentResponse.error} <button className="gurbani-text-button" type="button" onClick={() => setAttempt((count) => count + 1)}>Try again</button></p>}
        {results?.length === 0 && <p role="status">No shabads found for “{activeQuery}”. Try fewer words or a different spelling.</p>}
        {results?.length > 0 && (
          <ShabadResults lines={results} favourites={favourites} recordHistory context={{ q: activeQuery, page: activePage }}
            previewScript={showKeys ? previewScript : undefined} liveQuery={previewing ? activeQuery : undefined} />
        )}
      </div>
      {results && (activePage > 1 || currentResponse.data.hasMore) && (
        <nav className="gurbani-pagination" aria-label="Search result pages">
          <button className="btn btn-ghost btn-sm" type="button" disabled={activePage === 1} onClick={() => changePage(activePage - 1)}>Previous</button>
          <span>Page {activePage}</span>
          <button className="btn btn-ghost btn-sm" type="button" disabled={!currentResponse.data.hasMore} onClick={() => changePage(activePage + 1)}>Next</button>
        </nav>
      )}
    </section>
  );

  return (
    <GurbaniPage title="Gurbani search" back={DASHBOARD_BACK} adjustableText>
      {views}
      <form className="gurbani-form" role="search" aria-label="Gurbani" onSubmit={(event) => { event.preventDefault(); submit(draft); }}>
        <label htmlFor="gurbani-query">Enter any part of a line or the initials of consecutive words</label>
        <div className="gurbani-search-field">
          <input id="gurbani-query" ref={input} type="search" value={draft} maxLength={MAX_QUERY_LENGTH}
            inputMode={phoneKeyboard ? 'text' : 'none'} enterKeyHint="search" autoComplete="off" autoCapitalize="off" spellCheck={false}
            placeholder={phoneKeyboard ? 'Type in Romanized Punjabi' : 'ਤੇਰਾ ਕੀਤਾ'}
            onFocus={() => { if (!phoneKeyboard) setShowKeys(true); }} onChange={(event) => setDraft(event.target.value)}
            onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} />
          <button className="btn btn-primary" type="submit" disabled={!draft.trim()}><Search size={18} aria-hidden="true" /> Search</button>
        </div>
        {!showKeys && (
          <div className="gurbani-keyboard-options" role="group" aria-label="Keyboard choice">
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setKeyboard(false)}>
              <Keyboard size={17} aria-hidden="true" /> Punjabi keyboard
            </button>
            <button className="btn btn-ghost btn-sm" type="button" aria-label="English / phone keyboard" aria-pressed={phoneKeyboard} onClick={() => setKeyboard(true)}>
              English / phone
            </button>
          </div>
        )}
        {!activeQuery && (
          <div className={`gurbani-suggestions${showKeys ? ' gurbani-suggestions-with-keys' : ''}`} data-lenis-prevent>
            <p className="gurbani-examples">
              Type {LIVE_MIN_LENGTH} characters to see matches. {!typed && <>Try{' '}
                <button type="button" className="gurmukhi" lang="pa-Guru" onClick={() => submit('ਤੇਰਾ ਕੀਤਾ')}>ਤੇਰਾ ਕੀਤਾ</button> or{' '}
                <button type="button" onClick={() => submit('tera kita')}>tera kita</button>.</>}
            </p>
          </div>
        )}
        {showKeys && resultsPanel}
        {showKeys && <GurmukhiKeyboard onKey={editWithKey} onPhoneKeyboard={() => setKeyboard(true)} canSearch={Boolean(typed)} />}
      </form>
      {!showKeys && resultsPanel}
    </GurbaniPage>
  );
}

function GurbaniShabad() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [response, setResponse] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const { favourites } = useGurbaniLibrary();
  const lineId = params.get('line');
  const book = params.get('book') === 'dasam' ? 'dasam' : 'sggs';
  const back = new URLSearchParams(params);
  back.delete('line');
  back.delete('book');
  back.delete('save');
  const backView = back.get('view');
  const backLink = backView === 'playlists'
    ? { to: '/gurbani/playlists', label: 'Back to Playlists' }
    : {
      to: { pathname: '/gurbani/search', search: back.toString() },
      label: backView === 'history' ? 'Back to History' : backView === 'favourites' ? 'Back to Favourites' : 'Back to Gurbani search',
    };

  useEffect(() => {
    const controller = new AbortController();
    api.gurbaniShabad(id, book, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setResponse({ data }); },
      (error) => { if (!controller.signal.aborted) setResponse({ error: error.message, missing: error.status === 404 }); },
    );
    return () => controller.abort();
  }, [id, book, attempt]);

  const lines = response?.data?.lines;
  const firstAng = lines?.[0].ang;
  const lastAng = lines?.at(-1).ang;
  const favouriteLine = lines?.find((line) => line.id === lineId) || lines?.[0];
  const saved = favourites.some((line) => line.shabadId === id);

  return (
    <GurbaniPage title="Shabad" adjustableText
      subtitle={lines && `${GURBANI_BOOKS[book].title} · ${GURBANI_BOOKS[book].pageLabel} ${firstAng}${firstAng === lastAng ? '' : `–${lastAng}`}`}
      back={backLink}>
      {favouriteLine && (
        <div className="gurbani-reader-actions">
          <SaveShabadButton line={favouriteLine} />
          <FavouriteButton line={favouriteLine} saved={saved} showLabel />
        </div>
      )}
      {!response && <p role="status">Loading shabad…</p>}
      {response?.error && (
        <p role="alert">{response.error} {!response.missing && <button className="gurbani-text-button" type="button" onClick={() => { setResponse(null); setAttempt((count) => count + 1); }}>Try again</button>}</p>
      )}
      {lines && (
        <article className="gurbani-shabad" aria-label="Full shabad">
          {lines.map((line) => (
            <div className={`gurbani-shabad-line${lineId === line.id ? ' gurbani-matched-line' : ''}`} key={line.id}>
              <p lang="pa-Guru" className="gurmukhi gurbani-verse"><GurbaniText text={line.text} /></p>
            </div>
          ))}
        </article>
      )}
    </GurbaniPage>
  );
}

export default function Gurbani() {
  return (
    <GurbaniPlaylistProvider>
      <Routes>
        <Route index element={<GurbaniDashboard />} />
        <Route path="read" element={<GurbaniRead />} />
        <Route path="read/paath/:id" element={<GurbaniPaath />} />
        <Route path="read/ang/:ang" element={<GurbaniAng book="sggs" />} />
        <Route path="read/dasam/:ang" element={<GurbaniAng book="dasam" />} />
        <Route path="search" element={<GurbaniSearch />} />
        <Route path="shabad/:id" element={<GurbaniShabad />} />
        <Route path="playlists" element={<GurbaniPlaylists />} />
        <Route path="*" element={<Navigate to="/gurbani" replace />} />
      </Routes>
    </GurbaniPlaylistProvider>
  );
}
