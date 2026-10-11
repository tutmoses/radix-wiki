// Run 574 (contents/resources rotation): three orphaned pages get an inbound link from the article
// they belong to. Token Unlock from $XRD Token's supply section, Finite State Machines from the
// Transaction Tracker (the FSM page names the tracker as where an intent's lifecycle is enforced),
// and the wiki's own directory entry from the MCP Server page's infobox.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');

const EDITS = [
  {
    tagPath: 'contents/tech/core-protocols',
    slug: 'xrd-token',
    sentinel: 'href="/contents/history/token-unlock"',
    find: '</a>).</p><p>Because emissions',
    replace: '</a>). Not all of those tokens could move at first: the ones still held under a price-based lock were released together on 15 September 2021, after two community surveys favoured an immediate unlock (<a href="/contents/history/token-unlock" rel="noopener">Token Unlock</a>, <a href="https://www.radixdlt.com/blog/final-token-unlock-complete" target="_blank" rel="noopener">Radix blog</a>).</p><p>Because emissions',
    message: 'Supply and Emissions: one sentence on the 15 September 2021 release of the price-locked XRD, linking the Token Unlock history page (previously linked from nowhere) and the Radix blog post confirming the unlock.',
  },
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'transaction-tracker',
    sentinel: 'href="/contents/tech/core-concepts/finite-state-machines"',
    find: 'not a mempool guess.</p>',
    replace: 'not a mempool guess.</p><p>Together these make the life of an intent a small <a href="/contents/tech/core-concepts/finite-state-machines" rel="noopener">finite state machine</a>: once an intent is recorded as committed, it cannot be committed again, and the tracker is the part of the ledger that enforces it.</p>',
    message: 'What it records: links Finite State Machines, which describes the intent lifecycle this blueprint enforces and was previously linked from nowhere.',
  },
  {
    tagPath: 'contents/resources',
    slug: 'mcp-server',
    sentinel: 'href="/ecosystem/radix-wiki"',
    find: 'rel="noopener">Brand Assets</a></td></tr>',
    replace: 'rel="noopener">Brand Assets</a> · <a href="/ecosystem/radix-wiki" rel="noopener">RADIX.wiki</a></td></tr>',
    message: 'Infobox Related: adds the wiki\'s own ecosystem directory entry, previously linked from nowhere.',
  },
];

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.slug}: page not found`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(e.sentinel)) {
      console.log(`  ${page.title}: already applied – no write`);
      continue;
    }
    const walk = (bs) => bs.flatMap((b) => [b, ...(b.blocks ? walk(b.blocks) : [])]);
    const hits = walk(blocks).filter((b) => b.text?.includes(e.find));
    if (hits.length !== 1) throw new Error(`${e.slug}: anchor found ${hits.length} times`);
    hits[0].text = hits[0].text.replace(e.find, e.replace);

    const version = await writeRevision(client, page, blocks, { change: 'patch', message: e.message, dry: DRY });
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  }
});
