// Sweep 586 (contents/resources): first review of the FAQ written on 12 Oct. Every
// countable fact checked against the DB, the ledger constants and the dashboard
// source; one claim had no source. The protocol's Validator.stake() takes any XRD
// bucket and the Radix Dashboard sets no floor, so the "minimum of 100 $XRD" (an
// echo of Olympia's 90 XRD minimum) goes, and the answer gains the one real gate:
// a validator can refuse delegated stake.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/resources';
const SLUG = 'faq';
const SRC = 'https://github.com/radixdlt/radixdlt-scrypto/blob/main/radix-engine/src/blueprints/consensus_manager/validator.rs';

const OLD = 'Delegating takes a minimum of 100 $XRD and is done through the <a href="https://dashboard.radixdlt.com/network-staking" target="_blank" rel="noopener">Radix Dashboard</a>.';
const NEW = `Delegating is done through the <a href="https://dashboard.radixdlt.com/network-staking" target="_blank" rel="noopener">Radix Dashboard</a>, and the protocol sets no minimum amount; the one gate is that a validator's owner can <a href="${SRC}" target="_blank" rel="noopener">close it to delegated stake</a>.`;
const SENTINEL = 'close it to delegated stake';

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) { console.log('  already applied, no write'); return; }
  const block = blocks.find((b) => b.text?.includes(OLD));
  if (!block) throw new Error('target sentence not found');
  block.text = block.text.replace(OLD, NEW);
  const version = await writeRevision(client, page, blocks, {
    change: 'patch', verified: true, dry: DRY,
    message: 'Resources sweep 586: first review of the FAQ. Removed the unsourced "minimum of 100 $XRD" to delegate: Validator.stake() in radixdlt-scrypto accepts any amount and the dashboard sets no floor; added that a validator can refuse delegated stake. Validator set (100), fee-increase delay (4,032 epochs), unstake delay (2,016 epochs), emission, fee split, edit thresholds and directory counts checked and correct.',
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
