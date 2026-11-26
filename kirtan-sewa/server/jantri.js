import { seedGurpurabs } from './gurpurabs.js';

export const SGPC_CALENDAR = 'https://sgpc.net/nanakshahi-calendar/';
const SGPC_MIRROR = 'https://new.sgpc.net/nanakshahi-calendar/';
const JANTRI_FEED = 'https://janpreet.github.io/nanakshahi-ical/nanakshahi.ics';
const ERA_OFFSET = 1468;
const CHECK_MS = 24 * 60 * 60 * 1000;
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

const people = {
  nanak: 'guru-nanak', angad: 'guru-angad', amardas: 'guru-amardas', ramdas: 'guru-ramdas',
  arjan: 'guru-arjan', hargobind: 'guru-hargobind', harrai: 'guru-har-rai', harkrishan: 'guru-harkrishan',
  teghbahadur: 'guru-tegh-bahadur', gobindsingh: 'guru-gobind-singh', granth: 'guru-granth-sahib',
  dhanna: 'bhagat-dhanna', kabir: 'bhagat-kabir', ravidas: 'bhagat-ravidas',
};
const seeds = new Map(seedGurpurabs().map((g) => [g.id, g]));
const feedIds = new Map([...seeds.values()].map(({ id, kind }) => {
  const person = people[id.slice(0, -kind.length - 1)];
  const type = { prakash: person.startsWith('bhagat-') ? 'janam' : 'parkash', 'jyoti-jot': 'joti-jot' }[kind] || kind;
  return [`${type}-${person}`, id];
}));

const editionOf = (date) => Number(date.slice(0, 4)) - ERA_OFFSET - (date.slice(5) < '03-14' ? 1 : 0);

export function initJantriDays(db) {
  for (const day of db.gurpurabs) {
    const seed = seeds.get(day.id);
    if (seed && day.jantriAuto === undefined) day.jantriAuto = day.date === seed.date && day.kind === seed.kind;
  }
}

export function publishedEditions(html, pageUrl) {
  const releases = new Map();
  const anchors = html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>\s*Nanakshahi (?:Calendar|Jantri)\s*\((\d{4})\s*(?:[-–—]|&(?:ndash|mdash);)\s*(\d{2}|\d{4})\)\s*<\/a>/gi);
  for (const [, href, start, end] of anchors) {
    if ((Number(start) + 1) % (end.length === 2 ? 100 : 10000) !== Number(end)) continue;
    if (!URL.canParse(href, pageUrl)) continue;
    let url = new URL(href, pageUrl);
    // The SGPC mirror currently publishes WordPress links with its internal base URL.
    if (url.hostname === 'localhost' && url.pathname.startsWith('/sgpc/wp-content/uploads/')) {
      url = new URL(url.pathname.slice('/sgpc'.length), SGPC_CALENDAR);
    }
    if (url.protocol !== 'https:' || !['sgpc.net', 'new.sgpc.net', 'www.sgpc.net'].includes(url.host) || !url.pathname.endsWith('.pdf')) continue;
    const year = Number(start) - ERA_OFFSET;
    if (!releases.has(year)) releases.set(year, { year, url: url.href });
  }
  return releases;
}

export function confirmedDates(ical, releases) {
  if (!ical.startsWith('BEGIN:VCALENDAR') || !ical.trimEnd().endsWith('END:VCALENDAR')) throw new Error('The Jantri feed did not return a calendar.');
  const dates = new Map([...releases.keys()].map((year) => [year, new Map()]));
  const events = ical.replace(/\r?\n[ \t]/g, '').matchAll(/^BEGIN:VEVENT\r?\n([\s\S]*?)^END:VEVENT\r?$/gm);
  for (const [, event] of events) {
    const uid = /^UID:([a-z-]+)-(\d+)@nanakshahi-ical\r?$/m.exec(event);
    if (!uid) continue;
    const [, sourceId, sourceYear] = uid;
    const year = Number(sourceYear);
    const id = feedIds.get(sourceId);
    const byId = dates.get(year);
    if (!id || !byId) continue;
    const description = /^DESCRIPTION:(.+)\r?$/m.exec(event)?.[1];
    const confirmation = description?.split(/\\+n/).find((line) => line.startsWith('Confirmed: Jantri '));
    if (Number(/^Confirmed: Jantri (\d+)(?:\\?,|$)/.exec(confirmation || '')?.[1]) !== year) continue;

    const parts = /^DTSTART;VALUE=DATE:(\d{4})(\d{2})(\d{2})\r?$/m.exec(event);
    if (!parts) continue;
    const date = parts.slice(1).join('-');
    const ms = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) continue;
    // Allow for the spring Sangrand falling a day either side of the usual March 14 boundary.
    const gregorian = year + ERA_OFFSET;
    if (date < `${gregorian}-03-13` || date > `${gregorian + 1}-03-15`) continue;
    byId.set(id, byId.has(id) && byId.get(id) !== date ? null : date);
  }
  return [...releases.values()].map((release) => ({ ...release, dates: Object.fromEntries([...dates.get(release.year)].filter(([, date]) => date)) }));
}

async function sourceText(url, fetcher) {
  const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > MAX_SOURCE_BYTES) throw new Error(`Calendar response from ${new URL(url).hostname} is too large`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function discoverEditions(fetcher) {
  for (const page of [SGPC_CALENDAR, SGPC_MIRROR]) {
    try {
      const releases = publishedEditions(await sourceText(page, fetcher), page);
      if (releases.size) return releases;
    } catch (error) {
      console.warn(`[sewa] Reading SGPC calendar at ${page}:`, error.message);
    }
  }
  throw new Error('The SGPC publication list is unavailable.');
}

function updateDay(day, editions, today, resume = false) {
  if (!day.jantriAuto || seeds.get(day.id)?.kind !== day.kind) return false;
  const year = day.jantriYear ?? editionOf(day.date);
  const thisEdition = editions.find((edition) => edition.year === year && edition.dates[day.id]);
  const current = thisEdition?.dates[day.id] || day.date;
  const nextEdition = (resume || current < today) && editions.find((edition) => edition.dates[day.id] >= today);
  const edition = nextEdition || (!resume && thisEdition);
  if (!edition) return false;
  const date = edition.dates[day.id];
  if (day.date === date && day.jantriYear === edition.year) return false;
  // Keep the row ID, photos, visibility and per-date reminder history.
  if (day.date !== date) day.jantriUpdatedOn = today;
  day.date = date;
  day.jantriYear = edition.year;
  return true;
}

export function editJantriDay(day, previous, body, db, today) {
  if (!seeds.has(day.id)) return;
  // An admin can have the form open while a background import advances the date.
  if (body.originalDate === day.date) day.date = previous.date;
  if (day.date !== previous.date || seeds.get(day.id).kind !== day.kind || body.followJantri === false) {
    day.jantriAuto = false;
    delete day.jantriUpdatedOn;
  } else if (body.followJantri === true) {
    day.jantriAuto = true;
    updateDay(day, db.meta.jantriEditions || [], today, true);
  }
}

export function applyJantriDates(db, today) {
  const editions = db.meta.jantriEditions || [];
  let changed = false;
  for (const day of db.gurpurabs) {
    if (updateDay(day, editions, today)) changed = true;
  }
  if (changed) db.gurpurabs.sort((a, b) => a.date.localeCompare(b.date));
  return changed;
}

export async function refreshJantri(db, today, { force = false, fetcher = fetch } = {}) {
  const previous = db.meta.jantriSync || {};
  if (!force && Date.now() - Date.parse(previous.checkedAt) < CHECK_MS) return false;
  const sync = { ...previous, checkedAt: new Date().toISOString(), total: seeds.size };
  try {
    const releases = await discoverEditions(fetcher);
    // Keep the current edition and the one before and after it, including releases published early.
    const current = editionOf(today);
    const relevant = new Map([...releases].filter(([year]) => year >= current - 1 && year <= current + 1));
    const latest = [...releases.values()].sort((a, b) => b.year - a.year).find(({ year }) => year <= current + 1);
    if (!latest) throw new Error('No SGPC calendar edition was found.');
    const cached = new Map((db.meta.jantriEditions || []).filter(({ year }) => year >= current - 1).map((edition) => [edition.year, edition]));
    sync.publishedYear = latest.year;
    sync.sourceUrl = latest.url;
    sync.matched = Object.keys(cached.get(latest.year)?.dates || {}).length;
    const editions = relevant.size ? confirmedDates(await sourceText(JANTRI_FEED, fetcher), relevant) : [];
    for (const edition of editions) {
      if (!Object.keys(edition.dates).length) continue;
      cached.set(edition.year, { ...edition, dates: { ...cached.get(edition.year)?.dates, ...edition.dates } });
    }
    db.meta.jantriEditions = [...cached.values()].sort((a, b) => a.year - b.year);
    sync.matched = Object.keys(cached.get(latest.year)?.dates || {}).length;
    delete sync.error;
  } catch (error) {
    sync.error = 'Could not check the Jantri sources. The next automatic check will retry.';
    console.warn('[sewa] Jantri sync:', error.message);
  }
  db.meta.jantriSync = sync;
  return true;
}
