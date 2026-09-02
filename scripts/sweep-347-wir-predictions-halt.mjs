// Run 347, blog rotation. The prediction ledger is this wiki's own instrument, and
// the network halt has taken away the evidence source for three of its five open
// claims. Record that where a reader meets the claims, and take the one in-window
// reading that is still possible.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'blog';
const SLUG = 'week-in-review';
const SENTINEL = 'id="halt-and-scoring"';
const DRY = process.argv.includes('--dry-run');

const NOTE = `<p id="halt-and-scoring"><strong>Scoring is suspended for three of these claims.</strong> Radix mainnet <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halted at 21:19:06 UTC on 31 August 2026</a> and had not restarted when this page was re-read at 11:12 UTC on 1 September. Every claim below that is scored against on-ledger state now has no evidence source: the Gateway refuses read requests outright, answering <code>/state/validators/list</code> and <code>/state/entity/details</code> with HTTP 500 and its own reason, that its database &ldquo;is not sufficiently up to date with the Network's Ledger (it is currently 13 hours, 52 minutes, 53 seconds behind)&rdquo;. That covers the StakeSafe fee increases, the CaviarNine validators and the on-ledger half of the Radix DAO ratification claim. The ledger has also stopped moving underneath them, so nothing they are watching for can happen while the halt holds. The due dates are left as recorded rather than extended, because moving a deadline after the fact would make the ledger score itself.</p>`;

const HS_OLD = `A single contributor is the whole sample, so a holiday settles this as surely as a change of direction would.`;
const HS_NEW = HS_OLD + ` First in-window reading, taken 1 September 2026 11:12 UTC: <strong>6 commits</strong>, all dated 31 August, none yet on 1 September, against a pace of roughly 48 a day in the baseline week. Read in isolation that is far off, but the window opened on the day of the drain and the repository owner spent that evening <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">liquidating his exposure to Radix in public</a>, so the reading dates the disruption rather than settling the claim.`;

const INFOBOX_OLD = `<tr><th>Tracking since</th>`;
const INFOBOX_NEW = `<tr><th>Scoring</th><td>Suspended for the 3 ledger-scored claims while mainnet is halted (re-read 1 September 2026)</td></tr><tr><th>Tracking since</th>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const open = blocks.find((b) => (b.text || '').includes('<h2>Open predictions</h2>'));
  if (!open) throw new Error('open predictions section not found');
  if (!open.text.includes(HS_OLD)) throw new Error('hyperscale-vm row not matched');
  open.text = open.text
    .replace('<h2>Open predictions</h2>', `<h2>Open predictions</h2>${NOTE}`)
    .replace(HS_OLD, HS_NEW);

  const info = blocks[0]?.blocks?.[0];
  if (!info || !info.text.includes(INFOBOX_OLD)) throw new Error('infobox row not matched');
  info.text = info.text.replace(INFOBOX_OLD, INFOBOX_NEW);

  const version = '1.14.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'The network halt has removed the evidence source for three of the five open predictions: the Gateway now refuses every read with HTTP 500 and a 13h52m sync delay. Recorded at the head of the section, due dates left as they were. First in-window reading for the hyperscale-vm commit claim: 6 commits, all on 31 August.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
