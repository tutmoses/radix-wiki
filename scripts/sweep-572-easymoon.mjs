// Run 572 (ecosystem rotation): EASYMOON. The unsourced "Criticisms" section goes (no citation for
// any of its four claims, and "remains a popular project" is contradicted by a dead domain), and both
// resources are re-read a month after the restart: supplies unchanged.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'easymoon';
const SENTINEL = 'id="emoon-october-2026"';

const CRITICISMS = /\n<h2>Criticisms<\/h2>\n<p>EasyMoon has been criticized[\s\S]*?potential for growth\.<\/p>/;

const REREAD = `\n<p id="emoon-october-2026">Read again on 11 October 2026 at state version 562,452,806, a month after the network restarted, both supplies are unchanged: 41,975,881,332.04 on the first resource and 42,000,000,000 on the second (<a href="https://mainnet.radixdlt.com/state/entity/details" target="_blank" rel="noopener">Radix Gateway</a>). No holder has burned any of the first since the halt.</p>`;

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

  if (!CRITICISMS.test(blocks[1].text)) throw new Error('Criticisms section not found');
  blocks[1].text = blocks[1].text.replace(CRITICISMS, '');
  if (!blocks[2].text?.includes('Two resources carry this name')) throw new Error('two-resources block not found');
  blocks[2].text += REREAD;

  const version = await writeRevision(client, page, blocks, {
    change: 'minor',
    message: 'Removed the unsourced Criticisms section: none of its claims carried a citation, and "remains a popular project" sat beside a domain dead since July. Both EasyMoon resources re-read at state version 562,452,806 (11 Oct 2026): supplies unchanged since the halt reading.',
    verified: true,
    dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
