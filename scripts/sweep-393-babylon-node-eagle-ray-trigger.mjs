import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 393, contents/tech rotation, the sibling half of
// sweep-393-protocol-updates-infobox.mjs. This page's body documents
// v1.4.0.0-RC1 and PR #1076 at length while its infobox still named v1.3.0.5 as
// the latest release and stopped the protocol line at Cuttlefish. Its table of
// mainnet enactment triggers listed the three readiness-signalled updates and
// nothing else, under a sentence promising "the three mainnet updates
// configured so far" - there are now five entries, and the newest one does not
// use readiness signalling at all.

const TAG_PATH = 'contents/tech/core-protocols';
const SLUG = 'babylon-node';
const SENTINEL = 'id="eagle-ray-trigger"';
const DRY = process.argv.includes('--dry-run');

const ROWS = [
  [/<tr><th>Latest release<\/th><td>[\s\S]*?<\/td><\/tr>/,
   '<tr><th>Latest release</th><td><a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1" target="_blank" rel="noopener">v1.4.0.0-RC1</a>, 8 September 2026 &ndash; a pre-release carrying the Eagle Ray protocol change, so the repository’s <a href="https://api.github.com/repos/radixdlt/babylon-node/releases/latest" target="_blank" rel="noopener">latest release</a> still resolves to v1.3.0.5-test.1</td></tr>'],
  [/<tr><th>Protocol line<\/th><td>[\s\S]*?<\/td><\/tr>/,
   '<tr><th>Protocol line</th><td>v1.0.0 Genesis &middot; v1.1.0 Anemone &middot; v1.2.0 Bottlenose &middot; v1.3.0 Cuttlefish &middot; v1.4.0 Eagle Ray (released, not enacted)</td></tr>'],
];

const OLD_LEAD = 'The three mainnet updates configured so far, with the node release each shipped in:';
const NEW_LEAD = 'The mainnet updates configured so far, with the node release each shipped in:';

const NEW_ROWS =
  '<tr><td>Cuttlefish part 2</td><td>v1.3.0</td><td>None &ndash; <code>EnactImmediatelyAfterEndOfProtocolUpdate</code></td><td>Follows Cuttlefish</td><td>None</td></tr>'
  + '<tr><td>Eagle Ray</td><td>v1.4.0.0-RC1</td><td>None &ndash; <code>EnactAtStartOfEpochUnconditionally</code></td><td>339898</td><td>None</td></tr>';

const OLD_CONSEQ = 'The consequence for a reader watching for an upgrade is precise: until a node release exists that contains a protocol version, there is nothing for a validator to signal, and therefore no readiness figure to watch.';
const NEW_CONSEQ = 'The consequence for a reader watching for an upgrade is precise: until a node release exists that contains a protocol version, there is nothing for a validator to signal, and therefore no readiness figure to watch. For Eagle Ray there is no readiness figure to watch at all.';

const PARA =
  '<p id="eagle-ray-trigger">Eagle Ray is the first mainnet entry that does not use readiness signalling, and the reason is that a halted network cannot produce one. A threshold is met only after a number of <em>completed</em> epochs of support, and mainnet has completed none since 31 August 2026, so an update whose purpose is to end that halt could never clear one. <a href="https://github.com/radixdlt/babylon-node/blob/main/core-rust/state-manager/src/protocol/protocol_configs/mainnet_protocol_config.rs" target="_blank" rel="noopener">The mainnet protocol configuration</a> released in v1.4.0.0-RC1 gives it <code>EnactAtStartOfEpochUnconditionally</code> at epoch 339,898 instead, and adds a second mechanism the node did not previously have: a <code>UserTransactionMoratorium</code> covering the single epoch 339,897, defined in <a href="https://github.com/radixdlt/babylon-node/blob/main/core-rust-bridge/src/main/java/com/radixdlt/protocol/UserTransactionMoratorium.java" target="_blank" rel="noopener">the node source</a> as <q>an epoch range during which user transactions are refused</q>, and commented in the configuration as belonging to the <q>Mainnet incident of 1 September 2026</q>. Consensus therefore restarts one epoch before the new rules do. <a href="https://github.com/radixdlt/babylon-node/blob/main/core-rust/state-manager/src/protocol/protocol_configs/stokenet_protocol_config.rs" target="_blank" rel="noopener">Stokenet</a> receives the same update through the ordinary route, signal <code>8ed71bbdf45861cb0000000eagle-ray</code> at 80% of stake for ten consecutive epochs, which is what the mechanism looks like when the ledger is moving.</p>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const box = blocks.find((b) => b.type === 'infobox');
  if (!box?.blocks?.[0]?.text) throw new Error('infobox not found');
  for (const [re, html] of ROWS) {
    if (!re.test(box.blocks[0].text)) throw new Error(`infobox row not matched: ${re}`);
    box.blocks[0].text = box.blocks[0].text.replace(re, html);
  }

  const how = blocks.find((b) => b.type === 'content' && b.text?.includes(OLD_LEAD));
  if (!how) throw new Error('enactment table lead-in not found');
  if (!how.text.includes(OLD_CONSEQ)) throw new Error('consequence sentence not found');
  if (!how.text.includes('</tbody></table>')) throw new Error('table close not found');

  how.text = how.text
    .replace(OLD_LEAD, NEW_LEAD)
    .replace('</tbody></table>', `${NEW_ROWS}</tbody></table>`)
    .replace(/(<\/tbody><\/table>)/, `$1${PARA}`)
    .replace(OLD_CONSEQ, NEW_CONSEQ);

  if (!how.text.includes(SENTINEL)) throw new Error('paragraph not inserted');
  if (!how.text.includes(NEW_CONSEQ)) throw new Error('consequence sentence not updated');

  const version = '1.2.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  infobox ${page.content.find((b) => b.id === box.id).blocks[0].text.length} -> ${box.blocks[0].text.length} chars`);
  console.log(`  block ${how.id}: ${page.content.find((b) => b.id === how.id).text.length} -> ${how.text.length} chars`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Infobox caught up with the body: latest release is v1.4.0.0-RC1 of 8 September 2026 (a pre-release, so /releases/latest still resolves to v1.3.0.5-test.1) and the protocol line now ends at v1.4.0 Eagle Ray. The mainnet enactment table gains Cuttlefish part 2 and Eagle Ray, and a paragraph reading the released mainnet configuration at source: Eagle Ray is the first mainnet entry with no readiness signal, because a threshold needs completed epochs and mainnet has completed none since 31 August, so it enacts unconditionally at 339,898 behind a one-epoch UserTransactionMoratorium at 339,897 while Stokenet keeps the 80%/10-epoch signal.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
