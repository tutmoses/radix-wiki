// Run 367, ecosystem rotation. /ecosystem/bcw-technologies  v4.0.1 -> v4.1.0
//
// The link audit flagged both arkhia.io citations on this page as timeouts. They
// are not a bot wall, and they are not the whole company either - this is the
// marketing site alone, and the distinction is the finding.
//
// Read 4 September 2026, 23:0x-23:1x UTC:
//   arkhia.io          -> 13.212.79.173, Apache, HTTP 301 to https://www.arkhia.io/
//                         (first TLS handshake of a session takes ~54s; later ones ~0.4s)
//   www.arkhia.io      -> same address; TCP 443 and 80 both accept, then nothing
//                         answers. Three 30s attempts with a browser user agent:
//                         000, zero bytes, each time. A 90s follow of the apex
//                         redirect never completed.
//   docs.arkhia.io     -> 200, 12,609 B
//   explorer.arkhia.io -> 200, 1,281 B
//   console.arkhia.io  -> connection refused
//   bcw.group 200, stakefi.network 200, hashport.network 200, hashgraph.name 200
//
// The Internet Archive corroborates the duration: the last successful capture of
// www.arkhia.io and of every one of its subpages is 12-13 June 2026, while the
// crawler reached explorer.arkhia.io on 22 July and 29 August. The archived
// /chain-endpoints/ capture (12 June 2026, 60,782 B) still carries the claim this
// page cites it for - "bespoke chain endpoints", Hedera named eight times, Radix
// not once - so the citation moves to the capture rather than being dropped.
//
//   node scripts/sweep-367-arkhia-site-unreachable.mjs --dry-run
//   node scripts/sweep-367-arkhia-site-unreachable.mjs
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'bcw-technologies';
const SENTINEL = 'docs.arkhia.io';
const DRY = process.argv.includes('--dry-run');

const WB = 'https://web.archive.org/web/20260612235810/https://www.arkhia.io/chain-endpoints/';

const OLD_BULLET = '<li><strong><a href="https://arkhia.io" target="_blank" rel="noopener">Arkhia</a></strong>, a Web3 API and RPC gateway sold alongside Google Cloud Marketplace builds, ZK proofs and an x402 facilitator service. Its explorer and metrics products are Hedera-specific and its <a href="https://www.arkhia.io/chain-endpoints/" target="_blank" rel="noopener">chain-endpoints page</a> offers bespoke endpoints without naming Radix.</li>';

const NEW_BULLET = `<li><strong>Arkhia</strong>, a Web3 API and RPC gateway sold alongside Google Cloud Marketplace builds, ZK proofs and an x402 facilitator service. Its explorer and metrics products are Hedera-specific and its <a href="${WB}" target="_blank" rel="noopener">chain-endpoints page</a> offers bespoke endpoints without naming Radix. <strong>Its website no longer answers.</strong> Read on 4 September 2026, <code>arkhia.io</code> resolves and redirects to <code>www.arkhia.io</code>, which accepts the TCP connection on ports 80 and 443 and then returns nothing at all &mdash; three thirty-second requests with a browser user agent produced zero bytes each, and a ninety-second follow of the redirect never completed. That is a hung host rather than a bot wall, which answers fast and answers with something. The <a href="https://web.archive.org/web/20260613000000*/www.arkhia.io*" target="_blank" rel="noopener">Internet Archive</a> dates the silence: its last successful capture of the site and of every subpage is 12&ndash;13 June 2026, while its crawler reached <code>explorer.arkhia.io</code> on 22 July and 29 August. The product itself has not gone with the site &mdash; <a href="https://docs.arkhia.io/" target="_blank" rel="noopener">docs.arkhia.io</a> and <a href="https://explorer.arkhia.io/" target="_blank" rel="noopener">explorer.arkhia.io</a> both answer 200 &mdash; and neither has the company: <a href="https://www.bcw.group/" target="_blank" rel="noopener">bcw.group</a>, <a href="https://stakefi.network/" target="_blank" rel="noopener">stakefi.network</a>, <a href="https://www.hashport.network/" target="_blank" rel="noopener">hashport.network</a> and <a href="https://hashgraph.name/" target="_blank" rel="noopener">hashgraph.name</a> all answered 200 in the same pass. The description above is therefore read from the archived capture, not from a live page.</li>`;

const OLD_EXT = '<li><a href="https://arkhia.io" target="_blank" rel="noopener">Arkhia – Web3 infrastructure</a></li>';
const NEW_EXT = `<li><a href="https://docs.arkhia.io/" target="_blank" rel="noopener">Arkhia – documentation</a> &ndash; the live surface; <code>www.arkhia.io</code> has not answered since June 2026 (<a href="${WB}" target="_blank" rel="noopener">archived chain-endpoints page, 12 June 2026</a>)</li>`;

const OLD_IB = '<a href="https://arkhia.io" target="_blank" rel="noopener">Arkhia</a>, Hashport, HNS';
const NEW_IB = '<a href="https://docs.arkhia.io/" target="_blank" rel="noopener">Arkhia</a> (site down), Hashport, HNS';

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
    console.log('  already applied — no write');
    process.exit(0);
  }

  const hits = { bullet: 0, ext: 0, infobox: 0 };
  const swap = (t) => {
    if (t.includes(OLD_BULLET)) { t = t.replace(OLD_BULLET, NEW_BULLET); hits.bullet += 1; }
    if (t.includes(OLD_EXT)) { t = t.replace(OLD_EXT, NEW_EXT); hits.ext += 1; }
    if (t.includes(OLD_IB)) { t = t.replace(OLD_IB, NEW_IB); hits.infobox += 1; }
    return t;
  };
  for (const b of blocks) {
    if (typeof b.text === 'string') b.text = swap(b.text);
    if (b.type === 'infobox') for (const nb of b.blocks || []) if (typeof nb.text === 'string') nb.text = swap(nb.text);
  }
  if (hits.bullet !== 1 || hits.ext !== 1 || hits.infobox !== 1) {
    throw new Error(`find strings did not match exactly once: ${JSON.stringify(hits)}`);
  }

  const version = '4.1.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  replacements ${JSON.stringify(hits)}`);
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
       "Arkhia's website is unreachable: www.arkhia.io accepts TCP on 80 and 443 and returns nothing (three 30s browser-UA requests, zero bytes each, 4 September 2026), and the Internet Archive's last successful capture of it is 12-13 June 2026. Not a bot wall and not the company - docs.arkhia.io, explorer.arkhia.io, bcw.group, stakefi.network, hashport.network and hashgraph.name all answer 200. The chain-endpoints citation moves to the dated archive capture, which still carries the claim it is cited for.", now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
