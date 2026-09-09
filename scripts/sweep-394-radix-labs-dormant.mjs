import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 394, ecosystem rotation. This page carried status Active and a 2027
// delivery target for Xi\'an, both sourced to radixdlt.com/labs and to a roadmap
// the page cited without dating it. The roadmap is Dan Hughes\'s post of
// 30 November 2024; the Foundation whose research arm Radix Labs is said its
// remaining full-time development team would complete handover by the end of
// June 2026. The status moves to Dormant, the roadmap gets its date, and a new
// section records what the sources actually say.

const TAG_PATH = 'ecosystem';
const SLUG = 'radix-labs';
const SENTINEL = 'id="labs-dormant-2026"';
const DRY = process.argv.includes('--dry-run');

const ROADMAP = 'https://www.radixdlt.com/blog/radix-labs-roadmap---to-hyperscale-and-beyond';
const MAINT = 'https://www.radixdlt.com/blog/foundation-update-moving-to-maintenance-mode';
const INTERIM = 'https://www.radixdlt.com/blog/interim-hyperscale-closing-the-chapter';
const LABS = 'https://www.radixdlt.com/labs';

const STATUS_ROW_RE = /<tr><td><strong>Status<\/strong><\/td><td>Active<\/td><\/tr>/;
const STATUS_ROW =
  '<tr><td><strong>Status</strong></td><td>\u{1F7E0} Dormant – the <a href="' + MAINT + '" target="_blank" rel="noopener">Foundation update of 28 April 2026</a> '
  + 'had the last full-time development team hand over by the end of June 2026 (read 9 September 2026)</td></tr>';

const TARGET_ROW_RE = /<tr><td><strong>Target<\/strong><\/td><td>[\s\S]*?<\/td><\/tr>/;
const TARGET_ROW =
  '<tr><td><strong>Target</strong></td><td>Xi\'an Alpha early 2027, full launch H2 2027, as set out in the '
  + '<a href="' + ROADMAP + '" target="_blank" rel="noopener">roadmap of 30 November 2024</a>; no revision published since</td></tr>';

const OLD_ROADMAP_LEAD = 'According to the official <a href="' + ROADMAP + '" target="_blank" rel="noopener" title="Radix Labs Roadmap - To Hyperscale and Beyond">Radix Labs roadmap</a>, the Xi\'an track targets';
const NEW_ROADMAP_LEAD = 'According to the <a href="' + ROADMAP + '" target="_blank" rel="noopener" title="Radix Labs Roadmap - To Hyperscale and Beyond">Radix Labs roadmap</a>, published on 30 November 2024 and not revised since, the Xi\'an track targets';

const SECTION =
  '<h2 id="labs-dormant-2026">Development stopped in 2026</h2>'
  + '<p>Radix Labs has published no plan since <a href="' + ROADMAP + '" target="_blank" rel="noopener">the roadmap of 30 November 2024</a>, '
  + 'written by co-founder <a href="/community/dan-hughes" rel="noopener">Dan Hughes</a>. It set out three tracks running in parallel: '
  + '<a href="/contents/tech/research/cassandra" rel="noopener">Cassandra</a> serving as a test platform until it was decommissioned late in 2025; '
  + 'the sharding upgrade to the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> completed in Q3 2025 and soft-audited in Q4; '
  + 'and Xi\'an implemented in Rust across 2026, for an Alpha in early 2027, a Beta at mid-year and a launch in the second half. '
  + 'The Foundation closed the Hyperscale work it had been running on 20 February 2026 with '
  + '<a href="' + INTERIM + '" target="_blank" rel="noopener">Interim Hyperscale: Closing the Chapter</a>, which handed the codebase to the community to carry forward.</p>'
  + '<p>The <a href="/ecosystem/radix-foundation" rel="noopener">Radix Foundation</a> then ended its own development. Its '
  + '<a href="' + MAINT + '" target="_blank" rel="noopener">update of 28 April 2026</a> says that from May <q>active development of new features and services becomes minimal</q>, '
  + 'and that <q>by the end of June, the remaining full-time development team will have completed handover of active workstreams</q>, '
  + 'after which directors manage the financial and governance functions the transition needs. That leaves the Foundation\'s research and development arm '
  + 'without a development team, which is why this page records Radix Labs as dormant rather than active. Its predecessor '
  + '<a href="/ecosystem/rdx-works" rel="noopener">RDX Works</a> is recorded the same way.</p>'
  + '<p>Nothing has been withdrawn. <a href="' + LABS + '" target="_blank" rel="noopener">The Radix Labs page</a>, read on 9 September 2026, still calls the Labs '
  + 'the research and development arm of the Radix Foundation and still dates Hyperscale to 2027. That page is not maintained: its endorsement carousel repeats '
  + 'one quotation five times under the name <q>Jamie Diamond</q>, a misspelling of the JPMorgan Chase chief executive Jamie Dimon, which is placeholder copy '
  + 'left in an unfilled content list rather than a customer endorsement.</p>'
  + '<p>The sharded consensus layer the roadmap describes is being written elsewhere. <a href="/contents/tech/research/hyperscale-rs" rel="noopener">hyperscale-rs</a>, '
  + 'a Rust implementation built outside the Foundation, is the leading production candidate for it, and funding and stewarding the '
  + '<a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi\'an upgrade</a> is '
  + '<a href="/ideas/dao-xian-protocol-upgrade" rel="noopener">an open item</a> for the development working group of the DAO now being incorporated.</p>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  if (/\u00A0/.test(SECTION + STATUS_ROW + TARGET_ROW + NEW_ROADMAP_LEAD)) throw new Error('U+00A0 in new copy');
  if (/\u2014/.test(SECTION + STATUS_ROW + TARGET_ROW + NEW_ROADMAP_LEAD)) throw new Error('em dash in new copy');

  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const box = blocks.find((b) => b.type === 'infobox');
  if (!box?.blocks?.[0]?.text) throw new Error('infobox not found');
  if (!STATUS_ROW_RE.test(box.blocks[0].text)) throw new Error('status row not matched');
  if (!TARGET_ROW_RE.test(box.blocks[0].text)) throw new Error('target row not matched');
  box.blocks[0].text = box.blocks[0].text.replace(STATUS_ROW_RE, STATUS_ROW).replace(TARGET_ROW_RE, TARGET_ROW);

  const road = blocks.find((b) => b.type === 'content' && b.text?.includes(OLD_ROADMAP_LEAD));
  if (!road) throw new Error('roadmap lead-in not found');
  road.text = road.text.replace(OLD_ROADMAP_LEAD, NEW_ROADMAP_LEAD);

  const extIdx = blocks.findIndex((b) => b.type === 'content' && b.text?.includes('<h2>External Links</h2>'));
  if (extIdx < 0) throw new Error('External Links block not found');
  blocks.splice(extIdx, 0, { id: uid(), type: 'content', text: SECTION });

  const metadata = { ...(page.metadata || {}), status: '\u{1F7E0} Dormant', website: LABS };

  const version = '2.0.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  status ${(page.metadata || {}).status} -> ${metadata.status}`);
  console.log(`  infobox ${page.content.find((b) => b.id === box.id).blocks[0].text.length} -> ${box.blocks[0].text.length} chars`);
  console.log(`  blocks ${page.content.length} -> ${blocks.length} (new section ${SECTION.length} chars at index ${extIdx})`);

  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, metadata=$2, version=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
      [json, JSON.stringify(metadata), version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'major', AUTHOR_ID,
       'Status moved from Active to Dormant, and the 2027 Xi\'an target dated to its source. The roadmap this page cited without a date is Dan Hughes\'s post of 30 November 2024, and the Radix Foundation\'s update of 28 April 2026 says active development becomes minimal from May and the remaining full-time development team completed handover of active workstreams by the end of June 2026, leaving directors on finance and governance. New section records that, the closure of the Foundation\'s Hyperscale work on 20 February 2026, that radixdlt.com/labs is unmaintained (its testimonial carousel is placeholder copy attributed to a misspelled Jamie Dimon), and that hyperscale-rs outside the Foundation is now the production candidate for the sharded consensus layer.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
