// Run 347. The halt's second day: the first official statement since the night of
// the drain, the test network being taken down to stage the fix, and the reason the
// official channels have stayed quiet. Everything here is read at its source and
// timestamped; nothing is inferred about the fix itself.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'id="day-two"';
const DRY = process.argv.includes('--dry-run');

const SECTION = `<h2 id="day-two">Day two: the first official update</h2>` +
  `<p>Re-read at <strong>11:04 UTC on 1 September 2026</strong>, the <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a> returns the same ledger for the third consecutive reading: state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179 UTC. That is thirteen hours and forty-five minutes without a committed round.</p>` +
  `<p>The first official word since 22:02 UTC the previous night came at <strong>09:10 UTC</strong>, in an update posted to the <a href="https://t.me/RadixAccountabilityCouncil/931" target="_blank" rel="noopener">Radix Accountability Council's channel</a>. It says a team assembled by the Foundation, the council and community members is working on a fix, that there is &ldquo;absolute convergence and solid certainty on what caused the bug to be there and where it came from&rdquo;, and that there are &ldquo;no expectations or timelines at this stage&rdquo;. It also settles what the stopped network now is: the halt is a control being held on purpose, not a failure still in progress. &ldquo;The current halting status of the network is our best defense and will stay on as long as we need it.&rdquo; The council closed by asking the community to keep working on the <a href="/contents/tech/core-concepts/radix-governance" rel="noopener">Governance Framework ratification</a>, which it said had not lost its importance.</p>` +
  `<p>The clearest sign that a fix is being staged came from the developer channel rather than from an announcement. Radix's public test network, <a href="https://docs.radixdlt.com/docs/network-gateway" target="_blank" rel="noopener">Stokenet</a>, is running: read live at 11:07 UTC its Gateway returns epoch 1,111, round 2,487, proposer round timestamp 11:07:22.546 UTC, so it is producing rounds while mainnet is not. Its developer console is not; <code>stokenet-console.radixdlt.com</code> answered <code>530</code> to a request at the same minute, which is what a developer <a href="https://t.me/RadixDevelopers/66215" target="_blank" rel="noopener">reported at 09:54</a>. Daffy, who runs the network's community infrastructure, <a href="https://t.me/RadixDevelopers/66220" target="_blank" rel="noopener">answered at 10:32</a> that Stokenet itself &ldquo;is up&rdquo; and would be &ldquo;taken down for planned maintenance for reasons you probably understand&rdquo;, adding that he would say when. A test network taken offline deliberately in the middle of a mainnet halt is where a patched Engine gets tried before any validator is asked to run it.</p>` +
  `<p>The forensic work continued in parallel and is separate from the fix. <a href="https://github.com/0xOmarA" target="_blank" rel="noopener">0xOmarA</a> wrote at <a href="https://t.me/radix_dlt/1000902" target="_blank" rel="noopener">05:43 UTC</a> that he already had the data he needed from the Core API and the Gateway, and that he was looking for a trace the attacker left in an earlier attempt, on Stokenet or in a failed run on mainnet, rather than for anything further in the successful transactions.</p>` +
  `<p>The silence in the official channels was explained the night before. At <a href="https://t.me/radix_dlt/1000765" target="_blank" rel="noopener">21:17 UTC on 31 August</a>, two minutes before the last round, the Foundation said it was in contact with bridges, exchanges and security partners, that it was &ldquo;reaching out to relevant authorities and taking advice on next steps&rdquo;, and that it &ldquo;may be limited in the updates we can provide&rdquo;. Measured against the repositories, that is what has happened: re-read at 11:07 UTC, <a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">babylon-node</a>'s newest release is still <code>v1.3.0.5</code> of 1 June 2026, the default branch of <a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a> still last moved on 27 March 2026, <a href="https://www.radixdlt.com/blog" target="_blank" rel="noopener">the Foundation's blog</a> carries no post about the incident, and <a href="https://radixdao.org/notices.json" target="_blank" rel="noopener">the DAO's notice feed</a> still ends on 29 August. Fourteen hours in, everything anyone outside the repair knows about it was said in a Telegram channel.</p>`;

const STATUS_OLD = `Halted 21:19:06 UTC, 31 August 2026 – last round: epoch 339,896, round 102. Still halted when re-read at 07:02 UTC, 1 September, nine hours and forty-three minutes after the last round`;
const STATUS_NEW = `Halted 21:19:06 UTC, 31 August 2026 – last round: epoch 339,896, round 102. Still halted when re-read at 11:04 UTC, 1 September, thirteen hours and forty-five minutes after the last round`;

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

  const at = blocks.findIndex((b) => (b.text || '').includes('id="off-the-chain"'));
  if (at < 0) throw new Error('anchor section not found');
  blocks.splice(at + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const info = blocks[0];
  const row = info?.blocks?.[0];
  if (!row || !row.text.includes(STATUS_OLD)) throw new Error('infobox network-status row not matched');
  row.text = row.text.replace(STATUS_OLD, STATUS_NEW);

  const version = '2.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  blocks ${page.content.length} -> ${blocks.length}, section at ${at + 1}`);
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
       'Day two of the halt: the RAC\'s 09:10 UTC update (cause converged, no timeline, halt held deliberately), Stokenet running but due to be taken down for planned maintenance, 0xOmarA hunting an earlier attempt, and the Foundation\'s own reason for the silence. Gateway re-read at 11:04 UTC, unchanged. Infobox network-status re-dated.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
