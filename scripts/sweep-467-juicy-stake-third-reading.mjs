import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// sweep 467 - /ecosystem/juicy-stake said the delegated stake was falling.
// A third reading says it stopped falling five weeks ago.
//
// The page's measured claim was two readings old: 12,610,520.465 XRD in the
// stake vault on 1 and 6 August, 12,087,329.820 at epoch 335,694 on 17 August,
// and the section concluded "Delegators have now started to leave" with the
// infobox reading "delegated stake now falling". Read again at epoch 342,772
// (state version 559,116,171, 11:10 UTC 21 September 2026) the stake vault
// holds 12,087,329.820082095715034029 XRD, the 17 August figure to the last
// decimal place, across 7,078 epochs. The pending withdraw vault has fallen
// from 661,871.150645647908576531 to 656,098.191749754693049069 XRD, which is
// the queue draining rather than new withdrawals. is_registered is still false
// and validator_fee_factor is still 0.02.
//
// Also re-probed on 21 September and unchanged, so the Re-verified stamp moves
// with the reading rather than the page claiming a check it did not make:
// www.juicystake.org 200 and still advertising 19,726,201 XRD staked, 6.77%
// APY and 99.99% uptime; the apex still 301s to plain HTTP;
// docs.juicystake.org still the 163-byte cPanel default; juicystake.io still
// HTTP 502.
//
// Dry run: node scripts/sweep-467-juicy-stake-third-reading.mjs --dry-run

const TAG_PATH = 'ecosystem';
const SLUG = 'juicy-stake';
const SENTINEL = 'epoch 342,772';
const DRY = process.argv.includes('--dry-run');

const LSU = 'resource_rdx1t5d8gv6fmwv40sreuypwrwh2mmknr4vf7fdtyrmfr7upjmschwczn0';

const EDITS = [
  {
    what: 'infobox Status row',
    from: 'Dormant \u2014 validator unregistered on-ledger; delegated stake now falling; website still live and still advertising the node',
    to: 'Dormant \u2013 validator unregistered on-ledger; delegated stake unchanged since 17 August; website still live and still advertising the node',
  },
  {
    what: 'infobox Validator row',
    from: '12,087,329.82 XRD still delegated and now falling, 2% fee (read on-ledger 17 August 2026, epoch 335,694, state version 550,831,708)',
    to: '12,087,329.82 XRD still delegated and unchanged since 17 August, 2% fee (read on-ledger 21 September 2026, epoch 342,772, state version 559,116,171)',
  },
  {
    what: 'Status: re-verified stamp',
    from: '<em>Re-verified 17 August 2026.</em>',
    to: '<em>Re-verified 21 September 2026.</em>',
  },
  {
    what: 'Status: the stake-vault reading',
    from: '<p><strong>Delegators have now started to leave.</strong> The stake vault held 12,610,520.465017496855168922 XRD on 1 August and the identical figure on 6 August &ndash; over those five days nobody withdrew a single token. At epoch 335,694 (17 August 2026, state version 550,831,708) it holds <strong>12,087,329.820082095715034029 XRD</strong>: 523,190.644935401140134893 XRD has left the stake vault in the eleven days since. A further 661,871.150645647908576531 XRD sits in the validator&rsquo;s pending withdraw vault, which is stake already unbonding on its way to unstake claims rather than stake lost; the earlier readings recorded only the stake vault, so how much of that queue predates them cannot be settled from a single read. The node&rsquo;s fee remains 2%, and its stake-unit resource (<code>' + LSU + '</code>) and unstake-claim NFT are live, so the stake that remains can still be withdrawn in the normal way. The site has not changed the figure it advertises, so the gap between it and the ledger has widened from roughly 7.1 to roughly 7.6 million XRD.</p>',
    to: '<p><strong>The withdrawals stopped after five days.</strong> The stake vault held 12,610,520.465017496855168922 XRD on 1 August and the identical figure on 6 August, then <strong>12,087,329.820082095715034029 XRD</strong> at epoch 335,694 on 17 August: 523,190.64 XRD left over those eleven days. At epoch 342,772 (21 September 2026, state version 559,116,171) it holds <strong>12,087,329.820082095715034029 XRD</strong>, the 17 August figure to the last decimal place. Nothing has been unstaked here in the 7,078 epochs between the two readings, about five weeks, over which the validator stayed unregistered and the stake delegated to it earned nothing. The validator&rsquo;s pending withdraw vault has fallen from 661,871.150645647908576531 to 656,098.191749754693049069 XRD, which is delegators collecting unstake claims already in the queue rather than new withdrawals starting. The node&rsquo;s fee remains 2%, and its stake-unit resource (<code>' + LSU + '</code>) and unstake-claim NFT are live, so the stake that remains can still be withdrawn in the normal way. The site has not changed the figure it advertises, so the gap between it and the ledger stands at roughly 7.6 million XRD.</p>',
  },
  {
    what: 'Status: docs.juicystake.org re-probe',
    from: 'read on 17 August 2026 it returns a 163-byte cPanel default page',
    to: 'read again on 21 September 2026 it still returns a 163-byte cPanel default page',
  },
];

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
    console.log('  already applied \u2013 no write');
    process.exit(0);
  }

  // Inline anchors on the bulk-generated ecosystem pages carry U+00A0 around
  // them, so a find-string written with ordinary spaces matches nothing.
  const pattern = (s) =>
    new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[ \u00A0]'), 'g');

  const apply = (node) => {
    if (typeof node?.text !== 'string') return;
    for (const e of EDITS) {
      if (!pattern(e.from).test(node.text)) continue;
      node.text = node.text.replace(pattern(e.from), () => e.to);
      e.hits = (e.hits || 0) + 1;
    }
  };
  for (const b of blocks) { apply(b); for (const n of b.blocks || []) apply(n); }

  for (const e of EDITS) {
    console.log(`  ${e.hits ? 'OK  ' : 'MISS'}  ${e.what}${e.hits ? ` (${e.hits})` : ''}`);
    if (!e.hits) throw new Error(`no match: ${e.what}`);
  }

  const version = '3.2.0';
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
       'Third reading of the stake vault: the withdrawals stopped. At epoch 342,772 (state version 559,116,171, 21 September 2026) it holds 12,087,329.820082095715034029 XRD, the 17 August figure to the last decimal place, so nothing has been unstaked in 7,078 epochs; the page said the stake was falling. The pending withdraw vault has fallen by 5,772.96 XRD, which is the queue draining. Registration still false, fee still 2%, the site still advertising 19,726,201 XRD.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
