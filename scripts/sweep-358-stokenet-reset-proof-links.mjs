import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// The three stokenet.radxplorer.com transaction links in contents/history are the proof that a
// workshop's dApps reached the network. Stokenet was reset in August 2026 and restarted from
// epoch 1, so all three hashes now answer TransactionNotFoundError at the Stokenet Gateway while
// the explorer keeps returning a byte-identical 25,166-byte SPA shell - HTTP 200 to any checker.
// Verified 3 September 2026, 07:0x UTC, against babylon-stokenet-gateway.radixdlt.com.

const TAG_PATH = 'contents/history';
const SENTINEL = 'TransactionNotFoundError';
const DRY = process.argv.includes('--dry-run');

const EXPLAIN = `<p>The transaction can no longer be read. <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> was reset in August 2026 and restarted from epoch 1, so the ledger this work was committed to no longer exists. Read on 3 September 2026, the network's <a href="https://babylon-stokenet-gateway.radixdlt.com" target="_blank" rel="noopener">Gateway</a> answers <code>TransactionNotFoundError</code> for the hash, and stokenet.radxplorer.com returns its own shell rather than a transaction page. The hash is kept here as the record.</p>`;

const EXPLAIN_PLURAL = EXPLAIN.replace('The transaction can no longer be read.', 'Neither transaction can be read now.').replace('for the hash', 'for both hashes').replace('The hash is kept here as the record.', 'The hashes are kept here as the record.');

const EDITS = [
  {
    slug: 'brunel-hack-25',
    version: '3.3.0',
    text: `<h2>DApps Deployed</h2>
<p>One dApp reached <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a>, committed in <code>txid_tdx_2_1qzsd4k4h85yfwja6yhjy0kkz2vywctuajm773ftjnkn94zemnzsqyvp67l</code>.</p>
${EXPLAIN}`,
  },
  {
    slug: 'dapp-in-a-day-workshop-7-roehampton',
    version: '3.4.0',
    text: `<h2>DApps Deployed</h2>
<p>Two dApps reached <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a>, committed in <code>txid_tdx_2_1lavfe7kmhxnuz2dte4kzchwwh6krrzqvdzaefzp4u9csaxswr5tqfm87yx</code> and <code>txid_tdx_2_1lfz032d9j3uk43peg5fzyhmse9uuhpeupwvrdgw528jl42wajjfs602q3c</code>.</p>
${EXPLAIN_PLURAL}`,
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const edit of EDITS) {
    if (isLockedPage(TAG_PATH, edit.slug)) throw new Error(`${edit.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, edit.slug]);
    if (!rows.length) throw new Error(`${edit.slug}: page not found`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    if (blocks.some((b) => b.text?.includes(SENTINEL))) {
      console.log(`  ${edit.slug}: already applied - no write`);
      continue;
    }
    const at = blocks.findIndex((b) => b.text?.startsWith('<h2>DApps Deployed</h2>'));
    if (at === -1) throw new Error(`${edit.slug}: DApps Deployed block not found`);
    blocks[at] = { id: uid(), type: 'content', text: edit.text };

    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${edit.version}  block ${at} rewritten`);
    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
        [json, edit.version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, edit.version, 'minor', AUTHOR_ID,
         'The Stokenet explorer links proving the deployments no longer resolve: the August 2026 Stokenet reset wiped the ledger and the Gateway answers TransactionNotFoundError for every hash, while the explorer returns HTTP 200 with its own shell. Transaction hashes kept as the record, with the reason stated.', now]);
      await client.query('COMMIT');
      console.log('    written');
    }
  }
} finally {
  client.release();
  await pool.end();
}
