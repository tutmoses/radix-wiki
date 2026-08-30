import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/releases';
const SLUG = 'stokenet';
const SENTINEL = 'What it now takes to run a Stokenet validator';
const DRY = process.argv.includes('--dry-run');

const NEW_SECTION = `
<h4>What it now takes to run a Stokenet validator, 30 August 2026</h4>
<p>The steps came with the status update itself. Attached to <a href="https://t.me/RadixDevelopers/66138" target="_blank" rel="noopener">the same 10:06&nbsp;UTC message</a> is <code>stokenet-new-validator-instructions.md</code>, version&nbsp;1.0, dated 30 August 2026 and addressed to community node operators. Its claim is that the official Radix documentation still applies and exactly three things differ: the node image has to be patched, the genesis has to be supplied as a file, and test XRD has to come from somewhere, because the reset destroyed every balance. Ahead of all three sits a warning about the chain that was replaced. It has not gone anywhere &ndash; it is frozen, nodes still gossip on it, and it will never advance &ndash; so an operator who ran Stokenet before 29 August has to wipe the ledger database, an existing one being the old chain by definition.</p>
<p>Three files carry the change, published to a DigitalOcean Spaces bucket rather than to any Radix domain. Fetched on 30 August 2026, <code>common-v1.3.0.5.jar</code> is 551,287&nbsp;bytes (the 538&nbsp;KB the operator quotes), <code>genesis.bin</code> is 669&nbsp;bytes and the <code>Dockerfile</code> is 99, and each of the three matches the SHA-256 the document publishes for it. The Dockerfile is the whole patch surface and reads in full: <code>FROM radixdlt/babylon-node:v1.3.0.5</code>, then <code>COPY common-v1.3.0.5.jar /opt/radixdlt/lib/common-v1.3.0.5.jar</code>. Anyone unwilling to take the jar on trust is given the source route instead, and told in advance that a self-built jar will not match the hash, because Gradle stamps build times into it.</p>
<p>The reason a stock node cannot start is in the source, and it checks out at the tagged release. In <a href="https://github.com/radixdlt/babylon-node/blob/v1.3.0.5/common/src/main/java/com/radixdlt/networks/Network.java" target="_blank" rel="noopener"><code>Network.java</code></a> at v1.3.0.5, Stokenet is the one network in the file whose genesis is written into the enum as data &ndash; <code>FixedNetworkGenesis.constant(...)</code>, the payload base64-encoded inline. Mainnet and the dedicated genesis-test network pin a hash and a bundled file; the other twenty-odd networks pin nothing. <a href="https://github.com/radixdlt/babylon-node/blob/v1.3.0.5/core/src/main/java/com/radixdlt/bootstrap/RadixNodeBootstrapper.java" target="_blank" rel="noopener"><code>RadixNodeBootstrapper</code></a> then reads three genesis sources at startup &ndash; the one you configure, the one implied by <code>network.id</code>, and the one stored from previous runs &ndash; and throws <code>Inconsistent genesis configuration</code> if more than one distinct hash survives. Deleting that third argument from the one enum entry removes the second source and lets the file stand alone. The same three-source check is why the database wipe is not optional: a retained database supplies a hash of its own.</p>
<p>The document warns that the frozen chain&rsquo;s genesis is a different genesis of exactly the same size, and it is. Decode the base64 constant out of <code>Network.java</code> at v1.3.0.5 and it comes to 669&nbsp;bytes; <code>genesis.bin</code> for the reset chain is also 669&nbsp;bytes, with different content. A file listing distinguishes nothing here. The published hash is the only thing that tells an operator which of the two chains they are about to join, which is why the instructions stop the reader at that check twice.</p>
<p>The compose fragment gives the three seed nodes as bare IP addresses, and resolving them settles a question this page has carried since reset day. <code>193.200.238.146</code>, <code>.147</code> and <code>.148</code> are <code>node1-</code>, <code>node2-</code> and <code>node3-stokenet.radix.community</code>, the same three seed hosts the <a href="https://docs.radixdlt.com/docs/node-setup-docker" target="_blank" rel="noopener">official Docker page</a> still publishes, and all three accepted TCP on port&nbsp;30000 when tested on 30 August. Same three machines, all-new identities: the node keys in the documented seed URIs (<code>node_tdx_2_1qwz237kq&hellip;</code>, <code>1qv89yg0la&hellip;</code>, <code>1qv2g5srsn&hellip;</code>) share nothing with the ones the operator now hands out (<code>1q2237aq4h&hellip;</code>, <code>1qfhupcz3w&hellip;</code>, <code>1qfaxgqj0n&hellip;</code>). The document gives the reason: the first attempt at a genesis reused the old keys and left the new chain sharing an identity with the frozen one &ndash; same network id, same node keys, same P2P port &ndash; so a stock node could rejoin the dead chain without saying so, and old-chain peers kept dialling the new one. Rotating the keys leaves the two chains nothing in common but the network id.</p>
<p>Most of the rest is configuration, and two of the items are worth reading even by someone who will never run a node. There is no protocol-update configuration at all: the network was carried from Babylon to Cuttlefish by on-ledger readiness signalling, so a syncing node re-derives those enactments from the ledger, and <code>RADIXDLT_PROTOCOL_CUSTOM_CONFIG</code> is to be left unset. And because every database on this chain starts empty, the document offers a lean validator profile &ndash; previous substate values, historical substate values, the local transaction execution index, the account change index and the entity listing indices all switched off &ndash; on the condition that the choice is made before the first sync. Turning them off later shrinks nothing already written; turning them on later leaves gaps, because the data was never written for the blocks already processed. A node that will back a <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway</a> keeps the defaults. The <a href="/developers/infrastructure/01-running-a-node" rel="noopener">standard node setup</a> covers everything else unchanged.</p>
<p>The last step is a person. The faucet mints, but not enough to create a <a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">validator</a>, so the document ends by directing operators to message the operator on Telegram with an account address and a stake figure. A newly created validator is not in genesis either, so its address has to be named in <code>RADIXDLT_CONSENSUS_VALIDATOR_ADDRESS</code> and the genesis-derived flag left alone; the node joins the active set at the next epoch boundary if its stake places it in the top&nbsp;100. On the chain as it runs today that boundary is the roughly three-and-a-half minutes measured above rather than the five the document rounds it to.</p>
<p>One date in the reference table cannot be checked against the thing it describes. The document puts the chain start at 11:22&nbsp;UTC on 29 August 2026, and the ledger cannot confirm it: the genesis transactions are stamped at the Unix epoch, and the first wall-clock timestamp anywhere on the chain is 11:47:06.823&nbsp;UTC, at epoch&nbsp;3, round&nbsp;444, state version&nbsp;1,028. The document is clearer about its own expiry than about its start. A fork was refused deliberately, on the grounds that it would be a maintenance commitment and a far larger trust surface than one jar a reader can diff, and the overlay is meant not to outlive the need for it: when an official image ships for this chain, one <code>image:</code> line changes back and the genesis file, the seed list, the operator&rsquo;s keys and the validator registration all stay valid.</p>
`;

const OLD_NOTE = 'The network runs the current node release with a patched genesis, so the published node instructions no longer work unmodified.';
const NEW_NOTE = 'The network runs the current node release with a patched genesis, so the published node instructions no longer work unmodified; the operator has since circulated a procedure for running a node against the new chain.';

const OLD_CIRCULATED = 'with those steps circulated as a document in the channel rather than published.';
const NEW_CIRCULATED = 'with those steps attached to the same message as a document, which the section below reads against the source and the ledger.';

const OLD_WRITEUP = 'Daffy has said he will <a href="https://t.me/RadixDevelopers/66080" target="_blank" rel="noopener">write up the details</a>, and that write-up is what will resolve it.';
const NEW_WRITEUP = 'Daffy <a href="https://t.me/RadixDevelopers/66080" target="_blank" rel="noopener">said he would write up the details</a>, and the write-up that followed on 30 August says the keys are new: a first attempt at the genesis reused the old ones, and he regenerated it with fresh node keys rather than leave the two chains sharing an identity. The section below has the document and what can be checked against it.';

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

  for (const [label, anchor] of [['b1 note', OLD_NOTE]]) {
    if (!blocks[1].text.includes(anchor)) throw new Error(`${label} anchor missing`);
  }
  for (const [label, anchor] of [['b2 circulated', OLD_CIRCULATED], ['b2 writeup', OLD_WRITEUP]]) {
    if (!blocks[2].text.includes(anchor)) throw new Error(`${label} anchor missing`);
  }

  blocks[1].text = blocks[1].text.replace(OLD_NOTE, NEW_NOTE);
  blocks[2].text = blocks[2].text
    .replace(OLD_CIRCULATED, NEW_CIRCULATED)
    .replace(OLD_WRITEUP, NEW_WRITEUP)
    .trimEnd() + '\n' + NEW_SECTION.trim() + '\n';

  const version = '1.10.0';
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
       'Daffy\'s node-operator instructions, attached as stokenet-new-validator-instructions.md v1.0 to the 30 August status update. Records the three published artifacts with their hashes verified first-hand, the Network.java / RadixNodeBootstrapper mechanism that makes the patch necessary, the 669-byte genesis collision between the frozen and live chains, and the lean-validator and no-protocol-config guidance. Resolves the open key question: the three seed IPs are the same node1/2/3-stokenet.radix.community hosts the docs publish, carrying entirely new node keys, and the operator states he regenerated the genesis with fresh keys after a first attempt reused the old ones. Notes that the ledger cannot confirm the document\'s 11:22 UTC chain start, its first wall-clock stamp being 11:47:06 at epoch 3.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
