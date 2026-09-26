import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const WALLS = 'https://castellitoscani.com/en/florence-city-walls/';
const L2BEAT = 'https://web.archive.org/web/20231102174811/https://l2beat.com/scaling/summary';
const OLD_REPO = 'https://github.com/AbdurRazzak01/RadixHack';
const NEW_REPO = 'https://github.com/AbdurRazzak01/RadixScryptoChallenge---InfiniX';
const REPO_MESSAGE = 'Sweep 489: the InfiniX repository was renamed from AbdurRazzak01/RadixHack to AbdurRazzak01/RadixScryptoChallenge---InfiniX (GitHub API answers 301 for the old name, 26 September 2026). Both links repointed to the current name so they survive the old name being reused.';

const edits = [
  {
    tagPath: 'blog',
    slug: 'radix-is-florence',
    expect: '2.4.1',
    version: '2.4.2',
    sentinel: '<th>Figures checked</th>',
    message: `Sweep 489: closes the open item carried since run 435. Two of the essay's figures were unsourced. The three wall enlargements between 1071 and 1284 hold: new circuits were begun in 1078, 1172 and 1284 (${WALLS}). The ~25x population growth does not: the same source gives about 25,000 inhabitants in 1125, 80,000 by 1280 and nearly 100,000 in the early 1300s, about four times. The ~50 rollups around Ethereum matches a count of every Layer 2 rather than of rollups: L2BEAT's summary on 2 November 2023, the day before publication, listed 32 live and 15 upcoming projects, 34 of them rollups (${L2BEAT}). Recorded in an infobox row; essay prose unchanged.`,
    replacements: [
      {
        from: '<tr><th>Companion piece</th>',
        to: `<tr><th>Figures checked</th><td>The essay cites neither historical figure. The three wall enlargements hold: Florence began new circuits in 1078, 1172 and 1284 (<a href="${WALLS}" target="_blank" rel="noopener">Castelli Toscani</a>). The ~25x population growth does not: the same source gives about 25,000 inhabitants in 1125, 80,000 by 1280 and nearly 100,000 in the early 1300s, roughly four times. The ~50 rollups around Ethereum is nearer a count of every Layer 2: on 2 November 2023, the day before publication, <a href="${L2BEAT}" target="_blank" rel="noopener">L2BEAT</a> listed 32 live and 15 upcoming projects, 34 of them rollups and the rest validiums and optimiums</td></tr><tr><th>Companion piece</th>`,
        count: 1,
      },
    ],
  },
  {
    tagPath: 'blog',
    slug: 'rgh2024-debrief',
    expect: '2.6.6',
    version: '2.6.7',
    sentinel: NEW_REPO,
    message: REPO_MESSAGE,
    replacements: [{ from: OLD_REPO, to: NEW_REPO, count: 2 }],
  },
  {
    tagPath: 'contents/history',
    slug: 'radix-wiki-hackathon-1',
    expect: '3.1.6',
    version: '3.1.7',
    sentinel: NEW_REPO,
    message: REPO_MESSAGE,
    replacements: [{ from: OLD_REPO, to: NEW_REPO, count: 2 }],
  },
];

if (new RegExp('[\\u00a0\\u2014]').test(JSON.stringify(edits))) throw new Error('script contains a U+00A0 or an em dash');

const textNodes = (blocks) => blocks.flatMap((b) => [
  ...(typeof b.text === 'string' ? [b] : []),
  ...(b.blocks ? textNodes(b.blocks) : []),
  ...(b.columns ? b.columns.flatMap((c) => textNodes(c.blocks ?? [])) : []),
]);

try {
  for (const e of edits) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied, no write`);
      continue;
    }
    if (page.version !== e.expect) throw new Error(`${e.slug}: expected v${e.expect}, found v${page.version}`);
    for (const r of e.replacements) {
      let hits = 0;
      for (const n of textNodes(blocks)) {
        const count = n.text.split(r.from).length - 1;
        if (!count) continue;
        n.text = n.text.split(r.from).join(r.to);
        hits += count;
      }
      if (hits !== r.count) throw new Error(`${e.slug}: expected ${r.count} matches for "${r.from.slice(0, 60)}", found ${hits}`);
    }
    console.log(`  ${DRY ? '[dry] ' : ''}${e.tagPath}/${e.slug}  v${page.version} -> v${e.version}`);
    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, e.version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, e.version, 'patch', AUTHOR_ID, e.message, now]);
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
