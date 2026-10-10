// Sweep 567 (developers rotation), two stalest pages by updated_at (3 Sep).
// 1. /developers/transactions/04-radix-engine-toolkit named only the TypeScript wrapper's version
//    (1.0.6, 3 Dec 2025). The Rust core and its generated wrappers are a separate 2.x line: PyPI
//    radix-engine-toolkit and NuGet RadixDlt.RadixEngineToolkit both carry 2.3.5, uploaded 25 Mar 2026
//    (PR #161, static-analysis fix, merged 09:21 UTC that day); the last tagged GitHub release is
//    v2.3.0 of 24 Nov 2025 (general subintent transaction type, PR #129). Read 10 Oct 2026.
// 2. /developers/ai-agents/radix-context said setup.sh clones 7 companion repositories in its
//    Installation section and eleven in its Companion Repositories section. setup.sh on main
//    (last push 27 Feb 2026) has eleven clone lines; the context/ directory still holds 23 files.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const RET = 'https://github.com/radixdlt/radix-engine-toolkit';

const PAGES = [
  {
    tagPath: 'developers/transactions',
    slug: '04-radix-engine-toolkit',
    sentinel: 'id="ret-versions"',
    edits: [
      [
        `<tr><td>TypeScript wrapper</td><td>1.0.6, published 3 December 2025</td></tr>`,
        `<tr><td>Core release</td><td><a href="https://pypi.org/project/radix-engine-toolkit/" target="_blank" rel="noopener">2.3.5</a>, published 25 March 2026</td></tr>\n<tr><td>TypeScript wrapper</td><td>1.0.6, published 3 December 2025</td></tr>`,
      ],
      [
        `For anything beyond that, reach for one of the other wrappers or the Rust library.</p>`,
        `For anything beyond that, reach for one of the other wrappers or the Rust library.</p>\n<p id="ret-versions">The two are versioned separately. The Rust core and the generated wrappers are on a 2.x line: <a href="https://pypi.org/project/radix-engine-toolkit/" target="_blank" rel="noopener">radix-engine-toolkit on PyPI</a> and <a href="https://www.nuget.org/packages/RadixDlt.RadixEngineToolkit" target="_blank" rel="noopener">RadixDlt.RadixEngineToolkit on NuGet</a> both shipped 2.3.5 on 25 March 2026, carrying a <a href="${RET}/pull/161" target="_blank" rel="noopener">fix to static analysis</a>. The last tagged GitHub release is <a href="${RET}/releases/tag/v2.3.0" target="_blank" rel="noopener">v2.3.0</a> of 24 November 2025, which added a general subintent transaction type. The TypeScript wrapper stays on 1.x, last published as 1.0.6 on 3 December 2025, so a version number from one line says nothing about the other.</p>`,
      ],
    ],
    change: 'minor',
    message: 'Record the core version line: PyPI radix-engine-toolkit and NuGet RadixDlt.RadixEngineToolkit at 2.3.5 (25 Mar 2026, PR #161 static-analysis fix), last tagged release v2.3.0 (24 Nov 2025), separate from the TypeScript wrapper\'s 1.0.6. Infobox row added. Read 10 Oct 2026.',
  },
  {
    tagPath: 'developers/ai-agents',
    slug: 'radix-context',
    sentinel: 'to clone eleven companion repositories',
    edits: [
      [
        `to clone 7 companion repositories`,
        `to clone eleven companion repositories`,
      ],
    ],
    change: 'patch',
    message: 'Installation section said setup.sh clones 7 companion repositories; setup.sh on main clones eleven, matching the Companion Repositories section. context/ still holds 23 files (read 10 Oct 2026).',
  },
];

await withClient(async (client) => {
  for (const p of PAGES) {
    if (isLockedPage(p.tagPath, p.slug)) throw new Error(`${p.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [p.tagPath, p.slug]);
    if (!rows.length) throw new Error(`${p.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(p.sentinel)) { console.log(`  ${p.slug}: already applied – no write`); continue; }

    const walk = (bs) => bs.flatMap((b) => [b, ...(b.blocks ? walk(b.blocks) : [])]);
    for (const [from, to] of p.edits) {
      const hits = walk(blocks).filter((b) => b.text?.includes(from));
      if (hits.length !== 1) throw new Error(`${p.slug}: matched ${hits.length} blocks for: ${from.slice(0, 60)}`);
      hits[0].text = hits[0].text.replace(from, to);
    }

    const version = await writeRevision(client, page, blocks, { change: p.change, message: p.message, verified: true, dry: DRY });
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  }
});
