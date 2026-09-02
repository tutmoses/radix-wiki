import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/history';
const SLUG = 'hyperlane-asset-drain-2026';
const SENTINEL = 'day-three-evening-first-technical-account';

const SECTION = `<h2 id="${SENTINEL}">Day three, evening: the first technical account, and a legal track</h2>
<p>Read at <strong>19:04:11&nbsp;UTC on 2 September 2026</strong>, <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">the Gateway status endpoint</a> returns the same ledger for a tenth consecutive reading: state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179&nbsp;UTC. That is <strong>forty-five hours and forty-five minutes</strong> without a committed round. <code>/state/validators/list</code> answers HTTP 500 and states the gap in words as well as seconds, <q>it is currently 1 day, 21 hours, 45 minutes, 10 seconds behind</q>, with <code>current_sync_delay_seconds</code> 164,710 against a <code>max_allowed_sync_delay_seconds</code> of 720.</p>
<h3 id="the-first-public-account-of-the-flaw">The first public account of the flaw</h3>
<p>Until this afternoon no one connected to the network had described the defect in public. The official statements named the layer and stopped there: an outstanding issue in the execution layer, an issue in the Radix Engine, and, in <a href="https://t.me/RadixAnnouncements/2778" target="_blank" rel="noopener">the Foundation's statement that morning</a>, a root cause identified but not characterised. That changed in the space of ten minutes in the main Radix group, after a holder asked at <strong>14:44&nbsp;UTC</strong> for an explanation in plain terms, and specifically why so simple a check had not been implemented and why an audit had not found it.</p>
<p><a href="https://t.me/radix_dlt/1001388" target="_blank" rel="noopener">Timan of Astrolescent answered first</a> and declined the question: that is <q>the million dollar question</q>, he cannot produce a plain-language account of how it was possible, and he expects <q>the upcoming incident report</q> to. That is the first indication from anyone close to the work that a written incident report is planned at all.</p>
<p><a href="https://t.me/RadixAccountabilityCouncil" target="_blank" rel="noopener">Council</a> member projectShift then <a href="https://t.me/radix_dlt/1001389" target="_blank" rel="noopener">gave one</a>, at 14:50:47&nbsp;UTC. The attack, in his account, moves assets by <q>bypassing security/ownership checks when calling a specific method and identifying the vault holding the assets by its internal id</q>, and what fails is <q>the checking of the requester had any authorization or ownership of the vault identified</q>. His analogy is that everyone saw the door and the lock and accepted that it was locked and that only the owner held the key; nobody tried the handle, and it was not locked.</p>
<p>Ten minutes later flightofthefox, who leads the <a href="/contents/tech/research/hyperscale-rs" rel="noopener">hyperscale-rs</a> rewrite, <a href="https://t.me/radix_dlt/1001391" target="_blank" rel="noopener">placed it in the Engine's history</a>, hedging it twice: take it <q>with a pinch of salt</q> because he has not looked exhaustively, and <q>someone will have a more accurate write-up when the fires are out</q>. His reading is that direct access to a vault was built to support the <code>recallable</code> resource behaviour, which is a capability asset issuers genuinely want, <q>but it seems like the checks that the caller actually had the right recall authority (and indeed that the resource was even ever marked recallable) weren't in place or not functioning correctly</q>.</p>
<p>Both accounts land where <a href="#the-cause">the code reading above</a> landed two days earlier, and the second adds a detail worth keeping. <code>verify_boot_ref_value</code> tests the blueprint of the referenced node, <code>FungibleVault</code> or <code>NonFungibleVault</code> from the resource package, and nothing else; whether the resource behind that vault was ever configured as recallable is not one of its inputs, any more than ownership is. A capability introduced for recall was therefore reachable on resources for which recall had never been enabled. None of this is an incident report, and all three accounts are hedged or partial. What can be said as of this reading is that the first public technical explanations of the drain came from a protocol developer and a council member speaking in a chat group, four days after the transactions, and not from the organisation that says it has identified the root cause.</p>
<h3 id="reports-to-authorities-in-jersey-and-the-uk">Reports to authorities in Jersey and the UK</h3>
<p>The legal update <a href="#the-legal-and-exchange-track">the council had promised</a> arrived at <strong>16:13:34&nbsp;UTC</strong>, in the main group rather than an announcement channel, from <a href="/community/andy-jarrett" rel="noopener">Andy Jarrett</a>: <a href="https://t.me/radix_dlt/1001399" target="_blank" rel="noopener">the Foundation</a> <q>have submitted incident and forensic reports to various legal and cybercrime authorities in Jersey and the UK and had a number of follow up calls today</q>. The two jurisdictions match where the group is registered. <a href="/ecosystem/radix-foundation" rel="noopener">The Radix Foundation</a> that now holds control of the group is a Jersey entity, and the operating companies are registered in England and Wales. No authority, reference or case is named, and nothing further has been published in writing.</p>`;

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
    console.log('  already applied - no write');
    process.exit(0);
  }

  const cause = blocks.findIndex((b) => b.text?.includes('<h2>The cause</h2>'));
  if (cause < 0) throw new Error('cause block not found - the #the-cause anchor would dangle');
  blocks[cause].text = blocks[cause].text.replace('<h2>The cause</h2>', '<h2 id="the-cause">The cause</h2>');

  const idx = blocks.findIndex((b) => b.text?.includes('<h2>Where the assets went</h2>'));
  if (idx < 0) throw new Error('anchor block "Where the assets went" not found');
  blocks.splice(idx, 0, { id: uid(), type: 'content', text: SECTION });

  const version = '2.9.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  blocks ${page.content.length} -> ${blocks.length}  inserted at ${idx}`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Day three, evening: tenth identical Gateway reading at 45h45m; the first public technical accounts of the flaw (Timan declining and citing a planned incident report, projectShift ELI3, flightofthefox on recall authority and the recallable flag), read against the code section already on the page; and Andy Jarrett on incident and forensic reports filed with authorities in Jersey and the UK.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
