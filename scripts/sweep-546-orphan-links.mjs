// Sweep 546: three orphaned ecosystem pages (RadUp, StakingCoins, TopRadixNode) get an inbound link from the
// article that already names them; Radnode's partner list also links Radstakes and Avaunt Staking.
// TopRadixNode's label read from the Gateway 19:12 UTC 6 Oct 2026: "TopRadixNode | Impahla DAO official partner".
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const S = '[\\s\\u00a0]+';
const link = (slug, name) => `<a href="/ecosystem/${slug}" rel="noopener">${name}</a>`;
const DASH = 'https://dashboard.radixscan.io/network-staking/validator_rdx1svvnmmgdr6sl7llxc8sdu32ys7tn8v6k8quh7e6m6ec83fr3pf6d04';

const EDITS = [
  {
    tagPath: 'ecosystem', slug: 'radnode', sentinel: 'href="/ecosystem/radup"',
    from: new RegExp(`Radstakes,${S}RadUp,${S}Avaunt${S}Staking${S}and${S}Pica${S}Finance`),
    to: `${link('radstakes', 'Radstakes')}, ${link('radup', 'RadUp')}, ${link('avaunt-staking', 'Avaunt Staking')} and Pica Finance`,
    message: 'Linked the partner validators Radnode recommended (Radstakes, RadUp, Avaunt Staking) to their pages; RadUp had no inbound link.',
  },
  {
    tagPath: 'ideas', slug: 'dao-treasury-multisig-signers', sentinel: 'href="/ecosystem/stakingcoins"',
    from: /<td>Peachy · StakingCoins<\/td>/,
    to: `<td>Peachy · ${link('stakingcoins', 'StakingCoins')}</td>`,
    message: 'Linked the champion’s validator, StakingCoins, to its ecosystem page, which had no inbound link.',
  },
  {
    tagPath: 'ecosystem', slug: 'impahla', sentinel: 'href="/ecosystem/topradixnode"',
    from: /(escrow services, and a unique lending app centered around NFT as collateral\.)<\/p>/,
    to: `$1 One validator, ${link('topradixnode', 'TopRadixNode')}, still names itself an “Impahla DAO official partner” in its <a href="${DASH}" target="_blank" rel="noopener">on-ledger metadata</a>.</p>`,
    message: 'Added TopRadixNode, the validator whose on-ledger name carries “Impahla DAO official partner” (Gateway, 6 Oct 2026); it had no inbound link.',
  },
];

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(e.sentinel)) { console.log(`  ${e.slug}: already applied – no write`); continue; }
    const all = blocks.flatMap((b) => (b.type === 'infobox' ? b.blocks : [b]));
    const block = all.find((b) => b.type === 'content' && e.from.test(b.text ?? ''));
    if (!block) throw new Error(`${e.slug}: anchor not found`);
    block.text = block.text.replace(e.from, e.to);
    const version = await writeRevision(client, page, blocks, { change: e.slug === 'impahla' ? 'minor' : 'patch', message: e.message, dry: DRY });
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  }
});
