/**
 * Run 502 (contents/resources rotation) – rebuild /contents/resources/radix-ecosystem-operational-status
 * from the directory's own status fields, as run 369 did on 5 September.
 *
 * Measured 28 September: the page still read 57 / 8 / 49 / 35 over 149 where the directory says
 * 56 / 8 / 53 / 35 over 152. Bullring (run 479), Surge and Radix Labs had moved to Dormant on their
 * own pages and were still listed operational; Proven Network had moved from In development to
 * Dormant and still carried its old "(In development)" note; Apollo Pool, Flux and Radix Arena were
 * never indexed.
 *
 * Same bucketing as sweep-369, with two changes: a parenthetical status note on an <li> is
 * recomputed from the page's current status rather than carried over, and Liquify's 20 August
 * "not resolving" note is replaced – liquifyxrd.app answers 403 with x-vercel-mitigated: deny,
 * a Vercel firewall refusal on a deployment that exists.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, esc } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/resources';
const SLUG = 'radix-ecosystem-operational-status';
const DRY = process.argv.includes('--dry-run');
const SENTINEL = 'rebuilt from the directory on 28 September';

const HEAD_STATUSES = new Set(['🟢 Active', '🟡 Testnet', '🟠 Dormant', '🔴 Closed']);
const BUCKETS = [
  { head: 'Operational', match: (s) => s === '🟢 Active' },
  { head: 'Testnet, pre-launch and in development', match: (s) => s.startsWith('🟡') || s === '🟠 In development' },
  { head: 'Dormant', match: (s) => s === '🟠 Dormant' },
  { head: 'Closed and departed', match: (s) => s.startsWith('🔴') },
];

const byTitle = (a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' });
const statusNote = (s) => (HEAD_STATUSES.has(s) ? '' : ` <em>(${esc(s.replace(/^\S+\s/, ''))})</em>`);

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

const LIQUIFY_LI = '<li><a href="/ecosystem/liquify" rel="noopener">Liquify</a> <em>– website refuses automated checks with a Vercel firewall 403, not a missing deployment (read 2026-09-28)</em></li>';

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
    console.log('  already applied – no write');
    process.exit(0);
  }

  const existingLi = new Map();
  for (const b of blocks) {
    for (const m of (b.text || '').matchAll(/<li><a href="\/ecosystem\/([a-z0-9-]+)"[\s\S]*?<\/li>/g)) {
      existingLi.set(m[1], m[0]);
    }
  }

  const { rows: dir } = await client.query(
    `SELECT slug, title, metadata->>'status' AS status, metadata->>'category' AS cat
     FROM pages WHERE tag_path = 'ecosystem' AND slug <> ''`);
  const missing = dir.filter((p) => !p.cat || !p.status);
  if (missing.length) throw new Error(`directory rows without status/category: ${missing.map((p) => p.slug).join(', ')}`);

  const liFor = (p) => {
    if (p.slug === 'liquify') return LIQUIFY_LI;
    const base = `<li><a href="/ecosystem/${p.slug}" rel="noopener">${esc(p.title)}</a>`;
    const old = existingLi.get(p.slug);
    // Keep probe annotations verbatim; recompute a bare "(status)" note from the current field.
    if (old && !/^<li><a [^>]+>[^<]*<\/a>( <em>\([^<]*\)<\/em>)?<\/li>$/.test(old)) return old;
    return `${base}${statusNote(p.status)}</li>`;
  };

  const counts = {};
  const listIdx = blocks.map((b, i) => [b, i]).filter(([b]) => /<h2>(Operational|Testnet, pre-launch|Dormant|Closed and departed)/.test(b.text || ''));
  if (listIdx.length !== 4) throw new Error(`expected 4 list blocks, found ${listIdx.length}`);

  BUCKETS.forEach((bucket, n) => {
    const items = dir.filter((p) => bucket.match(p.status));
    counts[bucket.head] = items.length;
    const idx = listIdx[n][1];
    const before = blocks[idx].text;
    blocks[idx].text = renderBucket(bucket.head, items, liFor);
    const was = new Set([...before.matchAll(/href="\/ecosystem\/([a-z0-9-]+)"/g)].map((m) => m[1]));
    const now = new Set(items.map((p) => p.slug));
    console.log(`  ${bucket.head}: ${was.size} -> ${now.size}  +[${[...now].filter((s) => !was.has(s))}]  -[${[...was].filter((s) => !now.has(s))}]`);
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total !== dir.length) throw new Error(`bucket total ${total} != directory ${dir.length}`);
  const [op, tn, dm, cl] = BUCKETS.map((b) => counts[b.head]);

  const ib = blocks.find((b) => b.type === 'infobox');
  const row = (label, value) => {
    const re = new RegExp(`(<td><strong>${label}</strong></td><td>)[\\s\\S]*?(</td>)`);
    const nested = ib.blocks[0];
    if (!re.test(nested.text)) throw new Error(`infobox row not found: ${label}`);
    nested.text = nested.text.replace(re, `$1${value}$2`);
  };
  row('Covers', `All ${total} project pages under <a href="/ecosystem" rel="noopener">Ecosystem</a>`);
  row('Operational', String(op));
  row('Testnet / pre-launch', String(tn));
  row('Dormant', String(dm));
  row('Closed / departed', String(cl));
  row('Last rebuilt', '2026-09-28');

  const check = blocks.find((b) => b.id === '638b110c-ea26-435f-bb95-174eb6c562a7');
  if (!check) throw new Error('"How this is checked" block missing');
  check.text += `\n<p>The lists below were ${SENTINEL}, the first rebuild since 5 September. In those three weeks four projects changed status on their own pages and kept their old line here: <a href="/ecosystem/bullring" rel="noopener">Bullring</a>, <a href="/ecosystem/surge" rel="noopener">Surge</a> and <a href="/ecosystem/radix-labs" rel="noopener">Radix Labs</a> moved from operational to dormant, and <a href="/ecosystem/proven-network" rel="noopener">Proven Network</a> from in development to dormant. Three pages added to the directory in the same period, <a href="/ecosystem/apollo-pool" rel="noopener">Apollo Pool</a>, <a href="/ecosystem/flux" rel="noopener">Flux</a> and <a href="/ecosystem/radix-arena" rel="noopener">Radix Arena</a>, had no line at all. The headline moves from 57 / 8 / 49 / 35 over 149 to ${op} / ${tn} / ${dm} / ${cl} over ${total}. <a href="/ecosystem/liquify" rel="noopener">Liquify</a>'s note changed too: its site answers automated requests with HTTP 403 and the header <code>x-vercel-mitigated: deny</code>, which is Vercel's firewall turning a crawler away from a deployment that exists, not a site that has gone.</p>`;

  const version = '1.22.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${op}/${tn}/${dm}/${cl} over ${total})`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       `Rebuilt the four status lists from each project page's own status field. Bullring, Surge and Radix Labs moved to dormant and Proven Network from in development to dormant on their own pages; Apollo Pool, Flux and Radix Arena had never been indexed: 57/8/49/35 over 149 becomes ${op}/${tn}/${dm}/${cl} over ${total}. Liquify's note corrected: its 403 is a Vercel firewall deny, not a missing site.`, now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
