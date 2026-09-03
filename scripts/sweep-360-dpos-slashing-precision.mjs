/**
 * Run 360 (blog rotation). /blog/pow-vs-pos-the-next-industrial-revolution was the
 * staleness head of the blog category: never verified, and its DPoS section carried a
 * claim that is materially wrong under the current protocol - that validator misbehaviour
 * "could lead to significant losses for the delegates". Re-checked 3 September 2026
 * against docs.radixdlt.com: Radix has never slashed staked XRD, the documentation puts
 * slashing in the future tense and confines it to stake units a validator's OWNER has
 * voluntarily locked, and the live penalty is on emission, not principal.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'blog';
const SLUG = 'pow-vs-pos-the-next-industrial-revolution';
const SENTINEL = 'reliability factor of 0.0';
const DRY = process.argv.includes('--dry-run');

const OLD_SLASH = 'To guard against this, DPoS also implements the slashing conditions mentioned above, although these have not yet been introduced on Radix.</p>';
const NEW_SLASH = 'To guard against this, DPoS systems commonly implement the slashing conditions mentioned above &mdash; Radix does not. Re-checked in September 2026, no version of the Radix protocol has ever slashed staked XRD, and the <a href="https://docs.radixdlt.com/docs/validator" target="_blank" rel="noopener">Validator blueprint documentation</a> still puts it in the future tense and confines it to a narrow case: stake units that a validator&rsquo;s <em>own owner</em> has voluntarily locked in a delayed-withdrawal vault, as a display of confidence in the node, &ldquo;may <em>in future</em> be at risk for slashing if the validator purposefully subverts the expectations of the consensus protocol.&rdquo; Delegated stake is not named there at all.</p>';

const OLD_DELEGATE = '<p>Validators are responsible for securing the delegated stakes and ensuring they act in the best interest of the network. Any misbehavior on their part could lead to significant losses for the delegates. As such, delegates must be careful in choosing trustworthy validators.</p>';
const NEW_DELEGATE = '<p>What an unreliable Radix validator actually costs is an epoch of emission rather than anyone&rsquo;s principal. The <a href="https://docs.radixdlt.com/docs/consensus-manager" target="_blank" rel="noopener">Consensus Manager</a> rescales each validator&rsquo;s successful-proposal ratio into a <em>reliability factor</em> and multiplies its share of the epoch&rsquo;s <a href="/contents/tech/core-concepts/network-emissions" rel="noopener">network emission</a> by it &mdash; and on mainnet the minimum required reliability is configured at 1.0, so the factor is binary: a validator that misses a single round in an epoch scores a <strong>reliability factor of 0.0</strong> and receives none of that epoch&rsquo;s emission. The forfeited XRD is not redistributed to anyone; it goes unminted. Transaction fees, by contrast, are received in full regardless of reliability.</p><p>So delegates do have a reason to choose carefully &mdash; an unreliable validator pays them nothing that epoch, and the <a href="/contents/tech/core-concepts/staking" rel="noopener">stake</a> is locked through an unstaking delay while that happens. But under the protocol as it stands, their staked XRD is not at risk from a validator&rsquo;s misbehaviour, and any account of Radix <a href="/contents/tech/core-concepts/delegated-proof-of-stake-dpos" rel="noopener">DPoS</a> that implies otherwise &mdash; including the sentence this paragraph replaces &mdash; overstates the delegator&rsquo;s downside.</p>';

const OLD_IB_TAIL = '<tr><th>Companion piece</th><td><a href="/blog/money-wealth-volcanos" rel="noopener">Money, Wealth &amp; Volcanos</a></td></tr></tbody></table>';
const NEW_IB_TAIL = '<tr><th>Companion piece</th><td><a href="/blog/money-wealth-volcanos" rel="noopener">Money, Wealth &amp; Volcanos</a></td></tr>'
  + '<tr><th>Dated claim</th><td>Written in February 2024. Its DPoS section was corrected in September 2026: Radix has no stake slashing, and an unreliable validator forfeits its own epoch emission rather than its delegators&rsquo; principal</td></tr>'
  + '<tr><th>Related</th><td><a href="/contents/tech/core-concepts/staking" rel="noopener">Staking</a> &middot; <a href="/contents/tech/core-concepts/network-emissions" rel="noopener">Network Emissions</a> &middot; <a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a></td></tr></tbody></table>';

for (const [name, s] of Object.entries({ OLD_SLASH, NEW_SLASH, OLD_DELEGATE, NEW_DELEGATE, OLD_IB_TAIL, NEW_IB_TAIL })) {
  if (s.includes('\u00a0')) throw new Error(`${name} contains U+00A0`);
}

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
    console.log('  already applied — no write');
    process.exit(0);
  }

  const ib = blocks[0].blocks[0];
  const body = blocks[1];
  for (const [label, find] of [['infobox tail', OLD_IB_TAIL], ['slashing sentence', OLD_SLASH], ['delegate paragraph', OLD_DELEGATE]]) {
    const hay = label === 'infobox tail' ? ib.text : body.text;
    if (!hay.includes(find)) throw new Error(`find-string missed: ${label}`);
  }
  ib.text = ib.text.replace(OLD_IB_TAIL, NEW_IB_TAIL);
  body.text = body.text.replace(OLD_SLASH, NEW_SLASH).replace(OLD_DELEGATE, NEW_DELEGATE);

  const version = '2.4.0';
  const now = new Date().toISOString();
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${blocks.length} blocks, body ${page.content[1].text.length} -> ${body.text.length} chars)`);
  if (!DRY) {
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Correct the DPoS section: Radix has never slashed staked XRD, docs.radixdlt.com/docs/validator still puts slashing in the future tense and limits it to owner-locked stake units, and the live penalty is the Consensus Manager reliability factor - binary on mainnet at minimum reliability 1.0, so one missed round forfeits the whole epoch emission while fees are received in full. Replaces the claim that validator misbehaviour "could lead to significant losses for the delegates". Adds the dated-claim infobox row this batch carries.',
       now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
