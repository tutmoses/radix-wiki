// sweep-419: the contents/tech pages that still described the halt, or a Scrypto
// release that has since been superseded.
//
// Run 418 named radix-gateway-api as the worst surviving carrier of the halt-boundary
// label, because every pinned-read citation on the wiki links to it. A contents/tech
// probe on 12 September found four more present-tense halt claims (babylon-node,
// radix-vs-ethereum, radix-engine) and two version claims the Eagle Ray release moved
// (scrypto-programming-language, stokenet).
//
// Verified this run, 19:06-19:07 UTC 12 September 2026:
//   POST /stream/transactions from 557,840,626 asc, kind All:
//     557,840,626 ep339897 r1 2026-08-31T21:19:48.939Z
//     557,840,627 ep339897 r4 2026-08-31T21:19:48.939Z   last state before the halt
//     557,840,628 ep339897 r5 2026-09-11T11:35:28.96Z    rounds resume
//   /state/entity/details pinned at 557,840,627 -> 200, ledger_state echoes ep339897 r4
//   /state/entity/details and /state/validators/list unpinned -> 200
//   /status/gateway-status -> state version 557,958,356, epoch 340,275
//   GitHub releases: radixdlt-scrypto v1.4.0 2026-09-07T17:35:11Z (prev v1.3.1
//     2026-01-20); babylon-node v1.4.0.0 2026-09-10T03:59:09Z
//   rust-toolchain.toml channel = "1.92.0" at both v1.3.1 and v1.4.0
//   radix-engine/src/system/system_callback.rs: verify_boot_ref_value is
//     byte-identical at v1.3.1 (L1147) and v1.4.0 (L1158). v1.4.0 adds, in
//     before_invoke, a receiver-access check gated on
//     versioned_system_logic.should_check_method_receiver_access() that returns
//     SystemError::InvalidInvokeAccess, a variant absent from v1.3.1's errors.rs.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const NBSP = "\u00A0";
const EM_DASH = "\u2014";

const EDITS = [
  {
    tagPath: 'contents/tech/core-protocols', slug: 'radix-gateway-api', version: '1.6.0', changeType: 'minor', stamp: true,
    sentinel: 'id="after-the-restart"',
    replacements: [
      {
        from: 'The mainnet <a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">halt that began on 31 August 2026</a> holds the guard open long enough to read it.',
        to: 'The mainnet <a href="/contents/resources/radix-ecosystem-operational-status#network-halt" rel="noopener">halt of 31 August to 11 September 2026</a> held the guard open long enough to read it.',
      },
      {
        from: 'The two status endpoints stay up throughout, which is what makes <code>/status/gateway-status</code> the place to check whether the network is moving.</p>',
        to: 'The two status endpoints stay up throughout, which makes <code>/status/gateway-status</code> the place to check whether the network is moving. It is the wrong place to read where the ledger stopped. The head it reported for the whole halt, state version 557,840,622, is the last state the Gateway&rsquo;s own index took in; <a href="https://mainnet.radixdlt.com/stream/transactions" target="_blank" rel="noopener"><code>/stream/transactions</code></a> shows the ledger committed five more, ending at state version 557,840,627 (epoch 339,897, round 4) at 21:19:48 UTC on 31 August. <a href="/policy/verifiability" rel="noopener">Verifiability</a> lists this as a failure mode.</p>',
      },
      {
        from: '{"state_version": 557,840,622}</code>, the last state version the ledger reached:</p>',
        to: '{"state_version": 557,840,622}</code>, the head the status endpoint was reporting:</p>',
      },
      {
        from: '<em>What was true at state version 557,840,622</em> has an answer, it is the last one the ledger produced, and the same public Gateway will serve it &mdash; balances, resource holdings and transaction history included. A dApp fails during a halt because it asks the first question; a caller willing to name a ledger state gets the second.</p>',
        to: '<em>What was true at a named state version</em> has an answer: the same public Gateway serves balances, resource holdings and transaction history for any state the ledger committed. For this halt the last such state is 557,840,627, and a read pinned there on 12 September returns it, stamped 21:19:48 UTC on 31 August. A dApp fails during a halt because it asks the first question; a caller willing to name a ledger state gets the second.</p>\n<h3 id="after-the-restart">After the restart</h3>\n<p>Mainnet committed rounds again from 11:35 UTC on 11 September 2026, and the Eagle Ray protocol update enacted four minutes later (<a href="/contents/tech/releases/protocol-updates#eagle-ray-enactment" rel="noopener">enactment, read from the ledger</a>). Nobody switched the guard off. It stopped firing once the Gateway&rsquo;s index was back within the 720-second threshold of the ledger&rsquo;s tip: at 19:07 UTC on 12 September, unpinned calls to <code>/state/entity/details</code> and <code>/state/validators/list</code> both answered 200, and <code>/status/gateway-status</code> reported epoch 340,275.</p>',
      },
    ],
    message: 'Corrected the halt-boundary label on the page every pinned-read citation links to: 557,840,622 is the head /status/gateway-status reported, not "the last state version the ledger reached". /stream/transactions shows the last committed state is 557,840,627 (epoch 339,897 round 4, 21:19:48 UTC 31 Aug), and a read pinned there returns 200 (verified 12 Sep). Past-tensed the halt, and added an After the restart section: unpinned /state/entity/details and /state/validators/list answer 200 again at epoch 340,275 with no configuration change. The 5 and 6 September measurements are unchanged.',
  },
  {
    tagPath: 'contents/tech/core-protocols', slug: 'babylon-node', version: '1.4.0', changeType: 'minor', stamp: true,
    sentinel: 'id="halt-ended"',
    replacements: [
      {
        from: 'v1.4.0 Eagle Ray (released, not enacted)</td>',
        to: 'v1.4.0 Eagle Ray (enacted 11 September 2026)</td>',
      },
      {
        from: 'and mainnet has completed none since 31 August 2026, so an update whose purpose is to end that halt could never clear one.',
        to: 'and mainnet completed none between 31 August and 11 September 2026, so an update whose purpose was to end that halt could never have cleared one.',
      },
      {
        from: '<p>Mainnet has not committed a round since 31 August 2026 at 21:19:06.179&nbsp;UTC, at epoch 339,896 and state version 557,840,622, following',
        to: '<p>Mainnet committed no round from 21:19:48&nbsp;UTC on 31 August 2026, at epoch 339,897 and state version 557,840,627, until 11 September, following',
      },
      {
        from: 'Read at 07:07:53 UTC on 10 September the ledger had not moved: installation by operators and two thirds of stake back online both remain.</p>',
        to: 'Read at 07:07:53 UTC on 10 September the ledger had not moved, because two steps remained: operators had to install the release, and two thirds of stake had to come back online.</p>\n<p id="halt-ended">Both happened on 11 September. Rounds resumed at 11:35 UTC inside the moratorium epoch, and Eagle Ray enacted at the start of epoch 339,898 at 11:39 UTC, when user transactions were allowed again. The state version and timestamp of each step are on <a href="/contents/tech/releases/protocol-updates#eagle-ray-enactment" rel="noopener">Protocol Updates</a>.</p>',
      },
    ],
    message: 'Written on 10 September, the page still said mainnet "has not committed a round since" and listed Eagle Ray as released, not enacted. Eagle Ray enacted at the start of epoch 339,898 on 11 September. Past-tensed the halt, corrected its boundary to state version 557,840,627 at 21:19:48 UTC (557,840,622 is the Gateway status endpoint position, five states short, verified from /stream/transactions), updated the infobox protocol line, and added the two restart steps with a link to the ledger read on Protocol Updates.',
  },
  {
    tagPath: 'contents/tech/comparisons', slug: 'radix-vs-ethereum', version: '1.5.0', changeType: 'minor', stamp: true,
    sentinel: 'rejected with <code>InvalidInvokeAccess</code>',
    replacements: [
      {
        from: '); no round committed since 31 August 2026</td>',
        to: '); halted from 31 August to 11 September 2026</td>',
      },
      {
        from: '<h2 id="halt-2026">Where the comparison stands, 5 September 2026</h2>',
        to: '<h2 id="halt-2026">Where the comparison stands, September 2026</h2>',
      },
      {
        from: '<p>Mainnet has not committed a round since. Its node runners halted it at 21:19:06 UTC on 31 August to stop further use of the defect, and the public <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway</a> has returned the same head ever since: state version 557,840,622, epoch 339,896, round 102, read again at 03:03 UTC on 5 September, 101 hours 44 minutes later. The fix is proposed as the <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray protocol update</a>, and the live reading is kept on the <a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">operational status page</a>.</p>',
        to: '<p>Its node runners halted mainnet that evening to stop further use of the defect. The last state the ledger committed was version 557,840,627, at 21:19:48 UTC on 31 August, and nothing more committed for ten and a half days. The fix shipped as the <a href="/contents/tech/releases/protocol-updates#eagle-ray-enacted" rel="noopener">Eagle Ray protocol update</a>, which enacted at the start of epoch 339,898 at 11:39 UTC on 11 September 2026. It adds a check, before every method call, that the calling frame is allowed to invoke the object it names; the <a href="/contents/tech/core-protocols/radix-engine#eagle-ray-fix" rel="noopener">Radix Engine</a> page covers the change at source. After the restart a blueprint written to repeat the drain was published on mainnet, and its call was <a href="https://t.me/RadixDevelopers/66392" target="_blank" rel="noopener">rejected with <code>InvalidInvokeAccess</code></a>.</p>',
      },
    ],
    message: 'The Where the comparison stands section, dated 5 September, still said mainnet "has not committed a round since" and that the fix was proposed. Mainnet restarted on 11 September and Eagle Ray enacted at epoch 339,898. Rewrote the closing paragraph with the ledger boundary (557,840,627 at 21:19:48 UTC, not the Gateway status head 557,840,622), the enactment, what the fix checks (before_invoke in radixdlt-scrypto v1.4.0) and the rejected post-restart drain attempt; updated the scalability table row and undated the heading.',
  },
  {
    tagPath: 'contents/tech/core-protocols', slug: 'radix-engine', version: '4.11.0', changeType: 'minor', stamp: true,
    sentinel: 'id="eagle-ray-fix"',
    replacements: [
      {
        from: 'and by then mainnet had been halted by its node runners, at 21:19:06 UTC, to stop further use of it.</p>',
        to: 'and by then its node runners had halted mainnet to stop further use of it; the last state the ledger committed was version 557,840,627, at 21:19:48 UTC.</p>',
      },
      {
        from: 'and the same function on <code>main</code> is byte-identical to it. A fix was described as in development when the network was halted; none had been published at the time of writing.</p>',
        to: 'and the same function on <code>main</code> was byte-identical to it at the time.</p><p id="eagle-ray-fix">The fix left that function alone. <code>verify_boot_ref_value</code> is byte-identical in <a href="https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0/radix-engine/src/system/system_callback.rs#L1158" target="_blank" rel="noopener">Scrypto v1.4.0</a>, the Eagle Ray release of 7 September 2026, so a vault reference still passes the boot check. The change is in <a href="https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0/radix-engine/src/system/system_callback.rs" target="_blank" rel="noopener"><code>before_invoke</code></a>, which runs before every method call and now asks whether the calling frame is allowed to invoke the object it names. For a <code>Direct</code> method, the kind <code>recall</code> uses, the object must be visible to the frame for a direct call; for any other method it must be visible for a normal one. A call that fails returns <code>SystemError::InvalidInvokeAccess</code>, an error v1.3.1 does not have. The check is gated on a system-logic version flag, <code>should_check_method_receiver_access</code>. Eagle Ray enacted on mainnet at the start of epoch 339,898 on 11 September, and after the restart a blueprint written to repeat the drain was published there; its call was <a href="https://t.me/RadixDevelopers/66392" target="_blank" rel="noopener">rejected with that error</a>.</p>',
      },
    ],
    message: 'The page still said no fix "had been published at the time of writing". Scrypto v1.4.0 (Eagle Ray) was published 7 September and enacted on mainnet at epoch 339,898 on 11 September. Added what the fix is, read at source: verify_boot_ref_value is byte-identical at v1.4.0 (L1158), and the new check is in before_invoke, gated on should_check_method_receiver_access and returning SystemError::InvalidInvokeAccess, a variant absent from v1.3.1. Cited the rejected post-restart drain attempt (t.me/RadixDevelopers/66392). Corrected the halt time to the ledger boundary, state version 557,840,627 at 21:19:48 UTC.',
  },
  {
    tagPath: 'contents/tech/core-protocols', slug: 'scrypto-programming-language', version: '2.1.0', changeType: 'minor', stamp: true,
    sentinel: 'releases/tag/v1.4.0',
    replacements: [
      {
        from: '<td>Scrypto 1.3.1 (Rust 1.92.0+ support)</td>',
        to: '<td><a href="https://github.com/radixdlt/radixdlt-scrypto/releases/tag/v1.4.0" target="_blank" rel="noopener">Scrypto 1.4.0</a> (Eagle Ray), 7 September 2026; Rust 1.92.0</td>',
      },
      {
        from: 'ending the previous Rust 1.81.0 lockdown.</p>',
        to: 'ending the previous Rust 1.81.0 lockdown. Scrypto 1.4.0, the release that fixed the engine flaw behind the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">August 2026 asset drain</a>, keeps that toolchain: its <a href="https://github.com/radixdlt/radixdlt-scrypto/blob/v1.4.0/rust-toolchain.toml" target="_blank" rel="noopener"><code>rust-toolchain.toml</code></a> names channel 1.92.0, as 1.3.1&rsquo;s does. Radix&rsquo;s <a href="https://docs.radixdlt.com/docs/getting-rust-scrypto" target="_blank" rel="noopener">install guide</a> still told readers to install Rust 1.81.0 and radix-clis 1.3.0 when checked on 12 September 2026; <a href="/developers/getting-started/01-install-scrypto" rel="noopener">Getting Started with Scrypto</a> covers which version a fresh install gets.</p>',
      },
    ],
    message: 'Infobox still gave Scrypto 1.3.1 as the latest release. Scrypto 1.4.0 (Eagle Ray) was published 7 September 2026 (GitHub releases API). Updated the infobox and added to Modern Rust Support that 1.4.0 pins the same Rust 1.92.0 toolchain as 1.3.1 (rust-toolchain.toml at both tags), and that docs.radixdlt.com/docs/getting-rust-scrypto still documents Rust 1.81.0 and radix-clis 1.3.0.',
  },
  {
    tagPath: 'contents/tech/releases', slug: 'stokenet', version: '1.11.2', changeType: 'patch', stamp: false,
    sentinel: 'since superseded by <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0"',
    replacements: [
      {
        from: 'That version is the current official node release &ndash; <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.3.0.5" target="_blank" rel="noopener">Cuttlefish v1.3.0.5</a>, published 1 June 2026 &ndash; so on version alone the reset network is exactly where it should be.</p>',
        to: 'That version was then the current official node release &ndash; <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.3.0.5" target="_blank" rel="noopener">Cuttlefish v1.3.0.5</a>, published 1 June 2026 and since superseded by <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0" target="_blank" rel="noopener">Eagle Ray v1.4.0.0</a> on 10 September &ndash; so on version alone the reset network was where it should have been.</p>',
      },
    ],
    message: 'Past-tensed the 30 August description of Cuttlefish v1.3.0.5 as "the current official node release"; babylon-node v1.4.0.0 (Eagle Ray) superseded it on 10 September 2026. Rest of the page not re-verified, so last_verified_at is left unchanged.',
  },
];

for (const e of EDITS) {
  for (const r of e.replacements) {
    if (r.from.includes(NBSP) || r.to.includes(NBSP)) throw new Error(`${e.slug}: string carries U+00A0`);
    if (r.to.includes(EM_DASH)) throw new Error(`${e.slug}: replacement carries an em dash`);
  }
}

// Top-level blocks and infobox children both carry text.
const textNodes = (blocks) => blocks.flatMap((b) => [b, ...(Array.isArray(b.blocks) ? b.blocks : [])])
  .filter((n) => typeof n.text === 'string');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.tagPath}/${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.tagPath}/${e.slug} not found`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(JSON.stringify(e.sentinel).slice(1, -1))) {
      console.log(`  ${e.slug}: already applied, no write`);
      continue;
    }
    for (const r of e.replacements) {
      let hits = 0;
      for (const n of textNodes(blocks)) {
        const count = n.text.split(r.from).length - 1;
        if (!count) continue;
        n.text = n.text.split(r.from).join(r.to);
        hits += count;
      }
      if (hits !== 1) throw new Error(`${e.slug}: expected 1 match for "${r.from.slice(0, 60)}", found ${hits}`);
    }

    console.log(`  ${DRY ? '[dry] ' : ''}${e.tagPath}/${e.slug}  v${page.version} -> v${e.version}  (${e.replacements.length} replacements)`);
    if (DRY) continue;

    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      e.stamp
        ? 'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4'
        : 'UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4',
      [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, e.changeType, AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
