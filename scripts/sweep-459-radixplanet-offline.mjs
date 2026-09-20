import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

// Run 459: the Status section said the RadixPlanet dApp "remains online but is
// frozen". It no longer answers at all - two reads a day apart, 19:08 UTC on
// 19 September (run 457, banked) and 03:1x UTC on 20 September, both connect
// timeouts on 443 and 80 at the single address Route 53 returns. The domain is
// still the 2022 registrant's and runs to 2027, so this is a host that stopped
// answering rather than a name that changed hands. The validator of the same
// name is registered, holds 57.7 million XRD and publishes that host for both
// its info_url and its icon.
const TAG_PATH = 'ecosystem';
const SLUG = 'radixplanet';
const INFOBOX_BLOCK = '4dc48730-40ab-468c-89bd-167c39e500ed';
const BODY_BLOCK = 'block-radixplanet-1';
const SENTINEL = 'UND_ERR_CONNECT_TIMEOUT';
const NBSP = String.fromCharCode(160);
const DRY = process.argv.includes('--dry-run');

const EXT = 'target="_blank" rel="noopener"';
const V = 'validator_rdx1swslug7tu9rgww8zdd0x8htptzgw92vx9606lx2ptdm9wsdam8uvxq';
const RDAP = 'https://rdap.verisign.com/com/v1/domain/radixplanet.com';

const STATUS_FROM = '<td>🟠 Dormant – dApp still online but frozen (last activity dated Dec 2023; no live TVL or trades)</td>';
const STATUS_TO = '<td>🟠 Dormant – the site stopped answering by 19 September 2026; last dApp activity dated Dec 2023</td>';

const BODY_FROM = '<h2>Status</h2><p>RadixPlanet is <strong>dormant</strong>. Its <a href="https://radixplanet.com" target="_blank" rel="noopener">dApp</a> remains online but is frozen – the dashboard shows no live total value locked or trades and its most recent notice is dated December 2023.';
const BODY_TO = '<h2>Status</h2><p>RadixPlanet is <strong>dormant</strong>, and since September 2026 its site has not answered. The dApp was reachable but frozen for most of 2026 – the dashboard showed no live total value locked or trades and its most recent notice is dated December 2023.';

const NEW_SECTION = '<h2>The site stopped answering (September 2026)</h2>'
  + `<p><code>radixplanet.com</code> no longer serves anything. Requested at 19:08&nbsp;UTC on 19 September 2026 and again at 03:15&nbsp;UTC on 20 September, the apex, <code>www</code> and plain HTTP all time out while connecting, and the single address the domain resolves to accepts no connection on port 443 or port 80. The name itself is intact: its <a href="${RDAP}" ${EXT}>registry record</a>, read on 20 September, is <code>active</code>, registered on 22 March 2022 to an expiry of 22 March 2027 and last changed in February 2026, and its four Amazon Route&nbsp;53 nameservers answer normally. That makes this a host that stopped answering rather than a domain that changed hands, which is what happened to <a href="/ecosystem/cobra-stakes" rel="noopener">Cobra Stakes</a> and <a href="/ecosystem/apollo-pool" rel="noopener">Apollo Pool</a>.</p>`
  + `<p>The team's validator is unaffected and still running. Read from the <a href="https://mainnet.radixdlt.com/state/validators/list" ${EXT}>Radix Gateway</a> at epoch&nbsp;342,390 (20 September 2026, 03:19&nbsp;UTC), <a href="https://dashboard.radixdlt.com/network-staking/${V}" ${EXT}>🪐RadixPlanet</a> is registered with <strong>57,676,210&nbsp;XRD</strong> delegated to it, rank 33 of the 186 registered validators, uptime 100% over the preceding week, and a fee of <strong>40%</strong> against a stored <code>validator_fee_factor</code> of <code>0.3</code> (see <a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">Validator Nodes</a> for why those differ). It publishes <code>https://www.radixplanet.com/</code> as its <code>info_url</code> and hosts its validator icon on the same host, so a wallet listing the validator now shows a link that leads nowhere and no icon.</p>`;

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
  const infobox = blocks.find((b) => b.type === 'infobox')?.blocks?.find((b) => b.id === INFOBOX_BLOCK);
  const body = blocks.find((b) => b.id === BODY_BLOCK);
  if (!infobox) throw new Error('infobox block not found');
  if (!body) throw new Error('body block not found');

  if (JSON.stringify(blocks).includes(SENTINEL) || body.text.includes('The site stopped answering')) {
    console.log('  already applied, no write');
    process.exit(0);
  }
  if (!infobox.text.includes(STATUS_FROM)) throw new Error('infobox: status row not found verbatim');
  if (!body.text.includes(BODY_FROM)) throw new Error('body: Status opening not found verbatim');

  infobox.text = infobox.text.replace(STATUS_FROM, STATUS_TO);
  body.text = body.text.replace(BODY_FROM, NEW_SECTION + BODY_FROM.replace('<h2>Status</h2>', '<h2>Status</h2>'))
    .replace(BODY_FROM, BODY_TO);

  const json = JSON.stringify(blocks);
  const stray = json.match(new RegExp(NBSP, 'g'));
  if (stray) throw new Error(`${stray.length} raw U+00A0 in the written blocks`);

  const version = '2.2.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (+${json.length - JSON.stringify(page.content).length} chars)`);
  console.log(`    new section present: ${body.text.includes('The site stopped answering')}`);
  console.log(`    old claim gone:      ${!body.text.includes('remains online but is frozen')}`);
  if (DRY) console.log('\n--- tail ---\n' + body.text.slice(-2700) + '\n--- end ---');

  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'The page said the dApp "remains online but is frozen". radixplanet.com answers nothing: connect timeouts on the apex, www and plain HTTP at 19:08 UTC on 19 September and 03:15 UTC on 20 September 2026, and no connection accepted on 443 or 80 at the one address Route 53 returns. The name is intact (Verisign RDAP active, registered 22 March 2022 to 22 March 2027), so this is a host that stopped answering rather than a recycled domain. New section adds the validator reading at epoch 342,390: registered, 57,676,210 XRD, rank 33 of 186, 100% uptime, 40% fee against a stored 0.3, with its info_url and icon both on the dead host.',
       now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
