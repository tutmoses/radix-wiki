// sweep 433 – contents/history rotation. Four pages corrected against source, read 15 September 2026.
//
// 1. /contents/history/infrastructure-rfps (v1.2.1, 20 August). The page said no operator was selected
//    and the Foundation still ran the Gateway, Signalling Server and Connect Relay. The Foundation's
//    28 April 2026 post "Foundation Update: Moving to Maintenance Mode" says all three P1 services
//    transferred to a standalone operation run by its previous DevOps team, on the terms of their RFP
//    proposal (radixtalk.com/t/foundation-rfp-babylon-gateway/2202/25, shambu.xrd, 27 February), and are
//    pre-funded through the end of December 2026. Thread 2202: 38 posts, last 28 April 10:14 UTC
//    (LinkPool's full proposal); Magal36's posts are 25 and 27 April. RadixTalk t/2300 "Gateway future
//    discussion", Pawel_XRD, 18 May 2026, one post, no replies. babylon-gateway v1.10.7, 7 September
//    2026: PR #842 by 0xOmarA, merged by marek-kar, adds SystemVersion V4 and V5 to the Core API model;
//    previous release v1.10.6, 7 April 2026.
// 2. /contents/history/foohack (v2.3.0). Infobox said 14 June 2022; the announcement (5 May 2022) and
//    github.com/radixdlt/foo-hack both give 14-16 June. The page said each final board was minted as an
//    NFT and auctioned; the README says the auction blueprint is separate and linking the two "was the
//    plan". Match stream O3EMxDgIygo "FooHack Live Stream: The Chess Engine is Alive!" (oEmbed, Radix DLT).
// 3. /contents/history/radix-team-hackathon (v3.0.0). Carried the same NFT-auction claim about FooHack.
//    Rest re-read: blog 17 April 2019 ("beginning of this month", Peak District, 24 hours); follow-up posts
//    2 May, 30 May, 6 June 2019 all 200; no POS/Planner/CLI post in radixdlt.com/sitemap.xml;
//    github.com/radixdlt/DecentraSign 404.
// 4. /contents/history/scrypto-defi-challenge (v2.2.0). Figures re-checked on Devpost (434 participants,
//    20 Feb - 24 Mar 2023, prize split, Scrypto v0.8+, PR submission) and the 7-defi-devpost directory
//    (17 folders). Results post dated 18 April 2023. Scrypto called a language; a sentence of commentary
//    and a repeated prototypes sentence removed; intro prize pool written without the dollar sign.
//
// Run:  node scripts/sweep-433-history-rfps-foohack.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const L = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;

const MAINT = 'https://www.radixdlt.com/blog/foundation-update-moving-to-maintenance-mode';
const OPSTACK = 'https://www.radixdlt.com/blog/the-foundation-operational-stack-mapping-the-2026-transition';
const DEVOPS_POST = 'https://radixtalk.com/t/foundation-rfp-babylon-gateway/2202/25';
const FUTURE = 'https://radixtalk.com/t/gateway-future-discussion/2300';
const GW_1107 = 'https://github.com/radixdlt/babylon-gateway/releases/tag/v1.10.7';
const FOO_REPO = 'https://github.com/radixdlt/foo-hack';
const FOO_ANNOUNCE = 'https://www.radixdlt.com/blog/legendary-musician-redfoo-teams-up-with-radix-to-host-foohack';
const FOO_BLOG = 'https://www.radixdlt.com/blog/scrypto-is-as-smooth-as-vegan-butter';
const FOO_MATCH = 'https://www.youtube.com/watch?v=O3EMxDgIygo';
const SCRYPTO = '/contents/tech/core-protocols/scrypto-programming-language';

// Replace one exact substring; throw if it is absent, so a silent no-op cannot pass.
function swap(block, from, to) {
  if (!block.text.includes(from)) throw new Error(`block ${block.id}: text not found: ${from.slice(0, 80)}`);
  block.text = block.text.replace(from, to);
}
const byId = (blocks, id) => {
  const found = blocks.flatMap((b) => [b, ...(b.blocks ?? [])]).find((b) => b.id === id);
  if (!found) throw new Error(`block ${id} missing`);
  return found;
};

const EDITS = [
  {
    tagPath: 'contents/history', slug: 'infrastructure-rfps', version: '1.3.0', changeType: 'minor',
    sentinel: 'After the handover</h2>',
    excerpt: 'The Radix Foundation\'s February 2026 RFPs for the Gateway, Signalling Server and Connect Relay, and the April handover to its former DevOps team.',
    message: 'The page said no operator had been selected and the Foundation still ran the three services. The Foundation\'s 28 April 2026 maintenance-mode post says all three transferred to a standalone operation run by its previous DevOps team, on the terms of Shambu Pujar and Marek Karwacki\'s RFP proposal, pre-funded through December 2026. New section on what followed: the unanswered 18 May RadixTalk thread on maintaining the Gateway code, and Gateway v1.10.7 on 7 September.',
    apply(blocks) {
      swap(byId(blocks, '4e839788-87d8-4e7f-9258-95c350db9443'),
        '<tr><td><strong>Status (Aug 2026)</strong></td><td>Undecided — forum thread silent since 28 Apr 2026, no operator selected</td></tr>',
        '<tr><td><strong>Operator (Sep 2026)</strong></td><td>Shambu Pujar and Marek Karwacki, the former Foundation DevOps team, since April 2026</td></tr>\n<tr><td><strong>Funded to</strong></td><td>End of December 2026, pre-funded by the Foundation</td></tr>');

      swap(byId(blocks, 'bf93850e-740b-4dd8-a40d-c57797b60dc8'),
        '<p>In February 2026, the Radix Foundation issued three Requests for Proposals (RFPs) to hand off the operation of core network infrastructure to community operators. The three services – the <strong>Babylon Gateway</strong>, the <strong>Signalling Server</strong>, and the <strong>Connect Relay</strong> – have been operated centrally by the Foundation and are now being decentralized as part of the broader drive to reduce single points of failure in the Radix ecosystem.</p>',
        `<p>In February 2026 the Radix Foundation issued three Requests for Proposals (RFPs) asking outside operators to take over infrastructure it had always run itself: the <strong>Babylon Gateway</strong>, the <strong>Signalling Server</strong> and the <strong>Connect Relay</strong>. The Foundation was handing its responsibilities to the community ahead of winding itself down, and ${A(OPSTACK, 'its map of that transition')} labels these three P1 services. By the end of April all three had moved to a standalone operation run by the engineers who had operated them inside the Foundation, pre-funded by the Foundation to the end of December 2026.</p>`);

      const status = byId(blocks, '001086e4-7e90-4c91-869e-8e18b2f71d34');
      swap(status, '(Michael, 9 February 2026)</strong> — an', '(Michael, 9 February 2026)</strong>: an');
      swap(status, '(27 February 2026)</strong> — the', '(27 February 2026)</strong>: the');
      swap(status, '(1 March 2026)</strong> — the low-cost end', '(1 March 2026)</strong>: the low-cost end');
      swap(status, 'Hetzner bare metal — two AX42-U', 'Hetzner bare metal, with two AX42-U');
      swap(status, 'continuous backup — with maintenance', 'continuous backup, and maintenance');
      swap(status, '(23 and 28 April 2026)</strong> — the only', '(23 and 28 April 2026)</strong>: the only');
      swap(status,
        '<p>What the discussion did not produce is a decision, and the reason is that the body meant to make it does not exist yet. Adam_XRD stated at the outset that proposals would be voted on by the community; by the time LinkPool arrived in April, Magal36 told it that <strong>"the foundation won\'t be your customer, as it\'s dismantling, the community DAO is"</strong>, named the sitting members of the',
        '<p>The forum never reached a decision of its own. Adam_XRD had said at the outset that the community would vote on the proposals, but the body meant to hold that vote did not exist yet. When LinkPool offered to walk the Foundation through its pricing, Magal36 replied on 25 April that <strong>"the foundation won\'t be your customer, as it\'s dismantling, the community DAO is"</strong>, and on 27 April named the sitting members of the');
      swap(status, 'in February — that a multi-year', 'in February: that a multi-year');
      swap(status,
        '<p>The thread has been silent since 28 April 2026. No operator has been selected, no contract has been awarded, and the Foundation continues to run all three services in the meantime — which is the third of the three outcomes Adam_XRD set out in February, and the one that delays the handover.</p>',
        `<p>The decision came from the Foundation instead. On 28 April 2026, in the post announcing ${A(MAINT, 'its move to maintenance mode')}, it wrote that all three services had transferred to a standalone operation run by its previous DevOps team, on the pricing, service-level commitments and operating terms of ${A(DEVOPS_POST, 'the proposal Shambu Pujar and Marek Karwacki filed')} in February, and that it had pre-funded that operation through the end of December 2026. Because the same team was already running the services, the Foundation wrote, there was no handoff to an unknown operator and no gap in service. The forum thread has had no post since LinkPool published its full proposal on 28 April, and none records the award.</p>`);

      const why = byId(blocks, 'a95ef00e-e29a-4456-a772-9e487fe42721');
      swap(why, "If the Foundation's Gateway goes offline, the Radix Wallet and all Foundation-operated dApps lose ledger access.",
        'If the public Gateway goes offline, the Radix Wallet and every dApp that reads the ledger through it lose ledger access.');
      swap(why, '<p>The RFP model gives operators',
        '<p>The handover moved all three services to a single operator, so that concentration remains. The RFP model gives operators');

      const i = blocks.findIndex((b) => b.id === 'fe667a0f-c3fa-4938-b4aa-01d7a9d26340');
      if (i < 0) throw new Error('external links block missing');
      blocks.splice(i, 0, {
        id: 'b1f4c7a2-4e0d-4c1b-9d33-433a0f7e2c01',
        type: 'content',
        text: `<h2 id="after-the-handover">After the handover</h2>\n<p>Running the servers and maintaining the software are separate jobs, and the RFPs covered only the first. On 18 May 2026 Pawel_XRD, who had developed the Gateway at RDX Works and then at the Foundation, opened ${A(FUTURE, 'a second RadixTalk thread')} asking whether the community or the DAO wants anyone to keep maintaining the Gateway's code: dependency upgrades, compatibility with changes elsewhere in the ecosystem, bug fixes, performance work and new features. It had no replies as of 15 September 2026.</p>\n<p>The code still moves when the network needs it to. ${A(GW_1107, 'Gateway v1.10.7')}, released on 7 September 2026 while mainnet was halted after the ${L('/contents/history/hyperlane-asset-drain-2026', 'Hyperlane asset drain')}, adds two new values, V4 and V5, to the system version the Gateway reads from a node, so that it can parse a node reporting either. 0xOmarA wrote the change and Marek Karwacki merged it. It was the first Gateway release since v1.10.6 on 7 April.</p>\n<p>The funding runs to the end of December 2026. The Foundation's April post names the community DAO's legal entity as the one piece of its transition still missing, and says that once it exists, what comes next is the community's to shape.</p>`,
      });

      swap(blocks[i + 1],
        '<li><a href="/ecosystem/radix-foundation" rel="noopener">Radix Foundation</a></li>',
        `<li>${A(MAINT, 'Foundation Update: Moving to Maintenance Mode – Radix Blog (28 Apr 2026)')}</li>\n<li>${A(DEVOPS_POST, 'RadixTalk – Shambu Pujar and Marek Karwacki\'s P1 proposal (27 Feb 2026)')}</li>\n<li>${A(FUTURE, 'RadixTalk – Gateway future discussion (18 May 2026)')}</li>\n<li>${A(GW_1107, 'babylon-gateway v1.10.7 – GitHub')}</li>\n<li><a href="/ecosystem/radix-foundation" rel="noopener">Radix Foundation</a></li>`);
    },
  },
  {
    tagPath: 'contents/history', slug: 'foohack', version: '2.4.0', changeType: 'minor',
    sentinel: FOO_REPO,
    excerpt: 'A three-day hackathon at RedFoo\'s home above Malibu, 14 to 16 June 2022, where he and three Radix developers built on-ledger chess in Scrypto.',
    message: 'Dates corrected from 14 June to 14-16 June 2022, per the 5 May 2022 announcement and the radixdlt/foo-hack repository. The page said each finished game was minted as an NFT and auctioned; the repository README says the auction blueprint was separate and connecting the two was the plan. What was built now follows the README. Scrypto described as Radix\'s Rust SDK.',
    apply(blocks) {
      swap(byId(blocks, '80ea604e-31e5-409d-a3b0-587ce4cf7805'), '<td>14 June 2022</td>', '<td>14–16 June 2022</td>');
      swap(byId(blocks, '80ea604e-31e5-409d-a3b0-587ce4cf7805'),
        '<a href="https://www.radixdlt.com/blog/scrypto-is-as-smooth-as-vegan-butter" target="_blank" rel="noopener">Radix Blog Post</a>',
        `<a href="https://www.radixdlt.com/blog/scrypto-is-as-smooth-as-vegan-butter" target="_blank" rel="noopener">Radix Blog Post</a> ·\n      ${A(FOO_MATCH, 'Match live stream')} ·\n      ${A(FOO_REPO, 'Code (GitHub)')}`);

      swap(byId(blocks, 'b8cb44d3-2e0c-4510-913f-ec7b8ea4ad4a'),
        'was a three-day hackathon hosted in June 2022 by the multi-platinum musician',
        `was a three-day hackathon held ${A(FOO_ANNOUNCE, 'from 14 to 16 June 2022')} by the multi-platinum musician`);

      const bg = byId(blocks, '71e0d8e4-9171-442a-991f-e13d9de37f3a');
      swap(bg, ", Radix's asset-oriented smart-contract language.", ", Radix's Rust SDK for writing asset-oriented smart contracts.");
      swap(bg, 'and the four of them — dubbed the <strong>FooCrew</strong> — had,', 'and the four of them, dubbed the <strong>FooCrew</strong>, had,');
      swap(bg, 'been strangers the week before.</p>',
        `been strangers the week before. RDX Works ${A(FOO_ANNOUNCE, 'announced the event on 5 May 2022')}, paying the selected developers' travel and accommodation.</p>`);

      byId(blocks, '29367019-0aaa-4075-a41c-2f1e3a3891e2').text =
        `<h2>What Was Built</h2>\n<p>The FooCrew built <strong>Radichess</strong>, a chess game whose rules are enforced by Scrypto blueprints rather than by a game server. According to ${A(FOO_REPO, 'the repository\'s README')}, one component registers players and keeps the list of games, each game is its own component that players join and make moves in, and the board module validates every move and declares the winner at checkmate. Registering gives a player a badge resource in their wallet, which serves as their identity in the game. @jameswylie built the React frontend for creating, joining and spectating games and viewing a leaderboard; RockHoward, beemdvp and RedFoo worked on the Scrypto side. The two halves ran on the Public Test Environment, the temporary network RDX Works provided before a real test network existed. On the last day RedFoo played a live game against the community member Avaunt, streamed as ${A(FOO_MATCH, '"FooHack Live Stream: The Chess Engine is Alive!"')}.</p>\n<p>The auction did not ship with the game. RedFoo ${A(FOO_BLOG, 'took the auction components')}, and the repository holds a separate auction blueprint, but the README describes the link between the two, minting each finished game as an NFT and putting it up for auction, as the plan rather than as something built. The idea of chess on the ledger had first appeared as an internal experiment at the ${L('/contents/history/radix-team-hackathon', 'Radix Team Hackathon')} in 2019, where the rules were enforced through board and move Particles on the pre-Babylon ledger.</p>`;

      swap(byId(blocks, 'e2f797cd-1ddb-4ab1-b04e-4fe8b89178ec'),
        'RedFoo praised the Rust-based, asset-oriented language, coining the line', 'RedFoo praised Scrypto in the line');
    },
  },
  {
    tagPath: 'contents/history', slug: 'radix-team-hackathon', version: '3.0.1', changeType: 'patch',
    sentinel: "where each player's identity is a badge resource",
    message: 'FooHack did not mint and auction its chess games: the radixdlt/foo-hack README says connecting the auction blueprint to the game was the plan. Sentence corrected. The rest re-read against the 17 April 2019 post, the three follow-up posts, radixdlt.com\'s sitemap and the DecentraSign repository (still 404).',
    apply(blocks) {
      const b = byId(blocks, 'e15169dd-9438-4a42-bc83-a7a29cd435da');
      swap(b, 'rel="noopener">FooHack</a> — this time in', 'rel="noopener">FooHack</a>, this time in');
      swap(b, ', with the final board state minted as an NFT and auctioned, which the 2019 build had no resource model to do.',
        ", where each player's identity is a badge resource held in their wallet, which the 2019 build had no resource model to do.");
    },
  },
  {
    tagPath: 'contents/history', slug: 'scrypto-defi-challenge', version: '2.2.1', changeType: 'patch',
    sentinel: 'announced on 18 April 2023',
    excerpt: 'RDX Works\' five-week Devpost hackathon of February to March 2023: 434 registrants, 17 Scrypto DeFi entries, won by the flash-loan protocol FlashyFi.',
    message: 'Results date given as 18 April 2023, from the post. Scrypto described as Radix\'s Rust SDK rather than a language. A sentence of commentary and a repeated description of the entries as prototypes removed. Figures re-checked on Devpost and in the 7-defi-devpost directory (17 entries).',
    apply(blocks) {
      const intro = byId(blocks, 'b49782bf-fb2a-41e8-909f-c3524bbd82bb');
      swap(intro, 'Radix’s <a rel="noopener" class="link" href="/contents/tech/core-concepts/asset-oriented-programming">asset-oriented</a> smart-contract language.',
        'Radix’s Rust SDK for <a rel="noopener" class="link" href="/contents/tech/core-concepts/asset-oriented-programming">asset-oriented</a> smart contracts.');
      swap(intro, 'competing for a $50,000 XRD prize pool.', 'competing for prizes worth 50,000 US dollars, paid in XRD.');
      swap(byId(blocks, '789ed7c1-b8a0-4c07-9ad5-a821e3ff1936'), 'were announced in April 2023:', 'were announced on 18 April 2023:');
      const field = byId(blocks, 'f679b5db-3330-4d1d-919b-2eec45614260');
      swap(field, 'href="/contents/tech/core-concepts/asset-oriented-programming">asset-oriented</a> language.', 'href="/contents/tech/core-concepts/asset-oriented-programming">asset-oriented</a> toolkit.');
      swap(field, 'is the outlier — a proof of concept', 'is the outlier: a proof of concept');
      swap(field, ' That is the texture of a hackathon at the edge of a new language, and it is why the code was judged on "asset-oriented-ness" as much as on completeness.', '');
      swap(byId(blocks, 'be3fbd43-9e2b-4cf8-827b-a78e50a11be6'),
        ' The submissions were experimental prototypes published to the <a target="_blank" rel="noopener noreferrer" href="https://github.com/radixdlt/scrypto-challenges">scrypto-challenges</a> repository – early explorations of lending, perpetuals, stablecoins and DEX designs in an asset-oriented model – rather than production dApps.', '');
    },
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.tagPath}/${e.slug} is LOCKED`);
    const { rows } = await client.query('SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
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
    const metadata = e.excerpt && !page.metadata?.excerpt ? { ...(page.metadata ?? {}), excerpt: e.excerpt } : page.metadata;
    console.log(`  ${DRY ? '[dry] ' : ''}${e.tagPath}/${e.slug}  v${page.version} -> v${e.version}  (${JSON.stringify(page.content).length} -> ${json.length} chars)${metadata !== page.metadata ? '  +excerpt' : ''}`);
    if (DRY) continue;
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content = $1, version = $2, metadata = $3, updated_at = $4, last_verified_at = $4 WHERE id = $5',
      [json, e.version, JSON.stringify(metadata ?? {}), now, page.id]);
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
