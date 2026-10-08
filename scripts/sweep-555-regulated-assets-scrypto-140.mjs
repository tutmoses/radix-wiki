/**
 * sweep 555 - developers rotation: 09-permissioned-and-regulated-assets
 * compiled under Scrypto 1.4.0, and the wallet-support section re-read.
 *
 * Run 8 October 2026. Recipe from run 507: scrypto new-package, scrypto = "=1.4.0",
 * dev-dependency, Cargo.lock and tests/ dropped, cargo check.
 *
 * 1. The movement-roles builder and the recall/freeze roles, chained onto one
 *    ResourceBuilder inside a blueprint with two minted badge addresses,
 *    compiled clean. The scrypto 1.4.0 crate's Vault API still carries no
 *    freeze, unfreeze or recall method (only the builder's recall_roles and
 *    freeze_roles), so the "not a Scrypto call" section stands.
 * 2. sargon #452 and babylon-wallet-android #1446 are unchanged since 27 and
 *    26 July: open, not drafts, no review. Neither repository has taken a commit
 *    on main since #453 (28 July) and #1447 (31 July).
 *
 * Idempotent: skipped if the sentinel is already stored.
 */
import { isLockedPage, assertLinkShapes, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'developers/scrypto';
const SLUG = '09-permissioned-and-regulated-assets';
const SENTINEL = 'Re-checked on 8 October 2026';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const OLD_FREEZE_P = '<p>A freeze is not one switch.';
const NEW_FREEZE_P =
  '<p>Both snippets, chained onto one <code>ResourceBuilder</code> with the two badges minted in the same blueprint, ' +
  'compiled under Scrypto 1.4.0 on 8 October 2026.</p>\n<p>A freeze is not one switch.';

const OLD_MONTH = 'That may change, though it has not moved in a month.';
const NEW_MONTH = 'That may change, though nothing has moved since July.';

const OLD_RECHECK =
  '<p>Re-checked on 26 August 2026: both are still open against <code>main</code>, neither is a draft, and neither has been ' +
  'touched since 27 and 26 July respectively, which is four days after they were opened.';
const NEW_RECHECK =
  '<p>Re-checked on 8 October 2026: both are still open against <code>main</code>, neither is a draft, and neither has been ' +
  'touched since 27 and 26 July respectively, four days after they were opened. The repositories themselves have gone as ' +
  `quiet: the last commit on sargon's <code>main</code> is ${ext('https://github.com/radixdlt/sargon/pull/453', '#453')} ` +
  `(28 July) and the Android wallet's is ${ext('https://github.com/radixdlt/babylon-wallet-android/pull/1447', '#1447')} (31 July).`;

const MESSAGE =
  'Compiled the movement, recall and freeze role snippets under Scrypto 1.4.0 (clean; the 1.4.0 Vault API still has no ' +
  'freeze or recall method). Wallet-support section re-read 8 Oct: sargon #452 and babylon-wallet-android #1446 untouched ' +
  'since July, and neither repo has a commit on main since 28 and 31 July. wiki-sweep run 555.';

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  if (JSON.stringify(page.content).includes(SENTINEL)) {
    console.log(`  ${page.title}: already applied - no write`);
    return;
  }
  const blocks = JSON.parse(JSON.stringify(page.content));
  for (const [from, to] of [[OLD_FREEZE_P, NEW_FREEZE_P], [OLD_MONTH, NEW_MONTH], [OLD_RECHECK, NEW_RECHECK]]) {
    const hits = blocks.filter((b) => (b.text || '').split(from).length === 2);
    if (hits.length !== 1) throw new Error(`${hits.length} blocks hold ${JSON.stringify(from.slice(0, 60))} once`);
    hits[0].text = hits[0].text.replace(from, () => to);
  }
  const json = JSON.stringify(blocks);
  if (json.includes('—')) throw new Error('em dash in the new content');
  if (json.includes(' ')) throw new Error('U+00A0 in the new content');
  assertLinkShapes(blocks, page.title);

  const version = await writeRevision(client, page, blocks, { change: 'patch', message: MESSAGE, verified: true, dry: DRY });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (DRY) {
    const before = new Set(page.content.map((b) => b.text));
    for (const b of blocks) if (b.text && !before.has(b.text)) console.log('\n----\n' + b.text);
  }
});
