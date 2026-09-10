// Sweep 403 — the operational-status page gets the number the restart turns on.
//
// The halt notice has recorded, for ten days, that no restart date is published.
// That is still true, and it is now the less useful of the two facts available:
// since 20:18 UTC on 10 September the restart condition has been public and
// measurable — more than 67% of active validator-set stake running babylon-node
// v1.4.0.0 — and StakeSafe publishes the running total. This adds that reading
// and refreshes the infobox row, which still cited 8 September.
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, withClient } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/resources';
const SLUG = 'radix-ecosystem-operational-status';
const VERSION = '1.16.0';
const SENTINEL = 'halt-restart-threshold';
const DRY = process.argv.includes('--dry-run');

const OLD_INFO = 'Mainnet halted since 21:19 UTC, 31 August 2026; no restart date announced as of 03:08 UTC, 8 September &mdash; see the notice below';
const NEW_INFO = 'Mainnet halted since 21:19 UTC, 31 August 2026; still no restart date, but the restart condition is now public and measurable &mdash; 27.03% of active-set stake was running the fix at 23:08 UTC on 10 September, against the more-than-67% at which liveness resumes &mdash; see the notice below';

const PARA = `<p id="${SENTINEL}"><strong>The restart is now a number rather than a date.</strong> At <strong>20:18&nbsp;UTC on 10 September</strong>, four hours after operators were cleared to upgrade, <a href="/ecosystem/stakesafe" rel="noopener">StakeSafe</a>'s Bart Roozeboom announced in the main Radix Telegram group that the operator's free <a href="https://validators.stakesafe.net" target="_blank" rel="noopener">Radix Network Dashboard</a> now <a href="https://t.me/radix_dlt/1002910" target="_blank" rel="noopener">tracks Eagle-Ray adoption live</a>, and stated the condition: <q>Once more than 67% of active stake is on Eagle-Ray, network liveness resumes and the network forks to a patched version.</q> The threshold is the two-thirds quorum <a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">consensus</a> needs to commit a round, which is the same fraction that stopped the network on 31 August. Read from the dashboard at <strong>23:08&nbsp;UTC on 10 September</strong>, <strong>1,260,200,690&nbsp;XRD</strong> is running v1.4.0.0 &mdash; <strong>27.03%</strong> of the 4,663,021,341&nbsp;XRD held by the 94 validators the explorer reports a version for, across 28 of them &mdash; while 32.58% of that stake has a node online at all. The remaining forty points are mostly behind nodes that are switched off rather than nodes on the wrong version, which is why the <a href="https://t.me/RadixAccountabilityCouncil/1019" target="_blank" rel="noopener">council's instruction</a> is to leave an upgraded node online and working rather than merely to install the release. The ledger has not moved for any of it: read at <strong>23:04:40&nbsp;UTC on 10 September</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">gateway-status</a> returns state version 557,840,622 at epoch 339,896, round 102, two hundred and forty-one hours and forty-five minutes without a committed round.</p>`;

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    return;
  }

  const info = blocks.find((b) => b.type === 'infobox');
  const infoLeaf = info?.blocks?.find((n) => n.text?.includes(OLD_INFO));
  if (!infoLeaf) throw new Error('infobox network-status row not matched — inspect before rerunning');
  infoLeaf.text = infoLeaf.text.replace(OLD_INFO, NEW_INFO);

  const halt = blocks.find((b) => b.text?.includes('id="halt-day-ten"'));
  if (!halt) throw new Error('halt block not matched');
  halt.text += PARA;

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (infobox row + ${PARA.length} chars on ${halt.id})`);
  if (DRY) return;

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
    [json, VERSION, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID,
     'The restart condition is public and measurable: StakeSafe published a live Eagle-Ray adoption tracker at 20:18 UTC on 10 September naming the more-than-67% threshold, and 27.03% of active-set stake was on v1.4.0.0 at 23:08 UTC. Infobox network-status row refreshed from its 8 September reading.',
     now]);
  await client.query('COMMIT');
  console.log('  written');
});
