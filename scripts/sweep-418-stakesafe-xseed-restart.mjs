// sweep-418: the two ecosystem pages the restart overtook by an hour and a half.
//
// /ecosystem/stakesafe v2.6.0 was written at 10:11 UTC on 11 September and
// /ecosystem/xseed v4.1.0 at 10:15 UTC. Mainnet certified its first round in ten
// days at 11:35:28.96 UTC and user transactions resumed at 11:39:25.129 UTC. Both
// pages are therefore present-tense about a network that is running, and neither
// matched run 408's four probe strings, which is why runs 416 and 417 missed them.
//
// StakeSafe's three dated tracker sections are a good chronicle and stay; what
// they lacked was an ending. XSEED's halt section said its figures "cannot be
// confirmed" because the Gateway refused state queries; it answers now, so the
// confirmation goes in.
//
// Ledger reads for this edit, all this run:
//   POST /stream/transactions kind_filter All -> 557,840,627 ep339897 r4
//     2026-08-31T21:19:48.939Z; 557,840,628 ep339897 r5 2026-09-11T11:35:28.96Z;
//     557,840,693 ep339898 r2 2026-09-11T11:39:25.129Z (round change), and
//     557,840,694 the first user transaction in the same round and second.
//   POST /state/validators/list at ep340227, 2026-09-12T15:08:20Z ->
//     XSEED STAKING stake vault 98,704,580.389930959500091846 XRD,
//     last_changed_at_state_version 557,940,249, rank 13 of 186 registered.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const NBSP = ' ';

const HOW_IT_RESOLVED = `<h2 id="sweep418-how-it-resolved">How it resolved (11 September 2026)</h2>
<p>The tracker above stops half an hour short of the thing it was tracking. Radix mainnet certified its first round in ten days at <strong>11:35:28.96&nbsp;UTC on 11 September 2026</strong> &ndash; state version 557,840,628, epoch 339,897 round 5 &ndash; thirty minutes after the reading above. Epoch 339,897 then ran to its end producing rounds and refusing user transactions, and at <strong>11:39:25.129&nbsp;UTC</strong> epoch 339,898 opened at round 2 with the <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray</a> fork enacted and the moratorium lifted together. Read from <a href="https://mainnet.radixdlt.com/stream/transactions" target="_blank" rel="noopener">the transaction stream</a>, the boundary is three entries: 557,840,627 at 21:19:48.939&nbsp;UTC on 31 August, 557,840,628 at 11:35:28.96&nbsp;UTC on 11 September, and sixty-five further round changes before the first user transaction at 557,840,694. The ledger produced no round for ten days, fourteen hours and sixteen minutes.</p>
<p>The reading this page took from the sequence held. Adoption did arrive as a step rather than a climb: it stood at 32.77% of the active set at 11:05&nbsp;UTC, and the fork enacted with <a href="/contents/history/hyperlane-asset-drain-2026#the-fix-and-the-restart" rel="noopener">80.85% of active-set stake on the release</a>, so the twelve largest validators booted together as Faraz had said they would and the chart never counted down to anything. The dashboard's value was in showing where the stake sat rather than in predicting the hour, and on that it was accurate throughout. The full sequence and its ledger record are on <a href="/contents/resources/radix-ecosystem-operational-status#sweep408-status-restored" rel="noopener">Radix Ecosystem Operational Status</a>.</p>`;

const EDITS = [
  {
    tagPath: 'ecosystem', slug: 'stakesafe', version: '2.7.0', changeType: 'minor',
    sentinel: 'sweep418-how-it-resolved',
    replacements: [
      {
        from: 'Radix mainnet has produced no rounds since <strong>21:19:06&nbsp;UTC on 31 August 2026</strong>, when validators holding more than two thirds of stake <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">broke liveness deliberately</a> after every Hyperlane-bridged asset on the network was drained.',
        to: 'Radix mainnet had produced no rounds since <strong>21:19:48.939&nbsp;UTC on 31 August 2026</strong>, when validators holding more than two thirds of stake <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">broke liveness deliberately</a> after every Hyperlane-bridged asset on the network was drained. It <a href="#sweep418-how-it-resolved" rel="noopener">restarted on 11 September</a>; the three sections that follow were written while it was down, and each is a dated reading.',
      },
      {
        from: 'The ledger is unchanged by any of it. Read at <strong>11:05:08&nbsp;UTC on 11 September</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">gateway-status</a> returns state version 557,840,622 at epoch 339,896, round 102: two hundred and fifty-three hours and forty-six minutes without a committed round, and the same interval the Gateway reports itself behind the ledger.',
        to: 'The ledger was unchanged by any of it. Read at <strong>11:05:08&nbsp;UTC on 11 September</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">gateway-status</a> returned state version 557,840,622 at epoch 339,896, round 102, and reported itself the same interval behind the ledger. That is the aggregator&rsquo;s position rather than the ledger&rsquo;s: the last state committed before the stop was 557,840,627, epoch 339,897 round 4, five states and forty-two seconds further on, and the status endpoint never showed the difference. Thirty minutes after this reading the network was running again.',
      },
    ],
    appendAfterBlock: 3,
    appendText: HOW_IT_RESOLVED,
    message: 'The three halt-tracker sections were written at 10:11 UTC on 11 September and mainnet restarted at 11:35:28.96 UTC, so the page tracked an outage it never recorded the end of. Past-tensed the two present-tense frames, corrected the halt boundary (557,840,627 at 21:19:48.939 UTC, not the Gateway status endpoint’s 557,840,622), and added a closing section giving the restart from /stream/transactions. The dated readings themselves are unchanged; the step-not-a-climb prediction they made is now confirmed at 80.85% enactment stake.',
  },
  {
    tagPath: 'ecosystem', slug: 'xseed', version: '4.2.0', changeType: 'minor',
    sentinel: 'stake is moving again',
    replacements: [
      {
        from: '<tr><td><strong>Total Stake</strong></td><td>~100.24M XRD (6 Aug 2026)</td></tr>\n<tr><td><strong>Rank by Stake</strong></td><td>13 of 188</td></tr>',
        to: '<tr><td><strong>Total Stake</strong></td><td>98.70M XRD (12 Sep 2026)</td></tr>\n<tr><td><strong>Rank by Stake</strong></td><td>13 of 186 registered</td></tr>',
      },
      {
        from: 'Radix mainnet has produced no rounds since <strong>21:19:06&nbsp;UTC on 31 August 2026</strong>, when validators holding more than two thirds of stake <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">broke liveness deliberately</a>, and it resumes only once more than 67% of active-set stake is online and running <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0" target="_blank" rel="noopener">babylon-node v1.4.0.0, &ldquo;Eagle Ray&rdquo;</a>.',
        to: 'Radix mainnet produced no rounds between <strong>21:19:48.939&nbsp;UTC on 31 August 2026</strong>, when validators holding more than two thirds of stake <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">broke liveness deliberately</a>, and 11:35:28.96&nbsp;UTC on 11 September, when enough of the set was back online running <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0" target="_blank" rel="noopener">babylon-node v1.4.0.0, &ldquo;Eagle Ray&rdquo;</a> for consensus to certify a round. The reading below was taken twenty-nine minutes before that.',
      },
      {
        from: 'Its stake reads <strong>98,684,205&nbsp;XRD</strong>, rank 13 of the hundred validators in the active set, which is 1.55 million XRD below the 100,236,442.14&nbsp;XRD this page read from the ledger on 6 August; that movement happened before the stop, because no stake has moved since. The figures above cannot be confirmed the way the rest of this page was, and the reason is worth stating: with the network halted the',
        to: 'Its stake read <strong>98,684,205&nbsp;XRD</strong>, rank 13 of the hundred validators in the active set, 1.55 million XRD below the 100,236,442.14&nbsp;XRD this page read from the ledger on 6 August; that movement happened before the stop, because no stake moved during it. Those figures could not be confirmed at the time the way the rest of this page was, and the reason is worth stating: with the network halted the',
      },
    ],
    appendAfterBlock: 3,
    appendText: `<h2 id="sweep418-confirmed-from-the-ledger">Confirmed from the ledger (12 September 2026)</h2>
<p>The dashboard reading above can now be checked against the thing it was standing in for. Read from <a href="https://mainnet.radixdlt.com/state/validators/list" target="_blank" rel="noopener"><code>/state/validators/list</code></a> at <strong>15:08&nbsp;UTC on 12 September 2026</strong>, epoch 340,227, XSEED STAKING is registered, accepts delegated stake, and holds <strong>98,704,580.39&nbsp;XRD</strong> in its stake vault &ndash; rank <strong>13 of the 186 registered validators</strong>, and 20,375&nbsp;XRD above the figure StakeSafe&rsquo;s dashboard showed during the halt. The vault&rsquo;s <code>last_changed_at_state_version</code> is 557,940,249, a state committed the same day, so stake is moving again.</p>
<p>The substitution held, in other words, and it is worth saying which way. A third party probing the nodes directly is evidence about a validator when the ledger cannot be asked; it is not better evidence than the ledger, and here it was 0.02% low. The rule this page states above survives unchanged: the consensus manager is what settles a validator&rsquo;s operational state, and everything else is a stand-in for it.</p>`,
    message: 'The halt section was written at 10:15 UTC on 11 September and mainnet restarted at 11:35:28.96 UTC, so it asserted an ongoing outage. Past-tensed it, corrected the boundary timestamp to 21:19:48.939 UTC (21:19:06 is the Gateway status endpoint’s position, five states short), and added the ledger confirmation the section said it could not have: /state/validators/list at epoch 340,227 puts the stake vault at 98,704,580.39 XRD, rank 13 of 186 registered, last changed today. Infobox stake and rank refreshed from the same read.',
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

for (const e of EDITS) {
  for (const r of e.replacements) {
    if (r.from.includes(NBSP)) throw new Error(`${e.slug}: find-string carries a real U+00A0`);
  }
}

try {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.tagPath}/${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.tagPath}/${e.slug} not found`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied — no write`);
      continue;
    }

    const texts = (b) => (b.type === 'infobox' ? b.blocks : [b]);
    for (const r of e.replacements) {
      let hits = 0;
      for (const b of blocks) for (const t of texts(b)) {
        if (typeof t.text !== 'string' || !t.text.includes(r.from)) continue;
        t.text = t.text.split(r.from).join(r.to);
        hits += 1;
      }
      if (hits !== 1) throw new Error(`${e.slug}: expected 1 match for "${r.from.slice(0, 48)}…", found ${hits}`);
    }

    if (e.appendText) blocks.splice(e.appendAfterBlock + 1, 0, { id: uid(), type: 'content', text: e.appendText });

    console.log(`  ${DRY ? '[dry] ' : ''}${e.tagPath}/${e.slug}  v${page.version} -> v${e.version}  (${blocks.length} blocks)`);
    if (DRY) continue;

    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
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
