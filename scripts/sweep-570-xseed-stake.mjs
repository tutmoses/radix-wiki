// Run 570 (ecosystem rotation): XSEED STAKING infobox re-read from the ledger, 11 Oct 2026.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'xseed';
const SENTINEL = '105.97m XRD (11 Oct 2026)';

const SWAPS = [
  ['<td>98.70M XRD (12 Sep 2026)</td>', `<td>${SENTINEL}</td>`],
  ['<td>13 of 186 registered</td>', '<td>12 of 187 registered</td>'],
  ['<td>100% (trailing month)</td>', '<td>100% (trailing month; 4 of 95,942 proposals missed)</td>'],
];

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied – no write');
    return;
  }

  const ib = blocks[0]?.blocks?.[0];
  for (const [from, to] of SWAPS) {
    if (!ib?.text?.includes(from)) throw new Error(`infobox cell not found: ${from}`);
    ib.text = ib.text.replace(from, to);
  }

  const version = await writeRevision(client, page, blocks, {
    change: 'patch',
    message: 'Infobox re-read from the ledger at epoch 348,483 (11 Oct 2026): stake 105.97m XRD, rank 12 of 187 registered validators, 4 of 95,942 proposals missed in the trailing month (Gateway /state/validators/list and /statistics/validators/uptime).',
    verified: true,
    dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
