/**
 * update-ecosystem-caper-2 (sweep 484, ecosystem rotation). /ecosystem/caper's
 * "what connects the platform to every caper" sentence, after Caper's
 * 25 September 2026 redeploy.
 *
 * Filed by caper sweep #465. The page said the trade fee goes to the caper's
 * treasury and the founder and the Commons take slices of each PURCHASE. Caper
 * commit 012387e ("Replace the trade fee with the treasury's share of the
 * skim", live in the 25 September redeploy, e156eb0) removed the flat trade
 * fee: the skim, charged on buys and sells alike, now divides
 * TREASURY_SHARE 0.495 to the traded caper's treasury in XRD, COMMONS_SHARE
 * 0.005 to the Commons in tokens, and the founder the rest, 90% of it in XRD
 * (caper contracts/logic/src/lib.rs). caper.network/wiki/markets/trading and
 * /wiki/foundations/what-a-founder-can-take state the same, read 11:10 UTC
 * 25 September 2026.
 *
 * VOICE.md §4 Caper overlay: a Caper note inside radix.wiki stays outcome
 * level, so the sentence names who is paid and in what, not the shares.
 *
 * Idempotent: skipped if the sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'caper';
const SENTINEL = 'There is no separate trade fee';
const VERSION = '2.5.1';

const EDITS = [
  [
    'What connects the platform to every caper launched on it is a slice of each purchase, taken in the same contract call that mints the buyer&#39;s tokens: the trade fee goes to that caper&#39;s own treasury, the founder takes a slice of the payment and a slice of the tokens, and a smaller token slice goes to the Commons, which is the treasury of the platform&#39;s own caper.',
    'What connects the platform to every caper launched on it is a slice of each trade, taken on buys and sells alike in the same contract call that settles the trade. Roughly half of it goes to the traded caper&#39;s own treasury in XRD; the founder takes about as much, mostly in XRD and partly in the caper&#39;s tokens; and a small token slice goes to the Commons, which is the treasury of the platform&#39;s own caper. There is no separate trade fee: since a redeploy on 25 September 2026 the treasury&#39;s share of that slice <a href="https://caper.network/wiki/markets/trading" target="_blank" rel="noopener">replaces the flat fee a trade used to pay</a>.',
  ],
];

const MESSAGE =
  'Caper\'s redeploy of 25 September 2026 removed the flat trade fee: the skim, charged on buys and sells, now divides between the traded ' +
  'caper\'s treasury (in XRD), the founder (XRD and tokens) and the Commons (tokens). The sentence said the trade fee funds the treasury ' +
  'and the slices come from purchases only; rewritten at outcome level. Sources: caper contracts/logic/src/lib.rs TREASURY_SHARE / ' +
  'COMMONS_SHARE / FOUNDER_XRD_SHARE (commit 012387e), caper.network/wiki/markets/trading and /wiki/foundations/what-a-founder-can-take, ' +
  'read 25 September 2026. Filed by caper sweep #465.';

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
    [cuid(), page.id, json, page.title, VERSION, 'patch', AUTHOR_ID, MESSAGE, now],
  );
  await client.query('COMMIT');
});
