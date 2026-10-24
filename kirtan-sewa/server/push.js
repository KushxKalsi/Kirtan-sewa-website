import webpush from 'web-push';
import { db, save } from './db.js';

// Browser push notifications (Web Push). Keys are created once and kept in the database,
// so subscriptions stay valid across restarts and deploys.
const MAX_PER_PHONE = 5;
export const phoneKey = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

export async function initPush() {
  if (!db.meta.vapid?.publicKey) {
    db.meta.vapid = webpush.generateVAPIDKeys();
    await save();
  }
}

export const pushPublicKey = () => db.meta.vapid.publicKey;

function configure() {
  const email = db.settings.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(db.settings.email) ? db.settings.email : 'sewa@example.com';
  webpush.setVapidDetails(`mailto:${email}`, db.meta.vapid.publicKey, db.meta.vapid.privateKey);
}

export async function addSubscription(phone, sub) {
  const key = phoneKey(phone);
  const clean = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, at: new Date().toISOString() };
  const list = (db.pushSubs[key] || []).filter((s) => s.endpoint !== clean.endpoint);
  list.push(clean);
  db.pushSubs[key] = list.slice(-MAX_PER_PHONE);
  await save();
}

export const hasSubscription = (phone) => (db.pushSubs[phoneKey(phone)] || []).length > 0;

/**
 * Sends a notification to every device that subscribed with this phone number.
 * Never throws: a failed notification must not break the admin action that triggered it.
 */
export async function notifyPhone(phone, { title, body, url, tag }) {
  const key = phoneKey(phone);
  const subs = db.pushSubs[key] || [];
  if (!subs.length) return 0;
  configure();
  const payload = JSON.stringify({ title, body, url, tag });
  const dead = new Set();
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(s, payload, { TTL: 60 * 60 * 24 * 3, urgency: 'high' });
        sent++;
      } catch (e) {
        // 404/410: the browser unsubscribed or the subscription expired.
        if (e.statusCode === 404 || e.statusCode === 410) dead.add(s.endpoint);
        else console.error(`[sewa] Push failed (${e.statusCode || e.code || 'error'}):`, e.body || e.message);
      }
    }),
  );
  if (dead.size) {
    db.pushSubs[key] = (db.pushSubs[key] || []).filter((s) => !dead.has(s.endpoint));
    if (!db.pushSubs[key].length) delete db.pushSubs[key];
    await save().catch(() => {});
  }
  return sent;
}
