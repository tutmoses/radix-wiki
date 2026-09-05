import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'developers/getting-started';
const SLUG = '03-deploying';
const SENTINEL = 'Mainnet is not accepting transactions';
const DRY = process.argv.includes('--dry-run');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  // --- 1. infobox: re-date the Checked row and add a network-status row
  const info = blocks.find((b) => b.type === 'infobox');
  const infoInner = info.blocks[0];
  const beforeInfo = infoInner.text;
  infoInner.text = infoInner.text.replace(
    '<tr><td><strong>Checked</strong></td><td>14 August 2026</td></tr>',
    '<tr><td><strong>Mainnet status</strong></td><td>halted &ndash; no round committed since 31 August 2026</td></tr>'
    + '<tr><td><strong>Stokenet status</strong></td><td>live; ledger reset 29 August 2026</td></tr>'
    + '<tr><td><strong>Checked</strong></td><td>4 September 2026</td></tr>');
  if (infoInner.text === beforeInfo) throw new Error('infobox Checked row not matched');

  // --- 2. Overview: replace the stale future-tense Stokenet-reset callout with the live network status
  const overview = blocks.find((b) => b.text?.includes('<h2>Overview</h2>'));
  if (!overview) throw new Error('Overview block not found');
  const staleStart = '<div data-callout="warning"><div><p data-callout-title>Stokenet is being reset on 29 August 2026</p>';
  const staleEnd = 'for the full terms.</p></div></div>';
  const i = overview.text.indexOf(staleStart);
  const j = overview.text.indexOf(staleEnd);
  if (i === -1 || j === -1) throw new Error('stale Stokenet callout not matched');
  const stale = overview.text.slice(i, j + staleEnd.length);

  const replacement =
    '<div data-callout="danger"><div><p data-callout-title>Mainnet is not accepting transactions</p>'
    + '<p>Step 3 below deploys to <strong>Mainnet</strong>, and Mainnet has committed no round since '
    + '<strong>21:19:06&nbsp;UTC on 31 August 2026</strong>. Read at 19:03&nbsp;UTC on 4 September 2026, the public '
    + '<a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a> '
    + 'still returns state version 557,840,622 at epoch 339,896 round 102, and <code>/state/validators/list</code> answers '
    + 'HTTP 500 because its database is 3 days 21 hours behind the ledger. A package upload will not commit. '
    + '<a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> is unaffected and is producing rounds normally, '
    + 'so for the moment the only network you can deploy to is the one with no hosted console. Background: '
    + '<a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane asset drain and network halt</a>; '
    + 'live status on <a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">Radix ecosystem operational status</a>.</p></div></div>'
    + '<div data-callout="warning"><div><p data-callout-title>Stokenet was reset on 29 August 2026</p>'
    + '<p>Anything you had put on Stokenet before that date &ndash; the package, the '
    + '<a href="/contents/tech/core-concepts/components" rel="noopener">component</a> instantiated from it, the test XRD that paid for both &ndash; '
    + 'is gone. The tutorial still works; what you build on Stokenet is disposable by design. See '
    + '<a href="#stokenet-reset">After the reset</a> below.</p></div></div>';
  overview.text = overview.text.replace(stale, replacement);

  // --- 3. "After the reset": the reset is now past, and it is measurable
  const resetBlock = blocks.find((b) => b.text?.includes('id="stokenet-reset"'));
  if (!resetBlock) throw new Error('reset block not found');
  const oldLead = '<p><strong>Stokenet is wiped on Saturday 29 August 2026.</strong> The date was set on';
  if (!resetBlock.text.includes(oldLead)) throw new Error('reset lead sentence not matched');
  resetBlock.text = resetBlock.text.replace(oldLead,
    '<p><strong>Stokenet was wiped on Saturday 29 August 2026, and the wipe is visible in the ledger itself.</strong> '
    + 'Eight hours after the window opened, the Stokenet Gateway returned epoch 51 at state version 137,506 &ndash; against '
    + 'epoch 254,946 and state version 425,013,339 ten days earlier &ndash; on the same node release, v1.10.6. '
    + 'The date had been set on');
  const oldTail = 'the network goes down at <strong>07:00&nbsp;UTC (09:00 CEST)</strong>';
  if (!resetBlock.text.includes(oldTail)) throw new Error('reset tail not matched');
  resetBlock.text = resetBlock.text.replace(oldTail, 'the network went down at <strong>07:00&nbsp;UTC (09:00 CEST)</strong>');
  resetBlock.text = resetBlock.text.replace(
    'and several hours of downtime are expected, because the operator is taking the window for server maintenance as well.',
    'and several hours of downtime followed, because the operator took the window for server maintenance as well.');
  resetBlock.text = resetBlock.text.replace(
    'The ledger being replaced is not small: the Stokenet Gateway reported <strong>state version 425,013,339</strong> at epoch 254,946 on 19 August 2026, running node v1.10.6.',
    'The ledger it replaced was not small.');
  resetBlock.text = resetBlock.text.replace(
    'A developer whose launch plan the date breaks can say so in that group and ask for it to move.',
    'The replacement ledger has been running since: read at 19:05&nbsp;UTC on 4 September 2026 it stood at epoch 2,103, '
    + 'state version 5,384,258, advancing about a hundred state versions every twenty seconds &ndash; so a Stokenet deployment made today behaves normally.');

  // --- 4. Stokenet-is-unaffected sentence: date it against the halt
  const stokBlock = blocks.find((b) => b.text?.includes('It is the hosted web tooling that is gone.'));
  if (!stokBlock) throw new Error('stokenet-unaffected sentence not found');
  stokBlock.text = stokBlock.text.replace(
    'Stokenet itself is unaffected: the network runs, and its Gateway still answers at',
    'Stokenet itself is unaffected, and that is now the load-bearing half of this page: through the Mainnet halt described above the testnet has kept committing rounds, and its Gateway still answers at');

  const version = '2.3.0';
  const metadata = { ...(page.metadata || {}), last_verified_at: new Date().toISOString() };
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (DRY) {
    console.log('\n--- INFOBOX ---\n' + info.blocks[0].text.slice(-420));
    console.log('\n--- OVERVIEW ---\n' + overview.text.slice(0, 1900));
    console.log('\n--- RESET ---\n' + resetBlock.text.slice(resetBlock.text.indexOf('id="stokenet-reset"'), resetBlock.text.indexOf('id="stokenet-reset"') + 1700));
    console.log('\n--- UNAFFECTED ---\n' + stokBlock.text.slice(-460));
  } else {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, metadata=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
      [json, version, JSON.stringify(metadata), now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Network status: the page told developers to deploy to Mainnet, which has committed no round since 31 August 2026 21:19:06 UTC (state version 557,840,622 at epoch 339,896, read 4 September 19:03 UTC), while its Stokenet reset warning was still in the future tense six days after the reset happened. Both corrected against the two public Gateways, and the reset dated by the ledger it produced.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
