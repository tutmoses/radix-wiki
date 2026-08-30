// scripts/update-wir-2026-08-30-illustrate.mjs
//
// Re-presents /blog/week-in-review-2026-08-30: adds a headline stats row, two
// bespoke figures (the protocol replay and the DAO formation track), turns the
// six queued fee changes into a table, and splits the two longest prose blocks
// into sub-headed sections so no block runs more than two paragraphs.
//
// Prose is carried over verbatim from the published blocks – this changes the
// presentation, not the reporting.
//
//   node scripts/update-wir-2026-08-30-illustrate.mjs --dry-run
//   node scripts/update-wir-2026-08-30-illustrate.mjs
import pg from 'pg';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';

config();

const TAG_PATH = 'blog';
const SLUG = 'week-in-review-2026-08-30';
const SENTINEL = 'data-graphic="wir-replay"';
const VERSION = '2.0.0';
const DRY = process.argv.includes('--dry-run');

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fig = (name) => fs.readFileSync(resolve(REPO, `brand-assets/wir/${name}.block.html`), 'utf8').trim();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

/** Split a content block's HTML into its <h2> (if any) and its <p>…</p> runs. */
function parts(html) {
  const h2 = (html.match(/^<h2>.*?<\/h2>/) || [''])[0];
  const rest = html.slice(h2.length);
  return { h2, ps: (rest.match(/<p>[\s\S]*?<\/p>/g) || []) };
}
const blk = (text) => ({ id: uid(), type: 'content', text });

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const old = JSON.parse(JSON.stringify(page.content));
  // Test the block strings, never JSON.stringify(old): that escapes the sentinel's
  // quotes to \" and the match silently fails, dropping through to the assertions.
  if (old.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied – no write');
    process.exit(0);
  }

  // Index by role rather than position, so a sync-inserted nav block cannot shift us.
  const at = (pred) => old.findIndex(pred);
  const iProtocol = at((b) => b.text?.startsWith('<h2>Fifteen months'));
  const iDao = at((b) => b.text?.startsWith('<h2>The DAO moves'));
  const iFees = at((b) => b.text?.startsWith('<h2>Fees with a date'));
  if ([iProtocol, iDao, iFees].some((i) => i < 0)) throw new Error('expected sections not found');

  const protocol = parts(old[iProtocol].text);
  const dao = parts(old[iDao].text);
  const fees = parts(old[iFees].text);
  if (protocol.ps.length !== 6 || dao.ps.length !== 4 || fees.ps.length !== 3) {
    throw new Error(`unexpected paragraph counts: ${protocol.ps.length}/${dao.ps.length}/${fees.ps.length}`);
  }

  // 1. The week in four numbers, directly under the framing intro.
  const statsBlock = {
    id: uid(),
    type: 'stats',
    columns: 4,
    items: [
      { id: uid(), value: '1h 52m', label: 'to replay fifteen months of protocol history' },
      { id: uid(), value: '349', label: 'commits across the tracked repositories, from one contributor' },
      { id: uid(), value: '27', label: 'Radix DAO governance documents published, none in force' },
      { id: uid(), value: '6', label: 'validator fee rises queued on the ledger' },
    ],
  };

  // 2. The protocol section, sub-headed, with the replay figure on its payload.
  const protocolBlocks = [
    blk(protocol.h2 + protocol.ps[0] + protocol.ps[1]),
    blk('<h3>The package that was not there</h3>' + protocol.ps[2]),
    blk('<h3>The walk, stamped</h3>' + protocol.ps[3]),
    blk(fig('wir-2026-08-30-replay')),
    blk('<h3>A rule with one hand on it</h3>' + protocol.ps[4]),
    blk('<h3>Where an epoch ends</h3>' + protocol.ps[5]),
  ];

  // 3. The DAO section, with the formation track between the count and its meaning.
  const daoBlocks = [
    blk(dao.h2 + dao.ps[0] + dao.ps[1]),
    blk(dao.ps[2]),
    blk(fig('wir-2026-08-30-dao')),
    blk('<h3>What the marks cannot supply</h3>' + dao.ps[3]),
  ];

  // 4. Six queued fee changes read as a table, not as a sentence with six clauses.
  const feeTable =
    '<table><tbody>'
    + '<tr><th>Validator</th><th>Fee</th><th>Effective epoch</th><th>Stake exposed</th></tr>'
    + '<tr><th>StakeSafe Amsterdam</th><td>15% &rarr; 25%</td><td>339,608</td><td>76.04M XRD</td></tr>'
    + '<tr><th>StakeSafe Rotterdam</th><td>15% &rarr; 25%</td><td>339,609</td><td>81.16M XRD</td></tr>'
    + '<tr><th>StakeSafe Seed Node</th><td>15% &rarr; 100%</td><td>339,609</td><td>0.21M XRD</td></tr>'
    + '<tr><th>Leaf Node</th><td>1% &rarr; 100%</td><td>341,223</td><td>25.56M XRD</td></tr>'
    + '<tr><th>Apollo Pool</th><td>20% &rarr; 100%</td><td>342,116</td><td>12.01M XRD</td></tr>'
    + '<tr><th>ShardSpace.app, formerly Avaunt Staking</th><td>2% &rarr; 25%</td><td>342,482</td><td>142.17M XRD</td></tr>'
    + '</tbody></table>';
  const feeIntro =
    '<p>The third threshold is the one with an epoch number attached. '
    + '<a href="/ecosystem/stakesafe" rel="noopener">StakeSafe</a> has rises queued on three of its validators, and the node it bought from '
    + '<a href="/ecosystem/avaunt-staking" rel="noopener">Avaunt Staking</a> on 21 August, now trading as ShardSpace.app, carries a fourth. '
    + 'Six changes are pending across the register, and the first of them lands today.</p>';
  const feeBlocks = [
    blk(fees.h2 + feeIntro + feeTable),
    blk(fees.ps[1] + fees.ps[2]),
  ];

  const out = [];
  old.forEach((b, i) => {
    if (i === iProtocol) { out.push(...protocolBlocks); return; }
    if (i === iDao) { out.push(...daoBlocks); return; }
    if (i === iFees) { out.push(...feeBlocks); return; }
    out.push(b);
    // The framing intro is the block immediately before the protocol section's start.
    if (i === iProtocol - 1) out.push(statsBlock);
  });

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}`);
  console.log(`  v${page.version} -> v${VERSION}   blocks ${old.length} -> ${out.length}`);
  console.log(`  + stats row (4), + 2 figures, + 4 h3 subheads, fee prose -> 6-row table`);
  console.log(`  longest block: ${Math.max(...out.map((b) => (b.text || JSON.stringify(b)).length))} chars`
    + ` (was ${Math.max(...old.map((b) => (b.text || JSON.stringify(b)).length))})`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(out);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4',
      [json, VERSION, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, VERSION, 'major', AUTHOR_ID,
        'Illustrate the recap: a headline stats row, a bespoke figure for the protocol replay and one for the DAO formation track, the six queued fee changes as a table, and the two longest prose blocks split under sub-headings. Reporting unchanged; the walls of text are not.',
        now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
