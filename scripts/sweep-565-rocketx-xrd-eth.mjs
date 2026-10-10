// Sweep 565: at 09:28 UTC on 10 October 2026 Timan Rebel, who runs Astrolescent, posted in the main
// Radix group (t.me/radix_dlt/1007194, author confirmed through the embed view) that RocketX had
// re-enabled XRD <-> ETH trading, live on Astrolescent, limited to around 500 USD while some CEX pools
// stay offline, and that Hyperlane is expected back once the hUSDC recovery is complete. Recorded on
// /ecosystem/astrolescent (its funding section names RocketX) and on the Hyperlane drain page after the
// 9 Oct refund breakdown. Figures carry no dollar sign: the renderer reads one as maths.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const SENTINEL = 't.me/radix_dlt/1007194';
const SRC = `<a href="https://t.me/radix_dlt/1007194" target="_blank" rel="noopener">`;

const EDITS = [
  {
    tagPath: 'ecosystem', slug: 'astrolescent',
    from: `The project remains active and Rebel continues to run it.</p>`,
    to: `The project remains active and Rebel continues to run it. On 10 October he ${SRC}wrote in the main Radix group</a> that RocketX had re-enabled trading between XRD and ETH and that it was live on Astrolescent again, limited to around 500 US dollars while some of the exchange pools behind it stay offline. He expects the Hyperlane bridge back once the <a href="/contents/history/hyperlane-asset-drain-2026#gp3-breakdown" rel="noopener">hUSDC recovery</a> is complete.</p>`,
    change: 'patch',
    message: 'RocketX XRD-ETH trading re-enabled on Astrolescent from 10 Oct 2026, capped around 500 USD while some CEX pools stay offline; Hyperlane expected back after the hUSDC recovery. Source: Timan Rebel, t.me/radix_dlt/1007194.',
  },
  {
    tagPath: 'contents/history', slug: 'hyperlane-asset-drain-2026',
    from: `Nothing is paid until the collateral reaches a wallet the Foundation controls and is reissued as hUSDC.</p>`,
    to: `Nothing is paid until the collateral reaches a wallet the Foundation controls and is reissued as hUSDC.</p><p id="rocketx-reopen">The bridge stays closed while that happens. On 10 October Timan ${SRC}wrote</a> that <a href="https://www.rocketx.exchange/" target="_blank" rel="noopener">RocketX</a>, a cross-chain swap service, had re-enabled trading between XRD and ETH through <a href="/ecosystem/astrolescent" rel="noopener">Astrolescent</a>, limited to around 500 US dollars while some exchange pools stay offline, and that he expects Hyperlane back online once the hUSDC recovery is complete.</p>`,
    change: 'patch',
    message: 'Recovery section: RocketX re-enabled XRD-ETH trading through Astrolescent on 10 Oct 2026, capped around 500 USD; Hyperlane expected back after the hUSDC recovery (t.me/radix_dlt/1007194).',
  },
];

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(SENTINEL)) { console.log(`  ${page.title}: already applied – no write`); continue; }
    const hits = blocks.filter((b) => b.text?.includes(e.from));
    if (hits.length !== 1) throw new Error(`${e.slug}: matched ${hits.length} blocks`);
    hits[0].text = hits[0].text.replace(e.from, e.to);
    const version = await writeRevision(client, page, blocks, { change: e.change, message: e.message, verified: true, dry: DRY });
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  }
});
