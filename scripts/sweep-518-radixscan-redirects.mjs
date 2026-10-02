// Sweep 518: /ecosystem/radixscan re-read against the redirects it documents, 2 Oct 2026.
// stokenet-dashboard.radixdlt.com now keeps the requested path (it still lands on the mainnet
// dashboard), and radixscan.com answers 301 rather than 302. The operators' home towns go: the
// 1 Oct 2026 scope change keeps team members to the names they publish under.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'radixscan';
const SENTINEL = 're-read on 2 October 2026';

const EDITS = [
  ['Michael (Vorarlberg, Austria) and Leo (Rio de Janeiro, Brazil), who run', 'Michael and Leo, who run'],
  ['redirect here (verified 30 July 2026)', 'redirect here (verified 30 July 2026, re-read 2 October 2026)'],
  ['Resolved with a browser user agent on 30 July 2026:', 'Resolved with a browser user agent on 30 July 2026 and re-read on 2 October 2026, when every row still held except the two marked:'],
  ['HTTP 302 → <code>dashboard.radixscan.io/</code> – network <em>and</em> path dropped',
    'HTTP 302 → <code>dashboard.radixscan.io</code>, path preserved but network dropped (on 30 July the path was dropped too)'],
  ['<td><code>radixscan.com</code></td><td>HTTP 302', '<td><code>radixscan.com</code></td><td>HTTP 301 (302 on 30 July)'],
  ['<code>stokenet-dashboard.radixdlt.com</code> lands on the <em>mainnet</em> dashboard homepage with both the network and the requested path discarded',
    '<code>stokenet-dashboard.radixdlt.com</code> forwards the requested path to the <em>mainnet</em> dashboard, so a Stokenet account or transaction link opens a mainnet page that does not hold it'],
  ['RadixScan was started by Michael, from Vorarlberg in Austria, who', 'RadixScan was started by Michael, who'],
  ['Leo, from Rio de Janeiro, joined', 'Leo joined'],
];

const DRY = process.argv.includes('--dry-run');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  let json = JSON.stringify(page.content);
  if (json.includes(SENTINEL)) { console.log('  already applied, no write'); process.exit(0); }
  for (const [from, to] of EDITS) {
    const f = JSON.stringify(from).slice(1, -1);
    const n = json.split(f).length - 1;
    if (n !== 1) throw new Error(`expected 1 match, found ${n}: ${from.slice(0, 60)}`);
    json = json.replace(f, JSON.stringify(to).slice(1, -1));
  }
  JSON.parse(json);

  const version = '3.1.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}, ${EDITS.length} edits`);
  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 518: redirects re-read 2 Oct 2026. stokenet-dashboard.radixdlt.com now preserves the path but still lands on the mainnet dashboard; radixscan.com answers 301. Mainnet dashboard/console redirects, the Stokenet 530s and the monorepo\'s last commit (13 Mar 2026) unchanged. Operators\' home towns removed per the 1 Oct 2026 scope change.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
