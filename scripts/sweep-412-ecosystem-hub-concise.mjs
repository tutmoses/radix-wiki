/**
 * sweep 412 — the Ecosystem hub made short enough to see the directory from.
 *
 * /ecosystem is the wiki's largest listing, and its hub article ran five
 * sections and ~900 words before the first project card: measured at 1280px on
 * 11 September 2026, the results bar sat 2,347px down, two and a half screens
 * below the fold. Three of those sections restated the infobox counts, the
 * facet controls, or the halt.
 *
 * This cuts the article to a lead and one method section, and rewrites the
 * infobox, which also carried numbers the halt made stale:
 *   - the composition, re-counted from the pages table on 11 September 2026:
 *     150 entries, 58 active, 50 dormant, 35 closed or departed, 7 on testnet
 *     or in development (was 59/8/48/35, read 5 September)
 *   - the network row and the status paragraph, which both still said mainnet
 *     was halted; it restarted at 11:35:28.96 UTC on 11 September 2026, and the
 *     Gateway answered /status/gateway-status at epoch 340,000 during this run
 *
 * Run:  node scripts/sweep-412-ecosystem-hub-concise.mjs [--dry-run]
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = '';
const SENTINEL = 'An entry stays after the project stops';

const INFOBOX = `<table><tbody>` +
  `<tr><th colspan="2">Radix Ecosystem</th></tr>` +
  `<tr><td><strong>Scope</strong></td><td>Projects built on, or serving, <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix</a></td></tr>` +
  `<tr><td><strong>Pages</strong></td><td>150, read 11 September 2026</td></tr>` +
  `<tr><td><strong>By status</strong></td><td>58 active, 50 dormant, 35 closed or departed, 7 on testnet or in development</td></tr>` +
  `<tr><td><strong>Largest categories</strong></td><td>Finance (38), Staking (23), Infrastructure (17)</td></tr>` +
  `<tr><td><strong>Status index</strong></td><td><a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">Radix Ecosystem Operational Status</a></td></tr>` +
  `<tr><td><strong>Network</strong></td><td>Mainnet restarted 11:35&nbsp;UTC on 11 September 2026, after a 254-hour halt</td></tr>` +
  `</tbody></table>`;

const LEAD =
  `<p>This section is a directory of the projects built on <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix</a> or built to serve it: exchanges and lending markets, validators, wallets, games, tooling, tokens, and the organisations behind them. Each entry opens with a facts table, then says what the project does and what has happened to it, with every claim linked to its source.</p>` +
  `<p>${SENTINEL}, so this is a record of who has been here rather than a list of what runs today, and more than half of the pages below describe something that has ended. Two pages outside the section carry the context it assumes: <a href="/contents/history/radix-ecosystem-funding" rel="noopener">Radix Ecosystem Funding</a>, for the grant and treasury programmes that paid for much of what is listed here, and <a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Radix Mainnet (Xi&rsquo;an)</a>, the upgrade the projects still running will have to migrate to.</p>`;

const STATUS =
  `<h2>How a status is decided</h2>` +
  `<p>The <code>status</code> on each page records whether the people behind a project are still operating it, not whether its website answers: a domain outlives the project on it. The <a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">operational-status index</a> groups every entry by status and sets out the checks that do settle it. Two of them, validator registration and on-ledger token supply, are read through the <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Radix Gateway</a>, which served no state while mainnet was <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halted between 31 August and 11 September 2026</a>; a status set in that window has not been confirmed against the ledger since.</p>`;

const EXCERPT =
  'A directory of the 150 projects built on Radix or serving it, the closed ones included: what each entry records and how its status is judged.';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: { rejectUnauthorized: false },
});
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error(`no hub page at ${TAG_PATH}/${SLUG}`);
  const page = rows[0];

  if (JSON.stringify(page.content).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const infoboxId = page.content.find((b) => b.type === 'infobox')?.id ?? uid();
  const blocks = [
    { id: infoboxId, type: 'infobox', blocks: [{ id: uid(), type: 'content', text: INFOBOX }] },
    { id: uid(), type: 'content', text: LEAD },
    { id: uid(), type: 'content', text: STATUS },
  ];

  const before = page.content.reduce((n, b) => n + (b.text?.length ?? 0), 0);
  const after = blocks.reduce((n, b) => n + (b.text?.length ?? 0), 0);
  const version = '2.0.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  blocks ${page.content.length} -> ${blocks.length}, prose ${before} -> ${after} chars`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    const metadata = { ...(page.metadata ?? {}), excerpt: EXCERPT };
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content = $1, version = $2, metadata = $3, updated_at = $4, last_verified_at = $4 WHERE id = $5',
      [json, version, JSON.stringify(metadata), now, page.id],
    );
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'major', AUTHOR_ID,
       'Cut the hub from five sections to a lead and one method section, so the 150-card directory starts a screen down rather than two and a half. The counts move to the infobox and are re-read from the pages table on 11 September 2026 (150 entries: 58 active, 50 dormant, 35 closed or departed, 7 testnet or in development); the network row and the status section stopped saying mainnet was halted, since it restarted at 11:35 UTC on 11 September.',
       now],
    );
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
