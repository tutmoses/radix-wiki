// Run 399 (contents/resources rotation). babylon-node v1.4.0.0 "Eagle Ray" was published
// as a FINAL release at 03:59:09 UTC on 10 September 2026, from the release/eagle-ray
// branch against the same tag commit the 8 September candidate carried. It is not flagged
// prerelease, so GitHub's /releases/latest and the ghproxy.radixdlt.com mirror the
// babylonnode CLI reads both return it - read at 07:06 UTC on 10 September. That closes
// the run-391 finding: for two days the recommended install path resolved to
// v1.3.0.5-test.1, a test tag cut before the fix. Correct the page that told operators so.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'developers/infrastructure';
const SLUG = '01-running-a-node';
const SENTINEL = '03:59:09 UTC on 10 September';
const DRY = process.argv.includes('--dry-run');

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
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const halt = blocks.find((b) => b.text?.includes('Operating Through a Halted Network'));
  if (!halt) throw new Error('halt section not found');
  const OLD_START = '<h3>There is a patched release, and the CLI will not install it</h3>';
  const OLD_END = '<h3>No epochs means no emissions</h3>';
  const i = halt.text.indexOf(OLD_START);
  const j = halt.text.indexOf(OLD_END);
  if (i < 0 || j < 0 || j < i) throw new Error('release subsection boundaries not found');

  const REPLACEMENT = `<h3>The patched release, and what the CLI installs</h3>
<p>The releases page is the cheapest signal an operator has for whether step two has produced anything, and it has now produced twice. <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1" target="_blank" rel="noopener">Eagle Ray <code>v1.4.0.0-RC1</code></a> was published at 15:35:42 UTC on 8 September from merge commit <code>7400951e</code>, with Docker images pushed to <a href="https://hub.docker.com/r/radixdlt/babylon-node/tags" target="_blank" rel="noopener">the official repository</a> between 16:06 and 16:23 UTC. The final release, <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0" target="_blank" rel="noopener"><code>v1.4.0.0</code></a>, followed at <strong>03:59:09 UTC on 10 September 2026</strong>, cut from the <code>release/eagle-ray</code> branch against a tag created at 15:28:10 UTC on 8 September, which is the same commit the candidate carried; its Docker images were pushed between 04:31 and 04:50 UTC. Neither release carries notes. Both bodies are the Radix licence boilerplate and nothing else: no changelog, no upgrade steps, no restart epoch.</p>
<p><strong>The candidate was flagged a pre-release, and that flag had a consequence for the recommended install path.</strong> GitHub reports as <code>latest</code> the newest release that is neither a draft nor a pre-release. Three hours before Eagle Ray RC1, at 12:28:06 UTC on 8 September, the repository published <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.3.0.5-test.1" target="_blank" rel="noopener"><code>v1.3.0.5-test.1</code></a>, an empty-bodied tag cut by <code>github-actions[bot]</code> and not flagged pre-release, so that was the release GitHub called latest. Asked at 23:06 UTC on 8 September and again at 03:04 UTC on 9 September, <code>ghproxy.radixdlt.com/radixdlt/babylon-node</code> returned that <code>tag_name</code> rather than the candidate's. For those two days the CLI-guided path above resolved to a test build cut before the fix, Docker images existed for that tag as well, and the install therefore succeeded and left the operator on a node that is not the one the restart depends on.</p>
<p><strong>The final release closes that gap.</strong> <code>v1.4.0.0</code> carries no pre-release flag, so it is what GitHub now calls latest, and read at 07:06 UTC on 10 September <code>ghproxy.radixdlt.com/radixdlt/babylon-node</code> returns <code>v1.4.0.0</code>. From that point the CLI-guided path installs the patched node with no override needed. Three habits the gap taught are worth keeping anyway:</p>
<ul>
<li><strong>Pin the tag.</strong> <code>RADIXDLT_APP_VERSION_OVERRIDE=v1.4.0.0</code> makes the CLI use that exact release without consulting the proxy at all.</li>
<li><strong>Name it yourself.</strong> The Docker and systemd paths take the tag from your own compose file or unit, so neither was ever affected.</li>
<li><strong>Check what you got.</strong> After any CLI install or update, read back the image tag actually running before assuming it is the patched one.</li>
</ul>
<p>The <a href="/contents/tech/core-concepts/radix-governance" rel="noopener">Radix Accountability Council</a> asked operators at 18:43 UTC on 9 September <a href="https://t.me/RadixAccountabilityCouncil/1012" target="_blank" rel="noopener">not to run the release candidates</a> on their own nodes, and to wait for official final versions and instructions on when to deploy. <code>v1.4.0.0</code> is that final version. The deployment instructions and the restart date are not published yet.</p>
<p>None of this has moved the ledger. <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">gateway-status</a> at 07:07:53 UTC on 10 September still returns state version 557,840,622 at epoch 339,896, round 102, unchanged for 225 hours and 48 minutes, and three hours after the final release an operator could install.</p>
`;

  halt.text = halt.text.slice(0, i) + REPLACEMENT + halt.text.slice(j);

  const version = '2.5.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  section replaced: ${j - i} chars -> ${REPLACEMENT.length} chars`);
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
       'babylon-node v1.4.0.0 shipped as a final release at 03:59:09 UTC on 10 September from release/eagle-ray, against the same tag commit as the 8 September candidate, with Docker images 04:31-04:50 UTC. It carries no pre-release flag, so GitHub /releases/latest and ghproxy.radixdlt.com both return it (read 07:06 UTC). The page said the CLI would not install the patched release; that held for two days and no longer does.',
       now]);
    await client.query('COMMIT');
    console.log('  committed');
  }
} finally {
  client.release();
  await pool.end();
}
