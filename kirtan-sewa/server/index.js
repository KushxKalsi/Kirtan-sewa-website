import './tz.js';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, save, uid, makeRef, slugify, DATA_DIR, initDb, kv } from './db.js';
import { initPush, pushPublicKey, addSubscription, notifyPhone, addAdminSubscription, removeAdminSubscription, adminDeviceCount, notifyAdmins, addPublicSubscription, notifyEveryone, everyoneCount } from './push.js';
import { GURPURAB_KINDS } from './gurpurabs.js';
import { checkPassword, hashPassword, passwordProblem, sessions } from './auth.js';
import { reversePlace, searchPlaces } from './geo.js';
import { format, subMonths } from 'date-fns';

await initDb();
await initPush();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5174;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'waheguru';
const SECRET = process.env.TOKEN_SECRET || db.meta.secret;
const TOKEN_TTL = 1000 * 60 * 60 * 12; // 12 hours
const auth = sessions(SECRET); // customer and team member logins

if (!process.env.ADMIN_PASSWORD) {
  console.warn('[sewa] ADMIN_PASSWORD not set — using default "waheguru". Set it before going live.');
}

if (db.settings.upiQrFile) {
  const old = path.join(DATA_DIR, 'uploads', db.settings.upiQrFile);
  if (fs.existsSync(old)) {
    const ext = path.extname(old).slice(1);
    await kv.set('upi-qr', { type: ext === 'jpg' ? 'image/jpeg' : `image/${ext}`, data: fs.readFileSync(old).toString('base64') });
  }
  delete db.settings.upiQrFile;
  await save();
}

const app = express();
const QR_PATH = '/api/admin/upi-qr';
const GP_IMAGE_PATH = '/api/admin/gurpurab-images';
const DOC_PATH = '/api/team/documents/';
const TEAM_SIGNUP_PATH = '/api/auth/register-team';
const smallJson = express.json({ limit: '300kb' });
// Image uploads (UPI QR, Gurpurab pictures, team documents and sign-ups with them) get their own larger body limit.
const bigBody = (path) => path === QR_PATH || path === GP_IMAGE_PATH || path === TEAM_SIGNUP_PATH || path.startsWith(DOC_PATH);
app.use((req, res, next) => (bigBody(req.path) ? next() : smallJson(req, res, next)));


/* ---------------- helpers ---------------- */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};

const pad = (n) => String(n).padStart(2, '0');
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const nowHHMM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const addDaysKey = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const digits = (p) => String(p || '').replace(/\D/g, '');
const samePhone = (a, b) => {
  const x = digits(a);
  const y = digits(b);
  return x.length >= 7 && y.length >= 7 && x.slice(-10) === y.slice(-10);
};
const isActive = (b) => b.status === 'pending' || b.status === 'confirmed';
const phoneKey = (p) => digits(p).slice(-10);
const ownsBooking = (user, b) => b.userId === user.id || (!b.userId && samePhone(b.phone, user.phone));

// Team roles within a jatha.
const ROLES = { 'head-ragi': 'Head Ragi', 'side-ragi': 'Side Ragi', tabla: 'Tabla' };
// Documents a team member uploads to their profile.
const DOC_KINDS = { headPhoto: 'Jatha head photo', jathaPhoto: 'Jatha photo', aadhaar: 'Aadhaar card', bankProof: 'Bank passbook / cancelled cheque' };
// Documents a new team member must add when they sign up (the rest can follow from their profile).
const SIGNUP_DOCS_REQUIRED = ['aadhaar'];
// An uploaded document as a data: URL -> { type, data (base64) }.
function readDoc(dataUrl) {
  const match = /^data:(image\/(?:png|jpeg|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) fail(400, 'Please upload a photo (JPG, PNG, WebP) or a PDF.');
  if (Buffer.byteLength(match[2], 'base64') > 5 * 1024 * 1024) fail(400, 'File is too large (max 5 MB).');
  return { type: match[1], data: match[2] };
}

// A place picked on the map: { lat, lng, label }, or null.
function readLocation(v) {
  if (!v) return null;
  // An address typed by hand when the place can't be found on the map: no pin, just the text.
  if ((v.lat == null || v.lat === '') && (v.lng == null || v.lng === '')) {
    const label = str(v.label, 300);
    if (label.length < 5) fail(400, 'Please type the full address, or pick the place on the map.');
    return { label, manual: true };
  }
  const lat = Number(v.lat);
  const lng = Number(v.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) fail(400, 'That map location is not valid. Please pick it again.');
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, label: str(v.label, 300) };
}
// Bookings never block a time: several requests (and bookings) may share one. A time is only
// unavailable when the admin blocks it on purpose (blockedTimes) or blocks the whole date.
const isBooked = (b) => b.status === 'confirmed' || b.status === 'completed';

const publicSettings = () => {
  const { ...s } = db.settings;
  return s;
};

const sign = (payload) => crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
const makeToken = () => {
  const exp = String(Date.now() + TOKEN_TTL);
  return `${exp}.${sign(exp)}`;
};
const verifyToken = (token) => {
  if (typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = Buffer.from(sign(exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
};

const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
const requireAdmin = (req, _res, next) => {
  if (!verifyToken(bearer(req))) fail(401, 'Please log in again.');
  next();
};

// A customer or team member session; a changed password (new version) ends the old ones.
function sessionOf(req) {
  const s = auth.read(bearer(req));
  if (s?.role === 'user') {
    const user = db.users.find((u) => u.id === s.id);
    return user && (user.tokenVersion || 0) === s.version ? { role: 'user', user } : null;
  }
  if (s?.role === 'member') {
    const person = db.people.find((p) => p.id === s.id);
    return person && person.passwordHash && !person.pending && (person.tokenVersion || 0) === s.version ? { role: 'member', person } : null;
  }
  return null;
}
const requireUser = (req, _res, next) => {
  const s = sessionOf(req);
  if (s?.role !== 'user') fail(401, 'Please log in to continue.');
  req.user = s.user;
  next();
};
const requireMember = (req, _res, next) => {
  const s = sessionOf(req);
  if (s?.role !== 'member') fail(401, 'Please log in again.');
  req.person = s.person;
  next();
};

// Very small in-memory throttle for the login endpoint.
const attempts = new Map();
const throttle = (key, max = 10) => {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((t) => now - t < 15 * 60 * 1000);
  if (list.length >= max) fail(429, 'Too many attempts. Try again in a few minutes.');
  list.push(now);
  attempts.set(key, list);
};

// Bookings are fixed slots or a customer's own time ("custom").
const CUSTOM = 'custom';
const rangeOf = (b) => (b.slotTime || '').split('–').map((t) => t.trim());
const overlaps = (s1, e1, s2, e2) => s1 < e2 && s2 < e1; // HH:MM strings compare correctly
const blockedAt = (date, start, end) => (db.blockedTimes || []).find((t) => t.date === date && overlaps(start, end, t.start, t.end));

const customerView = (b) => ({
  ref: b.ref,
  serviceId: b.serviceId,
  serviceName: b.serviceName,
  categoryName: b.categoryName || '',
  date: b.date,
  slotId: b.slotId,
  slotLabel: b.slotLabel,
  slotTime: b.slotTime,
  name: b.name,
  address: b.address,
  notes: b.notes,
  status: b.status,
  cancelReason: b.cancelReason,
  cancelledBy: b.cancelledBy,
  cancelledAt: b.cancelledAt,
  createdAt: b.createdAt,
  paymentMethod: b.paymentMethod || '',
  paymentStatus: b.paymentStatus || 'unpaid',
  amount: b.amount ?? null,
  billNo: b.billNo || '',
  billedAt: b.billedAt || '',
  utr: b.utr || '',
  paidAt: b.paidAt || '',
  phone: b.phone,
  groupId: b.groupId || '',
  cancelRequest: b.cancelRequest || null,
  location: b.location || null,
  offer: b.offer || null,
  team: teamView(b),
});

// Who is doing the sewa, with where they are based (read from the team list, so edits show up).
const personOf = (id) => (db.people || []).find((p) => p.id === id);
const teamView = (b) =>
  (b.assignees || []).map((a) => ({ name: personOf(a.id)?.name || a.name, address: personOf(a.id)?.address || '', role: ROLES[personOf(a.id)?.role] || '' }));

// What a team member sees for a booking they are (or were) assigned to. Only their own pay is shown.
const dutyView = (b, person) => {
  const mine = (b.assignees || []).find((a) => a.id === person.id) || {};
  const payRequest = db.messages.findLast((m) => m.kind === 'pay-request' && m.bookingId === b.id && m.thread === threadOf('m', person.id));
  return {
    id: b.id,
    ref: b.ref,
    serviceName: b.serviceName,
    categoryName: b.categoryName || '',
    date: b.date,
    slotId: b.slotId,
    slotLabel: b.slotLabel,
    slotTime: b.slotTime,
    status: b.status,
    name: b.name,
    phone: b.phone,
    address: b.address,
    location: b.location || null,
    notes: b.notes,
    cancelReason: b.status === 'cancelled' ? b.cancelReason : '',
    with: teamView({ assignees: (b.assignees || []).filter((a) => a.id !== person.id) }).map((t) => (t.role ? `${t.name} (${t.role})` : t.name)),
    pay: mine.pay ?? null,
    state: mine.state || 'assigned',
    confirmedAt: mine.confirmedAt || '',
    cancelRequest: mine.cancelRequest || null,
    payRequest: payRequest?.status === 'pending' ? { amount: payRequest.amount, at: payRequest.at } : null,
  };
};

const readAmount = (value) => {
  const amount = Math.round(Number(value) || 0);
  if (amount <= 0 || amount > 10000000) fail(400, 'Please enter the amount in rupees.');
  return amount;
};

/* ---------------- public API ---------------- */

// Active categories that still contain at least one active sewa (what visitors can choose from).
const publicCategories = () => {
  const activeIds = new Set(db.services.filter((s) => s.active).map((s) => s.id));
  return (db.categories || [])
    .filter((c) => c.active)
    .map((c) => ({ ...c, serviceIds: c.serviceIds.filter((id) => activeIds.has(id)) }))
    .filter((c) => c.serviceIds.length);
};

// Who may be assigned to a booking: active people with a matching skill (sewa, in that category).
const canDo = (person, b) => person.active && (person.skills || []).some((k) => k.serviceId === b.serviceId && (!b.categoryId || k.categoryId === b.categoryId));

app.get('/api/public', async (_req, res) => {
  res.json({
    settings: publicSettings(),
    categories: publicCategories(),
    services: db.services.filter((s) => s.active),
    slots: db.slots,
    blockedDates: db.blockedDates,
    gurpurabs: upcomingGurpurabs().map(publicGurpurab),
    today: todayKey(),
    now: nowHHMM(),
  });
});

app.get('/api/availability', async (req, res) => {
  const from = str(req.query.from, 10);
  const to = str(req.query.to, 10);
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) fail(400, 'Invalid date range.');
  const booked = db.bookings
    .filter((b) => isBooked(b) && b.date >= from && b.date <= to)
    // Public on purpose: visitors can see what each slot is booked for and where.
    .map((b) => ({ date: b.date, slotId: b.slotId, time: b.slotTime, serviceId: b.serviceId, serviceName: b.serviceName, location: b.address }));
  const blockedTimes = (db.blockedTimes || []).filter((t) => t.date >= from && t.date <= to).map(({ date, start, end, label }) => ({ date, start, end, label }));
  res.json({ booked, blockedDates: db.blockedDates, blockedTimes, today: todayKey(), now: nowHHMM() });
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (d) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const MAX_ITEMS = 20;

const rupee = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const readSubscription = (sub) => {
  const valid =
    typeof sub?.endpoint === 'string' && sub.endpoint.startsWith('https://') && sub.endpoint.length < 1000 && typeof sub.keys?.p256dh === 'string' && typeof sub.keys?.auth === 'string';
  if (!valid) fail(400, 'This browser sent an invalid notification subscription.');
  return sub;
};

// Tells the admin's devices about a customer action; tapping it opens /admin with that booking searched.
function tellAdmin(kind, title, body, search) {
  const url = search ? `/admin?q=${encodeURIComponent(search)}` : '/admin';
  notifyAdmins({ title, body, url, tag: `admin-${kind}-${search || Date.now()}` }).catch(() => {});
}
const range12 = (b) => rangeOf(b).map(to12).join(' – ');
// "Evening" for a fixed slot, the actual time for a custom one.
const slotName = (b) => (b.slotId === CUSTOM ? range12(b) : b.slotLabel);
// Always with the clock time, for the team: "Evening (6:00 PM – 9:00 PM)" or "7:30 PM – 9:00 PM".
const timeText = (b) => (b.slotId === CUSTOM ? range12(b) : `${b.slotLabel} (${range12(b)})`);
const slotText = (b) => `${b.serviceName}${b.categoryName ? ` (${b.categoryName})` : ''} · ${shortDate(b.date)}, ${slotName(b)}`;

// Sends a phone notification about a booking (if the customer allowed notifications). Never blocks the request.
function notifyBooking(b, kind) {
  const when = `${b.serviceName} · ${shortDate(b.date)}, ${slotName(b)}`;
  const pay = b.paymentMethod === 'cash' ? 'pay in cash on the day.' : b.paymentMethod === 'upi' ? 'tap to pay by UPI.' : 'tap to see your bill.';
  const messages = {
    confirmed: { title: 'Booking confirmed 🙏', body: `${when}. Bill ${rupee(b.amount)} — ${pay}` },
    billUpdated: { title: 'Bill updated', body: `${when}: the amount is now ${rupee(b.amount)}.` },
    paid: { title: 'Payment received ✅', body: `${rupee(b.amount)} for ${when}. Waheguru Ji, thank you!` },
    cancelled: { title: 'Booking cancelled', body: `${when} was cancelled. Reason: ${b.cancelReason}` },
    requestApproved: { title: 'Cancellation approved', body: `${when} is now cancelled.` },
    requestRejected: { title: 'Cancellation not accepted', body: `${when} is still booked.${b.cancelRequest?.note ? ` “${b.cancelRequest.note}”` : ''}` },
    team: { title: 'Your sewa team 🙏', body: `${teamView(b).map((t) => t.name).join(', ')} will do ${when}.` },
  };
  notifyPhone(b.phone, { ...messages[kind], url: '/account', tag: `${b.ref}-${kind}` }).catch(() => {});
}

/* ---------- team member notifications ---------- */

function to12(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}
const slotStartOf = (b) => (b.slotTime || '').slice(0, 5);

// When the two reminders go out: on the day at 6 AM (or 8 PM the evening before for early
// slots, so it never lands after the 2-hour one) and 2 hours before the slot starts.
function reminderTimes(b) {
  const start = slotStartOf(b);
  if (!DATE_RE.test(b.date) || !TIME_RE.test(start)) return null;
  const startAt = new Date(`${b.date}T${start}:00`).getTime();
  const soon = startAt - 2 * 60 * 60 * 1000;
  let day = new Date(`${b.date}T06:00:00`).getTime();
  const evening = day >= soon;
  if (evening) day = new Date(`${b.date}T06:00:00`).getTime() - 10 * 60 * 60 * 1000; // 8 PM the day before
  return { start: startAt, soon, day, evening };
}

function notifyPerson(person, kind, b, extra = {}) {
  if (!person?.phone) return;
  const time = to12(slotStartOf(b));
  const when = timeText(b);
  const what = `${b.serviceName}${b.categoryName ? ` (${b.categoryName})` : ''}`;
  const at = `at ${b.address}`;
  const messages = {
    assigned: { title: 'New sewa duty 🙏', body: `${what} · ${shortDate(b.date)}, ${when} ${at}.` },
    unassigned: { title: 'Sewa duty removed', body: `You are no longer assigned to ${what} on ${shortDate(b.date)}, ${when}.` },
    cancelled: { title: 'Sewa cancelled', body: `${what} on ${shortDate(b.date)}, ${when} ${at} has been cancelled.` },
    day: { title: extra.evening ? 'Sewa tomorrow 🙏' : 'Sewa today 🙏', body: `${what} · ${when} ${at}. Customer: ${b.name}, ${b.phone}.` },
    soon: { title: `Sewa starts at ${time} ⏰`, body: `${what} ${at}. Customer: ${b.name}, ${b.phone}.` },
    pay: { title: 'Sewa bhet updated', body: `${what} on ${shortDate(b.date)}: you will get ${rupee(extra.pay || 0)}.` },
    cancelApproved: { title: 'Duty cancellation approved', body: `You are no longer doing ${what} on ${shortDate(b.date)}, ${when}.` },
    cancelRejected: { title: 'Duty cancellation not accepted', body: `Please do ${what} on ${shortDate(b.date)}, ${when}.${extra.note ? ` “${extra.note}”` : ''}` },
  };
  notifyPhone(person.phone, { ...messages[kind], url: '/team', tag: `${b.ref}-${person.id}-${kind}` }).catch(() => {});
}

const remindedFor = (b, personId) => ((b.reminded ||= {})[personId] ||= {});

// The admin usually ticks people one at a time, so wait until the choice settles before notifying.
const TEAM_NOTIFY_DELAY = Number(process.env.TEAM_NOTIFY_DELAY_MS) || 30 * 1000;
const pendingTeam = new Map(); // booking id -> { before, timer }

function teamChanged(b, before) {
  const entry = pendingTeam.get(b.id) || { before };
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => flushTeam(b.id, entry.before).catch((e) => console.error('[sewa] Team notify failed:', e)), TEAM_NOTIFY_DELAY);
  pendingTeam.set(b.id, entry);
}

async function flushTeam(id, before) {
  pendingTeam.delete(id);
  const b = db.bookings.find((x) => x.id === id);
  if (!b || !isActive(b)) return;
  const now = (b.assignees || []).map((a) => a.id);
  const added = now.filter((x) => !before.includes(x));
  const removed = before.filter((x) => !now.includes(x));
  if (!added.length && !removed.length) return;
  const t = reminderTimes(b);
  for (const pid of added) {
    notifyPerson(personOf(pid), 'assigned', b);
    // The "new duty" message already has the time, so skip reminders that are already due.
    const done = remindedFor(b, pid);
    if (t && Date.now() >= t.day) done.day = true;
    if (t && Date.now() >= t.soon) done.soon = true;
  }
  for (const pid of removed) notifyPerson(personOf(pid), 'unassigned', b);
  if (now.length) notifyBooking(b, 'team');
  await save();
}

const notifyTeamCancelled = (b) => (b.assignees || []).forEach((a) => notifyPerson(personOf(a.id), 'cancelled', b));

async function sendReminders() {
  const now = Date.now();
  const today = todayKey();
  const tomorrow = addDaysKey(1);
  let changed = false;
  for (const b of db.bookings) {
    if (!isActive(b) || b.date < today || b.date > tomorrow || !(b.assignees || []).length || pendingTeam.has(b.id)) continue;
    const t = reminderTimes(b);
    if (!t || now >= t.start) continue;
    for (const a of b.assignees) {
      const person = personOf(a.id);
      if (!person?.phone) continue;
      const done = remindedFor(b, a.id);
      const kind = now >= t.soon ? 'soon' : now >= t.day ? 'day' : null;
      if (!kind || done[kind]) continue;
      done.day = true;
      if (kind === 'soon') done.soon = true;
      notifyPerson(person, kind, b, t);
      changed = true;
    }
  }
  if (changed) await save();
}

const enabledPaymentMethods = () => [db.settings.upiEnabled && db.settings.upiId && 'upi', db.settings.cashEnabled && 'cash'].filter(Boolean);
// Customers pick UPI or cash; when no payment option is switched on, nothing is asked.
function readPaymentChoice(value) {
  const methods = enabledPaymentMethods();
  if (!methods.length) return '';
  if (!methods.includes(value)) fail(400, `Please choose how you would like to pay (${methods.map((m) => (m === 'upi' ? 'UPI' : 'cash')).join(' or ')}).`);
  return value;
}

// Checks one requested sewa/date/slot and returns what is needed to create it.
function readItem(item) {
  const service = db.services.find((s) => s.id === item?.serviceId && s.active);
  if (!service) fail(400, 'Please choose a sewa for every selected slot.');
  const date = str(item.date, 10);
  if (!DATE_RE.test(date)) fail(400, 'Please choose a valid date.');
  const custom = item.slotId === CUSTOM;
  let slot;
  if (custom) {
    if (db.settings.customTimeEnabled === false) fail(400, 'Custom times are not available — please choose one of the time slots.');
    const start = str(item.start, 5);
    const end = str(item.end, 5);
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) fail(400, 'Please enter a start and end time.');
    const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    if (minutes(end) - minutes(start) < 30) fail(400, `${shortDate(date)}: the end time must be at least 30 minutes after the start.`);
    slot = { id: CUSTOM, label: 'Custom time', start, end };
  } else {
    slot = db.slots.find((s) => s.id === item.slotId);
    if (!slot) fail(400, 'Please choose a time slot.');
  }
  const label = `${shortDate(date)}, ${custom ? `${to12(slot.start)} – ${to12(slot.end)}` : slot.label}`;
  if (date < todayKey()) fail(400, `${label}: that date has already passed.`);
  if (date > addDaysKey(Number(db.settings.maxAdvanceDays) || 365)) fail(400, `${label}: that date is too far ahead to book yet.`);
  if (db.blockedDates.includes(date)) fail(409, `${shortDate(date)}: the jatha is not available on that date.`);
  if (!custom && service.allowedSlots?.length && !service.allowedSlots.includes(slot.id)) fail(400, `${label}: ${service.name} is not offered in this slot.`);
  if (date === todayKey() && slot.start <= nowHHMM()) fail(400, `${label}: that time slot has already started.`);
  if (blockedAt(date, slot.start, slot.end)) fail(409, `${label}: the jatha is not available at that time. Please remove it and pick another time.`);
  let category = null;
  const categories = publicCategories();
  if (categories.length) {
    category = categories.find((c) => c.id === item.categoryId);
    if (!category) fail(400, 'Please choose the type of kirtan (category) for every selected slot.');
    if (!category.serviceIds.includes(service.id)) fail(400, `${label}: ${service.name} is not available in ${category.name}.`);
  }
  return { service, category, date, slot };
}

// What a customer offers to pay (optional): from settings.offerMin rupees.
function readOffer(value, note) {
  if (value === undefined || value === null || value === '') return null;
  const amount = Math.round(Number(value) || 0);
  const min = Number(db.settings.offerMin) || 0;
  if (amount < min || amount > 10000000) fail(400, `Your offer must be at least ${rupee(min)}.`);
  return { amount, note: str(note, 300), status: 'pending', at: new Date().toISOString() };
}

// Accepts one slot ({ serviceId, date, slotId }) or several ({ items: [...] }) with one set of contact details.
// Booking needs a customer login; the booking is linked to that account and its mobile number.
app.post('/api/bookings', requireUser, async (req, res) => {
  const body = req.body || {};
  const requested = Array.isArray(body.items) ? body.items : [body];
  if (!requested.length) fail(400, 'Please choose at least one time slot.');
  if (requested.length > MAX_ITEMS) fail(400, `You can book up to ${MAX_ITEMS} slots at once.`);

  // Validate everything first so either all slots are booked or none are.
  const items = requested.map(readItem);
  // Different sewas may share a time (e.g. Kirtan Diwan and Aarti in one evening); the same one twice is a mistake.
  const seen = new Set();
  for (const it of items) {
    const key = [it.date, it.slot.start, it.slot.end, it.service.id, it.category?.id].join('|');
    if (seen.has(key)) fail(400, `${shortDate(it.date)}: ${it.service.name} is selected twice for the same time.`);
    seen.add(key);
  }

  const user = req.user;
  const name = str(body.name, 80) || user.name;
  const phone = user.phone;
  const email = str(body.email, 120);
  const address = str(body.address, 300);
  const notes = str(body.notes, 600);
  const location = readLocation(body.location);
  const offer = readOffer(body.offer, body.offerNote);
  const paymentMethod = readPaymentChoice(body.paymentMethod);
  if (name.length < 2) fail(400, 'Please enter your name.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Please enter a valid email or leave it empty.');
  if (address.length < 5) fail(400, 'Please enter the venue address.');

  const groupId = items.length > 1 ? `G-${uid().slice(0, 8).toUpperCase()}` : '';
  const createdAt = new Date().toISOString();
  const created = [];
  for (const { service, category, date, slot } of items) {
    const booking = {
      id: uid(),
      ref: makeRef(),
      groupId,
      userId: user.id,
      serviceId: service.id,
      serviceName: service.name,
      categoryId: category?.id || '',
      categoryName: category?.name || '',
      assignees: [], // [{ id, name }] — filled in by the admin; names are kept even if the person is removed later
      date,
      slotId: slot.id,
      slotLabel: slot.label,
      slotTime: `${slot.start} – ${slot.end}`,
      name,
      phone,
      email,
      address,
      location, // { lat, lng, label } picked on the map, so the closest team member can be found
      notes,
      offer: offer && { ...offer }, // { amount, note, status: pending | accepted | countered | declined }
      paymentMethod, // the customer's choice; replaced by the actual method when payment is recorded
      paymentStatus: 'unpaid',
      amount: null,
      billNo: '',
      billedAt: '',
      utr: '',
      paidAt: '',
      paymentNote: '',
      status: 'pending',
      createdAt,
      cancelReason: '',
      cancelledBy: '',
      cancelledAt: '',
    };
    db.bookings.push(booking); // pushed before the next makeRef() so refs stay unique
    created.push(booking);
  }
  if (email && !user.email) user.email = email;
  if (offer) {
    const list = created.map((b) => b.ref).join(', ');
    postMessage(threadOf('u', user.id), 'user', { kind: 'offer', text: `I would like to offer ${rupee(offer.amount)}${created.length > 1 ? ' for each booking' : ''} (${list}).${offer.note ? ` ${offer.note}` : ''}`, bookingId: created[0].id, bookingIds: created.map((b) => b.id), bookingRef: created[0].ref, amount: offer.amount });
  }
  await save();
  const views = created.map(customerView).sort((a, b) => (a.date + a.slotTime).localeCompare(b.date + b.slotTime));
  const offered = offer ? ` · Offer ${rupee(offer.amount)}` : '';
  if (created.length === 1) {
    tellAdmin('new', 'New booking request 🙏', `${name} · ${slotText(created[0])} · ${address}${offered}`, created[0].ref);
  } else {
    const list = views.slice(0, 3).map(slotText).join('; ') + (views.length > 3 ? ` +${views.length - 3} more` : '');
    tellAdmin('new', `New booking request: ${created.length} slots 🙏`, `${name} · ${list}`, groupId);
  }
  res.status(201).json({ booking: views[0], bookings: views });
});

// A booking of the logged-in customer, by its booking ID.
const findOwnBooking = (req, ref = req.body?.ref) => {
  const booking = db.bookings.find((b) => b.ref === str(ref, 20).toUpperCase());
  if (!booking || !ownsBooking(req.user, booking)) fail(404, 'No booking found with that ID in your account.');
  return booking;
};

// Upcoming first (soonest at top), then past ones (most recent first).
const byDate = (today) => (a, b) => {
  const ua = a.date >= today;
  const ub = b.date >= today;
  if (ua !== ub) return ua ? -1 : 1;
  return ua ? (a.date + a.slotTime).localeCompare(b.date + b.slotTime) : (b.date + b.slotTime).localeCompare(a.date + a.slotTime);
};

app.post('/api/bookings/payment-method', requireUser, async (req, res) => {
  const booking = findOwnBooking(req);
  if (booking.status === 'cancelled') fail(400, 'This booking is cancelled.');
  if (booking.paymentStatus === 'paid') fail(400, 'Payment for this booking is already received.');
  if (booking.paymentStatus === 'submitted') fail(400, 'Your UPI payment is already waiting for verification.');
  booking.paymentMethod = readPaymentChoice(req.body.method);
  await save();
  tellAdmin('method', 'Payment method changed', `${booking.name} will now pay by ${booking.paymentMethod === 'upi' ? 'UPI' : 'cash'} · ${slotText(booking)}`, booking.ref);
  res.json({ booking: customerView(booking) });
});

app.post('/api/bookings/payment', requireUser, async (req, res) => {
  const booking = findOwnBooking(req);
  if (booking.status !== 'confirmed' && booking.status !== 'completed') fail(400, 'Payment opens once the jatha confirms your booking.');
  if (!booking.amount) fail(400, 'The bill for this booking is not ready yet.');
  if (booking.paymentStatus === 'paid') fail(400, 'Payment for this booking is already received.');
  const utr = str(req.body.utr, 40).replace(/\s/g, '');
  if (!/^[A-Za-z0-9]{6,40}$/.test(utr)) fail(400, 'Please enter the UPI transaction ID / UTR shown in your payment app.');
  Object.assign(booking, { paymentMethod: 'upi', paymentStatus: 'submitted', utr, paymentSubmittedAt: new Date().toISOString() });
  await save();
  tellAdmin('paid', 'UPI payment to verify 💰', `${booking.name} paid ${rupee(booking.amount)} · UTR ${utr} · ${slotText(booking)}`, booking.ref);
  res.json({ booking: customerView(booking) });
});

let qrCache; // { type, data } — loaded once, refreshed on upload
const loadQr = async () => (qrCache ??= (await kv.get('upi-qr')) || null);

app.get('/api/upi-qr', async (_req, res) => {
  const qr = await loadQr();
  if (!qr) fail(404, 'No QR uploaded.');
  res.set('Cache-Control', 'public, max-age=86400').type(qr.type).send(Buffer.from(qr.data, 'base64'));
});

app.get('/api/push/key', async (_req, res) => {
  res.json({ publicKey: pushPublicKey() });
});

// A logged-in customer or team member: notifications go to their account's mobile number.
app.post('/api/push/subscribe', async (req, res) => {
  throttle(`push:${req.ip}`, 30);
  const s = sessionOf(req);
  if (!s) fail(401, 'Please log in to turn on notifications.');
  const phone = s.role === 'user' ? s.user.phone : s.person.phone;
  if (!phone) fail(400, 'Your account has no mobile number.');
  await addSubscription(phone, readSubscription(req.body?.subscription));
  res.json({ ok: true });
});

// Images are kept apart from the main record (it is loaded on every request) and never change, so cache them for long.
app.get('/api/gurpurab-images/:id', async (req, res) => {
  if (!/^[a-f0-9]{16}$/.test(req.params.id)) fail(404, 'Not found.');
  const img = await kv.get(`gp-img-${req.params.id}`);
  if (!img) fail(404, 'Not found.');
  res.set('Cache-Control', 'public, max-age=31536000, immutable').type(img.type).send(Buffer.from(img.data, 'base64'));
});

app.post('/api/push/subscribe-public', async (req, res) => {
  throttle(`push:${req.ip}`, 30);
  await addPublicSubscription(readSubscription(req.body?.subscription));
  res.json({ ok: true });
});

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()) });
});

// Customers can only ask to cancel; the admin approves or rejects the request.
app.post('/api/bookings/cancel-request', requireUser, async (req, res) => {
  const booking = findOwnBooking(req);
  if (!isActive(booking)) fail(400, `This booking is already ${booking.status}.`);
  if (booking.date < todayKey()) fail(400, 'Past bookings cannot be cancelled.');
  if (booking.cancelRequest?.status === 'pending') fail(400, 'A cancellation request is already waiting for approval.');
  const reason = str(req.body.reason, 500);
  if (reason.length < 3) fail(400, 'Please tell us the reason for cancelling.');
  booking.cancelRequest = { status: 'pending', reason, at: new Date().toISOString(), note: '' };
  await save();
  tellAdmin('cancel', 'Cancellation requested', `${booking.name} · ${slotText(booking)}. Reason: ${reason}`, booking.ref);
  res.json({ booking: customerView(booking) });
});

app.post('/api/bookings/cancel-request/withdraw', requireUser, async (req, res) => {
  const booking = findOwnBooking(req);
  if (booking.cancelRequest?.status !== 'pending') fail(400, 'There is no pending cancellation request.');
  booking.cancelRequest = null;
  await save();
  tellAdmin('withdraw', 'Cancellation request withdrawn', `${booking.name} wants to keep ${slotText(booking)}`, booking.ref);
  res.json({ booking: customerView(booking) });
});

/* ---------------- chat (admin ↔ customer, admin ↔ team member) ---------------- */

const threadOf = (kind, id) => `${kind}:${id}`; // "u:<user id>" or "m:<team member id>"
function threadRecord(id) {
  let t = db.threads.find((x) => x.id === id);
  if (!t) db.threads.push((t = { id, adminReadAt: '', otherReadAt: '', lastAt: '' }));
  return t;
}
// kind: text | offer (customer's price offer) | pay-request (team member asks for more bhet) | system
function postMessage(thread, from, fields) {
  const m = { id: uid(), thread, from, kind: 'text', text: '', at: new Date().toISOString(), ...fields };
  db.messages.push(m);
  const t = threadRecord(thread);
  t.lastAt = m.at;
  if (from === 'admin') t.adminReadAt = m.at;
  else t.otherReadAt = m.at;
  return m;
}
// side "admin" counts the customer's / member's messages, side "other" counts the admin's.
function unreadIn(thread, side) {
  const t = db.threads.find((x) => x.id === thread);
  const since = (side === 'admin' ? t?.adminReadAt : t?.otherReadAt) || '';
  return db.messages.filter((m) => m.thread === thread && (side === 'admin') === (m.from !== 'admin') && m.at > since).length;
}
function markRead(thread, side) {
  if (!db.messages.some((m) => m.thread === thread)) return false;
  const t = threadRecord(thread);
  const last = t.lastAt || new Date().toISOString();
  const key = side === 'admin' ? 'adminReadAt' : 'otherReadAt';
  if (t[key] >= last) return false;
  t[key] = last;
  return true;
}
const messagesOf = (thread) => db.messages.filter((m) => m.thread === thread).slice(-300);
function readChatText(body) {
  const text = str(body?.text, 1000);
  if (!text) fail(400, 'Type a message first.');
  return text;
}
// The admin's devices hear about every customer / team message; the person hears about the admin's replies.
function alertAdmin(title, body, url, tag) {
  notifyAdmins({ title, body, url, tag }).catch(() => {});
}
function chatAlert(thread, m) {
  const [kind, id] = thread.split(':');
  const who = kind === 'u' ? db.users.find((u) => u.id === id) : personOf(id);
  if (!who) return;
  if (m.from === 'admin') {
    notifyPhone(who.phone, { title: '💬 Message from the jatha', body: m.text, url: kind === 'u' ? '/account?chat=1' : '/team?chat=1', tag: `chat-${thread}` }).catch(() => {});
  } else {
    alertAdmin(`💬 ${who.name}${kind === 'm' ? ' (team)' : ''}`, m.text, `/admin?chat=${encodeURIComponent(thread)}`, `chat-${thread}`);
  }
}

/* ---------------- logins: customers ("user") and team members ("member") ---------------- */

const userView = (u) => ({ id: u.id, name: u.name, phone: u.phone, email: u.email || '', location: u.location || null, createdAt: u.createdAt });
function readPhone(v) {
  const d = digits(v);
  if (d.length < 10 || d.length > 15) fail(400, 'Please enter your 10-digit mobile number.');
  return d;
}
function readPassword(v) {
  const problem = passwordProblem(v);
  if (problem) fail(400, problem);
  return String(v);
}

app.post('/api/auth/register', async (req, res) => {
  throttle(`register:${req.ip}`, 10);
  const name = str(req.body?.name, 80);
  const phone = readPhone(req.body?.phone);
  const password = readPassword(req.body?.password);
  if (name.length < 2) fail(400, 'Please enter your name.');
  if (db.users.some((u) => samePhone(u.phone, phone))) fail(409, 'An account with this mobile number already exists. Please log in.');
  const user = { id: uid(), name, phone, email: '', location: null, tokenVersion: 0, passwordHash: await hashPassword(password), createdAt: new Date().toISOString() };
  db.users.push(user);
  await save();
  alertAdmin('New sangat account', `${name} · ${phone}`, '/admin?tab=customers', `user-${user.id}`);
  res.status(201).json({ token: auth.make('user', user.id, 0), role: 'user', name: user.name });
});

// Team members sign up themselves, with their documents; the account waits (inactive) until the admin approves it.
app.post(TEAM_SIGNUP_PATH, express.json({ limit: '30mb' }), async (req, res) => {
  throttle(`register:${req.ip}`, 10);
  const name = str(req.body?.name, 80);
  const phone = readPhone(req.body?.phone);
  const password = readPassword(req.body?.password);
  const role = str(req.body?.role, 20);
  if (name.length < 2) fail(400, 'Please enter your name.');
  if (!ROLES[role]) fail(400, 'Please choose your role: Head Ragi, Side Ragi or Tabla.');
  const existing = db.people.find((p) => samePhone(p.phone, phone));
  if (existing?.pending) fail(403, 'You have already signed up with this number. Your account is being verified by the admin.');
  if (existing?.passwordHash) fail(409, 'A team account with this mobile number already exists. Please log in.');
  if (existing) fail(409, 'This number is already on the team list. Ask the admin for your password.');
  const location = readLocation(req.body?.location);
  if (!location) fail(400, 'Please pick where you are based on the map.');
  const given = req.body?.docs && typeof req.body.docs === 'object' ? req.body.docs : {};
  const missing = SIGNUP_DOCS_REQUIRED.filter((k) => !given[k]?.dataUrl);
  if (missing.length) fail(400, `Please add your ${missing.map((k) => DOC_KINDS[k]).join(', ')}.`);
  const files = Object.keys(DOC_KINDS)
    .filter((k) => given[k]?.dataUrl)
    .map((kind) => ({ kind, id: uid(), name: str(given[kind].name, 120), ...readDoc(given[kind].dataUrl) }));
  const now = new Date().toISOString();
  const person = {
    id: uid(),
    name,
    phone,
    address: location.label,
    location,
    role,
    defaultPay: null,
    skills: [],
    active: false,
    pending: true,
    docs: Object.fromEntries(files.map((f) => [f.kind, { id: f.id, type: f.type, name: f.name, at: now }])),
    tokenVersion: 0,
    passwordHash: await hashPassword(password),
    createdAt: now,
  };
  await Promise.all(files.map((f) => kv.set(`doc-${f.id}`, { type: f.type, data: f.data })));
  db.people.push(person);
  await save();
  alertAdmin('New team sign-up — approve?', `${name} · ${ROLES[role]} · ${phone} · ${files.length} document(s)`, '/admin?tab=team', `member-${person.id}`);
  res.status(201).json({ pending: true });
});

app.post('/api/auth/login', async (req, res) => {
  throttle(`auth:${req.ip}`, 30);
  const role = req.body?.role === 'member' ? 'member' : 'user';
  const phone = readPhone(req.body?.phone);
  throttle(`auth:${role}:${phoneKey(phone)}`, 10);
  const account = (role === 'member' ? db.people : db.users).find((a) => a.passwordHash && samePhone(a.phone, phone));
  if (!(await checkPassword(req.body?.password, account?.passwordHash))) {
    fail(401, role === 'member' ? 'Incorrect mobile number or password. New to the team? Create an account first.' : 'Incorrect mobile number or password.');
  }
  if (account.pending) fail(403, 'Your account is waiting for the admin to approve it. You can log in once it is approved.');
  attempts.delete(`auth:${role}:${phoneKey(phone)}`);
  res.json({ token: auth.make(role, account.id, account.tokenVersion || 0), role, name: account.name });
});

/* ---------- customer account ---------- */

const myBookings = (user) => db.bookings.filter((b) => ownsBooking(user, b)).sort(byDate(todayKey()));

app.get('/api/me', requireUser, async (req, res) => {
  res.json({ user: userView(req.user), bookings: myBookings(req.user).map(customerView), unread: unreadIn(threadOf('u', req.user.id), 'other'), today: todayKey() });
});

app.put('/api/me', requireUser, async (req, res) => {
  const u = req.user;
  const b = req.body || {};
  const name = 'name' in b ? str(b.name, 80) : u.name;
  const email = 'email' in b ? str(b.email, 120) : u.email;
  if (name.length < 2) fail(400, 'Please enter your name.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Please enter a valid email or leave it empty.');
  Object.assign(u, { name, email, ...('location' in b && { location: readLocation(b.location) }) });
  await save();
  res.json({ user: userView(u) });
});

// Changing the password logs out every other device; this one gets a fresh token.
async function changePassword(account, body, role) {
  if (!(await checkPassword(body?.current, account.passwordHash))) fail(400, 'Your current password is not correct.');
  account.passwordHash = await hashPassword(readPassword(body?.password));
  account.tokenVersion = (account.tokenVersion || 0) + 1;
  await save();
  return auth.make(role, account.id, account.tokenVersion);
}
app.post('/api/me/password', requireUser, async (req, res) => {
  throttle(`pw:${req.ip}`, 10);
  res.json({ token: await changePassword(req.user, req.body, 'user') });
});

// The customer can add or correct the map location of an upcoming booking.
app.put('/api/me/bookings/:ref/location', requireUser, async (req, res) => {
  const booking = findOwnBooking(req, req.params.ref);
  if (!isActive(booking) || booking.date < todayKey()) fail(400, 'Only upcoming bookings can be changed.');
  const location = readLocation(req.body?.location);
  if (!location) fail(400, 'Please choose the place on the map.');
  booking.location = location;
  booking.updatedAt = new Date().toISOString();
  await save();
  tellAdmin('location', 'Venue location added 📍', `${booking.name} · ${slotText(booking)} · ${location.label}`, booking.ref);
  res.json({ booking: customerView(booking) });
});

// The customer offers what they would like to pay; the admin accepts it or sets the bill amount.
app.post('/api/me/bookings/:ref/offer', requireUser, async (req, res) => {
  const booking = findOwnBooking(req, req.params.ref);
  if (!isActive(booking) || booking.date < todayKey()) fail(400, 'Offers can only be made on upcoming bookings.');
  if (booking.paymentStatus !== 'unpaid') fail(400, 'Payment for this booking has already been made.');
  const offer = readOffer(req.body?.amount, req.body?.note);
  if (!offer) fail(400, 'Please enter the amount you would like to offer.');
  booking.offer = offer;
  postMessage(threadOf('u', req.user.id), 'user', {
    kind: 'offer',
    text: `I would like to offer ${rupee(offer.amount)} for ${booking.ref} (${slotText(booking)}).${offer.note ? ` ${offer.note}` : ''}`,
    bookingId: booking.id,
    bookingIds: [booking.id],
    bookingRef: booking.ref,
    amount: offer.amount,
  });
  await save();
  tellAdmin('offer', `Offer: ${rupee(offer.amount)} 🙏`, `${booking.name} · ${slotText(booking)}${booking.amount ? ` · bill ${rupee(booking.amount)}` : ''}`, booking.ref);
  res.json({ booking: customerView(booking) });
});

app.get('/api/me/chat', requireUser, async (req, res) => {
  const thread = threadOf('u', req.user.id);
  if (markRead(thread, 'other')) await save();
  res.json({ messages: messagesOf(thread), phone: db.settings.phone });
});

app.post('/api/me/chat', requireUser, async (req, res) => {
  throttle(`chat:${req.ip}`, 120);
  const thread = threadOf('u', req.user.id);
  const m = postMessage(thread, 'user', { text: readChatText(req.body) });
  await save();
  chatAlert(thread, m);
  res.status(201).json({ messages: messagesOf(thread) });
});

/* ---------- team member dashboard ---------- */

const docUrl = (doc) => doc && { ...doc, url: `/api/files/${doc.id}?${auth.fileQuery(doc.id)}` };
// A team member's profile, as they and the admin see it (never the password).
const memberView = (p) => ({
  id: p.id,
  name: p.name,
  phone: p.phone || '',
  address: p.address || '',
  role: p.role || '',
  skills: p.skills || [],
  active: p.active !== false,
  pending: !!p.pending,
  createdAt: p.createdAt || '',
  fatherName: p.fatherName || '',
  experience: p.experience || '',
  location: p.location || null,
  bank: p.bank || { holder: '', account: '', ifsc: '', bankName: '' },
  docs: Object.fromEntries(Object.entries(p.docs || {}).map(([k, d]) => [k, docUrl(d)])),
  defaultPay: p.defaultPay ?? null,
  hasPassword: !!p.passwordHash,
  profileUpdatedAt: p.profileUpdatedAt || '',
});
const peopleView = () => db.people.map(memberView);

function teamPayload(p) {
  const duties = db.bookings.filter((b) => (b.assignees || []).some((a) => a.id === p.id)).sort(byDate(todayKey()));
  return {
    person: memberView(p),
    duties: duties.map((b) => dutyView(b, p)),
    leaves: db.leaves.filter((l) => l.personId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    // Teammates' bookings the admin put this person on: waiting for their yes / no, or accepted.
    bookedMe: db.leaves
      .filter((l) => (l.status === 'assigned' || l.status === 'approved') && l.to >= todayKey() && (l.picks || []).some((x) => x.personId === p.id && replyOf(x) !== 'declined'))
      .map((l) => ({
        id: l.id,
        name: personOf(l.personId)?.name || l.personName,
        reason: l.reason,
        location: l.location || null,
        paymentMethod: l.paymentMethod || '',
        emergency: !!l.emergency,
        status: l.status,
        commissionRate: l.commissionRate ?? 0,
        sewas: l.picks
          .filter((x) => x.personId === p.id && replyOf(x) !== 'declined')
          .map((x) => {
            const b = x.bookingId && db.bookings.find((y) => y.id === x.bookingId);
            return {
              serviceName: b?.serviceName || x.serviceName || '',
              categoryName: x.categoryName || b?.categoryName || '',
              role: x.role || '',
              date: x.date || b?.date || l.from,
              start: x.start || '',
              end: x.end || '',
              pay: netPay(l, x), // what is theirs
              gross: x.pay, // what they collect when the member pays them in cash
              commission: pickCommission(l, x),
              commissionPaid: !!x.commissionPaidAt,
              reply: replyOf(x),
            };
          }),
      })),
    // Paid in cash, they hold the admin's commission: shown to them as a negative balance until the admin has it.
    commissionDue: cashCommissionDue().filter((d) => d.personId === p.id),
    commissionRate: TEAM_COMMISSION_RATE,
    teammates: db.people.filter((x) => x.id !== p.id && x.active).map((x) => ({ id: x.id, name: x.name, role: x.role || '' })),
    unread: unreadIn(threadOf('m', p.id), 'other'),
    roles: ROLES,
    docKinds: DOC_KINDS,
    today: todayKey(),
  };
}

app.get('/api/team/me', requireMember, async (req, res) => {
  res.json(teamPayload(req.person));
});

app.put('/api/team/profile', requireMember, async (req, res) => {
  const p = req.person;
  const b = req.body || {};
  const name = str(b.name, 80);
  if (name.length < 2) fail(400, 'Please enter your name.');
  const bank = {
    holder: str(b.bank?.holder, 80),
    account: digits(b.bank?.account).slice(0, 20),
    ifsc: str(b.bank?.ifsc, 11).toUpperCase(),
    bankName: str(b.bank?.bankName, 80),
  };
  if (bank.account && bank.account.length < 6) fail(400, 'The bank account number looks too short.');
  if (bank.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bank.ifsc)) fail(400, 'The IFSC code should look like SBIN0001234.');
  Object.assign(p, {
    name,
    fatherName: str(b.fatherName, 80),
    experience: str(b.experience, 300),
    address: str(b.address, 300),
    location: readLocation(b.location),
    bank,
    profileUpdatedAt: new Date().toISOString(),
  });
  await save();
  alertAdmin('Team profile updated', `${p.name} updated their profile.`, '/admin?tab=team', `profile-${p.id}`);
  res.json(teamPayload(p));
});

app.post(`${DOC_PATH}:kind`, express.json({ limit: '8mb' }), requireMember, async (req, res) => {
  const kind = req.params.kind;
  if (!DOC_KINDS[kind]) fail(404, 'Unknown document.');
  const file = readDoc(req.body?.dataUrl);
  const p = req.person;
  const id = uid();
  await kv.set(`doc-${id}`, file);
  const old = p.docs?.[kind];
  p.docs = { ...p.docs, [kind]: { id, type: file.type, name: str(req.body.name, 120), at: new Date().toISOString() } };
  p.profileUpdatedAt = new Date().toISOString();
  await save();
  if (old) await kv.set(`doc-${old.id}`, null);
  alertAdmin('Team document uploaded', `${p.name}: ${DOC_KINDS[kind]}`, '/admin?tab=team', `doc-${p.id}-${kind}`);
  res.json(teamPayload(p));
});

app.delete(`${DOC_PATH}:kind`, requireMember, async (req, res) => {
  const p = req.person;
  const old = p.docs?.[req.params.kind];
  if (old) {
    p.docs = Object.fromEntries(Object.entries(p.docs).filter(([k]) => k !== req.params.kind));
    await save();
    await kv.set(`doc-${old.id}`, null);
  }
  res.json(teamPayload(p));
});

// Team documents (Aadhaar, bank proof…) open only through a signed link given to that member or the admin.
app.get('/api/files/:id', async (req, res) => {
  const id = req.params.id;
  if (!/^[a-f0-9]{16}$/.test(id) || !auth.fileOk(id, req.query.exp, req.query.sig)) fail(403, 'This link has expired. Reload the page and open it again.');
  const file = await kv.get(`doc-${id}`);
  if (!file) fail(404, 'Not found.');
  res.set('Cache-Control', 'private, max-age=3600').type(file.type).send(Buffer.from(file.data, 'base64'));
});

function findDuty(req) {
  const booking = db.bookings.find((b) => b.id === req.params.id);
  const mine = booking?.assignees?.find((a) => a.id === req.person.id);
  if (!mine) fail(404, 'This sewa is not assigned to you.');
  return { booking, mine };
}

app.post('/api/team/duties/:id/confirm', requireMember, async (req, res) => {
  const { booking, mine } = findDuty(req);
  if (!isActive(booking) || booking.date < todayKey()) fail(400, 'This sewa is no longer upcoming.');
  Object.assign(mine, { state: 'confirmed', confirmedAt: new Date().toISOString() });
  await save();
  tellAdmin('duty-ok', `${req.person.name} confirmed ✅`, slotText(booking), booking.ref);
  res.json(teamPayload(req.person));
});

// A team member may ask to be taken off a sewa, but not within 2 days of it.
app.post('/api/team/duties/:id/cancel-request', requireMember, async (req, res) => {
  const { booking, mine } = findDuty(req);
  if (!isActive(booking)) fail(400, `This sewa is already ${booking.status}.`);
  if (booking.date <= addDaysKey(2)) fail(400, 'A sewa can’t be cancelled within 2 days of the program. Please call the admin.');
  if (mine.cancelRequest?.status === 'pending') fail(400, 'Your cancellation request is already waiting for the admin.');
  const reason = str(req.body?.reason, 500);
  if (reason.length < 3) fail(400, 'Please give the reason.');
  mine.cancelRequest = { status: 'pending', reason, at: new Date().toISOString(), note: '' };
  await save();
  tellAdmin('duty-cancel', `${req.person.name} asks to be taken off`, `${slotText(booking)}. Reason: ${reason}`, booking.ref);
  res.json(teamPayload(req.person));
});

app.post('/api/team/duties/:id/cancel-request/withdraw', requireMember, async (req, res) => {
  const { mine } = findDuty(req);
  if (mine.cancelRequest?.status !== 'pending') fail(400, 'There is no pending request.');
  mine.cancelRequest = null;
  await save();
  res.json(teamPayload(req.person));
});

// Asking for a different bhet goes into the chat; the admin can set it from there.
app.post('/api/team/duties/:id/pay-request', requireMember, async (req, res) => {
  const { booking, mine } = findDuty(req);
  if (booking.status === 'cancelled') fail(400, 'This sewa was cancelled.');
  const amount = readAmount(req.body?.amount);
  const note = str(req.body?.note, 300);
  const thread = threadOf('m', req.person.id);
  for (const m of db.messages) if (m.thread === thread && m.kind === 'pay-request' && m.bookingId === booking.id && m.status === 'pending') m.status = 'replaced';
  const m = postMessage(thread, 'member', {
    kind: 'pay-request',
    text: `Please make my bhet ${rupee(amount)} for ${booking.ref} (${slotText(booking)})${mine.pay != null ? ` — now ${rupee(mine.pay)}` : ''}.${note ? ` ${note}` : ''}`,
    bookingId: booking.id,
    bookingRef: booking.ref,
    amount,
    status: 'pending',
  });
  await save();
  chatAlert(thread, m);
  res.json(teamPayload(req.person));
});

/* Team booking (stored as "leaves"): a team member asks for teammates (by type of kirtan) to go in their place, with
 * the bhet they offer; the admin assigns the people. With sewas in those days, every sewa gets its own request;
 * otherwise they ask for one or more by day and time. Team bookings never block anyone: a member may have several on
 * the same dates and can still be assigned on them.
 * Less than a day's notice still goes through, marked as an emergency; within a day of the start it can't be withdrawn.
 * Status: pending (admin to assign) → assigned (waiting for each person's yes) → approved (everyone accepted). A
 * person who declines sends it back to pending for the admin to choose someone else. Their sewas are handed over
 * only once they accept. Once sent, the member can only ask the admin to cancel it.
 * The admin keeps a commission (TEAM_COMMISSION_RATE % of each bhet) out of the bhet the member pays; the people who
 * go see and get the rest. */
const LEAVE_NOTICE_MS = 24 * 60 * 60 * 1000;
const LEAVE_MIN_PAY = 200; // least bhet they can offer a teammate
const TEAM_COMMISSION_RATE = 10;
// Commission on one request, and what the person who goes gets after it (bookings from before commission: all of it).
const pickCommission = (l, x) => Math.round((x.pay * (l.commissionRate ?? 0)) / 100);
const netPay = (l, x) => x.pay - pickCommission(l, x);
/* With cash, the member pays the whole bhet to the people who go, so each one owes the admin the commission on what
 * they accepted (until the admin marks it received). One row per person per team booking. */
function cashCommissionDue() {
  const due = [];
  for (const l of db.leaves) {
    if (l.paymentMethod !== 'cash' || !liveLeave(l)) continue;
    for (const id of new Set((l.picks || []).map((x) => x.personId).filter(Boolean))) {
      const owed = l.picks.filter((x) => x.personId === id && replyOf(x) === 'accepted' && !x.commissionPaidAt);
      const amount = owed.reduce((t, x) => t + pickCommission(l, x), 0);
      if (amount > 0) due.push({ leaveId: l.id, personId: id, name: personOf(id)?.name || '', inPlaceOf: personOf(l.personId)?.name || l.personName, from: l.from, to: l.to, amount });
    }
  }
  return due.sort((a, b) => a.from.localeCompare(b.from));
}
const replyOf = (x) => x.reply || (x.personId ? 'accepted' : ''); // bookings approved before replies existed count as accepted
const liveLeave = (l) => ['pending', 'assigned', 'approved'].includes(l.status);
// When a team booking really starts: its earliest booked time, or the start of the first day.
const leaveStartsAt = (from, picks) => {
  const times = picks.map((x) => new Date(`${x.date}T${x.start || '00:00'}:00`).getTime()).filter(Number.isFinite);
  return new Date(times.length ? Math.min(...times) : new Date(`${from}T00:00:00`).getTime());
};
const PAY_BY = { upi: 'UPI', cash: 'cash' }; // how the member pays the bhet to the people assigned
const pickWhen = (x) => `${shortDate(x.date)}${x.start ? ` ${x.start}–${x.end}` : ''}`;

app.post('/api/team/leaves', requireMember, async (req, res) => {
  const p = req.person;
  const from = str(req.body?.from, 10);
  const to = str(req.body?.to, 10) || from;
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) fail(400, 'Choose the dates of your leave.');
  if (from < todayKey()) fail(400, 'Leave can’t start in the past.');
  if (to < from) fail(400, 'The last day must be on or after the first day.');
  if (to > addDaysKey(365)) fail(400, 'That is too far ahead.');
  const reason = str(req.body?.reason, 300);
  if (reason.length < 3) fail(400, 'Please say why you need a teammate.');
  const sewas = db.bookings.filter((b) => isActive(b) && b.date >= from && b.date <= to && (b.assignees || []).some((a) => a.id === p.id));
  const given = Array.isArray(req.body?.picks) ? req.body.picks.slice(0, 40) : [];
  // Each request: the bhet they offer (and the type of kirtan, below). The admin chooses the person. Older requests
  // also named a role; one may still be sent, but none is asked for.
  const readPick = (pick, what) => {
    const role = ROLES[str(pick?.role, 20)] ? str(pick.role, 20) : '';
    const pay = Math.round(Number(pick.pay));
    if (!Number.isFinite(pay) || pay < LEAVE_MIN_PAY) fail(400, `Offer at least ₹${LEAVE_MIN_PAY} for ${what}.`);
    if (pay > 1000000) fail(400, 'That amount is too large.');
    return { role, pay };
  };
  let picks;
  if (sewas.length) {
    // Every sewa in these days gets its own request (different sewas, even on one day, can need different people).
    picks = sewas.map((b) => {
      const [start, end] = rangeOf(b);
      return { ...readPick(given.find((x) => x?.bookingId === b.id), `${b.serviceName} on ${shortDate(b.date)} (${b.slotTime})`), bookingId: b.id, serviceName: b.serviceName, categoryId: b.categoryId || '', categoryName: b.categoryName || '', date: b.date, start, end };
    });
  } else {
    // No sewas of their own: ask for one or more people, each on a day (and time) within these dates.
    if (!given.length) fail(400, 'Add at least one request.');
    const kinds = publicCategories();
    picks = given.map((g, i) => {
      // The type of kirtan (e.g. with Raag / Kavishri), when the site has them — so the right people are chosen.
      const category = kinds.find((c) => c.id === str(g?.categoryId, 80));
      if (kinds.length && !category) fail(400, `Request ${i + 1}: choose the type of kirtan.`);
      const date = str(g?.date, 10) || from;
      if (!DATE_RE.test(date) || date < from || date > to) fail(400, `Request ${i + 1}: choose a day between the first and last day.`);
      const start = str(g?.start, 5);
      const end = str(g?.end, 5);
      if ((start || end) && !(TIME_RE.test(start) && TIME_RE.test(end) && end > start)) fail(400, `Request ${i + 1}: enter a start and end time (end after start), or leave both empty for the whole day.`);
      return { ...readPick(g, `request ${i + 1}`), categoryId: category?.id || '', categoryName: category?.name || '', date, start, end };
    });
  }
  const paymentMethod = str(req.body?.paymentMethod, 10);
  if (!PAY_BY[paymentMethod]) fail(400, 'Choose how you will pay the bhet — UPI or cash.');
  const location = readLocation(req.body?.location); // where the people taking their place should go
  const startsAt = leaveStartsAt(from, picks);
  const emergency = startsAt.getTime() - Date.now() < LEAVE_NOTICE_MS;
  const total = picks.reduce((s, x) => s + x.pay, 0);
  const commission = picks.reduce((s, x) => s + pickCommission({ commissionRate: TEAM_COMMISSION_RATE }, x), 0);
  db.meta.teamBillSeq = (db.meta.teamBillSeq || 0) + 1;
  const leave = {
    id: uid(),
    billNo: `TB-${new Date().getFullYear()}-${String(db.meta.teamBillSeq).padStart(4, '0')}`,
    personId: p.id,
    personName: p.name,
    from,
    to,
    reason,
    picks,
    total,
    commissionRate: TEAM_COMMISSION_RATE,
    commission,
    commissionPaid: false,
    paymentMethod,
    location,
    emergency,
    startsAt: startsAt.toISOString(),
    status: 'pending',
    note: '',
    createdAt: new Date().toISOString(),
  };
  db.leaves.push(leave);
  await save();
  const when = `${shortDate(from)}${to !== from ? ` – ${shortDate(to)}` : ''}`;
  const kinds = [...new Set(picks.map((x) => x.categoryName || ROLES[x.role]).filter(Boolean))];
  const wanted = `${picks.length === 1 ? 'a teammate' : `${picks.length} teammates`}${kinds.length ? ` (${kinds.join(', ')})` : ''}`;
  alertAdmin(
    `${emergency ? '🚨 Emergency: ' : ''}${p.name} needs ${wanted}`,
    `${when}${sewas.length ? ` · for ${sewas.length} of their sewa${sewas.length === 1 ? '' : 's'}` : ''} · ${rupee(total)} bhet (your commission ${rupee(commission)}) by ${PAY_BY[paymentMethod]} · assign the people${location ? ` · at ${location.label || 'a map pin'}` : ''}`,
    '/admin?tab=leave',
    `leave-${leave.id}`,
  );
  res.status(201).json(teamPayload(p));
});

app.delete('/api/team/leaves/:id', requireMember, async (req, res) => {
  const leave = db.leaves.find((l) => l.id === req.params.id && l.personId === req.person.id);
  if (!leave) fail(404, 'Leave request not found.');
  if (leave.status !== 'pending') fail(400, 'Once the admin has assigned people it can’t be withdrawn — ask the admin to cancel it instead.');
  if (new Date(leave.startsAt || `${leave.from}T00:00:00`).getTime() - Date.now() < LEAVE_NOTICE_MS) fail(400, 'A team booking can’t be withdrawn within 1 day of its start — ask the admin to cancel it instead.');
  db.leaves = db.leaves.filter((l) => l !== leave);
  await save();
  res.json(teamPayload(req.person));
});

// Once the admin is on it (or within a day of the start), the member asks the admin to cancel instead.
app.post('/api/team/leaves/:id/cancel-request', requireMember, async (req, res) => {
  const leave = db.leaves.find((l) => l.id === req.params.id && l.personId === req.person.id);
  if (!leave) fail(404, 'Team booking not found.');
  if (!liveLeave(leave) || leave.to < todayKey()) fail(400, 'This team booking can no longer be cancelled.');
  if (leave.cancelRequest?.status === 'pending') fail(400, 'Your cancellation request is already waiting for the admin.');
  const reason = str(req.body?.reason, 300);
  if (reason.length < 3) fail(400, 'Please give the reason.');
  leave.cancelRequest = { status: 'pending', reason, at: new Date().toISOString(), note: '' };
  await save();
  alertAdmin(`${req.person.name} asks to cancel a team booking`, `${shortDate(leave.from)}${leave.to !== leave.from ? ` – ${shortDate(leave.to)}` : ''} · ${reason}`, '/admin?tab=leave', `leave-${leave.id}`);
  res.json(teamPayload(req.person));
});

app.post('/api/team/leaves/:id/cancel-request/withdraw', requireMember, async (req, res) => {
  const leave = db.leaves.find((l) => l.id === req.params.id && l.personId === req.person.id);
  if (leave?.cancelRequest?.status !== 'pending') fail(400, 'There is no pending request.');
  leave.cancelRequest = null;
  await save();
  res.json(teamPayload(req.person));
});

// The person the admin assigned says yes (their part is booked, and any sewa is handed to them) or no (back to the admin).
app.post('/api/team/leaves/:id/answer', requireMember, async (req, res) => {
  const p = req.person;
  const leave = db.leaves.find((l) => l.id === req.params.id);
  const mine = (leave?.picks || []).filter((x) => x.personId === p.id && replyOf(x) === 'waiting');
  if (!leave || leave.status !== 'assigned' || !mine.length) fail(400, 'There is nothing waiting for your answer here. Reload the page.');
  const accept = req.body?.accept === true;
  const note = str(req.body?.note, 300);
  const at = new Date().toISOString();
  const changed = [];
  const skipped = [];
  for (const x of mine) {
    Object.assign(x, { reply: accept ? 'accepted' : 'declined', replyNote: note, repliedAt: at });
    if (!accept || !x.bookingId) continue;
    const b = db.bookings.find((y) => y.id === x.bookingId);
    if (!b || !isActive(b) || !(b.assignees || []).some((a) => a.id === leave.personId)) continue; // already changed by hand
    try {
      changed.push({ booking: b, before: replaceAssignee(b, leave.personId, p.id, netPay(leave, x)) });
      Object.assign(b.assignees.find((a) => a.id === p.id), { state: 'confirmed', confirmedAt: at });
    } catch (e) {
      skipped.push(`${b.ref}: ${e.message}`);
    }
  }
  const allIn = leave.picks.every((x) => replyOf(x) === 'accepted');
  if (!accept) leave.status = 'pending';
  else if (allIn) leave.status = 'approved';
  await save();
  for (const { booking, before } of changed) teamChanged(booking, before);
  const owner = personOf(leave.personId);
  const what = mine.map((x) => `${x.categoryName || ROLES[x.role] || 'Teammate'} ${pickWhen(x)}`).join('; ');
  if (accept) {
    alertAdmin(`${p.name} accepted ✅`, `In ${leave.personName}'s place · ${what}${allIn ? ' · everyone has accepted' : ''}${skipped.length ? ` · not handed over: ${skipped.join('; ')}` : ''}`, '/admin?tab=leave', `leave-${leave.id}`);
    if (owner?.phone) notifyPhone(owner.phone, { title: allIn ? 'Team booking confirmed 🙏' : `${p.name} will go in your place`, body: what, url: '/team', tag: `leave-${leave.id}` }).catch(() => {});
  } else {
    alertAdmin(`${p.name} can't go — choose someone else`, `${leave.personName}'s team booking · ${what}${note ? ` · ${note}` : ''}`, '/admin?tab=leave', `leave-${leave.id}`);
  }
  res.json(teamPayload(p));
});

app.get('/api/team/chat', requireMember, async (req, res) => {
  const thread = threadOf('m', req.person.id);
  if (markRead(thread, 'other')) await save();
  res.json({ messages: messagesOf(thread), phone: db.settings.phone });
});

app.post('/api/team/chat', requireMember, async (req, res) => {
  throttle(`chat:${req.ip}`, 120);
  const thread = threadOf('m', req.person.id);
  const m = postMessage(thread, 'member', { text: readChatText(req.body) });
  await save();
  chatAlert(thread, m);
  res.status(201).json({ messages: messagesOf(thread) });
});

app.post('/api/team/password', requireMember, async (req, res) => {
  throttle(`pw:${req.ip}`, 10);
  res.json({ token: await changePassword(req.person, req.body, 'member') });
});

/* ---------- place search for the map location picker ---------- */

app.get('/api/geo/search', async (req, res) => {
  throttle(`geo:${req.ip}`, 300);
  const q = str(req.query.q, 120);
  if (q.length < 3) return res.json({ places: [] });
  try {
    res.json({ places: await searchPlaces(q) });
  } catch (e) {
    console.error('[sewa] Place search failed:', e.message);
    fail(502, 'Place search is not available right now. Use “My current location”, or try again shortly.');
  }
});

app.get('/api/geo/reverse', async (req, res) => {
  throttle(`geo:${req.ip}`, 300);
  const { lat, lng } = readLocation({ lat: req.query.lat, lng: req.query.lng });
  try {
    res.json({ label: await reversePlace(lat, lng) });
  } catch {
    res.json({ label: '' });
  }
});

/* ---------------- admin API ---------------- */

app.post('/api/admin/login', async (req, res) => {
  throttle(`login:${req.ip}`);
  const given = Buffer.from(String(req.body?.password || ''));
  const real = Buffer.from(ADMIN_PASSWORD);
  if (given.length !== real.length || !crypto.timingSafeEqual(given, real)) fail(401, 'Incorrect password.');
  attempts.delete(`login:${req.ip}`);
  res.json({ token: makeToken() });
});

app.use('/api/admin', requireAdmin);

app.post('/api/admin/push/subscribe', async (req, res) => {
  await addAdminSubscription(readSubscription(req.body?.subscription));
  res.json({ devices: adminDeviceCount() });
});

app.post('/api/admin/push/unsubscribe', async (req, res) => {
  await removeAdminSubscription(str(req.body?.endpoint, 1000));
  res.json({ devices: adminDeviceCount() });
});

app.post('/api/admin/push/test', async (_req, res) => {
  if (!adminDeviceCount()) fail(400, 'No admin device has notifications turned on yet.');
  await notifyAdmins({ title: 'Test notification ✅', body: 'Admin notifications are working on this device.', url: '/admin', tag: 'admin-test' });
  res.json({ devices: adminDeviceCount() });
});

app.get('/api/admin/data', async (_req, res) => {
  res.json({
    settings: db.settings,
    services: db.services,
    categories: db.categories || [],
    people: peopleView(),
    users: db.users.map((u) => ({ ...userView(u), bookings: db.bookings.filter((b) => ownsBooking(u, b)).length })),
    leaves: db.leaves,
    chats: threadsSummary(),
    roles: ROLES,
    docKinds: DOC_KINDS,
    slots: db.slots,
    blockedDates: db.blockedDates,
    blockedTimes: db.blockedTimes || [],
    gurpurabs: db.gurpurabs || [],
    everyoneDevices: everyoneCount(),
    bookings: db.bookings,
    notifyPhones: Object.keys(db.pushSubs || {}),
    adminDevices: adminDeviceCount(),
    today: todayKey(),
  });
});

app.put('/api/admin/settings', async (req, res) => {
  const b = req.body || {};
  const s = db.settings;
  // Validate before changing anything so a rejected save leaves settings untouched.
  const upiOn = 'upiEnabled' in b ? !!b.upiEnabled : s.upiEnabled;
  const upiId = 'upiId' in b ? str(b.upiId, 300) : s.upiId;
  if (upiOn && !upiId) fail(400, 'Enter your UPI ID, or turn UPI off.');
  if (upiId && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) fail(400, 'UPI ID looks wrong — it should look like name@okhdfcbank.');
  for (const key of ['siteName', 'gurmukhiTagline', 'tagline', 'about', 'aboutImage', 'phone', 'whatsapp', 'email', 'address', 'upiId', 'upiName', 'paymentNote']) {
    if (key in b) s[key] = str(b[key], key === 'about' || key === 'tagline' ? 1500 : 300);
  }
  for (const key of ['cashEnabled', 'upiEnabled', 'customTimeEnabled']) {
    if (key in b) s[key] = !!b[key];
  }
  for (const key of ['yearsOfSewa', 'programsDone', 'citiesCovered', 'maxAdvanceDays', 'offerMin', 'commissionAbove']) {
    if (key in b) s[key] = Math.max(0, Math.min(10000000, Math.round(Number(b[key]) || 0)));
  }
  if ('commissionRate' in b) s.commissionRate = Math.max(0, Math.min(100, Number(b.commissionRate) || 0));
  if (Array.isArray(b.gallery)) s.gallery = b.gallery.map((u) => str(u, 600)).filter(Boolean).slice(0, 40);
  if (Array.isArray(b.testimonials)) {
    s.testimonials = b.testimonials
      .map((t) => ({ name: str(t?.name, 80), place: str(t?.place, 80), text: str(t?.text, 500) }))
      .filter((t) => t.name && t.text)
      .slice(0, 30);
  }
  await save();
  res.json({ settings: s });
});

const readService = (b, existing = {}) => {
  const name = str(b.name, 80);
  if (name.length < 2) fail(400, 'Service name is required.');
  const validSlots = new Set(db.slots.map((s) => s.id));
  return {
    ...existing,
    name,
    gurmukhi: str(b.gurmukhi, 80),
    description: str(b.description, 600),
    duration: str(b.duration, 40),
    icon: str(b.icon, 30) || 'music',
    color: /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : '#FF9933',
    allowedSlots: Array.isArray(b.allowedSlots) ? b.allowedSlots.filter((id) => validSlots.has(id)) : [],
    active: b.active !== false,
  };
};

app.post('/api/admin/services', async (req, res) => {
  const service = readService(req.body || {});
  let id = slugify(service.name);
  while (db.services.some((s) => s.id === id)) id = `${id}-${uid().slice(0, 4)}`;
  service.id = id;
  db.services.push(service);
  await save();
  res.status(201).json({ services: db.services });
});

app.put('/api/admin/services/:id', async (req, res) => {
  const idx = db.services.findIndex((s) => s.id === req.params.id);
  if (idx < 0) fail(404, 'Service not found.');
  db.services[idx] = readService(req.body || {}, db.services[idx]);
  await save();
  res.json({ services: db.services });
});

app.delete('/api/admin/services/:id', async (req, res) => {
  const id = req.params.id;
  db.services = db.services.filter((s) => s.id !== id);
  for (const c of db.categories || []) c.serviceIds = c.serviceIds.filter((x) => x !== id);
  for (const p of db.people || []) p.skills = (p.skills || []).filter((k) => k.serviceId !== id);
  await save();
  res.json({ services: db.services, categories: db.categories, people: peopleView() });
});

/* ---------- categories ---------- */

const readCategory = (b, existing = {}) => {
  const name = str(b.name, 80);
  if (name.length < 2) fail(400, 'Category name is required.');
  const valid = new Set(db.services.map((s) => s.id));
  const serviceIds = Array.isArray(b.serviceIds) ? [...new Set(b.serviceIds.filter((id) => valid.has(id)))] : [];
  if (!serviceIds.length) fail(400, 'Tick at least one sewa for this category.');
  return {
    ...existing,
    name,
    gurmukhi: str(b.gurmukhi, 80),
    description: str(b.description, 400),
    serviceIds,
    icon: str(b.icon, 30) || 'music',
    color: /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : '#E9B44C',
    active: b.active !== false,
  };
};

app.post('/api/admin/categories', async (req, res) => {
  const category = readCategory(req.body || {});
  let id = slugify(category.name);
  while ((db.categories || []).some((c) => c.id === id)) id = `${id}-${uid().slice(0, 4)}`;
  db.categories = [...(db.categories || []), { id, ...category }];
  await save();
  res.status(201).json({ categories: db.categories });
});

app.put('/api/admin/categories/:id', async (req, res) => {
  const idx = (db.categories || []).findIndex((c) => c.id === req.params.id);
  if (idx < 0) fail(404, 'Category not found.');
  db.categories[idx] = readCategory(req.body || {}, db.categories[idx]);
  // A person can't keep a skill for a sewa that is no longer in this category.
  for (const p of db.people || []) p.skills = (p.skills || []).filter((k) => k.categoryId !== req.params.id || db.categories[idx].serviceIds.includes(k.serviceId));
  await save();
  res.json({ categories: db.categories, people: peopleView() });
});

app.delete('/api/admin/categories/:id', async (req, res) => {
  db.categories = (db.categories || []).filter((c) => c.id !== req.params.id);
  for (const p of db.people || []) p.skills = (p.skills || []).filter((k) => k.categoryId !== req.params.id);
  await save();
  res.json({ categories: db.categories, people: peopleView() });
});

app.put('/api/admin/categories-order', async (req, res) => {
  const order = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const pos = (id) => (order.indexOf(id) < 0 ? 1e9 : order.indexOf(id));
  db.categories = [...(db.categories || [])].sort((a, b) => pos(a.id) - pos(b.id));
  await save();
  res.json({ categories: db.categories });
});

/* ---------- team (people) ---------- */

const readPerson = (b, existing = {}) => {
  const name = str(b.name, 80);
  if (name.length < 2) fail(400, 'Name is required.');
  const serviceIds = new Set(db.services.map((s) => s.id));
  const catById = new Map((db.categories || []).map((c) => [c.id, c]));
  const seen = new Set();
  const skills = (Array.isArray(b.skills) ? b.skills : [])
    .map((k) => ({ categoryId: str(k?.categoryId, 80), serviceId: str(k?.serviceId, 80) }))
    .filter((k) => serviceIds.has(k.serviceId) && (!k.categoryId || catById.get(k.categoryId)?.serviceIds.includes(k.serviceId)))
    .filter((k) => !seen.has(k.categoryId + '|' + k.serviceId) && seen.add(k.categoryId + '|' + k.serviceId));
  const phone = str(b.phone, 20);
  if (phone && db.people.some((p) => p.id !== existing.id && samePhone(p.phone, phone))) fail(400, 'Another team member already has this mobile number.');
  const pay = b.defaultPay === '' || b.defaultPay == null ? null : Math.max(0, Math.min(10000000, Math.round(Number(b.defaultPay) || 0)));
  return { ...existing, name, phone, address: str(b.address, 300), role: ROLES[b.role] ? b.role : '', defaultPay: pay, skills, active: !existing.pending && b.active !== false };
};

// Approving a sign-up makes the person a normal (active) team member who can log in.
function approve(person, b) {
  if (!b.approve || !person.pending) return person;
  const { pending: _, ...rest } = person;
  return { ...rest, active: true, approvedAt: new Date().toISOString() };
}

// The admin sets (or resets) a team member's login password; it logs them out everywhere else.
async function applyPassword(person, password) {
  if (!password) return;
  if (!person.phone) fail(400, 'Add a mobile number first — team members log in with it.');
  person.passwordHash = await hashPassword(readPassword(password));
  person.tokenVersion = (person.tokenVersion || 0) + 1;
}

app.post('/api/admin/people', async (req, res) => {
  const person = { id: uid(), ...readPerson(req.body || {}) };
  await applyPassword(person, req.body?.password);
  db.people = [...(db.people || []), person];
  await save();
  res.status(201).json({ people: peopleView() });
});

app.put('/api/admin/people/:id', async (req, res) => {
  const idx = (db.people || []).findIndex((p) => p.id === req.params.id);
  if (idx < 0) fail(404, 'Person not found.');
  const wasPending = db.people[idx].pending;
  const person = approve(readPerson(req.body || {}, db.people[idx]), req.body || {});
  await applyPassword(person, req.body?.password);
  db.people[idx] = person;
  await save();
  if (wasPending && !person.pending) notifyPhone(person.phone, { title: 'Your team account is approved 🙏', body: 'You can now log in to see your sewas.', url: '/team', tag: `approved-${person.id}` }).catch(() => {});
  res.json({ people: peopleView() });
});

app.delete('/api/admin/people/:id', async (req, res) => {
  // Bookings keep the name they were assigned with, so history stays readable.
  const person = db.people.find((p) => p.id === req.params.id);
  db.people = (db.people || []).filter((p) => p.id !== req.params.id);
  await save();
  await Promise.all(Object.values(person?.docs || {}).map((d) => kv.set(`doc-${d.id}`, null)));
  res.json({ people: peopleView() });
});

// Assign team members to one booking (one time slot). Only people with a matching skill are allowed.
app.patch('/api/admin/bookings/:id/assign', async (req, res) => {
  const booking = db.bookings.find((b) => b.id === req.params.id);
  if (!booking) fail(404, 'Booking not found.');
  const ids = Array.isArray(req.body?.personIds) ? [...new Set(req.body.personIds)] : [];
  // People already on the booking keep their bhet and confirmation; new ones start with their usual bhet.
  const current = new Map((booking.assignees || []).map((a) => [a.id, a]));
  const assignees = ids.map((id) => {
    const person = (db.people || []).find((p) => p.id === id);
    if (!person) fail(400, 'That team member no longer exists.');
    if (current.has(id)) return { ...current.get(id), name: person.name };
    if (!canDo(person, booking)) fail(400, `${person.name} does not do ${booking.serviceName}${booking.categoryName ? ` in ${booking.categoryName}` : ''}.`);
    return { id: person.id, name: person.name, pay: person.defaultPay ?? null, state: 'assigned' };
  });
  const before = (booking.assignees || []).map((a) => a.id);
  booking.assignees = assignees;
  booking.updatedAt = new Date().toISOString();
  await save();
  teamChanged(booking, before);
  res.json({ booking });
});

app.put('/api/admin/services-order', async (req, res) => {
  const order = Array.isArray(req.body?.ids) ? req.body.ids : [];
  db.services.sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
  });
  await save();
  res.json({ services: db.services });
});

app.put('/api/admin/slots', async (req, res) => {
  const list = Array.isArray(req.body?.slots) ? req.body.slots : fail(400, 'Invalid slots.');
  const seen = new Set();
  const slots = list.map((s) => {
    const label = str(s.label, 40);
    if (!label) fail(400, 'Every slot needs a name.');
    if (!TIME_RE.test(s.start) || !TIME_RE.test(s.end)) fail(400, `Check the times for “${label}”.`);
    if (s.end <= s.start) fail(400, `“${label}” must end after it starts.`);
    let id = str(s.id, 60) || slugify(label);
    while (seen.has(id)) id = `${id}-${uid().slice(0, 4)}`;
    seen.add(id);
    return { id, label, start: s.start, end: s.end };
  });
  slots.sort((a, b) => a.start.localeCompare(b.start));
  db.slots = slots;
  // Drop references to removed slots from services.
  for (const svc of db.services) svc.allowedSlots = (svc.allowedSlots || []).filter((id) => seen.has(id));
  await save();
  res.json({ slots: db.slots, services: db.services });
});

app.put('/api/admin/blocked-dates', async (req, res) => {
  const list = Array.isArray(req.body?.dates) ? req.body.dates : [];
  db.blockedDates = [...new Set(list.filter((d) => DATE_RE.test(d)))].sort();
  await save();
  res.json({ blockedDates: db.blockedDates });
});

// Block one or more times on a date: fixed slots ({ slotIds }) and/or a range ({ start, end }).
app.post('/api/admin/blocked-times', async (req, res) => {
  const b = req.body || {};
  const date = str(b.date, 10);
  if (!DATE_RE.test(date)) fail(400, 'Choose a date.');
  const note = str(b.note, 200);
  const ranges = (Array.isArray(b.slotIds) ? b.slotIds : []).map((id) => {
    const slot = db.slots.find((s) => s.id === id);
    if (!slot) fail(400, 'That time slot no longer exists.');
    return { start: slot.start, end: slot.end, label: slot.label };
  });
  if (b.start || b.end) {
    const start = str(b.start, 5);
    const end = str(b.end, 5);
    if (!TIME_RE.test(start) || !TIME_RE.test(end) || end <= start) fail(400, 'Enter a start and an end time (end after start).');
    ranges.push({ start, end, label: str(b.label, 60) });
  }
  if (!ranges.length) fail(400, 'Choose at least one time slot, or enter a time.');
  db.blockedTimes ||= [];
  for (const r of ranges) {
    if (db.blockedTimes.some((t) => t.date === date && t.start === r.start && t.end === r.end)) continue;
    db.blockedTimes.push({ id: uid(), date, ...r, note, createdAt: new Date().toISOString() });
  }
  db.blockedTimes.sort((x, y) => (x.date + x.start).localeCompare(y.date + y.start));
  await save();
  res.status(201).json({ blockedTimes: db.blockedTimes });
});

app.delete('/api/admin/blocked-times/:id', async (req, res) => {
  db.blockedTimes = (db.blockedTimes || []).filter((t) => t.id !== req.params.id);
  await save();
  res.json({ blockedTimes: db.blockedTimes });
});

app.patch('/api/admin/bookings/:id', async (req, res) => {
  const booking = db.bookings.find((b) => b.id === req.params.id);
  if (!booking) fail(404, 'Booking not found.');
  const status = req.body?.status;
  if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) fail(400, 'Invalid status.');
  const prevStatus = booking.status;
  const prevAmount = booking.amount;
  // Validate everything before changing the booking.
  const restoring = status !== 'cancelled' && booking.status === 'cancelled';
  const amount = status === 'confirmed' ? readAmount(req.body.amount) : null;
  const reason = str(req.body.reason, 500);
  if (status === 'cancelled' && reason.length < 3) fail(400, 'Please give a reason for cancelling.');
  if (restoring) Object.assign(booking, { cancelReason: '', cancelledBy: '', cancelledAt: '' });
  if (status === 'cancelled' || restoring) booking.cancelRequest = null;
  if (status === 'cancelled') {
    Object.assign(booking, { cancelReason: reason, cancelledBy: 'admin', cancelledAt: new Date().toISOString() });
  }
  if (status === 'confirmed') {
    billBooking(booking, amount);
    settleOffer(booking, amount);
  }
  booking.status = status;
  booking.updatedAt = new Date().toISOString();
  await save();
  if (status === 'confirmed' && prevStatus !== 'confirmed') notifyBooking(booking, 'confirmed');
  else if (status === 'confirmed' && prevAmount !== booking.amount) notifyBooking(booking, 'billUpdated');
  if (status === 'cancelled' && prevStatus !== 'cancelled') {
    notifyBooking(booking, 'cancelled');
    notifyTeamCancelled(booking);
  }
  res.json({ booking });
});

app.patch('/api/admin/bookings/:id/cancel-request', async (req, res) => {
  const booking = db.bookings.find((b) => b.id === req.params.id);
  if (!booking) fail(404, 'Booking not found.');
  const request = booking.cancelRequest;
  if (request?.status !== 'pending') fail(400, 'There is no pending cancellation request.');
  if (req.body?.action === 'approve') {
    Object.assign(booking, {
      status: 'cancelled',
      cancelReason: request.reason,
      cancelledBy: 'customer',
      cancelledAt: new Date().toISOString(),
      cancelRequest: null,
    });
  } else if (req.body?.action === 'reject') {
    booking.cancelRequest = { ...request, status: 'rejected', note: str(req.body.note, 300) };
  } else {
    fail(400, 'Choose approve or reject.');
  }
  booking.updatedAt = new Date().toISOString();
  await save();
  notifyBooking(booking, req.body.action === 'approve' ? 'requestApproved' : 'requestRejected');
  if (req.body.action === 'approve') notifyTeamCancelled(booking);
  res.json({ booking });
});

app.patch('/api/admin/bookings/:id/payment', async (req, res) => {
  const booking = db.bookings.find((b) => b.id === req.params.id);
  if (!booking) fail(404, 'Booking not found.');
  const b = req.body || {};
  if (b.status === 'paid') {
    if (!['upi', 'cash'].includes(b.method)) fail(400, 'Choose UPI or Cash.');
    const amount = readAmount(b.amount);
    Object.assign(booking, {
      paymentMethod: b.method,
      paymentStatus: 'paid',
      amount,
      utr: b.method === 'upi' ? str(b.utr, 40) || booking.utr || '' : '',
      paymentNote: str(b.note, 300),
      paidAt: new Date().toISOString(),
    });
  } else if (b.status === 'unpaid') {
    Object.assign(booking, { paymentStatus: 'unpaid', utr: '', paidAt: '', paymentNote: '' });
  } else {
    fail(400, 'Invalid payment status.');
  }
  await save();
  if (b.status === 'paid') notifyBooking(booking, 'paid');
  res.json({ booking });
});


function billBooking(booking, amount) {
  booking.amount = amount;
  if (!booking.billNo) {
    db.meta.billSeq = (db.meta.billSeq || 0) + 1;
    booking.billNo = `${new Date().getFullYear()}-${String(db.meta.billSeq).padStart(4, '0')}`;
  }
  booking.billedAt = new Date().toISOString();
}

// Setting the bill answers a waiting offer: accepted when the amounts match, otherwise countered.
function settleOffer(booking, amount) {
  const offer = booking.offer;
  if (offer?.status !== 'pending') return;
  Object.assign(offer, { status: amount === offer.amount ? 'accepted' : 'countered', counter: amount, answeredAt: new Date().toISOString() });
  if (!booking.userId) return;
  const text =
    offer.status === 'accepted'
      ? `Your offer of ${rupee(offer.amount)} for ${booking.ref} is accepted 🙏`
      : `For ${booking.ref} the bill is ${rupee(amount)} (your offer was ${rupee(offer.amount)}).`;
  postMessage(threadOf('u', booking.userId), 'admin', { kind: 'system', text, bookingId: booking.id, bookingRef: booking.ref });
}

/* ---------- admin: offers, team bhet, duty cancellations, replacements ---------- */

const findBooking = (id) => db.bookings.find((b) => b.id === id) || fail(404, 'Booking not found.');
const findAssignee = (booking, personId) => (booking.assignees || []).find((a) => a.id === personId) || fail(404, 'That person is not on this booking.');

// Accept the customer's offer as the bill (confirming a pending booking), or decline it with a message.
app.patch('/api/admin/bookings/:id/offer', async (req, res) => {
  const booking = findBooking(req.params.id);
  const offer = booking.offer;
  if (!offer) fail(400, 'This booking has no offer.');
  if (!isActive(booking)) fail(400, `This booking is ${booking.status}.`);
  const prevStatus = booking.status;
  if (req.body?.action === 'accept') {
    if (booking.paymentStatus === 'paid') fail(400, 'This booking is already paid.');
    offer.status = 'pending'; // so settleOffer records it as accepted
    billBooking(booking, offer.amount);
    settleOffer(booking, offer.amount);
    booking.status = 'confirmed';
  } else if (req.body?.action === 'decline') {
    const note = str(req.body.note, 300);
    Object.assign(offer, { status: 'declined', note: note || offer.note, reply: note, answeredAt: new Date().toISOString() });
    if (booking.userId) {
      const m = postMessage(threadOf('u', booking.userId), 'admin', {
        kind: 'system',
        text: `About your offer of ${rupee(offer.amount)} for ${booking.ref}: ${note || 'we are not able to accept this amount. Please message us to talk about it.'}`,
        bookingId: booking.id,
        bookingRef: booking.ref,
      });
      chatAlert(m.thread, m);
    }
  } else {
    fail(400, 'Choose accept or decline.');
  }
  booking.updatedAt = new Date().toISOString();
  await save();
  if (req.body.action === 'accept') notifyBooking(booking, prevStatus === 'confirmed' ? 'billUpdated' : 'confirmed');
  res.json({ booking });
});

// Bhet (payment) for one team member on one booking. Answers their pending request for it, if any.
app.patch('/api/admin/bookings/:id/assignees/:personId', async (req, res) => {
  const booking = findBooking(req.params.id);
  const a = findAssignee(booking, req.params.personId);
  const raw = req.body?.pay;
  const pay = raw === '' || raw == null ? null : Math.max(0, Math.min(10000000, Math.round(Number(raw))));
  if (pay !== null && !Number.isFinite(pay)) fail(400, 'Enter the amount in rupees.');
  const changed = a.pay !== pay;
  a.pay = pay;
  const thread = threadOf('m', a.id);
  for (const m of db.messages) if (m.thread === thread && m.kind === 'pay-request' && m.bookingId === booking.id && m.status === 'pending') Object.assign(m, { status: 'answered', answer: pay });
  if (changed && pay !== null) postMessage(thread, 'admin', { kind: 'system', text: `Your bhet for ${booking.ref} (${slotText(booking)}) is now ${rupee(pay)}.`, bookingId: booking.id, bookingRef: booking.ref });
  booking.updatedAt = new Date().toISOString();
  await save();
  if (changed && pay !== null) notifyPerson(personOf(a.id), 'pay', booking, { pay });
  res.json({ booking });
});

// A team member asked to be taken off this booking: approve (removes them) or reject.
app.patch('/api/admin/bookings/:id/assignees/:personId/cancel', async (req, res) => {
  const booking = findBooking(req.params.id);
  const a = findAssignee(booking, req.params.personId);
  if (a.cancelRequest?.status !== 'pending') fail(400, 'There is no pending request.');
  const person = personOf(a.id);
  const note = str(req.body?.note, 300);
  if (req.body?.action === 'approve') {
    booking.assignees = booking.assignees.filter((x) => x.id !== a.id);
    notifyPerson(person, 'cancelApproved', booking);
  } else if (req.body?.action === 'reject') {
    a.cancelRequest = { ...a.cancelRequest, status: 'rejected', note };
    notifyPerson(person, 'cancelRejected', booking, { note });
  } else {
    fail(400, 'Choose approve or reject.');
  }
  booking.updatedAt = new Date().toISOString();
  await save();
  res.json({ booking });
});

// Put another team member in someone's place on a booking (e.g. while they are on leave). The bhet stays the same.
function replaceAssignee(booking, fromId, toId, pay) {
  const idx = (booking.assignees || []).findIndex((a) => a.id === fromId);
  if (idx < 0) fail(400, 'That person is not on this booking.');
  const to = db.people.find((p) => p.id === toId);
  if (!to) fail(400, 'Choose who should take their place.');
  if (!to.active) fail(400, `${to.name} is inactive.`);
  if (booking.assignees.some((a) => a.id === toId)) fail(400, `${to.name} is already on this booking.`);
  if (!canDo(to, booking)) fail(400, `${to.name} does not do ${booking.serviceName}${booking.categoryName ? ` in ${booking.categoryName}` : ''}.`);
  const before = booking.assignees.map((a) => a.id);
  const from = booking.assignees[idx];
  booking.assignees[idx] = { id: to.id, name: to.name, pay: pay ?? from.pay ?? to.defaultPay ?? null, state: 'assigned', replaces: from.name };
  booking.updatedAt = new Date().toISOString();
  return before;
}

app.post('/api/admin/bookings/:id/replace', async (req, res) => {
  const booking = findBooking(req.params.id);
  const before = replaceAssignee(booking, str(req.body?.fromId, 40), str(req.body?.toId, 40));
  await save();
  teamChanged(booking, before);
  res.json({ booking });
});

/* ---------- admin: team bookings (stored as leave) ---------- */

const leaveWhen = (l) => `${shortDate(l.from)}${l.to !== l.from ? ` – ${shortDate(l.to)}` : ''}`;
// Tell everyone the admin asked (still waiting, or accepted without a sewa — a sewa already handed over stays theirs).
function tellAssigned(leave, title) {
  for (const id of new Set((leave.picks || []).filter((x) => x.personId && (replyOf(x) === 'waiting' || (replyOf(x) === 'accepted' && !x.bookingId))).map((x) => x.personId))) {
    const who = personOf(id);
    const mine = leave.picks.filter((x) => x.personId === id);
    if (who?.phone) notifyPhone(who.phone, { title, body: mine.map((x) => `${pickWhen(x)} · ₹${netPay(leave, x)}`).join('; '), url: '/team', tag: `leave-${leave.id}-${id}` }).catch(() => {});
  }
}

/* Assign a person to every request and ask them (approve), reject, cancel, answer a cancellation request (keep), or
 * mark the commission received (paid / unpaid). */
app.patch('/api/admin/leaves/:id', async (req, res) => {
  const leave = db.leaves.find((l) => l.id === req.params.id);
  if (!leave) fail(404, 'Team booking not found.');
  const action = req.body?.action;
  if (!['approve', 'reject', 'cancel', 'keep', 'paid', 'unpaid', 'settle', 'unsettle'].includes(action)) fail(400, 'Choose approve or reject.');
  const note = str(req.body?.note, 300);
  const now = new Date().toISOString();
  const owner = personOf(leave.personId);
  const tellOwner = (title, body = leaveWhen(leave)) => owner?.phone && notifyPhone(owner.phone, { title, body: `${body}${note ? ` · ${note}` : ''}`, url: '/team', tag: `leave-${leave.id}` }).catch(() => {});

  if (action === 'paid' || action === 'unpaid') {
    Object.assign(leave, { commissionPaid: action === 'paid', commissionPaidAt: action === 'paid' ? now : '' });
  } else if (action === 'settle' || action === 'unsettle') {
    // Cash: one person handed over the commission they collected on this booking (or that is undone).
    const personId = str(req.body?.personId, 40);
    const theirs = (leave.picks || []).filter((x) => x.personId === personId && replyOf(x) === 'accepted');
    if (!theirs.length) fail(400, 'That person has nothing accepted on this team booking.');
    for (const x of theirs) x.commissionPaidAt = action === 'settle' ? now : '';
    // The member's bill counts as settled once everyone's commission is in.
    const accepted = leave.picks.filter((x) => replyOf(x) === 'accepted');
    Object.assign(leave, { commissionPaid: accepted.length > 0 && accepted.every((x) => x.commissionPaidAt), commissionPaidAt: action === 'settle' ? now : '' });
    const who = personOf(personId);
    if (action === 'settle' && who?.phone) notifyPhone(who.phone, { title: 'Commission received ✓', body: `${rupee(theirs.reduce((t, x) => t + pickCommission(leave, x), 0))} for ${leave.personName}'s team booking — thank you 🙏`, url: '/team?tab=leave', tag: `leave-${leave.id}-${personId}` }).catch(() => {});
  } else if (action === 'keep') {
    if (leave.cancelRequest?.status !== 'pending') fail(400, 'There is no pending cancellation request.');
    leave.cancelRequest = { ...leave.cancelRequest, status: 'rejected', note };
    tellOwner('Team booking stays as it is');
  } else if (action === 'approve') {
    if (leave.status !== 'pending' && leave.status !== 'assigned') fail(400, `This team booking is already ${leave.status}.`);
    // A person for every request (by its position) not yet accepted; each is asked and gets the bhet that was offered.
    const assign = req.body?.assign && typeof req.body.assign === 'object' ? req.body.assign : {};
    const asked = [];
    const chosen = (leave.picks || []).map((x, i) => {
      if (replyOf(x) === 'accepted') return { ...x, name: personOf(x.personId)?.name || '' };
      const id = str(assign[i] ?? (replyOf(x) === 'declined' ? '' : x.personId) ?? '', 40);
      const what = `${ROLES[x.role] || 'the teammate'} on ${pickWhen(x)}`;
      if (!id) fail(400, `Choose who goes as ${what}.`);
      const who = db.people.find((q) => q.id === id && q.active && !q.pending && q.id !== leave.personId);
      if (!who) fail(400, `Choose an active team member as ${what}.`);
      if (id === x.personId && replyOf(x) === 'waiting') return { ...x, name: who.name };
      asked.push(i);
      return { ...x, personId: id, name: who.name, reply: 'waiting', replyNote: '', repliedAt: '' };
    });
    // One person can't be in two places at once (no time = the whole day).
    const span = (x) => [x.start || '00:00', x.end || '24:00'];
    for (const [i, x] of chosen.entries()) {
      const clash = chosen.slice(i + 1).find((y) => y.personId === x.personId && y.date === x.date && overlaps(...span(x), ...span(y)));
      if (clash) fail(400, `${x.name} would be in two places at once on ${shortDate(x.date)}. Choose someone else for one of them.`);
    }
    leave.picks = chosen.map(({ name: _, ...x }) => x);
    leave.status = leave.picks.every((x) => replyOf(x) === 'accepted') ? 'approved' : 'assigned';
    for (const id of new Set(asked.map((i) => leave.picks[i].personId))) {
      const who = personOf(id);
      const mine = asked.map((i) => leave.picks[i]).filter((x) => x.personId === id);
      if (who?.phone) {
        notifyPhone(who.phone, {
          title: `${leave.emergency ? '🚨 ' : ''}Can you go in ${leave.personName}'s place? 🙏`,
          body: `${mine.map((x) => `${x.categoryName || ROLES[x.role] || 'Teammate'} ${pickWhen(x)} · ₹${netPay(leave, x)}`).join('; ')} · accept or decline on your Team booking page`,
          url: '/team?tab=leave',
          tag: `leave-${leave.id}-${id}`,
        }).catch(() => {});
      }
    }
    if (asked.length) tellOwner('People assigned 🙏', `${leaveWhen(leave)} · waiting for them to accept`);
  } else {
    if (action === 'reject' && leave.status !== 'pending' && leave.status !== 'assigned') fail(400, 'Only a waiting team booking can be rejected — cancel it instead.');
    if (action === 'cancel' && !liveLeave(leave)) fail(400, `This team booking is already ${leave.status}.`);
    tellAssigned(leave, `${leave.personName}'s team booking was ${action === 'reject' ? 'not approved' : 'cancelled'} — you're not needed`);
    leave.status = action === 'reject' ? 'rejected' : 'cancelled';
    if (leave.cancelRequest?.status === 'pending') leave.cancelRequest = { ...leave.cancelRequest, status: 'approved', note };
    leave.note = note;
    tellOwner(action === 'reject' ? 'Team booking not approved' : 'Team booking cancelled');
  }
  if (!['paid', 'unpaid', 'settle', 'unsettle', 'keep'].includes(action)) leave.decidedAt = now;
  await save();
  res.json({ leaves: db.leaves });
});

// Remove a team booking for good. A live one is cancelled first, so the people asked hear about it.
app.delete('/api/admin/leaves/:id', async (req, res) => {
  const leave = db.leaves.find((l) => l.id === req.params.id);
  if (!leave) fail(404, 'Team booking not found.');
  if (liveLeave(leave) && leave.to >= todayKey()) tellAssigned(leave, `${leave.personName}'s team booking was cancelled — you're not needed`);
  db.leaves = db.leaves.filter((l) => l !== leave);
  await save();
  res.json({ leaves: db.leaves });
});

/* ---------- admin: chat ---------- */

function threadsSummary() {
  return db.threads
    .filter((t) => t.lastAt)
    .map((t) => {
      const [kind, id] = t.id.split(':');
      const who = kind === 'u' ? db.users.find((u) => u.id === id) : personOf(id);
      const last = db.messages.findLast((m) => m.thread === t.id);
      return {
        id: t.id,
        kind: kind === 'u' ? 'user' : 'member',
        name: who?.name || 'Removed account',
        phone: who?.phone || '',
        role: kind === 'm' ? ROLES[who?.role] || '' : '',
        lastAt: t.lastAt,
        last: last ? { text: last.text, from: last.from, kind: last.kind } : null,
        unread: unreadIn(t.id, 'admin'),
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

function chatTarget(thread) {
  const [kind, id] = String(thread).split(':');
  const who = kind === 'u' ? db.users.find((u) => u.id === id) : kind === 'm' ? personOf(id) : null;
  if (!who) fail(404, 'That account no longer exists.');
  return { kind: kind === 'u' ? 'user' : 'member', who };
}

app.get('/api/admin/chats', async (_req, res) => {
  res.json({ chats: threadsSummary() });
});

app.get('/api/admin/chats/:thread', async (req, res) => {
  const thread = req.params.thread;
  const { kind, who } = chatTarget(thread);
  if (markRead(thread, 'admin')) await save();
  res.json({ messages: messagesOf(thread), with: { kind, name: who.name, phone: who.phone || '', role: ROLES[who.role] || '' } });
});

app.post('/api/admin/chats/:thread', async (req, res) => {
  const thread = req.params.thread;
  chatTarget(thread);
  const m = postMessage(thread, 'admin', { text: readChatText(req.body) });
  await save();
  chatAlert(thread, m);
  res.status(201).json({ messages: messagesOf(thread), chats: threadsSummary() });
});

/* ---------- admin: customer accounts ---------- */

app.post('/api/admin/users/:id/password', async (req, res) => {
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) fail(404, 'Account not found.');
  user.passwordHash = await hashPassword(readPassword(req.body?.password));
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await save();
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', async (req, res) => {
  // Bookings stay (they keep the name and number); only the login and its chat are removed.
  const thread = threadOf('u', req.params.id);
  db.users = db.users.filter((u) => u.id !== req.params.id);
  db.messages = db.messages.filter((m) => m.thread !== thread);
  db.threads = db.threads.filter((t) => t.id !== thread);
  await save();
  res.json({ ok: true });
});

/* ---------- admin: Gurpurab ---------- */

const sortGurpurabs = () => db.gurpurabs.sort((a, b) => a.date.localeCompare(b.date));
const readGurpurab = (b, existing = {}) => {
  if (!GURPURAB_KINDS[b.kind]) fail(400, 'Choose Prakash Purab, Jyoti Jot Divas or Shaheedi Purab.');
  const name = str(b.name, 120);
  if (name.length < 2) fail(400, 'Enter the name, e.g. Sri Guru Nanak Dev Ji.');
  const date = str(b.date, 10);
  if (!DATE_RE.test(date)) fail(400, 'Choose the date.');
  const images = (Array.isArray(b.images) ? b.images : []).filter((id) => /^[a-f0-9]{16}$/.test(id)).slice(0, 8);
  return { ...existing, kind: b.kind, name, gurmukhi: str(b.gurmukhi, 120), date, images, active: b.active !== false, noticeSentFor: existing.noticeSentFor || '' };
};
const dropImages = (ids) => Promise.all(ids.map((id) => kv.set(`gp-img-${id}`, null)));

app.post('/api/admin/gurpurabs', async (req, res) => {
  db.gurpurabs = [...(db.gurpurabs || []), { id: uid(), ...readGurpurab(req.body || {}) }];
  sortGurpurabs();
  await save();
  res.status(201).json({ gurpurabs: db.gurpurabs });
});

app.put('/api/admin/gurpurabs/:id', async (req, res) => {
  const g = (db.gurpurabs || []).find((x) => x.id === req.params.id);
  if (!g) fail(404, 'Not found.');
  const next = readGurpurab(req.body || {}, g);
  await dropImages((g.images || []).filter((id) => !next.images.includes(id)));
  Object.assign(g, next);
  sortGurpurabs();
  await save();
  res.json({ gurpurabs: db.gurpurabs });
});

app.delete('/api/admin/gurpurabs/:id', async (req, res) => {
  const g = (db.gurpurabs || []).find((x) => x.id === req.params.id);
  if (g) await dropImages(g.images || []);
  db.gurpurabs = (db.gurpurabs || []).filter((x) => x.id !== req.params.id);
  await save();
  res.json({ gurpurabs: db.gurpurabs });
});

// Send the "upcoming Gurpurab" notification to everyone right now.
app.post('/api/admin/gurpurabs/:id/notify', async (req, res) => {
  const g = (db.gurpurabs || []).find((x) => x.id === req.params.id);
  if (!g) fail(404, 'Not found.');
  if (g.date < todayKey()) fail(400, 'This day has passed — change its date to next year first.');
  if (!everyoneCount()) fail(400, 'Nobody has turned on notifications yet.');
  const sent = await sendGurpurabNotice(g);
  res.json({ gurpurabs: db.gurpurabs, sent });
});

app.post(GP_IMAGE_PATH, express.json({ limit: '6mb' }), async (req, res) => {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.dataUrl || '');
  if (!match) fail(400, 'Please upload a PNG, JPG or WebP image.');
  if (Buffer.byteLength(match[2], 'base64') > 4 * 1024 * 1024) fail(400, 'Image is too large (max 4 MB).');
  const id = uid();
  await kv.set(`gp-img-${id}`, { type: match[1], data: match[2] });
  res.status(201).json({ id, url: gpImageUrl(id) });
});

app.post(QR_PATH, express.json({ limit: '4mb' }), async (req, res) => {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.dataUrl || '');
  if (!match) fail(400, 'Please upload a PNG, JPG or WebP image.');
  const data = Buffer.from(match[2], 'base64');
  if (data.length > 3 * 1024 * 1024) fail(400, 'Image is too large (max 3 MB).');
  qrCache = { type: match[1], data: match[2] };
  await kv.set('upi-qr', qrCache);
  db.settings.upiQr = `/api/upi-qr?v=${Date.now()}`;
  await save();
  res.json({ settings: db.settings });
});

app.delete(QR_PATH, async (_req, res) => {
  qrCache = null;
  await kv.set('upi-qr', null);
  db.settings.upiQr = '';
  await save();
  res.json({ settings: db.settings });
});

// Bulk delete (e.g. clearing out test bookings). Removes the records permanently.
app.post('/api/admin/bookings/delete', async (req, res) => {
  const ids = new Set(Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === 'string') : []);
  if (!ids.size) fail(400, 'Select at least one booking.');
  const before = db.bookings.length;
  db.bookings = db.bookings.filter((b) => !ids.has(b.id));
  await save();
  res.json({ deleted: before - db.bookings.length });
});

app.delete('/api/admin/bookings/:id', async (req, res) => {
  db.bookings = db.bookings.filter((b) => b.id !== req.params.id);
  await save();
  res.json({ ok: true });
});

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));

/* ---------------- static (production) ---------------- */

const dist = path.resolve(__dirname, '../dist');
if (fs.existsSync(dist)) {
  app.get(['/sw.js', '/manifest.webmanifest'], (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(dist, req.path));
  });
  app.use(express.static(dist, { maxAge: '7d', index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Server error. Please try again.' : err.message });
});

/* ---------- Gurpurab: Prakash / Jyoti Jot / Shaheedi days ---------- */

const gpImageUrl = (imgId) => `/api/gurpurab-images/${imgId}`;
const gpKind = (g) => GURPURAB_KINDS[g.kind] || GURPURAB_KINDS.prakash;
const upcomingGurpurabs = () =>
  (db.gurpurabs || []).filter((g) => g.active && g.date >= todayKey()).sort((a, b) => a.date.localeCompare(b.date));
const publicGurpurab = (g) => ({
  id: g.id,
  kind: g.kind,
  kindLabel: gpKind(g).label,
  kindGurmukhi: gpKind(g).gurmukhi,
  name: g.name,
  gurmukhi: g.gurmukhi,
  date: g.date,
  images: (g.images || []).map(gpImageUrl),
});

// "One month to go" goes out at 10 AM, one calendar month before the day.
const noticeAt = (g) => subMonths(new Date(`${g.date}T10:00:00`), 1).getTime();
const NOTICE_GRACE = 3 * 24 * 60 * 60 * 1000; // still send if the server was asleep at that moment

async function sendGurpurabNotice(g) {
  const days = Math.round((new Date(`${g.date}T00:00:00`) - new Date(`${todayKey()}T00:00:00`)) / 86400000);
  const when = format(new Date(`${g.date}T00:00:00`), 'EEEE, d MMMM');
  const sent = await notifyEveryone({
    title: `🙏 ${gpKind(g).label} — ${g.name}`,
    body: `${when}${days > 1 ? ` · ${days} days to go` : days === 1 ? ' · tomorrow' : ''}. Book Gurbani Kirtan sewa for the Gurpurab.`,
    url: `/?gurpurab=${encodeURIComponent(g.id)}`,
    tag: `gp-${g.id}-${g.date}`,
    ...(g.images?.[0] && { image: gpImageUrl(g.images[0]) }),
  });
  g.noticeSentFor = g.date;
  g.noticeSentAt = new Date().toISOString();
  g.noticeDevices = sent;
  await save();
  return sent;
}

async function sendGurpurabNotices() {
  const now = Date.now();
  for (const g of upcomingGurpurabs()) {
    if (g.noticeSentFor === g.date) continue;
    const at = noticeAt(g);
    if (now >= at && now < at + NOTICE_GRACE) await sendGurpurabNotice(g);
  }
}

// Team reminders: checked every minute (the keep-alive below keeps the server awake for this).
setInterval(() => {
  sendReminders().catch((e) => console.error('[sewa] Reminders failed:', e));
  sendGurpurabNotices().catch((e) => console.error('[sewa] Gurpurab notices failed:', e));
}, 60 * 1000);
sendReminders().catch(() => {});
sendGurpurabNotices().catch(() => {});

// Free hosting plans put the site to sleep when idle. Render sets RENDER_EXTERNAL_URL itself;
// on other hosts set KEEP_ALIVE_URL to the public address. KEEP_ALIVE=off disables it.
const keepAliveUrl = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
if (keepAliveUrl && process.env.KEEP_ALIVE !== 'off') {
  setInterval(() => fetch(`${keepAliveUrl.replace(/\/$/, '')}/api/health`).catch(() => {}), 10 * 60 * 1000);
  console.log(`[sewa] Keep-alive ping every 10 min → ${keepAliveUrl}/api/health`);
}

// Express 5 calls this with an error too when the server cannot start.
app.listen(PORT, (err) => {
  if (!err) return console.log(`[sewa] Running on http://localhost:${PORT}`);
  if (err.code === 'EADDRINUSE') {
    console.error(`[sewa] Port ${PORT} is already used by another program. Start with a different one, e.g.  PORT=3000 npm start`);
    process.exit(1);
  }
  throw err;
});
