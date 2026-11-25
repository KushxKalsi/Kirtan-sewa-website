import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gzipSync } from 'node:zlib';

const [, , databasePath, converterPath] = process.argv;
if (!databasePath || !converterPath) {
  throw new Error('Usage: node build-seed.mjs /path/to/database.sqlite /path/to/gurmukhi-utils');
}

const { toUnicode } = createRequire(import.meta.url)(resolve(converterPath));
const db = new DatabaseSync(resolve(databasePath), { readOnly: true });
const lines = db.prepare(`SELECT l.id, l.shabad_id, l.source_page, l.gurmukhi, t.transliteration
  FROM lines l
  JOIN shabads s ON s.id = l.shabad_id
  LEFT JOIN transliterations t ON t.line_id = l.id AND t.language_id = 1
  WHERE s.source_id = 1
  ORDER BY l.order_id`).all();
db.close();

const angs = new Set(lines.map((line) => line.source_page));
const shabads = new Set(lines.map((line) => line.shabad_id));
if (lines.length !== 60555 || shabads.size !== 5549 || angs.size !== 1430 ||
    lines.some((line) => !line.gurmukhi || !line.transliteration || line.source_page < 1 || line.source_page > 1430)) {
  throw new Error('Expected the complete Sri Guru Granth Sahib Ji corpus from Shabad OS 4.8.7.');
}

const rows = lines.map((line) => [line.id, line.shabad_id, line.source_page, toUnicode(line.gurmukhi), line.transliteration]);
writeFileSync(new URL('./sggs.json.gz', import.meta.url), gzipSync(JSON.stringify(rows), { level: 9 }));
console.log(`Bundled ${rows.length} lines in ${shabads.size} shabads across ${angs.size} angs.`);
