// sweep 467 – /ecosystem/caper stated an exit rule the contract stopped
// implementing on 11 September 2026, in two places, and led on a word
// caper.network had removed from its own surfaces.
//
// (A) Correctness. The page said stake (vote) tokens are minted "one for each
//     ranked ballot cast, and 0.01 for every XRD traded", and drew the
//     conclusion that "a member who has only ever bought can therefore exit".
//     Caper's genesis redeploy of 11 September 2026 removed the trade-side
//     mint and the vote_rate field with it, so a cast ballot is the only
//     member-facing source of v and a buy-only holder aborts on
//     `Exit requires vote tokens`. Verified against caper HEAD 4b53957:
//     VOTE_MINT = 1 at contracts/logic/src/lib.rs:209, fused into vote_apply;
//     the assert at :2705. The same error had a second copy in the Summary
//     ("a non-transferable stake token that trading and voting both mint").
//     Source, read 21 September 2026 (HTTP 200):
//     caper.network/wiki/foundations/leaving-a-caper.
//     Bound: caper HEAD also carries 95f7010, which binds an exit's vote
//     tokens to the account it pays. That is NOT deployed and is not written
//     here.
// (B) Positioning. The lead sentence, which is what an answer engine
//     extracts, called Caper "a Web3 bourse and launchpad platform". The
//     launchpad register is gone from caper.network, which now describes
//     itself as "where a group of people becomes an economy" (read 21
//     September 2026 under a ChatGPT-User UA: 0 occurrences of "launchpad" on
//     the homepage). Rewritten per radix-studio/VOICE.md section 4.
//
// Dry run: node scripts/sweep-467-caper-exit-gate.mjs --dry-run

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'caper';
const SENTINEL = 'Voting is the only thing that mints a stake token';
const DRY = process.argv.includes('--dry-run');

const EDITS = [
  {
    what: 'lead sentence (launchpad register)',
    from: '<p><strong>Caper</strong> is a Web3 bourse and launchpad platform designed to accelerate the development of <a href="https://en.wikipedia.org/wiki/Decentralized_autonomous_organization">Decentralized Autonomous Organizations</a> (DAOs) from creation and funding through to governance, exit, and acquisition.</p>',
    to: '<p><strong>Caper</strong> is a platform on Radix for creating and running member-owned organizations, which it calls capers. Each caper is created with its own token, a market that trades that token, and a treasury its holders govern, and a member can leave at any time with a share of what the treasury holds. It covers the whole life of a <a href="https://en.wikipedia.org/wiki/Decentralized_autonomous_organization">Decentralized Autonomous Organization</a> (DAO): creation, fundraising, governance, exit and acquisition.</p>',
  },
  {
    what: 'Summary: stake-token mint rule',
    from: 'against a non-transferable stake token that trading and voting both mint.',
    to: 'against a non-transferable stake token that only voting mints.',
  },
  {
    what: 'Exit and Dissolution: mint rule and the conclusion drawn from it',
    from: 'Stake tokens are minted by taking part: one for each ranked ballot cast, and 0.01 for every XRD traded. A member who has only ever bought can therefore exit, and one who has also voted leaves with a larger claim on the treasury.',
    to: 'Voting is the only thing that mints a stake token: one for each ranked ballot cast. A member who has only ever bought holds none, and the call aborts on <code>Exit requires vote tokens</code> rather than paying out nothing, so leaving requires having voted at least once. Trading minted stake tokens as well until a redeploy on 11 September 2026 removed that source, so that a single transaction can no longer take a position and mint the record that prices its exit.',
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
    console.log('  already applied – no write');
    process.exit(0);
  }

  // Every inline anchor in this page is preceded and followed by U+00A0, the
  // bulk-generation trap in CLAUDE.md, so a find-string written with ordinary
  // spaces silently matches nothing. Match either space.
  const pattern = (s) =>
    new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[ \u00A0]'), 'g');

  const apply = (node) => {
    if (typeof node?.text !== 'string') return;
    for (const e of EDITS) {
      const re = pattern(e.from);
      if (!re.test(node.text)) continue;
      node.text = node.text.replace(pattern(e.from), () => e.to);
      e.hits = (e.hits || 0) + 1;
    }
  };
  for (const b of blocks) {
    apply(b);
    for (const n of b.blocks || []) apply(n);
  }

  for (const e of EDITS) {
    console.log(`  ${e.hits ? 'OK  ' : 'MISS'}  ${e.what}${e.hits ? ` (${e.hits})` : ''}`);
    if (!e.hits) throw new Error(`no match: ${e.what}`);
  }

  const version = '2.3.0';
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
       'Correct the exit gate and drop the launchpad lead. Caper’s redeploy of 11 September 2026 removed the trade-side mint of vote tokens, so a cast ballot is now the only member-facing source and a buy-only holder aborts on "Exit requires vote tokens"; the page stated the old rule in both the Summary and Exit and Dissolution, and drew the opposite conclusion. Source: caper.network/wiki/foundations/leaving-a-caper, read 21 September 2026. The lead is rewritten off caper.network’s own current description.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
