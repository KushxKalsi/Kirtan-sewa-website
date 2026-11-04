import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Languages } from 'lucide-react';
import { LANGS, currentLang, setLang } from '../lib/lang';

/** Header language menu: English, ਪੰਜਾਬੀ, हिन्दी. `block` shows it as a row of buttons (phone menu). */
export default function LanguageSwitch({ block = false, className = '' }) {
  const lang = currentLang();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const now = LANGS.find((l) => l.code === lang);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  if (block) {
    return (
      <div className={`lang-switch lang-row ${className}`} translate="no" role="radiogroup" aria-label="Language">
        <Languages size={18} />
        {LANGS.map((l) => (
          <button key={l.code} type="button" role="radio" aria-checked={l.code === lang} className={l.code === lang ? 'active' : ''} onClick={() => l.code !== lang && setLang(l.code)}>
            {l.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`lang-switch ${className}`} ref={ref} translate="no">
      <button type="button" className="icon-btn lang-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Language: ${now.label}`} title="Language / ਭਾਸ਼ਾ / भाषा">
        <Languages size={16} />
        <span>{now.short}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul className="lang-menu glass" role="listbox" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            {LANGS.map((l) => (
              <li key={l.code}>
                <button type="button" role="option" aria-selected={l.code === lang} onClick={() => (l.code === lang ? setOpen(false) : setLang(l.code))}>
                  <span>{l.label}</span>
                  {l.code === lang && <Check size={15} />}
                </button>
              </li>
            ))}
            <li className="lang-note">Punjabi and Hindi are translated automatically by Google.</li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
