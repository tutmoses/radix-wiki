// Run 569 (contents/tech rotation): the disk-use figures and history-retention design
// flightofthefox gave in t.me/hyperscale_rs on 9 October 2026, banked by runs 559 and 562.
// Inserted as its own section after "Running a Node".
import { uid, isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-rs';
const SENTINEL = 'id="disk-use-and-history"';

const tg = (id, text) => `<a href="https://t.me/hyperscale_rs/${id}" target="_blank" rel="noopener">${text}</a>`;

const SECTION = `<h2 id="disk-use-and-history">Disk Use and History (October 2026)</h2>
<p>On 9 October 2026 flightofthefox ${tg(13405, 'published the first disk-use figures for a hyperscale-rs validator')} at production settings, with five-minute epochs, and called them ballpark: some measured, some back-of-envelope. A shard's storage does not grow with the age of the chain. A node keeps the shard's current state and roughly the last three hours of history, and prunes everything older automatically. Pruning is safe because ${tg(13411, 'shard blocks are checkpointed into the beacon chain')}, which keeps the chain of custody back to genesis.</p>
<table>
<thead><tr><th>Per shard</th><th>Size</th><th>Basis</th></tr></thead>
<tbody>
<tr><td>Current state</td><td>~355 bytes per account holding only the gas token, so ~355 MB per 1m accounts and ~35 GB per 100m</td><td>Measured against the real store; most of it is the Merkle tree, the balance itself is 64 bytes</td></tr>
<tr><td>Recent history: blocks, transactions and receipts for ~3 hours</td><td>~1 GB at a sustained 100 TPS, ~10 GB at 1,000 TPS</td><td>Estimate</td></tr>
<tr><td>Rolling snapshots that let a new validator sync into the shard, ~3 hours</td><td>A few GB, possibly tens under heavy load</td><td>The least certain figure, pending a soak test</td></tr>
</tbody>
</table>
<p>A busy shard with 100m accounts at 1,000 TPS would sit at roughly 60–100 GB and stay there; an idle shard is little more than its state. Two things grow. State grows with accounts and applications, though draining an account to zero frees its space and an oversized shard splits; storage bonding, which would charge for the ongoing use of state, is still to be implemented. The beacon chain keeps everything, at an estimated 15–130 MB a day (6–50 GB a year) depending on how many validators and shards there are. It is the one unbounded item, and embedding checkpoints in each software release would bound it. A vnode stores data only for the shard it is seated on, plus the beacon chain.</p>
<p>Later that day ${tg(13422, 'a channel member asked')} whether a transaction disappears after three hours. Flightofthefox ${tg(13426, 'answered')} that validators need no past transactions or receipts to validate the next block, only current state, and that on Babylon every node is functionally an archive node because it keeps all of them anyway. Under hyperscale-rs ${tg(13430, 'only entities that run a gateway or similar infrastructure')} would keep full history, in archive nodes he ${tg(13412, 'expects 2–3 entities to run')}, preferably on object storage such as S3; that design has not started and will be done alongside the gateway. Data an application must keep for years belongs in component state, where it is ${tg(13436, 'paid for per byte')} and ${tg(13437, 'secured by the state root')} that consensus checks. All of this describes the design, not shipped behaviour.</p>`;

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

  const nodeIdx = blocks.findIndex((b) => b.text?.startsWith('<h2>Running a Node</h2>'));
  if (nodeIdx < 0) throw new Error('Running a Node block not found');
  blocks.splice(nodeIdx + 1, 0, { id: uid(), type: 'content', text: SECTION });

  const version = await writeRevision(client, page, blocks, {
    change: 'minor',
    message: 'New section, Disk Use and History: the per-shard disk figures flightofthefox gave on 9 October 2026 (current state plus ~3 hours of history, ~60-100 GB for a busy shard, the beacon chain the one unbounded item) and the history-retention design (archive nodes only for gateway operators; long-lived data belongs in component state). hyperscale_rs 13405, 13411, 13412, 13422-13437, authorship verified at the embeds.',
    verified: true,
    dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
