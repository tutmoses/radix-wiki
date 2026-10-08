// Sweep 556: Weft validator loses 131m XRD of delegated stake overnight, 7–8 Oct 2026.
// Source: radixscan validator read (live, 11:04 UTC 8 Oct, epoch 347,667) and the eleven
// ValidatorUnstake transactions against it between 16:29 UTC 7 Oct and 00:52 UTC 8 Oct.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'weft-finance';
const SENTINEL = 'p#weft-validator-exodus';
const ANCHOR = 'one who stays earns nothing until the node proposes again.</p>';
const TX = (id, label) => `<a href="https://dashboard.radixdlt.com/transaction/${id}/summary" target="_blank" rel="noopener">${label}</a>`;

const ADD = `<p id="${SENTINEL.slice(2)}">Most of them moved on 7 and 8 October. That afternoon a member <a href="https://t.me/WeftFinance/33000" target="_blank" rel="noopener">offered in Weft's Telegram group</a> to bring the node back online for the team, and otherwise asked it to unregister the node, and the operator of the retired <a href="/ecosystem/dexter" rel="noopener">DeXter</a> validator, which had just unregistered its own, <a href="https://t.me/radix_dlt/1006922" target="_blank" rel="noopener">suggested the same</a> in Radix DLT Official. Between ${TX('txid_rdx19ftyvx0346004cdj4yl4p6an0t9m3drvz3q37p2yhltegwep9mcs9g28l5', '16:29 UTC on 7 October')} and ${TX('txid_rdx1gnhpmy7ky6936ac80kkuvwqazyzykmj2a6j0cd6dtr7ft5453khsg4czhe', '00:52 UTC on 8 October')}, eleven accounts unstaked 111.9m stake units, about 131m $XRD at the unchanged rate of 1.174307 $XRD a unit. Read on-ledger at 11:04 UTC on 8 October (epoch 347,667), the node held 53.2m $XRD, down from 184.6m the day before. It was still registered, still accepting stake, and had made no proposals in the week to then.</p>`;

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL.slice(2)))) { console.log('  already applied – no write'); return; }
  const hits = blocks.filter((b) => b.text?.includes(ANCHOR));
  if (hits.length !== 1) throw new Error(`anchor matched ${hits.length} blocks`);
  hits[0].text = hits[0].text.replace(ANCHOR, ANCHOR + ADD);
  const version = await writeRevision(client, page, blocks, {
    change: 'minor',
    message: 'Validator section: 131m XRD unstaked from the offline Weft node between 16:29 UTC 7 Oct and 00:52 UTC 8 Oct (eleven ValidatorUnstake transactions); node at 53.2m XRD, still registered, 0% one-week uptime (radixscan, epoch 347,667).',
    verified: true, dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
