// scripts/update-long-paragraphs.mjs
//
// Semrush Site Audit, crawl of 1 September 2026: "paragraphs are too long" on
// nine pages. Re-measured on 28 September against the stored pages, the six
// below still carried paragraphs over 150 words, hyperscale-rs 32 of them at up
// to 216. One page is gone (community/daffy) and two no longer qualify.
//
// Split only: each marker is the opening words of a sentence, and the script
// closes the paragraph before it and opens a new one there. No word changes.
// A marker (raw HTML where the sentence opens on a link) must occur once on
// its page, sit inside a <p>, follow sentence-end punctuation, and have every
// inline tag before it closed – anything else throws. A marker already opening
// a paragraph is skipped, so a re-run is a no-op.
//
// Left long on purpose: hyperscale-rs's non-goals paragraph (153 words), where
// every break leaves a "that" or "it" pointing into the previous paragraph, and
// the 9 August Week in Review (157), where the two-paragraph block rule would
// need a new heading rather than a split.
//
// The Hyperlane page also swaps its raw notices.json citation, which Semrush
// reports as a resource linked as a page, for the Notices & Records page that
// renders the same record.

import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const MAX_WORDS = 150;

const EDITS = [
  {
    tagPath: 'contents/tech/research',
    slug: 'hyperscale-rs',
    splits: [
      'Every committee lookup in the system',
      'Destinations group provisioned transactions',
      'Two days later he added',
      'The <a href="https://github.com/hyperscalers/hyperscale-rs/blob/main/docs/05-byzantine-safety.md"',
      'The fence engages from the moment',
      'With enshrined checkpoints attested',
      'The companion INV-EXEC-4',
      'He has also put the cost of the alternative plainly',
      'Exclusive whole-object locks are replaced',
      'Three operational rules ride the pin.',
      'A migration that requires every package to be rebuilt',
      'The written document and the channel now say',
      'The first of those has a very recent illustration.',
      'And asked at 18:32 whether',
      'projectShift answered that',
      '<strong>The block states a frontier',
      '<strong>Advancing is obliged',
      'What stops a sweep retiring something still in use',
      'On 1 September the set closed',
      'Neither side verifies signatures',
      'What is <em>not</em> extrapolation',
      'Running nodes on phones was raised',
      'Both halves are protocol rather than rhetoric.',
      'The fourth question, on whether the architecture',
      'Work began in mid-May 2026.',
      'He had put the same point more plainly',
      'The halving it describes',
      'For <a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi\'an</a> the consequence',
      'No payment record has been published, and the sum is not stated',
      'On the tokens already earmarked for it',
      'He asked <a href="https://t.me/hyperscale_rs/12244"',
    ],
  },
  {
    tagPath: 'contents/history',
    slug: 'hyperlane-asset-drain-2026',
    splits: [
      'Five hours later the cause was stated publicly',
      'So the attacker did not need to defeat an authority.',
      'Six hours in, the only public account',
      'And the exploit\'s payload drew a forensic note',
      'At 20:30 a call between the Foundation',
      'Both halves are now running',
    ],
    replacements: [['https://radixdao.org/notices.json', 'https://radixdao.org/notices/']],
    note: 'the DAO notice citation points at its Notices & Records page rather than the raw notices.json file',
  },
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'radix-governance',
    splits: [
      'Until 13 August 2026 the badge sat',
      'The May 2026 <a href="/contents/tech/releases/radix-mainnet-xian"',
      'During the transition, then,',
    ],
  },
  {
    tagPath: 'ecosystem',
    slug: 'radix-foundation',
    splits: [
      'Hughes and Ridyard are the co-founders',
      'No PSC statement has been filed',
    ],
  },
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'validator-nodes',
    splits: ['A non-null request does not mean a change is coming.'],
  },
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'access-controller',
    splits: ['A live read of the native package on mainnet'],
  },
];

/** Every content block's text, wherever it sits in the tree. */
function contentBlocks(blocks, out = []) {
  for (const b of blocks) {
    if (b.type === 'content') out.push(b);
    if (Array.isArray(b.blocks)) contentBlocks(b.blocks, out);
    if (Array.isArray(b.columns)) for (const c of b.columns) contentBlocks(c.blocks || [], out);
  }
  return out;
}

const INLINE = /<(\/?)(a|strong|em|b|i|code|span|sup|sub|mark|s|u)\b[^>]*>/g;

/** Close the paragraph before `marker` and open a new one. Returns false when already split. */
function split(leaves, marker) {
  const hits = leaves.flatMap(b => {
    const at = [];
    for (let i = b.text.indexOf(marker); i >= 0; i = b.text.indexOf(marker, i + 1)) at.push(i);
    return at.map(i => ({ b, i }));
  });
  if (hits.length !== 1) throw new Error(`"${marker}" occurs ${hits.length} times`);
  const { b, i } = hits[0];
  const before = b.text.slice(0, i);
  const trimmed = before.replace(/\s+$/, '');
  if (/<p>$/.test(trimmed)) return false;
  const open = before.lastIndexOf('<p>');
  if (open < 0 || before.lastIndexOf('</p>') > open) throw new Error(`"${marker}" is not inside a <p>`);
  // A sentence can end inside a link or a quotation: `…motivation.&rdquo;</a>`.
  const tail = trimmed.replace(/(<\/(a|strong|em|b|i|code|span)>)+$/, '');
  if (!/([.!?"”’)]|&rdquo;|&rsquo;|&quot;)$/.test(tail)) throw new Error(`"${marker}" does not follow the end of a sentence`);
  let depth = 0;
  for (const [, close] of before.slice(open).matchAll(INLINE)) depth += close ? -1 : 1;
  if (depth !== 0) throw new Error(`"${marker}" sits inside an inline element`);
  b.text = `${trimmed}</p><p>${b.text.slice(i)}`;
  return true;
}

const words = html => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const longParagraphs = leaves => leaves
  .flatMap(b => [...b.text.replace(/<blockquote.*?<\/blockquote>|<table.*?<\/table>/gs, '').matchAll(/<p>(.*?)<\/p>/gs)])
  .map(m => m[1]).filter(p => words(p) > MAX_WORDS);

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const edit of EDITS) {
    const { tagPath, slug } = edit;
    if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [tagPath, slug]);
    if (!rows.length) throw new Error(`${tagPath}/${slug} not found`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    const leaves = contentBlocks(blocks);
    const before = longParagraphs(leaves).length;
    const made = edit.splits.filter(m => split(leaves, m)).length;
    let swapped = 0;
    for (const [from, to] of edit.replacements ?? []) {
      for (const b of leaves) {
        if (!b.text.includes(from)) continue;
        b.text = b.text.split(from).join(to);
        swapped++;
      }
    }
    if (!made && !swapped) {
      console.log(`  ${tagPath}/${slug}: already applied – no write`);
      continue;
    }

    const [major, minor, patch] = page.version.split('.').map(Number);
    const version = `${major}.${minor}.${patch + 1}`;
    const message = `${made} paragraph break${made === 1 ? '' : 's'} where paragraphs ran over ${MAX_WORDS} words, each at a change of topic, with no wording changed`
      + (swapped && edit.note ? `; ${edit.note}` : '') + '.';
    const left = longParagraphs(leaves);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  paragraphs over ${MAX_WORDS}: ${before} -> ${left.length}`);
    console.log(`    ${message}`);
    for (const p of left) console.log(`    still long (${words(p)}): ${p.replace(/<[^>]+>/g, '').slice(0, 90)}`);
    if (DRY) continue;

    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID, message, now]);
    await client.query('COMMIT');
  }
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
