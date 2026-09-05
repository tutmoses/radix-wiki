/**
 * Run 369 (ecosystem rotation) — rebuild /contents/resources/radix-ecosystem-operational-status
 * from the directory it claims to be generated from.
 *
 * The page says "the index is generated from those fields rather than maintained by hand", but it
 * was last rebuilt on 2026-08-23 and has been incremented by hand since. Measured 2026-09-05:
 *   - three ecosystem pages are absent entirely (rswap, hyperlane, runfly — all 🟢 Active)
 *   - five pages sit in Operational whose own status has since moved
 *     (crumbsup, pokerxrd, radix-list, the-meme-studio → 🟠 Dormant; academia-scrypto → 🔴 Closed)
 * so the headline counts read 61/8/44/34 over 147 where the directory says 59/8/48/35 over 150.
 *
 * Rebuild rather than patch: bucket every ecosystem page by its own metadata.status, keeping each
 * existing <li> verbatim so the inline probe annotations survive, and re-render the four list
 * blocks. Also records the day-six halt reading.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage, esc } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/resources';
const SLUG = 'radix-ecosystem-operational-status';
const DRY = process.argv.includes('--dry-run');
const SENTINEL = 'rebuilt from the directory on 5 September';

const BUCKETS = [
  { head: 'Operational', match: (s) => s === '🟢 Active' },
  { head: 'Testnet, pre-launch and in development', match: (s) => s.startsWith('🟡') || s === '🟠 In development' },
  { head: 'Dormant', match: (s) => s === '🟠 Dormant' },
  { head: 'Closed and departed', match: (s) => s.startsWith('🔴') },
];

const byTitle = (a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' });

const renderBucket = (head, items, liFor) => {
  const cats = [...new Set(items.map((p) => p.cat))].sort((a, b) => a.localeCompare(b, 'en'));
  const out = [`<h2>${head} (${items.length})</h2>`];
  for (const cat of cats) {
    out.push(`<h3>${esc(cat)}</h3>`, '<ul>');
    for (const p of items.filter((x) => x.cat === cat).sort(byTitle)) out.push(liFor(p));
    out.push('</ul>');
  }
  return out.join('\n');
};

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);

  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (blocks.some((b) => b.text?.includes(SENTINEL))) {
    console.log('  already applied — no write');
    process.exit(0);
  }

  // Every <li> already on the page, keyed by slug, so probe annotations survive the move.
  const existingLi = new Map();
  for (const b of blocks) {
    for (const m of (b.text || '').matchAll(/<li><a href="\/ecosystem\/([a-z0-9-]+)"[\s\S]*?<\/li>/g)) {
      existingLi.set(m[1], m[0]);
    }
  }

  const { rows: dir } = await client.query(
    `SELECT slug, title, metadata->>'status' AS status, metadata->>'category' AS cat
     FROM pages WHERE tag_path = 'ecosystem' AND slug <> ''`);
  const missingCat = dir.filter((p) => !p.cat || !p.status);
  if (missingCat.length) throw new Error(`directory rows without status/category: ${missingCat.map((p) => p.slug).join(', ')}`);

  const liFor = (p) => existingLi.get(p.slug)
    ?? `<li><a href="/ecosystem/${p.slug}" rel="noopener">${esc(p.title)}</a></li>`;

  const counts = {};
  const listIdx = blocks.map((b, i) => [b, i]).filter(([b]) => /<h2>(Operational|Testnet, pre-launch|Dormant|Closed and departed)/.test(b.text || ''));
  if (listIdx.length !== 4) throw new Error(`expected 4 list blocks, found ${listIdx.length}`);

  BUCKETS.forEach((bucket, n) => {
    const items = dir.filter((p) => bucket.match(p.status));
    counts[bucket.head] = items.length;
    const idx = listIdx[n][1];
    const before = blocks[idx].text;
    blocks[idx].text = renderBucket(bucket.head, items, liFor);
    if (DRY) {
      const was = (before.match(/<li>/g) || []).length;
      console.log(`  ${bucket.head}: ${was} -> ${items.length}${before === blocks[idx].text ? '  (byte-identical)' : ''}`);
    }
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total !== dir.length) throw new Error(`bucket total ${total} != directory ${dir.length}`);

  // Infobox: the counts, the coverage, the rebuild date and the halt clock.
  const ib = blocks.find((b) => b.type === 'infobox');
  const row = (label, value) => {
    const re = new RegExp(`(<td><strong>${label}</strong></td><td>)[\\s\\S]*?(</td>)`);
    const nested = ib.blocks[0];
    if (!re.test(nested.text)) throw new Error(`infobox row not found: ${label}`);
    nested.text = nested.text.replace(re, `$1${value}$2`);
  };
  row('Covers', `All ${total} project pages under <a href="/ecosystem" rel="noopener">Ecosystem</a>`);
  row('Operational', String(counts['Operational']));
  row('Testnet / pre-launch', String(counts['Testnet, pre-launch and in development']));
  row('Dormant', String(counts['Dormant']));
  row('Closed / departed', String(counts['Closed and departed']));
  row('Network status', 'Mainnet halted since 21:19 UTC, 31 August 2026; no restart date announced as of 07:03 UTC, 5 September &mdash; see the notice below');
  row('Last rebuilt', '2026-09-05');

  // Day six of the halt, and the rebuild note, appended to the halt section.
  const haltIdx = blocks.findIndex((b) => (b.text || '').includes('id="network-halt"'));
  if (haltIdx < 0) throw new Error('halt section not found');
  blocks[haltIdx].text += '\n<p><strong>Day six, and the ledger has still not moved.</strong> Read at <strong>07:03:18&nbsp;UTC on 5 September</strong>, the <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a> returns the same last committed ledger for a twenty-third consecutive check &mdash; state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179&nbsp;UTC &mdash; one hundred and five hours and forty-four minutes without a committed round, and <code>/state/validators/list</code> answers HTTP 500 at a sync delay of <strong>380,683 seconds</strong> against the 720 the Gateway tolerates. <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> is unaffected and advancing normally, at epoch 2,247 and state version 5,580,586 in the same pass. The <a href="https://t.me/RadixAccountabilityCouncil/971" target="_blank" rel="noopener">11:02&nbsp;UTC update of 4 September</a> is still the council’s latest word, twenty hours later.</p>'
    + `\n<p><strong>The lists below were ${SENTINEL} rather than incremented.</strong> This page states above that it is generated from the <code>status</code> field on each project page, and between the 23 August rebuild and today it was kept up by hand instead: three pages added to the directory since &mdash; <a href="/ecosystem/hyperlane" rel="noopener">Hyperlane</a>, <a href="/ecosystem/rswap" rel="noopener">RSwap</a> and <a href="/ecosystem/runfly" rel="noopener">Run Fly</a> &mdash; had never been indexed at all, and five entries were still listed as operational after their own pages had moved on (<a href="/ecosystem/crumbsup" rel="noopener">CrumbsUp</a>, <a href="/ecosystem/pokerxrd" rel="noopener">PokerXRD</a>, <a href="/ecosystem/radix-list" rel="noopener">Radix List</a> and <a href="/ecosystem/the-meme-studio" rel="noopener">The Meme Studio</a> to dormant, <a href="/ecosystem/academia-scrypto" rel="noopener">Academia Scrypto</a> to closed). Re-reading every page’s own field moves the headline from 61 / 8 / 44 / 34 over 147 to <strong>${counts['Operational']} / ${counts['Testnet, pre-launch and in development']} / ${counts['Dormant']} / ${counts['Closed and departed']} over ${total}</strong>. That Hyperlane in particular was missing is worth stating plainly: the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">bridge whose drain preceded the halt</a> had no line in the network’s own operational index.</p>`;

  const version = '1.11.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${total} pages: ${JSON.stringify(counts)})`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       `Rebuilt the four status lists from each project page's own status field, which is what this page says it does. Three pages had never been indexed (Hyperlane, RSwap, Run Fly) and five were still listed operational after moving (CrumbsUp, PokerXRD, Radix List, The Meme Studio, Academia Scrypto): 61/8/44/34 over 147 becomes ${counts['Operational']}/${counts['Testnet, pre-launch and in development']}/${counts['Dormant']}/${counts['Closed and departed']} over ${total}. Adds the day-six halt reading, 105h44m at 07:03 UTC.`, now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
