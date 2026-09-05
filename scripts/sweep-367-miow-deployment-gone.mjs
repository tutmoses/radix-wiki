// Run 367, ecosystem rotation. /ecosystem/miow  v2.0.0 -> v2.1.0
//
// The page states "The platform is live and the path from wallet connection to a
// published page works end to end", written 15 August 2026, and cites six URLs on
// miow.me for its pricing, block model, sitemap and deployment guide. Every one of
// those six answers HTTP 404 with x-vercel-error DEPLOYMENT_NOT_FOUND and a
// 107-byte text/plain body reading "The deployment could not be found on Vercel."
// Two independent reads, 03:11 UTC and 23:09 UTC on 4 September 2026, are
// identical: the domain resolves (216.150.1.1, Vercel) and the deployment behind
// it is gone. That is not a bot wall and not a transient outage - a deployment
// that has been deleted or unassigned from its domain.
//
// The Internet Archive holds 35 captures of miow.me, all of them from 10 June 2026
// and all of them published-site paths under /s/. None of the six cited URLs was
// ever archived, so there is nothing to repoint them at. The links come off; the
// text they carried stays, dated to the reading that verified it.
//
// metadata.status 🟢 Active -> 🟠 Dormant, per the definition the operational-status
// index publishes: not shut down, not withdrawn, no current operation.
//
//   node scripts/sweep-367-miow-deployment-gone.mjs --dry-run
//   node scripts/sweep-367-miow-deployment-gone.mjs
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage, meta } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'miow';
const SENTINEL = 'DEPLOYMENT_NOT_FOUND';
const DRY = process.argv.includes('--dry-run');

// Unlink any anchor whose href is on miow.me, keeping the anchor text.
const UNLINK = /<a href="https:\/\/miow\.me[^"]*"[^>]*>([\s\S]*?)<\/a>/g;

const OLD_LEAD = '<p>The platform is live and the path from wallet connection to a published page works end to end.';

const NEW_STATUS = `<h2>Status and Adoption</h2>
<p><strong>The platform is offline.</strong> Read at 03:11&nbsp;UTC and again at 23:09&nbsp;UTC on 4 September 2026, <code>miow.me</code> resolves to Vercel and answers HTTP&nbsp;404 at every path with the header <code>x-vercel-error: DEPLOYMENT_NOT_FOUND</code> and a 107-byte <code>text/plain</code> body reading &ldquo;The deployment could not be found on Vercel.&rdquo; The same answer comes back for the root, the sitemap, the deployment guide, the published briefing and the one published site this page cited by name. A deployment that has been deleted or unassigned from its domain answers this way; a bot wall does not, and neither does a server under load. The <a href="https://web.archive.org/web/20260610*/miow.me*" target="_blank" rel="noopener">Internet Archive</a> holds 35 captures of the domain, every one of them taken on 10 June 2026, so none of the pages cited below can be read in an archive either.</p>
<p>This is a hosting outage rather than a shutdown announcement: nobody has said the project has ended, and the network it builds on has itself been <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">halted since 31 August 2026</a>. What can be measured is that the platform is not currently operable, which is what the status field on this page now records.</p>
<p><strong>What was verified while it was up.</strong> Everything described on this page was read from the platform's own surfaces on 15 August 2026. Sign-in was <a href="/contents/tech/core-protocols/radix-connect" rel="noopener">Radix ROLA</a> wallet-signature authentication; the builder placed the block types listed below on a twelve-column grid with per-block style controls; publishing served the result at <code>miow.me/s/&lt;slug&gt;</code>; and store blocks priced products in XRD, with Stripe available for fiat checkout.</p>
<p>Adoption was small and publicly measurable. On 15 August 2026 the sitemap listed <strong>eleven published sites</strong>, and most carried builder-default names &mdash; several <code>untitled-site-*</code>, a <code>test-site-*</code>, and repeated variants of the same project name &mdash; so the figure read as development and demonstration work rather than as third-party production deployments. It was the honest measure available from outside: the platform published no user or revenue figures, and a site published under a custom domain via the export route would not have appeared in that sitemap at all. The Archive's 10 June 2026 crawl is consistent with it, listing nine site slugs of the same shape.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => typeof b.text === 'string' && b.text.includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const statusIdx = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes(OLD_LEAD));
  if (statusIdx < 0) throw new Error('Status and Adoption block not found — refusing to write');
  blocks[statusIdx] = { id: uid(), type: 'content', text: NEW_STATUS };

  let unlinked = 0;
  for (const b of blocks) {
    if (typeof b.text !== 'string') continue;
    b.text = b.text.replace(UNLINK, (_m, inner) => { unlinked += 1; return inner; });
  }

  // External Links: the whole list pointed at miow.me and is now bare text.
  const extIdx = blocks.findIndex((b) => typeof b.text === 'string' && /<h2[^>]*>\s*External Links/.test(b.text));
  if (extIdx < 0) throw new Error('External Links block not found');
  blocks[extIdx] = { id: uid(), type: 'content', text: `<h2>External Links</h2>
<p>Every URL this page cited is on <code>miow.me</code>, and the domain has served <code>DEPLOYMENT_NOT_FOUND</code> at every path since at least 4 September 2026. The list is kept as a record of what was cited and where it was read, without live links to pages that no longer answer.</p>
<ul>
<li><code>miow.me</code> &ndash; the platform</li>
<li><code>miow.me/guide</code> &ndash; installation and deployment guide, self-hosting an exported site</li>
<li><code>miow.me/sitemap.xml</code> &ndash; the index of published sites</li>
<li><code>miow.me/llms.txt</code> &ndash; the platform's own briefing (features, pricing, stack)</li>
<li><code>miow.me/AGENTS.md</code></li>
</ul>
<ul>
<li><a href="https://web.archive.org/web/20260610*/miow.me*" target="_blank" rel="noopener">Internet Archive &ndash; miow.me</a>, 35 captures, all from 10 June 2026</li>
<li><a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">Radix Ecosystem Operational Status</a> &ndash; how this wiki reads a project website, and what a probe does not prove</li>
</ul>` };

  const metadata = { ...meta(page), status: '🟠 Dormant' };

  const version = '2.1.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  status ${meta(page).status} -> ${metadata.status}; ${unlinked} miow.me links unlinked; Status block at index ${statusIdx}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3, metadata=$4 WHERE id=$5',
      [json, version, now, JSON.stringify(metadata), page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'The platform is offline: miow.me answers HTTP 404 with x-vercel-error DEPLOYMENT_NOT_FOUND at every path, read twice on 4 September 2026 twenty hours apart. Rewrites the liveness claim, dates the adoption figures to the 15 August reading that produced them, unlinks the six dead miow.me citations (the Archive holds only a 10 June 2026 crawl of /s/ paths, so none can be repointed), and moves the status from Active to Dormant.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
