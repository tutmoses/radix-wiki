// Run 391 (developers rotation). The halt fix shipped as v1.4.0.0-RC1 at 15:35:42 UTC
// on 8 September, but it is flagged prerelease, while a test tag published three hours
// earlier is not - so GitHub's "latest", and the ghproxy mirror the babylonnode CLI
// reads, both return v1.3.0.5-test.1. The page's "Nothing to deploy yet" subsection
// said the newest release was still v1.3.0.5, checked on 1 September; that is now
// wrong twice over. Rewrite it, and refresh the stale reading in the CLI section.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'developers/infrastructure';
const SLUG = '01-running-a-node';
const SENTINEL = 'v1.3.0.5-test.1';
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
    console.log('  already applied — no write');
    process.exit(0);
  }

  // --- Block 3: the CLI's version reading is from 21 August and no longer holds.
  const cli = blocks.find((b) => b.text?.includes('Which Node Version the CLI Installs'));
  if (!cli) throw new Error('CLI section not found');
  const OLD_READING = 'Asked on 21 August 2026, it returns <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.3.0.5" target="_blank" rel="noopener">babylon-node v1.3.0.5</a> – a release that shipped nearly seventeen months after the CLI binary did. A frozen installer and a current node are not in tension here; the indirection is the point.';
  const NEW_READING = 'Asked on 21 August 2026, it returned <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.3.0.5" target="_blank" rel="noopener">babylon-node v1.3.0.5</a> – a release that shipped nearly seventeen months after the CLI binary did. A frozen installer and a current node are not in tension here; the indirection is the point. What that indirection returns during the halt is a different matter, and is covered below.';
  if (!cli.text.includes(OLD_READING)) throw new Error('block 3 reading sentence not matched');
  cli.text = cli.text.replace(OLD_READING, NEW_READING);

  // --- Block 4: replace the "Nothing to deploy yet" subsection.
  const halt = blocks.find((b) => b.text?.includes('Operating Through a Halted Network'));
  if (!halt) throw new Error('halt section not found');
  const OLD_START = '<h3>Nothing to deploy yet</h3>';
  const OLD_END = '<h3>No epochs means no emissions</h3>';
  const i = halt.text.indexOf(OLD_START);
  const j = halt.text.indexOf(OLD_END);
  if (i < 0 || j < 0 || j < i) throw new Error('deploy subsection boundaries not found');

  const REPLACEMENT = `<h3>There is a patched release, and the CLI will not install it</h3>
<p>The releases page is the cheapest signal an operator has for whether step two has produced anything, and on 8 September it produced something. <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1" target="_blank" rel="noopener">Eagle Ray <code>v1.4.0.0-RC1</code></a> was published at 15:35:42 UTC from merge commit <code>7400951e</code>, with Docker images <code>v1.4.0.0-RC1</code>, <code>-amd64</code> and <code>-arm64</code> pushed to <a href="https://hub.docker.com/r/radixdlt/babylon-node/tags" target="_blank" rel="noopener">the official repository</a> between 16:06 and 16:23 UTC. It is a release candidate rather than a final release, and its notes carry the licence boilerplate and nothing else – no changelog, no upgrade steps, no restart epoch.</p>
<p>It is also flagged <strong>prerelease</strong>, and that flag has a consequence the recommended install path walks straight into. GitHub reports as <code>latest</code> the newest release that is neither a draft nor a prerelease. Three hours before Eagle Ray, at 12:28:06 UTC, the repository published <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.3.0.5-test.1" target="_blank" rel="noopener"><code>v1.3.0.5-test.1</code></a> – an empty-bodied tag cut by <code>github-actions[bot]</code> – and that one is <em>not</em> flagged prerelease. So it is the release GitHub calls latest, and asked at 23:06 UTC on 8 September, <code>ghproxy.radixdlt.com/radixdlt/babylon-node</code> returns its <code>tag_name</code>: <code>v1.3.0.5-test.1</code>, not <code>v1.4.0.0-RC1</code>.</p>
<p>That is the field the <code>babylonnode</code> CLI reads, so the CLI-guided path described above resolves to a test build cut before the fix. Docker images exist for that tag too – pushed 12:35 to 12:52 UTC – so the install succeeds and leaves the operator on a node that is not the one the restart depends on. Three ways past it:</p>
<ul>
<li><strong>Pin the tag.</strong> <code>RADIXDLT_APP_VERSION_OVERRIDE=v1.4.0.0-RC1</code> makes the CLI use that exact release without consulting the proxy at all.</li>
<li><strong>Name it yourself.</strong> The Docker and systemd paths take the tag from your own compose file or unit, so neither is affected.</li>
<li><strong>Check what you got.</strong> After any CLI install or update, read back the image tag actually running before assuming it is the patched one.</li>
</ul>
<p>None of this had moved the ledger at the time of writing: <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">gateway-status</a> at 23:03:37 UTC on 8 September still returned state version 557,840,622 at epoch 339,896, round 102 – unchanged for 193 hours and 44 minutes, and seven and a half hours after the release an operator could install.</p>
`;
  halt.text = halt.text.slice(0, i) + REPLACEMENT + halt.text.slice(j);

  const version = '2.4.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  block 3 reading refreshed; halt subsection rewritten (${(j - i)} -> ${REPLACEMENT.length} chars)`);

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
       'The halt fix shipped as v1.4.0.0-RC1 (15:35:42 UTC, 8 Sep) but is flagged prerelease, while the empty test tag v1.3.0.5-test.1 published at 12:28:06 UTC is not - so GitHub latest, and the ghproxy mirror the babylonnode CLI reads, both return the test tag. Replaced the stale "Nothing to deploy yet" subsection with the release, the resolution trap and three ways past it (RADIXDLT_APP_VERSION_OVERRIDE, Docker/systemd, read back the running tag). Readings timestamped 23:03-23:06 UTC 8 September.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
