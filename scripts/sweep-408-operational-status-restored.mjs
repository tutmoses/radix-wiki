// sweep 408 — the operational status index still said the network had not restarted.
//
// /contents/resources/radix-ecosystem-operational-status is the one page whose whole job is to
// say whether things are up, and four hours after mainnet came back it opened with "and has not
// restarted". This corrects the opening, the infobox status row, and the sentence saying no
// status here can be confirmed against the ledger, then closes the running halt log with the
// restart. The day-by-day account above it is left exactly as written.
//
// Figures read during run 408; see scripts/sweep-408-network-restart.mjs for the sources.
//
// Run:  node scripts/sweep-408-operational-status-restored.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/resources';
const SLUG = 'radix-ecosystem-operational-status';
const SENTINEL = 'sweep408-status-restored';

const OLD_OPEN =
  '<p>Radix mainnet stopped producing rounds at <strong>21:19:06 UTC on 31 August 2026</strong> and has not restarted.';
const NEW_OPEN =
  '<p id="sweep408-status-restored">Radix mainnet stopped producing rounds at <strong>21:19:48 UTC on 31 August 2026</strong> and restarted at <strong>11:35:28.96&nbsp;UTC on 11 September 2026</strong>, 254 hours and 15 minutes later. User transactions resumed four minutes after that, at 11:39:25&nbsp;UTC, when the Eagle Ray fork enacted at the start of epoch 339,898. <a href="/contents/history/hyperlane-asset-drain-2026#sweep408-restart" rel="noopener">The restart is recorded in full on the incident page</a>; the running account below is kept as it was written, reading downwards from the first day.';

const OLD_LEDGER_LINE = 'Until the restart lands, no status on this page can be confirmed against the ledger.';
const NEW_LEDGER_LINE =
  'That held until 11 September: no status on this page could be confirmed against the ledger until the restart landed.';

const CLOSING = `
<p><strong>The restart, read at 13:10&nbsp;UTC on 11 September.</strong> <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">gateway-status</a> returns a moving ledger for the first time since 31 August, and <a href="https://mainnet.radixdlt.com/stream/transactions" target="_blank" rel="noopener">the transaction stream</a> puts the boundary at two consecutive entries: state version 557,840,627 at epoch 339,897 round 4, timestamped 21:19:48.939&nbsp;UTC on 31 August, then state version 557,840,628 at epoch 339,897 round 5, timestamped 11:35:28.96&nbsp;UTC on 11 September. The five state versions between 557,840,622 and 557,840,627 are the ones the Gateway's status reading never showed, which is why the halt time cited on this page through the outage was forty-three seconds early. Epoch 339,897 then ran rounds 5 to 106 as empty blocks under the user transaction moratorium, and epoch 339,898 round 2 committed 17 user transactions at 11:39:25.129&nbsp;UTC, five of them failing as the waiting queue cleared. <a href="https://validators.stakesafe.net" target="_blank" rel="noopener">The adoption tracker</a> reads <strong>3,737,284,159&nbsp;XRD</strong> on babylon-node v1.4.0.0, <strong>80.85%</strong> of a 4,873,528,908&nbsp;XRD active set, against 32.77% two hours earlier: the tail did close in a rush, as the operators said it would. No official channel has announced the restart, which is also what they said would happen.</p>`;

const INFOBOX_OLD =
  'Mainnet halted since 21:19 UTC, 31 August 2026; still no restart date, but the restart condition is now public and measurable &mdash; 27.03% of active-set stake was running the fix at 23:08 UTC on 10 September, against the more-than-67% at which liveness resumes &mdash; see the notice below';
const INFOBOX_NEW =
  'Operational. Mainnet restarted at 11:35:28 UTC on 11 September 2026 after 254 hours and 15 minutes down; user transactions resumed at 11:39:25 UTC when Eagle Ray enacted at epoch 339,898, with 80.85% of active-set stake on the release. See the notice below';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: { rejectUnauthorized: false },
});
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const info = blocks[0];
  if (info?.type !== 'infobox') throw new Error('block 0 is not the infobox');
  const tbl = info.blocks[0];
  if (!tbl.text.includes(INFOBOX_OLD)) throw new Error('infobox network-status row not found verbatim');
  tbl.text = tbl.text.replace(INFOBOX_OLD, INFOBOX_NEW);

  const hi = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes('id="network-halt"'));
  if (hi < 0) throw new Error('network-halt block not found');
  const h = blocks[hi];
  for (const [oldText, newText] of [
    [OLD_OPEN, NEW_OPEN],
    [OLD_LEDGER_LINE, NEW_LEDGER_LINE],
  ]) {
    if (!h.text.includes(oldText)) throw new Error(`halt block substring not found: ${oldText.slice(0, 60)}…`);
    h.text = h.text.replace(oldText, newText);
  }
  h.text += CLOSING;

  const version = '1.19.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}`);
  console.log(`    v${page.version} -> v${version}`);
  console.log(`    halt block ${hi}: ${page.content[hi].text.length} -> ${h.text.length} chars`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [
      json,
      version,
      now,
      page.id,
    ]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        cuid(),
        page.id,
        json,
        page.title,
        version,
        'minor',
        AUTHOR_ID,
        'The network restarted at 11:35:28.96 UTC on 11 September 2026 and this index still opened with "has not restarted". Corrects the opening sentence and the infobox network-status row, retires the line saying no status here can be confirmed against the ledger, and closes the running halt log with the restart boundary (state versions 557,840,627 and 557,840,628), the epoch 339,897 moratorium, the 17 user transactions in epoch 339,898 round 2, and 80.85% adoption at 13:10 UTC. The day-by-day account is left as written.',
        now,
      ],
    );
    await client.query('COMMIT');
    console.log('    written');
  }
} finally {
  client.release();
  await pool.end();
}
