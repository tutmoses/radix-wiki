// sweep-326-tahuna-oter-resolution-conflict.mjs
//
// /ecosystem/tahuna described the dispute path of the oracle it depends on from
// Tahuna's own resolution page alone. Read against OTER's published protocol
// specification (rev. 2026-07, oter.io datasheet, re-read 29 Aug 2026) the two
// documents disagree on three things, and one of them is the trust model:
//
//   1. Winning threshold. Tahuna: "the outcome with the higher stake-weighted
//      total wins". OTER: 70% supermajority of REVEALED voting power, and the
//      power itself is sqrt(stake), not stake.
//   2. Deadlock. Tahuna: "after five failed attempts on the same question,
//      resolution can be lifted to an admin call". OTER: three tries, then a
//      time-boxed close as invalid - "admin can expedite, never decide", and
//      again under Governance: "Admin never decides".
//   3. Juror pay (already recorded on the page, re-confirmed live this run).
//
// Also missing from the page: the jury is drawn by OTER's own BLS beacon and
// seats ~97% of revealed votes, so "a weighted jury of staked participants" is
// not the whole mechanism, and the "single round" sits inside a documented
// 48-hour cycle (24 h sealed commit / 12 h reveal / 12 h re-propose).
//
// Neither project is on mainnet, so nothing here is settled on-ledger. The
// wiki's job is to attribute each claim to the document that makes it and
// record the conflict, as the page already does for juror pay.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'tahuna';
const SENTINEL = 'Where the two specifications disagree';
const DRY = process.argv.includes('--dry-run');

const RESOLUTION_HTML = `<h2>Resolution</h2><p>Tāhuna describes itself as the markets layer only; confirming an outcome is <a href="https://tahuna.org/resolution" target="_blank" rel="noopener">delegated to OTER</a>, a separate project it depends on. When a market reaches its deadline a proposer submits a candidate outcome and posts a proposer bond, opening a <strong>four-hour challenge window</strong> – the default in <a href="https://oter.io" target="_blank" rel="noopener">OTER's own protocol specification</a>, which marks it configurable per question. If nobody disputes it, the outcome finalizes, the market settles and the bond is returned – the path the project expects most markets with clear evidence to take, with no vote and no jury.</p><p>A challenger who posts a counter-bond escalates the question to <a href="/ecosystem/oter" rel="noopener">OTER</a>, where staked participants cast timelock-encrypted ballots. No ballot can be decrypted by anyone – including the juror who cast it – until the round closes and <a href="https://drand.love" target="_blank" rel="noopener">drand</a> releases the decryption key, at which point every ballot is decrypted at once. Tāhuna contrasts this with UMA's commit–reveal cycle, which it says takes an extra round, and frames its own relationship to OTER as mirroring Polymarket's to UMA. The market creator posts a resolver reward when escalating, so jurors are paid by the market they are resolving.</p><p>Two details of that vote are documented by OTER rather than by Tāhuna, and neither is visible from the markets side. The jury is not simply whoever staked: seats are drawn from OTER's own BLS randomness beacon after ballots lock, seating roughly <a href="https://oter.io" target="_blank" rel="noopener">97 of every 100 revealed votes</a>, so no stake buys a guaranteed seat. And voting power grows with the <strong>square root</strong> of stake rather than linearly with it, which the oracle publishes as cutting the top holder's share of voting weight from 24.1% to 3.6%.</p><h3>${SENTINEL}</h3><p>Both projects are pre-launch and both descriptions are their own documentation, so nothing below has been observed on-ledger. Where the two disagree about the same mechanism, this page records the disagreement rather than choosing between them.</p><table><tbody><tr><th></th><th><a href="https://tahuna.org/resolution" target="_blank" rel="noopener">Tāhuna, "How resolution works"</a></th><th><a href="https://oter.io" target="_blank" rel="noopener">OTER, protocol specification rev. 2026-07</a></th></tr><tr><th>Winning threshold</th><td>"the outcome with the higher stake-weighted total wins"</td><td>70% supermajority of revealed voting power, weighted by √stake; a round that misses it refunds bonds and re-enters the next cycle</td></tr><tr><th>Deadlock</th><td>"after five failed attempts on the same question, resolution can be lifted to an admin call"</td><td>three tries, then a time-boxed close as invalid – "admin can expedite, never decide", and under Governance, "Admin never decides"</td></tr><tr><th>Juror pay</th><td>jurors "earn OTER tokens for participating and resolving correctly"</td><td>voter rewards and the 15% share of the slashed bond are "paid in rUSDC stablecoins rather than a platform token"</td></tr><tr><th>Cycle length</th><td>"dispute resolution finishes in a single round"</td><td>a single voting round inside a 48-hour cycle – 24 h sealed commit, 12 h reveal, 12 h to re-propose and dispute</td></tr></tbody></table><p>The deadlock row is the one that matters beyond wording. Tāhuna's page tells a trader that an ambiguous market ends in an administrator's decision; OTER's specification says an administrator can hurry a stuck question along but can never decide one, and that a question which cannot converge is closed as invalid instead. A market settling by admin call and a market voiding are different outcomes for whoever holds the position, and the two published documents do not agree on which one happens.</p>`;

const STATUS_FIND = 'As of July 2026 Tāhuna is <strong>pre-launch</strong>.';
const STATUS_REPLACE = 'As of 29 August 2026 Tāhuna is <strong>pre-launch</strong>.';
const GITHUB_FIND = 'is registered but publishes no public repositories yet, so the contracts are not open to inspection at the time of writing.';
const GITHUB_REPLACE = 'is registered but still publishes no public repositories – re-checked through the GitHub API on 29 August 2026, one month before the targeted testnet quarter closes – so the contracts are not open to inspection.';

const INFOBOX_FIND = '<tr><th>Resolution</th><td><a href="/ecosystem/oter" rel="noopener">OTER</a> – optimistic proposer, weighted jury on dispute</td></tr>';
const INFOBOX_REPLACE = '<tr><th>Resolution</th><td><a href="/ecosystem/oter" rel="noopener">OTER</a> – optimistic proposer, beacon-drawn √stake jury on dispute</td></tr>';

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

  const res = blocks.find((b) => b.type === 'content' && b.text?.startsWith('<h2>Resolution</h2>'));
  if (!res) throw new Error('Resolution block not found');
  res.text = RESOLUTION_HTML;

  const status = blocks.find((b) => b.text?.includes(STATUS_FIND));
  if (!status) throw new Error('Status find-string did not match');
  if (!status.text.includes(GITHUB_FIND)) throw new Error('GitHub find-string did not match');
  status.text = status.text.replace(STATUS_FIND, STATUS_REPLACE).replace(GITHUB_FIND, GITHUB_REPLACE);

  const infobox = blocks.find((b) => b.type === 'infobox');
  const nested = infobox?.blocks?.find((n) => n.text?.includes(INFOBOX_FIND));
  if (!nested) throw new Error('infobox Resolution row not found');
  nested.text = nested.text.replace(INFOBOX_FIND, INFOBOX_REPLACE);

  const version = '1.1.0';
  const before = JSON.stringify(page.content).length;
  const json = JSON.stringify(blocks);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  ${before} -> ${json.length} B`);

  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Rewrite the Resolution section against OTER’s own protocol specification (rev. 2026-07), not Tahuna’s summary of it. The page said a disputed market is won by "the greater stake-weighted total"; OTER requires a 70% supermajority of revealed voting power weighted by the square root of stake, and seats the jury from its BLS beacon at ~97% of revealed votes. Added a table of the four points where the two projects’ published documents disagree about the same mechanism, the sharpest being deadlock: Tahuna says five failed attempts lift resolution to an admin call, OTER says three tries then a time-boxed close as invalid and that an admin "can expedite, never decide". Both pre-launch, nothing observed on-ledger. Status re-verified 29 Aug 2026: timeline unchanged (Q3 testnet, Q4 mainnet), Tahuna-Labs still zero public repositories via the GitHub API.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
