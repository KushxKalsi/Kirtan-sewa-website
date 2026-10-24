import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Monitor, Moon, Sun } from 'lucide-react';
import { getThemePref, setThemePref, watchSystemTheme } from '../lib/theme';

const NEXT = { system: 'light', light: 'dark', dark: 'system' };
const ICON = { system: Monitor, light: Sun, dark: Moon };
const LABEL = { system: 'Theme: auto (follows device)', light: 'Theme: light', dark: 'Theme: dark' };

export default function ThemeToggle({ className = '', showLabel = false }) {
  const [pref, setPref] = useState(getThemePref);
  useEffect(() => watchSystemTheme(), []);
  // Stay in sync with the other toggle (header vs. mobile menu).
  useEffect(() => {
    const sync = () => setPref(getThemePref());
    window.addEventListener('themechange', sync);
    return () => window.removeEventListener('themechange', sync);
  }, []);
  const Icon = ICON[pref];

  const cycle = () => {
    const next = NEXT[pref];
    setThemePref(next);
    setPref(next);
  };

  return (
    <button
      className={`theme-toggle ${showLabel ? 'btn btn-ghost btn-block' : 'icon-btn'} ${className}`}
      onClick={cycle}
      aria-label={`${LABEL[pref]}. Click to change.`}
      title={LABEL[pref]}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={pref}
          style={{ display: 'grid' }}
          initial={{ rotate: -120, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 120, scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Icon size={18} />
        </motion.span>
      </AnimatePresence>
      {showLabel && <span>{LABEL[pref]}</span>}
    </button>
  );
}
