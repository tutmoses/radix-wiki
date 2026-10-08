// Sweep 558: Hyperlane agrees to help release the ~443k hUSDC collateral held by the stuck
// bridge transfer, 8 Oct 2026. Source: Timan's update in Radix DLT Official, relayed from the
// Foundation at 17:58 UTC 8 Oct (t.me/radix_dlt/1007057).
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'gp3-hyperlane';
const SRC = 'https://t.me/radix_dlt/1007057';

const EDITS = [
  // infobox Recovery row
  ['95% of the vote for reimbursing the original hUSDC holders. Not yet recovered</td>',
   `95% of the vote for reimbursing the original hUSDC holders. Not yet recovered; on 8 October <a href="${SRC}" target="_blank" rel="noopener">Hyperlane agreed to help release it</a></td>`],
  // after the result paragraph
  ['what happens next.</p>',
   `what happens next.</p><p id="${SENTINEL}">The answer came at 17:58&nbsp;UTC on 8 October. <a href="${SRC}" target="_blank" rel="noopener">Timan wrote in the same chat</a>, on the Foundation's behalf, that Hyperlane is helping recover the hUSDC from the stuck transaction, and that it had not been certain it would. He said he would publish the next day which wallets receive what, with the source code that computes it, so anyone can check the figures. Only the stuck transfer of about 442k hUSDC is being returned. The two smaller bridge-outs that completed, of about 380 and 15k hUSDC, are not part of the refund.</p>`],
  // What is unresolved
  ['in favour of reimbursing the original hUSDC holders</a>; the recovery itself has not been announced.',
   `in favour of reimbursing the original hUSDC holders</a>. The recovery itself has not happened, but on 8 October <a href="#${SENTINEL}">Hyperlane agreed to help</a>.`],
];

const swap = (b, from, to) => {
  let n = 0;
  if (b.text?.includes(from)) { b.text = b.text.replace(from, to); n++; }
  for (const c of b.blocks ?? []) n += swap(c, from, to);
  return n;
};

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied – no write'); return; }
  for (const [from, to] of EDITS) {
    const n = blocks.reduce((s, b) => s + swap(b, from, to), 0);
    if (n !== 1) throw new Error(`edit matched ${n} times: ${from.slice(0, 60)}`);
  }
  const version = await writeRevision(client, page, blocks, {
    change: 'minor',
    message: 'GP3 recovery: Hyperlane agreed to help release the stuck ~442k hUSDC transfer (Timan for the Foundation, 17:58 UTC 8 Oct, t.me/radix_dlt/1007057); allocation breakdown and code promised for 9 Oct; the completed ~380 and ~15k hUSDC bridge-outs are excluded. New paragraph p#gp3-hyperlane, infobox Recovery row, What is unresolved sentence.',
    verified: true, dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
