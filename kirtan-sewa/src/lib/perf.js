import { useSyncExternalStore } from 'react';

/*
 * Low-end device mode. Mid and high-end devices get every effect; weak phones get the same
 * animations with the expensive paint work (blur, glass, film grain, SVG redraws) dropped.
 *
 * Decided from device hints at load, then confirmed by watching the real frame rate for a few
 * seconds. Override for testing with ?perf=low, ?perf=high or ?perf=auto (remembered).
 */
const KEY = 'sewa.perf';
const SESSION_KEY = 'sewa.perf.measured';
const listeners = new Set();

function read(store, key) {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}
function write(store, key, value) {
  try {
    if (value == null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function forcedMode() {
  const param = new URLSearchParams(window.location.search).get('perf');
  if (param === 'low' || param === 'high') write(localStorage, KEY, param);
  if (param === 'auto') write(localStorage, KEY, null);
  const saved = read(localStorage, KEY);
  return saved === 'low' || saved === 'high' ? saved : null;
}

function hintsSayLow() {
  const nav = navigator;
  if (nav.connection?.saveData) return true;
  if (nav.deviceMemory && nav.deviceMemory <= 2) return true; // Chrome/Android: 2 GB or less
  const touch = window.matchMedia('(pointer: coarse)').matches;
  return touch && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 4;
}

const forced = typeof window === 'undefined' ? 'high' : forcedMode();
let low = forced ? forced === 'low' : hintsSayLow() || read(sessionStorage, SESSION_KEY) === 'low';

function apply() {
  document.documentElement.classList.toggle('low-end', low);
}

function setLow(value) {
  if (low === value) return;
  low = value;
  apply();
  listeners.forEach((fn) => fn());
}

/** Watches ~2 s of frames once the page is visible; a median under ~40 fps switches to low-end. */
function watchFrameRate() {
  const frames = [];
  let last = 0;
  const started = performance.now();
  const tick = (t) => {
    if (document.visibilityState !== 'visible') {
      last = 0;
    } else {
      if (last && t - last < 250) frames.push(t - last); // longer gaps are pauses, not lag
      last = t;
    }
    if (frames.length >= 120) {
      frames.sort((a, b) => a - b);
      if (frames[frames.length >> 1] > 25) {
        write(sessionStorage, SESSION_KEY, 'low');
        setLow(true);
      }
      return;
    }
    if (t - started < 20000) requestAnimationFrame(tick);
  };
  // Skip the first moment of page start-up, which is slow on every device.
  setTimeout(() => requestAnimationFrame(tick), 1200);
}

if (typeof window !== 'undefined') {
  apply();
  if (!forced && !low) watchFrameRate();
}

export const isLowEnd = () => low;

/** Calls fn when the device gets switched to low-end mode; returns an unsubscribe function. */
export const onLowEndChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** True on weak devices. Re-renders if the frame-rate check downgrades the device. */
export function useLowEnd() {
  return useSyncExternalStore(onLowEndChange, isLowEnd, () => false);
}
