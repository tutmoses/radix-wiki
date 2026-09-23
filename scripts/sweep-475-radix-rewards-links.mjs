// wiki-sweep run 475 (contents/history rotation). Two things:
// 1. radix-wiki-hackathon-1 cited github.com/atlantis-l/Radix-Desktop-Tool, which now 404s
//    (repo deleted; the account survives with one unrelated repo). Repoint to the Wayback
//    capture of 3 June 2024.
// 2. /contents/history/radix-rewards went up this run. Give it inbound links from the three
//    pages that already describe the campaign without linking anywhere on this wiki.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const RR = '/contents/history/radix-rewards';

const EDITS = [
  {
    tagPath: 'contents/history', slug: 'radix-wiki-hackathon-1', bump: 'patch',
    from: 'href="https://github.com/atlantis-l/Radix-Desktop-Tool"',
    to: 'href="https://web.archive.org/web/20240603055101/https://github.com/atlantis-l/Radix-Desktop-Tool"',
    sentinel: 'web.archive.org/web/20240603055101/https://github.com/atlantis-l/Radix-Desktop-Tool',
    message: 'Radix Desktop Tool link repointed to the Wayback capture of 3 June 2024: github.com/atlantis-l/Radix-Desktop-Tool answers 404 and the API reports the repo gone (read 23 September 2026). wiki-sweep run 475.',
  },
  {
    tagPath: 'ecosystem', slug: 'radix-accountability-council', bump: 'patch',
    from: '<strong>Season 2 of Radix Rewards</strong>',
    to: `<strong>Season 2 of <a href="${RR}" rel="noopener">Radix Rewards</a></strong>`,
    sentinel: `href="${RR}"`,
    message: 'Linked Radix Rewards to its new history page. wiki-sweep run 475.',
  },
  {
    tagPath: 'contents/tech/core-concepts', slug: 'network-emissions', bump: 'patch',
    from: '1 billion to a points-based, multi-season incentives campaign',
    to: `1 billion to a points-based, multi-season incentives campaign (<a href="${RR}" rel="noopener">Radix Rewards</a>)`,
    sentinel: `href="${RR}"`,
    message: 'Linked the incentives campaign to the new Radix Rewards history page. wiki-sweep run 475.',
  },
  {
    tagPath: 'blog', slug: 'week-in-review-mar-9-15-2026', bump: 'patch',
    from: 'Two pages went up: the Radix Rewards Season 1 distribution,',
    to: `Two pages went up: the <a href="${RR}" rel="noopener">Radix Rewards</a> Season 1 distribution,`,
    sentinel: `href="${RR}"`,
    message: 'The essay says a Radix Rewards page went up this week; that page was lost when the ideas board was rebuilt. Linked it to /contents/history/radix-rewards, written in run 475. wiki-sweep run 475.',
  },
];

const bumpVersion = (v, kind) => {
  const [a, b, c] = v.split('.').map(Number);
  return kind === 'major' ? `${a + 1}.0.0` : kind === 'minor' ? `${a}.${b + 1}.0` : `${a}.${b}.${c + 1}`;
};

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.tagPath}/${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.tagPath}/${e.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    const json0 = JSON.stringify(blocks);
    if (json0.includes(e.sentinel.replace(/"/g, '\\"'))) { console.log(`  ${e.slug}: already applied`); continue; }

    let hits = 0;
    const walk = (bs) => bs.forEach((b) => {
      if (typeof b.text === 'string' && b.text.includes(e.from)) { b.text = b.text.split(e.from).join(e.to); hits++; }
      if (Array.isArray(b.blocks)) walk(b.blocks);
      if (Array.isArray(b.columns)) b.columns.forEach((c) => walk(c.blocks || []));
    });
    walk(blocks);
    if (hits !== 1) throw new Error(`${e.slug}: expected 1 block hit, got ${hits}`);

    const version = bumpVersion(page.version, e.bump);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
    if (DRY) continue;
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, e.bump, AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
