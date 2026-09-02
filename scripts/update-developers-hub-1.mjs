// scripts/update-developers-hub-1.mjs
//
// Folds `developers/radix-developer-resources` into the Developers hub article
// (`developers/''`) and deletes the standalone page, then repoints its inbound
// links. The section index on /developers now lists all 33 tutorials, so a
// single directly-filed page sitting under "Pages in Developers" was the whole
// listing — and the resource lists it carried belong on the hub itself.
//
// Dropped in the merge: the expired Stokenet-reset callout (the reset happened
// on 29 August 2026 and `contents/tech/releases/stokenet` records it in the past
// tense), the lead paragraph and Quick Start block (both restate the section
// index), and the Starter Pack list (its items survive in the lists below).

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'developers';
const OLD_SLUG = 'radix-developer-resources';
const SENTINEL = 'id="developer-resources-merged"';

const A = (href, text) => `<a target="_blank" rel="noopener noreferrer" class="link" href="${href}">${text}</a>`;
const W = (href, text) => `<a class="link" href="${href}" rel="noopener">${text}</a>`;
const li = (html) => `<li><p>${html}</p></li>`;

const whereToStart = `<h2>Where to start</h2>
<p><a href="/developers/getting-started/01-install-scrypto" rel="noopener">Getting started</a> installs the toolchain, writes a first blueprint and deploys it to <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> and then mainnet. Everything after it is listed by section below, and the order within each section is the order to read it in.</p>
<p>Two of those sections repay attention out of proportion to their length. Manifests are worth real time: a Radix transaction states what it intends to do in a form the wallet can show a user before they sign it, which is why the <a href="/developers/transactions/01-manifest-language" rel="noopener">transactions series</a> starts with the language rather than the API. And <a href="/developers/frontend/03-rola-authentication" rel="noopener">ROLA</a> is the wallet-signature login this wiki itself runs on, so the front-end series describes something you are already using.</p>`;

const documentation = `<h2 ${SENTINEL}>Official documentation</h2>
<ul>
${li(`${A('https://docs.radixdlt.com/docs', 'Radix Technical Documentation')} &ndash; the canonical docs site for the entire stack.`)}
${li(`${A('https://docs.radixdlt.com/docs/learning-step-by-step', 'Scrypto: Learning Step-by-Step')} &ndash; from first blueprint to full dApp.`)}
${li(`${A('https://github.com/radixdlt/official-examples', 'Official code examples')} and ${A('https://github.com/radixdlt/community-scrypto-examples', 'community Scrypto examples')} &ndash; working blueprints to read and adapt.`)}
${li(`${A('https://docs.radixdlt.com/docs/engine-tech-docs', 'Radix Engine')} &ndash; the asset-oriented state machine that runs transactions.`)}
${li(`${A('https://docs.radixdlt.com/docs/dapp-toolkit', 'Radix dApp Toolkit')} &ndash; Connect Button, Wallet SDK, and Gateway SDK in one interface.`)}
${li(`${A('https://docs.radixdlt.com/docs/rola-radix-off-ledger-auth', 'ROLA (Radix Off-Ledger Auth)')} &ndash; prove wallet ownership for login.`)}
${li(`${A('https://docs.radixdlt.com/docs/radix-engine-toolkit', 'Radix Engine Toolkit')} &ndash; manifest construction, SBOR, and address derivation.`)}
${li(`${A('https://docs.radixdlt.com/docs/network-apis', 'Network APIs')} &ndash; Gateway, Core, and System API overview.`)}
${li(`${W('/contents/tech/core-protocols/radix-wallet', 'Radix Wallet')} &ndash; wiki reference for the Babylon wallet.`)}
</ul>
<h3>API specifications</h3>
<ul>
${li(`${A('https://docs.radixdlt.com/api-reference/gateway-api-specs.html', 'Gateway API')} &ndash; read aggregated ledger state and submit transactions (${A('https://mainnet.radixdlt.com/swagger/', 'mainnet Swagger')}).`)}
${li(`${A('https://docs.radixdlt.com/api-reference/core-api-specs.html', 'Core API')} &ndash; full-node API for integrators and the <code>/stream/transactions</code> event stream.`)}
${li(`${A('https://docs.radixdlt.com/api-reference/system-api-specs.html', 'System API')} &ndash; node operations and health.`)}
</ul>`;

const sdks = `<h2>SDKs and libraries</h2>
<ul>
${li(`${A('https://github.com/radixdlt/radix-dapp-toolkit', 'Radix dApp Toolkit')} &ndash; the recommended front-end integration library (Connect Button + SDKs).`)}
${li(`${A('https://www.npmjs.com/package/@radixdlt/babylon-gateway-api-sdk', 'Gateway API SDK (npm)')} &ndash; typed JS/TS client for the Gateway.`)}
${li(`${A('https://www.npmjs.com/package/@radixdlt/babylon-core-api-sdk', 'Core API SDK (npm)')} &ndash; typed JS/TS client for the Core API.`)}
${li(`${A('https://www.npmjs.com/package/@radixdlt/rola', 'ROLA (npm)')} &ndash; verify Radix Off-Ledger Auth signatures server-side.`)}
${li(`${A('https://docs.rs/scrypto/latest/scrypto/index.html', 'scrypto')} / ${A('https://docs.rs/scrypto-test/latest/scrypto_test/', 'scrypto-test')} / ${A('https://docs.rs/radix-engine/latest/radix_engine/', 'radix-engine')} &ndash; Rust crates on docs.rs.`)}
${li(`${W('/developers/infrastructure/radixdlt-rust-sdk', 'Radix Rust SDK')} (${A('https://github.com/genkipool/radixdlt-rust-sdk', 'GitHub')}) &ndash; pure-Rust off-ledger primitives: ROLA auth, address derivation, keystores, and Radix Connect over WebRTC and iroh/QUIC.`)}
${li(`${W('/developers/tools/radix-web3-js', 'radix-web3.js')} (${A('https://github.com/xstelea/radix-web3.js', 'GitHub')}) &ndash; a nine-package community TypeScript suite built on Effect: core client, Gateway client, wallet connect, transaction and streaming helpers, an ${A('https://xstelea.github.io/radix-web3.js/sbor', 'SBOR &ldquo;ez mode&rdquo;')} schema builder, and the agent-first ${A('https://www.npmjs.com/package/rdx-cli', 'rdx-cli')}.`)}
${li(`${A('https://chromewebstore.google.com/detail/radix-wallet-connector/bfeplaecgkoeckiidkgkmlllfbaeplgm', 'Radix Wallet Connector')} &ndash; browser extension that bridges dApps to the wallet.`)}
</ul>
<h3>Scrypto crates</h3>
<ul>
${li(`${A('https://github.com/ociswap/scrypto-math', 'scrypto-math')} &ndash; high-precision math (exp, ln, pow) for Scrypto.`)}
${li(`${A('https://github.com/ociswap/scrypto-avltree', 'scrypto-avltree')} &ndash; an on-ledger AVL tree data structure.`)}
${li(`${W('/contents/tech/core-protocols/rrc-404', 'RRC-404')} (${A('https://github.com/aus87/ice_rrc404v1', 'ice_rrc404v1')}) &ndash; a hybrid fungible/non-fungible token standard for Radix, with a reference implementation in Scrypto.`)}
</ul>`;

const tools = `<h2>Community tools and explorers</h2>
<p>As the ${W('/ecosystem/radix-foundation', 'Radix Foundation')} winds down, much developer infrastructure is now community-hosted. The following are actively maintained; the ${W('/developers/tools', 'Tools')} section covers several of them at length.</p>
<ul>
${li(`${A('https://console.radixscan.io/', 'RadixScan Console')} &ndash; developer console and step-by-step ${A('https://console.radixscan.io/manifest-builder', 'Manifest Builder')} that sends transactions straight to your wallet (switches between Mainnet and Stokenet).`)}
${li(`${A('https://dashboard.radixscan.io/', 'RadixScan Dashboard')} &ndash; account, resource, and transaction explorer.`)}
${li(`${A('https://radix-community.genkipool.com/', 'GenkiPool Community Tools')} &ndash; wallet connection, batched transactions, and one-transaction staking/unstaking across multiple validators.`)}
${li(`${A('https://shardspace.app/', 'ShardSpace')} &ndash; create and manage dApp definitions (Mainnet and Stokenet).`)}
${li(`${W('/developers/tools/instruct', 'Instruct')} (${A('https://instruct.radixbillboard.com/', 'app')}) &ndash; visual transaction manifest builder for Mainnet and Stokenet, from The Radix Billboard team.`)}
${li(`${W('/developers/tools/hookah', 'Hookah')} (${A('https://github.com/xstelea/hookah', 'GitHub')}) &ndash; a self-hostable Radix event-monitoring and webhook-delivery platform (MIT-licensed): register triggers on on-ledger events and receive webhook callbacks when matching events appear in the transaction stream. Runs as a hosted service at ${A('https://hookah.ing', 'hookah.ing')}.`)}
${li(`${W('/developers/tools/radix-desktop-tool', 'Radix Desktop Tool')} (${A('https://github.com/atlantis-l/Radix-Desktop-Tool', 'GitHub')}) &ndash; open-source MIT desktop utility for batched single&rarr;multiple and multiple&rarr;multiple token transfers.`)}
</ul>
<h3>For agents</h3>
<p>The ${W('/developers/ai-agents', 'AI Agents')} section covers the wiki&rsquo;s own coverage of this; these are the endpoints and indexes themselves.</p>
<ul>
${li(`${A('https://ai.radixscan.io/', 'RadixScan Agent Layer')} &ndash; keyless ${A('https://ai.radixscan.io/llms.txt', 'MCP server')} for reading the ledger and building, validating, and simulating manifests (non-custodial; signing happens in the wallet).`)}
${li(`${W('/contents/resources/mcp-server', 'RADIX.wiki MCP Server')} &ndash; this wiki&rsquo;s own keyless MCP endpoint at <code>radix.wiki/api/mcp</code>, plus <code>llms.txt</code>, markdown twins and a ROLA-gated write path.`)}
${li(`${A('https://github.com/xstelea/awesome-radix-mcp-servers', 'Awesome Radix MCP Servers')} &ndash; curated index of Radix MCP servers.`)}
${li(`${A('https://x402.org/', 'x402')} &ndash; the open HTTP-402 payment standard for AI agents and APIs; multi-chain ${A('https://github.com/xstelea/x402', 'implementation')} with Radix support in development.`)}
</ul>`;

const hyperscale = `<h2>Hyperscale (Xi&rsquo;an)</h2>
<p>Hyperscale is the in-progress sharded execution layer for Radix&rsquo;s Xi&rsquo;an release, written in Rust, and the most active area of protocol development. It is expected to run a purpose-built VM written from scratch rather than a sharded ${W('/contents/tech/core-protocols/radix-engine', 'Radix Engine')}, with the migration cost for existing dApps put at ${A('https://t.me/hyperscale_rs/10346', 'best case a recompile, worst case an automatic source transpiler')}. The wiki&rsquo;s account is at ${W('/contents/tech/research/hyperscale-rs', 'hyperscale-rs')}.</p>
<ul>
${li(`${A('https://github.com/hyperscalers/hyperscale-rs', 'hyperscale-rs')} &ndash; the implementation, including the POLARIS leaderless BFT beacon-chain prototype.`)}
${li(`${A('https://pprogrammingg.github.io/web3_modules/hyperscale/index.html', 'Web3 Modules: Hyperscale')} &ndash; community learning notes on the architecture.`)}
${li(`${A('https://github.com/leomagal/Learn-Hyperscale-rs', 'Learn-Hyperscale-rs')} &ndash; community guides and flowcharts for Rust and distributed systems with Hyperscale-RS.`)}
</ul>`;

const community = `<h2>Community and funding</h2>
<ul>
${li(`${A('https://t.me/RadixDevelopers', 'Radix Developer Discussion')} on Telegram &ndash; where protocol and tooling questions actually get answered.`)}
${li(`${A('https://discord.com/channels/417762285172555786/968472959763243068', 'Official Discord')} &ndash; the developer channel.`)}
${li(`${W('/contents/history/radix-ecosystem-funding', 'Radix ecosystem funding')} &ndash; grant programmes, past and present, and how to apply.`)}
</ul>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
const now = new Date().toISOString();

const writeRevision = async (page, content, version, changeType, message) =>
  client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, JSON.stringify(content), page.title, version, changeType, AUTHOR_ID, message, now],
  );

const bump = (version, kind) => {
  const [maj, min, patch] = version.split('.').map(Number);
  return kind === 'major' ? `${maj + 1}.0.0` : kind === 'minor' ? `${maj}.${min + 1}.0` : `${maj}.${min}.${patch + 1}`;
};

try {
  if (isLockedPage(TAG, '') || isLockedPage(TAG, OLD_SLUG)) throw new Error('locked page');

  const { rows } = await client.query(
    `SELECT id, slug, title, version, content, banner_image FROM pages WHERE tag_path = $1 AND slug IN ('', $2)`,
    [TAG, OLD_SLUG],
  );
  const hub = rows.find(r => r.slug === '');
  const old = rows.find(r => r.slug === OLD_SLUG);
  if (!hub) throw new Error('developers hub not found');

  if (JSON.stringify(hub.content).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }
  if (!old) throw new Error(`${OLD_SLUG} not found — merge source is gone but the hub is unmerged`);

  // 1. Hub: infobox (+ the old page's video), the prose that survives, then the
  //    resource directory the old page was.
  const hubBlocks = JSON.parse(JSON.stringify(hub.content));
  const infobox = hubBlocks.find(b => b.type === 'infobox');
  if (!infobox) throw new Error('hub infobox not found');
  const oldVideo = old.content
    .find(b => b.type === 'infobox')?.blocks
    ?.find(b => typeof b.text === 'string' && b.text.includes('data-youtube-video'));
  // Hero embeds live at the end of infobox.blocks, below the metadata table.
  if (oldVideo && !JSON.stringify(infobox).includes('data-youtube-video')) {
    infobox.blocks.push({ id: uid(), type: 'content', text: oldVideo.text });
  }

  const keep = (heading) => {
    const block = hubBlocks.find(b => b.type === 'content' && b.text?.includes(`<h2>${heading}</h2>`));
    if (!block) throw new Error(`hub block "${heading}" not found`);
    return block;
  };
  const merged = [
    infobox,
    keep('Introduction'),
    { id: uid(), type: 'content', text: whereToStart },
    keep('Agents'),
    keep('What to expect'),
    ...[documentation, sdks, tools, hyperscale, community].map(text => ({ id: uid(), type: 'content', text })),
  ];

  const hubVersion = bump(hub.version, 'major');
  console.log(`  ${DRY ? '[dry] ' : ''}${hub.title}  v${hub.version} -> v${hubVersion}  (${hub.content.length} -> ${merged.length} blocks)`);
  console.log(`  ${DRY ? '[dry] ' : ''}delete ${TAG}/${OLD_SLUG} (${old.content.length} blocks), banner -> hub`);

  // 2. Inbound links. The blog post's two anchors name external courses and are
  //    left as text; only the href moves.
  const { rows: linking } = await client.query(
    `SELECT id, tag_path, slug, title, version, content FROM pages
     WHERE content::text LIKE $1 AND NOT (tag_path = $2 AND slug = $3) AND tag_path <> 'contents/tech/operations'
     ORDER BY tag_path, slug`,
    [`%/${TAG}/${OLD_SLUG}%`, TAG, OLD_SLUG],
  );
  const repoint = (html) => html
    .replace(/href="\/developers\/radix-developer-resources"/g, 'href="/developers"')
    .replace(/(<a[^>]*href="\/developers"[^>]*>)(?:Radix )?Developer Resources(<\/a>)/g, '$1Building on Radix$2');
  const relinked = linking.map(page => {
    const content = JSON.parse(JSON.stringify(page.content));
    const walk = (blocks) => blocks?.forEach(b => {
      if (b.type === 'infobox') return walk(b.blocks);
      if (b.type === 'columns') return b.columns?.forEach(c => walk(c.blocks));
      if (typeof b.text === 'string') b.text = repoint(b.text);
    });
    walk(content);
    return { page, content };
  });
  relinked.forEach(({ page }) => console.log(`  ${DRY ? '[dry] ' : ''}relink ${page.tag_path}/${page.slug}  v${page.version} -> v${bump(page.version, 'patch')}`));

  if (DRY) process.exit(0);

  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content=$1, version=$2, banner_image=COALESCE(banner_image, $3), updated_at=$4 WHERE id=$5',
    [JSON.stringify(merged), hubVersion, old.banner_image, now, hub.id],
  );
  await writeRevision({ id: hub.id, title: hub.title }, merged, hubVersion, 'major',
    'Fold Radix Developer Resources into this hub: documentation, SDKs, community tools, Hyperscale and funding move here, and the standalone page is deleted. The expired Stokenet-reset callout is dropped (contents/tech/releases/stokenet records the reset), as are the lead and Quick Start blocks the section index now covers.');

  for (const { page, content } of relinked) {
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4',
      [JSON.stringify(content), bump(page.version, 'patch'), now, page.id]);
    await writeRevision(page, content, bump(page.version, 'patch'), 'patch',
      'Repoint /developers/radix-developer-resources at /developers, which absorbed it.');
  }

  await client.query('DELETE FROM pages WHERE id=$1', [old.id]);
  await client.query('COMMIT');
  console.log('  committed');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
