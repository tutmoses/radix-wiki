// sweep 485: Consensus Evolution at Radix – three claims had gone stale. The Hyperscale
// tests are said to have validated Cerberus (they measured the Foundation's implementation,
// which did not braid); Xi'an is headed "2027 target" (the November 2024 roadmap's date,
// whose sharded-Radix-Engine premise was dropped in August 2026); and the RFC is described
// as live (its author withdrew from the funding on 3 September 2026). Links hyperscale-vm.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/tech/research';
const SLUG = 'consensus-evolution';
const SENTINEL = '<h3>Xi\'an (no release date)</h3>';

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
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied – no write');
    process.exit(0);
  }

  const swap = (block, from, to) => {
    if (!block.text.includes(from)) throw new Error(`anchor not found: ${from.slice(0, 70)}`);
    block.text = block.text.replace(from, to);
  };

  const infobox = blocks.find((b) => b.type === 'infobox').blocks[0];
  swap(infobox, '<td>2013–2027</td>', '<td>2013–present</td>');

  const body = blocks.find((b) => b.text?.startsWith('<h2>Overview</h2>'));
  swap(body,
    'The <a href="/contents/tech/research/cerberus-whitepaper">whitepaper</a> was published in 2020 and validated through the <a href="/contents/tech/research/hyperscale-500k-tps">Hyperscale tests</a>.',
    'The <a href="/contents/tech/research/cerberus-whitepaper">whitepaper</a> was published in 2020. The later <a href="/contents/tech/research/hyperscale-500k-tps">Hyperscale tests</a> measured the Radix Foundation\'s Hyperscale implementation, which did not braid, so they are not a test of braided Cerberus (see below).');
  swap(body, '<h3>Xi\'an (2027 target)</h3>', SENTINEL);
  swap(body,
    '(the community <a href="/contents/tech/research/hyperscale-rs">hyperscale-rs</a> implementation, subject of the April 2026 <a href="https://radixtalk.com/t/rfc-xian-delivering-hyperscale-for-radix/2280" target="_blank" rel="noopener">Xi\'an RFC</a>)',
    '(the community <a href="/contents/tech/research/hyperscale-rs">hyperscale-rs</a> implementation, proposed for funding in the April 2026 <a href="https://radixtalk.com/t/rfc-xian-delivering-hyperscale-for-radix/2280" target="_blank" rel="noopener">Xi\'an RFC</a>; its lead developer withdrew from that funding on 3 September 2026 and has kept working on it)');
  swap(body,
    'distinct from the original HotStuff that Babylon runs today.</p>',
    'distinct from the original HotStuff that Babylon runs today. The last dated schedule Radix published, in <a href="https://www.radixdlt.com/blog/radix-labs-roadmap---to-hyperscale-and-beyond" target="_blank" rel="noopener">November 2024</a>, put launch in the second half of 2027 on the assumption of a sharded Radix Engine; that approach was dropped in August 2026 and no date has replaced it (<a href="/contents/tech/releases/radix-mainnet-xian#release-timeline" rel="noopener">release timeline</a>).</p>');

  const clar = blocks.find((b) => b.text?.includes('<strong>Two clarifications on the lineage.</strong>')) ?? body;
  swap(clar,
    'a purpose-built virtual machine is <a href="https://t.me/hyperscale_rs/10334"',
    'a purpose-built virtual machine, <a href="/contents/tech/research/hyperscale-vm" rel="noopener">hyperscale-vm</a>, is <a href="https://t.me/hyperscale_rs/10334"');

  const version = '1.7.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Hyperscale tests no longer described as validating Cerberus (they measured the Foundation implementation, which did not braid; t.me/hyperscale_rs/10351). Xi\'an heading and infobox drop the 2027 target: that date is the November 2024 roadmap, whose sharded-Radix-Engine premise was dropped in August 2026. RFC funding withdrawal of 3 Sep noted. hyperscale-vm linked.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
