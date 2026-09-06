// scripts/sweep-375b-delay-pinned-supply.mjs
//
// Closes the run-372 item that banked two DELAY figures as needing "one Gateway
// call each once mainnet returns". They did not need the restart. The same pinned
// read this run documented on the Gateway API page answers for a resource as
// readily as for an account, so the token's on-ledger name and total supply are
// now recorded at the halted ledger's own final state version rather than at a
// July reading, and the page's sentence saying the figure cannot be re-read while
// mainnet is halted comes out.
//
// The same read returns a field the run-372 pass missed: social_urls names an X
// account, which the page says it does not have. Recorded as what the ledger
// carries, with no claim about whether anyone is still behind it.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'delay';
const VERSION = '1.2.0';
const SENTINEL = '661,195,247.825631037429292673';
const DRY = process.argv.includes('--dry-run');

const OLD_SUPPLY_SENTENCE =
  'The supply figure above was read at the Radix Gateway on 18 July 2026 and cannot be re-read while <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">mainnet is halted</a>.';
const NEW_SUPPLY_SENTENCE =
  'The supply figure above was read at the Radix Gateway on 18 July 2026, and it can be re-read during the halt after all. ' +
  'A Gateway read <a href="/contents/tech/core-protocols/radix-gateway-api#pinned-reads" rel="noopener">pinned to a ledger state</a> ' +
  'skips the guard that refuses ordinary reads, so at 07:09:58 UTC on 6 September 2026 &mdash; with the network ' +
  '<a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">stopped for a hundred and twenty-nine hours</a> &mdash; ' +
  '<code>/state/entity/details</code> returned the resource at state version 557,840,622 with a total supply of ' +
  '<strong>661,195,247.825631037429292673</strong> DELAY and the ledger name &ldquo;DELAY - THE token&rdquo;, confirming both figures this page carries. ' +
  'That is the supply as it stood at 21:19:06 UTC on 31 August 2026 and it is where it will stay: burning is open to anyone, but nothing burns on a ledger that is not committing rounds.';

const OLD_CHANNEL_CLAUSE =
  'so it settles nothing about who is still behind DELAY, and this page records no channel of DELAY\u2019s own.';
const NEW_CHANNEL_CLAUSE =
  'so it settles nothing about who is still behind DELAY. The same read returns one channel that is the token&rsquo;s own: ' +
  'the resource&rsquo;s <code>social_urls</code> metadata names <a href="https://x.com/delayonradix" target="_blank" rel="noopener">x.com/delayonradix</a>. ' +
  'That field records what was written to the ledger, not whether anyone still posts there, and the ledger cannot be asked the second question.';

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
  if (blocks.some((b) => (b.text || '').includes(SENTINEL))) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const target = blocks.find((b) => (b.text || '').includes(OLD_SUPPLY_SENTENCE));
  if (!target) throw new Error('supply sentence not found - inspect before rerunning');
  if (!target.text.includes(OLD_CHANNEL_CLAUSE)) throw new Error('channel clause not found - inspect before rerunning');

  target.text = target.text
    .replace(OLD_SUPPLY_SENTENCE, NEW_SUPPLY_SENTENCE)
    .replace(OLD_CHANNEL_CLAUSE, NEW_CHANNEL_CLAUSE);

  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, VERSION, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID,
        'Total supply and ledger name re-read on-chain during the halt, by pinning the Gateway request to state version 557,840,622: 661,195,247.825631037429292673 DELAY, confirming the July figure and replacing the sentence that said it could not be re-read. Also records the social_urls account the same read returns, which the page previously said it did not have.',
        now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
