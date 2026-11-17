// Monthly days kept at Gurdwaras: Sangrand (first day of the desi month), Pooranmashi (full moon) and Dasvin
// (the tenth day of the bright half of the moon).
//
// They are worked out from the sun and moon (Meeus, "Astronomical Algorithms", low-precision series — good to about
// a minute of arc), the way the Bikrami / SGPC jantri does:
//  - Sangrand: the day the sun enters the next sidereal sign (Lahiri ayanamsa), in Indian time.
//  - Pooranmashi and Dasvin: the day whose sunrise (at Amritsar) falls in that tithi; when a tithi starts and ends
//    between two sunrises, the day it starts on.
// Checked against SGPC Nanakshahi 558: all twelve Sangrands, and the Pooranmashi Gurpurabs (Bhagat Kabir Ji,
// Sri Guru Nanak Dev Ji, Bhagat Ravidas Ji). A day that lands one off from a printed jantri can be changed in
// Admin → Gurpurab like any other.

export const MONTHLY_KINDS = {
  sangrand: { label: 'Sangrand', gurmukhi: 'ਸੰਗਰਾਂਦ' },
  pooranmashi: { label: 'Pooranmashi', gurmukhi: 'ਪੂਰਨਮਾਸ਼ੀ' },
  dasvin: { label: 'Dasvin', gurmukhi: 'ਦਸਵੀਂ' },
};

// Desi months by the sidereal sign the sun is in (Mesh first = Vaisakh).
const MONTHS = [
  ['Vaisakh', 'ਵੈਸਾਖ'],
  ['Jeth', 'ਜੇਠ'],
  ['Harh', 'ਹਾੜ'],
  ['Sawan', 'ਸਾਵਣ'],
  ['Bhadon', 'ਭਾਦੋਂ'],
  ['Assu', 'ਅੱਸੂ'],
  ['Katak', 'ਕੱਤਕ'],
  ['Maghar', 'ਮੱਘਰ'],
  ['Poh', 'ਪੋਹ'],
  ['Magh', 'ਮਾਘ'],
  ['Phagan', 'ਫੱਗਣ'],
  ['Chet', 'ਚੇਤ'],
];

const RAD = Math.PI / 180;
const norm = (d) => ((d % 360) + 360) % 360;
const sin = (d) => Math.sin(d * RAD);
const cos = (d) => Math.cos(d * RAD);
const IST = 5.5 / 24;
const LAT = 31.62; // Amritsar
const LON = 74.88;

const jdOf = (ms) => ms / 86400000 + 2440587.5;
const msOf = (jd) => (jd - 2440587.5) * 86400000;
const centuries = (jd) => (jd - 2451545) / 36525;

function sunLongitude(jd) {
  const T = centuries(jd);
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M) + (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M);
  return norm(L0 + C - 0.00569 - 0.00478 * sin(125.04 - 1934.136 * T));
}

// [D, M, M', F, coefficient in millionths of a degree]
const MOON_TERMS = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618], [0, 1, 0, 0, -185116],
  [0, 0, 0, 2, -114332], [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066], [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758],
  [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720], [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528],
  [0, 0, 1, -2, 10980], [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034], [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036], [2, 0, 2, 0, 3994],
  [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689], [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390],
  [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236], [0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048],
  [2, 0, 1, -2, -1773], [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110], [3, 0, -1, 0, -892],
];

function moonLongitude(jd) {
  const T = centuries(jd);
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T * T;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  let sum = 0;
  for (const [d, m, mp, f, c] of MOON_TERMS) sum += c * E ** Math.abs(m) * sin(d * D + m * M + mp * Mp + f * F);
  sum += 3958 * sin(119.75 + 131.849 * T) + 1962 * sin(Lp - F) + 318 * sin(53.09 + 479264.29 * T);
  return norm(Lp + sum / 1e6 - 0.00478 * sin(125.04 - 1934.136 * T));
}

// Lahiri ayanamsa (≈ 23.853° at J2000, moving 50.29″ a year).
const ayanamsa = (jd) => 23.853 + (50.2875 / 3600) * ((jd - 2451545) / 365.25);
const siderealSun = (jd) => norm(sunLongitude(jd) - ayanamsa(jd));
// Tithi number 0–29 (0–14 the bright half: 9 is Dasmi, 14 is Pooranmashi).
const tithi = (jd) => Math.floor(norm(moonLongitude(jd) - sunLongitude(jd)) / 12);

// Sunrise at Amritsar on a date (YYYY-MM-DD, Indian date), as a Julian day.
function sunrise(dateKey) {
  const noon = jdOf(Date.parse(`${dateKey}T12:00:00+05:30`));
  const T = centuries(noon);
  const lambda = sunLongitude(noon);
  const eps = 23.439 - 0.013 * T;
  const dec = Math.asin(sin(eps) * sin(lambda)) / RAD;
  const ra = norm(Math.atan2(cos(eps) * sin(lambda), cos(lambda)) / RAD);
  const L0 = norm(280.46646 + 36000.76983 * T);
  let eot = L0 - 0.0057183 - ra; // degrees
  eot = ((eot + 180) % 360 + 360) % 360 - 180;
  const cosH = (sin(-0.833) - sin(LAT) * sin(dec)) / (cos(LAT) * cos(dec));
  const H = Math.acos(Math.max(-1, Math.min(1, cosH))) / RAD;
  const solarNoonUtcHours = 12 - LON / 15 - eot / 15;
  const utcMidnight = jdOf(Date.parse(`${dateKey}T00:00:00Z`));
  return utcMidnight + (solarNoonUtcHours - H / 15) / 24;
}

const keyOf = (ms) => new Date(ms + IST * 86400000).toISOString().slice(0, 10); // Indian date
const nextDay = (key) => new Date(Date.parse(`${key}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
const monthAt = (jd) => MONTHS[Math.floor(siderealSun(jd) / 30)];
// A lunar day belongs to the month the sun was in at the new moon before it (Katak Pooranmashi falls in solar Maghar).
function lunarMonth(jd) {
  let t = jd;
  while (tithi(t) !== 29) t -= 0.25;
  return monthAt(t);
}

/** Sangrand, Pooranmashi and Dasvin days from `from` to `to` (YYYY-MM-DD, both included). */
export function monthlyDays(from, to) {
  const days = [];
  for (let key = from; key <= to; key = nextDay(key)) {
    // The desi day runs from sunrise to sunrise: Sangrand is the day the sun enters a new sign between this sunrise
    // and the next (one entering at 00:43 belongs to the day before).
    const sr = sunrise(key);
    const nextSr = sunrise(nextDay(key));
    const a = Math.floor(siderealSun(sr) / 30);
    const b = Math.floor(siderealSun(nextSr) / 30);
    if (a !== b) days.push({ kind: 'sangrand', date: key, month: MONTHS[b] });

    // Lunar days: the tithi at this sunrise, the one before and the next one.
    const now = tithi(sr);
    const next = tithi(nextSr);
    const prev = tithi(sunrise(keyOf(msOf(sr) - 86400000)));
    const covers = (t) => now === t || (now === (t + 29) % 30 && next === (t + 1) % 30); // at sunrise, or skipped
    if (covers(14) && prev !== 14) days.push({ kind: 'pooranmashi', date: key, month: lunarMonth(sr) });
    if (covers(9) && prev !== 9) days.push({ kind: 'dasvin', date: key, month: lunarMonth(sr) });
  }
  return days.sort((x, y) => x.date.localeCompare(y.date) || x.kind.localeCompare(y.kind));
}

/** The same days as rows for the Gurpurab list (id fixed by kind and date, so each is added only once). */
export const monthlyRows = (from, to) =>
  monthlyDays(from, to).map(({ kind, date, month: [name, gurmukhi] }) => ({
    id: `${kind}-${date}`,
    kind,
    name,
    gurmukhi,
    date,
    images: [],
    active: true,
    noticeSentFor: '',
  }));
