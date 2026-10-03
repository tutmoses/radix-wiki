// Sweep 526: Timan Rebel withdrew his self-nomination for the permanent RAC in the
// main Radix channel at 08:49 UTC 3 Oct 2026 (t.me/radix_dlt/1006029; author read
// via ?embed=1&mode=tme). Recorded on the card that cites the 15 July nomination.
// The stated reason is kept to what bears on the seat (time for Astrolescent);
// the personal circumstances in the message stay out, per the 1 Oct scope rule.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ideas';
const SLUG = 'dao-elect-permanent-rac';
const SENTINEL = 't.me/radix_dlt/1006029';
const DRY = process.argv.includes('--dry-run');
const FROM = 'Both threads were still drawing replies at the end of July.';
const TO = `${FROM} On 3 October 2026 Timan withdrew his nomination in the <a href="https://t.me/radix_dlt/1006029" target="_blank" rel="noopener">main Radix channel</a>, saying he could not give the council the time and would keep working on <a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a> instead.`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  let json = JSON.stringify(page.content);
  if (json.includes(SENTINEL)) { console.log('  already applied — no write'); process.exit(0); }
  const n = json.split(FROM).length - 1;
  if (n !== 1) throw new Error(`expected 1 match, got ${n}`);
  json = json.replace(FROM, () => JSON.stringify(TO).slice(1, -1));
  JSON.parse(json);
  const version = '1.5.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 526: Timan Rebel withdrew his 15 July self-nomination for the permanent RAC on 3 Oct 2026 (t.me/radix_dlt/1006029, 08:49 UTC), to keep working on Astrolescent.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
