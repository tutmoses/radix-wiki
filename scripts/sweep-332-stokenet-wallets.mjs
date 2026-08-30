// sweep-332-stokenet-wallets.mjs — run 332, blog rotation, off-rotation signal edit.
//
// Closes the run-331 backlog item: three runs of Stokenet reset edits recorded what the
// operator said would happen to accounts and never recorded what account holders found.
// RadixDevelopers 66122/66123 (29 Aug, 23:16-23:19 UTC) is the first user reading his own
// accounts back after the reset; 66135 (30 Aug, 06:18 UTC) is Daffy confirming that the
// wipe is the reset working rather than a fault. Author resolved via the t.me embed
// (tgme_widget_message_author), the run-324 method.

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG = 'contents/tech/releases';
const SLUG = 'stokenet';
const SENTINEL = 'What the reset left in the wallet';
const DRY = process.argv.includes('--dry-run');

const SECTION =
  '\n<h4>What the reset left in the wallet</h4>\n' +
  '<p>The terms above said accounts survive and arrive empty. The first account holder to read them ' +
  'back asked whether that was a fault. At <a href="https://t.me/RadixDevelopers/66122" target="_blank" ' +
  'rel="noopener">23:16&nbsp;UTC on 29 August</a>, hours after the protocol updates went in, a developer ' +
  'reported every one of his Stokenet accounts present in the <a href="/contents/tech/core-protocols/radix-wallet" ' +
  'rel="noopener">Radix Wallet</a> and every one of them empty of tokens, NFTs, stake and pool units, with no ' +
  'historical transaction returned for any of them, and asked urgently whether the ledger data could be ' +
  'recovered. He confirmed three minutes later that the <a href="https://t.me/RadixDevelopers/66123" ' +
  'target="_blank" rel="noopener">faucet mints for him</a>, which places the loss in the history rather ' +
  'than in the network.</p>\n' +
  '<p><a href="/community/daffy" rel="noopener">Daffy</a> answered at <a href="https://t.me/RadixDevelopers/66135" ' +
  'target="_blank" rel="noopener">06:18&nbsp;UTC on 30 August</a>: &ldquo;I can confirm that all the historical ' +
  'ledger data on Stokenet is wiped. That was the intention of the reset.&rdquo; That is the operator stating ' +
  'after the fact what the 18 August announcement stated in advance, and it settles the one question the terms ' +
  'leave a user room to ask, which is whether an empty account is the reset working or the reset going wrong. ' +
  'It is the former, and nothing is recoverable from the network: a pre-reset Stokenet balance, package or ' +
  'transaction now exists only in whatever its owner kept off the ledger.</p>';

if (/ /.test(SECTION)) throw new Error('literal U+00A0 in SECTION');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => typeof b.text === 'string' && b.text.includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const at = blocks.findIndex((b) => typeof b.text === 'string' && b.text.includes('<h2>Full reset'));
  if (at < 0) throw new Error('reset block not found');
  const before = blocks[at].text.length;
  blocks[at] = { ...blocks[at], text: blocks[at].text + SECTION };

  const version = '1.8.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  block ${at} ${before} -> ${blocks[at].text.length} B`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Record what account holders found after the reset, and the operator confirming the wipe was intended', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
