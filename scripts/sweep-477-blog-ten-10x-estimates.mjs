import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const TAG_PATH = 'blog';
const SLUG = 'ten-10x-moments-coming-to-web3';
const EXPECT = '2.7.0';
const VERSION = '2.7.1';
const SENTINEL = '<th>Unsourced figures</th>';
const MESSAGE = 'Sweep 477: closes the run-435 and run-460 open item on this page. The closing section says a 1m-dollar trade on the forex market is about 50 times cheaper than on the "~100bn stock market". The piece links neither figure, and no source for either was found on 24 September 2026; the World Federation of Exchanges full-year 2022 report gives percentage changes in value traded, not a figure the 100bn could have come from. Both are now labelled in the infobox and the editor\'s note as the essay\'s own estimates rather than decorated with an adjacent number. Essay prose unchanged.';

const replacements = [
  {
    from: '<tr><th>Companion piece</th>',
    to: '<tr><th>Unsourced figures</th><td>The closing section&rsquo;s stock-market size (about 100bn dollars) and its claim that a 1m-dollar trade is about 50 times cheaper on forex are the essay&rsquo;s own estimates. It cites neither, and no source for either has been found</td></tr><tr><th>Companion piece</th>',
  },
  {
    from: 'measured 7.5 trillion</a>.</p>',
    to: 'measured 7.5 trillion</a>. The two figures beside it, a stock market of about 100bn dollars and a trade about 50 times cheaper on forex than on stocks, come with no source and none has been found. Read them as the author&rsquo;s estimates.</p>',
  },
];

if (new RegExp('[\\u00a0\\u2014]').test(JSON.stringify(replacements) + MESSAGE)) throw new Error('script contains a U+00A0 or an em dash');

const textNodes = (blocks) => blocks.flatMap((b) => [...(typeof b.text === 'string' ? [b] : []), ...(b.blocks ? textNodes(b.blocks) : [])]);

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied, no write');
    process.exit(0);
  }
  if (page.version !== EXPECT) throw new Error(`expected v${EXPECT}, found v${page.version}`);
  for (const r of replacements) {
    let hits = 0;
    for (const n of textNodes(blocks)) {
      const count = n.text.split(r.from).length - 1;
      if (!count) continue;
      n.text = n.text.split(r.from).join(r.to);
      hits += count;
    }
    if (hits !== 1) throw new Error(`expected 1 match for "${r.from.slice(0, 60)}", found ${hits}`);
  }
  console.log(`  ${DRY ? '[dry] ' : ''}${TAG_PATH}/${SLUG}  v${page.version} -> v${VERSION}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, VERSION, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, VERSION, 'patch', AUTHOR_ID, MESSAGE, now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
