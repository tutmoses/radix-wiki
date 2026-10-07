// Sweep 549: /blog/building-radixs-developer-pipeline-nine-events-and-counting (dated 2 Feb 2026). Its closing
// paragraph said Polygon "hosted 300-400 hackathons across India in its early stages and now has a market cap of
// $3bn with 2000+ DApps", with no source. Checked 7 Oct 2026: no primary source gives the hackathon count, and
// CoinGecko's history for POL on 2 Feb 2026 reads a market cap of about $1.09bn, so the $3bn was wrong on the
// post's own date. Replaced with what the record supports: Polygon's founders met early team members at ETHIndia
// 2018 (Devfolio), its own BUIDL IT hackathon drew 5,031 registrations (Oct 2021), and from Feb 2022 it sponsored
// every student-run Devfolio hackathon that crossed 500 applications. The argument of the paragraph is unchanged.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'blog';
const SLUG = 'building-radixs-developer-pipeline-nine-events-and-counting';
const SENTINEL = 'devfolio.co/blog/the-legacy-of-ethindia';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const FROM = 'Polygon hosted 300-400 hackathons across India in its early stages and now has a market cap of $3bn with 2000+ DApps - far more than Ethereum relative to its size.';
const TO = `Polygon grew the same way: its founders ${ext('https://devfolio.co/blog/the-legacy-of-ethindia/', 'met many of their first team members at ETHIndia 2018')}, its own BUIDL IT hackathon drew 5,031 registrations in October 2021, and from February 2022 it ${ext('https://devfolio.co/blog/announcing-monetary-sponsorship-for-all-community-hackathons-on-devfolio-by-polygon/', 'sponsored every student-run hackathon on Devfolio that crossed 500 applications')}.`;

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied — no write'); return; }

  const hits = blocks.filter((b) => typeof b.text === 'string' && b.text.includes(FROM));
  if (hits.length !== 1) throw new Error(`expected 1 match, got ${hits.length}`);
  hits[0].text = hits[0].text.replace(FROM, () => TO);

  const version = await writeRevision(client, page, blocks, {
    change: 'patch',
    message: 'Sweep 549: the unsourced Polygon line (300-400 hackathons, $3bn, 2000+ DApps) replaced with sourced facts; POL was about $1.09bn on the post date (CoinGecko).',
    verified: true,
    dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
