import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';

const CORPORA = { sggs: 'shabados-4.8.7-sggs', dasam: 'shabados-4.8.7-dasam' };
const versions = Object.values(CORPORA);
const bookByVersion = new Map(Object.entries(CORPORA).map(([book, version]) => [version, book]));
const PAATHS = 'shabados-4.8.7-paaths';
const PAGE_SIZE = 20;
const unzip = promisify(gunzip);
const readSeed = async (name) => JSON.parse(await unzip(await readFile(new URL(`./gurbani-data/${name}.json.gz`, import.meta.url))));

function gurmukhiKey(text) {
  return text.normalize('NFC')
    .replace(/[\u200B-\u200D\uFE00-\uFE0F]/g, '')
    .replace(/[^\p{L}\p{M}]+/gu, ' ')
    .trim();
}

function romanKey(text) {
  // Match common spellings such as keetaa/kita, guroo/guru and vaah/waah.
  return text.normalize('NFKD').toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/aa/g, 'a').replace(/ee|ii/g, 'i').replace(/oo|uu/g, 'u').replace(/v/g, 'w');
}

export function gurbaniQuery(text) {
  if (/\p{Script=Gurmukhi}/u.test(text)) {
    const key = gurmukhiKey(text);
    const initials = key.replace(/ /g, '');
    return key && { key, initials: initials.length > 1 ? initials : '', roman: false };
  }
  const key = romanKey(text);
  return key && { key, initials: '', roman: true };
}

async function readCorpus(book) {
  const rows = await readSeed(book);
  return rows.map(([id, shabad_id, ang, text, roman], i) => {
    const gurmukhi_key = gurmukhiKey(text);
    return {
      version: CORPORA[book], id, shabad_id, ang, text, roman, line_no: i + 1, gurmukhi_key, roman_key: romanKey(roman),
      initials: [...gurmukhi_key.matchAll(/(?:^| )(\p{L})/gu)].map((match) => match[1]).join(''),
    };
  });
}

const publicLine = ({ version, id, shabad_id: shabadId, ang, text, roman }) => ({ book: bookByVersion.get(version), id, shabadId, ang, text, roman });

function pageOf(lines) {
  return { results: lines.slice(0, PAGE_SIZE).map(publicLine), hasMore: lines.length > PAGE_SIZE };
}

function localSearch(rows, query, page, sourceVersions) {
  const best = new Map();
  for (const row of rows) {
    if (!sourceVersions.includes(row.version)) continue;
    const text = query.roman ? row.roman_key : row.gurmukhi_key;
    let rank;
    if (text === query.key) rank = 0;
    else if (text.startsWith(query.key)) rank = 1;
    else if (text.includes(query.key)) rank = 2;
    else if (query.initials && row.initials.startsWith(query.initials)) rank = 3;
    else if (query.initials && row.initials.includes(query.initials)) rank = 4;
    else continue;

    const previous = best.get(row.shabad_id);
    if (!previous || rank < previous.rank) best.set(row.shabad_id, { row, rank });
  }
  const offset = (page - 1) * PAGE_SIZE;
  return pageOf([...best.values()]
    .sort((a, b) => a.rank - b.rank || versions.indexOf(a.row.version) - versions.indexOf(b.row.version) || a.row.line_no - b.row.line_no)
    .slice(offset, offset + PAGE_SIZE + 1)
    .map(({ row }) => row));
}

async function seedPostgres(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(1781758204)');
    await client.query(`CREATE TABLE IF NOT EXISTS gurbani_corpora (version text PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS gurbani_lines (
        version text NOT NULL REFERENCES gurbani_corpora(version),
        line_no integer NOT NULL,
        id text NOT NULL,
        shabad_id text NOT NULL,
        ang integer NOT NULL CHECK (ang BETWEEN 1 AND 1430),
        text text NOT NULL,
        roman text NOT NULL,
        gurmukhi_key text NOT NULL,
        roman_key text NOT NULL,
        initials text NOT NULL,
        PRIMARY KEY (version, line_no)
      );
      CREATE INDEX IF NOT EXISTS gurbani_lines_shabad ON gurbani_lines (version, shabad_id, line_no);
      CREATE INDEX IF NOT EXISTS gurbani_lines_ang ON gurbani_lines (version, ang, line_no);
      CREATE TABLE IF NOT EXISTS gurbani_paaths (
        version text NOT NULL REFERENCES gurbani_corpora(version),
        id integer NOT NULL,
        title text NOT NULL,
        gurmukhi text NOT NULL,
        lines jsonb NOT NULL,
        PRIMARY KEY (version, id)
      );`);
    // Commit the corpus marker and its lines together so a failed import can be retried.
    const addCorpus = async (version) => (await client.query(
      'INSERT INTO gurbani_corpora (version) VALUES ($1) ON CONFLICT DO NOTHING RETURNING version', [version],
    )).rows.length > 0;
    for (const [book, version] of Object.entries(CORPORA)) {
      if (!(await addCorpus(version))) continue;
      const rows = await readCorpus(book);
      for (let i = 0; i < rows.length; i += 2000) {
        await client.query(`INSERT INTO gurbani_lines
          (version, line_no, id, shabad_id, ang, text, roman, gurmukhi_key, roman_key, initials)
          SELECT $1, line_no, id, shabad_id, ang, text, roman, gurmukhi_key, roman_key, initials
          FROM jsonb_to_recordset($2::jsonb) AS seed(line_no integer, id text, shabad_id text, ang integer,
            text text, roman text, gurmukhi_key text, roman_key text, initials text)`,
        [version, JSON.stringify(rows.slice(i, i + 2000))]);
      }
    }
    if (await addCorpus(PAATHS)) {
      await client.query(`INSERT INTO gurbani_paaths (version, id, title, gurmukhi, lines)
        SELECT $1, id, title, gurmukhi, lines FROM jsonb_to_recordset($2::jsonb)
          AS seed(id integer, title text, gurmukhi text, lines jsonb)`,
      [PAATHS, JSON.stringify(await readSeed('paaths'))]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function postgresSearch(pool, query, page, sourceVersions) {
  const keyColumn = query.roman ? 'roman_key' : 'gurmukhi_key';
  const { rows } = await pool.query(`WITH ranked AS (
      SELECT version, line_no, id, shabad_id, ang, text, roman, CASE
        WHEN ${keyColumn} = $2 THEN 0
        WHEN strpos(${keyColumn}, $2) = 1 THEN 1
        WHEN strpos(${keyColumn}, $2) > 1 THEN 2
        WHEN $3 <> '' AND strpos(initials, $3) = 1 THEN 3
        WHEN $3 <> '' AND strpos(initials, $3) > 1 THEN 4
      END AS rank
      FROM gurbani_lines WHERE version = ANY($1::text[])
    ), best AS (
      SELECT DISTINCT ON (version, shabad_id) * FROM ranked WHERE rank IS NOT NULL ORDER BY version, shabad_id, rank, line_no
    )
    SELECT version, id, shabad_id, ang, text, roman FROM best
    ORDER BY rank, array_position($1::text[], version), line_no LIMIT $4 OFFSET $5`,
  [sourceVersions, query.key, query.initials, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE]);
  return pageOf(rows);
}

export function createGurbaniStore(pool) {
  let ready;
  function prepare() {
    ready ||= Promise.all([
      pool ? seedPostgres(pool) : Promise.all(Object.keys(CORPORA).map(readCorpus)),
      pool ? null : readSeed('paaths'),
      readSeed('chapters'),
    ]).then(([corpora, paaths, chapters]) => ({ lines: corpora?.flat(), paaths, chapters })).catch((error) => {
      ready = undefined;
      throw error;
    });
    return ready;
  }

  return {
    prepare,
    async search(query, page, book = 'sggs') {
      const local = await prepare();
      const sourceVersions = book === 'all' ? versions : [CORPORA[book]];
      return pool ? postgresSearch(pool, query, page, sourceVersions) : localSearch(local.lines, query, page, sourceVersions);
    },
    async shabad(id, book = 'sggs') {
      const local = await prepare();
      const version = CORPORA[book];
      const lines = pool
        ? (await pool.query(`SELECT version, id, shabad_id, ang, text, roman FROM gurbani_lines
            WHERE version = $1 AND shabad_id = $2 ORDER BY line_no`, [version, id])).rows
        : local.lines.filter((row) => row.version === version && row.shabad_id === id);
      return lines.length ? { id, lines: lines.map(publicLine) } : null;
    },
    async shabadLine(book, shabadId, id) {
      const local = await prepare();
      const version = CORPORA[book];
      const row = pool
        ? (await pool.query(`SELECT version, id, shabad_id, ang, text, roman FROM gurbani_lines
            WHERE version = $1 AND shabad_id = $2 AND id = $3`, [version, shabadId, id])).rows[0]
        : local.lines.find((line) => line.version === version && line.shabad_id === shabadId && line.id === id);
      return row ? publicLine(row) : null;
    },
    async paaths() {
      const local = await prepare();
      return pool
        ? (await pool.query('SELECT id, title, gurmukhi FROM gurbani_paaths WHERE version = $1 ORDER BY id', [PAATHS])).rows
        : local.paaths.map(({ id, title, gurmukhi }) => ({ id, title, gurmukhi }));
    },
    async paath(id) {
      const local = await prepare();
      const paath = pool
        ? (await pool.query('SELECT id, title, gurmukhi, lines FROM gurbani_paaths WHERE version = $1 AND id = $2', [PAATHS, id])).rows[0]
        : local.paaths.find((paath) => paath.id === id);
      return paath && { ...paath, chapters: local.chapters.paaths[id] };
    },
    async chapters(book) {
      return (await prepare()).chapters.books[book];
    },
    async ang(ang, book = 'sggs') {
      const local = await prepare();
      const version = CORPORA[book];
      const lines = pool
        ? (await pool.query('SELECT text FROM gurbani_lines WHERE version = $1 AND ang = $2 ORDER BY line_no', [version, ang])).rows
        : local.lines.filter((row) => row.version === version && row.ang === ang);
      return lines.map(({ text }) => text);
    },
  };
}
