// Sweep 557: the eleven YouTube embeds in Cassandra's Media section, and the inline youtu.be link
// for the decentralized Twitter demo (PzU_Tiqm4xQ, also the first embed), all answer "Video
// unavailable" (oEmbed 404) on 8 Oct 2026; run 533's audit on 4 Oct found them playing. Removed the
// embeds and unlinked the demo phrase. The Twitch links (demo premiere, clip, RadFlix highlight)
// and the 1rNeL-X40lc talk are alive and stay.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/tech/research';
const SLUG = 'cassandra';
const DEAD = ['PzU_Tiqm4xQ', 'wZU9OneVdhA', '1S_8Ho8HCeE', 'FK3aPn6NOrU', 'xnxE5PTbMUY', 'zsdPGDULtAA',
  'ZgtwOEhMo-4', 'rhXwjCUSAFE', 'LFJpoSmNgmk', '9EJbxA99aVk', 'BScWx81zd4s'];
const EMBED = /<div data-iframe-embed="" class="iframe-embed"><iframe[^>]*src="https:\/\/www\.youtube\.com\/embed\/([\w-]+)[^"]*"[^>]*><\/iframe><\/div>/g;
const LINK = '<a target="_blank" rel="noopener noreferrer nofollow" class="link" href="https://youtu.be/PzU_Tiqm4xQ">decentralized test version of Twitter</a>';

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (!JSON.stringify(blocks).includes('youtube.com/embed/BScWx81zd4s')) { console.log('  already applied – no write'); return; }
  let removed = 0, unlinked = 0;
  for (const b of blocks) {
    if (!b.text) continue;
    b.text = b.text.replace(EMBED, (m, id) => {
      if (!DEAD.includes(id)) return m;
      removed++; return '';
    });
    if (b.text.includes(LINK)) { b.text = b.text.replace(LINK, 'decentralized test version of Twitter'); unlinked++; }
  }
  if (removed !== 11 || unlinked !== 1) throw new Error(`removed ${removed}, unlinked ${unlinked}`);
  const version = await writeRevision(client, page, blocks, {
    change: 'patch',
    message: 'Media: removed eleven YouTube embeds that YouTube now reports as unavailable (oEmbed 404, 8 Oct 2026; playing at the 4 Oct audit), and unlinked the Twitter-demo phrase that pointed at the first of them. Twitch links unchanged.',
    dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
