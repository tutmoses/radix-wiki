// Sweep 390 — the fix merges into main and babylon-node publishes a release candidate.
//
// PR #1076 was retargeted from `develop` to `main` at 15:24:57 UTC on 8 September 2026
// and merged by its own author three minutes later with no reviews; v1.4.0.0-RC1
// followed at 15:35:42 as a pre-release, with Docker images at 16:06-16:23. Three pages
// carried the pre-merge state ("open, unmerged and unreleased") and are corrected here.
// A fourth edit strips a literal ```html fence from /ecosystem/beaker's infobox, found
// by the ecosystem rotation audit and unique in the wiki.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const SENTINEL = 'v1.4.0.0-RC1';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const edits = [];

/** read → guard → mutate; each entry returns the new block array or null to skip. */
async function page(tagPath, slug, version, changeType, message, mutate) {
  if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [tagPath, slug]);
  if (!rows.length) throw new Error(`page not found: ${tagPath}/${slug}`);
  const p = rows[0];
  const blocks = JSON.parse(JSON.stringify(p.content));
  const out = mutate(blocks);
  if (!out) { console.log(`  skip  ${tagPath}/${slug} — already applied`); return; }
  console.log(`  ${DRY ? '[dry] ' : ''}${p.title}  v${p.version} -> v${version}`);
  if (process.argv.includes('--preview')) out.forEach((x, i) => console.log(`    [${i}] ${(x.text || '').slice(0, 160).replace(/\n/g, ' ')}`));
  edits.push({ id: p.id, title: p.title, blocks: out, version, changeType, message });
}

// ── 1. The halt page: a new dated section for the merge and the release candidate ──
const DRAIN = `<h2 id="day-nine-evening-the-release-candidate">Day nine, evening: the fix merges, and there is a build</h2>
<p>Read at <strong>19:06 UTC on 8 September 2026</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">the Gateway status endpoint</a> returns the same ledger for a forty-second consecutive reading: state version 557,840,622, epoch 339,896, round 102. That is <strong>189 hours and 47 minutes</strong> without a committed round. What changed in the four hours before it is that, for the first time since the network stopped, there is something an operator can install.</p>
<p>The move that made it possible was a change of destination. <a href="https://github.com/radixdlt/babylon-node/pull/1076" target="_blank" rel="noopener">Pull request #1076</a> had been opened against <code>develop</code>, the branch GitHub serves as babylon-node's default and whose tip has not moved since March 2025 — which is why the tagged build published that lunchtime and the branch carrying the fix read as diverged. At <strong>15:24:46 UTC</strong> its author force-pushed the branch, at <strong>15:24:57</strong> changed its base to <code>main</code>, the line the releases actually come from, and at <strong>15:28:11</strong> merged it there. The merged pull request is 15 commits, 79 files, 4,275 lines added and 247 removed. GitHub records <strong>no reviews and no comments</strong> on it: it was opened, retargeted and merged by the same person, <a href="https://github.com/0xOmarA" target="_blank" rel="noopener">the author of the Engine fix</a>, in nine and a half hours.</p>
<p>Seven minutes after the merge, at <strong>15:35:42 UTC</strong>, babylon-node published <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1" target="_blank" rel="noopener">Eagle Ray v1.4.0.0-RC1</a> from the merge commit <code>7400951e</code>, with seven build artifacts and a body containing the repository's licence text and nothing else. Container images followed: <code>v1.4.0.0-RC1-amd64</code> at 16:06:37, <code>-arm64</code> at 16:17:12 and the multi-architecture <a href="https://hub.docker.com/r/radixdlt/babylon-node/tags" target="_blank" rel="noopener"><code>radixdlt/babylon-node:v1.4.0.0-RC1</code></a> at 16:23:04 UTC. This is a release <em>candidate</em>, flagged as a pre-release, and the flag has a side effect worth knowing: <a href="https://api.github.com/repos/radixdlt/babylon-node/releases/latest" target="_blank" rel="noopener">the repository's "latest release"</a> still resolves to <code>v1.3.0.5-test.1</code>, the rebuild of the version that halted.</p>
<p>The schedule the branch named survives the merge unchanged. In <code>mainnet_protocol_config.rs</code> at the released commit, <code>EAGLE_RAY_ENACTMENT_EPOCH</code> is <strong>339,898</strong> with the trigger <code>EnactAtStartOfEpochUnconditionally</code>, and the user transaction moratorium runs from epoch 339,897 inclusive to 339,898 exclusive — one epoch of consensus without users, then <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray</a> enacts. Stokenet keeps its ordinary readiness signal of 80% of stake over ten epochs.</p>
<p>The merge also carries the repository's Rust toolchain forward, which is the loose end <a href="https://github.com/radixdlt/babylon-node/pull/1075" target="_blank" rel="noopener">#1075</a> had recorded that morning as unfixed. <code>main</code> had pinned CI to Rust <code>1.81.0</code> and had no <code>core-rust/rust-toolchain.toml</code> at all; the merge sets that pin to <code>1.92.0</code>, adds the toolchain file at the same channel, and moves the release-artifact workflow off <code>stable</code> onto the same version, alongside the source changes those compilers demanded.</p>
<p>Nobody has announced any of it. The <a href="https://t.me/RadixAccountabilityCouncil/1000" target="_blank" rel="noopener">Radix Accountability Council</a>'s most recent statement remains the one at 20:45 UTC on 7 September, which said the testing was unfinished and named no date, and in the three and a half hours after the release candidate appeared the main Radix chat discussed the price on <a href="/contents/resources/how-to-buy-xrd" rel="noopener">the exchanges that are still quoting XRD</a> and nothing else. A release candidate is also not a restart: what remains is a final build, operators installing it, and validators holding two thirds of stake back online to commit epoch 339,897.</p>`;

await page('contents/history', 'hyperlane-asset-drain-2026', '2.21.0', 'minor',
  'Day nine, evening: PR #1076 retargeted from develop to main and merged at 15:28:11 UTC with no reviews, and babylon-node published Eagle Ray v1.4.0.0-RC1 at 15:35:42 with Docker images at 16:23. Enactment epoch 339,898 and the single-epoch moratorium survive the merge unchanged; the pre-release flag leaves /releases/latest pointing at v1.3.0.5-test.1.',
  (b) => {
    if (b.some((x) => (x.text || '').includes(SENTINEL))) return null;
    b.splice(28, 0, { id: uid(), type: 'content', text: DRAIN });
    return b;
  });

// ── 2. Protocol updates: the node half is no longer pending ──
const PU_OLD_5 = '<p>A Scrypto release is not a protocol update reaching a network, and the second half is under way rather than done.';
const PU_NEW = `
<p>A Scrypto release is not a protocol update reaching a network, and the second half followed a day later. <a href="https://github.com/radixdlt/babylon-node/pull/1076" target="_blank" rel="noopener">Pull request #1076</a> against <a href="https://github.com/radixdlt/babylon-node" target="_blank" rel="noopener">babylon-node</a>, the implementation every validator runs, opened at 06:00:59 UTC on 8 September 2026 and pins the node's engine dependency to Eagle Ray v1.4.0. It was opened against <code>develop</code>, retargeted to <code>main</code> at <strong>15:24:57 UTC</strong> and merged there at <strong>15:28:11</strong> by its own author, with no reviews and no comments recorded: 15 commits, 79 files, +4,275/&minus;247. Seven minutes later babylon-node published <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1" target="_blank" rel="noopener">Eagle Ray v1.4.0.0-RC1</a>, its first release carrying a protocol change since v1.3.0 and the first build of the fix an operator can install; container images reached Docker Hub by 16:23 UTC. It is flagged a pre-release, so <a href="https://api.github.com/repos/radixdlt/babylon-node/releases/latest" target="_blank" rel="noopener">the repository's latest release</a> still resolves to <code>v1.3.0.5-test.1</code>. Mainnet remains at the ledger it stopped on, state version 557,840,622, epoch 339,896, read at 19:06 UTC on 8 September 2026.</p>
<p>That pull request is where Eagle Ray's enactment is written down. On mainnet the trigger is <code>EnactAtStartOfEpochUnconditionally</code> at <strong>epoch 339,898</strong>, two past the halt, which makes it the only entry in the mainnet configuration that enacts on an epoch number rather than on validator readiness. It arrives with a mechanism new to the node, a user transaction moratorium, set for the single epoch 339,897: consensus runs, and user transactions are refused in the mempool and in the pacemaker's vote alike. On Stokenet the trigger is the usual readiness signal, 80% of stake sustained for ten consecutive epochs. Both figures are unchanged between the open branch and the released commit. <a href="/contents/history/hyperlane-asset-drain-2026" target="_blank" rel="noopener">The halt page</a> follows the sequence day by day.</p>`;

await page('contents/tech/releases', 'protocol-updates', '1.6.0', 'minor',
  'Eagle Ray: babylon-node PR #1076 merged into main at 15:28:11 UTC on 8 September and v1.4.0.0-RC1 published at 15:35:42, so the node half is released rather than pending. Enactment epoch and moratorium unchanged from the branch reading; Dugong note corrected to reflect the merge.',
  (b) => {
    if ((b[10].text || '').includes(SENTINEL)) return null;
    const paras = b[10].text.split('</p>');
    if (!paras[4].trimStart().startsWith(PU_OLD_5)) throw new Error('protocol-updates para 5 no longer matches');
    // the two paragraphs on the node half are replaced by two rewritten ones; the
    // council's 7 September statement, which follows them, stays as it is
    paras.splice(4, 2, PU_NEW.replace(/<\/p>\s*$/, ''));
    b[10].text = paras.join('</p>');
    const d = b[9].text;
    const oldD = "<p>Pull request #1076 against babylon-node, opened on 8 September 2026, removes the placeholder line that had held Dugong's slot in the mainnet and Stokenet configurations and puts Eagle Ray there instead, so neither network now carries a trigger for Dugong.</p>";
    if (!d.includes(oldD)) throw new Error('protocol-updates Dugong sentence no longer matches');
    b[9].text = d.replace(oldD, '<p>Pull request #1076 against babylon-node, merged into <code>main</code> on 8 September 2026 and released as v1.4.0.0-RC1, removed the placeholder line that had held Dugong\'s slot in the mainnet and Stokenet configurations and put Eagle Ray there instead, so neither network now carries a trigger for Dugong.</p>');
    return b;
  });

// ── 3. Babylon Node: the status section was written before any of this ──
const BN5 = `<h2>Status during the September 2026 halt</h2>
<p>Mainnet has not committed a round since 31 August 2026 at 21:19:06.179&nbsp;UTC, at epoch 339,896 and state version 557,840,622, following <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">the Hyperlane asset drain</a>. For the first eight days of that halt this repository showed nothing that would end it: its newest release was still v1.3.0.5 of 1 June, and no branch or tag named a forthcoming protocol version. The fix was in <a href="https://github.com/radixdlt/radixdlt-scrypto/pull/2093" target="_blank" rel="noopener">pull request #2093</a> against radixdlt-scrypto, the engine repository this one embeds, and nothing there reaches the network until an engine release carrying it is pulled into a node release and that node release is published.</p>
<p>Both halves are now done. Scrypto v1.4.0 (<a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray</a>) was tagged on 7 September, and on 8 September this repository merged <a href="https://github.com/radixdlt/babylon-node/pull/1076" target="_blank" rel="noopener">pull request #1076</a> into <code>main</code> at 15:28:11&nbsp;UTC — pinning the engine dependency to it and adding the enactment trigger for epoch 339,898 and a user transaction moratorium for epoch 339,897 — and published <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1" target="_blank" rel="noopener">v1.4.0.0-RC1</a> seven minutes later, with container images by 16:23&nbsp;UTC. It is a release candidate flagged as a pre-release, which is why the repository's "latest release" still resolves to <code>v1.3.0.5-test.1</code>, a rebuild of the halted version tagged that same lunchtime. Read at 19:06&nbsp;UTC on 8 September the ledger had not moved, and a candidate build is not a restart: a final release, installation by operators, and two thirds of stake back online all remain.</p>
<p>Repository activity during an outage is easy to mistake for progress on the outage. Through 6 September it was continuous-integration housekeeping in two pull requests from the same author — <a href="https://github.com/radixdlt/babylon-node/pull/1074" target="_blank" rel="noopener">#1074</a>, "Test workflow", against <code>develop</code>, and <a href="https://github.com/radixdlt/babylon-node/pull/1075" target="_blank" rel="noopener">#1075</a>, removing unused Phylum and Postman CI jobs against <code>main</code> — and the second of those turned out to matter, because validating it found <code>main</code> unable to build at all.</p>`;

const BN4_OLD = 'A reader who opens the repository to judge whether the node is being worked on sees, by default, a branch that stopped eighteen months ago.</p>';
const BN4_NEW = `A reader who opens the repository to judge whether the node is being worked on sees, by default, a branch that stopped eighteen months ago.</p><p>The September 2026 halt was resolved on <code>main</code> and nowhere else. <a href="https://github.com/radixdlt/babylon-node/pull/1076" target="_blank" rel="noopener">Pull request #1076</a>, which carries the Eagle Ray engine pin and the restart schedule, was opened against <code>develop</code> and retargeted to <code>main</code> minutes before it merged on 8 September 2026; <code>main</code>'s tip is now <code>7400951e</code>, tagged <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1" target="_blank" rel="noopener">v1.4.0.0-RC1</a>, the first release since v1.3.0 to carry a protocol change. <code>develop</code>'s tip is unmoved, and the comparison now reads 48 commits on <code>main</code> that are not on <code>develop</code> against 223 the other way.</p>`;

await page('contents/tech/core-protocols', 'babylon-node', '1.1.0', 'minor',
  'Status section rewritten: PR #1076 merged into main on 8 September 2026 and v1.4.0.0-RC1 published, so both halves of the fix are released; branch topology updated to main tip 7400951e and 48/223 divergence.',
  (b) => {
    if ((b[5].text || '').includes(SENTINEL)) return null;
    if (!b[4].text.includes(BN4_OLD)) throw new Error('babylon-node block 4 tail no longer matches');
    b[4].text = b[4].text.replace(BN4_OLD, BN4_NEW);
    b[5].text = BN5;
    return b;
  });

// ── 4. Ecosystem rotation: a literal markdown fence rendering inside Beaker's infobox ──
await page('ecosystem', 'beaker', '2.2.2', 'patch',
  'Strip a literal ```html markdown fence that was rendering as visible text around the infobox table. Found by the ecosystem link/quality audit; the only page in the wiki carrying one.',
  (b) => {
    const t = b[0].blocks[0].text;
    if (!t.includes('```')) return null;
    b[0].blocks[0].text = t.replace(/^```html\s*\n/, '').replace(/\n```\s*$/, '');
    return b;
  });

// ── write ──
if (!edits.length) { console.log('nothing to do'); client.release(); await pool.end(); process.exit(0); }
if (!DRY) {
  const now = new Date().toISOString();
  await client.query('BEGIN');
  for (const e of edits) {
    const json = JSON.stringify(e.blocks);
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, e.version, now, e.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), e.id, json, e.title, e.version, e.changeType, AUTHOR_ID, e.message, now]);
  }
  await client.query('COMMIT');
  console.log(`wrote ${edits.length} pages`);
} else {
  console.log(`[dry] would write ${edits.length} pages`);
}
client.release();
await pool.end();
