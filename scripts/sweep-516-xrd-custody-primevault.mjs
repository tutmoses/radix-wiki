/**
 * Sweep 516: /ideas/dao-xrd-custody had no reading since 16 August. On 28 September 2026
 * projectShift (authorship embed-checked in run 505) wrote in Radix DLT Official that
 * PrimeVault agreed to extend the Foundation's existing custody contract to end-2026 so
 * the DAO can take it over once formed (t.me/radix_dlt/1005384), and that the handover
 * amount will be known only on the day, after incorporation and once the Transition RAC
 * has the PrimeVault account and signers in place (t.me/radix_dlt/1005311). Records it
 * on the card and adds a Latest row.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ideas';
const SLUG = 'dao-xrd-custody';
const SENTINEL = 'id="custody-provider-named"';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const int = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;

const LATEST_ROW = '<tr><th>Latest</th><td>28 Sep 2026 &ndash; PrimeVault to carry the Foundation&rsquo;s custody contract to end-2026 for the DAO to take over, said in chat and not yet documented</td></tr>';

const SECTION = `<h2 id="custody-provider-named">A custody provider, named in chat (28 September 2026)</h2>
<p>The Operating Agreement&rsquo;s activation checklist counts a custody provider among the ${int('/ideas/dao-foundation-ip-asset-transfer', 'external dependencies')} the DAO cannot satisfy on its own, and does not name one. On 28 September 2026 projectShift, writing in ${ext('https://t.me/radix_dlt/1005384', 'Radix DLT Official')}, did: PrimeVault, the custody provider the Foundation already uses, has agreed to extend the Foundation&rsquo;s existing contract to the end of 2026 so that the DAO can take it over once it is formed. The DAO would pay nothing to join the contract, and would probably be required to keep it for a further twelve months after that. ${ext('https://t.me/radix_dlt/1005311', 'Asked in the same thread')} when the community will learn how much the Foundation hands over, they said probably only on the day it is handed over, which comes after the DAO is incorporated and the Transition RAC has the PrimeVault account and its signers in place. The Transition RAC&rsquo;s own legal and MIDAO costs are being met from a Foundation grant routed through GetRadix, because no DAO entity exists yet to receive it.</p>
<p>If the handover runs that way, the treasury opens in mixed custody, the second of the two models the Temperature Check put up, with the ${int('/ideas/dao-treasury-multisig-signers', '2-of-3 on-ledger account')} keeping what it holds today. None of this is written down anywhere the community can check yet: the Temperature Check is unresolved, the custody arrangement may be documented confidentially under the Operating Agreement, and the ratio of XRD to stablecoins the card asks about is untouched by it.</p>`;

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
    console.log('  already applied, no write');
    process.exit(0);
  }
  const infobox = blocks.find((b) => b.type === 'infobox');
  const table = infobox.blocks.find((b) => b.text?.includes('</tbody></table>'));
  if (!table || table.text.includes('<th>Latest</th>')) throw new Error('infobox shape unexpected');
  table.text = table.text.replace('</tbody></table>', `${LATEST_ROW}</tbody></table>`);
  blocks.push({ id: uid(), type: 'content', text: SECTION });

  const version = '1.2.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${blocks.length} blocks)`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'PrimeVault named as the custody provider the DAO inherits: projectShift in Radix DLT Official, 28 Sep 2026 (t.me/radix_dlt/1005384, 1005311), Foundation contract extended to end-2026, handover amount known only on the day, after incorporation and PrimeVault account/signers. New section, Latest row added to the infobox.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
