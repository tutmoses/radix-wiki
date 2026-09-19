// sweep 456 – contents/tech rotation. /contents/tech/core-concepts/shard-groups, the run-444 staleness head.
//
// The Research section said "the sharded consensus described here – including the automatic detection,
// re-staffing, and recovery of a halted shard group ... – is being implemented in Rust as Hyperscale".
// Two parts of that were wrong on 19 September 2026:
//   1. hyperscale-rs is not an implementation of the design this page describes. Its lead developer says it
//      "throws out almost all designs from both Cerberus and the original Hyperscale repo", and this page's
//      own Xi'an section already sets out how its committees differ (see /contents/tech/research/hyperscale-rs).
//   2. Halt recovery is not "being implemented": it shipped 13–19 July 2026 and is Model G in specs/README.md
//      (shard_recovery.qnt, halt_detection + recovery_bridge + cross_shard_freeze), read 19 September.
// Also: "targeting a linearly-scalable production network" named no network, and the author has since said
// Radix is one candidate among many (t.me/hyperscale_rs/12246, 12 September 2026).
//
//   node scripts/sweep-456-shard-groups-hyperscale.mjs --dry-run

import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'contents/tech/core-concepts';
const SLUG = 'shard-groups';
const VERSION = '1.6.0';
const SENTINEL = 'specs/README.md';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const int = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;
const EMDASH = String.fromCharCode(0x2014);
const NBSP = String.fromCharCode(0xa0);

const OLD_START = ' Since 2024 that research has moved into engineering:';
const OLD_END = 'targeting a linearly-scalable production network.</p>';
const NEW = '</p>'
  + `<p>Since 2024 that research has moved into engineering, though not as an implementation of the design above. ${int('/contents/tech/research/hyperscale-rs', 'Hyperscale')}, the ${ext('https://github.com/hyperscalers/hyperscale-rs', 'open-source Rust client')} proposed for Radix as Xi'an, keeps the problem and replaces most of the answers: its lead developer describes it as throwing out almost all of the designs from both Cerberus and the Foundation's original Hyperscale. It has also shipped one of the mechanisms this page leaves to research. In July 2026 it added shard halt recovery: the network detects a halted shard, seats a fresh committee and restores the shard without losing or duplicating cross-shard transactions in flight. The recovery path is one of the models the project ${ext('https://github.com/hyperscalers/hyperscale-rs/blob/main/specs/README.md', 'checks formally with Apalache')}. The next section sets out how Xi'an's committees differ from the groups described above.</p>`
  + `<p>Hyperscale is an open project rather than a Radix deliverable. Its author says an upgrade path to Radix exists and that he would guide the network along it, ${ext('https://t.me/hyperscale_rs/12246', '"not any more than any other network"')}; no migration has been scheduled.</p>`;

if (NEW.includes(NBSP) || NEW.includes(EMDASH)) throw new Error('U+00A0 or an em dash in new text');

await withClient(async (client) => {
  if (isLockedPage(TAG, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  if (JSON.stringify(page.content).includes(SENTINEL)) {
    console.log('  already applied – no write');
    return;
  }
  const blocks = JSON.parse(JSON.stringify(page.content));
  const hit = blocks.filter((b) => typeof b.text === 'string' && b.text.includes(OLD_START) && b.text.includes(OLD_END));
  if (hit.length !== 1) throw new Error(`expected 1 block, got ${hit.length}`);
  const b = hit[0];
  const i = b.text.indexOf(OLD_START);
  const j = b.text.indexOf(OLD_END, i) + OLD_END.length;
  if (j !== b.text.length) throw new Error('span is not at the end of the block');
  b.text = b.text.slice(0, i) + NEW;

  const json = JSON.stringify(blocks);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (${json.length - JSON.stringify(page.content).length} chars)`);
  if (DRY) { console.log(b.text.slice(i - 200)); return; }

  const now = new Date().toISOString();
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID,
      "Research section corrected. It said Hyperscale is implementing 'the sharded consensus described here', halt recovery included; hyperscale-rs discards most of the Cerberus and original-Hyperscale design (its lead developer's words, recorded on /contents/tech/research/hyperscale-rs), and halt recovery shipped 13-19 July 2026 and is formally checked as Model G in specs/README.md (read 19 September 2026). Also records that the author offers Radix an upgrade path 'not any more than any other network' (t.me/hyperscale_rs/12246, 12 September 2026).",
      now]);
  await client.query('COMMIT');
  console.log('    written and stamped');
});
