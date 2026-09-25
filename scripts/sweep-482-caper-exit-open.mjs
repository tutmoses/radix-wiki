/**
 * sweep 482 - ecosystem rotation. /ecosystem/caper's exit gate, corrected
 * against the contract rather than the page's own earlier reading.
 *
 * Filed by caper's sweep #462 on 24 September. Exit and Dissolution says the
 * contract checks ONLY that the member holds some governance tokens and some
 * stake token. Caper's logic contract (caper contracts/logic/src/lib.rs,
 * commit 95f7010 of 20 September, "Bind an exit's vote tokens to the account
 * it pays", live since the 21 September redeploy) adds two more checks to
 * exit():
 *   - self.check_caller(recipient): the transaction must satisfy the owner
 *     rule of the account the payout goes to;
 *   - exit_opened must hold a reading taken by exit_open() in the SAME
 *     transaction for this member and this caper's vote token, else it panics
 *     "Call exit_open for this member and caper first"; then
 *     held - recipient.balance(vote_token) must equal the vote tokens handed
 *     in, else "Vote tokens must all come from the recipient".
 * caper.network/wiki/foundations/leaving-a-caper states the second check and
 * dates it to the 21 September redeploy (read 03:20 UTC 25 September).
 *
 * Idempotent: skipped if the sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'caper';
const SENTINEL = 'Vote tokens must all come from the recipient';
const VERSION = '2.5.0';

const EDITS = [
  [
    'It is not a proposal, so it is not voted on and needs nobody&#39;s approval, and the contract checks only that the member holds some of that caper&#39;s governance tokens and some of its non-transferable stake token. Voting',
    'It is not a proposal, so it is not voted on and needs nobody&#39;s approval. The contract checks that the member hands in some of that caper&#39;s governance tokens and some of its non-transferable stake token, and that the transaction satisfies the owner rule of the account the payout goes to, so only that account&#39;s owner can take it out. Since a redeploy on 21 September 2026 it also checks that the stake tokens are the member&#39;s own: the same transaction first calls <code>exit_open</code>, which reads the account&#39;s stake-token balance, and <code>exit</code> aborts on <code>Vote tokens must all come from the recipient</code> unless the tokens handed in equal the fall in that balance. Voting',
  ],
  [
    '<a href="https://caper.network/wiki/foundations/leaving-a-caper" target="_blank" rel="noopener">Caper states the gate as those two assertions</a>.',
    '<a href="https://caper.network/wiki/foundations/leaving-a-caper" target="_blank" rel="noopener">Caper describes the gate and the 21 September check</a>.',
  ],
];

const MESSAGE =
  'Exit and Dissolution said the contract checks only that the member holds some governance tokens and some stake token. ' +
  'Since the redeploy of 21 September 2026 exit also asserts the owner rule of the payout account, and requires an exit_open call in the ' +
  'same transaction whose balance reading must fall by exactly the stake tokens handed in, aborting on "Vote tokens must all ' +
  'come from the recipient" otherwise. Sources: caper contracts/logic/src/lib.rs exit() and exit_open() (commit 95f7010), ' +
  'caper.network/wiki/foundations/leaving-a-caper read 25 September 2026. Filed by caper sweep #462.';

const replaceOnce = (haystack, needle, replacement) => {
  const i = haystack.indexOf(needle);
  if (i < 0) throw new Error(`string not found: ${JSON.stringify(needle.slice(0, 70))}`);
  if (haystack.indexOf(needle, i + 1) >= 0) throw new Error(`string is not unique: ${JSON.stringify(needle.slice(0, 70))}`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
};

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${TAG_PATH}/${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG],
  );
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  if (JSON.stringify(page.content).includes(SENTINEL)) {
    console.log('  already applied - no write');
    return;
  }
  const blocks = JSON.parse(JSON.stringify(page.content));
  for (const [from, to] of EDITS) {
    const target = blocks.find((b) => (b.text || '').includes(from));
    if (!target) throw new Error(`no block holds ${JSON.stringify(from.slice(0, 60))}`);
    target.text = replaceOnce(target.text, from, to);
  }
  assertLinkShapes(blocks, page.title);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${VERSION}  (${EDITS.length} edits)`);
  if (DRY) return;
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query(
    'UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3 WHERE id = $4',
    [json, VERSION, now, page.id],
  );
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, VERSION, 'minor', AUTHOR_ID, MESSAGE, now],
  );
  await client.query('COMMIT');
});
