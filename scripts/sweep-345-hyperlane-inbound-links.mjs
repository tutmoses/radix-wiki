// Companion to seed-hyperlane.mjs. /ecosystem/hyperlane now exists, so the pages that
// named Hyperlane and had nowhere to point get an internal link. Surgical: one anchor
// per page, replacing a bare hyperlane.xyz link or plain text with the wiki page.
// Idempotent per page (skips any page already linking /ecosystem/hyperlane).
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const LINK = '<a href="/ecosystem/hyperlane" rel="noopener">Hyperlane</a>';
const EXT = '<a href="https://hyperlane.xyz" target="_blank" rel="noopener">Hyperlane</a>';
const NDASH = '–';

const EDITS = [
  {
    tagPath: 'contents/history', slug: 'hyperlane-asset-drain-2026', version: '2.1.1',
    from: `${EXT}-bridged asset held on the network`,
    to: `${LINK}-bridged asset held on the network`,
  },
  {
    tagPath: 'ecosystem', slug: 'reddicks', version: '1.3.1',
    from: `${EXT}-bridged assets`,
    to: `${LINK}-bridged assets`,
  },
  {
    tagPath: 'contents/resources', slug: 'how-to-buy-xrd', version: '1.8.1',
    from: `>Hyperlane Nexus</a> ${NDASH} the warp route Radix names`,
    to: `>Hyperlane Nexus</a> ${NDASH} the ${LINK} warp route Radix names`,
  },
  {
    tagPath: 'ecosystem', slug: 'weft-finance', version: '4.9.1',
    from: 'both attackers left over a Hyperlane warp route.',
    to: `both attackers left over a ${LINK} warp route.`,
  },
];

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    const ref = `${e.tagPath}/${e.slug}`;
    if (isLockedPage(e.tagPath, e.slug)) { console.log(`  SKIP ${ref} - LOCKED`); continue; }

    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) { console.log(`  SKIP ${ref} - not found`); continue; }
    const page = rows[0];

    if (JSON.stringify(page.content).includes('/ecosystem/hyperlane')) {
      console.log(`  SKIP ${ref} - already links the page`);
      continue;
    }

    const blocks = JSON.parse(JSON.stringify(page.content));
    let hits = 0;
    for (const b of blocks) {
      if (typeof b.text === 'string' && b.text.includes(e.from)) { b.text = b.text.split(e.from).join(e.to); hits++; }
    }
    if (!hits) { console.log(`  FAIL ${ref} - anchor text not found verbatim, left untouched`); continue; }

    console.log(`  ${DRY ? '[dry] ' : ''}${ref}  v${page.version} -> v${e.version}  (${hits} block(s))`);
    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, e.version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, e.version, 'patch', AUTHOR_ID,
         'Point the Hyperlane mention at /ecosystem/hyperlane, which now exists.', now]);
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
