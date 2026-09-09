import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 393, contents/tech rotation. The page's Eagle Ray section (added runs
// 388-392) establishes that mainnet's trigger for it is unconditional at epoch
// 339,898, that the node released a build on 8 September, and that Dugong's
// placeholder was removed from every network config. The infobox above it still
// said enactment is validator readiness at 75%, that the latest node release is
// v1.3.0.5 of 1 June, and that Dugong is the update in development - so the
// facts table a reader scans first contradicted the body three ways.
// Also adds the mechanical reason for the exception, read from the node source:
// readiness is counted in COMPLETED epochs, and a halted network completes none.

const TAG_PATH = 'contents/tech/releases';
const SLUG = 'protocol-updates';
const SENTINEL = 'id="unconditional-exception"';
const DRY = process.argv.includes('--dry-run');

const ROWS = [
  [/<tr><th>Enactment<\/th><td>[\s\S]*?<\/td><\/tr>/,
   '<tr><th>Enactment</th><td>Validator readiness signalling &ndash; 75% of active-set stake, sustained for a required number of consecutive epochs, inside a fixed epoch window. Eagle Ray is the first mainnet exception: it enacts unconditionally at epoch 339,898</td></tr>'],
  [/<tr><th>Latest node release<\/th><td>[\s\S]*?<\/td><\/tr>/,
   '<tr><th>Latest node release</th><td><a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.4.0.0-RC1" target="_blank" rel="noopener">v1.4.0.0-RC1</a>, 8 September 2026 &ndash; a pre-release carrying Eagle Ray; the repository’s <a href="https://api.github.com/repos/radixdlt/babylon-node/releases/latest" target="_blank" rel="noopener">latest release</a> still resolves to v1.3.0.5-test.1</td></tr>'],
  [/<tr><th>In development<\/th><td>[\s\S]*?<\/td><\/tr>/,
   '<tr><th>Released, not enacted</th><td>Eagle Ray &ndash; shipped 8 September 2026, configured to enact at epoch 339,898. Dugong carries no trigger on any network</td></tr>'],
];

const OLD_SENT = 'Every mainnet update so far has used a 75% stake threshold.';
const NEW_SENT = 'Every mainnet update <em>enacted</em> so far has used a 75% stake threshold.';

const EXCEPTION = [
  '<p id="unconditional-exception">Eagle Ray breaks that pattern, and the reason is mechanical. Readiness is counted in <code>required_consecutive_completed_epochs_of_support</code>, and a halted network completes no epochs, so an update whose purpose is to end a halt could never satisfy a readiness threshold. <a href="https://github.com/radixdlt/babylon-node/blob/main/core-rust/state-manager/src/protocol/protocol_configs/mainnet_protocol_config.rs" target="_blank" rel="noopener">The mainnet configuration</a> released in node v1.4.0.0-RC1 therefore gives Eagle Ray <code>EnactAtStartOfEpochUnconditionally</code> at epoch 339,898 &ndash; the trigger described above as reserved for genesis and test environments &ndash; and pairs it with a <code>UserTransactionMoratorium</code>, a mechanism new to the node, covering the single epoch 339,897. The node defines that record as <q>an epoch range during which user transactions are refused</q>. <a href="https://github.com/radixdlt/babylon-node/blob/main/core-rust/state-manager/src/protocol/protocol_configs/stokenet_protocol_config.rs" target="_blank" rel="noopener">Stokenet’s copy of the same update</a> keeps ordinary readiness signalling, under the signal <code>8ed71bbdf45861cb0000000eagle-ray</code> at 80% of stake for ten consecutive epochs, so the departure is mainnet’s alone and is a response to the halt rather than a change of policy.</p>',
].join('');

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

  const how = blocks.find((b) => b.type === 'content' && b.text?.includes(OLD_SENT));
  if (!how) throw new Error('enactment section sentence not found');
  how.text = how.text.replace(OLD_SENT, NEW_SENT).replace(/(directly\.<\/p>)/, `$1${EXCEPTION}`);
  if (!how.text.includes(SENTINEL)) throw new Error('exception paragraph not inserted');

  const version = '1.7.0';
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
       'Infobox reconciled with the page body: enactment is readiness signalling except for Eagle Ray, the latest node release is v1.4.0.0-RC1 of 8 September 2026 (pre-release, so /releases/latest still resolves to v1.3.0.5-test.1), and the update awaiting enactment is Eagle Ray rather than Dugong, which now carries no trigger on any network. Adds the mechanical reason for the exception from the node source: readiness is counted in completed epochs and a halted network completes none, so mainnet gets EnactAtStartOfEpochUnconditionally at 339,898 plus a one-epoch UserTransactionMoratorium at 339,897, while Stokenet keeps the 80%/10-epoch readiness signal.',
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
