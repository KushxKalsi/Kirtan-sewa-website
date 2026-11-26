import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gzipSync } from 'node:zlib';
import { ASA_DI_VAAR_PAATH_ID, GURBANI_BOOKS } from '../../shared/gurbani.js';

const [, , databasePath, converterPath] = process.argv;
if (!databasePath || !converterPath) {
  throw new Error('Usage: node build-seed.mjs /path/to/database.sqlite /path/to/gurmukhi-utils');
}

const { toUnicode } = createRequire(import.meta.url)(resolve(converterPath));
const db = new DatabaseSync(resolve(databasePath), { readOnly: true });
const bookLines = db.prepare(`SELECT l.id, l.shabad_id, l.source_page, l.gurmukhi, s.section_id, t.transliteration
  FROM lines l
  JOIN shabads s ON s.id = l.shabad_id
  LEFT JOIN transliterations t ON t.line_id = l.id AND t.language_id = 1
  WHERE s.source_id = ?
  ORDER BY l.order_id`);
const bookSections = db.prepare('SELECT id, name_english, name_gurmukhi FROM sections WHERE source_id = ?');
const paaths = new Map(db.prepare(`SELECT id, name_english, name_gurmukhi FROM banis ORDER BY id`).all()
  .map(({ id, name_english, name_gurmukhi }) => [id, { id, title: name_english, gurmukhi: toUnicode(name_gurmukhi), rows: [] }]));
const paathLines = db.prepare(`SELECT bl.bani_id, bl.line_group, l.id, l.gurmukhi, l.type_id, l.shabad_id, t.transliteration
  FROM bani_lines bl
  JOIN lines l ON l.id = bl.line_id
  LEFT JOIN transliterations t ON t.line_id = l.id AND t.language_id = 1
  ORDER BY bl.bani_id, bl.line_group, l.order_id`);
for (const row of paathLines.iterate()) paaths.get(row.bani_id).rows.push(row);

function writeSeed(name, data) {
  writeFileSync(new URL(`./${name}.json.gz`, import.meta.url), gzipSync(JSON.stringify(data), { level: 9 }));
}

// Match editions to source lines by ID. Use the next credited edition when the preferred edition has a blank.
function exportReadingDisplay() {
  const translations = {
    pa: [3, 6, 5, 8], // Bhai Manmohan Singh, Prof. Sahib Singh, Fareedkot Teeka, Dr. Rattan Singh Jaggi
    en: [1, 2, 7, 9], // Dr. Sant Singh Khalsa, Bhai Manmohan Singh, Dr. Surinder Singh Kohli, SGPC
    es: [4], // SikhNet
  };
  const scripts = { roman: 1, deva: 4, shah: 5 };
  const lines = new Map();
  const credits = {};
  const mask = 's.source_id IN (1, 2) OR l.id IN (SELECT line_id FROM bani_lines)';
  const scoped = `JOIN lines l ON l.id = t.line_id JOIN shabads s ON s.id = l.shabad_id WHERE (${mask})`;

  function add(id, language, text, credit = undefined) {
    if (!text) return;
    if (!lines.has(id)) lines.set(id, {});
    const line = lines.get(id);
    line[language] ??= credit === undefined ? text : [text, credit];
  }

  const readTranslations = db.prepare(`SELECT l.id, t.translation FROM translations t ${scoped} AND t.translation_source_id = ?`);
  const readCredit = db.prepare('SELECT name_english FROM translation_sources WHERE id = ?');
  for (const [language, editions] of Object.entries(translations)) {
    for (const edition of editions) {
      credits[edition] = readCredit.get(edition).name_english;
      for (const { id, translation } of readTranslations.iterate(edition)) add(id, language, translation.trim(), edition);
    }
  }
  const readScript = db.prepare(`SELECT l.id, t.transliteration FROM transliterations t ${scoped} AND t.language_id = ?`);
  for (const [language, code] of Object.entries(scripts)) {
    for (const { id, transliteration } of readScript.iterate(code)) add(id, language, transliteration.trim());
  }
  const records = [credits, ...lines].map((row) => JSON.stringify(row)).join('\n') + '\n';
  writeFileSync(new URL('./reading-display.jsonl.gz', import.meta.url), gzipSync(records, { level: 9 }));
  console.log(`Bundled reading translations and transliterations for ${lines.size} source lines.`);
}

function exportBook(book, source, expectedLines, expectedShabads) {
  const { title, lastAng } = GURBANI_BOOKS[book];
  const lines = bookLines.all(source);
  const angs = new Set(lines.map((line) => line.source_page));
  const shabads = new Set(lines.map((line) => line.shabad_id));
  if (lines.length !== expectedLines || shabads.size !== expectedShabads || angs.size !== lastAng ||
      lines.some((line) => !line.gurmukhi || !line.transliteration || line.source_page < 1 || line.source_page > lastAng)) {
    throw new Error(`Expected the complete ${title} corpus from Shabad OS 4.8.7.`);
  }
  const sections = new Map(bookSections.all(source).map((section) => [section.id, section]));
  const chapters = [];
  const offsets = new Map();
  for (const { source_page: ang, section_id } of lines) {
    const line = offsets.get(ang) || 0;
    offsets.set(ang, line + 1);
    const section = sections.get(section_id);
    if (!section) continue;
    chapters.push({ title: section.name_english, gurmukhi: toUnicode(section.name_gurmukhi), ang, line });
    sections.delete(section_id);
  }
  if (sections.size) throw new Error(`Missing the opening line of a section in ${title}.`);
  writeSeed(book, lines.map((line) => [line.id, line.shabad_id, line.source_page, toUnicode(line.gurmukhi), line.transliteration]));
  console.log(`Bundled ${lines.length} lines and ${chapters.length} chapters for ${title}.`);
  return chapters;
}

// In these paaths the bound verses carry their own numbers even when they share a single heading.
const numberedPaaths = {
  1: { start: 4, count: 38, label: 'Pauri' },
  5: { start: 2, count: 40, label: 'Pauri' },
  6: { start: 2, count: 6, label: 'Pauri', last: 40 },
  21: { start: 2, count: 73, label: 'Verse' },
  22: { start: 2, count: 54, label: 'Pauri' },
  25: { start: 1, count: 4, label: 'Laav' },
  28: { start: 2, count: 6, label: 'Pauri' },
};
const verseEnding = /\](\d+)\](?:\d+\])*$/;

function numberedChapters(rows, { start, count, label, last = count }) {
  const chapters = [];
  let firstLine = start;
  for (let line = start; line < rows.length && chapters.length < count; line++) {
    const number = chapters.length === count - 1 ? last : chapters.length + 1;
    if (Number(rows[line].gurmukhi.match(verseEnding)?.[1]) !== number) continue;
    chapters.push({ title: `${label} ${number}`, line: firstLine });
    firstLine = line + 1;
  }
  if (chapters.length !== count) throw new Error(`Expected ${count} numbered chapters in the paath.`);
  return chapters;
}

function asaDiVaarChapters(rows) {
  const chapters = [{ title: 'Mangal', gurmukhiTitle: 'ਮੰਗਲ', line: 0 }];
  // The source alternates a chakka and its vaar section. Anchor to the first pankti in each chakka.
  for (const [line, row] of rows.entries()) {
    const number = chapters.length;
    if (row.line_group !== 2 * number - 1 || row.type_id !== 4) continue;
    chapters.push({
      title: `Chakka ${number}`,
      gurmukhiTitle: `ਛੱਕਾ ${toUnicode(String(number))}`,
      gurmukhi: toUnicode(row.gurmukhi),
      line,
    });
  }
  if (chapters.length !== 25 || chapters.slice(1).some(({ gurmukhi }) => !gurmukhi.endsWith('ਰਾਮ ਰਾਜੇ ॥'))) {
    throw new Error('Expected all 24 chakka openings in Asa Ki Var.');
  }
  return chapters;
}

function paathChapters({ id, rows }) {
  if (id === ASA_DI_VAAR_PAATH_ID) return asaDiVaarChapters(rows);
  const chapters = [{ title: 'Beginning', line: 0 }];
  if (id === 12) {
    const ashtpadis = rows.flatMap(({ gurmukhi, type_id }, line) =>
      type_id === 2 && gurmukhi === 'AstpdI ]' ? [line] : []);
    if (ashtpadis.length !== 24) throw new Error('Expected 24 Ashtpadis in Sukhmani Sahib.');
    return [...chapters, ...ashtpadis.map((line, index) => ({ title: `Ashtpadi ${index + 1}`, line }))];
  }
  const numbered = numberedPaaths[id];
  if (numbered) chapters.push(...numberedChapters(rows, numbered));

  const useShabadStarts = !numbered && rows.filter(({ type_id }) => type_id === 2).length <= 2;
  for (let line = 1; line < rows.length; line++) {
    const row = rows[line];
    const previous = rows[line - 1];
    if (row.type_id === 2) {
      const title = row.transliteration?.replace(/\s*\|\s*$/, '');
      chapters.push({ title, gurmukhi: toUnicode(row.gurmukhi), line });
    } else if ((!numbered && row.line_group !== previous.line_group) || (useShabadStarts && row.shabad_id !== previous.shabad_id)) {
      chapters.push({ gurmukhi: toUnicode(row.gurmukhi), line });
    }
  }
  return chapters.sort((a, b) => a.line - b.line).filter((chapter, i, ordered) => chapter.line !== ordered[i - 1]?.line);
}

const books = { sggs: exportBook('sggs', 1, 60555, 5549), dasam: exportBook('dasam', 2, 67758, 5470) };
exportReadingDisplay();
db.close();
const readings = [...paaths.values()].map(({ rows, ...paath }) => ({ ...paath, lines: rows.map(({ gurmukhi }) => toUnicode(gurmukhi)) }));
if (readings.length !== 29 || readings.some(({ lines }) => !lines.length || lines.some((line) => !line))) {
  throw new Error('Expected all 29 paaths from Shabad OS 4.8.7.');
}
writeSeed('paaths', readings);
writeSeed('chapters', {
  books,
  paaths: Object.fromEntries([...paaths].map(([id, paath]) => [id, paathChapters(paath)])),
  paathLineIds: Object.fromEntries([...paaths].map(([id, { rows }]) => [id, rows.map((line) => line.id)])),
});
console.log(`Bundled ${readings.length} paaths with chapter indexes.`);
