import { api } from './api';
import { readStore, writeStore } from './storage';

const KEY = 'sewa.pushPhones';

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const permission = () => (pushSupported() ? Notification.permission : 'unsupported');

/** Phones this browser is already subscribed for (so we can show "notifications on"). */
export const subscribedFor = (phone) => readStore(KEY, []).includes(String(phone).replace(/\D/g, '').slice(-10));

const toKey = (base64) => {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** Must be called from a tap/click: asks permission, subscribes this browser, and links it to the phone number. */
export async function enableNotifications(phone) {
  if (!pushSupported()) {
    throw new Error(
      isIos() && !isStandalone()
        ? 'On iPhone: tap Share → “Add to Home Screen”, open the site from the new icon, then turn notifications on.'
        : 'This browser does not support notifications.',
    );
  }
  const result = await Notification.requestPermission();
  if (result !== 'granted') throw new Error('Notifications are blocked. Allow them for this site in your browser settings, then try again.');

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const { publicKey } = await api.pushKey();
  // Some browsers never answer if they can't reach their push service; don't spin forever.
  const subscribe = () =>
    Promise.race([
      reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 20000)),
    ]);
  let sub = await reg.pushManager.getSubscription();
  try {
    if (!sub) sub = await subscribe();
  } catch {
    try {
      // An old subscription made with different keys blocks a new one: replace it.
      await sub?.unsubscribe();
      sub = await subscribe();
    } catch {
      throw new Error('Your browser could not turn on notifications. If this is a private/incognito window, open the site in a normal window; otherwise check your internet connection and try again.');
    }
  }
  await api.pushSubscribe(phone, sub.toJSON());
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  writeStore(KEY, [...new Set([...readStore(KEY, []), digits])]);
}
