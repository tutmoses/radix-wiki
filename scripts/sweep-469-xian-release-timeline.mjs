import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/releases';
const SLUG = 'radix-mainnet-xian';
// No quotes in the sentinel: JSON.stringify escapes them, so id="release-timeline"
// never matches the serialised blocks.
const SENTINEL = 'release-timeline';
const DRY = process.argv.includes('--dry-run');

const ROADMAP = 'https://www.radixdlt.com/blog/radix-labs-roadmap---to-hyperscale-and-beyond';
const RFC = 'https://radixtalk.com/t/rfc-xian-delivering-hyperscale-for-radix/2280';

const LEDE =
  '<p><strong>Xi’an</strong> (also written <strong>Xian</strong>, said /ʃi’æn/) is the planned next major release of the '
  + '<a href="https://www.radixdlt.com" target="_blank" rel="noopener">Radix</a> network, the layer-1 ledger that today runs the '
  + '<a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">Babylon</a> release. Xi’an would spread the ledger across an '
  + 'unlimited number of <a href="/contents/tech/core-concepts/shard-groups" rel="noopener">shard groups</a> rather than one, which is what '
  + 'makes Radix’s <a href="/contents/tech/core-concepts/sharding" rel="noopener">sharded</a> state model usable in production and what its '
  + 'claims of linear scalability and unlimited <a href="/contents/tech/core-concepts/atomic-composability" rel="noopener">atomic '
  + 'composability</a> rest on.</p>'
  + '<p>Development toward it runs in <a href="/contents/tech/research/hyperscale-rs" rel="noopener">hyperscale-rs</a>, a Rust consensus '
  + 'project named as the production candidate in an <a href="' + RFC + '" target="_blank" rel="noopener">RFC</a> put to the Radix '
  + 'governance forum on 20 April 2026. Xi’an has no current release date; the two schedules published for it, and what overtook each, are '
  + 'in <a href="#release-timeline">Release Timeline</a> below.</p>';

const TIMELINE =
  '<h2 id="release-timeline">Release Timeline</h2>'
  + '<p>Two dated plans have been published for Xi’an. Neither is current.</p>'
  + '<h3>Radix Labs roadmap, 30 November 2024</h3>'
  + '<p>The last schedule to come from Radix itself was published on 30 November 2024 as '
  + '<a href="' + ROADMAP + '" target="_blank" rel="noopener">Radix Labs Roadmap - To Hyperscale and Beyond</a>, which spells the release '
  + '<em>Xian</em> throughout:</p>'
  + '<table><tbody>'
  + '<tr><td colspan="2"><strong>Radix Labs roadmap, November 2024</strong></td></tr>'
  + '<tr><td>Production planning of Xian</td><td>Q4 2025</td></tr>'
  + '<tr><td>Implementation of Xian in Rust</td><td>2026</td></tr>'
  + '<tr><td>Alpha Xian</td><td>early 2027</td></tr>'
  + '<tr><td>Beta Xian</td><td>mid 2027</td></tr>'
  + '<tr><td>Launch</td><td>H2 2027</td></tr>'
  + '</tbody></table>'
  + '<p>Three tracks were to run in parallel to reach those dates: the <a href="/contents/tech/research/cassandra" rel="noopener">Cassandra</a> '
  + 'research network, a sharding upgrade to the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> due to '
  + 'finish implementation in Q3 2025 and pass a soft audit in Q4 2025, and Xi’an itself. Xi’an was to run on the sharded Radix Engine that '
  + 'second track produced. It will not: the production candidate is building a purpose-built virtual machine instead, a decision confirmed '
  + 'on 1 August 2026 and set out under <a href="#execution-layer">Execution Layer</a> below. Radix has published no revised dates since.</p>'
  + '<h3>The Xi’an RFC, 20 April 2026</h3>'
  + '<p>The second plan came from outside Radix. The developer of hyperscale-rs, posting as flightofthefox, proposed delivering Xi’an across '
  + 'six milestones &ndash; the validator lifecycle, engine and gateway alignment, a gateway rewrite, a desktop validator application, '
  + 'post-quantum cryptography, and mainnet launch &ndash; for 300,000 USD-equivalent paid in XRD, with a 50m $XRD bonus on the sixth. The '
  + 'timeline was 18 months to mainnet-ready delivery plus a 12-month support window, best case a testnet in Q4 2026 and mainnet in Q1 2027.</p>'
  + '<p>Only the first milestone was funded. It passed the community consultation process in May 2026 and the Radix Foundation paid it '
  + 'directly rather than wait for the DAO to be constituted; the remaining five depended on a DAO treasury that had not come online. At '
  + '00:28 UTC on 3 September 2026, three days into the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">network halt</a>, '
  + 'the developer wrote in the project channel that he had decided not to pursue any proposal, grants or ongoing engagements with Radix. The '
  + 'funding terms lapsed with that: the five unpaid milestones, the '
  + '<a href="/ecosystem/radix-accountability-council" rel="noopener">Radix Accountability Council</a> sign-off on each of them, and the '
  + 'arbitration clause. The work did not &ndash; he said he anticipated no change in the velocity of delivering the tech &ndash; and on '
  + '12 September he reported Milestone 1 delivered in full and said he was not requesting its 50,000 USD payment.</p>'
  + '<h3>What is scheduled now</h3>'
  + '<p>Nothing is. On 12 September 2026 the developer declined to give dates, saying the milestones keep their order but that the '
  + 'virtual-machine work is larger than the RFC assumed and that migration preparation will likely grow with it; he would not estimate how '
  + 'long after feature-complete he would recommend any network adopt the result. Radix is not a settled destination for the code either. '
  + 'Both hyperscale repositories carry a dual MIT and Apache-2.0 licence, which lets Radix adopt them, and the developer said on 12 September '
  + 'that an upgrade path exists and that he would guide it &ndash; while placing Radix among the candidate networks rather than ahead of '
  + 'them. The <a href="/contents/tech/research/hyperscale-rs" rel="noopener">hyperscale-rs</a> article records that exchange in full.</p>';

const EXTERNAL =
  '<h2>External Links</h2>'
  + '<ul>'
  + '<li><a href="' + ROADMAP + '" target="_blank" rel="noopener">Radix Labs Roadmap - To Hyperscale and Beyond</a> '
  + '&ndash; the November 2024 plan, and the last dated schedule Radix published</li>'
  + '<li><a href="' + RFC + '" target="_blank" rel="noopener">RFC: Xi’an, Delivering Hyperscale for Radix</a> '
  + '&ndash; the April 2026 milestone proposal on the governance forum</li>'
  + '<li><a href="https://hyperscale.rs" target="_blank" rel="noopener">hyperscale.rs</a> &ndash; public work on the production candidate</li>'
  + '</ul>';

const EXCERPT = 'Xi’an is the planned next major release of the Radix network: unlimited shard groups, a new virtual machine, and no release date as of September 2026.';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  let blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  // 1. lede: a self-contained definition that names the entity, the alternate
  //    spelling and the scheduling status, in place of a pronunciation gloss.
  const lede = blocks[0];
  if (lede?.type !== 'content' || !lede.text.includes('next major release')) throw new Error('lede block not matched');
  lede.text = LEDE;

  // 2. the body block: id the Execution Layer heading so the timeline can point at
  //    it, and drop the RFC clause the timeline section now carries.
  const body = blocks.find((b) => b.text?.includes('<h2>Execution Layer</h2>'));
  if (!body) throw new Error('body block not matched');
  body.text = body.text.replace('<h2>Execution Layer</h2>', '<h2 id="execution-layer">Execution Layer</h2>');

  const rfcClause = ' project (public work at <a href="https://hyperscale.rs" target="_blank" rel="noopener">hyperscale.rs</a>), whose '
    + '<a href="' + RFC + '" target="_blank" rel="noopener">RFC for delivering Xi’an</a> was submitted to the Radix governance forum on '
    + '20 April 2026 with an 18-month mainnet target.';
  if (!body.text.includes(rfcClause)) throw new Error('RFC clause not matched');
  body.text = body.text.replace(rfcClause,
    ' project, whose public work is at <a href="https://hyperscale.rs" target="_blank" rel="noopener">hyperscale.rs</a>.');

  // 3. the infobox launch date pointed at the 2024 roadmap and read "2027".
  const infobox = blocks.find((b) => b.type === 'infobox');
  if (!infobox) throw new Error('infobox not found');
  const ibLead = infobox.blocks?.[0];
  const launch = new RegExp('<a[^>]*href="' + ROADMAP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>2027</a>');
  if (!ibLead || !launch.test(ibLead.text)) throw new Error('infobox launch-date cell not matched');
  ibLead.text = ibLead.text.replace(launch, '<a href="#release-timeline">Not scheduled</a>');

  // 4. new blocks: the timeline high on the page, external links at the foot,
  //    infobox last.
  const bodyIdx = blocks.indexOf(body);
  const rest = blocks.filter((b) => b !== lede && b !== body && b !== infobox);
  if (bodyIdx < 0) throw new Error('body index lost');
  blocks = [
    lede,
    { id: uid(), type: 'content', text: TIMELINE },
    body,
    ...rest,
    { id: uid(), type: 'content', text: EXTERNAL },
    infobox,
  ];

  // 5. one spelling of the name. The page carried nine curly and four straight,
  //    and no quotation on it contains the word, so none is altered.
  const norm = (s) => s.split("Xi'an").join('Xi’an');
  for (const b of blocks) {
    if (typeof b.text === 'string') b.text = norm(b.text);
    for (const n of b.blocks || []) if (typeof n.text === 'string') n.text = norm(n.text);
  }
  const title = norm(page.title);

  const straggler = JSON.stringify(blocks).match(/Xi'an/g);
  if (straggler) throw new Error(`${straggler.length} straight-apostrophe Xi'an left`);

  const version = '3.1.0';
  const metadata = { ...(page.metadata || {}), excerpt: EXCERPT, last_verified_at: new Date().toISOString() };
  console.log(`  ${DRY ? '[dry] ' : ''}${title}  v${page.version} -> v${version}   blocks ${page.content.length} -> ${blocks.length}`);
  console.log(`  excerpt ${EXCERPT.length} chars`);
  if (DRY) {
    console.log('\n--- LEDE ---\n' + blocks[0].text);
    console.log('\n--- TIMELINE ---\n' + blocks[1].text);
    console.log('\n--- EXTERNAL ---\n' + blocks[blocks.length - 2].text);
    console.log('\n--- INFOBOX LAUNCH ROW ---\n' + (ibLead.text.match(/.{0,80}Not scheduled.{0,80}/) || [''])[0]);
    console.log('\n--- STATE MODEL EDIT ---\n' + (body.text.match(/Active development[\s\S]{0,220}/) || [''])[0]);
  } else {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, title=$2, version=$3, metadata=$4, updated_at=$5, last_verified_at=$5 WHERE id=$6',
      [json, title, version, JSON.stringify(metadata), now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, title, version, 'minor', AUTHOR_ID,
       'New Release Timeline section: the page stated no dates at all, while the only dates in public circulation are the Radix Labs roadmap of 30 November 2024 (alpha early 2027, beta mid 2027, launch H2 2027), read from the post itself. That schedule assumed a sharded Radix Engine, a track abandoned on 1 August 2026 for a purpose-built VM, and the April 2026 RFC that replaced it lapsed when its author withdrew from Radix funding on 3 September 2026; he declined to give new dates on 12 September. Lede rewritten as a self-contained definition carrying the alternate spelling Xian, the infobox launch date corrected from "2027" to "Not scheduled", External Links added, the name normalised to one apostrophe, and metadata.excerpt set.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
