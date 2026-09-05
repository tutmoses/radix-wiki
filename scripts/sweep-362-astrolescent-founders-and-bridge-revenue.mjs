// Sweep 362 (ecosystem rotation).
//
// Two corrections to /ecosystem/astrolescent, plus one cross-link on /ecosystem/hyperlane.
//
// 1. FOUNDER. The page said "The project was founded by Michael Videtto" and cited
//    Astrolescent's own team page for it. That page says something else: "Astrolescent was
//    founded by Timan Rebel and Meronym in 2021, but is currently ran by Timan." Videtto is
//    real and is a co-founder, but he is not the founder and the cited source never said he
//    was: Radix's own DeFi Download episode introduces him as "co-founder of Astrolescent"
//    in the 2023 USDA stablecoin period, and he no longer appears on the team page.
//
// 2. FUNDING. On 3 September 2026 at 20:36:57 UTC, in the main Radix group, Timan Rebel
//    answered a direct question about whether Astrolescent is his full-time job. It is not,
//    any more, and the reason he gives lands on the revenue model this page describes: the
//    bridge, the newest of the five fee streams shared with $ASTRL stakers, did not pay.
//    t.me/radix_dlt/1001809, embed-verified as his (reply to t.me/radix_dlt/1001808).
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const SENTINEL_A = 'Timan Rebel';
const SENTINEL_B = 'did not share its fees with the front ends';

const OLD_IB = `<tr><th>Founder</th><td>Michael Videtto</td></tr>`;
const NEW_IB = `<tr><th>Founders</th><td>Timan Rebel and Meronym (2021)</td></tr>
<tr><th>Run by</th><td>Timan Rebel</td></tr>`;

const OLD_OVERVIEW = `The project was founded by Michael Videtto and is documented at <a href="https://docs.astrolescent.com/astrolescent-docs/readme/team" target="_blank" rel="noopener">its team page</a>.`;
const NEW_OVERVIEW = `Astrolescent's <a href="https://docs.astrolescent.com/astrolescent-docs/readme/team" target="_blank" rel="noopener">team page</a> names Timan Rebel and Meronym as its founders in 2021 and says the project "is currently ran by Timan". Rebel, an Amsterdam startup founder who also contributes to <a href="/ecosystem/defiplaza" rel="noopener">DefiPlaza</a> and <a href="/ecosystem/hug" rel="noopener">HUG</a>, was appointed the Radix Foundation's Interim <a href="/contents/tech/research/hyperscale-500k-tps" rel="noopener">Hyperscale</a> Lead in November 2025. A co-founder, Michael Videtto, represented the project on Radix's own <a href="https://www.youtube.com/watch?v=ZNXrlm1SUB0" target="_blank" rel="noopener">DeFi Download podcast</a> during the USDA stablecoin period in 2023; he is not listed on the team page.`;

const FUNDING = `<h2>Funding and sustainability</h2>
<p>Asked directly in the main Radix group on <strong>3 September 2026</strong> whether Astrolescent was his full-time job, Timan Rebel <a href="https://t.me/radix_dlt/1001809" target="_blank" rel="noopener">answered at 20:36:57 UTC</a> that it "used to be my fulltime job for about 2.5 years, living of my savings and the FND grants", and that he had "recently started a part-time position as CTO at a scale-up". It is the first public account of how the project has been paid for, and it names two sources rather than the product: his own savings, and grants from the Radix Foundation.</p>
<p>The same message gives the reason the arrangement changed, and it bears directly on the revenue model described above. "I had hoped the bridge would generate enough volume, but Hyperlane didn't allow for fee-sharing and almost nobody swapped anymore via <a href="https://www.rocketx.exchange/" target="_blank" rel="noopener">RocketX</a>." The bridge is the newest of the five streams whose fees go to $ASTRL stakers and the one the front page advertises first, and by its operator's account it did not earn. <a href="/ecosystem/hyperlane" rel="noopener">Hyperlane</a> is a permissionless protocol that anyone may deploy a route on, which is what makes it reachable at all; the other side of that openness is that it owes an integrator nothing, and the fee a warp route charges is the protocol's.</p>
<p>The exchange came four days into the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">network halt</a>, with every Hyperlane-bridged asset drained off Radix and the ledger stopped since 21:19 UTC on 31 August 2026. Astrolescent's own price feed has been serving the last quotes the pools produced before the stop. The project remains active and Rebel continues to run it.</p>`;

const OLD_HL = `<a href="https://nexus.hyperlane.xyz/" target="_blank" rel="noopener">Hyperlane Nexus</a>, the protocol's own reference application.`;
const NEW_HL = `<a href="https://nexus.hyperlane.xyz/" target="_blank" rel="noopener">Hyperlane Nexus</a>, the protocol's own reference application. Being permissionless cuts both ways for the front end: Hyperlane <a href="https://t.me/radix_dlt/1001809" target="_blank" rel="noopener">did not share its fees with the front ends</a> that carried its routes, which Astrolescent's operator gave on 3 September 2026 as one reason the bridge never earned what he had hoped.`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const NBSP = [OLD_IB, OLD_OVERVIEW, OLD_HL].some((s) => [...s].some((c) => c.charCodeAt(0) === 160));
if (NBSP) throw new Error('a find-string contains U+00A0');

const readPage = async (tagPath, slug) => {
  if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [tagPath, slug]);
  if (!rows.length) throw new Error(`${tagPath}/${slug} not found`);
  return rows[0];
};

const write = async (page, blocks, version, changeType, message) => {
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (DRY) return;
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, changeType, AUTHOR_ID, message, now]);
  await client.query('COMMIT');
};

try {
  // ---- /ecosystem/astrolescent ----
  const astr = await readPage('ecosystem', 'astrolescent');
  const aBlocks = JSON.parse(JSON.stringify(astr.content));
  if (JSON.stringify(aBlocks).includes(SENTINEL_A)) {
    console.log('  astrolescent: already applied - no write');
  } else {
    const ib = aBlocks[0].blocks[0];
    if (!ib.text.includes(OLD_IB)) throw new Error('astrolescent: infobox founder row not found');
    ib.text = ib.text.replace(OLD_IB, NEW_IB);

    if (!aBlocks[1].text.includes(OLD_OVERVIEW)) throw new Error('astrolescent: overview founder sentence not found');
    aBlocks[1].text = aBlocks[1].text.replace(OLD_OVERVIEW, NEW_OVERVIEW);

    const extIdx = aBlocks.findIndex((b) => (b.text || '').includes('<h2>External Links</h2>'));
    if (extIdx < 0) throw new Error('astrolescent: External Links block not found');
    aBlocks.splice(extIdx, 0, { id: uid(), type: 'content', text: FUNDING });

    await write(astr, aBlocks, '3.3.0', 'minor',
      'Founder corrected against the page\'s own cited source: the Astrolescent team page names Timan Rebel and Meronym as founders in 2021 and says Timan runs it; Michael Videtto is a co-founder (Radix DeFi Download, 2023) and is not listed there. New Funding and sustainability section: Rebel, t.me/radix_dlt/1001809 (3 Sep 2026, 20:36:57 UTC), says the project ran 2.5 years on his savings and Foundation grants and that he is now part-time, because the bridge did not earn - Hyperlane allowed no fee-sharing and RocketX volume dried up.');
  }

  // ---- /ecosystem/hyperlane ----
  const hl = await readPage('ecosystem', 'hyperlane');
  const hBlocks = JSON.parse(JSON.stringify(hl.content));
  if (JSON.stringify(hBlocks).includes(SENTINEL_B)) {
    console.log('  hyperlane: already applied - no write');
  } else {
    const idx = hBlocks.findIndex((b) => (b.text || '').includes(OLD_HL));
    if (idx < 0) throw new Error('hyperlane: front-ends sentence not found');
    hBlocks[idx].text = hBlocks[idx].text.replace(OLD_HL, NEW_HL);
    await write(hl, hBlocks, '1.1.0', 'minor',
      'The Radix integration: record that Hyperlane shared no fees with the front ends carrying its routes, per Astrolescent\'s operator on 3 September 2026 (t.me/radix_dlt/1001809). Cross-links to the new Funding and sustainability section on /ecosystem/astrolescent.');
  }
} finally {
  client.release();
  await pool.end();
}
