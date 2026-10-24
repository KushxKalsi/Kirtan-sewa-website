import { readStore, writeStore } from './storage';

const KEY = 'sewa.theme';
const META = { dark: '#070A14', light: '#FAF6EE' };
const media = () => window.matchMedia('(prefers-color-scheme: light)');

/** 'system' | 'light' | 'dark' */
export const getThemePref = () => {
  const t = readStore(KEY, 'system');
  return t === 'light' || t === 'dark' ? t : 'system';
};

export const resolvedTheme = () => document.documentElement.dataset.theme || (media().matches ? 'light' : 'dark');

function syncMeta() {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META[resolvedTheme()]);
  window.dispatchEvent(new Event('themechange'));
}

export function setThemePref(pref) {
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  writeStore(KEY, pref === 'system' ? null : pref);
  syncMeta();
}

// Keep the browser chrome colour right when the device theme flips while the page is open.
export function watchSystemTheme() {
  const mq = media();
  mq.addEventListener('change', syncMeta);
  syncMeta();
  return () => mq.removeEventListener('change', syncMeta);
}
