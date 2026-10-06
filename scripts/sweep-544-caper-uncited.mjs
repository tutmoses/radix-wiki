// Sweep 544 (caper foundations pass #527): /ecosystem/caper carried four uncited generalities that the 4 Oct
// re-read flagged. The "evergreen utility machines" quote appears nowhere on caper.network or in the Caper
// wiki; the cooperative / anarcho-syndicalist / Austrian synthesis had no source; the governance-maturation
// and treasury-development paragraphs predicted behaviour no caper has shown. Replaced with the argument
// Caper itself publishes (caper.network/blog/the-exit-right: voting power and treasury claim came apart in
// most DAOs; Hirschman, Ostrom) and a treasury paragraph limited to what the contract does: the treasury
// fills from its trade slice and the proposal and vote fees (PROPOSAL_FEE / VOTE_FEE, "banked to the
// treasury", contracts/logic/src/lib.rs) and spends only through a proposal (PAYOUT / INVEST / DIVEST,
// contracts/common/src/lib.rs). Outcome-level, per VOICE.md §4 Caper overlay.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'caper';
const SENTINEL = 'caper.network/blog/the-exit-right';
const DRY = process.argv.includes('--dry-run');
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const EDITS = [
  [/<p>Caper’s core innovation centers on ‘capers’[^]*?<\/p>/,
    `<p>Caper sets out the case for its design in an essay, ${ext('https://caper.network/blog/the-exit-right', 'The Exit Right')}. In most DAOs, it argues, a member's voting power and their claim on the treasury are separate quantities, so votes can be gathered without committing capital and a claim can be held by someone who never governs. Caper ties the two together, and the essay draws on ${ext('https://en.wikipedia.org/wiki/Exit,_Voice,_and_Loyalty', 'Albert Hirschman’s account of exit and voice')} and on the cooperative tradition studied by ${ext('https://en.wikipedia.org/wiki/Elinor_Ostrom', 'Elinor Ostrom')}.</p>`],
  [/<p>The project represents an attempt to synthesize[^]*?<\/p>\s*/, ''],
  [/<p>DAOs experience governance maturation[^]*?<\/p>\s*/, ''],
  [/<p>Successful capers accumulate treasury value[^]*?<\/p>\s*<p>The distinction between collateral backing[^]*?<\/p>/,
    `<p>A caper's treasury fills from its share of the slice taken on every trade of its token and from the fees members pay to open a proposal and to vote, which the contract deposits into it. It spends only through a proposal that passes: a payment to a recipient, an investment that buys another caper's tokens, or a divestment that sells them. ${ext('https://caper.network/wiki/foundations/what-is-a-caper', 'Caper lists the proposal kinds')}.</p>`],
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied – no write');
    process.exit(0);
  }
  for (const [re, to] of EDITS) {
    const block = blocks.find((b) => b.type === 'content' && re.test(b.text));
    if (!block) throw new Error(`no match: ${re.source.slice(0, 60)}`);
    block.text = block.text.replace(re, to);
  }
  const version = '2.9.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 544: removed four uncited passages (an "evergreen utility machines" quote found nowhere in Caper\'s own material, an unsourced ideological synthesis, and governance-maturation and treasury-development predictions). The summary now gives the argument Caper publishes in its essay The Exit Right, and the treasury section says only what the contract does: fills from its trade slice and the proposal and vote fees, spends only through a passed proposal.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
