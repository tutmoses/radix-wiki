// scripts/sweep-324-semrush-link-hygiene.mjs
//
// Three link defects the Semrush crawl of 2026-08-04 found, all of them one
// anchor each:
//
//   1. Homepage — the "Olympia (July 2021)" heading points at
//      radixdlt.com/blog/radix-olympia-launch, which is a 404 with no live
//      equivalent on that blog and no Wayback capture. Every sibling era heading
//      (Alexandria, Babylon, Hyperscale) links to its own wiki article, so
//      Olympia joins them rather than keeping a dead external target.
//   2. community/dan-hughes — a citation whose anchor text is the word "Link".
//      The source is alive; only the label is uninformative.
//   3. contents/tech/research/cassandra — "Vamos" links out and the word
//      "database" sits outside the anchor, so the link reads as a bare name.
//      The anchor grows to cover "Vamos database"; the trailing noun goes.

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');

const EDITS = [
  {
    tagPath: '', slug: '',
    version: '8.6.9', changeType: 'patch',
    message: 'Point the Olympia heading at its wiki article; radixdlt.com/blog/radix-olympia-launch is a 404 (Semrush 2026-08-04).',
    from: '<a target="_blank" rel="noopener" class="link" href="https://www.radixdlt.com/blog/radix-olympia-launch"><strong>Olympia</strong></a>',
    to: '<a rel="noopener" class="link" href="/contents/tech/releases/radix-mainnet-olympia"><strong>Olympia</strong></a>',
  },
  {
    tagPath: 'community', slug: 'dan-hughes',
    version: '3.3.1', changeType: 'patch',
    message: 'Name the Finyear interview instead of labelling it "Link" (Semrush non-descriptive anchor text).',
    from: '<a target="_blank" rel="noopener noreferrer nofollow" class="link" href="https://www.finyear.com/Dan-Hughes-CTO-and-Founder-of-Radix-DLT_a41870.html">Link</a>',
    to: '<a target="_blank" rel="noopener noreferrer nofollow" class="link" href="https://www.finyear.com/Dan-Hughes-CTO-and-Founder-of-Radix-DLT_a41870.html">Finyear interview with Dan Hughes</a>',
  },
  {
    tagPath: 'contents/tech/research', slug: 'cassandra',
    version: '1.2.4', changeType: 'patch',
    message: 'Let the Vamos link carry the noun it names (Semrush non-descriptive anchor text).',
    from: '<a rel="noopener" class="link" href="/contents/tech/core-protocols/vamos-database">Vamos</a> database structure.',
    to: '<a rel="noopener" class="link" href="/contents/tech/core-protocols/vamos-database">Vamos database</a> structure.',
  },
];

// The find-strings above are written with ordinary spaces. Auto-generated prose on
// this wiki carries U+00A0 in the same places, and a mismatched space fails silently
// — so assert the scripts's own strings are clean before trusting a miss.
for (const e of EDITS) {
  if (/ /.test(e.from) || / /.test(e.to)) throw new Error(`non-breaking space in edit for ${e.tagPath}/${e.slug}`);
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

let changed = 0, skipped = 0;
try {
  for (const edit of EDITS) {
    const label = `/${edit.tagPath}/${edit.slug}`.replace(/\/+/g, '/');
    if (isLockedPage(edit.tagPath, edit.slug)) throw new Error(`${label} is LOCKED`);

    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      [edit.tagPath, edit.slug],
    );
    if (!rows.length) throw new Error(`page not found: ${label}`);
    const page = rows[0];

    const before = JSON.stringify(page.content);
    if (before.includes(JSON.stringify(edit.to).slice(1, -1))) {
      console.log(`  ${label} — already applied, no write`);
      skipped++;
      continue;
    }
    const needle = JSON.stringify(edit.from).slice(1, -1);
    if (!before.includes(needle)) {
      throw new Error(`find-string missed in ${label}. Codepoints around the anchor may differ — dump them before editing the string.`);
    }
    const after = before.split(needle).join(JSON.stringify(edit.to).slice(1, -1));

    console.log(`  ${DRY ? '[dry] ' : ''}${page.title} (${label})  v${page.version} -> v${edit.version}`);
    console.log(`        - ${edit.from.slice(0, 110)}…`);
    console.log(`        + ${edit.to.slice(0, 110)}…`);

    if (!DRY) {
      const now = new Date().toISOString();
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [after, edit.version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, after, page.title, edit.version, edit.changeType, AUTHOR_ID, edit.message, now],
      );
      await client.query('COMMIT');
    }
    changed++;
  }
  console.log(`\n${DRY ? '[dry] ' : ''}${changed} changed, ${skipped} already applied`);
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('FAILED:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
