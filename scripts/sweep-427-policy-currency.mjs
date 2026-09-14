// sweep 427 — policy rotation. Two sentences in the category that had stopped being true.
//
// /policy/neutral-point-of-view uses the August 2026 asset drain and halt as its worked
// example "because it is being written here while it is still happening". The network
// restarted at 11:35 UTC on 11 September 2026 after 254 hours, 15 minutes and 40 seconds
// (/contents/history/hyperlane-asset-drain-2026, "The fix, and the restart").
//
// /policy/ (the hub) says the seven policies were adopted "in two waves: five on 31 July
// 2026, conflict of interest shortly after, and editorial notices on 26 August 2026".
// That is three dates for two waves, and /policy/conflict-of-interest's own infobox reads
// "Adopted 31 July 2026"; its page row was created at 20:21 UTC that day. Six on 31 July.
//
// Run:  node scripts/sweep-427-policy-currency.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');

const EDITS = [
  {
    slug: 'neutral-point-of-view',
    version: '1.4.1',
    oldText: 'is the worked example for each, because it is being written here while it is still happening.</p>',
    newText:
      'is the worked example for each, because this wiki wrote it up while it was still happening. The network was down for 254 hours and restarted on 11 September 2026.</p>',
    message:
      'Tense fix: the August 2026 asset drain and halt is no longer "still happening". The network restarted at 11:35 UTC on 11 September 2026 after 254 hours, 15 minutes and 40 seconds, per /contents/history/hyperlane-asset-drain-2026. The three worked practices are unchanged.',
  },
  {
    slug: '',
    version: '1.0.1',
    oldText:
      'adopted in two waves: five on 31 July 2026, <a href="/policy/conflict-of-interest" class="link">conflict of interest</a> shortly after, and',
    newText:
      'adopted in two waves: six on 31 July 2026, the last of them <a href="/policy/conflict-of-interest" class="link">conflict of interest</a>, and',
    message:
      'Adoption dates: the intro gave three dates for two waves ("five on 31 July 2026, conflict of interest shortly after"). /policy/conflict-of-interest reads Adopted 31 July 2026 and its page was created at 20:21 UTC that day, so six policies date from 31 July and editorial notices from 26 August.',
  },
];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage('policy', e.slug)) throw new Error(`policy/${e.slug} is LOCKED`);
    if (/ /.test(e.oldText + e.newText)) throw new Error('U+00A0 in edit strings');

    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      ['policy', e.slug],
    );
    if (!rows.length) throw new Error(`policy/${e.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));

    if (blocks.some((b) => b.text?.includes(e.newText))) {
      console.log(`  policy/${e.slug}: already applied — no write`);
      continue;
    }
    const hits = blocks.filter((b) => b.text?.includes(e.oldText));
    if (hits.length !== 1) throw new Error(`policy/${e.slug}: expected 1 match, found ${hits.length}`);
    hits[0].text = hits[0].text.replace(e.oldText, e.newText);

    console.log(`  ${DRY ? '[dry] ' : ''}policy/${e.slug || '(hub)'}  v${page.version} -> v${e.version}`);
    if (DRY) continue;

    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      json, e.version, now, page.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, 'patch', AUTHOR_ID, e.message, now],
    );
    await client.query('COMMIT');
    console.log('    written');
  }
} finally {
  client.release();
  await pool.end();
}
