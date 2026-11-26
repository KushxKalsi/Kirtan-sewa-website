import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Languages } from 'lucide-react';
import { GURBANI_DISPLAY, GURBANI_DISPLAY_LIMIT } from '../../shared/gurbani';
import { api } from '../lib/api';
import { readStore, writeStore } from '../lib/storage';
import GurbaniText from './GurbaniText';
import Modal from './Modal';

const STORAGE_KEY = 'sewa.gurbani.readingLanguages';
const OPTIONS = Object.entries(GURBANI_DISPLAY);
const LanguageContext = createContext({ languages: [] });
const DisplayContext = createContext(null);

export function GurbaniLanguageProvider({ children }) {
  const [languages, setLanguages] = useState(() => {
    const saved = readStore(STORAGE_KEY, []);
    return Array.isArray(saved) ? OPTIONS.map(([id]) => id).filter((id) => saved.includes(id)) : [];
  });
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  function toggleLanguage(chosen) {
    const next = OPTIONS.map(([id]) => id).filter((id) => id === chosen ? !languages.includes(id) : languages.includes(id));
    setLanguages(next);
    writeStore(STORAGE_KEY, next);
  }

  return (
    <LanguageContext.Provider value={{ languages, openLanguages: () => setOpen(true) }}>
      {children}
      <Modal open={open} onClose={close} title="Reading languages" subtitle="Show translations and transliterations alongside the original Gurbani.">
        <div className="gurbani-language-options">
          {[true, false].map((translation) => (
            <fieldset key={String(translation)}>
              <legend>{translation ? 'Translations' : 'Transliterations'}</legend>
              {OPTIONS.filter(([, option]) => Boolean(option.translation) === translation).map(([id, option]) => (
                <label key={id} className="gurbani-language-option">
                  <input type="checkbox" autoFocus={id === 'pa'} checked={languages.includes(id)} onChange={() => toggleLanguage(id)} />
                  <span lang={option.lang} dir={option.rtl ? 'rtl' : undefined} className={id === 'pa' ? 'gurmukhi' : undefined}>{option.label}</span>
                  {option.label !== option.name && <small>{option.name}</small>}
                </label>
              ))}
            </fieldset>
          ))}
          <button type="button" className="btn btn-primary btn-sm" onClick={close}>Done</button>
        </div>
      </Modal>
    </LanguageContext.Provider>
  );
}

export function GurbaniLanguageButton({ sidebar = false, onOpen }) {
  const { openLanguages } = useContext(LanguageContext);
  return (
    <button type="button" className={sidebar ? 'gurbani-sidebar-language' : 'btn btn-ghost btn-sm gurbani-language-button'}
      aria-label="Reading languages" aria-haspopup="dialog" onClick={() => { onOpen?.(); openLanguages(); }}>
      <Languages size={19} aria-hidden="true" /> <span>Languages</span>
    </button>
  );
}

export function GurbaniReadingDisplay({ ids = [], hasRoman = false, children }) {
  const { languages } = useContext(LanguageContext);
  const requested = languages.filter((id) => id !== 'roman' || !hasRoman).join(',');
  const lineKey = ids.filter((id) => typeof id === 'string' && /^[a-z0-9]{4}$/i.test(id)).join(',');
  const [response, setResponse] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${requested}:${lineKey}:${attempt}`;

  useEffect(() => {
    if (!requested || !lineKey) return;
    const controller = new AbortController();
    async function load() {
      const uniqueIds = [...new Set(lineKey.split(','))];
      const languages = requested.split(',');
      const lines = {};
      const sources = {};
      for (let i = 0; i < uniqueIds.length; i += GURBANI_DISPLAY_LIMIT) {
        const result = await api.gurbaniReadingDisplay(uniqueIds.slice(i, i + GURBANI_DISPLAY_LIMIT), languages, controller.signal);
        Object.assign(lines, result.lines);
        Object.assign(sources, result.sources);
      }
      if (!controller.signal.aborted) setResponse({ key, lines, sources });
    }
    load().catch(() => { if (!controller.signal.aborted) setResponse({ key, error: true }); });
    return () => controller.abort();
  }, [key, lineKey, requested]);

  const current = response?.key === key ? response : null;
  const byLine = current?.lines;
  const selected = requested ? requested.split(',') : [];
  const missing = byLine && selected.flatMap((id) => {
    const available = ids.filter((line) => byLine[line]?.[id]).length;
    return available < ids.length ? [`${GURBANI_DISPLAY[id].name} · ${available} of ${ids.length} lines`] : [];
  });
  const credits = current?.sources && Object.values(current.sources);

  return (
    <DisplayContext.Provider value={current}>
      {requested && lineKey && !current && <p className="gurbani-reading-note" role="status">Loading reading languages…</p>}
      {current?.error && <p className="gurbani-reading-note" role="status">Reading languages could not load. <button type="button" className="gurbani-text-button" onClick={() => setAttempt((count) => count + 1)}>Try again</button></p>}
      {missing?.length > 0 && <p className="gurbani-reading-note" role="status">{missing.join(' · ')} with a published entry.{current.sources[7] && ' Some English entries explain the whole preceding stanza.'}</p>}
      {credits?.length > 0 && <p className="gurbani-reading-note">Translations by {credits.join(', ')}.</p>}
      {children}
    </DisplayContext.Provider>
  );
}

export function GurbaniReadingExtras({ id, roman, romanShown = false }) {
  const display = useContext(DisplayContext);
  const { languages } = useContext(LanguageContext);
  return languages.map((language) => {
    if (language === 'roman' && romanShown) return null;
    const item = language === 'roman' && roman ? roman : display?.lines?.[id]?.[language];
    if (!item) return null;
    const option = GURBANI_DISPLAY[language];
    const [text, source] = Array.isArray(item) ? item : [item];
    return (
      <span key={language} className={`gurbani-reading-extra${option.translation ? ' gurbani-translation' : ''}${language === 'pa' ? ' gurmukhi' : ''}`}
        lang={option.lang} dir={option.rtl ? 'rtl' : undefined} title={source ? display.sources[source] : option.name}>
        {option.translation ? text : <GurbaniText text={text} />}
      </span>
    );
  });
}
