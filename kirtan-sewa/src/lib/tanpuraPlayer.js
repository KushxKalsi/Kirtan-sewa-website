// The tanpura keeps playing while you move around the site (Gurbani pages, other dashboard tabs…).
// This tiny store is all the rest of the app needs to know about it: whether it's playing, what it's playing,
// and how to stop it. The engine itself lives in the (lazy-loaded) Tanpura tab and registers here.
import { useSyncExternalStore } from 'react';

let state = { playing: false, label: '', panelOpen: false };
let controls = { stop: () => {} };
const listeners = new Set();

export function setTanpuraPlayer(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export function registerTanpuraControls(next) {
  controls = next;
}

export function stopTanpura() {
  controls.stop();
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const useTanpuraPlayer = () => useSyncExternalStore(subscribe, () => state);
