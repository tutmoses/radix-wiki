// scripts/seed-infographics.mjs – embed radix.wiki infographics (brand-assets/NN-*.svg)
// into their wiki pages as a responsive <figure> content block.
//
// Idempotent: keyed on data-graphic="<marker>" (re-run replaces in place). Writes
// one revisions row per changed page. Skips locked pages. Run: node scripts/seed-infographics.mjs
import pg from 'pg';
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { uid, cuid, AUTHOR_ID } from './seed-utils.mjs';
import { figureBlock } from '../brand-assets/kit.mjs';
config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const LOCKED = new Set(['ecosystem/radix-namespace', 'ecosystem/xrd-domains']);

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
    // One section, not two: the prose spent a hundred words saying what the
    // figure shows, so "Where to start" and "The route to mastery" are one
    // block now — a short lead, then the map, whose every box is a link.
    file: '03-developer-path', marker: 'radix-developer-path',
    tagPath: 'developers', slug: '',
    after: '<h2>Introduction</h2>',
    interactive: true,
    heading: 'Where to start',
    intro: '<a href="/developers/getting-started/01-install-scrypto">Installing Scrypto</a> is step one for everyone — the toolchain, a first blueprint, a package deployed to <a href="/contents/tech/releases/stokenet">Stokenet</a>. After that the map is the order. Give <a href="/developers/transactions/01-manifest-language">manifests</a> more time than their position suggests: a Radix transaction states what it intends to do in a form the <a href="/contents/tech/core-protocols/radix-wallet">wallet</a> can show a user before they sign it.',
    caption: 'Four sequential stages, then three branches. Every box links to its section.',
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
    interactive: s.interactive === true,
  });
  return `<h2>${s.heading}</h2>\n<p>${s.intro}</p>\n${figure}`;
}

const bumpMinor = (v) => {
  const m = (v ?? '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  return m ? `${m[1]}.${Number(m[2]) + 1}.0` : '1.1.0';
};

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  for (const s of SPECS) {
    if (LOCKED.has(`${s.tagPath}/${s.slug}`)) { console.log(`LOCKED, skip ${s.tagPath}/${s.slug}`); continue; }
    const { rows } = await client.query('SELECT id, title, content, version FROM pages WHERE tag_path = $1 AND slug = $2', [s.tagPath, s.slug]);
    if (!rows[0]) { console.log(`SKIP ${s.tagPath}/${s.slug} – not found`); continue; }
    const page = rows[0];
    const blocks = Array.isArray(page.content) ? page.content : [];
    const html = figureHtml(s);
    const marker = `data-graphic="${s.marker}"`;
    const idx = blocks.findIndex((b) => b.type === 'content' && typeof b.text === 'string' && b.text.includes(marker));

    if (idx >= 0 && blocks[idx].text === html) { console.log(`${s.tagPath}/${s.slug}: unchanged, skip`); continue; }
    let action;
    if (idx >= 0) { blocks[idx] = { ...blocks[idx], text: html }; action = `replaced [${idx}]`; }
    else {
      // `after` puts the figure where it belongs in the argument rather than at
      // the end of the article, which on a long hub is past the resource lists.
      const at = s.after
        ? blocks.findIndex((b) => b.type === 'content' && typeof b.text === 'string' && b.text.includes(s.after))
        : -1;
      if (s.after && at < 0) { console.log(`SKIP ${s.tagPath}/${s.slug} – anchor "${s.after}" not found`); continue; }
      const pos = at >= 0 ? at + 1 : blocks.length;
      blocks.splice(pos, 0, { id: uid(), type: 'content', text: html });
      action = `inserted [${pos}]`;
    }

    const version = bumpMinor(page.version);
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content = $1, version = $2, updated_at = $3 WHERE id = $4',
      [JSON.stringify(blocks), version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [cuid(), page.id, JSON.stringify(blocks), page.title, version, 'minor', AUTHOR_ID, `Add the "${s.heading}" infographic.`, now]);
    await client.query('COMMIT');
    console.log(`${s.tagPath}/${s.slug}: ${action}; ${blocks.length} blocks; rev ${version}`);
  }
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
  await pool.end();
}
