// Run 351, ecosystem rotation staleness slice. Instabridge was the stalest actionable ecosystem
// page (1 Aug) and it is verifiable off-ledger, which matters while mainnet is halted. Three
// findings: the parked instabridge.io domain has rotated to a THIRD destination (the777.co);
// the run-40-era claim that instalabs.io "no longer resolves" is imprecise — it resolves to AWS
// Global Accelerator addresses and refuses the TLS connection; and the operator's asset CDN,
// assets.instabridge.io, has lost its DNS record entirely while live Radix price feeds still
// point x-asset icons at it (23 entries in Astrolescent's feed, xLINK in Ociswap's).
// All probes 03:10–03:20 UTC, 2 September 2026.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'instabridge';
const SENTINEL = 'assets.instabridge.io';
const DRY = process.argv.includes('--dry-run');

const OLD = `<p><em>Status (2026-07-30): the bridge is closed. Its knowledge base at <code>learn.instabridge.io</code> is offline, the operator&#39;s own <code>instalabs.io</code> and <code>app.instabridge.io</code> hosts no longer resolve, and the <code>instabridge.io</code> domain has been re-registered – it now 301-redirects to an unrelated online-gambling landing page, and the destination rotates – <code>www.homesofjoy.org</code> on 30 July 2026, <code>rescuedandco.com</code> on 1 August 2026 – which is characteristic of a parked domain being monetised rather than a one-off misconfiguration. The wiki&#39;s outbound links have been repointed to a <a href="https://web.archive.org/web/20260706005255/https://www.instabridge.io/" target="_blank" rel="noopener">July 2026 archived snapshot</a>; do not follow the live domain. The eXRD-to-XRD wrapping the bridge was built for concluded with the Radix Babylon migration; the service was developed by <a target="_blank" rel="noopener" href="https://medium.com/instalabs-io">Instalabs</a> (Metapass (Radix) Ltd).</em></p>`;

const NEW = `<p><em>Status (2026-09-02): the bridge is closed, and its infrastructure has now come apart host by host. <code>instabridge.io</code> and <code>www.instabridge.io</code> resolve to Cloudflare addresses and answer every request with a 301 to an unrelated online-gambling landing page, whose destination rotates – <code>www.homesofjoy.org</code> on 30 July 2026, <code>rescuedandco.com</code> on 1 August, <code>the777.co</code> on 2 September – which is characteristic of a parked domain being monetised rather than a one-off misconfiguration. The <a href="https://rdap.identitydigital.services/rdap/domain/instabridge.io" target="_blank" rel="noopener">registry record</a> dates the domain to 21 May 2021, a transfer to 25 March 2025 and its most recent change to 11 August 2026, with an expiry of 21 May 2027. Three of the operator&#39;s own hosts – <code>app.instabridge.io</code>, <code>assets.instabridge.io</code> and <code>learn.instabridge.io</code> – now have no DNS record at all. <code>instalabs.io</code> is a narrower case than this page previously recorded: it still resolves, to two AWS Global Accelerator addresses, and its HTTPS listener refuses the connection, so it resolves without serving. The wiki&#39;s outbound links point at a <a href="https://web.archive.org/web/20260706005255/https://www.instabridge.io/" target="_blank" rel="noopener">July 2026 archived snapshot</a>; do not follow the live domain. The eXRD-to-XRD wrapping the bridge was built for concluded with the Radix Babylon migration; the service was developed by <a target="_blank" rel="noopener" href="https://medium.com/instalabs-io">Instalabs</a> (Metapass (Radix) Ltd).</em></p>` +
  `<p><em>One consequence outlives the service. The x-assets Instabridge minted are still listed by Radix trading venues, and those listings still fetch their token icons from the CDN that has gone: read on 2 September 2026, <a href="https://api.astrolescent.com/prices" target="_blank" rel="noopener">Astrolescent&#39;s price feed</a> carries twenty-three entries – xUSDC, xUSDT, xwBTC, xETH, xDAI, xADA, xPEPE, xXRP, xBNB, xSHIB, xLINK, xMKR, xWLD, xUNI, xGRT, xIMX, xENA, xCRO, xETC, xAAVE, xPOL, xXLM and xTRX – whose <code>iconUrl</code> is on <code>assets.instabridge.io</code>, and <a href="https://api.ociswap.com/tokens" target="_blank" rel="noopener">Ociswap&#39;s token list</a> does the same for xLINK. A dead bridge leaves its wrapped assets on the ledger; a dead CDN leaves them without a picture. These x-assets are a separate set from the Hyperlane-bridged h-assets: the asset table of the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">31 August 2026 drain</a> names hUSDC, hUSDT, hETH, hWBTC, hSOL and hBNB only.</em></p>`;

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

  const b = blocks.find((x) => (x.text || '').includes(OLD));
  if (!b) throw new Error('status paragraph not matched');
  b.text = b.text.replace(OLD, NEW);

  const version = '2.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  +${NEW.length - OLD.length} chars`);
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
       "Status re-measured host by host on 2 September 2026. The parked instabridge.io has rotated to a third destination (the777.co) and carries a registry record; app./assets./learn.instabridge.io now have no DNS record; and the earlier claim that instalabs.io no longer resolves is corrected — it resolves to AWS Global Accelerator and refuses the TLS connection. New paragraph on the consequence that outlives the service: 23 x-asset entries in Astrolescent's live feed and xLINK in Ociswap's still fetch icons from the dead CDN, with the x-asset / h-asset distinction stated against the 31 August drain.", now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
