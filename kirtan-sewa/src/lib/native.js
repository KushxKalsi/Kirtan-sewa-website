import { Capacitor } from '@capacitor/core';

/** True inside the Android / iOS app (Capacitor shell); false on the normal website. */
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'

/**
 * The server the app talks to. On the website it is the same origin (''), in the app it is the live site's address,
 * set when building: VITE_API_URL=https://your-site.onrender.com npm run build:app
 */
export const API_BASE = isNative ? (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') : '';

/** The public address used in shared links, bills and messages (the app's own origin is not shareable). */
export const SITE_ORIGIN = isNative ? API_BASE : window.location.origin;

/** Server-provided file links start with /api/…; in the app they must point at the live server. */
export const withBase = (value) => {
  if (!API_BASE) return value;
  if (typeof value === 'string') return value.startsWith('/api/') ? API_BASE + value : value;
  if (Array.isArray(value)) return value.map(withBase);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k in value) out[k] = withBase(value[k]);
    return out;
  }
  return value;
};
