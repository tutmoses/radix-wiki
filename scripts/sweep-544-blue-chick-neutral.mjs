// Sweep 544: /ecosystem/blue-chick-nfts was the project's own 30 May 2023 Medium post pasted in the first person
// ("We believe...", "Juicy, right?"), under an advertisement banner, with no infobox, and its website link
// pointed at a November 2024 Wayback capture that holds no content. Rewritten as a neutral record from the three
// Medium posts (feed read 6 Oct 2026) and the 30 Sep 2023 Wayback capture, which still read "mint soon on Foton"
// beside a waitlist. That capture also names Foton, so this page now links /ecosystem/foton, orphaned since the
// 1 Oct status-index deletion.
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'blue-chick-nfts';
const SENTINEL = 'web/20230930161210';
const DRY = process.argv.includes('--dry-run');

const M = 'https://medium.com/@blue.chick.nfts';
const WHAT = `${M}/what-the-f-are-the-blue-chick-nfts-bf5fd5128db9`;
const DAO = `${M}/the-mighty-chick-dao-empowering-nft-holders-to-shape-the-future-of-the-blue-chick-project-5e2880ae0ac3`;
const ROADMAP = `${M}/roadmap-v-1-0-13a6b544344f`;
const SITE_2023 = 'https://web.archive.org/web/20230930161210/http://bluechicknfts.wtf/';
const SITE_2024 = 'https://web.archive.org/web/20241108170251/http://bluechicknfts.wtf/';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const INFOBOX = `<table> <tr><td><strong>Project</strong></td><td>Blue Chick NFTs</td></tr> <tr><td><strong>Type</strong></td><td>NFT collection and planned PvP game</td></tr> <tr><td><strong>Network</strong></td><td>Radix</td></tr> <tr><td><strong>Planned supply</strong></td><td>9,999 (Genesis mint)</td></tr> <tr><td><strong>Planned venue</strong></td><td><a href="/ecosystem/foton" rel="noopener">Foton</a></td></tr> <tr><td><strong>Governance</strong></td><td>Mighty Chick DAO (planned)</td></tr> <tr><td><strong>Status</strong></td><td>🟠 Dormant – last announcement June 2023</td></tr> <tr><td><strong>Website</strong></td><td>bluechicknfts.wtf (offline; ${ext(SITE_2023, 'archived 30 Sep 2023')})</td></tr> </table>`;

const BODY = `<p><strong>Blue Chick NFTs</strong> was a Radix NFT project announced in 2023. It planned a collection of 9,999 procedurally generated "chick" <a href="/contents/tech/core-protocols/nfts-on-radix" rel="noopener">NFTs</a>, a player-versus-player artillery tactics game in which each holder would field a platoon of five chicks, and a holder DAO called the Mighty Chick DAO. Its ${ext(WHAT, 'introductory post')} appeared on Medium on 30 May 2023.</p><h2>Announced design</h2><p>Each chick's traits were to decide which weapons it received by airdrop, and holders were to be able to let other players recruit their chicks in return for a share of the winnings. Every chick from the Genesis mint was to carry a vote in the DAO, which would hold the project's assets and organise tournaments.</p><p>The ${ext(DAO, 'DAO post')} of the same day set out four sources of treasury funding: 20% of the Genesis mint proceeds, up to 90% of the proceeds of later collections with a stated target of 100%, royalties on secondary sales, and returns from DeFi strategies run on the treasury itself. A ${ext(ROADMAP, 'Roadmap v1.0')} followed on 10 June 2023, describing itself as subject to change and to the DAO's decisions.</p><h2>Status</h2><p>Neither the website nor the Medium account records a mint. The last archived capture of the site, from ${ext(SITE_2023, '30 September 2023')}, still advertised the mint as coming soon on <a href="/ecosystem/foton" rel="noopener">Foton</a>, the Radix NFT marketplace, beside a waitlist form. The Medium account has published nothing since the June 2023 roadmap, and by November 2024 the domain served no content (${ext(SITE_2024, 'archived capture')}).</p><h2>External links</h2><ul><li>${ext(M, 'Blue Chick NFTs on Medium')}</li><li>${ext('https://discord.com/invite/SHVcwHKUNG', 'Discord')}</li><li>${ext('https://x.com/blueChickNFTs', '@blueChickNFTs on X')}</li><li>${ext(SITE_2023, 'bluechicknfts.wtf (archived)')}</li></ul>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  if (JSON.stringify(page.content).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }
  if (page.content.length !== 2 || page.content[0].type !== 'banner' || page.content[1].id !== 'block-blue-chick-nfts-1') throw new Error('block layout changed');
  const blocks = [
    { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: INFOBOX }] },
    { ...page.content[1], text: BODY },
  ];
  const metadata = { ...page.metadata, website: SITE_2023 };
  const version = '2.0.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}; ${BODY.length} chars`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, metadata=$2, version=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5', [json, JSON.stringify(metadata), version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'major', AUTHOR_ID,
        'Sweep 544: replaced the pasted first-person Medium post and its advertisement banner with a neutral record: infobox, announced design, and a Status section sourced to the three Medium posts (30 May and 10 Jun 2023) and the 30 Sep 2023 Wayback capture, which still advertised the mint as coming soon on Foton. Website link moved from an empty Nov 2024 capture to the 2023 one; links Foton.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
