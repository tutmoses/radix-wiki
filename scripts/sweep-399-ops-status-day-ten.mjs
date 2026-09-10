// Run 399 (contents/resources rotation). Day ten of the halt, and the first day of it with
// a final node release to install. Records three things the page does not have: the Stokenet
// milestone the Accountability Council reported at 18:43 UTC on 9 September; babylon-node
// v1.4.0.0, published 03:59:09 UTC on 10 September against the same commit as the 8 September
// candidate, which closes the installer gap this wiki recorded on 8 and 9 September; and the
// first public statement of near-term restart intent, from Timan Rebel at 05:52 UTC.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/resources';
const SLUG = 'radix-ecosystem-operational-status';
const SENTINEL = 'halt-day-ten';
const DRY = process.argv.includes('--dry-run');

const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

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
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied - no write'); process.exit(0); }

  const halt = blocks.find((b) => b.text?.includes('The network halt of 31 August 2026'));
  if (!halt) throw new Error('halt section not found');
  if (!halt.text.trimEnd().endsWith('</p>')) throw new Error('halt section does not end on a paragraph');

  const ADD = `<p id="${SENTINEL}"><strong>Day ten, and the fix has cleared a test network and shipped as a final release.</strong> At 18:43 UTC on 9 September the ${A('https://t.me/RadixAccountabilityCouncil/1012', 'Radix Accountability Council')} reported its first milestone: the new node software and the protocol update were deployed on ${A('/contents/tech/releases/stokenet', 'Stokenet')} and the whole scenario validated end to end, with the next steps named as a final commit for the release, a date, and then a mainnet plan. It asked operators not to run release candidates on their own nodes and to wait for official final versions and instructions.</p>
<p>That final version arrived nine hours later. ${A('https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0', 'babylon-node v1.4.0.0')} was published at <strong>03:59:09 UTC on 10 September 2026</strong>, with container images pushed between 04:31 and 04:50 UTC. It tags commit <code>7400951e</code>, which is the commit the 8 September candidate already tagged, so the code is the code operators could have installed two days earlier; what the final release changes is the pre-release flag. Removing it fixes something this page recorded as broken: GitHub reports as <q>latest</q> the newest release that is neither a draft nor a pre-release, and for two days that was <code>v1.3.0.5-test.1</code>, an empty tag cut before the fix. Read at 07:06 UTC on 10 September, both GitHub and the <code>ghproxy.radixdlt.com</code> mirror that ${A('/developers/infrastructure/01-running-a-node', 'the babylonnode installer reads')} return v1.4.0.0.</p>
<p><strong>The first statement of when is not a date.</strong> At 05:52 UTC on 10 September, in the main Radix Telegram group, ${A('https://t.me/radix_dlt/1002777', 'Timan Rebel said')} the Stokenet upgrade had gone smoothly and that mainnet is close to coming back: it needs coordination with the node runners, so it will not be today, but he hopes it can be done in the coming days. Rebel runs the DEX aggregator ${A('/ecosystem/astrolescent', 'Astrolescent')} rather than speaking for the Radix Foundation or the council, and no dated restart has been published by either; nothing has appeared on the Foundation's announcement channel in the two days to this reading.</p>
<p>The ledger has not moved for any of it. Read at <strong>07:07:53 UTC on 10 September</strong>, ${A('https://mainnet.radixdlt.com/status/gateway-status', 'gateway-status')} returns the ledger it has returned since the stop, state version 557,840,622 at epoch 339,896, round 102, two hundred and twenty-five hours and forty-eight minutes without a committed round; <code>/state/validators/list</code> answers HTTP 500 at a sync delay of <strong>812,927 seconds</strong> against the 720 the Gateway tolerates, and reports itself 9 days, 9 hours and 48 minutes behind. Stokenet is advancing normally at epoch 3,687.</p>`;

  halt.text = halt.text.trimEnd() + '\n' + ADD;

  const version = '1.14.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  halt section ${page.content.find((b) => b.text?.includes('The network halt of 31 August 2026')).text.length} -> ${halt.text.length} chars`);
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
       'Day ten of the halt: the Accountability Council reported the Stokenet milestone at 18:43 UTC on 9 September, babylon-node v1.4.0.0 shipped final at 03:59:09 UTC on 10 September against the same commit as the candidate (which retires the v1.3.0.5-test.1 installer gap recorded above), and Timan Rebel said at 05:52 UTC that mainnet is close but not today. Gateway reading refreshed to 07:07:53 UTC, 225h48m.',
       now]);
    await client.query('COMMIT');
    console.log('  committed');
  }
} finally {
  client.release();
  await pool.end();
}
