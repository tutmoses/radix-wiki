/**
 * sweep 488 – ecosystem rotation. abandonedarena.com's registration has expired.
 *
 * The status note recorded a DNS zone with no A record (21 August 2026). whois
 * abandonedarena.com, read 03:04 UTC 26 September 2026: registrar Namecheap,
 * Registrar Registration Expiration Date 2026-08-27; HTTP to the domain answers 200
 * with Namecheap's parked page headed "Domain registration has expired".
 *
 * Idempotent: skipped if the sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const SLUG = 'abandoned-arena';
const SENTINEL = 'expired on 27 August 2026';
const VERSION = '2.2.1';
const FROM_START = 'its website is unreachable';
const FROM_END = '(checked 21 August 2026).';
const TO = 'its website is unreachable: the registration of abandonedarena.com expired on 27 August 2026, and the address now serves Namecheap’s page headed “Domain registration has expired” (<a href="https://www.whois.com/whois/abandonedarena.com" target="_blank" rel="noopener">WHOIS</a>, read 26 September 2026).';
const MESSAGE = 'abandonedarena.com registration expired 27 Aug 2026 (WHOIS) and now serves Namecheap’s expired-domain page; status note updated from the 21 Aug DNS reading.';

await withClient(async (client) => {
  if (isLockedPage('ecosystem', SLUG)) throw new Error('LOCKED');
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['ecosystem', SLUG]);
  const page = rows[0];
  if (!page) throw new Error('page not found');
  if (JSON.stringify(page.content).includes(SENTINEL)) { console.log('  already applied'); return; }
  const blocks = JSON.parse(JSON.stringify(page.content));
  const hits = blocks.filter((b) => (b.text || '').includes(FROM_START) && (b.text || '').includes(FROM_END));
  if (hits.length !== 1) throw new Error('anchor not unique');
  const t = hits[0].text;
  const a = t.indexOf(FROM_START), z = t.indexOf(FROM_END) + FROM_END.length;
  if (a < 0 || z <= a || t.indexOf(FROM_START, a + 1) >= 0) throw new Error('anchor order');
  console.log('  replacing:', t.slice(a, z));
  hits[0].text = t.slice(0, a) + TO + t.slice(z);
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
