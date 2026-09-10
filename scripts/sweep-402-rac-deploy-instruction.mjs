// Sweep 402: the Radix Accountability Council told operators to upgrade their nodes.
// t.me/RadixAccountabilityCouncil/1019, 16:15:36 UTC 10 September 2026, projectShift,
// authorship confirmed through the t.me embed. Three pages carried the superseded
// "wait for official versions and instructions" line: the node-operator page, the halt
// chronology and the operational-status page.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const SENTINEL = 'RadixAccountabilityCouncil/1019';

const RAC = '<a href="https://t.me/RadixAccountabilityCouncil/1019" target="_blank" rel="noopener">';

const EDITS = [
  {
    tagPath: 'developers/infrastructure',
    slug: '01-running-a-node',
    version: '2.6.0',
    changeType: 'minor',
    message: 'The Accountability Council cleared operators to upgrade at 16:15 UTC on 10 September 2026 (t.me/RadixAccountabilityCouncil/1019), superseding the wait instruction this page carried.',
    blockId: 'df15c751-5dcb-4309-83ed-a298e400c410',
    replacements: [
      [
        '<code>v1.4.0.0</code> is that final version. The deployment instructions and the restart date are not published yet.</p>',
        '<code>v1.4.0.0</code> is that final version, and the instructions followed it. At <strong>16:15 UTC on 10 September</strong> projectShift posted a status update from the council telling operators to ' +
        RAC + 'upgrade now</a>: <q>You can upgrade and update your nodes now, using the latest software version available from official sources.</q> ' +
        'Validator operators are told to check the dedicated validator chat for further detail, and to leave a node online and working once it is fully upgraded and running properly. ' +
        'That is the third of the four steps the council named on 1 September, the coordinated deployment across nodes. The restart itself has no published date.</p>',
      ],
    ],
  },
  {
    tagPath: 'contents/history',
    slug: 'hyperlane-asset-drain-2026',
    version: '2.25.0',
    changeType: 'minor',
    message: 'Day eleven, evening: the council reversed the wait instruction at 16:15 UTC and told operators to upgrade (t.me/RadixAccountabilityCouncil/1019). Ledger unchanged at 19:08 UTC.',
    blockId: '0d760cd6-a284-405d-a7fb-39e6546e06e7',
    replacements: [
      [
        'Day eleven: the release stops being a candidate, and the council says do not install it',
        'Day eleven: the release stops being a candidate, and the council clears operators to upgrade',
      ],
      [
        'the installer serves it &ndash; and the instruction has not changed.',
        'the installer serves it &ndash; and through the middle of the day the instruction had not changed.',
      ],
    ],
    append:
      '\n<p><strong>The instruction changed at 16:15 UTC.</strong> Seven hours after telling operators to wait, projectShift posted the update that message had promised, again under the heading <q>STATUS UPDATE FROM RAC</q>: ' +
      RAC + '<q>You can upgrade and update your nodes now, using the latest software version available from official sources.</q></a> ' +
      'Validator node-runners are pointed to the dedicated validator chat for the detail, and a node that is fully upgraded and running properly is to be left online and working. ' +
      'The council called it one important step closer to network liveness being restored. It is the third of the four steps it named on 1 September, the coordinated deployment across nodes, and it is the first of them that ordinary operators outside the repair are asked to carry out.</p>\n' +
      '<p>Deploying is not restarting. Read at <strong>19:08 UTC</strong>, ' +
      '<a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">gateway-status</a> returns the ledger it has returned since the stop, state version 557,840,622 at epoch 339,896, round 102, which is 237 hours and 49 minutes without a committed round; ' +
      '<code>/state/validators/list</code> still answers HTTP 500, now at a sync delay of 856,147 seconds against the 720 the Gateway tolerates. ' +
      'The ledger moves when enough upgraded validators agree to produce a round together, and the fourth step, a coordinated return to liveness, has no published date.</p>',
  },
  {
    tagPath: 'contents/resources',
    slug: 'radix-ecosystem-operational-status',
    version: '1.15.0',
    changeType: 'minor',
    message: 'The Accountability Council cleared operators to upgrade at 16:15 UTC on 10 September 2026 (t.me/RadixAccountabilityCouncil/1019); ledger unchanged at 19:08 UTC.',
    blockId: '283f5a75-ba22-4f58-8c5a-000d685ceba7',
    append:
      '\n<p><strong>Operators were cleared to upgrade at 16:15 UTC on 10 September.</strong> The Radix Accountability Council ' +
      RAC + 'told node operators</a> to upgrade to the latest software version from official sources, to check the dedicated validator chat for further detail, and to leave a node online and working once it is fully upgraded. ' +
      'That is the third of the four repair steps the council named on 1 September. The ledger is unchanged by it: read at 19:08 UTC, gateway-status still returns state version 557,840,622 at epoch 339,896, and the fourth step, a coordinated return to liveness, has no published date.</p>',
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const edit of EDITS) {
    if (isLockedPage(edit.tagPath, edit.slug)) throw new Error(`${edit.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
      [edit.tagPath, edit.slug],
    );
    if (!rows.length) throw new Error(`page not found: ${edit.tagPath}/${edit.slug}`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(SENTINEL)) {
      console.log(`  ${edit.slug}: already applied, no write`);
      continue;
    }
    const block = blocks.find((b) => b.id === edit.blockId);
    if (!block) throw new Error(`block ${edit.blockId} missing on ${edit.slug}`);

    for (const [from, to] of edit.replacements ?? []) {
      if (!block.text.includes(from)) throw new Error(`find-string missing on ${edit.slug}: ${from.slice(0, 60)}`);
      block.text = block.text.replace(from, to);
    }
    if (edit.append) block.text += edit.append;

    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${edit.version}  (+${(edit.append ?? '').length} chars, ${(edit.replacements ?? []).length} replacements)`);

    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, edit.version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, edit.version, edit.changeType, AUTHOR_ID, edit.message, now],
      );
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
