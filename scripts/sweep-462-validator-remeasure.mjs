// scripts/sweep-462-validator-remeasure.mjs – run 462, ecosystem staleness slice.
//
// The two oldest unlocked readings in /ecosystem after clarity-protocol are two
// validator pages last measured on 16 August 2026, both carrying on-ledger
// figures that the 11 September restart and a month of unstaking have moved.
// Re-measured at mainnet epoch 342,531/342,532 (20 September 2026, ~15:06 UTC):
//
//   CrumbsNode  73,200,929.24 XRD staked (was 74,487,256.22), rank 26 of 186
//               (was 24 of 187), pending-withdrawal vault 2,460,647.77 (was
//               15,369,221.78). The two vaults together are down 14,194,901.01
//               XRD, so the unstaking the page recorded as "in flight" has been
//               claimed and left. 30d uptime 100% (94,736 proposals, 2 missed).
//   Lucky8      7,970,824.01 XRD staked (flat on 7,972,823.82), rank 78 of 186
//               (was 81 of 188), owner withdrawal queue now 28 entries running
//               to epoch 350,414 (was 26 to 343,385). 30d uptime 99.88%
//               (16,212 proposals, 20 missed) against the 75.15% the page
//               carried from a Dashboard read of 17 July.
//
// Sources: Gateway /state/entity/details, /state/validators/list and
// /statistics/validators/uptime with from_ledger_state at 2026-08-21T15:00Z.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ path: new URL('../.env', import.meta.url) });

const DRY = process.argv.includes('--dry-run');
const TAG = 'ecosystem';

const EDITS = [
  {
    slug: 'crumbsnode',
    version: '2.3.0',
    sentinel: 'epoch 342,531',
    message:
      'Run 462: re-measured at mainnet epoch 342,531 (20 Sep 2026). Stake 73,200,929.24 XRD, rank 26 of 186; the pending-withdrawal vault has fallen from 15,369,221.78 to 2,460,647.77 and the two vaults together are down 14,194,901.01 XRD, so the unstaking the page recorded as in flight has been claimed and left, in claims of 4.52m and 4.24m XRD among others. 30-day uptime 100%.',
    subs: [
      [
        '<td>74,487,256.22 XRD &ndash; rank 24 of 187 registered validators</td>',
        '<td>73,200,929.24 XRD &ndash; rank 26 of 186 registered validators</td>',
      ],
      [
        '<td>15,369,221.78 XRD in the pending-withdrawal vault, awaiting claim</td>',
        '<td>2,460,647.77 XRD in the pending-withdrawal vault, awaiting claim</td>',
      ],
      [
        '<td>100%, as measured on the Radix Dashboard at epoch 326958 (17 July 2026)</td>',
        '<td>100% &ndash; 94,736 proposals made and 2 missed over the 30 days to 20 September 2026</td>',
      ],
      [
        '<td>Read live from the <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Radix Gateway</a> at mainnet epoch 335,407 (16 August 2026, 07:09&nbsp;UTC)</td>',
        '<td>Read live from the <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Radix Gateway</a> at mainnet epoch 342,531 (20 September 2026, 15:06&nbsp;UTC)</td>',
      ],
      [
        'at mainnet <strong>epoch 335,407</strong> (16 August 2026, 07:09&nbsp;UTC), CrumbsNode is <strong>registered</strong> and accepts delegated stake, with <strong>74,487,256.22&nbsp;XRD</strong> in its stake vault &ndash; <strong>rank 24 of the 187 registered validators</strong>. That is a fall from the &asymp;89.9 million XRD and rank 19 this page recorded at epoch 326958 on 17 July 2026, and it puts the node outside the top twenty for the first time in this page\u0027s history.',
        'at mainnet <strong>epoch 342,531</strong> (20 September 2026, 15:06&nbsp;UTC), CrumbsNode is <strong>registered</strong> and accepts delegated stake, with <strong>73,200,929.24&nbsp;XRD</strong> in its stake vault &ndash; <strong>rank 26 of the 186 registered validators</strong>, and inside the 100-strong active set with 1.58% of active stake. The stake vault has moved little since 16 August 2026, when it held 74,487,256.22&nbsp;XRD at epoch 335,407; the rank has slipped two places on a set that has itself lost a registered validator.',
      ],
      [
        'The XRD has not moved to another validator. A further <strong>15,369,221.78&nbsp;XRD</strong> sits in the validator\u0027s <code>pending_xrd_withdraw_vault</code> &ndash; stake that has been withdrawn from the stake vault and is waiting on the network\u0027s unstaking delay before its holders can claim it with the <a href="/contents/tech/core-concepts/liquid-stake-units" rel="noopener">claim NFTs</a> issued at unstake time. The two vaults together hold <strong>89,856,478.01&nbsp;XRD</strong>, within 0.1% of the figure this page previously carried, which is consistent with the drop being unstaking in flight rather than stake redelegated elsewhere. Claims are being drawn down against it: on <a href="https://dashboard.radixdlt.com/transaction/txid_rdx126htz82us2973kqdzzuymc3h27th6p77ztnyt8q32atv7njvumnsx90esn/summary" target="_blank" rel="noopener">14 August 2026 at 19:29&nbsp;UTC</a> a single <code>claim_xrd</code> call took 304,991.96&nbsp;XRD out of it.',
        'The unstaking this page recorded a month ago has now left. The <code>pending_xrd_withdraw_vault</code> &ndash; where stake sits after it is withdrawn from the stake vault, waiting on the network’s unstaking delay before its holders claim it with the <a href="/contents/tech/core-concepts/liquid-stake-units" rel="noopener">claim NFTs</a> issued at unstake time &ndash; held <strong>15,369,221.78&nbsp;XRD</strong> on 16 August and holds <strong>2,460,647.77&nbsp;XRD</strong> now. The two vaults together hold <strong>75,661,577.00&nbsp;XRD</strong> against the 89,856,478.01 of a month ago, a fall of <strong>14,194,901.01&nbsp;XRD</strong>, and the claims that took it out are on the ledger: <a href="https://dashboard.radixdlt.com/transaction/txid_rdx1hrjtt58fu7lavswe3x8842jm8uy5z9gxajlckcm673z007g3pw9qfrlzzt/summary" target="_blank" rel="noopener">4,516,151.39&nbsp;XRD on 20 August at 11:58&nbsp;UTC</a> and <a href="https://dashboard.radixdlt.com/transaction/txid_rdx1j28tk87lzadpujxrur383zavnuwa98tlherf72mhyrkuj2r0dmmq9lv6hs/summary" target="_blank" rel="noopener">4,242,350.45&nbsp;XRD on 18 August at 15:29&nbsp;UTC</a> among them. What stayed is the stake vault, which is flat. The node’s owner holds 418,770.70 stake units locked, with one withdrawal of 20,502.29 units unlocked since epoch 185,405 and never claimed.',
      ],
      [
        'The same divergence holds across a large minority of the <a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">validator set</a>.',
        'The same divergence holds across a large minority of the <a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">validator set</a>. Over the 30 days to 20 September 2026 the node made <strong>94,736</strong> proposals and missed <strong>2</strong>, a 100% record across the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">September halt and restart</a>.',
      ],
    ],
  },
  {
    slug: 'lucky8',
    version: '2.3.0',
    sentinel: 'epoch 342,531',
    message:
      'Run 462: re-measured at mainnet epoch 342,531/342,532 (20 Sep 2026). Stake flat at 7,970,824.01 XRD, rank 78 of 186 (was 81 of 188). The 75.15% 30-day uptime the page carried from a Dashboard read of 17 July is superseded: 16,212 proposals made and 20 missed over the 30 days to 20 September is 99.88%. The owner withdrawal queue is now 28 entries totalling 40,114 stake units and runs to epoch 350,414.',
    subs: [
      [
        '<td>≈7.97 million XRD (rank #81 of 188 registered validators)</td>',
        '<td>≈7.97 million XRD (rank #78 of 186 registered validators)</td>',
      ],
      [
        '<td>75.15% (Radix Dashboard, 17 July 2026)</td>',
        '<td>99.88% – 16,212 proposals made and 20 missed over the 30 days to 20 September 2026</td>',
      ],
      [
        '<td>Validator substate read at the <a href="https://docs.radixdlt.com/docs/network-apis" target="_blank" rel="noopener">Gateway API</a>, mainnet epoch 335,551 (16 August 2026)</td>',
        '<td>Validator substate read at the <a href="https://docs.radixdlt.com/docs/network-apis" target="_blank" rel="noopener">Gateway API</a>, mainnet epoch 342,531 (20 September 2026)</td>',
      ],
      [
        'On-ledger the validator holds 7,972,823.82 XRD at mainnet epoch 335,551 (16 August 2026), ranking 81st of the 188 registered validators and sitting inside the 100-strong active set with 0.167% of active stake; its recorded 30-day uptime was 75.15% when the <a href="https://dashboard.radixdlt.com/network-staking/validator_rdx1sw2qt9k0placmjgwku2kvk66c2v8v0f9ny2fkvzhsh7wwzey6g7zam" target="_blank" rel="noopener">Radix Dashboard</a> was read on 17 July 2026.',
        'On-ledger the validator holds 7,970,824.01 XRD at mainnet epoch 342,531 (20 September 2026), ranking 78th of the 186 registered validators and sitting inside the 100-strong active set with 0.172% of active stake. Its stake is flat on the 7,972,823.82 XRD read a month earlier at epoch 335,551, so the node neither gained nor lost delegators over the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">September halt and restart</a>. Its uptime over the 30 days to 20 September is <strong>99.88%</strong>: 16,212 proposals made against 20 missed, read from the Gateway’s validator statistics. This supersedes the 75.15% this page carried from a Radix Dashboard reading of 17 July 2026.',
      ],
      [
        'and Lucky8&rsquo;s carries 1,116.43 of them against 26 queued withdrawals of roughly 1,400 units each – one requested about every 288 epochs, or once a day, and each unlocking some four weeks later, so that the queue runs out to epoch 343,385. A further 186,287.25 XRD sits in the validator&rsquo;s pending withdrawal vault.',
        'and Lucky8&rsquo;s carries 890.74 of them against 28 queued withdrawals of roughly 1,400 units each, 40,114 units in total – one requested about every 288 epochs, or once a day, and each unlocking some four weeks later, so that the queue now runs out to epoch 350,414. A further 191,235.45 XRD sits in the validator&rsquo;s pending withdrawal vault.',
      ],
    ],
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const edit of EDITS) {
    if (isLockedPage(TAG, edit.slug)) throw new Error(`${edit.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      [TAG, edit.slug],
    );
    if (!rows.length) throw new Error(`page not found: ${TAG}/${edit.slug}`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    const whole = JSON.stringify(blocks);
    if (whole.includes(edit.sentinel)) {
      console.log(`  ${edit.slug}: already applied (sentinel "${edit.sentinel}") - no write`);
      continue;
    }

    let applied = 0;
    const walk = (bs) => {
      for (const b of bs) {
        if (typeof b.text === 'string') {
          for (const [from, to] of edit.subs) {
            if (b.text.includes(from)) { b.text = b.text.split(from).join(to); applied++; }
          }
        }
        if (Array.isArray(b.blocks)) walk(b.blocks);
      }
    };
    walk(blocks);

    if (applied !== edit.subs.length) {
      throw new Error(`${edit.slug}: ${applied} of ${edit.subs.length} substitutions matched - refusing to write`);
    }

    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${edit.version}  (${applied} substitutions)`);
    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query(
        'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
        [json, edit.version, now, page.id],
      );
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, edit.version, 'minor', AUTHOR_ID, edit.message, now],
      );
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
