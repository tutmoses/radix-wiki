// The blanket unlink left the Notability infobox naming a section that no longer
// exists, and its People guideline still opened as though people routinely get
// articles here. Both are the same correction, finished.

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
import { bump } from 'wiki-formant/versioning';
config();

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

function* prose(bs) { for (const b of bs) { if (typeof b.text === 'string') yield b; if (Array.isArray(b.blocks)) yield* prose(b.blocks); } }

try {
  if (isLockedPage('policy', 'notability')) throw new Error('notability is LOCKED');
  const { rows } = await client.query(
    `SELECT id, title, version, content FROM pages WHERE tag_path = 'policy' AND slug = 'notability'`);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  const text = () => [...prose(blocks)].map((b) => b.text).join('\n');

  if (text().includes('most often <a href="/ecosystem" class="link">Ecosystem</a> and <a href="/developers"')) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const sub = (find, repl) => {
    const hits = [...prose(blocks)].filter((b) => b.text.includes(find));
    if (hits.length !== 1) throw new Error(`expected 1 block containing "${find.slice(0, 60)}…", found ${hits.length}`);
    hits[0].text = hits[0].text.replace(find, repl);
  };

  sub(`New pages; most often <a href="/ecosystem" class="link">Ecosystem</a> and Community`,
      `New pages; most often <a href="/ecosystem" class="link">Ecosystem</a> and <a href="/developers" class="link">Developers</a>`);

  sub(`<li><strong>People</strong> – recognised contributors, founders, or maintainers, documented by what they have shipped or governed rather than by self-description. This wiki does not keep biographies of living participants in the ecosystem. The Community section that held them was retired in September 2026; a person is documented through the pages about the work they did, and gets an article of their own only where they are inseparable from the project&rsquo;s own history.</li>`,
      `<li><strong>People</strong> – rarely, and only where the person is inseparable from the project&rsquo;s own history. This wiki does not keep biographies of living participants in the ecosystem: the Community section that held them was retired in September 2026, and a contributor is documented through the pages about the work itself, credited by name where the record names them.</li>`);

  const version = bump(page.version, 'patch');
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
       'Finished the Community retirement on this page: the scope row no longer names a section that is gone, and the People guideline opens with the rule rather than with an exception to it.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
