// Prakash Purab, Jyoti Jot Divas and Shaheedi Purab of the Gurus and Bhagats.
//
// Dates are from the SGPC calendar, Nanakshahi Samvat 558 (March 2026 – March 2027), as listed at
// https://www.sikhnet.com/pages/sikh-gurpurab-calendar and checked against
// https://www.goldentempleamritsar.org (SGPC Nanakshahi 558). Most of these follow the lunar
// calendar, so they move every year: update them in Admin → Gurpurab when the SGPC publishes the
// next Jantri (around March). Days that already passed this year stay listed so you can just
// change their date for next year.

export const GURPURAB_KINDS = {
  prakash: { label: 'Prakash Purab', gurmukhi: 'ਪ੍ਰਕਾਸ਼ ਪੁਰਬ' },
  'jyoti-jot': { label: 'Jyoti Jot Divas', gurmukhi: 'ਜੋਤੀ ਜੋਤਿ ਦਿਵਸ' },
  shaheedi: { label: 'Shaheedi Purab', gurmukhi: 'ਸ਼ਹੀਦੀ ਪੁਰਬ' },
};

const GURUS = {
  nanak: ['Sri Guru Nanak Dev Ji', 'ਸ੍ਰੀ ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਜੀ'],
  angad: ['Sri Guru Angad Dev Ji', 'ਸ੍ਰੀ ਗੁਰੂ ਅੰਗਦ ਦੇਵ ਜੀ'],
  amardas: ['Sri Guru Amar Das Ji', 'ਸ੍ਰੀ ਗੁਰੂ ਅਮਰਦਾਸ ਜੀ'],
  ramdas: ['Sri Guru Ram Das Ji', 'ਸ੍ਰੀ ਗੁਰੂ ਰਾਮਦਾਸ ਜੀ'],
  arjan: ['Sri Guru Arjan Dev Ji', 'ਸ੍ਰੀ ਗੁਰੂ ਅਰਜਨ ਦੇਵ ਜੀ'],
  hargobind: ['Sri Guru Hargobind Sahib Ji', 'ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਗੋਬਿੰਦ ਸਾਹਿਬ ਜੀ'],
  harrai: ['Sri Guru Har Rai Sahib Ji', 'ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਰਾਇ ਸਾਹਿਬ ਜੀ'],
  harkrishan: ['Sri Guru Harkrishan Sahib Ji', 'ਸ੍ਰੀ ਗੁਰੂ ਹਰਿਕ੍ਰਿਸ਼ਨ ਸਾਹਿਬ ਜੀ'],
  teghbahadur: ['Sri Guru Tegh Bahadur Sahib Ji', 'ਸ੍ਰੀ ਗੁਰੂ ਤੇਗ ਬਹਾਦਰ ਸਾਹਿਬ ਜੀ'],
  gobindsingh: ['Sri Guru Gobind Singh Sahib Ji', 'ਸ੍ਰੀ ਗੁਰੂ ਗੋਬਿੰਦ ਸਿੰਘ ਸਾਹਿਬ ਜੀ'],
  ravidas: ['Bhagat Ravidas Ji', 'ਭਗਤ ਰਵਿਦਾਸ ਜੀ'],
  dhanna: ['Bhagat Dhanna Ji', 'ਭਗਤ ਧੰਨਾ ਜੀ'],
  kabir: ['Bhagat Kabir Ji', 'ਭਗਤ ਕਬੀਰ ਜੀ'],
};

// [who, kind, date]
const SGPC_558 = [
  ['nanak', 'prakash', '2026-11-24'],
  ['nanak', 'jyoti-jot', '2026-10-05'],
  ['angad', 'prakash', '2026-04-18'],
  ['angad', 'jyoti-jot', '2026-03-22'],
  ['amardas', 'prakash', '2026-04-30'],
  ['amardas', 'jyoti-jot', '2026-09-26'],
  ['ramdas', 'prakash', '2026-10-27'],
  ['ramdas', 'jyoti-jot', '2026-09-14'],
  ['arjan', 'prakash', '2026-04-09'],
  ['arjan', 'shaheedi', '2026-06-18'],
  ['hargobind', 'prakash', '2026-06-30'],
  ['hargobind', 'jyoti-jot', '2026-03-23'],
  ['harrai', 'prakash', '2026-01-31'],
  ['harrai', 'jyoti-jot', '2026-11-03'],
  ['harkrishan', 'prakash', '2026-08-07'],
  ['harkrishan', 'jyoti-jot', '2026-04-01'],
  ['teghbahadur', 'prakash', '2026-04-07'],
  ['teghbahadur', 'shaheedi', '2026-12-14'],
  ['gobindsingh', 'prakash', '2027-01-15'],
  ['gobindsingh', 'jyoti-jot', '2026-11-14'],
  ['ravidas', 'prakash', '2027-02-20'],
  ['dhanna', 'prakash', '2026-04-21'],
  ['kabir', 'prakash', '2026-06-29'],
];

export const seedGurpurabs = () =>
  SGPC_558.map(([who, kind, date]) => ({
    id: `${who}-${kind}`,
    kind,
    name: GURUS[who][0],
    gurmukhi: GURUS[who][1],
    date,
    images: [],
    active: true,
    noticeSentFor: '', // the date a "one month to go" notice was sent for
  })).sort((a, b) => a.date.localeCompare(b.date));
