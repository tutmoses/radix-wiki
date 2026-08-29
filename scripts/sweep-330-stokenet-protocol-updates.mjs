import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/releases';
const SLUG = 'stokenet';
const SENTINEL = 'The protocol updates are re-enacted';
const DRY = process.argv.includes('--dry-run');

const NEW_SECTION = `
<h4>The protocol updates are re-enacted, 29 August 2026</h4>
<p>They were re-enacted the same evening, and the ledger carries the whole sequence in three transactions. A Radix protocol update is adopted by <a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">validator</a> readiness signalling rather than by a switch, so each update the discarded ledger had already taken had to be signalled again on the new one, in order. With all four validators of the restarted set under a single operator the 80% stake threshold was never a constraint: each transaction below signals readiness for all four at once. Read first-hand at the Stokenet <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway</a>:</p>
<table>
<tbody>
<tr><td><strong>Update</strong></td><td><strong>Readiness signal</strong></td><td><strong>Committed (UTC)</strong></td><td><strong>Epoch / state version</strong></td></tr>
<tr><td><a href="/contents/tech/releases/protocol-updates" rel="noopener">Anemone</a></td><td><code>811c31d2bc6a2631000000000anemone</code></td><td>17:46:25</td><td>95 / 268,868</td></tr>
<tr><td><a href="/contents/tech/releases/protocol-updates" rel="noopener">Bottlenose</a></td><td><code>35701a6147bfd870000000bottlenose</code></td><td>18:29:38</td><td>107 / 304,255</td></tr>
<tr><td><a href="/contents/tech/releases/protocol-updates" rel="noopener">Cuttlefish</a></td><td><code>034d3327f58995c6000000cuttlefish</code></td><td>19:38:20</td><td>125 / 359,543</td></tr>
</tbody>
</table>
<p>The three transactions are <code>txid_tdx_2_1rnx4wkep2x7pwth0ra5xtd37xlfs0dk563urxp845lhmjg5hfpzs973dnv</code>, <code>txid_tdx_2_1w9gs7wpcz2k74xgpp5y2n83zukxzyhafjkqw7v0y4gzjdrjeangsttvxsd</code> and <code>txid_tdx_2_1keas3c92lcf4kc582ze964s938lcuyk9ksgxvtk3hrt2qsx7zhkqghy8sr</code>, each <code>CommittedSuccess</code> for about 0.42&nbsp;test XRD in fees. Nothing else on the reset ledger has signalled readiness for anything: those three are the complete protocol history of the network as it stands.</p>
<p>Enactment followed the signalling within the hour in each case. Daffy <a href="https://t.me/RadixDevelopers/66108" target="_blank" rel="noopener">reported Bottlenose active at 19:39&nbsp;UTC</a> &ndash; a minute after the Cuttlefish signal went in &ndash; and Cuttlefish &ldquo;active within the next hour&rdquo;. At <a href="https://t.me/RadixDevelopers/66111" target="_blank" rel="noopener">20:34&nbsp;UTC a developer confirmed</a> that packages referencing the <strong>AccountLocker</strong> blueprint deploy again, which is the failure recorded in the section above reversed by name. Read at the Gateway at <strong>23:11&nbsp;UTC</strong>, at epoch 181 and state version 530,719, <code>package_tdx_2_1pkgxxxxxxxxxlckerxxxxxxxxxx000208064247xxxxxxxxx8jnpz0</code> returns an entity where eight hours earlier it returned none. The gap between the Gateway&rsquo;s well-known address list and the ledger behind it, described above, has closed.</p>
<p>Only the first half of Cuttlefish is in scope. The channel recorded on the day that <a href="https://t.me/RadixDevelopers/66106" target="_blank" rel="noopener">part&nbsp;1 alone was needed</a>, part&nbsp;2 being a projected future update rather than something mainnet has taken, and the readiness signal on the ledger matches: it names <code>cuttlefish</code>, not a part&nbsp;2 successor. So the reset network is now at the same protocol version as <a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">mainnet</a>, reached in one evening from Babylon genesis rather than over the two and a half years mainnet took.</p>
`;

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

  // 1. The operational note at the top still says AccountLocker does not exist.
  const OLD_NOTE = 'Note that the ledger has restarted at a protocol state before Bottlenose, so the AccountLocker native package does not yet exist.';
  const NEW_NOTE = 'The ledger restarted at Babylon genesis, before any protocol update; Anemone, Bottlenose and Cuttlefish part&nbsp;1 were all re-enacted by validator readiness signalling the same evening, and the AccountLocker native package exists again.';
  if (!blocks[1].text.includes(OLD_NOTE)) throw new Error('block 1 note anchor missing');
  blocks[1].text = blocks[1].text.replace(OLD_NOTE, NEW_NOTE);

  // 2. "the protocol state that preceded it" is imprecise - genesis was at Babylon, before Anemone.
  const OLD_PRE = 'so the reset network has restarted at the protocol state that preceded it';
  const NEW_PRE = 'so the reset network has restarted at a protocol state that preceded it &ndash; at Babylon genesis, before Anemone';
  if (!blocks[2].text.includes(OLD_PRE)) throw new Error('block 2 precedence anchor missing');
  blocks[2].text = blocks[2].text.replace(OLD_PRE, NEW_PRE);

  // 3. Append the new section.
  blocks[2].text = blocks[2].text.trimEnd() + '\n' + NEW_SECTION.trim() + '\n';

  const version = '1.7.0';
  const now = new Date().toISOString();
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  block1 ${page.content[1].text.length} -> ${blocks[1].text.length} B`);
  console.log(`  block2 ${page.content[2].text.length} -> ${blocks[2].text.length} B`);
  if (!DRY) {
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Reset day, part three: Anemone, Bottlenose and Cuttlefish part 1 were all re-enacted on the new Stokenet ledger the same evening. Adds the three readiness transactions read first-hand at the Gateway (txids, protocol identifiers, epochs, state versions), confirms the AccountLocker package now resolves at epoch 181, and corrects two statements the earlier sections left behind - the ledger restarted at Babylon genesis, before Anemone, not merely before Bottlenose.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
