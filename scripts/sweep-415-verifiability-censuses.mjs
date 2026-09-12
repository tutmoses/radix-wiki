/**
 * Sweep 415 — /policy/verifiability, the rotating `policy` audit.
 *
 * Run 402 recorded that this subtree has no staleness to speak of and that the
 * useful work here is factual currency in the censuses. This run re-measures all
 * four of them against the database on 12 September 2026, re-reads the Leaf Node
 * validator on chain now that mainnet has restarted, and gives the run-408
 * halt-boundary method rule a home: it was a general rule about Gateway endpoints
 * banked in state with no page to live on.
 *
 * Measured this run (scripts/_tmp-census*.mjs, since deleted):
 *   pages 376 total / 367 articles; banners 5 across 5 pages (2 stub, 3 promotional)
 *   [citation needed] tags: 2, both on this page; 888 revisions since 19 Aug
 *   Telegram message links 504 across 73 pages (hyperscale_rs 180, radix_dlt 131,
 *     RadixAccountabilityCouncil 85); hyperscale-rs 126, drain 14 + timeline 50
 *   articles under 1,500 prose chars 18, under 1,000 11; the two Stub-noticed
 *     pages are now the shortest (735) and third-shortest (769) on the wiki
 *   revisions in the 90 days to 12 Sep: 2,338, of which 2,317 (99.1%) from Hydrate
 *   Leaf Node validator_rdx1swz... at epoch 340,083 / sv 557,890,338 / 03:07:46Z:
 *     registered, 1% fee, 100% queued for epoch 341,223, 25,573,394.526 XRD,
 *     41st of 100, 0.5616% of 4,553,919,902 XRD in the active set; site still 503
 *   Halt boundary from /stream/transactions: last commit sv 557,840,627,
 *     epoch 339,897 round 4, 2026-08-31T21:19:48.939Z; next sv 557,840,628 at
 *     2026-09-11T11:35:28.960Z; first user tx after restart 11:39:25.129Z
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'policy';
const SLUG = 'verifiability';
const SENTINEL = 'A status endpoint is not the ledger';
const DRY = process.argv.includes('--dry-run');

// The stored HTML uses entities, never raw U+00A0 — asserted below before any write.
const NB = '&' + 'nbsp;';
const ND = '&' + 'ndash;';
const RS = '&' + 'rsquo;';

const edits = [
  // 1. The new failure mode, inserted ahead of "A failed fetch is not a dead source".
  {
    block: 'c55bd7d6-2388-4767-bfbf-f1c408cec000',
    find: '<h3>A failed fetch is not a dead source</h3>',
    replace:
      '<h3>A status endpoint is not the ledger</h3><p>Two Gateway endpoints answer what looks like the same question and do not. <code>/status/gateway-status</code> reports the tip the Gateway aggregator has ingested; <code>/stream/transactions</code> reports what the ledger committed. While both numbers are moving the difference is invisible, and while neither is moving it is a published falsehood. Through the twelve days mainnet was down this wiki gave the last round before the halt as state version 557,840,622, epoch 339,896, round 102, at 21:19:06.179' + NB + 'UTC on 31 August 2026, in some forty consecutive readings across two articles. The ledger had run on. Read from <a href="https://docs.radixdlt.com/docs/network-gateway" target="_blank" rel="noopener">/stream/transactions</a> at state version 557,840,615 ascending, three further user transactions commit in epoch 339,897 round 1 and a round update closes the ledger at <strong>state version 557,840,627</strong>, epoch 339,897, round 4, timestamped <strong>2026-08-31T21:19:48.939Z</strong> ' + ND + ' five state versions and forty-three seconds past the figure that was published. The next commit is state version 557,840,628 at <strong>11:35:28.960' + NB + 'UTC on 11 September 2026</strong>, and the first user transaction after the restart lands at 11:39:25.129' + NB + 'UTC. The general form: a status endpoint answers <em>what have I seen</em>, and a boundary question needs <em>what is there</em>.</p>' +
      '<h3>A failed fetch is not a dead source</h3>',
  },
  // 2. Leaf Node, re-read on chain after the restart.
  {
    block: 'c55bd7d6-2388-4767-bfbf-f1c408cec000',
    find:
      'Read live at <strong>epoch' + NB + '337,518</strong> (23 August 2026, 15:06' + NB + 'UTC), it is registered and sits <strong>45th of the 100 validators in the active set</strong> with <strong>25,720,462.22' + NB + 'XRD</strong> ' + ND + ' 0.5502% of the 4.67 billion XRD securing the network ' + ND + ' on a 1% fee, with a 100% fee queued for epoch' + NB + '341,223. Throughout all of it <a href="https://www.leafnode.info" target="_blank" rel="noopener">leafnode.info</a> answered <code>503</code>, as it still does: the site said nothing when the validator quit and nothing when it came back.',
    replace:
      'Read live at <strong>epoch' + NB + '340,083</strong> (12 September 2026, 03:08' + NB + 'UTC, the morning after mainnet restarted), it is registered and sits <strong>41st of the 100 validators in the active set</strong> with <strong>25,573,394.53' + NB + 'XRD</strong> ' + ND + ' 0.5616% of the 4.55 billion XRD securing the network ' + ND + ' on a 1% fee, with the 100% fee still queued for epoch' + NB + '341,223. It has climbed four places since 23 August while holding 147,067' + NB + 'XRD less, because the active set' + RS + 's total stake fell further than its own did: a rank is a fact about everyone else. Throughout all of it <a href="https://www.leafnode.info" target="_blank" rel="noopener">leafnode.info</a> answered <code>503</code>, as it did again on the re-read: the site said nothing when the validator quit, nothing when it came back, and nothing across a twelve-day network halt.',
  },
  // 3. The Telegram citation census.
  {
    block: '304a425e-2c1e-4959-8011-4fb9eefeb988',
    find:
      'Read on 4 September 2026, <strong>546</strong> links across <strong>71</strong> of the wiki' + RS + 's 380 pages point at one individual Telegram message ' + ND + ' 229 into the <a href="https://t.me/hyperscale_rs" target="_blank" rel="noopener">hyperscale-rs</a> channel, 130 into <a href="https://t.me/radix_dlt" target="_blank" rel="noopener">Radix DLT Official</a>, 61 into the <a href="https://t.me/RadixAccountabilityCouncil" target="_blank" rel="noopener">Accountability Council' + RS + 's</a>. They gather where no other record exists: 118 on <a href="/contents/tech/research/hyperscale-rs" class="link">hyperscale-rs</a> and 35 on <a href="/contents/history/hyperlane-asset-drain-2026" class="link">the Hyperlane asset drain</a>, which is the most-read article on the site.',
    replace:
      'Read on 12 September 2026, <strong>504</strong> links across <strong>73</strong> of the wiki' + RS + 's 376 pages point at one individual Telegram message ' + ND + ' 180 into the <a href="https://t.me/hyperscale_rs" target="_blank" rel="noopener">hyperscale-rs</a> channel, 131 into <a href="https://t.me/radix_dlt" target="_blank" rel="noopener">Radix DLT Official</a>, 85 into the <a href="https://t.me/RadixAccountabilityCouncil" target="_blank" rel="noopener">Accountability Council' + RS + 's</a>. They gather where no other record exists: 126 on <a href="/contents/tech/research/hyperscale-rs" class="link">hyperscale-rs</a>, and 64 across the two articles covering <a href="/contents/history/hyperlane-asset-drain-2026" class="link">the Hyperlane asset drain</a> ' + ND + ' the most-read page on the site and <a href="/contents/history/hyperlane-asset-drain-2026-timeline" class="link">the day-by-day timeline</a> split out of it on 11 September.',
  },
  // 4. The [citation needed] census.
  {
    block: '95573b65-0e79-467c-9fd4-f345249f0154',
    find:
      'Read on 19 August 2026, the tag appears on exactly one page ' + ND + ' this one, in the examples above. No article carries it.',
    replace:
      'Read on 19 August 2026, the tag appeared on exactly one page ' + ND + ' this one, in the examples above. Read again on 12 September, after 888 further revisions, that is still the count. No article carries it.',
  },
  // 5. The banner census.
  {
    block: '124719d8-e417-4923-973b-b35be71f3a14',
    find:
      'One query over the <code>pages</code> table on 19 August 2026 found <strong>five</strong> editor-placed banners across <strong>363</strong> pages:',
    replace:
      'One query over the <code>pages</code> table on 12 September 2026 found <strong>five</strong> editor-placed banners across <strong>376</strong> pages, the same five the query returned on 19 August:',
  },
  // 6. The thin-tail census, which has inverted its own conclusion.
  {
    block: '124719d8-e417-4923-973b-b35be71f3a14',
    find:
      'Nor is that because there is nothing to flag. Forty of the wiki' + RS + 's 361 articles hold under 1,500 characters of prose and twenty-five hold under 1,000 ' + ND + ' and the two carrying a <em>Stub</em> notice are neither the shortest nor among the shortest ten.',
    replace:
      'When this section was written there was plenty to flag: forty of the wiki' + RS + 's 361 articles held under 1,500 characters of prose, twenty-five held under 1,000, and the two carrying a <em>Stub</em> notice were neither the shortest nor among the shortest ten. Re-measured on 12 September, the thin tail has more than halved ' + ND + ' <strong>18</strong> of 367 articles under 1,500 characters and <strong>11</strong> under 1,000 ' + ND + ' and the two <em>Stub</em> pages are now the shortest on the wiki at 735 characters and the third-shortest at 769. The notices did not move. Everything around them was filled in until they were accurate.',
  },
  // 7. The revision-share census.
  {
    block: '124719d8-e417-4923-973b-b35be71f3a14',
    find:
      'Of 1,503 revisions written in the ninety days to 19 August 2026, 1,478 ' + ND + ' 98.3% ' + ND + ' came from the single account that runs the',
    replace:
      'Of 2,338 revisions written in the ninety days to 12 September 2026, 2,317 ' + ND + ' 99.1% ' + ND + ' came from the single account that runs the',
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  // The &nbsp; trap bites the script file as well as the stored HTML: assert the
  // find-strings carry zero raw U+00A0 before anything is compared against the DB.
  const scriptText = JSON.stringify(edits);
  if (/ /.test(scriptText)) throw new Error('script carries a raw U+00A0 — rewrite the find-string as an entity');

  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG]
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }
  if (/ /.test(JSON.stringify(blocks))) throw new Error('stored content carries a raw U+00A0 — re-check the find-strings');

  for (const [i, e] of edits.entries()) {
    const b = blocks.find((x) => x.id === e.block);
    if (!b) throw new Error(`edit ${i + 1}: block ${e.block} not found`);
    const hits = b.text.split(e.find).length - 1;
    if (hits !== 1) throw new Error(`edit ${i + 1}: find-string matched ${hits} times, expected 1`);
    b.text = b.text.replace(e.find, e.replace);
    console.log(`  edit ${i + 1}: ${e.block.slice(0, 8)} ok (${e.find.length} -> ${e.replace.length} chars)`);
  }

  const version = '1.9.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      json,
      version,
      now,
      page.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(),
        page.id,
        json,
        page.title,
        version,
        'minor',
        AUTHOR_ID,
        'Re-measured all four censuses against the database on 12 September 2026 and added a sixth failure mode. New section: a status endpoint is not the ledger — /status/gateway-status reports the Gateway aggregator’s ingested tip and /stream/transactions reports what the ledger committed, and through the halt this wiki published the first as the second, wrong by five state versions and forty-three seconds. Leaf Node re-read on chain at epoch 340,083: 41st of 100 on 25,573,394.53 XRD, up four places on less stake, site still 503. Telegram census 504 links across 73 of 376 pages. Thin-tail census inverted: 18 articles under 1,500 characters against forty in August, and the two Stub notices now sit on the shortest and third-shortest pages. Revision share 99.1%.',
        now,
      ]
    );
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
