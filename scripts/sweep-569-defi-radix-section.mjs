// Run 569 (contents/tech rotation): the "Radix: The Full Stack for DeFi" section of the DeFi page
// was 2023 marketing copy. It called Scrypto a language, carried an unsourced 12,000-developer
// figure, said Smart Accounts eliminate seed phrases, and described Cerberus as running on Radix.
// Rewritten to what ships on Babylon mainnet, with the sharded design in the conditional.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/tech/core-concepts';
const SLUG = 'decentralized-finance-defi';
const SENTINEL = 'id="defi-on-radix"';
const OLD_HEAD = '<h2><strong>Radix: The Full Stack for DeFi</strong></h2>';

const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const w = (path, text) => `<a href="${path}" rel="noopener">${text}</a>`;

const SECTION = `<h2 id="defi-on-radix">DeFi on Radix</h2>
<p>Radix is a layer-1 network whose design starts from DeFi, and four parts of its stack bear on the risks described above.</p>
<h3>${w('/contents/tech/core-protocols/radix-wallet', 'Radix Wallet')}</h3>
<p>The Radix Wallet shows a transaction as the assets that will be withdrawn from and deposited to the user's accounts, read from its ${a('https://docs.radixdlt.com/docs/manifest', 'transaction manifest')}, rather than as an opaque contract call; that removes the ${w('/contents/tech/core-concepts/blind-signing-and-transaction-manifests', 'blind signing')} behind many wallet-drain losses on other chains. Every account is a ${w('/contents/tech/core-protocols/smart-accounts', 'Smart Account')}, a component whose control rules can be moved to multi-factor control through an ${a('https://docs.radixdlt.com/docs/access-controller', 'access controller')} without moving its funds.</p>
<h3>${w('/contents/tech/core-protocols/scrypto-programming-language', 'Scrypto')} and the ${w('/contents/tech/core-protocols/radix-engine', 'Radix Engine')}</h3>
<p>Scrypto is Radix's Rust SDK for writing blueprints, and the Radix Engine is the execution environment that runs them. Tokens are ${a('https://docs.radixdlt.com/docs/resources', 'native resources')} held in vaults rather than balances inside a contract, so a DeFi component moves assets under the engine's own rules instead of reimplementing a token ledger, and needs no ${w('/contents/tech/core-concepts/native-assets-vs-token-approvals', 'token approvals')}. ${w('/contents/tech/core-concepts/asset-oriented-programming', 'Asset-oriented programming')} covers the model in full. Smart contracts went live on mainnet with the ${w('/contents/tech/releases/radix-mainnet-babylon', 'Babylon')} upgrade on 28 September 2023.</p>
<h3>Consensus</h3>
<p>Babylon mainnet runs ${w('/contents/tech/core-protocols/cerberus-consensus-protocol', 'Cerberus')} in an unsharded configuration, which the node software describes as ${a('https://github.com/radixdlt/babylon-node#readme', 'a variant of the HotStuff BFT protocol')}. The sharded design, under which transactions on different shards would execute in parallel and keep ${w('/contents/tech/core-concepts/atomic-composability', 'atomic composability')}, has not shipped. Linear scaling is the aim of the Xi'an upgrade, whose leading candidate implementation, ${w('/contents/tech/research/hyperscale-rs', 'hyperscale-rs')}, does not use Cerberus.</p>`;

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied – no write');
    return;
  }

  const body = blocks.find((b) => b.text?.includes(OLD_HEAD));
  if (!body) throw new Error('Radix section not found');
  const start = body.text.indexOf(OLD_HEAD);
  const next = body.text.indexOf('<h2', start + OLD_HEAD.length);
  const old = body.text.slice(start, next < 0 ? undefined : next);
  if (!old.includes('Cerberus</a>: A New Standard')) throw new Error('unexpected section shape');
  body.text = body.text.slice(0, start) + SECTION + (next < 0 ? '' : body.text.slice(next));
  console.log(`  replacing ${old.length} chars with ${SECTION.length}; tail after section: ${next < 0 ? 'none' : body.text.length - start - SECTION.length}`);

  const version = await writeRevision(client, page, blocks, {
    change: 'minor',
    message: 'Rewrote the Radix section (was "Radix: The Full Stack for DeFi", 2023 marketing copy): Scrypto is a Rust SDK, not a language; dropped the unsourced 12,000-developer figure and the claim that Smart Accounts eliminate seed phrases; Babylon runs unsharded Cerberus, a HotStuff variant per the babylon-node README, and the sharded design has not shipped. Sources: docs.radixdlt.com manifest, resources and access-controller pages.',
    dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
