/**
 * sweep 488 – ecosystem rotation. projectnow.io no longer belongs to Project $NOW.
 *
 * whois projectnow.io, read 03:05 UTC 26 September 2026: Creation Date 2025-12-10,
 * registrar Spaceship, Inc. HTTPS to projectnow.io answers 301 to an unrelated site,
 * which redirects on again. The agency's own pages survive in the Internet Archive
 * (CDX, statuscode 200, titles "Project $NOW | Marketing Agency for the Radix Chain").
 * All 43 page links and metadata.website are repointed to those captures, and one
 * sentence records the lapse. The redirect target is not named (VOICE.md §2).
 *
 * Idempotent: skipped if no live projectnow.io link remains.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const SLUG = 'project-now';
const VERSION = '2.4.0';
const WB = 'https://web.archive.org/web';
const CAPTURES = {
  'https://projectnow.io/services/': `${WB}/20250212112748/https://projectnow.io/services/`,
  'https://projectnow.io/token/': `${WB}/20241205224053/https://projectnow.io/token/`,
  'https://projectnow.io/rcc/': `${WB}/20241210191031/https://projectnow.io/rcc/`,
  'https://projectnow.io/': `${WB}/20250125040424/https://projectnow.io/`,
};
const ANCHOR = 'reflects the project at its peak of activity.';
const SENTENCE = ' The agency’s domain, projectnow.io, lapsed and was registered again on 10 December 2025 at a different registrar (<a href="https://www.whois.com/whois/projectnow.io" target="_blank" rel="noopener">WHOIS</a>, read 26 September 2026); it now redirects to sites unconnected with the agency, so the links on this page go to <a href="https://web.archive.org/web/20250125040424/https://projectnow.io/" target="_blank" rel="noopener">Internet Archive captures</a> of its site from late 2024 and early 2025.';
const MESSAGE = 'projectnow.io was re-registered on 10 Dec 2025 (WHOIS) and now redirects to unrelated sites. Repointed all 43 links and metadata.website to Internet Archive captures of the agency site and added one sentence to the Status paragraph.';

await withClient(async (client) => {
  if (isLockedPage('ecosystem', SLUG)) throw new Error('LOCKED');
  const { rows } = await client.query('SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', ['ecosystem', SLUG]);
  const page = rows[0];
  if (!page) throw new Error('page not found');
  let json = JSON.stringify(page.content);
  if (!json.includes('href=\\"https://projectnow.io/')) { console.log('  already applied'); return; }
  let n = 0;
  for (const [from, to] of Object.entries(CAPTURES)) {
    const parts = json.split(`href=\\"${from}\\"`);
    n += parts.length - 1;
    json = parts.join(`href=\\"${to}\\"`);
  }
  if (json.includes('href=\\"https://projectnow.io')) throw new Error('unmapped projectnow.io path remains');
  const blocks = JSON.parse(json);
  const hits = blocks.filter((b) => (b.text || '').includes(ANCHOR));
  if (hits.length !== 1 || hits[0].text.split(ANCHOR).length !== 2) throw new Error('anchor not unique');
  hits[0].text = hits[0].text.replace(ANCHOR, ANCHOR + SENTENCE);
  assertLinkShapes(blocks, page.title);
  const metadata = { ...page.metadata, website: 'web.archive.org/web/20250125040424/https://projectnow.io/' };
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}, ${n} links repointed, website ${page.metadata.website} -> ${metadata.website}`);
  if (DRY) return;
  const now = new Date().toISOString();
  const out = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content = $1, metadata = $2, version = $3, updated_at = $4, last_verified_at = $4 WHERE id = $5', [out, JSON.stringify(metadata), VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, out, page.title, VERSION, 'minor', AUTHOR_ID, MESSAGE, now]);
  await client.query('COMMIT');
});
