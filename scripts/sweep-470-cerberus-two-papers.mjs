import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/core-protocols';
const SLUG = 'cerberus-consensus-protocol';
// No quotes: JSON.stringify escapes them and the guard would never fire.
const SENTINEL = 'two-papers';
const DRY = process.argv.includes('--dry-run');

const WP = 'https://assets.website-files.com/6053f7fca5bf627283b582c2/608811e3f5d21f235392fee1_Cerberus-Whitepaper-v1.01.pdf';
const ARX = 'https://arxiv.org/abs/2008.04450';

const SECTION =
  '<h2 id="two-papers">The Two Cerberus Papers</h2>'
  + '<p>Cerberus is specified by two documents published in 2020. They share two authors and a name, and almost none of their '
  + 'vocabulary, which is why public accounts of the protocol describe it in incompatible terms.</p>'
  + '<h3>The Radix whitepaper, 3 March 2020</h3>'
  + '<p><a href="' + WP + '" target="_blank" rel="noopener"><em>Cerberus: A Parallelized BFT Consensus Protocol for Radix</em></a>, '
  + 'version 1.01, by Florian Cäsar, <a href="/contents/history/dan-hughes" rel="noopener">Dan Hughes</a>, Josh Primero and '
  + 'Stephen J. Thornton, is where the braiding language comes from. Its abstract states the departure from classical consensus: '
  + '"While classical SMR protocols ensure global ordering of commands, Cerberus introduces a partial ordering regime that enables a '
  + 'novel state sharding approach." Ordering is imposed only between commands touching the same state; commands over disjoint state '
  + 'carry no ordering relationship at all, which is what leaves them free to run in parallel.</p>'
  + '<p>On that base it builds two levels. Each shard runs its own BFT instance, a <strong>local Cerberus</strong>, and a commit '
  + 'spanning several shards is carried by an <strong>emergent Cerberus</strong> assembled from the local instances of the shards a '
  + 'command touches. The paper defines the emergent level by mapping each part of a single-shard BFT onto its multi-shard '
  + 'counterpart: a leader becomes a leader set, a proposal a merged proposal, a quorum certificate a QC set, and a 3-chain a '
  + '<strong>3-braid</strong>. The braid is that last row &ndash; the emergent-level analogue of the three-round commit rule a single '
  + '<a href="https://arxiv.org/abs/1803.05069" target="_blank" rel="noopener">HotStuff</a> chain uses &ndash; and it is what '
  + '"braiding" refers to wherever the term appears in Radix’s materials.</p>'
  + '<h3>The academic paper, 10 August 2020</h3>'
  + '<p><a href="' + ARX + '" target="_blank" rel="noopener"><em>Cerberus: Minimalistic Multi-shard Byzantine-resilient Transaction '
  + 'Processing</em></a>, by Jelle Hellings and Mohammad Sadoghi of the Exploratory Systems Lab at the University of California, Davis '
  + 'with Josh Primero and Dan Hughes of Radix DLT, was posted to arXiv as 2008.04450 and published in the '
  + '<a href="https://www.jsys.org/read" target="_blank" rel="noopener">Journal of Systems Research</a>, volume 3 issue 1, on '
  + '6 June 2023, under the journal’s Problem category. This is the peer-reviewed one.</p>'
  + '<p>It specifies three protocols over UTXO-like transactions rather than one. <strong>Core-Cerberus</strong> "uses strict '
  + 'environmental requirements to enable simple yet powerful multi-shard transaction processing", and operates correctly for '
  + 'transactions proposed and approved by well-behaved clients while giving no guarantees for any others. '
  + '<strong>Optimistic-Cerberus</strong> needs no additional coordination phase while nothing goes wrong, at the cost of "intricate '
  + 'coordination when recovering from attacks". <strong>Pessimistic-Cerberus</strong> pays for that coordination in the normal case '
  + 'instead, so that recovery from an attack costs little.</p>'
  + '<p>Neither document uses the other’s terms. <em>Local Cerberus</em>, <em>emergent Cerberus</em> and <em>braid</em> appear '
  + 'nowhere in the academic paper; <em>Core-Cerberus</em>, <em>Optimistic-Cerberus</em> and <em>Pessimistic-Cerberus</em> appear '
  + 'nowhere in the Radix whitepaper. Because the peer review attaches to the academic paper, a description that calls the braided '
  + 'local-and-emergent architecture peer-reviewed has joined the two documents together. What was reviewed is the three-protocol '
  + 'family above, and what it was reviewed as is a statement of a problem and a set of primitives, not a running system &ndash; see '
  + '<a href="/contents/tech/research/cerberus-whitepaper" rel="noopener">Cerberus Whitepaper &amp; Academic Validation</a>.</p>';

const EXCERPT = 'Cerberus is Radix’s sharded BFT consensus protocol: two papers from 2020, braided cross-shard commits, and a design that has never run sharded in production.';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  // 1. the opening claimed one whitepaper. Name both levels here so the
  //    definitional passage carries the terms the papers actually use.
  const overview = blocks.find((b) => b.text?.includes('<h2>Overview</h2>'));
  if (!overview) throw new Error('Overview block not matched');
  const oldOpen = 'is the Byzantine fault-tolerant consensus protocol specified in Radix’s 2020 whitepaper.';
  const oldOpenAlt = "is the Byzantine fault-tolerant consensus protocol specified in Radix's 2020 whitepaper.";
  const open = overview.text.includes(oldOpen) ? oldOpen : oldOpenAlt;
  if (!overview.text.includes(open)) throw new Error('Overview opening sentence not matched');
  overview.text = overview.text.replace(open,
    'is the Byzantine fault-tolerant consensus protocol specified for Radix in two papers published in 2020.');

  const braidSentence = 'Cerberus braids consensus across only the shards relevant to each transaction.</p>';
  if (!overview.text.includes(braidSentence)) throw new Error('braid sentence not matched');
  overview.text = overview.text.replace(braidSentence,
    'Cerberus braids consensus across only the shards relevant to each transaction. Each shard runs its own BFT instance, a '
    + '<em>local Cerberus</em>; a commit spanning several of them is carried by an <em>emergent Cerberus</em> built from those '
    + 'instances. The two papers, and the terms each one uses, are set out in '
    + '<a href="#two-papers">The Two Cerberus Papers</a>.</p>');

  // The proofs and the peer review both belong to the academic paper: the Radix
  // whitepaper states no theorems at all. The line below credited the wrong one.
  const proofLine = 'provides formal safety proofs for this design and was peer-reviewed in the Journal of Systems Research in 2023.';
  if (!overview.text.includes(proofLine)) throw new Error('proof sentence not matched');
  overview.text = overview.text.replace(
    '<p>The <a href="/contents/tech/research/cerberus-whitepaper" rel="noopener">whitepaper</a> ' + proofLine + '</p>',
    '<p>The formal safety proofs are in the '
    + '<a href="/contents/tech/research/cerberus-whitepaper" rel="noopener">academic paper</a> rather than the Radix whitepaper, '
    + 'and it is the academic paper that was peer-reviewed in the Journal of Systems Research in 2023.</p>');

  // 2. the new section sits between the specification and what runs today
  const runsIdx = blocks.findIndex((b) => b.text?.includes('<h2>What Actually Runs</h2>'));
  if (runsIdx === -1) throw new Error('What Actually Runs block not found');
  blocks.splice(runsIdx, 0, { id: uid(), type: 'content', text: SECTION });

  // 3. external links carried the arXiv paper but not the Radix whitepaper
  const ext = blocks.find((b) => b.text?.includes('<h2>External Links</h2>'));
  if (!ext) throw new Error('External Links block not found');
  if (ext.text.includes(WP)) throw new Error('whitepaper link already present');
  ext.text = ext.text.replace('<li><a href="https://arxiv.org/pdf/2008.04450"',
    '<li><a href="' + WP + '" target="_blank" rel="noopener">Cerberus Whitepaper v1.01 (PDF)</a> '
    + '&ndash; the Radix paper, where local and emergent Cerberus are defined</li>\n'
    + '<li><a href="https://arxiv.org/pdf/2008.04450"');

  const version = '6.2.0';
  const metadata = { ...(page.metadata || {}), excerpt: EXCERPT, last_verified_at: new Date().toISOString() };
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}   blocks ${page.content.length} -> ${blocks.length}`);
  console.log(`  excerpt ${EXCERPT.length} chars`);
  if (DRY) {
    console.log('\n--- OVERVIEW ---\n' + overview.text);
    console.log('\n--- NEW SECTION ---\n' + blocks[runsIdx].text);
    console.log('\n--- EXTERNAL LINKS ---\n' + (ext.text.match(/<h2>External Links<\/h2>[\s\S]*/) || [''])[0]);
  } else {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, metadata=$3, updated_at=$4, last_verified_at=$4 WHERE id=$5',
      [json, version, JSON.stringify(metadata), now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'New section on the two 2020 Cerberus papers, read from both PDFs rather than from either summary. The Radix whitepaper v1.01 (3 March 2020) is where local Cerberus, emergent Cerberus and braiding are defined, the braid being the emergent-level analogue of a HotStuff 3-chain; the academic paper (arXiv 2008.04450, JSys vol 3 no 1, 6 June 2023, Problem category) instead defines Core-, Optimistic- and Pessimistic-Cerberus over UTXO-like transactions. The vocabularies are disjoint, verified by counting every term in both texts, and the peer review attaches to the academic paper, so calling the braided architecture peer-reviewed joins two documents. The page previously named neither set of terms. Opening corrected from one whitepaper to two papers, whitepaper PDF added to External Links, and metadata.excerpt set.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
