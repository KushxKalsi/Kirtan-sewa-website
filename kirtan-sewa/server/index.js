import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db, save, uid, makeRef, slugify, DATA_DIR, initDb, kv } from './db.js';

await initDb();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5174;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'waheguru';
const SECRET = process.env.TOKEN_SECRET || db.meta.secret;
const TOKEN_TTL = 1000 * 60 * 60 * 12; // 12 hours

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
const smallJson = express.json({ limit: '300kb' });
// The QR upload carries an image, so it gets its own larger body limit.
app.use((req, res, next) => (req.path === QR_PATH ? next() : smallJson(req, res, next)));


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

const requireAdmin = (req, _res, next) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!verifyToken(token)) fail(401, 'Please log in again.');
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

const slotTaken = (date, slotId, exceptId) =>
  db.bookings.some((b) => b.date === date && b.slotId === slotId && isActive(b) && b.id !== exceptId);

const customerView = (b) => ({
  ref: b.ref,
  serviceId: b.serviceId,
  serviceName: b.serviceName,
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
});

const readAmount = (value) => {
  const amount = Math.round(Number(value) || 0);
  if (amount <= 0 || amount > 10000000) fail(400, 'Please enter the amount in rupees.');
  return amount;
};

/* ---------------- public API ---------------- */

app.get('/api/public', async (_req, res) => {
  res.json({
    settings: publicSettings(),
    services: db.services.filter((s) => s.active),
    slots: db.slots,
    blockedDates: db.blockedDates,
    today: todayKey(),
    now: nowHHMM(),
  });
});

app.get('/api/availability', async (req, res) => {
  const from = str(req.query.from, 10);
  const to = str(req.query.to, 10);
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) fail(400, 'Invalid date range.');
  const booked = db.bookings
    .filter((b) => isActive(b) && b.date >= from && b.date <= to)
    // Public on purpose: visitors can see what each slot is booked for and where.
    .map((b) => ({ date: b.date, slotId: b.slotId, serviceId: b.serviceId, serviceName: b.serviceName, location: b.address }));
  res.json({ booked, blockedDates: db.blockedDates, today: todayKey(), now: nowHHMM() });
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (d) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const MAX_ITEMS = 20;

// Checks one requested sewa/date/slot and returns what is needed to create it.
function readItem(item) {
  const service = db.services.find((s) => s.id === item?.serviceId && s.active);
  if (!service) fail(400, 'Please choose a sewa for every selected slot.');
  const date = str(item.date, 10);
  if (!DATE_RE.test(date)) fail(400, 'Please choose a valid date.');
  const slot = db.slots.find((s) => s.id === item.slotId);
  if (!slot) fail(400, 'Please choose a time slot.');
  const label = `${shortDate(date)}, ${slot.label}`;
  if (date < todayKey()) fail(400, `${label}: that date has already passed.`);
  if (date > addDaysKey(Number(db.settings.maxAdvanceDays) || 365)) fail(400, `${label}: that date is too far ahead to book yet.`);
  if (db.blockedDates.includes(date)) fail(409, `${shortDate(date)}: the jatha is not available on that date.`);
  if (service.allowedSlots?.length && !service.allowedSlots.includes(slot.id)) fail(400, `${label}: ${service.name} is not offered in this slot.`);
  if (date === todayKey() && slot.start <= nowHHMM()) fail(400, `${label}: that time slot has already started.`);
  if (slotTaken(date, slot.id)) fail(409, `${label} was just booked by someone else. Please remove it and try again.`);
  return { service, date, slot };
}

// Accepts one slot ({ serviceId, date, slotId }) or several ({ items: [...] }) with one set of contact details.
app.post('/api/bookings', async (req, res) => {
  const body = req.body || {};
  const requested = Array.isArray(body.items) ? body.items : [body];
  if (!requested.length) fail(400, 'Please choose at least one time slot.');
  if (requested.length > MAX_ITEMS) fail(400, `You can book up to ${MAX_ITEMS} slots at once.`);

  // Validate everything first so either all slots are booked or none are.
  const items = requested.map(readItem);
  const seen = new Set();
  for (const it of items) {
    const key = `${it.date}|${it.slot.id}`;
    if (seen.has(key)) fail(400, `${shortDate(it.date)}, ${it.slot.label} is selected twice.`);
    seen.add(key);
  }

  const name = str(body.name, 80);
  const phone = str(body.phone, 20);
  const email = str(body.email, 120);
  const address = str(body.address, 300);
  const notes = str(body.notes, 600);
  if (name.length < 2) fail(400, 'Please enter your name.');
  if (digits(phone).length < 10 || digits(phone).length > 15) fail(400, 'Please enter a valid phone number.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Please enter a valid email or leave it empty.');
  if (address.length < 5) fail(400, 'Please enter the venue address.');

  const groupId = items.length > 1 ? `G-${uid().slice(0, 8).toUpperCase()}` : '';
  const createdAt = new Date().toISOString();
  const created = [];
  for (const { service, date, slot } of items) {
    const booking = {
      id: uid(),
      ref: makeRef(),
      groupId,
      serviceId: service.id,
      serviceName: service.name,
      date,
      slotId: slot.id,
      slotLabel: slot.label,
      slotTime: `${slot.start} – ${slot.end}`,
      name,
      phone,
      email,
      address,
      notes,
      paymentMethod: '',
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
  await save();
  const views = created.map(customerView).sort((a, b) => (a.date + a.slotTime).localeCompare(b.date + b.slotTime));
  res.status(201).json({ booking: views[0], bookings: views });
});

const findOwnBooking = (body) => {
  const ref = str(body?.ref, 20).toUpperCase();
  const booking = db.bookings.find((b) => b.ref === ref);
  if (!booking || !samePhone(booking.phone, body?.phone)) {
    fail(404, 'No booking found with that ID and phone number.');
  }
  return booking;
};

app.post('/api/bookings/lookup', async (req, res) => {
  throttle(`lookup:${req.ip}`, 40);
  const phone = str(req.body?.phone, 20);
  if (digits(phone).length < 10) fail(400, 'Please enter the 10-digit phone number used for booking.');
  const today = todayKey();
  const mine = db.bookings
    .filter((b) => samePhone(b.phone, phone))
    // Upcoming first (soonest at top), then past ones (most recent first).
    .sort((a, b) => {
      const ua = a.date >= today;
      const ub = b.date >= today;
      if (ua !== ub) return ua ? -1 : 1;
      return ua ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    })
    .slice(0, 30);
  if (!mine.length) fail(404, 'No bookings found for that phone number.');
  res.json({ bookings: mine.map(customerView) });
});

app.post('/api/bookings/payment', async (req, res) => {
  const booking = findOwnBooking(req.body);
  if (booking.status !== 'confirmed' && booking.status !== 'completed') fail(400, 'Payment opens once the jatha confirms your booking.');
  if (!booking.amount) fail(400, 'The bill for this booking is not ready yet.');
  if (booking.paymentStatus === 'paid') fail(400, 'Payment for this booking is already received.');
  const utr = str(req.body.utr, 40).replace(/\s/g, '');
  if (!/^[A-Za-z0-9]{6,40}$/.test(utr)) fail(400, 'Please enter the UPI transaction ID / UTR shown in your payment app.');
  Object.assign(booking, { paymentMethod: 'upi', paymentStatus: 'submitted', utr, paymentSubmittedAt: new Date().toISOString() });
  await save();
  res.json({ booking: customerView(booking) });
});

let qrCache; // { type, data } — loaded once, refreshed on upload
const loadQr = async () => (qrCache ??= (await kv.get('upi-qr')) || null);

app.get('/api/upi-qr', async (_req, res) => {
  const qr = await loadQr();
  if (!qr) fail(404, 'No QR uploaded.');
  res.set('Cache-Control', 'public, max-age=86400').type(qr.type).send(Buffer.from(qr.data, 'base64'));
});

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()) });
});

// Customers can only ask to cancel; the admin approves or rejects the request.
app.post('/api/bookings/cancel-request', async (req, res) => {
  const booking = findOwnBooking(req.body);
  if (!isActive(booking)) fail(400, `This booking is already ${booking.status}.`);
  if (booking.date < todayKey()) fail(400, 'Past bookings cannot be cancelled.');
  if (booking.cancelRequest?.status === 'pending') fail(400, 'A cancellation request is already waiting for approval.');
  const reason = str(req.body.reason, 500);
  if (reason.length < 3) fail(400, 'Please tell us the reason for cancelling.');
  booking.cancelRequest = { status: 'pending', reason, at: new Date().toISOString(), note: '' };
  await save();
  res.json({ booking: customerView(booking) });
});

app.post('/api/bookings/cancel-request/withdraw', async (req, res) => {
  const booking = findOwnBooking(req.body);
  if (booking.cancelRequest?.status !== 'pending') fail(400, 'There is no pending cancellation request.');
  booking.cancelRequest = null;
  await save();
  res.json({ booking: customerView(booking) });
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

app.get('/api/admin/data', async (_req, res) => {
  res.json({
    settings: db.settings,
    services: db.services,
    slots: db.slots,
    blockedDates: db.blockedDates,
    bookings: db.bookings,
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
  for (const key of ['cashEnabled', 'upiEnabled']) {
    if (key in b) s[key] = !!b[key];
  }
  for (const key of ['yearsOfSewa', 'programsDone', 'citiesCovered', 'maxAdvanceDays']) {
    if (key in b) s[key] = Math.max(0, Math.min(100000, Math.round(Number(b[key]) || 0)));
  }
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
  db.services = db.services.filter((s) => s.id !== req.params.id);
  await save();
  res.json({ services: db.services });
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

app.patch('/api/admin/bookings/:id', async (req, res) => {
  const booking = db.bookings.find((b) => b.id === req.params.id);
  if (!booking) fail(404, 'Booking not found.');
  const status = req.body?.status;
  if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) fail(400, 'Invalid status.');
  // Validate everything before changing the booking.
  const restoring = status !== 'cancelled' && booking.status === 'cancelled';
  if (restoring && slotTaken(booking.date, booking.slotId, booking.id)) fail(409, 'That slot has been booked by someone else since.');
  const amount = status === 'confirmed' ? readAmount(req.body.amount) : null;
  const reason = str(req.body.reason, 500);
  if (status === 'cancelled' && reason.length < 3) fail(400, 'Please give a reason for cancelling.');
  if (restoring) Object.assign(booking, { cancelReason: '', cancelledBy: '', cancelledAt: '' });
  if (status === 'cancelled' || restoring) booking.cancelRequest = null;
  if (status === 'cancelled') {
    Object.assign(booking, { cancelReason: reason, cancelledBy: 'admin', cancelledAt: new Date().toISOString() });
  }
  if (status === 'confirmed') {
    booking.amount = amount;
    if (!booking.billNo) {
      db.meta.billSeq = (db.meta.billSeq || 0) + 1;
      booking.billNo = `${new Date().getFullYear()}-${String(db.meta.billSeq).padStart(4, '0')}`;
    }
    booking.billedAt = new Date().toISOString();
  }
  booking.status = status;
  booking.updatedAt = new Date().toISOString();
  await save();
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
  res.json({ booking });
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

app.delete('/api/admin/bookings/:id', async (req, res) => {
  db.bookings = db.bookings.filter((b) => b.id !== req.params.id);
  await save();
  res.json({ ok: true });
});

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));

/* ---------------- static (production) ---------------- */

const dist = path.resolve(__dirname, '../dist');
if (fs.existsSync(dist)) {
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
