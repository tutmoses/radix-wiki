/**
 * Run 324 (ecosystem rotation) — /ecosystem/ice
 *
 * The page reported the RRC-404 pair as "capped at 1,000 combined units; ~723 minted".
 * That reading measured the fungible side only. Read live at epoch 339,054 the pair is
 * 733 fungible + 267 non-fungible = exactly 1,000: the cap is an invariant the component
 * holds at all times, not a ceiling the project is minting towards.
 *
 * Also verified on-ledger this run: the 1 XRD royalty is charged per CALL, not per unit,
 * and usage is sparse — three transactions in 2026 against a cluster in mid-2024.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'ice';
const SENTINEL = '339,054';
const DRY = process.argv.includes('--dry-run');

const FUNGIBLE = 'resource_rdx1t4h4396mukhpzdrr5sfvegjsxl8q7a34q2vkt4quxcxahna8fucuz4';
const NONFUNGIBLE = 'resource_rdx1n2y299ekzx4au2v9yjmxzu650ulvk5ndx3u5tlevfclk0uvdgs30px';
const COMPONENT = 'component_rdx1czscv9f2mv034hewjplej5ef4f2ecug2fxxelfpgxrsrhw4mglq2yp';
const MELT_TX = 'txid_rdx15uv25zz4j8ak5487nye34q9zssrzmvpsaqhz8c4hlrq3d88lxs9qk5u9zt';
const dash = (a) => `https://dashboard.radixdlt.com/${a.startsWith('component') ? 'component' : a.startsWith('txid') ? 'transaction' : 'resource'}/${a}`;

const INFOBOX = `<table><tbody><tr><th colspan="2">Ice</th></tr>` +
  `<tr><td><strong>Type</strong></td><td>Experimental NFT project using <a href="/contents/tech/core-protocols/rrc-404" rel="noopener">RRC-404</a> (an ERC-404-style hybrid token) on Radix</td></tr>` +
  `<tr><td><strong>Status</strong></td><td>🟢 Active – site live at ice404.com, component live on mainnet, last used 7 August 2026</td></tr>` +
  `<tr><td><strong>Founded</strong></td><td>2024</td></tr>` +
  `<tr><td><strong>Component</strong></td><td><a href="${dash(COMPONENT)}" target="_blank" rel="noopener">Ice RRC-404</a> – holds the freeze and melt methods and collects the royalty</td></tr>` +
  `<tr><td><strong>Token pair</strong></td><td><a href="${dash(FUNGIBLE)}" target="_blank" rel="noopener">$ICE ("Water")</a>, fungible, and <a href="${dash(NONFUNGIBLE)}" target="_blank" rel="noopener">Ice</a>, non-fungible</td></tr>` +
  `<tr><td><strong>Supply</strong></td><td>733 fungible + 267 non-fungible = 1,000, the cap held as an invariant rather than approached (epoch ${SENTINEL}, 28 August 2026)</td></tr>` +
  `<tr><td><strong>Mechanic</strong></td><td>"Freeze" / "melt" to convert between fungible and NFT state; 1 XRD royalty per call</td></tr>` +
  `<tr><td><strong>Website</strong></td><td><a href="https://ice404.com" target="_blank" rel="noopener">ice404.com</a></td></tr>` +
  `</tbody></table>`;

const SECTION = `<h2>On-Ledger State and Usage</h2>` +
  `<p>The 1,000-unit cap is not a ceiling the project has been minting towards. It is an invariant the component holds at every moment: a freeze burns fungible units and mints the same number of NFTs, a melt does the reverse, and the two sides always sum to the cap. Read live through the <a href="https://mainnet.radixdlt.com" target="_blank" rel="noopener">Radix Gateway</a> at <strong>epoch ${SENTINEL}</strong> (28 August 2026, 23:07 UTC), the fungible <a href="${dash(FUNGIBLE)}" target="_blank" rel="noopener">$ICE ("Water")</a> resource carried a total supply of <strong>733</strong> and the paired non-fungible <a href="${dash(NONFUNGIBLE)}" target="_blank" rel="noopener">Ice</a> resource <strong>267</strong> – exactly 1,000 between them. An earlier reading of roughly 723 on this page measured only the fungible side, which is a share of the supply rather than the amount minted.</p>` +
  `<p>Both resources are driven by one component, <a href="${dash(COMPONENT)}" target="_blank" rel="noopener">Ice RRC-404</a>, whose on-ledger description reads "Easily convert RRC-404 tokens between fungible and nonfungible using the freeze and melt methods."</p>` +
  `<p>The royalty is charged <strong>per call, not per unit</strong>. The most recent transaction to touch the pair, on <a href="${dash(MELT_TX)}" target="_blank" rel="noopener">7 August 2026</a>, melted ten NFTs (<code>#2935#</code> through <code>#2944#</code>) into ten fungible ICE in a single <code>melt</code> call, and the Gateway receipt records a <code>xrd_total_royalty_cost</code> of exactly 1 XRD routed to the component, against 0.771 XRD of network execution, finalization and storage cost. That transaction is also what moved the split from the 723/277 this page previously recorded to today's 733/267.</p>` +
  `<p>Use of the mechanic is sparse. The newest 100 transactions in the Gateway stream touching the component reach back to 26 July 2024, and only three of them fall in 2026: two on 1 March and the 7 August melt above. Activity concentrated in the two months after launch – 58 of those 100 transactions land in July and August 2024 – with a second cluster of 16 across June and July 2025. The site and the component both answer, so the mechanic is intact; what has thinned is the use of it.</p>`;

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
  const flat = JSON.stringify(blocks);
  if (flat.includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const infobox = blocks.find((b) => b.type === 'infobox');
  if (!infobox?.blocks?.length) throw new Error('infobox block not found');
  infobox.blocks[0].text = INFOBOX;
  blocks.push({ id: uid(), type: 'content', text: SECTION });

  const version = '2.2.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  ${flat.length} -> ${JSON.stringify(blocks).length} B`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Correct the supply reading and add an On-Ledger State and Usage section, all read live at epoch 339,054. The 1,000 cap is an invariant the component holds (733 fungible + 267 non-fungible), not a ceiling being approached; the earlier ~723 measured the fungible side alone. Verified the 1 XRD royalty is charged per call rather than per unit from the 7 Aug 2026 melt receipt, and measured usage: three transactions in 2026 against 58 in the two months after launch.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
