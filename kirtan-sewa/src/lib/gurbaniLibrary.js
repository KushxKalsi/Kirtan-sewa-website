import { useSyncExternalStore } from 'react';
import { readStore, writeStore } from './storage';

const KEY = 'sewa.gurbani.library';
const HISTORY_LIMIT = 20;
const listeners = new Set();

function readLibrary(fallback = {}) {
  const { history, favourites } = readStore(KEY, fallback) || {};
  return {
    history: Array.isArray(history) ? history.filter((query) => typeof query === 'string' && query.trim()) : [],
    favourites: Array.isArray(favourites)
      ? favourites.filter((line) => line && typeof line.shabadId === 'string' && typeof line.text === 'string')
      : [],
  };
}

let library = readLibrary();

function publish(next) {
  library = next;
  listeners.forEach((listener) => listener());
}

function update(change) {
  const next = change(readLibrary(library));
  writeStore(KEY, next);
  publish(next);
}

window.addEventListener('storage', (event) => {
  if (event.key === KEY || event.key === null) publish(readLibrary());
});

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useGurbaniLibrary = () => useSyncExternalStore(subscribe, () => library);

const searchKey = (query) => query.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');

export function rememberGurbaniSearch(query) {
  const value = query.trim();
  if (!value) return;
  const key = searchKey(value);
  update(({ history, favourites }) => ({
    history: [value, ...history.filter((entry) => searchKey(entry) !== key)].slice(0, HISTORY_LIMIT),
    favourites,
  }));
}

export function clearGurbaniHistory() {
  update((current) => ({ ...current, history: [] }));
}

export function toggleGurbaniFavourite(line) {
  update(({ history, favourites }) => {
    const alreadySaved = favourites.some((entry) => entry.shabadId === line.shabadId);
    return {
      history,
      favourites: alreadySaved ? favourites.filter((entry) => entry.shabadId !== line.shabadId) : [line, ...favourites],
    };
  });
}
