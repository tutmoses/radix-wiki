import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 395, community rotation. Measured 9 September 2026: the Radix blog's newest
// post is the maintenance-mode announcement of 28 April 2026 — 134 days — confirmed
// independently by the /blog listing and by the blog's own RSS feed (100 items, none
// later). Two community pages already say the named bylines stop after 4 July 2025;
// neither says the channel itself stopped, and the post that ends the run is the one
// that recorded Simmons stepping back.

const DRY = process.argv.includes('--dry-run');
const SENTINEL = 'blog/rss.xml';

const RSS = '<a href="https://www.radixdlt.com/blog/rss.xml" target="_blank" rel="noopener">RSS feed</a>';
const MAINT = '<a href="https://www.radixdlt.com/blog/foundation-update-moving-to-maintenance-mode" target="_blank" rel="noopener">Foundation Update: Moving to Maintenance Mode</a>';

const SIMMONS_PARA =
  '<h3>The blog after him</h3>'
  + '<p>The record now runs past the bylines to the channel itself. Read on 9 September 2026, the newest post on the '
  + '<a href="https://www.radixdlt.com/blog" target="_blank" rel="noopener">Radix blog</a> is ' + MAINT + ', dated 28 April 2026 '
  + 'on the site and carrying a <code>pubDate</code> of 29 April 2026 16:28 GMT in the blog&rsquo;s own ' + RSS + '; the hundred '
  + 'most recent items in that feed contain nothing later, and the site&rsquo;s own listing agrees. That is 134 days without a post, '
  + 'and it has held through a <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Mainnet halt</a> now in its ninth day. '
  + 'The page that dates the end of Simmons&rsquo;s operational role is therefore also the last thing the blog published: the byline '
  + 'stopped in July 2025 and the channel stopped nine months later, on the post that announced him stepping back.</p>';

const JARRETT_ANCHOR = 'stop altogether after 4 July 2025.';
const JARRETT_ADD =
  ' The blog itself stops too: read on 9 September 2026 its newest post is the '
  + '<a href="https://www.radixdlt.com/blog/foundation-update-moving-to-maintenance-mode" target="_blank" rel="noopener">maintenance-mode announcement</a> '
  + 'of 28 April 2026, 134 days earlier, and the blog&rsquo;s ' + RSS + ' carries nothing later.';

for (const s of [SIMMONS_PARA, JARRETT_ADD, JARRETT_ANCHOR]) {
  if (/ /.test(s)) throw new Error('U+00A0 in script string');
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

async function edit(tagPath, slug, version, changeType, message, mutate) {
  if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [tagPath, slug]);
  if (!rows.length) throw new Error(`${tagPath}/${slug} not found`);
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log(`  ${slug}: already applied — no write`);
    return;
  }
  const changed = mutate(blocks);
  if (!changed) throw new Error(`${slug}: mutation matched nothing`);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${changed})`);
  if (DRY) return;
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, changeType, AUTHOR_ID, message, now]);
  await client.query('COMMIT');
}

try {
  await edit('community', 'adam-simmons', '1.1.0', 'minor',
    'The Radix blog has published nothing since the maintenance-mode post of 28 April 2026 (134 days, confirmed by the site listing and by the blog RSS feed, 100 items, none later) - so the post that recorded Simmons stepping back is also the last post the blog has run, through a Mainnet halt in its ninth day. Byline reading re-dated to September 2026.',
    (blocks) => {
      let hits = 0;
      for (const b of blocks) {
        if (b.type !== 'content' || typeof b.text !== 'string') continue;
        if (b.text.includes('as of August 2026, the last individual')) {
          b.text = b.text.replace('as of August 2026, the last individual', 'as of September 2026, the last individual');
          hits++;
        }
        if (b.text.includes('reading the site') && b.text.includes('publishing model rather than anyone')) {
          b.text = b.text + SIMMONS_PARA;
          hits++;
        }
      }
      return hits === 2 ? 'byline re-dated + blog-stopped paragraph' : null;
    });

  await edit('community', 'andy-jarrett', '1.0.1', 'patch',
    'Extends the no-byline paragraph with the measured state of the channel: the Radix blog has published nothing since 28 April 2026, 134 days, confirmed against the blog RSS feed.',
    (blocks) => {
      let hits = 0;
      for (const b of blocks) {
        if (b.type !== 'content' || typeof b.text !== 'string') continue;
        if (b.text.includes(JARRETT_ANCHOR)) {
          b.text = b.text.replace(JARRETT_ANCHOR, JARRETT_ANCHOR + JARRETT_ADD);
          hits++;
        }
      }
      return hits === 1 ? 'no-byline paragraph extended' : null;
    });
} finally {
  client.release();
  await pool.end();
}
