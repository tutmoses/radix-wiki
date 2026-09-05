// scripts/seed-infographics.mjs – embed radix.wiki infographics (brand-assets/NN-*.svg)
// into their wiki pages as a responsive <figure> content block.
//
// Idempotent: keyed on data-graphic="<marker>" (re-run replaces in place). Writes
// one revisions row per changed page. Skips locked pages. Run: node scripts/seed-infographics.mjs
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isLockedPage, withClient, embedFigure } from './seed-utils.mjs';
import { figureBlock } from '../brand-assets/kit.mjs';
config();

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
  return `<h2>${s.heading}</h2>\n<p>${s.intro}</p>\n${figure}`;
}

await withClient(async (client) => {
  for (const s of SPECS) {
    if (isLockedPage(s.tagPath, s.slug)) { console.log(`LOCKED, skip ${s.tagPath}/${s.slug}`); continue; }
    const { rows } = await client.query('SELECT id, title, content, version FROM pages WHERE tag_path = $1 AND slug = $2', [s.tagPath, s.slug]);
    if (!rows[0]) { console.log(`SKIP ${s.tagPath}/${s.slug} – not found`); continue; }

    const res = await embedFigure(client, rows[0], {
      marker: s.marker,
      html: figureHtml(s),
      message: `Add the "${s.heading}" infographic.`,
    });
    if (!res) { console.log(`${s.tagPath}/${s.slug}: unchanged, skip`); continue; }
    console.log(`${s.tagPath}/${s.slug}: ${res.action}; ${res.blocks.length} blocks; rev ${res.version}`);
  }
});
