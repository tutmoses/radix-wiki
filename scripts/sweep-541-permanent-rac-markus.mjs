// Sweep 541: closes the run-540 backlog item. The member shown as "Markus" who wrote "Unfortunately, I
// must withdraw my candidacy" at 18:12 UTC on 5 Oct 2026 (t.me/radix_dlt/1006664, author t.me/mx472) is
// the same account that declared on 15 July (t.me/radix_dlt/995565), and the Transition RAC's list of
// possible candidates that day (t.me/RadixAccountabilityCouncil/900) names him. He did not post in either
// radixtalk RFP thread (2312, 2313), which is why the forum check found no match. Recorded on
// /ideas/dao-elect-permanent-rac beside Timan's 3 Oct withdrawal; infobox Latest re-dated.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ideas';
const SLUG = 'dao-elect-permanent-rac';
const SENTINEL = 'radix_dlt/1006664';
const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const REPLACE = [
  ['would keep working on <a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a> instead.</p>',
    `would keep working on <a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a> instead. Two days later, on 5 October, Markus ${A('https://t.me/radix_dlt/1006664', 'withdrew his candidacy')} in the same channel, saying he wanted to be able to stand fully behind a candidacy and no longer could. He had ${A('https://t.me/radix_dlt/995565', 'put himself forward')} on 15 July and was one of the seven people the Transition RAC ${A('https://t.me/RadixAccountabilityCouncil/900', 'listed as possible candidates')} that day, so two of those seven have now stood down.</p>`],
  ['<td>18 Sep 2026 &ndash; the Charter ratification\'s Discussion phase closes',
    '<td>5 Oct 2026 &ndash; Markus withdrew, two days after Timan Rebel: two of the seven possible candidates the Transition RAC listed on 15 July have stood down. Earlier, 18 Sep 2026 &ndash; the Charter ratification\'s Discussion phase closes'],
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const walk = (blocks, fn) => { for (const b of blocks) { fn(b); if (b.blocks) walk(b.blocks, fn); } };

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }
  for (const [from, to] of REPLACE) {
    let hit = 0;
    walk(blocks, (b) => { if (b.type === 'content' && b.text.includes(from)) { b.text = b.text.replace(from, to); hit++; } });
    if (hit !== 1) throw new Error(`${hit} matches: ${from.slice(0, 60)}`);
  }
  const version = '1.6.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 541: Markus withdrew his Permanent RAC candidacy at 18:12 UTC 5 Oct 2026 (t.me/radix_dlt/1006664); same account as his 15 July declaration (t.me/radix_dlt/995565), and named in the Transition RAC list of possible candidates (t.me/RadixAccountabilityCouncil/900). Second of those seven to stand down after Timan on 3 Oct. Infobox Latest re-dated.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
