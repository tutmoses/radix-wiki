import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Correction to sweep-328-dexter-ledger-residue.mjs, same run.
// That edit read "last transaction touching DEXTR" from the Gateway's
// affected_global_entities_filter on the RESOURCE, which returns only
// mint/burn/metadata events - not pool swaps. It published "six months of
// complete silence" when the token's PrecisionPool traded ten times between
// 29 July and 19 August 2026. Both trading paragraphs are rewritten.

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'dexter';
const SENTINEL = 'still traded, by machines';

const OLD_P2_START = '<p>A closed Radix project does not disappear';
const OLD_P2_END = '</p>';
const OLD_LIQ_START = '<p>The token also still has a market, of a kind.';

const NEW_OPENER = `<p>A closed Radix project does not disappear from the ledger; it stops being maintained on it. Read live at <strong>epoch 339,247</strong> on 29 August 2026, the <a href="https://dashboard.radixdlt.com/resource/resource_rdx1tkktjr0ew96se7wpsqxxvhp2vr67jc8anq04r5xkgxq3f0rg9pcj0c" target="_blank" rel="noopener">DEXTR resource</a> still holds the same <strong>4,739,465.133049414416099876</strong> supply recorded a month earlier, and no burn has touched it. Queried at the resource itself the token looks dead &ndash; the last event the Gateway returns against it is dated 26 February 2026, ten days before the wind-down was confirmed. That view is misleading, and the pools are where to look instead.</p>`;

const NEW_LIQ = `<p><strong>DEXTR is still traded, by machines.</strong> The token sits in three XRD pools on <a href="https://ociswap.com/dextr" target="_blank" rel="noopener">Ociswap</a>, first listed on 19 January 2024 and together holding <strong>80,950.50 DEXTR against 30,492.85 XRD</strong> &ndash; about $27.71 of liquidity by Ociswap&rsquo;s own reckoning, at a quoted 0.2592 XRD per DEXTR &ndash; against a lifetime 4,089,422 DEXTR and 3,279,923 XRD traded. The largest of the three, a PrecisionPool opened on 27 August 2024, recorded <strong>ten transactions between 29 July and 19 August 2026</strong>, moving between roughly 817 and 16,420 DEXTR apiece across five different accounts, in the multi-hop shape of routed arbitrage rather than anyone trading the project. Nothing has touched it in the ten days since. A retired token with a shallow pool and a stale price is a standing invitation to a router, and that is what the remaining volume is.</p>
<p><em>Method note: a resource-level query is the wrong instrument here. The Gateway&rsquo;s entity filter on a fungible resource returns the events that act on the resource itself &ndash; minting, burning, metadata &ndash; and not the swaps that move it between vaults, so a token can look untouched for six months while its pool trades weekly. The pool components are the ones to query.</em></p>`;

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
  if (blocks.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const body = blocks.find((b) => (b.text || '').includes(OLD_P2_START));
  if (!body) throw new Error('opener paragraph not found');

  // replace the opening paragraph
  const s1 = body.text.indexOf(OLD_P2_START);
  const e1 = body.text.indexOf(OLD_P2_END, s1) + OLD_P2_END.length;
  if (s1 < 0 || e1 <= s1) throw new Error('opener bounds not found');
  body.text = body.text.slice(0, s1) + NEW_OPENER + body.text.slice(e1);

  // replace the liquidity paragraph
  const s2 = body.text.indexOf(OLD_LIQ_START);
  if (s2 < 0) throw new Error('liquidity paragraph not found');
  const e2 = body.text.indexOf('</p>', s2) + '</p>'.length;
  body.text = body.text.slice(0, s2) + NEW_LIQ + body.text.slice(e2);

  const version = '4.4.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  blocks.forEach((b, i) => {
    const before = page.content[i].text || '';
    if (before !== (b.text || '')) console.log(`  block[${i}] ${b.type}: ${before.length} -> ${(b.text || '').length} B`);
  });
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Corrects v4.3.0, published an hour earlier: DEXTR has not been silent since February. That reading came from the Gateway entity filter on the resource, which returns mint/burn/metadata events and not swaps. The token PrecisionPool traded ten times between 29 July and 19 August 2026 across five accounts, in routed-arbitrage shape. Both trading paragraphs rewritten, with the measurement caveat stated.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
