// Sweep 553 (policy rotation, orphaned-queue fix forward): link two orphaned
// core-concepts articles from the pages that already discuss their subject.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');

const EDITS = [
  {
    tagPath: 'contents/tech/research', slug: 'hyperscale-500k-tps',
    find: 'could sustain over 500,000 transactions per second',
    replace: 'could sustain over 500,000 <a href="/contents/tech/core-concepts/transactions-per-second-tps" rel="noopener">transactions per second</a>',
    sentinel: '/contents/tech/core-concepts/transactions-per-second-tps',
    message: 'Link the orphaned Transactions Per Second (TPS) article from the Overview (orphaned queue, sweep 553).',
  },
  {
    tagPath: 'contents/tech/core-concepts', slug: 'byzantine-fault-tolerance',
    find: 'Below that bound the honest supermajority can always outvote',
    replace: 'Below that bound the honest supermajority (the <a href="/contents/tech/core-concepts/honest-majority-assumption" rel="noopener">honest majority assumption</a> in its BFT form) can always outvote',
    sentinel: '/contents/tech/core-concepts/honest-majority-assumption',
    message: 'Link the orphaned Honest Majority Assumption article where the page states the one-third bound (orphaned queue, sweep 553).',
  },
];

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(e.sentinel)) { console.log(`  ${e.slug}: already applied, no write`); continue; }
    const hits = blocks.filter((b) => b.text?.includes(e.find));
    if (hits.length !== 1) throw new Error(`${e.slug}: expected 1 block containing find string, got ${hits.length}`);
    hits[0].text = hits[0].text.replace(e.find, e.replace);
    const version = await writeRevision(client, page, blocks, { change: 'patch', message: e.message, dry: DRY });
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  }
});
