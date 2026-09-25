/**
 * sweep 484 - ecosystem rotation. radquest.io has moved to the aftermarket.
 *
 * /ecosystem/radquest records the 10 August 2026 expiry and Namecheap's expired-
 * domain page. whois radquest.io, read 11:10 UTC 25 September 2026: registrar
 * GoDaddy.com, LLC; registrant Domains By Proxy; name servers ns1/ns2.afternic.com;
 * Registry Expiry Date 2028-08-10; Updated Date 2026-09-25T08:48:07Z; creation
 * date unchanged (2023-08-10). HTTPS to radquest.io does not connect.
 *
 * Idempotent: skipped if the sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const SLUG = 'radquest';
const SENTINEL = 'ns1.afternic.com';
const VERSION = '1.0.1';
const FROM = 'headed “Domain registration has expired”.';
const TO = FROM + ' On 25 September 2026 the record changed again: the registrar is now GoDaddy, the nameservers are <code>ns1.afternic.com</code> and <code>ns2.afternic.com</code>, belonging to <a href="https://www.afternic.com" target="_blank" rel="noopener">Afternic</a>, a marketplace that lists domains for resale, and the registration runs to 10 August 2028 (<a href="https://www.whois.com/whois/radquest.io" target="_blank" rel="noopener">WHOIS</a>, read that day).';
const MESSAGE = 'radquest.io moved to GoDaddy with Afternic nameservers and a registry expiry of 10 Aug 2028 (WHOIS updated 08:48 UTC 25 Sep 2026). One sentence added after the expiry paragraph.';

await withClient(async (client) => {
  if (isLockedPage('ecosystem', SLUG)) throw new Error('LOCKED');
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['ecosystem', SLUG]);
  const page = rows[0];
  if (!page) throw new Error('page not found');
  if (JSON.stringify(page.content).includes(SENTINEL)) { console.log('  already applied'); return; }
  const blocks = JSON.parse(JSON.stringify(page.content));
  const hits = blocks.filter((b) => (b.text || '').includes(FROM));
  if (hits.length !== 1 || hits[0].text.split(FROM).length !== 2) throw new Error('anchor not unique');
  hits[0].text = hits[0].text.replace(FROM, TO);
  assertLinkShapes(blocks, page.title);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);
  if (DRY) return;
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4', [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'patch', AUTHOR_ID, MESSAGE, now]);
  await client.query('COMMIT');
});
