import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Delete, Keyboard, Search } from 'lucide-react';
import { api } from '../lib/api';
import '../styles/gurbani.css';

const MAX_QUERY_LENGTH = 160;
const KEY_ROWS = [
  'ਅ ਆ ਇ ਈ ਉ ਊ ਏ ਐ ਓ ਔ',
  'ਕ ਖ ਗ ਘ ਙ ਚ ਛ ਜ ਝ ਞ',
  'ਟ ਠ ਡ ਢ ਣ ਤ ਥ ਦ ਧ ਨ',
  'ਪ ਫ ਬ ਭ ਮ ਯ ਰ ਲ ਵ ੜ',
  'ਸ ਹ ਸ਼ ਖ਼ ਗ਼ ਜ਼ ਫ਼ ਲ਼ ੳ ੲ',
  'ਾ ਿ ੀ ੁ ੂ ੇ ੈ ੋ ੌ ੰ',
  'ਂ ੱ ੍ ਼ ੑ ੵ ੴ',
].map((row) => row.split(' '));

function GurmukhiKeyboard({ onKey }) {
  return (
    <div className="gurbani-keyboard" id="gurmukhi-keys" role="group" aria-label="Punjabi keyboard keys">
      <div className="gurbani-key-grid" lang="pa-Guru">
        {KEY_ROWS.flat().map((key) => (
          <button key={key} type="button" className="gurmukhi" onMouseDown={(event) => event.preventDefault()} onClick={(event) => onKey(key, event.detail > 0)}>
            {/\p{M}/u.test(key) ? `◌${key}` : key}
          </button>
        ))}
      </div>
      <div className="gurbani-key-controls">
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={(event) => onKey(' ', event.detail > 0)}>Space</button>
        <button type="button" aria-label="Backspace" onMouseDown={(event) => event.preventDefault()} onClick={(event) => onKey('', event.detail > 0)}><Delete size={19} aria-hidden="true" /></button>
      </div>
    </div>
  );
}

function SourceCredit() {
  return <p className="gurbani-credit">Gurbani text from <a href="https://github.com/shabados/database/releases/tag/4.8.7">Shabad OS</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></p>;
}

export function GurbaniSearch() {
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') || '').trim().slice(0, MAX_QUERY_LENGTH);
  const rawPage = params.get('page') || '';
  const page = /^[1-9][0-9]{0,2}$/.test(rawPage) ? Number(rawPage) : 1;
  const [draft, setDraft] = useState(query);
  const [phoneKeyboard, setPhoneKeyboard] = useState(false);
  const [showKeys, setShowKeys] = useState(!query);
  const [response, setResponse] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const input = useRef(null);
  const resultsHeading = useRef(null);
  const pendingCaret = useRef(null);
  const responseKey = JSON.stringify([query, page, attempt]);
  const currentResponse = response?.key === responseKey ? response : null;

  useEffect(() => setDraft(query), [query]);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    api.searchGurbani(query, page, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setResponse({ key: responseKey, data }); },
      (error) => { if (!controller.signal.aborted) setResponse({ key: responseKey, error: error.message }); },
    );
    return () => controller.abort();
  }, [query, page, responseKey]);

  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    input.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
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
    if (next !== draft) {
      pendingCaret.current = start + key.length;
      setDraft(next);
    }
  }

  function submit(text) {
    const value = text.trim();
    if (!value) return;
    input.current.blur();
    setShowKeys(false);
    setDraft(value);
    if (value !== query || page !== 1) setParams({ q: value });
    else if (currentResponse?.error) setAttempt((count) => count + 1);
  }

  function changePage(nextPage) {
    setParams(nextPage === 1 ? { q: query } : { q: query, page: nextPage });
    resultsHeading.current?.focus();
  }

  const results = currentResponse?.data?.results;

  return (
    <main className="page gurbani-page">
      <div className="container gurbani-container">
        <header className="gurbani-header">
          <p className="gurmukhi" lang="pa-Guru">ਸ਼ਬਦ ਖੋਜ</p>
          <h1>Gurbani search</h1>
          <p>Find a shabad anywhere in Sri Guru Granth Sahib Ji.</p>
        </header>

        <form className="gurbani-form" role="search" aria-label="Gurbani" onSubmit={(event) => { event.preventDefault(); submit(draft); }}>
          <label htmlFor="gurbani-query">Enter a line or the first letter of each word</label>
          <div className="gurbani-search-field">
            <input id="gurbani-query" ref={input} type="search" value={draft} maxLength={MAX_QUERY_LENGTH}
              inputMode={phoneKeyboard ? 'text' : 'none'} enterKeyHint="search" autoComplete="off" autoCapitalize="off" spellCheck={false}
              placeholder={phoneKeyboard ? 'Type in Romanized Punjabi' : 'ਤੇਰਾ ਕੀਤਾ'}
              onFocus={() => { if (!phoneKeyboard) setShowKeys(true); }} onChange={(event) => setDraft(event.target.value)} />
            <button className="btn btn-primary" type="submit" disabled={!draft.trim()}><Search size={18} aria-hidden="true" /> Search</button>
          </div>
          <div className="gurbani-keyboard-options" role="group" aria-label="Keyboard choice">
            <button className="btn btn-ghost btn-sm" type="button" aria-pressed={showKeys} onClick={() => setKeyboard(false)}>
              <Keyboard size={17} aria-hidden="true" /> Punjabi keyboard
            </button>
            <button className="btn btn-ghost btn-sm" type="button" aria-label="English / phone keyboard" aria-pressed={phoneKeyboard} onClick={() => setKeyboard(true)}>
              English / phone
            </button>
          </div>
          {showKeys && <GurmukhiKeyboard onKey={editWithKey} />}
          {!query && (
            <p className="gurbani-examples">Try <button type="button" className="gurmukhi" lang="pa-Guru" onClick={() => submit('ਤੇਰਾ ਕੀਤਾ')}>ਤੇਰਾ ਕੀਤਾ</button> or <button type="button" onClick={() => submit('tera kita')}>tera kita</button>.</p>
          )}
        </form>

        {query && (
          <section className="gurbani-results" aria-labelledby="gurbani-results-title">
            <h2 id="gurbani-results-title" tabIndex={-1} ref={resultsHeading}>Search results</h2>
            {!currentResponse && <p role="status">Searching…</p>}
            {currentResponse?.error && <p role="alert">{currentResponse.error} <button className="gurbani-text-button" type="button" onClick={() => setAttempt((count) => count + 1)}>Try again</button></p>}
            {results && (
              <>
                <p role="status">{results.length ? `Shabads matching “${query}”` : `No shabads found for “${query}”. Try fewer words or a different spelling.`}</p>
                <ul className="gurbani-result-list">
                  {results.map((line) => {
                    const search = new URLSearchParams({ q: query, page, line: line.id });
                    return (
                      <li key={line.shabadId}>
                        <Link className="gurbani-result" to={`/gurbani/shabad/${line.shabadId}?${search}`}>
                          <span className="gurbani-result-ang">Ang {line.ang}</span>
                          <span lang="pa-Guru" className="gurmukhi gurbani-verse">{line.text}</span>
                          <span className="gurbani-roman" lang="pa-Latn">{line.roman}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {(page > 1 || currentResponse.data.hasMore) && (
                  <nav className="gurbani-pagination" aria-label="Search result pages">
                    <button className="btn btn-ghost btn-sm" type="button" disabled={page === 1} onClick={() => changePage(page - 1)}>Previous</button>
                    <span>Page {page}</span>
                    <button className="btn btn-ghost btn-sm" type="button" disabled={!currentResponse.data.hasMore} onClick={() => changePage(page + 1)}>Next</button>
                  </nav>
                )}
              </>
            )}
          </section>
        )}
        <SourceCredit />
      </div>
    </main>
  );
}

export function GurbaniShabad() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [response, setResponse] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const lineId = params.get('line');
  const back = new URLSearchParams(params);
  back.delete('line');

  useEffect(() => {
    const controller = new AbortController();
    api.gurbaniShabad(id, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setResponse({ data }); },
      (error) => { if (!controller.signal.aborted) setResponse({ error: error.message, missing: error.status === 404 }); },
    );
    return () => controller.abort();
  }, [id, attempt]);

  const lines = response?.data?.lines;
  const firstAng = lines?.[0].ang;
  const lastAng = lines?.at(-1).ang;

  return (
    <main className="page gurbani-page">
      <div className="container gurbani-container">
        <Link className="gurbani-back" to={{ pathname: '/gurbani', search: back.toString() }}>Back to Gurbani search</Link>
        <header className="gurbani-header">
          <h1>Shabad</h1>
          {lines && <p>Sri Guru Granth Sahib Ji · Ang {firstAng}{firstAng !== lastAng && `–${lastAng}`}</p>}
        </header>
        {!response && <p role="status">Loading shabad…</p>}
        {response?.error && (
          <p role="alert">{response.error} {!response.missing && <button className="gurbani-text-button" type="button" onClick={() => { setResponse(null); setAttempt((count) => count + 1); }}>Try again</button>}</p>
        )}
        {lines && (
          <article className="gurbani-shabad" aria-label="Full shabad">
            {lines.map((line) => (
              <div className={`gurbani-shabad-line${lineId === line.id ? ' gurbani-matched-line' : ''}`} key={line.id}>
                {lineId === line.id && <span className="gurbani-result-ang">Matching line · Ang {line.ang}</span>}
                <p lang="pa-Guru" className="gurmukhi gurbani-verse">{line.text}</p>
              </div>
            ))}
          </article>
        )}
        <SourceCredit />
      </div>
    </main>
  );
}
