// scripts/sweep-362-developer-path-html.mjs
//
// Replaces the clickable-SVG route map on the Developers hub with an ordinary
// HTML stepper. The diagram carried seven <a> boxes, which worked but was an
// invented pattern: nothing about a picture says it can be clicked, and the
// 920px canvas scaled into a phone column rendered its labels at roughly eight
// pixels. Rows of real links hover, focus, reflow, and need no explaining.
//
// The figure is not deleted from the repo — brand-assets/03-developer-path.*
// still builds, and the 2x PNG is the social card for this section.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'developers';
const FIGURE_MARKER = 'data-graphic="radix-developer-path"';
const SENTINEL = 'class="path-step-head"';

const W = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;

const STAGES = [
  { slug: 'getting-started', name: 'Getting Started', meta: '3 guides · Beginner',
    desc: 'Install the toolchain, write a first blueprint, deploy to Stokenet and then mainnet.' },
  { slug: 'scrypto', name: 'Scrypto', meta: '9 guides · Beginner to Advanced',
    desc: 'Resources and NFTs, authorization and badges, testing, and the design patterns.' },
  { slug: 'transactions', name: 'Transactions', meta: '5 guides · Intermediate to Advanced',
    desc: 'The manifest language, the transaction lifecycle, fees, addresses and entity types.' },
  { slug: 'frontend', name: 'Frontend', meta: '4 guides · Intermediate',
    desc: 'The dApp Toolkit, the Gateway SDK, ROLA wallet login, and dApp verification.' },
];

const BRANCHES = [
  ['infrastructure', 'Infrastructure'],
  ['ai-agents', 'AI Agents'],
  ['tools', 'Tools'],
];

const step = (s, n) => `<li class="path-step">`
  + `<a class="path-step-link" href="/developers/${s.slug}" rel="noopener">`
  + `<span class="path-step-num">${n}</span>`
  + `<span class="path-step-main">`
  + `<span class="path-step-head">`
  + `<span class="path-step-title">${s.name}</span>`
  + `<span class="path-step-meta">${s.meta}</span>`
  + `</span>`
  + `<span class="path-step-desc">${s.desc}</span>`
  + `</span>`
  + `</a></li>`;

const SECTION = `<h2>Where to start</h2>
<p>${W('/developers/getting-started/01-install-scrypto', 'Installing Scrypto')} is step one for everyone &ndash; the toolchain, a first blueprint, a package deployed to ${W('/contents/tech/releases/stokenet', 'Stokenet')}. After that these four are a sequence, each assuming the one above it. Give ${W('/developers/transactions/01-manifest-language', 'manifests')} more time than their position suggests: a Radix transaction states what it intends to do in a form the ${W('/contents/tech/core-protocols/radix-wallet', 'wallet')} can show a user before they sign it.</p>
<ol class="path">${STAGES.map((s, i) => step(s, i + 1)).join('')}</ol>
<p class="path-branches">Then, as the project needs it: ${BRANCHES.map(([slug, name]) => W(`/developers/${slug}`, name)).join(', ')}.</p>`;

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG, '')) throw new Error('developers hub is LOCKED');
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, '']);
  if (!rows.length) throw new Error('developers hub not found');
  const page = rows[0];

  // Against the block texts, not JSON.stringify(content): the serialised form
  // escapes the quotes, so a sentinel carrying one never matches and the guard
  // silently passes on every run.
  if (page.content.some((b) => typeof b.text === 'string' && b.text.includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  const blocks = JSON.parse(JSON.stringify(page.content));
  // Matches the original SVG figure or this script's own output, so a markup
  // revision re-runs cleanly instead of failing on its first success.
  const at = blocks.findIndex((b) => b.type === 'content' && typeof b.text === 'string'
    && (b.text.includes(FIGURE_MARKER) || b.text.includes('class="path"')));
  if (at < 0) throw new Error('neither the figure block nor an existing path block was found');

  blocks[at] = { id: uid(), type: 'content', text: SECTION };

  const version = '3.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  ${DRY ? '[dry] ' : ''}block [${at}]: SVG figure -> ${STAGES.length}-step HTML path + ${BRANCHES.length} branch links`);
  if (DRY) process.exit(0);

  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
     'Replace the clickable-SVG route map with an HTML stepper: a diagram gives no affordance that it can be clicked, and a 920px canvas is unreadable in a phone column. Same four stages and three branches, as real links.', now]);
  await client.query('COMMIT');
  console.log('  committed');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
