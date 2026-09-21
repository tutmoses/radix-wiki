// Run 468, contents/tech rotation.
//
// /contents/tech/releases/protocol-updates carries a full, sourced account of Eagle
// Ray in its prose — enactment epoch, the moratorium, the ledger read — and its
// canonical "Enacted Updates" table stops at Cuttlefish (December 2024). A reader
// who scans the table, which is what a table is for, comes away believing
// Cuttlefish is the protocol version in force. It has not been since 11 September
// 2026.
//
// Two changes, both narrow:
//   1. the Eagle Ray row, with the same figures the prose already states and this
//      run re-verified against the GitHub API (scrypto v1.4.0 tagged 2026-09-07
//      17:35:11Z, babylon-node v1.4.0.0 tagged 2026-09-10 03:59:09Z);
//   2. "Every mainnet update enacted so far has used a 75% stake threshold", which
//      the update below it contradicts — the claim is true of readiness enactment
//      and Eagle Ray was unconditional.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/releases';
const SLUG = 'protocol-updates';
const DRY = process.argv.includes('--dry-run');

const ROW =
  '<tr><td>Eagle Ray</td><td>v1.4.0.0</td><td>1.4.0</td><td>11 September 2026</td><td>339898</td><td>Unconditional</td></tr>';
const AFTER_CUTTLEFISH =
  '<tr><td>Cuttlefish</td><td>v1.3.0</td><td>1.3.0</td><td>18 December 2024</td><td>160923</td><td>75% stake for ~2 weeks</td></tr>';

const OLD_CLAIM =
  'Every mainnet update <em>enacted</em> so far has used a 75% stake threshold.';
const NEW_CLAIM =
  'Every mainnet update enacted <em>by readiness signalling</em> has used a 75% stake threshold; the one update enacted without it, <a href="#eagle-ray-enacted" rel="noopener">Eagle Ray</a>, is the subject of the paragraph below.';

const OLD_WINDOWS_TAIL =
  'Other networks, including <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a>, carry their own configurations and receive each update ahead of mainnet.</p>';
const NEW_WINDOWS_TAIL =
  'Other networks, including <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a>, carry their own configurations and receive each update ahead of mainnet.</p><p>Eagle Ray has no such window: it was configured as <code>EnactAtStartOfEpochUnconditionally</code> at epoch 339,898 and so was never open to a vote. What each update changed about the engine&rsquo;s versioned system logic is set out at <a href="/contents/tech/core-protocols/system-layer" rel="noopener">System Layer</a>.</p>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => (b.text || '').includes('<td>Eagle Ray</td>'))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  let tableHit = 0;
  let claimHit = 0;
  let windowsHit = 0;
  for (const b of blocks) {
    if (typeof b.text !== 'string') continue;
    if (b.text.includes(AFTER_CUTTLEFISH)) {
      b.text = b.text.replace(AFTER_CUTTLEFISH, AFTER_CUTTLEFISH + ROW);
      tableHit++;
    }
    if (b.text.includes(OLD_WINDOWS_TAIL)) {
      b.text = b.text.replace(OLD_WINDOWS_TAIL, NEW_WINDOWS_TAIL);
      windowsHit++;
    }
    if (b.text.includes(OLD_CLAIM)) {
      b.text = b.text.replace(OLD_CLAIM, NEW_CLAIM);
      claimHit++;
    }
  }
  if (tableHit !== 1 || claimHit !== 1 || windowsHit !== 1) {
    throw new Error(`expected 1/1/1 replacements, got table=${tableHit} claim=${claimHit} windows=${windowsHit}`);
  }

  const version = '2.1.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  table row added, 75%-threshold claim qualified, windows paragraph extended`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      json, version, now, page.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Add Eagle Ray to the Enacted Updates table, which stopped at Cuttlefish while the prose below described Eagle Ray as enacted — a reader scanning the table came away with the wrong protocol version. Node v1.4.0.0 (tagged 2026-09-10 03:59:09Z) / Scrypto 1.4.0 (2026-09-07 17:35:11Z), enacted unconditionally at epoch 339,898 on 11 September 2026. Also qualifies "every mainnet update has used a 75% stake threshold", which Eagle Ray contradicts, and points the versioned-system-logic story at /contents/tech/core-protocols/system-layer.',
        now,
      ],
    );
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
