// sweep 430 — ecosystem rotation, the two stalest ecosystem pages that had never been verified.
//
// 1. /ecosystem/ploughshare (v2.3.1, edited 3 August, last_verified_at null). Re-read 14 September 2026:
//    ploughshare.nz and www.ploughshare.nz both 200 / 6,368 B, title "Ploughshare is under maintenance"
//    (Cloudflare NS vita/lennon), the same holding page recorded on 3 August. ploughshare.srwa.io has no A
//    record. srwa.io 200 / 107,517 B still carries "Product Spotlight – New Zealand Dairy Farming Finance:
//    Ploughshare is a registered financial service provider in New Zealand, where SRWA provides the
//    technology behind tokenised lending and borrowing. www.ploughshare.nz". The demo youtu.be/Q4i78_dr1ug
//    resolves through oEmbed: "Ploughshare Demo | www.srwa.io | Nov 2023", author Nikola Sologub.
//    Defects fixed: the infobox Website row still read srwa.io although revision 2.3.0's own message said
//    it had been repointed to ploughshare.nz (metadata.website was, the body row was not); the body still
//    described the 2023 plan in the present tense ("aims to", "has already secured its early-stage
//    funding") and pointed readers to a "Tokenomics section" that does not exist. Unsourced 2023 claims
//    (early-stage funding secured, a fixed-supply draft, "orphan technologies") are dropped rather than
//    restated. The $XRD/$MOO pairing and the deployed XRD + xUSDC market are cited to /ecosystem/srwa,
//    which read them from the ledger on 11 August.
// 2. /ecosystem/p2p-lending (v1.1.2, never verified). Created by "Wiki pulse 2026-03-19" with no source for
//    the dApp. Its "Stokenet and Mainnet Path" section said the dApp "is currently on Stokenet" and the team
//    "is building toward a mainnet launch" (neither ever sourced), and described Stokenet as "closer to
//    mainnet conditions than previous Foundation-operated testnet environments" (unsourced). Stokenet was
//    reset to a fresh genesis on 29 August 2026, discarding every deployed package
//    (/contents/tech/releases/stokenet v1.12.0), so the present-tense deployment claim cannot stand.
//
// Run:  node scripts/sweep-430-ploughshare-p2p-lending.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const L = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;

function rep(block, from, to) {
  if (!block.text.includes(from)) throw new Error(`no match: ${from.slice(0, 80)}`);
  block.text = block.text.replace(from, to);
}

const EDITS = [
  {
    tagPath: 'ecosystem', slug: 'ploughshare', version: '2.4.0', changeType: 'minor', verified: true,
    sentinel: 'Ploughshare is under maintenance',
    message: 'Status re-read 14 September 2026: ploughshare.nz still serves the maintenance page first recorded on 3 August, and srwa.io still lists Ploughshare. Infobox Website row repointed to ploughshare.nz (revision 2.3.0 said it had been and it had not). The 2023 plan is now written as a plan, the dangling "Tokenomics section" reference is gone, and unsourced 2023 funding and supply claims are dropped.',
    apply(blocks) {
      const info = blocks.find((b) => b.type === 'infobox').blocks[0];
      rep(info,
        `🟠 Dormant as a standalone Radix dApp – its dedicated site (ploughshare.srwa.io) is offline and <a href="https://ploughshare.nz/" target="_blank" rel="noopener">ploughshare.nz</a> served a maintenance holding page when checked on 2026-08-03; the underlying tech is now delivered through <a href="/ecosystem/srwa" rel="noopener">SRWA</a>`,
        `🟠 Dormant – site under maintenance (checked 14 September 2026)`);
      rep(info,
        `<td><strong>Website</strong></td><td><a href="https://www.srwa.io" target="_blank" rel="noopener">srwa.io</a></td>`,
        `<td><strong>Website</strong></td><td>${A('https://ploughshare.nz/', 'ploughshare.nz')}</td>`);

      const body = blocks.find((b) => b.id === 'block-ploughshare-1');
      if (!body) throw new Error('ploughshare body block missing');
      body.text = [
        `<p><strong>Ploughshare</strong>, previously known as CowDAO, is a New Zealand farm-finance project built on the ${L('/ecosystem/srwa', 'SRWA')} real-world-asset protocol. ${A('https://srwa.io/', 'SRWA’s site')} describes it as a registered financial service provider in New Zealand for which SRWA supplies the technology behind tokenised lending and borrowing, with dairy-farming finance as the use case.</p>`,
        `<h2>The 2023 plan</h2>`,
        `<p>Ploughshare pitched itself to the Radix community in 2023 as an alternative lender for New Zealand farmers, at a time when it said banks were tightening terms and pulling back from agricultural technology. It concentrated on organic, non-GMO, pasture-based animal farming. The plan had three steps: start with DeFi-style lending and borrowing; add longer-term, mortgage-style loans at fixed rates with monthly instalments, the product most of its farmer clients already used; and hand decisions to a DAO.</p>`,
        `<p>SRWA co-founder Nikola Sologub published ${A('https://youtu.be/Q4i78_dr1ug', 'a Ploughshare demo')} on YouTube in November 2023.</p>`,
        `<h2>$MOO token</h2>`,
        `<p>The plan gave its token, $MOO, three jobs: raising money in a token sale, rewarding contributors and people using certain features, and carrying voting power in the DAO. Its supply and distribution were never finalised. SRWA’s lending design named $XRD and $MOO as the deposit tokens, but the market SRWA deployed on Radix mainnet runs $XRD and $xUSDC and pays no incentive token (${L('/ecosystem/srwa', 'SRWA')} records what the ledger holds).</p>`,
        `<h2>Status</h2>`,
        `<p>${A('https://ploughshare.nz/', 'ploughshare.nz')} has served a page titled “Ploughshare is under maintenance” since at least 3 August 2026, and still did on 14 September 2026. The project’s earlier site, ploughshare.srwa.io, no longer resolves. SRWA still lists Ploughshare as its New Zealand product and links ploughshare.nz, while SRWA’s own lending market on Radix has locked new deposits and borrows and stays open only for withdrawals and repayments.</p>`,
      ].join('\n');
    },
  },
  {
    tagPath: 'ecosystem', slug: 'p2p-lending', version: '1.2.0', changeType: 'minor', verified: false,
    sentinel: 'discarding every balance, transaction and deployed package',
    message: 'Stokenet section corrected: the 29 August 2026 reset discarded every package deployed to Stokenet before it, so "currently on Stokenet" cannot stand. Removed the unsourced mainnet-launch and "closer to mainnet conditions" claims, and stated that the entry names no address, repository or developer.',
    apply(blocks) {
      const info = blocks.find((b) => b.type === 'infobox').blocks[0];
      rep(info,
        `<tr><td><strong>Status</strong></td><td>Testnet (Stokenet)</td></tr>`,
        `<tr><td><strong>Status</strong></td><td>Testnet (Stokenet), unverified</td></tr>`);
      const stoke = blocks.find((b) => b.type === 'content' && b.text?.includes('<h2>Stokenet and Mainnet Path</h2>'));
      if (!stoke) throw new Error('Stokenet section missing');
      stoke.text = [
        `<h2>Stokenet</h2>`,
        `<p>The dApp was described as running on ${A('https://stokenet-dashboard.radixdlt.com/', 'Stokenet')}, Radix’s public test network, where apps run on test tokens that carry no value. This entry names no component address, repository or developer, so none of it can be checked on the ledger.</p>`,
        `<p>Any version deployed before 29 August 2026 no longer exists. That day Stokenet’s community operators ${L('/contents/tech/releases/stokenet', 'reset the network to a fresh genesis')}, discarding every balance, transaction and deployed package; account addresses and the network ID stayed the same. A developer who wants the dApp on Stokenet again has to redeploy it.</p>`,
      ].join('\n');
    },
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.tagPath}/${e.slug} is LOCKED`);
    const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.tagPath}/${e.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied, no write`);
      continue;
    }
    const blocks = JSON.parse(JSON.stringify(page.content));
    e.apply(blocks);
    const json = JSON.stringify(blocks);
    if (!json.includes(e.sentinel)) throw new Error(`${e.slug}: sentinel missing after apply`);
    console.log(`  ${DRY ? '[dry] ' : ''}${e.tagPath}/${e.slug}  v${page.version} -> v${e.version}  (${JSON.stringify(page.content).length} -> ${json.length} chars)`);
    if (DRY) continue;
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query(
      `UPDATE pages SET content = $1, version = $2, updated_at = $3${e.verified ? ', last_verified_at = $3' : ''} WHERE id = $4`,
      [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, e.changeType, AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  client.release();
  await pool.end();
}
