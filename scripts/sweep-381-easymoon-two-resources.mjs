import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID } from './seed-utils.mjs';
import { isLockedPage } from '../src/lib/tags.ts';
config();

const TAG_PATH = 'ecosystem';
const SLUG = 'easymoon';
const SENTINEL = 'two-resources-carry-this-name';
const DRY = process.argv.includes('--dry-run');

const OLD_ROW = '<td>$EMOON – total supply 42,000,000,000</td>';
const NEW_ROW = '<td>$EMOON – 42,000,000,000 minted, 41,975,881,332.04 in supply (<a href="#' + SENTINEL + '" rel="noopener">two resources carry the name</a>)</td>';

const SECTION = `<h2 id="${SENTINEL}">Two resources carry this name</h2>
<p>Anyone buying <q>$EMOON</q> has to choose between two tokens. The Radix ledger holds two distinct fungible resources both named <strong>EasyMoon</strong>, both giving <code>easymoon.io</code> as their <code>info_url</code>, and <a href="/ecosystem/ociswap" rel="noopener">Ociswap</a> lists both. Read pinned at state version 557,840,622, the last ledger state before <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">the network halt of 31 August 2026</a>:</p>
<table><tbody>
<tr><th>Resource</th><th>Symbol</th><th>Minted</th><th>Burned</th><th>Supply</th><th>Ociswap listing</th></tr>
<tr><td><code>resource_rdx1t5y9qggzzsrxj05veq3uy2er3wtctp8hwqw0dvgaxkve2elpqk290u</code></td><td>EMOON</td><td>42,000,000,000</td><td>24,118,667.96</td><td>41,975,881,332.04</td><td><a href="https://api.ociswap.com/tokens/resource_rdx1t5y9qggzzsrxj05veq3uy2er3wtctp8hwqw0dvgaxkve2elpqk290u" target="_blank" rel="noopener">emoon1</a>, 12 January 2024</td></tr>
<tr><td><code>resource_rdx1t5jt96k2ywxq36qt6sdsjfsrq8nchgruhtzq35p8haxte8xwmw2c4r</code></td><td>emoon</td><td>42,000,000,000</td><td>0</td><td>42,000,000,000</td><td><a href="https://api.ociswap.com/tokens/resource_rdx1t5jt96k2ywxq36qt6sdsjfsrq8nchgruhtzq35p8haxte8xwmw2c4r" target="_blank" rel="noopener">emoon</a>, 3 October 2023</td></tr>
</tbody></table>
<p>Both were minted at exactly forty-two billion, which is the figure this page has always quoted, and the two have diverged since. The first is the resource this page identifies in its facts table. Its minter role is set to <code>DenyAll</code> and its burner role to <code>AllowAll</code>, so no more can be created and anyone holding the token can destroy their own: 24,118,667.96 have been burned that way. The second has <code>DenyAll</code> on minter and burner alike and no owner rule at all, so its forty-two billion is frozen exactly where it was issued and nothing about the resource can be changed again.</p>
<p>The ledger records what each resource is, not which one the project intended people to hold, and nothing published by EasyMoon settles that: <code>easymoon.io</code>, named by both resources and by the icon each one points at, has had no DNS record since at least 30 July 2026, so neither icon renders and the <code>info_url</code> on both leads nowhere. A reader who wants the token this page describes should match the resource address rather than the symbol, which is not unique.</p>`;

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
  const flat = JSON.stringify(blocks);
  if (flat.includes(SENTINEL)) { console.log('  already applied - no write'); process.exit(0); }

  const ib = blocks[0];
  if (ib?.type !== 'infobox' || !ib.blocks?.[0]) throw new Error('infobox block not found');
  if (!ib.blocks[0].text.includes(OLD_ROW)) throw new Error('token row not matched');
  ib.blocks[0].text = ib.blocks[0].text.replace(OLD_ROW, NEW_ROW);

  blocks.push({ id: uid(), type: 'content', text: SECTION });

  const version = '2.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${blocks.length} blocks)`);
  if (DRY) console.log('  row ->', NEW_ROW);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Two distinct EasyMoon resources exist on the ledger and Ociswap lists both, so the page told readers to buy a symbol that is not unique. Read pinned at state version 557,840,622: the resource this page identifies has burned 24,118,667.96 of its 42bn mint under an AllowAll burner, while the second is frozen at 42bn with minter, burner and owner all DenyAll. The facts table quoted the mint figure as the supply. easymoon.io, the info_url and icon host on both, still has no DNS record.', now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
