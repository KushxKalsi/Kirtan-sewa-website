import fs from 'node:fs';
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
  slots: [
    { id: 'amrit-vela', label: 'Amrit Vela', start: '04:00', end: '07:00' },
    { id: 'morning', label: 'Morning', start: '09:00', end: '12:00' },
    { id: 'afternoon', label: 'Afternoon', start: '13:00', end: '16:00' },
    { id: 'evening', label: 'Evening', start: '18:00', end: '21:00' },
  ],
  blockedDates: [],
  bookings: [],
});

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const base = defaults();
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify(base, null, 2));
    return base;
  }
  const stored = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  // Fill in keys added in newer versions without touching existing data.
  return {
    ...base,
    ...stored,
    meta: { ...base.meta, ...stored.meta },
    settings: { ...base.settings, ...stored.settings },
  };
}

export const db = load();

export function save() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

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
