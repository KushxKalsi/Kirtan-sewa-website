import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

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
    cashEnabled: true,
    upiEnabled: false,
    upiId: '',
    upiName: '',
    upiQr: '',
    paymentNote: 'Bhet is as per your shardha. You can pay by UPI now or in cash on the day.',
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
      active: true,
    },
    {
      id: 'kirtan-kavishri',
      name: 'Kirtan with Kavishri',
      gurmukhi: 'ਕਵੀਸ਼ਰੀ ਜਥਾ',
      description: 'A kavishri jatha presenting Gurbani and Sikh history in the traditional kavishri style.',
      serviceIds: ['kirtan-diwan'],
      active: true,
    },
  ],
  // Team members who can be assigned to bookings. skills: [{ categoryId, serviceId }] = what they do.
  people: [],
  slots: [
    { id: 'amrit-vela', label: 'Amrit Vela', start: '04:00', end: '07:00' },
    { id: 'morning', label: 'Morning', start: '09:00', end: '12:00' },
    { id: 'afternoon', label: 'Afternoon', start: '13:00', end: '16:00' },
    { id: 'evening', label: 'Evening', start: '18:00', end: '21:00' },
  ],
  blockedDates: [],
  bookings: [],
  pushSubs: {}, // phone (last 10 digits) -> browser push subscriptions
  adminPushSubs: [], // admin devices that get a notification for every customer action
});

/* ---------------- storage ----------------
 * DATABASE_URL set  -> Postgres (needed on hosts with a wiped disk, e.g. Render's free plan)
 * otherwise         -> JSON files in DATA_DIR
 * Both store small JSON documents by key: "db" (everything) and "upi-qr" (the QR image).
 */

function fileStore() {
  const fileFor = (key) => (key === 'db' ? FILE : path.join(DATA_DIR, `${key}.json`));
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return {
    name: `file (${DATA_DIR})`,
    async read(key) {
      const file = fileFor(key);
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    },
    async write(key, json) {
      const file = fileFor(key);
      fs.writeFileSync(file + '.tmp', json);
      fs.renameSync(file + '.tmp', file);
    },
  };
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
  await pool.query('CREATE TABLE IF NOT EXISTS sewa_store (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');
  return {
    name: 'postgres',
    async read(key) {
      const { rows } = await pool.query('SELECT value FROM sewa_store WHERE key = $1', [key]);
      return rows[0]?.value ?? null;
    },
    async write(key, json) {
      await pool.query(
        'INSERT INTO sewa_store (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
        [key, json],
      );
    },
  };
}

let store;
export let db;

export async function initDb() {
  store = process.env.DATABASE_URL ? await postgresStore(process.env.DATABASE_URL) : fileStore();
  const base = defaults();
  let stored = await store.read('db');
  // First run on a new database: bring over bookings from the local file, if there is one.
  if (!stored && process.env.DATABASE_URL && fs.existsSync(FILE)) {
    stored = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    console.log(`[sewa] Copied existing data from ${FILE} into the database.`);
  }
  // Fill in keys added in newer versions without touching existing data.
  db = stored
    ? { ...base, ...stored, meta: { ...base.meta, ...stored.meta }, settings: { ...base.settings, ...stored.settings } }
    : base;
  await save();
  console.log(`[sewa] Storage: ${store.name}`);
}

// Writes run one after another, each saving a snapshot taken when save() was called.
let chain = Promise.resolve();
export function save() {
  const json = JSON.stringify(db);
  chain = chain.catch(() => {}).then(() => store.write('db', json));
  return chain;
}

export const kv = {
  get: (key) => store.read(key),
  set: (key, value) => store.write(key, JSON.stringify(value)),
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
