// sweep 466 (developers rotation) — /developers/tools/radix-web3-js
//
// The page's package table and adoption figures were a single reading taken on
// 23 August 2026, and the page itself said the download column was the only
// thing that would move. It moved, and downwards. Re-measured on 21 September
// 2026 over the thirty days to 20 September, from the npm downloads API
// (/downloads/point/2026-08-22:2026-09-20/<pkg>) and the GitHub repository API:
//
//   package                             23 Aug -> 20 Sep
//   radix-web3.js                          236 -> 323
//   @radix-effects/gateway                 170 ->  61
//   radix-connect                           83 -> 123
//   radix-agent-toolkit                     76 ->  35
//   rdx-cli                                 32 ->  33
//   @radix-effects/tx-tool                 105 ->  66
//   @radix-effects/transaction-stream       60 ->  41
//   @radix-effects/sbor                     28 ->  21
//   @radix-effects/shared                  126 ->  47
//   nine-package total                     916 -> 750
//   @radixdlt/radix-dapp-toolkit        45,317 -> 33,540
//
// Versions are all still those of the 20 June 2026 release, as the page
// predicted. Repo: 8 stars unchanged, 3 -> 4 forks, 20 -> 23 open issues, still
// no LICENSE file, last commit still 21 June 2026 — thirteen weeks quiet, not
// nine.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'developers/tools';
const SLUG = 'radix-web3-js';
const SENTINEL = 'thirty days to 20 September';

// [version, oldDownloads, newDownloads] — the version+downloads pair is unique per row.
const ROWS = [
  ['0.6.3', '236', '323'],
  ['0.6.4', '170', '61'],
  ['0.3.3', '83', '123'],
  ['0.1.11', '76', '35'],
  ['0.2.4', '32', '33'],
  ['0.2.4', '105', '66'],
  ['0.1.11', '60', '41'],
  ['0.3.3', '28', '21'],
  ['0.0.5', '126', '47'],
];

const OLD_PREAMBLE = `Versions and monthly download counts below were read from the npm registry on 23 August 2026; the versions are unchanged from the 20 June release, so the download column is the only thing that moves.`;
const NEW_PREAMBLE = `Versions and monthly download counts below were read from the npm registry on 21 September 2026, over the thirty days to 20 September. The versions are still those of the 20 June release, so the download column is the only thing that has moved &ndash; and against the previous reading on 23 August it moved down, from 916 downloads across the nine packages to 750.`;

const OLD_ADOPT = `On 23 August 2026 the core package recorded <strong>236 downloads in the previous month</strong> and <code>rdx-cli</code> <strong>32</strong>, against <strong>45,317</strong> for the official <a href="https://www.npmjs.com/package/@radixdlt/radix-dapp-toolkit" target="_blank" rel="noopener">@radixdlt/radix-dapp-toolkit</a> &ndash; a ratio of roughly 190 to 1. All nine packages together drew <strong>916</strong> downloads that month. The GitHub repository still carried <strong>8 stars, 3 forks and 20 open issues</strong>, unchanged since the page was written.`;
const NEW_ADOPT = `Over the thirty days to 20 September 2026 the core package recorded <strong>323 downloads</strong> and <code>rdx-cli</code> <strong>33</strong>, against <strong>33,540</strong> for the official <a href="https://www.npmjs.com/package/@radixdlt/radix-dapp-toolkit" target="_blank" rel="noopener">@radixdlt/radix-dapp-toolkit</a> &ndash; a ratio of roughly 104 to 1. That gap narrowed from 190 to 1 a month earlier, but read the two columns before taking it as adoption: the official toolkit fell by about a quarter over the same window, and the nine packages together drew <strong>750</strong> downloads against 916 on 23 August. The GitHub repository carried <strong>8 stars, 4 forks and 23 open issues</strong> &ndash; one fork and three issues more than in August, and the same eight stars.`;

const OLD_QUIET = `so as of 23 August 2026 nothing has been pushed for nine weeks.`;
const NEW_QUIET = `so as of 21 September 2026 nothing has been pushed for thirteen weeks.`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const edits = [[OLD_PREAMBLE, NEW_PREAMBLE], [OLD_ADOPT, NEW_ADOPT], [OLD_QUIET, NEW_QUIET]];
  for (const [ver, from, to] of ROWS) {
    edits.push([`<td>${ver}</td><td>${from}</td>`, `<td>${ver}</td><td>${to}</td>`]);
  }

  for (const [from, to] of edits) {
    let hit = 0;
    for (const b of blocks) {
      if (typeof b.text === 'string' && b.text.includes(from)) {
        if (b.text.split(from).length - 1 !== 1) throw new Error(`ambiguous match for: ${from.slice(0, 60)}`);
        b.text = b.text.replace(from, to);
        hit++;
      }
    }
    if (hit !== 1) throw new Error(`expected 1 block match, got ${hit}, for: ${from.slice(0, 60)}`);
    console.log(`  matched: ${from.slice(0, 60)}…`);
  }

  const version = '1.2.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Re-measured the package table and the adoption figures, which were a single 23 August reading the page itself expected to move. Thirty days to 20 September 2026, from the npm downloads API and the GitHub repository API: the nine packages drew 750 downloads against 916, radix-web3.js rose 236 to 323 while six of the nine fell, and @radixdlt/radix-dapp-toolkit fell 45,317 to 33,540 - so the 190-to-1 ratio narrowing to 104-to-1 is mostly the official toolkit falling. Versions all still the 20 June release, as the page predicted. Repo 8 stars, 3 to 4 forks, 20 to 23 open issues, last commit still 21 June 2026, now thirteen weeks quiet rather than nine.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
