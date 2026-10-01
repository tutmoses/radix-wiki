// scripts/sweep-512-dexter-domain-lapse.mjs
//
// Ecosystem rotation, run 512. DeXter was at the head of the staleness queue (28 Aug),
// and re-reading its sources on 1 October 2026 found two facts had moved:
//   - dexteronradix.com is no longer parked. WHOIS (GoDaddy) gives a registry expiry of
//     17 Aug 2026 and status redemptionPeriod (updated 28 Sep); the name answers NXDOMAIN.
//     Once it drops anyone can register it, the RadLand case.
//   - The 8 March buyback bid kept filling. The treasury account held 1,213,497.76 DEXTR
//     on 28 July; nine fills from 29 July to 14 September (largest 20,290.31 DEXTR in
//     txid_rdx1qzs45...) took it to 1,281,060.15 DEXTR at state version 560,537,423 on
//     1 Oct, 27% of the unchanged 4,739,465.13 supply. The 14 Sep fills are routes that
//     pull DEXTR out of a pool and sell it into the resting bid, so the page's "nothing
//     has touched it since" no longer holds.
//
//   node scripts/sweep-512-dexter-domain-lapse.mjs --dry-run
//   node scripts/sweep-512-dexter-domain-lapse.mjs
//
// Idempotent: skipped if the sentinel is already present.

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const SLUG = 'dexter';
const SENTINEL = 'redemption period';
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const TREASURY = 'https://dashboard.radixdlt.com/account/account_rdx168qrzyngejus9nazhp7rw9z3qn2r7uk3ny89m5lwvl299ayv87vpn5/tokens';
const FILL = 'https://dashboard.radixdlt.com/transaction/txid_rdx1qzs45udtq5pj2hypnm5d9g46s42la0ycr6pajthxfv24sffmtycsgkczrr/summary';
const REDEMPTION = 'https://icann.org/epp#redemptionPeriod';

const subs = [
  [
    '<td>dexteronradix.com – offline; the domain now serves a parked-domain lander (checked 28 July 2026)</td>',
    `<td>dexteronradix.com – offline; the registration lapsed on 17 August 2026 and the name is in its ${A(REDEMPTION, 'redemption period')} with no DNS (checked 1 October 2026)</td>`,
  ],
  [
    'as of 28 July 2026 <code>dexteronradix.com</code> resolves to a parked-domain lander rather than the exchange,',
    `<code>dexteronradix.com</code> served a parked-domain lander on 28 July 2026, its registration expired on 17 August, and on 1 October 2026 the name sat in the registrar's ${A(REDEMPTION, 'redemption period')} and did not resolve at all. Once it drops, anyone can register it, which is what happened to <a href="/ecosystem/radland" rel="noopener">RadLand</a>'s domain. The project's GitBook documentation`,
  ],
  [
    "and the project's GitBook documentation returns a 404,",
    'returns a 404,',
  ],
  [
    'repurchased so far, with the balance of the XRD still resting in the open order.</p>',
    `repurchased so far, with the balance of the XRD still resting in the open order. The bid kept filling after that: nine fills between 29 July and 14 September 2026, the largest ${A(FILL, '20,290.31 DEXTR')} on 14 September, took the ${A(TREASURY, 'treasury')} to <strong>1,281,060.15 DEXTR</strong> by 1 October 2026, 27% of the supply.</p>`,
  ],
  [
    'the apex is parked on GoDaddy nameservers and the asset hosts were never re-pointed.',
    'the apex itself lapsed in August 2026 and the asset hosts were never re-pointed before it did.',
  ],
  [
    'Nothing has touched it in the ten days since.',
    `The routes then found a second exit. On 14 September two transactions pulled 29,673.55 DEXTR out of a pool and sold it into the treasury's resting buyback bid, so the project's own order is now where the token's volume ends up.`,
  ],
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
const leaves = (bs) => bs.flatMap((b) => [b, ...(b.blocks || [])]);

try {
  if (isLockedPage('ecosystem', SLUG)) throw new Error(`ecosystem/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['ecosystem', SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (leaves(blocks).some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied - no write');
  } else {
    for (const [from, to] of subs) {
      const hits = leaves(blocks).filter((b) => (b.text || '').includes(from));
      if (hits.length !== 1) throw new Error(`expected 1 match, got ${hits.length}: ${from.slice(0, 70)}`);
      hits[0].text = hits[0].text.replace(from, to);
    }
    assertLinkShapes(blocks, `ecosystem/${SLUG}`);
    if (/[— ]/.test(subs.map(([, to]) => to).join(''))) throw new Error('em dash or nbsp in new text');
    const version = '4.5.0';
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${subs.length} substitutions)`);
    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query(
        'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
        [json, version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
          'Sweep 512: dexteronradix.com lapsed 17 Aug 2026 and is in its redemption period (WHOIS, NXDOMAIN, 1 Oct); the March buyback bid filled nine more times to 14 Sep, treasury 1,281,060.15 DEXTR (27% of supply), read on-ledger at state version 560,537,423.',
          now]);
      await client.query('COMMIT');
      console.log('  written');
    }
  }
} catch (e) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('  FAILED:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
