# Gurbani corpus and paath library

`sggs.json.gz` contains all 60,555 lines of Sri Guru Granth Sahib Ji from [Shabad OS Database 4.8.7](https://github.com/shabados/database/releases/tag/4.8.7), maintained by the Shabad OS contributors. It covers all 1,430 angs and retains the source's 5,549 shabad groupings, line IDs, order, pauses and Roman transliterations. The data is distributed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). See the [upstream license](https://raw.githubusercontent.com/shabados/database/4.8.7/LICENSE.md).

The export selects Sri Guru Granth Sahib Ji and its Roman transliteration from the release and converts the source's legacy Gurmukhi encoding to Unicode with [gurmukhi-utils 3.2.2](https://github.com/shabados/gurmukhi-utils/tree/3.2.2). Each row contains the line ID, shabad ID, ang, Unicode Gurmukhi text and Roman transliteration.

`dasam.json.gz` contains all 67,758 lines of Sri Dasam Granth across its 1,428 pannas, preserving the release's 5,470 shabad groupings and Roman transliteration. It uses the same export format and license.

`paaths.json.gz` contains the 29 named paaths in the same release, including those with lines from other sources such as Sri Dasam Granth. It preserves the source's text and line order by sorting first by bani line group and then by line order. The export converts the Gurmukhi text and titles to Unicode and uses the same data license.

`chapters.json.gz` indexes the opening lines of the 51 sections of Sri Guru Granth Sahib Ji and 17 sections of Sri Dasam Granth. The paath indexes use source headings, line groups, and numbered verses.

To regenerate the seed, download `database.sqlite` from the release above, install `gurmukhi-utils@3.2.2` in a temporary directory, and run the following with Node.js 22.13 or newer.

```bash
node server/gurbani-data/build-seed.mjs /path/to/database.sqlite /path/to/node_modules/gurmukhi-utils
```

When `DATABASE_URL` is set, the server imports the bundled corpus and paaths into dedicated Postgres tables on first use or startup. For local development without Postgres, the server reads the same bundled data directly. Reading and search requests use the bundled data without an external Gurbani service.
