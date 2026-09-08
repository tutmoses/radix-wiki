/**
 * Sweep 387 — the node half of the halt fix opens, and it names an enactment epoch.
 *
 * babylon-node PR #1076 ("0xOmarA/vault-access") opened at 06:00:59 UTC on
 * 8 September 2026, sixty-eight minutes before this run's Gateway reading. It is the
 * first published statement of WHEN and HOW mainnet restarts: an unconditional
 * enactment of Eagle Ray at epoch 339,898, and a new user-transaction-moratorium
 * subsystem that refuses user transactions for the single epoch 339,897 while
 * consensus itself runs. Read from the pull request's own diff, unmerged.
 *
 *   node scripts/sweep-387-node-restart-path.mjs --dry-run
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const NOW = new Date().toISOString();

const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const PR = 'https://github.com/radixdlt/babylon-node/pull/1076';

/* ---------------------------------------------------------------- page 1 */

const HALT = { tag: 'contents/history', slug: 'hyperlane-asset-drain-2026', version: '2.19.0' };

const DAY_NINE = `<h2 id="day-nine-the-node-half">Day nine: the node half opens, and it names an epoch</h2>
<p>Read at <strong>07:08 UTC on 8 September 2026</strong>, ${A('https://mainnet.radixdlt.com/status/gateway-status', 'the Gateway status endpoint')} returns the same ledger for a thirty-ninth consecutive reading: state version 557,840,622, epoch 339,896, round 102. That is <strong>177 hours and 49 minutes</strong> without a committed round.</p>
<p>An hour before that reading, the second half of the fix became public. ${A(PR, 'Pull request #1076')} against ${A('https://github.com/radixdlt/babylon-node', 'babylon-node')}, the software every validator runs, opened at <strong>06:00:59 UTC</strong> from a branch named <code>0xOmarA/vault-access</code>, by the ${A('https://github.com/0xOmarA', 'same author')} who wrote the Engine fix and tagged Scrypto v1.4.0 the evening before. It carries 12 commits written between 3 and 8 September, 82 files and 4,209 added lines, and it has no description. It is open and unmerged, GitHub reports its merge state as blocked, and babylon-node has still released nothing since <code>v1.3.0.5</code> of 1 June 2026, so no operator can install any of this yet. What it does contain is the first public answer to when the network restarts and what happens when it does.</p>
<p>The epoch is written into <code>mainnet_protocol_config.rs</code>. A new constant, <code>EAGLE_RAY_ENACTMENT_EPOCH</code>, is set to <strong>339,898</strong>, two past the 339,896 the ledger stopped on, and the trigger is <code>EnactAtStartOfEpochUnconditionally</code>: ${A('/contents/tech/releases/protocol-updates', 'the Eagle Ray protocol update')} takes effect at the start of that epoch, with no readiness signal and no stake threshold. Every other entry in the mainnet list works the other way. Anemone, Bottlenose and Cuttlefish each wait for validators holding 75% of stake to signal readiness over a window measured in days or weeks, and Cuttlefish's second part follows its first automatically. Eagle Ray is the only one that enacts on an epoch number alone.</p>
<p>Between the restart and that epoch, the network runs without users. The pull request adds a subsystem the node did not have, a <strong>user transaction moratorium</strong>: a range of epochs during which nodes refuse user transactions while ${A('/contents/tech/core-protocols/cerberus-consensus-protocol', 'consensus')} itself continues. Mainnet gets exactly one range, commented "Mainnet incident of 1 September 2026", running from epoch 339,897 inclusive to 339,898 exclusive. That is a single epoch, nominally five minutes, in which validators come back up, produce rounds and commit an epoch change, and nobody can transact.</p>
<p>Three places enforce it. The mempool rejects a submission before it validates or caches it, with a comment that the payload can then be retried once the moratorium ends, and it offers no transactions to a proposal. The consensus pacemaker withholds its vote from any vertex carrying user transactions, dispatching an explicit <code>NoVote</code> and logging the epoch the moratorium runs to, including for vertices that arrive from other nodes through sync. A new verifier in the consensus processor chain applies the same check to incoming proposals. A node that skipped the update could still propose a user transaction; the rest would decline to vote for it.</p>
<p>The most recent commit, at <strong>05:27 UTC on 8 September</strong>, corrects which epoch that check reads. Until it, the consensus-side check asked the node's own committed ledger for the current epoch; it now takes the epoch from the consensus event being voted on. The distinction matters only at an epoch boundary, which is exactly where this moratorium lives: a node still committed at 339,896 would otherwise have voted for a vertex proposed in 339,897.</p>
<p>A second correction in the same pull request has the same shape. Nodes ban peers that fall out of step around a protocol update and clear those bans when the update is close. That check read the epoch from the header of the node's latest proof, and an epoch-change proof's header names the epoch that ended rather than the one now running, so the reading was one too low. For an unconditional trigger the clearing window is a single epoch, the one before enactment, so the off-by-one would have missed it entirely.</p>
<p><a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a>, the public test network, gets the ordinary treatment instead: a readiness signal, 80% of stake, ten consecutive epochs. Both configurations lose the placeholder line that had held a slot for Dugong, the update that was next in the alphabet before this one, and Eagle Ray takes it.</p>
<p>None of this is an announcement. It is an open branch, and every figure in it can change before it merges; the reviews the ${A('https://t.me/RadixAccountabilityCouncil/1000', 'Radix Accountability Council')} said on 7 September were incomplete are the reviews this pull request is waiting on. What has to happen after it merges is unchanged: a node release, then operators installing it, then enough of them online to pass two thirds of stake.</p>`;

const UNRESOLVED_NEW = `The node half is public too, since 8 September: ${A(PR, 'pull request #1076')} against babylon-node, open and unmerged, sets the enactment epoch at 339,898 and refuses user transactions for the epoch before it. No node release has followed it, so no validator has a version to install, and neither the Foundation's blog nor the DAO's notice feed has said anything.`;

/* ---------------------------------------------------------------- page 2 */

const PROTO = { tag: 'contents/tech/releases', slug: 'protocol-updates', version: '1.5.0' };

const PROTO_NEW = `<p>A Scrypto release is not a protocol update reaching a network, and the second half is under way rather than done. ${A(PR, 'Pull request #1076')} against ${A('https://github.com/radixdlt/babylon-node', 'babylon-node')}, the implementation every validator runs, opened at 06:00:59 UTC on 8 September 2026, twelve hours after the Scrypto release, and pins the node's engine dependency to Eagle Ray v1.4.0. It is open, unmerged and unreleased: babylon-node's last release is still <code>v1.3.0.5</code> of 1 June 2026, so no operator has a version to install. Mainnet remains at the ledger it stopped on, state version 557,840,622, epoch 339,896, read at 07:08 UTC on 8 September 2026.</p>
<p>That pull request is where Eagle Ray's enactment is written down for the first time. On mainnet the trigger is <code>EnactAtStartOfEpochUnconditionally</code> at <strong>epoch 339,898</strong>, two past the halt, which makes it the only entry in the mainnet configuration that enacts on an epoch number rather than on validator readiness. It arrives with a mechanism new to the node, a user transaction moratorium, set for the single epoch 339,897: consensus runs, and user transactions are refused in the mempool and in the pacemaker's vote alike. On Stokenet the trigger is the usual readiness signal, 80% of stake sustained for ten consecutive epochs. Both are code in an open branch rather than a published schedule, and either can change before it merges. ${A('/contents/history/hyperlane-asset-drain-2026', 'The halt page')} follows the sequence day by day.</p>`;

const DUGONG_ADD = `<p>Pull request #1076 against babylon-node, opened on 8 September 2026, removes the placeholder line that had held Dugong's slot in the mainnet and Stokenet configurations and puts Eagle Ray there instead, so neither network now carries a trigger for Dugong.</p>`;

/* ---------------------------------------------------------------- helpers */

function spliceBetween(text, startAnchor, endAnchor, replacement) {
  const i = text.indexOf(startAnchor);
  if (i < 0) throw new Error(`start anchor not found: ${startAnchor.slice(0, 60)}`);
  const j = text.indexOf(endAnchor, i);
  if (j < 0) throw new Error(`end anchor not found: ${endAnchor.slice(0, 60)}`);
  return text.slice(0, i) + replacement + text.slice(j + endAnchor.length);
}

async function loadPage(client, { tag, slug }) {
  if (isLockedPage(tag, slug)) throw new Error(`${tag}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [tag, slug]);
  if (!rows.length) throw new Error(`page not found: ${tag}/${slug}`);
  return rows[0];
}

async function write(client, page, blocks, version, message) {
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, version, NOW, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID, message, NOW]);
  await client.query('COMMIT');
}

/* ---------------------------------------------------------------- run */

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  /* --- 1. the halt page ------------------------------------------------ */
  const halt = await loadPage(client, HALT);
  const haltBlocks = JSON.parse(JSON.stringify(halt.content));

  if (haltBlocks.some((b) => b.text?.includes('day-nine-the-node-half'))) {
    console.log('  halt page: already applied — no write');
  } else {
    const anchorIdx = haltBlocks.findIndex((b) => b.text?.includes('id="day-eight-night-not-enough"'));
    if (anchorIdx < 0) throw new Error('day-eight anchor block not found');
    haltBlocks.splice(anchorIdx + 1, 0, { id: uid(), type: 'content', text: DAY_NINE });

    const unresolved = haltBlocks.find((b) => b.text?.includes('<h2>What is unresolved</h2>'));
    if (!unresolved) throw new Error('unresolved block not found');
    unresolved.text = spliceBetween(
      unresolved.text,
      'Nothing has been published to the node repository',
      'no date has been offered.',
      UNRESOLVED_NEW);

    console.log(`  ${DRY ? '[dry] ' : ''}${halt.title}  v${halt.version} -> v${HALT.version}`);
    console.log(`        + day nine section (${DAY_NINE.length} chars) after block ${anchorIdx}`);
    console.log(`        ~ "What is unresolved" first paragraph rewritten`);
    if (!DRY) await write(client, halt, haltBlocks, HALT.version,
      'Day nine: babylon-node PR #1076 opens the node half of the fix, naming an unconditional Eagle Ray enactment at epoch 339,898 and a user transaction moratorium covering epoch 339,897, with the epoch-check and peer-ban corrections that go with it. Read from the pull request diff at 07:08 UTC on 8 September 2026; thirty-ninth identical Gateway reading.');
  }

  /* --- 2. the protocol-updates page ------------------------------------ */
  const proto = await loadPage(client, PROTO);
  const protoBlocks = JSON.parse(JSON.stringify(proto.content));

  if (protoBlocks.some((b) => b.text?.includes('EAGLE_RAY_ENACTMENT_EPOCH') || b.text?.includes('babylon-node/pull/1076'))) {
    console.log('  protocol-updates: already applied — no write');
  } else {
    const eagle = protoBlocks.find((b) => b.text?.includes('<h2>Eagle Ray (Released, September 2026)</h2>'));
    if (!eagle) throw new Error('eagle ray block not found');
    eagle.text = spliceBetween(
      eagle.text,
      '<p>A Scrypto release is not a protocol update reaching a network',
      'read at 19:03 UTC on 7 September 2026.</p>',
      PROTO_NEW);

    const dugong = protoBlocks.find((b) => b.text?.includes('<h2>Dugong (In Development)</h2>'));
    if (!dugong) throw new Error('dugong block not found');
    dugong.text = dugong.text + DUGONG_ADD;

    console.log(`  ${DRY ? '[dry] ' : ''}${proto.title}  v${proto.version} -> v${PROTO.version}`);
    console.log(`        ~ Eagle Ray closing paragraph replaced (${PROTO_NEW.length} chars)`);
    console.log(`        + Dugong paragraph (${DUGONG_ADD.length} chars)`);
    if (!DRY) await write(client, proto, protoBlocks, PROTO.version,
      'Eagle Ray now has an enactment written down: babylon-node PR #1076, opened 8 September 2026, sets an unconditional mainnet trigger at epoch 339,898 with a user transaction moratorium for 339,897, and a readiness-signalled Stokenet trigger at 80% of stake over ten epochs. Dugong loses its placeholder slot on both networks.');
  }
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
