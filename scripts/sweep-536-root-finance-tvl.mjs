// Sweep 536: /ecosystem/root-finance quoted a July 2026 TVL (~$2,000) as its latest reading.
// Re-read 5 Oct 2026: api.llama.fi/protocol/root-finance reports $957 on 5 Oct (between $947 and
// $1,014 over 1-5 Oct); rootfinance.xyz still serves the lending app (Last-Modified 21 Oct 2024).
// Re-dates the infobox TVL row and adds the October reading to Protocol Status; the body is untouched.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'root-finance';
const SENTINEL = 'about <strong>$960</strong> on 5 October 2026';
const EDITS = [
  ['<td><strong>TVL (Jul 2026)</strong></td><td>≈ $2K – ', '<td><strong>TVL (5 Oct 2026)</strong></td><td>≈ $960 – '],
  ['By July 2026, protocol TVL had fallen to around <strong>$2,000</strong>, according to <a href="https://defillama.com/protocol/root-finance" target="_blank" rel="noopener">DeFiLlama</a>. The lending contracts and front-end remain live,',
    `By July 2026, protocol TVL had fallen to around <strong>$2,000</strong>, and it stood at ${SENTINEL}, according to <a href="https://defillama.com/protocol/root-finance" target="_blank" rel="noopener">DeFiLlama</a>. The lending contracts and the front-end at <a href="https://rootfinance.xyz/" target="_blank" rel="noopener">rootfinance.xyz</a> remain live,`],
];
const DRY = process.argv.includes('--dry-run');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  let json = JSON.stringify(page.content);
  if (json.includes(JSON.stringify(SENTINEL).slice(1, -1))) {
    console.log('  already applied – no write');
    process.exit(0);
  }
  for (const [from, to] of EDITS) {
    const f = JSON.stringify(from).slice(1, -1);
    if (json.split(f).length !== 2) throw new Error(`expected exactly one match for: ${from.slice(0, 60)}`);
    json = json.replace(f, () => JSON.stringify(to).slice(1, -1));
  }
  JSON.parse(json);

  const version = '2.2.3';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID,
        'Sweep 536: re-date the TVL reading. DeFiLlama (api.llama.fi/protocol/root-finance) reports $957 on 5 Oct 2026, down from ~$2,000 in July; rootfinance.xyz still serves the lending app.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
