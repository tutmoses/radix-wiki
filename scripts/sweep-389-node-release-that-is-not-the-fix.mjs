/**
 * Sweep 389 — babylon-node publishes a build on day nine, and it is the version that halted.
 *
 * At 12:28:06 UTC on 8 September 2026 the repository that has to ship the node half of
 * the halt fix published its first release since 1 June: v1.3.0.5-test.1, the first tag
 * in its history to use "-test" rather than "-rcN". The tag's commit is the merge of
 * PR #1075, a CI-and-Dockerfile change whose own summary records that main's Docker
 * build had been failing outright; its first parent is the commit tagged v1.3.0.5, the
 * version mainnet was running when it stopped. The fix (PR #1076) is not in it: that
 * targets develop, which GitHub compares as diverged from the tagged commit.
 *
 * Read from the GitHub API at 15:08 UTC on 8 September 2026 (forty-first identical
 * Gateway reading). Run 388 read the same repository at 11:03 UTC and found no release,
 * so the page's standing claim that none exists is now wrong.
 *
 *   node scripts/sweep-389-node-release-that-is-not-the-fix.mjs --dry-run
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const NOW = new Date().toISOString();

const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const REL = 'https://github.com/radixdlt/babylon-node/releases/tag/v1.3.0.5-test.1';
const PR75 = 'https://github.com/radixdlt/babylon-node/pull/1075';
const PR76 = 'https://github.com/radixdlt/babylon-node/pull/1076';

/* ---------------------------------------------------------------- page 1 */

const HALT = { tag: 'contents/history', slug: 'hyperlane-asset-drain-2026', version: '2.20.0' };

const DAY_NINE_PM = `<h2 id="day-nine-afternoon-the-build">Day nine, afternoon: the repository that has to publish the fix could not build</h2>
<p>Read at <strong>15:08 UTC on 8 September 2026</strong>, ${A('https://mainnet.radixdlt.com/status/gateway-status', 'the Gateway status endpoint')} returns the same ledger for a forty-first consecutive reading: state version 557,840,622, epoch 339,896, round 102. That is <strong>185 hours and 49 minutes</strong> without a committed round.</p>
<p>Two and a half hours before that reading, ${A('https://github.com/radixdlt/babylon-node', 'babylon-node')} published a release. It is the repository's first since <code>v1.3.0.5</code> of 1 June 2026, and it is not the fix.</p>
<p>The tag is <code>v1.3.0.5-test.1</code>, ${A(REL, 'published at 12:28:06 UTC')} by <code>github-actions[bot]</code> with no release notes and seven build artifacts uploaded between 12:28 and 12:42 UTC. Every previous pre-release in this repository is an <code>-rcN</code>; <code>v1.3.0.5</code> alone had six of them. This is the first tag in babylon-node's history to use <code>-test</code>, and because it is not flagged as a pre-release it is what ${A('https://api.github.com/repos/radixdlt/babylon-node/releases/latest', 'the repository now reports as its latest release')}.</p>
<p>What it contains is readable from the tag. The commit it points at, <code>f2543c1</code>, is the merge of ${A(PR75, 'pull request #1075')}, and that merge's first parent is <code>959b081</code>, the commit tagged <code>v1.3.0.5</code>: the version mainnet was running when it stopped. The merge changes five files. It adds a <code>.github/README.md</code>, deletes two workflow files, cuts jobs from <code>ci.yml</code>, and repins Debian package versions in the <code>Dockerfile</code>. Fifty-nine lines added, 274 removed, none of them node source. The build published on day nine of the halt is the halted software plus a change to how it is built.</p>
<p>The reason that change was needed is stated in the pull request itself, and it is the finding. Opened on 6 September and merged at <strong>11:21:10 UTC</strong> on 8 September, #1075 records that while its author was validating the branch's CI they found <code>main</code> broken: <code>apt-get</code> failing with exit 100 across three build stages, because several exact-pinned Debian bookworm package versions had been superseded and withdrawn from the mirror. The repairs are one line each. <code>curl</code> moves from <code>deb12u14</code> to <code>deb12u15</code> in two stages, <code>libssl-dev</code> from <code>deb12u1</code> to <code>deb12u2</code> in two more, and three <code>openjdk-17</code> packages get pinned alongside the JDK because the resolver was otherwise picking newer security builds the pinned JDK could not depend on. The same pull request removes a Snyk job that had, by its own account, failed on every pull request because the AWS secret it reads no longer exists.</p>
<p>Sixty-seven minutes after that merge, the repository produced a build. Nobody has said what the build is for, and the release carries no text to say it. What is on the record is the sequence: for some period ending on 8 September, the repository that has to publish the remedy for a halted network could not produce an artifact, and the first thing it produced once it could was the version that halted.</p>
<p>The pull request also closes with a breakage it does not fix. A note records that <code>main</code> additionally fails to compile under its pinned Rust <code>1.81.0</code> toolchain, on <code>iter_repeat_n</code> and <code>is_multiple_of</code>, and calls it separate and tracked elsewhere. Whether that still stands, and how a build was produced with it standing, is not established anywhere public.</p>
<p>The fix itself has not moved. ${A(PR76, 'Pull request #1076')}, the vault-access branch carrying the enactment epoch and the user transaction moratorium, is still open and unchanged since 06:01 UTC, though GitHub's merge state for it has gone from blocked to unstable since the morning reading. It targets <code>develop</code>, and <code>develop</code> is not the line this release came from: GitHub compares the tagged commit with the fix branch as <strong>diverged</strong>, with 235 commits on that branch the tag does not have and 32 the other way. Whatever the fix is merged into, it is not yet on the branch that produced today's build.</p>`;

const UNRESOLVED_OLD_START = 'The node half is public too, since 8 September:';
const UNRESOLVED_OLD_END = 'has said anything.';
const UNRESOLVED_NEW = `The node half is public too, since 8 September: ${A(PR76, 'pull request #1076')} against babylon-node, open and unmerged, sets the enactment epoch at 339,898 and refuses user transactions for the epoch before it. It targets <code>develop</code>, which is not the branch babylon-node releases from. The one release the repository has published since the halt, ${A(REL, '<code>v1.3.0.5-test.1</code>')} of 12:28 UTC on 8 September, was cut from <code>main</code> and carries a build-system change and no fix, so no validator yet has a version to install that does anything. Neither the Foundation's blog nor the DAO's notice feed has said anything.`;

/* ---------------------------------------------------------------- page 2 */

const VERIF = { tag: 'policy', slug: 'verifiability', version: '1.8.0' };

const RELEASE_MODE = `<h3>A release is not its contents</h3><p>A version tag, a &ldquo;latest release&rdquo; badge and a downloadable artifact are metadata about a build, not evidence of what is in it, and during an incident the difference is the whole story. On 8 September 2026, ${A('https://github.com/radixdlt/babylon-node', 'babylon-node')} published ${A(REL, '<code>v1.3.0.5-test.1</code>')}, its first release since June and the first tag in the repository&rsquo;s history to use <code>-test</code> rather than <code>-rcN</code>; not being flagged a pre-release, it became what GitHub returns as the latest. The commit behind the tag is the merge of ${A(PR75, 'a CI and Dockerfile change')}, and that merge&rsquo;s first parent is the commit tagged <code>v1.3.0.5</code> &ndash; the version ${A('/contents/history/hyperlane-asset-drain-2026', 'mainnet was running when it halted')}. The ${A('https://github.com/radixdlt/babylon-node/pull/1076', 'fix')} was on a different branch, which GitHub compares as diverged from the tag. Resolve the tag to its commit, read the commit&rsquo;s parents and its diff, and check which branch it sits on. A release page answers when something was built and by what; it does not answer what was built.</p>`;

/* ---------------------------------------------------------------- page 3 */

const NOTAB = { tag: 'policy', slug: 'notability', version: '1.2.2' };
const NOTAB_OLD = '111 of the 147 ';
const NOTAB_NEW = '113 of the 150 ';

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

async function write(client, page, blocks, version, changeType, message) {
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, version, NOW, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, changeType, AUTHOR_ID, message, NOW]);
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

  if (haltBlocks.some((b) => b.text?.includes('day-nine-afternoon-the-build'))) {
    console.log('  halt page: already applied — no write');
  } else {
    const anchorIdx = haltBlocks.findIndex((b) => b.text?.includes('id="day-nine-the-node-half"'));
    if (anchorIdx < 0) throw new Error('day-nine anchor block not found');
    haltBlocks.splice(anchorIdx + 1, 0, { id: uid(), type: 'content', text: DAY_NINE_PM });

    const unresolved = haltBlocks.find((b) => b.text?.includes('<h2>What is unresolved</h2>'));
    if (!unresolved) throw new Error('unresolved block not found');
    unresolved.text = spliceBetween(unresolved.text, UNRESOLVED_OLD_START, UNRESOLVED_OLD_END, UNRESOLVED_NEW);

    console.log(`  ${DRY ? '[dry] ' : ''}${halt.title}  v${halt.version} -> v${HALT.version}`);
    console.log(`        + day nine afternoon section (${DAY_NINE_PM.length} chars) after block ${anchorIdx}`);
    console.log(`        ~ "What is unresolved" node-release sentence rewritten`);
    if (!DRY) await write(client, halt, haltBlocks, HALT.version, 'minor',
      'Day nine, afternoon: babylon-node publishes v1.3.0.5-test.1 at 12:28 UTC, its first release since 1 June and the first -test tag in its history. The tag resolves to the merge of PR #1075, whose first parent is the v1.3.0.5 commit mainnet halted on, and whose summary records that main could not build at all (apt exit 100 across three stages on withdrawn Debian pins). The fix, PR #1076, targets develop and is diverged from the tagged commit. Read from the GitHub API at 15:08 UTC on 8 September 2026; forty-first identical Gateway reading, 185h49m.');
  }

  /* --- 2. the verifiability policy ------------------------------------- */
  const verif = await loadPage(client, VERIF);
  const verifBlocks = JSON.parse(JSON.stringify(verif.content));

  if (verifBlocks.some((b) => b.text?.includes('A release is not its contents'))) {
    console.log('  verifiability: already applied — no write');
  } else {
    const checking = verifBlocks.find((b) => b.text?.includes('<h2>Checking a Radix claim</h2>'));
    if (!checking) throw new Error('checking block not found');
    const marker = '<h3>A failed fetch is not a dead source</h3>';
    if (!checking.text.includes(marker)) throw new Error('failed-fetch marker not found');
    checking.text = checking.text.replace(marker, RELEASE_MODE + marker)
      .replace('Four failure modes recur often enough to be worth naming',
               'Five failure modes recur often enough to be worth naming');

    console.log(`  ${DRY ? '[dry] ' : ''}${verif.title}  v${verif.version} -> v${VERIF.version}`);
    console.log(`        + "A release is not its contents" (${RELEASE_MODE.length} chars), four -> five`);
    if (!DRY) await write(client, verif, verifBlocks, VERIF.version, 'minor',
      'Adds a fifth named failure mode, "A release is not its contents", worked from babylon-node v1.3.0.5-test.1 of 8 September 2026: the tag resolved to a CI-and-Dockerfile merge whose first parent is the halted version, while the fix sat on a diverged branch. Resolve a tag to its commit rather than reading a release page.');
  }

  /* --- 3. the notability count ----------------------------------------- */
  const notab = await loadPage(client, NOTAB);
  const notabBlocks = JSON.parse(JSON.stringify(notab.content));

  if (notabBlocks.some((b) => b.text?.includes(NOTAB_NEW))) {
    console.log('  notability: already applied — no write');
  } else {
    const target = notabBlocks.find((b) => b.text?.includes(NOTAB_OLD));
    if (!target) throw new Error(`notability anchor not found: ${NOTAB_OLD}`);
    target.text = target.text.replace(NOTAB_OLD, NOTAB_NEW);

    console.log(`  ${DRY ? '[dry] ' : ''}${notab.title}  v${notab.version} -> v${NOTAB.version}`);
    console.log(`        ~ bulk-import census "${NOTAB_OLD.trim()}" -> "${NOTAB_NEW.trim()}"`);
    if (!DRY) await write(client, notab, notabBlocks, NOTAB.version, 'patch',
      'Bulk-import census re-counted against the database on 8 September 2026: 113 of the 150 Ecosystem articles were created on 6 February 2026, not 111 of 147. The hub article at the empty slug is excluded, having been written on 5 September 2026.');
  }
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
