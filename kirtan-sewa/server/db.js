import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { seedGurpurabs } from './gurpurabs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data');
const FILE = path.join(DATA_DIR, 'db.json');

const defaults = () => ({
  meta: { secret: crypto.randomBytes(32).toString('hex'), createdAt: new Date().toISOString() },
  settings: {
    siteName: 'Amrit Kirtan Sewa',
    gurmukhiTagline: 'ਗੁਰਬਾਣੀ ਕੀਰਤਨ ਸੇਵਾ',
    tagline: 'Soul-stirring Gurbani Kirtan for every sacred occasion — weddings, Sukhmani Sahib, Akhand Path bhog, new homes and remembrances.',
    about:
      'For over fifteen years our jatha has done the sewa of Gurbani Kirtan in Gurdwaras and Sangat homes across Punjab and beyond. Rooted in traditional raags and the maryada of the Guru Ghar, we bring the peace of Darbar Sahib to your family’s most important moments.',
    aboutImage: '',
    phone: '+91 98765 43210',
    whatsapp: '919876543210',
    email: 'sewa@example.com',
    address: 'Amritsar, Punjab, India',
    yearsOfSewa: 15,
    programsDone: 1200,
    citiesCovered: 40,
    maxAdvanceDays: 365,
    customTimeEnabled: true, // customers may enter their own start/end time instead of a slot
    cashEnabled: true,
    upiEnabled: false,
    upiId: '',
    upiName: '',
    upiQr: '',
    paymentNote: 'Bhet is as per your shardha. You can pay by UPI now or in cash on the day.',
    offerMin: 1500, // customers may offer their own amount, from this much
    commissionRate: 10, // admin commission (%) on bills above commissionAbove — amounts shown to admins only
    commissionAbove: 3500,
    gallery: [],
    testimonials: [
      { name: 'Harpreet Kaur', place: 'Ludhiana', text: 'The Asa Di Vaar at our Anand Karaj was so beautiful that every guest was in tears. Truly Guru Sahib’s kirpa.' },
      { name: 'Gurdeep Singh', place: 'Jalandhar', text: 'Booking was simple and the jatha arrived on time. The kirtan filled our new home with chardi kala.' },
      { name: 'Simran Kaur', place: 'Amritsar', text: 'Sukhmani Sahib followed by So Dar Di Chaunki — peaceful, melodious and perfectly in maryada.' },
      { name: 'Manjit Singh', place: 'Patiala', text: 'We booked Aarti for my father’s barsi. The whole sangat asked us for the jatha’s number afterwards.' },
    ],
  },
  services: [
    {
      id: 'kirtan-diwan',
      name: 'Kirtan Diwan',
      gurmukhi: 'ਕੀਰਤਨ ਦੀਵਾਨ',
      description: 'A full diwan of Gurbani Kirtan in traditional raags, ideal for weddings, Akhand Path bhog, birthdays and griha parvesh.',
      duration: '2 – 3 hours',
      icon: 'music',
      color: '#FF9933',
      allowedSlots: [],
      active: true,
    },
    {
      id: 'asa-di-vaar',
      name: 'Asa Di Vaar',
      gurmukhi: 'ਆਸਾ ਦੀ ਵਾਰ',
      description: 'The sacred morning vaar of Guru Nanak Dev Ji with its 24 pauris and chhants, sung at amrit vela the way it is in Darbar Sahib.',
      duration: '3 hours',
      icon: 'sunrise',
      color: '#F6C453',
      allowedSlots: ['amrit-vela', 'morning'],
      active: true,
    },
    {
      id: 'so-dar-di-chaunki',
      name: 'So Dar Di Chaunki',
      gurmukhi: 'ਸੋ ਦਰ ਦੀ ਚੌਂਕੀ',
      description: 'The evening chaunki of So Dar, sung as the day closes, bringing calm and gratitude to the sangat.',
      duration: '1.5 hours',
      icon: 'sunset',
      color: '#7C9CFF',
      allowedSlots: ['evening'],
      active: true,
    },
    {
      id: 'aarti',
      name: 'Aarti',
      gurmukhi: 'ਆਰਤੀ',
      description: '“Gagan mai thaal” and the full Aarti kirtan, a beautiful closing for any evening samagam or remembrance.',
      duration: '1 hour',
      icon: 'flame',
      color: '#FF7A59',
      allowedSlots: ['evening'],
      active: true,
    },
  ],
  // Top-level choice shown first when booking; each lists the sewas available in it.
  categories: [
    {
      id: 'kirtan-raag',
      name: 'Kirtan with Raag',
      gurmukhi: 'ਰਾਗੀ ਜਥਾ',
      description: 'Gurbani Kirtan in traditional raags with harmonium and tabla. All sewas are available.',
      serviceIds: ['kirtan-diwan', 'asa-di-vaar', 'so-dar-di-chaunki', 'aarti'],
      icon: 'music',
      color: '#F6C453',
      active: true,
    },
    {
      id: 'kirtan-kavishri',
      name: 'Kirtan with Kavishri',
      gurmukhi: 'ਕਵੀਸ਼ਰੀ ਜਥਾ',
      description: 'A kavishri jatha presenting Gurbani and Sikh history in the traditional kavishri style.',
      serviceIds: ['kirtan-diwan'],
      icon: 'mic',
      color: '#C084FC',
      active: true,
    },
  ],
  // Team members who can be assigned to bookings and log in to their own dashboard.
  // skills: [{ categoryId, serviceId }] = what they do; role: head-ragi / side-ragi / tabla.
  people: [],
  users: [], // customer accounts (mobile number + password)
  messages: [], // chat between the admin and one customer (thread "u:<id>") or team member ("m:<id>")
  threads: [], // per chat thread: when each side last read it
  leaves: [], // team members' leave requests
  slots: [
    { id: 'amrit-vela', label: 'Amrit Vela', start: '04:00', end: '07:00' },
    { id: 'morning', label: 'Morning', start: '09:00', end: '12:00' },
    { id: 'afternoon', label: 'Afternoon', start: '13:00', end: '16:00' },
    { id: 'evening', label: 'Evening', start: '18:00', end: '21:00' },
  ],
  blockedDates: [],
  blockedTimes: [], // [{ id, date, start, end, label, note }] — set by the admin; nothing else blocks a time
  bookings: [],
  pushSubs: {}, // phone (last 10 digits) -> browser push subscriptions
  adminPushSubs: [], // admin devices that get a notification for every customer action
  publicPushSubs: [], // visitors who only asked for Gurpurab reminders
  gurpurabs: seedGurpurabs(), // Prakash / Jyoti Jot / Shaheedi days (admin → Gurpurab)
});

/* ---------------- storage ----------------
 * DATABASE_URL set  -> Postgres, one table per kind of record (needed on hosts with a wiped disk, e.g. Render's free plan)
 * otherwise         -> JSON files in DATA_DIR
 * The app works on the in-memory `db`; save() writes what changed. Files (UPI QR, pictures, team documents)
 * are stored apart, by key, through `kv`.
 */

function fileStore() {
  const fileFor = (key) => path.join(DATA_DIR, `${key}.json`);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return {
    name: `file (${DATA_DIR})`,
    async load() {
      return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : null;
    },
    async save(json) {
      fs.writeFileSync(FILE + '.tmp', json);
      fs.renameSync(FILE + '.tmp', FILE);
    },
    async readFile(key) {
      const file = fileFor(key);
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    },
    async writeFile(key, value) {
      const file = fileFor(key);
      if (!value) return fs.rmSync(file, { force: true });
      fs.writeFileSync(file + '.tmp', JSON.stringify(value));
      fs.renameSync(file + '.tmp', file);
    },
  };
}

/* ---------- Postgres tables ----------
 * Every table has `id` (primary key), a few typed columns for searching and reporting, the full record
 * in `data` (jsonb) and `updated_at`. Passwords live only in their own column, never in `data`.
 */

const phoneKey = (p) => String(p || '').replace(/\D/g, '').slice(-10);
const dateOrNull = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null);
const timeOrNull = (t) => (t && !Number.isNaN(Date.parse(t)) ? t : null);
const intOrNull = (n) => (Number.isFinite(Number(n)) && n !== null && n !== '' ? Math.round(Number(n)) : null);
const omit = (obj, ...keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
const subId = (...parts) => crypto.createHash('sha1').update(parts.join('|')).digest('hex');

const TABLES = {
  app_meta: { cols: {}, rows: (d) => [{ id: 'meta', data: d.meta }] },
  settings: { cols: {}, rows: (d) => Object.entries(d.settings).map(([id, data]) => ({ id, data })) },
  services: {
    cols: { position: 'integer', name: 'text', active: 'boolean' },
    rows: (d) => d.services.map((s, i) => ({ id: s.id, position: i, name: s.name, active: !!s.active, data: s })),
  },
  categories: {
    cols: { position: 'integer', name: 'text', active: 'boolean' },
    rows: (d) => d.categories.map((c, i) => ({ id: c.id, position: i, name: c.name, active: !!c.active, data: c })),
  },
  time_slots: {
    cols: { position: 'integer', label: 'text', start_time: 'text', end_time: 'text' },
    rows: (d) => d.slots.map((s, i) => ({ id: s.id, position: i, label: s.label, start_time: s.start, end_time: s.end, data: s })),
  },
  blocked_dates: { cols: { date: 'date' }, rows: (d) => d.blockedDates.map((x) => ({ id: x, date: dateOrNull(x), data: x })) },
  blocked_times: {
    cols: { date: 'date', start_time: 'text', end_time: 'text' },
    rows: (d) => d.blockedTimes.map((t) => ({ id: t.id, date: dateOrNull(t.date), start_time: t.start, end_time: t.end, data: t })),
  },
  gurpurabs: {
    cols: { kind: 'text', name: 'text', date: 'date', active: 'boolean' },
    rows: (d) => d.gurpurabs.map((g) => ({ id: g.id, kind: g.kind, name: g.name, date: dateOrNull(g.date), active: !!g.active, data: g })),
  },
  users: {
    cols: { name: 'text', phone: 'text', phone_key: 'text', password_hash: 'text', created_at: 'timestamptz' },
    indexes: ['CREATE UNIQUE INDEX IF NOT EXISTS users_phone_key ON users (phone_key)'],
    rows: (d) =>
      d.users.map((u) => ({ id: u.id, name: u.name, phone: u.phone, phone_key: phoneKey(u.phone), password_hash: u.passwordHash || null, created_at: timeOrNull(u.createdAt), data: omit(u, 'passwordHash') })),
  },
  team_members: {
    cols: { name: 'text', phone: 'text', phone_key: 'text', role: 'text', active: 'boolean', password_hash: 'text' },
    indexes: ['CREATE INDEX IF NOT EXISTS team_members_phone_key ON team_members (phone_key)'],
    rows: (d) =>
      d.people.map((p) => ({ id: p.id, name: p.name, phone: p.phone, phone_key: phoneKey(p.phone), role: p.role || null, active: !!p.active, password_hash: p.passwordHash || null, data: omit(p, 'passwordHash') })),
  },
  bookings: {
    cols: {
      ref: 'text',
      group_id: 'text',
      user_id: 'text',
      phone: 'text',
      phone_key: 'text',
      service_id: 'text',
      category_id: 'text',
      date: 'date',
      slot_time: 'text',
      status: 'text',
      payment_status: 'text',
      amount: 'integer',
      lat: 'double precision',
      lng: 'double precision',
      created_at: 'timestamptz',
    },
    indexes: [
      'CREATE UNIQUE INDEX IF NOT EXISTS bookings_ref ON bookings (ref)',
      'CREATE INDEX IF NOT EXISTS bookings_date ON bookings (date)',
      'CREATE INDEX IF NOT EXISTS bookings_phone_key ON bookings (phone_key)',
      'CREATE INDEX IF NOT EXISTS bookings_user ON bookings (user_id)',
    ],
    rows: (d) =>
      d.bookings.map((b) => ({
        id: b.id,
        ref: b.ref,
        group_id: b.groupId || null,
        user_id: b.userId || null,
        phone: b.phone,
        phone_key: phoneKey(b.phone),
        service_id: b.serviceId,
        category_id: b.categoryId || null,
        date: dateOrNull(b.date),
        slot_time: b.slotTime,
        status: b.status,
        payment_status: b.paymentStatus || 'unpaid',
        amount: intOrNull(b.amount),
        lat: b.location?.lat ?? null,
        lng: b.location?.lng ?? null,
        created_at: timeOrNull(b.createdAt),
        data: omit(b, 'assignees'),
      })),
  },
  // Who does each booking, what they are paid and whether they confirmed. One row per person per booking.
  booking_assignments: {
    cols: { booking_id: 'text', person_id: 'text', position: 'integer', name: 'text', pay: 'integer', state: 'text' },
    indexes: ['CREATE INDEX IF NOT EXISTS booking_assignments_person ON booking_assignments (person_id)', 'CREATE INDEX IF NOT EXISTS booking_assignments_booking ON booking_assignments (booking_id)'],
    rows: (d) =>
      d.bookings.flatMap((b) =>
        (b.assignees || []).map((a, i) => ({ id: `${b.id}:${a.id}`, booking_id: b.id, person_id: a.id, position: i, name: a.name, pay: intOrNull(a.pay), state: a.state || 'assigned', data: a })),
      ),
  },
  leave_requests: {
    cols: { person_id: 'text', from_date: 'date', to_date: 'date', status: 'text', created_at: 'timestamptz' },
    indexes: ['CREATE INDEX IF NOT EXISTS leave_requests_person ON leave_requests (person_id)'],
    rows: (d) => d.leaves.map((l) => ({ id: l.id, person_id: l.personId, from_date: dateOrNull(l.from), to_date: dateOrNull(l.to), status: l.status, created_at: timeOrNull(l.createdAt), data: l })),
  },
  chat_messages: {
    cols: { thread: 'text', sender: 'text', kind: 'text', booking_id: 'text', created_at: 'timestamptz' },
    indexes: ['CREATE INDEX IF NOT EXISTS chat_messages_thread ON chat_messages (thread, created_at)'],
    rows: (d) => d.messages.map((m) => ({ id: m.id, thread: m.thread, sender: m.from, kind: m.kind, booking_id: m.bookingId || null, created_at: timeOrNull(m.at), data: m })),
  },
  chat_threads: { cols: {}, rows: (d) => d.threads.map((t) => ({ id: t.id, data: t })) },
  push_subscriptions: {
    cols: { scope: 'text', owner: 'text', endpoint: 'text' },
    rows: (d) => [
      ...Object.entries(d.pushSubs).flatMap(([owner, list]) => list.map((s) => ({ id: subId('phone', owner, s.endpoint), scope: 'phone', owner, endpoint: s.endpoint, data: s }))),
      ...d.adminPushSubs.map((s) => ({ id: subId('admin', s.endpoint), scope: 'admin', owner: null, endpoint: s.endpoint, data: s })),
      ...d.publicPushSubs.map((s) => ({ id: subId('public', s.endpoint), scope: 'public', owner: null, endpoint: s.endpoint, data: s })),
    ],
  },
};

// Builds the in-memory db from the table rows (the reverse of TABLES[*].rows).
function assemble(t) {
  const byPos = (rows) => [...rows].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const assignees = new Map();
  for (const r of byPos(t.booking_assignments)) assignees.set(r.booking_id, [...(assignees.get(r.booking_id) || []), r.data]);
  const subs = t.push_subscriptions;
  const pushSubs = {};
  for (const s of subs.filter((s) => s.scope === 'phone')) (pushSubs[s.owner] ||= []).push(s.data);
  return {
    meta: t.app_meta.find((r) => r.id === 'meta')?.data,
    settings: Object.fromEntries(t.settings.map((r) => [r.id, r.data])),
    services: byPos(t.services).map((r) => r.data),
    categories: byPos(t.categories).map((r) => r.data),
    slots: byPos(t.time_slots).map((r) => r.data),
    blockedDates: t.blocked_dates.map((r) => r.data).sort(),
    blockedTimes: t.blocked_times.map((r) => r.data).sort((x, y) => (x.date + x.start).localeCompare(y.date + y.start)),
    gurpurabs: t.gurpurabs.map((r) => r.data).sort((a, b) => a.date.localeCompare(b.date)),
    users: t.users.map((r) => ({ ...r.data, passwordHash: r.password_hash || '' })),
    people: t.team_members.map((r) => ({ ...r.data, passwordHash: r.password_hash || '' })),
    bookings: t.bookings.map((r) => ({ ...r.data, assignees: assignees.get(r.id) || [] })).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
    leaves: t.leave_requests.map((r) => r.data).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
    messages: t.chat_messages.map((r) => r.data).sort((a, b) => a.at.localeCompare(b.at)),
    threads: t.chat_threads.map((r) => r.data),
    pushSubs,
    adminPushSubs: subs.filter((s) => s.scope === 'admin').map((s) => s.data),
    publicPushSubs: subs.filter((s) => s.scope === 'public').map((s) => s.data),
  };
}

// Serialises every row now; the write happens later, so changes made meanwhile wait for the next save.
function snapshot(d) {
  const out = {};
  for (const [table, spec] of Object.entries(TABLES)) {
    const rows = new Map();
    for (const row of spec.rows(d)) rows.set(String(row.id), row);
    out[table] = rows;
  }
  return out;
}

async function postgresStore(url) {
  const { default: pg } = await import('pg');
  // Node gives each IPv4/IPv6 address only 250 ms to connect. To a far-away database (e.g. India or
  // Singapore -> Neon US-East) that is too short and every attempt "times out", so allow longer.
  net.setDefaultAutoSelectFamilyAttemptTimeout?.(3000);
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  // TLS is configured below; drop sslmode from the URL so pg doesn't print a deprecation warning.
  const cleanUrl = url.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
  const pool = new pg.Pool({ connectionString: cleanUrl, ssl: local ? false : { rejectUnauthorized: false }, max: 3, connectionTimeoutMillis: 20000 });
  pool.on('error', (e) => console.error('[sewa] Database connection error:', e.message));

  for (const [table, spec] of Object.entries(TABLES)) {
    await pool.query(`CREATE TABLE IF NOT EXISTS ${table} (id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
    for (const [col, type] of Object.entries(spec.cols)) await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${type}`);
    for (const sql of spec.indexes || []) await pool.query(sql);
  }
  await pool.query('CREATE TABLE IF NOT EXISTS files (id text PRIMARY KEY, content_type text NOT NULL, size integer NOT NULL, data bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now())');

  // Older versions kept everything as JSON in one table (sewa_store). Its rows are left untouched as a backup.
  const legacy = (await pool.query("SELECT to_regclass('sewa_store') AS t")).rows[0].t;
  if (legacy && !(await pool.query('SELECT 1 FROM files LIMIT 1')).rowCount) {
    const { rowCount } = await pool.query(
      `INSERT INTO files (id, content_type, size, data)
       SELECT key, value->>'type', length(decode(value->>'data', 'base64')), decode(value->>'data', 'base64') FROM sewa_store
       WHERE key <> 'db' AND jsonb_typeof(value) = 'object' AND value ? 'data' ON CONFLICT (id) DO NOTHING`,
    );
    if (rowCount) console.log(`[sewa] Moved ${rowCount} stored file(s) into the files table.`);
  }

  let persisted = Object.fromEntries(Object.keys(TABLES).map((t) => [t, new Map()])); // what the database holds, as JSON per row

  return {
    name: 'postgres (tables)',
    async load() {
      const has = (await pool.query("SELECT 1 FROM app_meta WHERE id = 'meta'")).rowCount > 0;
      if (!has) {
        if (legacy) {
          const old = (await pool.query("SELECT value FROM sewa_store WHERE key = 'db'")).rows[0]?.value;
          if (old) console.log('[sewa] Moving data from the old sewa_store table into separate tables.');
          if (old) return old;
        }
        if (fs.existsSync(FILE)) {
          console.log(`[sewa] Copied existing data from ${FILE} into the database.`);
          return JSON.parse(fs.readFileSync(FILE, 'utf8'));
        }
        return null;
      }
      const tables = {};
      for (const table of Object.keys(TABLES)) tables[table] = (await pool.query(`SELECT * FROM ${table}`)).rows;
      const d = assemble(tables);
      // Remember what is stored so the first save only writes real changes.
      const snap = snapshot({ ...defaults(), ...d });
      for (const [table, rows] of Object.entries(snap)) persisted[table] = new Map([...rows].map(([id, row]) => [id, JSON.stringify(row)]));
      return d;
    },
    async save(snap) {
      const next = {};
      const work = [];
      for (const [table, rows] of Object.entries(snap)) {
        const before = persisted[table];
        const now = new Map();
        const upserts = [];
        for (const [id, row] of rows) {
          const json = JSON.stringify(row);
          now.set(id, json);
          if (before.get(id) !== json) upserts.push(row);
        }
        const deletes = [...before.keys()].filter((id) => !rows.has(id));
        next[table] = now;
        if (upserts.length || deletes.length) work.push({ table, upserts, deletes });
      }
      if (!work.length) return;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const { table, deletes } of work) if (deletes.length) await client.query(`DELETE FROM ${table} WHERE id = ANY($1)`, [deletes]);
        for (const { table, upserts } of work) {
          const cols = ['id', ...Object.keys(TABLES[table].cols), 'data'];
          for (let i = 0; i < upserts.length; i += 200) {
            const chunk = upserts.slice(i, i + 200);
            const params = [];
            const values = chunk.map((row) => {
              const marks = cols.map((c) => {
                params.push(c === 'data' ? JSON.stringify(row.data) : (row[c] ?? null));
                return `$${params.length}`;
              });
              return `(${marks.join(', ')}, now())`;
            });
            const update = cols
              .filter((c) => c !== 'id')
              .map((c) => `${c} = EXCLUDED.${c}`)
              .join(', ');
            await client.query(`INSERT INTO ${table} (${cols.join(', ')}, updated_at) VALUES ${values.join(', ')} ON CONFLICT (id) DO UPDATE SET ${update}, updated_at = now()`, params);
          }
        }
        await client.query('COMMIT');
        persisted = { ...persisted, ...next };
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    async readFile(key) {
      const row = (await pool.query('SELECT content_type, data FROM files WHERE id = $1', [key])).rows[0];
      return row ? { type: row.content_type, data: row.data.toString('base64') } : null;
    },
    async writeFile(key, value) {
      if (!value) return void (await pool.query('DELETE FROM files WHERE id = $1', [key]));
      const data = Buffer.from(value.data, 'base64');
      await pool.query(
        'INSERT INTO files (id, content_type, size, data) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET content_type = EXCLUDED.content_type, size = EXCLUDED.size, data = EXCLUDED.data',
        [key, value.type, data.length, data],
      );
    },
  };
}

let store;
export let db;

export async function initDb() {
  store = process.env.DATABASE_URL ? await postgresStore(process.env.DATABASE_URL) : fileStore();
  const base = defaults();
  const stored = await store.load();
  // Fill in keys added in newer versions without touching existing data.
  db = stored
    ? { ...base, ...stored, meta: { ...base.meta, ...stored.meta }, settings: { ...base.settings, ...stored.settings } }
    : base;
  for (const key of ['users', 'messages', 'threads', 'leaves', 'people', 'categories', 'blockedTimes', 'gurpurabs', 'adminPushSubs', 'publicPushSubs']) db[key] ||= [];
  db.pushSubs ||= {};
  await save();
  console.log(`[sewa] Storage: ${store.name}`);
}

// Writes run one after another, each saving a snapshot taken when save() was called.
let chain = Promise.resolve();
export function save() {
  const snap = store.name.startsWith('postgres') ? snapshot(db) : JSON.stringify(db);
  chain = chain.catch(() => {}).then(() => store.save(snap));
  return chain;
}

// Files kept apart from the records: { type, data (base64) } by key. Setting null removes one.
export const kv = {
  get: (key) => store.readFile(key),
  set: (key, value) => store.writeFile(key, value),
};

export const uid = () => crypto.randomBytes(8).toString('hex');

const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeRef() {
  let ref;
  do {
    ref = 'KS-' + Array.from(crypto.randomBytes(6), (b) => REF_CHARS[b % REF_CHARS.length]).join('');
  } while (db.bookings.some((b) => b.ref === ref));
  return ref;
}

export const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || uid();
