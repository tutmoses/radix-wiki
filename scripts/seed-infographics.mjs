// scripts/seed-infographics.mjs – embed radix.wiki infographics (brand-assets/NN-*.svg)
// into their wiki pages as a responsive <figure> content block.
//
// Idempotent: keyed on data-graphic="<marker>" (re-run replaces in place). Writes
// one revisions row per changed page. Skips locked pages. Run: node scripts/seed-infographics.mjs
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLockedPage, withClient, embedFigure, readPage } from './wiki-utils.ts';
import { figureBlock } from '../brand-assets/kit.mjs';
try { process.loadEnvFile(); } catch {} // the .env in the working directory, if there is one

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');

const SPECS = [
  {
    file: '01-radix-engine', marker: 'radix-engine',
    tagPath: 'contents/tech/core-protocols', slug: 'radix-engine',
    heading: 'The Radix Engine',
    intro: 'The Radix Engine executes every Scrypto smart contract across four layers, resting on Cerberus consensus. Unlike a general-purpose VM, it is asset-oriented – tokens and NFTs are native primitives rather than balances in a mapping.',
    caption: 'The Radix Engine stack – four layers on Cerberus consensus.',
  },
  {
    file: '02-org-structure', marker: 'radix-org-structure',
    tagPath: 'ecosystem', slug: 'radix-foundation',
    heading: 'Organizational Structure at a Glance',
    intro: 'Radix is run by a family of legal entities – a UK not-for-profit foundation and its wholly-owned subsidiaries – while the core protocol is built by RDX Works, a separate company the Foundation funds. Since 2026 the Foundation has been handing governance over to a community-owned DAO, bridged by the elected Radix Accountability Council.',
    caption: 'The Radix entity group and the 2026 Foundation-to-DAO governance handover.',
  },
  {
    file: '02-org-structure', marker: 'radix-org-structure',
    tagPath: 'contents/tech/core-concepts', slug: 'radix-governance',
    heading: 'The Radix Governance Map',
    intro: 'Radix governance spans a family of legal entities and an in-progress handover from the Radix Foundation to a community-owned DAO. The map below shows who holds what today and where authority is heading.',
    caption: 'The Radix entity group and the 2026 Foundation-to-DAO governance handover.',
  },
  {
    // Figure only: it illustrates the question-headed section it follows, which carries the prose.
    file: '04-cerberus-commit', marker: 'cerberus-commit',
    tagPath: 'contents/tech/core-protocols', slug: 'cerberus-consensus-protocol',
    heading: 'Cerberus Cross-Shard Commit',
    caption: 'Core-Cerberus, from section 4 of the academic paper: four steps per shard, with no vote between shards.',
    place: (blocks) => {
      const i = blocks.findIndex((b) => b.text?.includes('id="cross-shard-commit"'));
      if (i < 0) throw new Error('cross-shard-commit section missing');
      return i + 1;
    },
  },
  ...[
    { file: '05-hyperscale-layers', marker: 'hyperscale-layers', heading: 'Three Layers, One Clock', after: '<h3>One Clock</h3>',
      caption: 'hyperscale-rs runs three consensus mechanisms: the beacon chain assigns committees, each shard orders its own transactions, and execution is voted on separately.' },
    { file: '06-hyperscale-commit', marker: 'hyperscale-commit', heading: 'Cross-Shard Commitment', after: '<h3>Cross-Shard Commitment Without a Coordinator</h3>',
      caption: 'A transaction that touches several shards commits on all of them or aborts on all of them, with no coordinator and no vote between shards.' },
    { file: '07-hyperscale-split', marker: 'hyperscale-split', heading: 'Splitting a Shard', after: '<h3>Dynamic Sharding and Live Resharding</h3>',
      caption: 'A shard splits while it keeps producing blocks, and its children take over once both can seat a full committee.' },
    { file: '08-hyperscale-leg-local', marker: 'hyperscale-leg-local', heading: 'Leg Local Execution', after: 'id="leg-local-execution"',
      caption: 'Leg local execution confines the atomically committed part of a cross-shard swap to the pool shard.' },
  ].map(({ after, ...s }) => ({
    // Figure only, each after the hyperscale-rs section it draws.
    ...s, tagPath: 'contents/tech/research', slug: 'hyperscale-rs',
    place: (blocks) => {
      const i = blocks.findIndex((b) => b.text?.includes(after));
      if (i < 0) throw new Error(`${after} missing`);
      return i + 1;
    },
  })),
];

// The strip/wrap transform is kit.figureBlock — this script used to carry its own
// copy, which is how the border colour here and the kit's could have drifted apart.
function figureHtml(s) {
  const svg = readFileSync(resolve(REPO, `brand-assets/${s.file}.svg`), 'utf8').trim();
  const figure = figureBlock(svg, {
    marker: s.marker,
    label: `radix.wiki infographic – ${s.heading}`,
    caption: s.caption,
  });
  return s.intro ? `<h2>${s.heading}</h2>\n<p>${s.intro}</p>\n${figure}` : figure;
}

await withClient(async (client) => {
  for (const s of SPECS) {
    if (isLockedPage(s.tagPath, s.slug)) { console.log(`LOCKED, skip ${s.tagPath}/${s.slug}`); continue; }
    const page = await readPage(client, s.tagPath, s.slug);
    if (!page) { console.log(`SKIP ${s.tagPath}/${s.slug} – not found`); continue; }

    const res = await embedFigure(client, page, {
      marker: s.marker,
      html: figureHtml(s),
      place: s.place,
      message: `Add the "${s.heading}" infographic.`,
    });
    if (!res) { console.log(`${s.tagPath}/${s.slug}: unchanged, skip`); continue; }
    console.log(`${s.tagPath}/${s.slug}: ${res.action}; ${res.blocks.length} blocks; rev ${res.version}`);
  }
});
