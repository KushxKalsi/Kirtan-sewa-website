/**
 * Site language: English, Punjabi or Hindi. The site is written in English; Punjabi and Hindi come from Google's
 * page translator, which is loaded only when one of them is chosen. The first visit follows the phone's language;
 * a choice made in the header is remembered on this device.
 */
import { readStore, writeStore } from './storage';

export const LANGS = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', short: 'ਪੰ' },
  { code: 'hi', label: 'हिन्दी', short: 'हि' },
];
const KEY = 'sewa.lang';
const known = (code) => LANGS.some((l) => l.code === code);

// The phone / browser language, when it is one we offer (e.g. "pa-IN" → pa); otherwise English.
function deviceLang() {
  const list = navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
  for (const tag of list) {
    const code = String(tag).toLowerCase().split('-')[0];
    if (known(code)) return code;
  }
  return 'en';
}

export const currentLang = () => {
  const saved = readStore(KEY, '');
  return known(saved) ? saved : deviceLang();
};

// Google's translator reads the language from this cookie (on the site and its parent domain).
function setCookie(code) {
  const host = window.location.hostname;
  const domains = ['', ...(host.includes('.') && !/^[\d.]+$/.test(host) ? [`; domain=.${host.split('.').slice(-2).join('.')}`, `; domain=${host}`] : [])];
  for (const d of domains) {
    document.cookie = code === 'en' ? `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d}` : `googtrans=/en/${code}; path=/${d}`;
  }
}

/** Switch language: remembered on this device, then the page reloads in it. */
export function setLang(code) {
  if (!known(code)) return;
  writeStore(KEY, code);
  setCookie(code);
  window.location.reload();
}

// Google wraps translated text in its own <font> tags, so React sometimes can't find a node it wants to remove or
// insert before. Without this the page would crash on the next update; with it the update is skipped quietly.
function tolerateTranslatedDom() {
  const remove = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    return child.parentNode === this ? remove.call(this, child) : child;
  };
  const insert = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (node, ref) {
    return ref && ref.parentNode !== this ? node : insert.call(this, node, ref);
  };
}

// Text that must stay as it is: Gurbani / Gurmukhi names, booking IDs, UPI IDs, codes.
const KEEP = '.gurmukhi, .brand-name, code, .bc-ref, .pay-upi-id, [lang="pa"], .lang-switch';
function keepOriginal(root = document) {
  root.querySelectorAll?.(KEEP).forEach((el) => el.getAttribute('translate') !== 'no' && el.setAttribute('translate', 'no'));
}

/** Called once before the app renders: loads the translator when the language isn't English. */
export function startTranslation() {
  const lang = currentLang();
  document.documentElement.dataset.lang = lang;
  setCookie(lang);
  if (lang === 'en') return;
  tolerateTranslatedDom();
  keepOriginal();
  new MutationObserver((changes) => changes.forEach((c) => c.addedNodes.forEach((n) => n.nodeType === 1 && (n.matches?.(KEEP) ? n.setAttribute('translate', 'no') : keepOriginal(n))))).observe(document.body, { childList: true, subtree: true });
  const holder = document.createElement('div');
  holder.id = 'google_translate_element';
  holder.hidden = true;
  document.body.appendChild(holder);
  window.googleTranslateElementInit = () => {
    // eslint-disable-next-line no-new
    new window.google.translate.TranslateElement({ pageLanguage: 'en', includedLanguages: LANGS.map((l) => l.code).join(','), autoDisplay: false }, 'google_translate_element');
  };
  const script = document.createElement('script');
  script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  script.async = true;
  document.head.appendChild(script);
}
