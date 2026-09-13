// sweep 426 (ideas): the two validator cards re-measured two days after the 11 September 2026 restart.
// Both carried an August reading (epoch 335,598). Sources: mainnet Gateway /state/validators/list and
// /statistics/validators/uptime read at epoch 340,611 (13 September 2026, 23:06 UTC), cross-checked
// against radixscan radix_get_validator_list (same epoch, 185 registered, same ranks).
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const SENTINEL = 'epoch 340,611';
const ANCHOR = '<h2>Deliverables</h2>';
const WEFT = 'https://dashboard.radixscan.io/network-staking/validator_rdx1sd6n65sx0thvfzfp6x0jp4qgwxtudpx575wpwqespdlva2wldul9xk';

const EDITS = [
  {
    slug: 'dao-grow-validator-set',
    version: '1.2.0',
    message: 'Re-measured at epoch 340,611 (13 September 2026), two days after the restart: 185 registered (176 with stake), rank 100 holds 20,003 XRD (45,500 in August), 86 hold 1M+ (89). 20 of the 100 active-set validators have made no proposals since noon UTC on 11 September, holding 265.6M XRD (5.8% of registered stake), 186.9M of it on the Weft Finance validator. Gateway /state/validators/list and /statistics/validators/uptime, cross-checked with radixscan.',
    section: `<h2>After the restart (September 2026)</h2><p>Mainnet restarted on 11 September 2026 after a ten-day halt. Read again on 13 September at epoch 340,611, the set is still full and thinner at the bottom. 185 validators are registered, three fewer than in August, and 176 of them carry stake. The 100th by stake, XRDStake.com, holds 20,003 $XRD, less than half what the 100th held in August, and every registered validator below it holds 60,517 $XRD between them. 86 registered validators hold a million $XRD or more, down from 89; three that held over 10 million each <a href="/contents/resources/radix-ecosystem-operational-status" rel="noopener">unregistered in the first two days after the restart</a>.</p><p>A registered slot is also not a running node. 20 of the 100 validators in the active set for that epoch have made no proposals since noon UTC on 11 September, by the mainnet Gateway's <code>/statistics/validators/uptime</code> endpoint: each has missed every proposal it was due to make. They hold 265.6 million $XRD, 5.8% of registered stake, and 186.9 million of it sits on one validator, <a href="${WEFT}" target="_blank" rel="noopener">the Weft Finance node</a>, sixth by stake. The <a href="/contents/tech/core-concepts/consensus-manager" rel="noopener">consensus manager</a> pays emissions only for successful proposals, so these 20 earn nothing and neither does the stake delegated to them. Recruitment has two gaps to fill after the restart: stake behind the smallest slots, and operators who bring their nodes back.</p>`,
  },
  {
    slug: 'dao-validator-subsidy-future',
    version: '1.2.0',
    message: 'Re-measured at epoch 340,611 (13 September 2026), two days after the restart: registered stake 4.60B XRD (171M less than August), top 50 hold 91.3%, top 10 40.1%, the 50th validator 0.45%. 20 active-set validators with no proposals since 11 September added as the uptime case the pseudo-jailing question addresses. Gateway /state/validators/list and /statistics/validators/uptime, cross-checked with radixscan.',
    section: `<h2>After the restart (September 2026)</h2><p>Read again on 13 September 2026 at epoch 340,611, two days after mainnet restarted, concentration has risen a little further. Registered validators hold 4.60 billion $XRD, 171 million less than in August. The top 50 hold 91.3% of it and the top 10 hold 40.1%, and the 50th validator, radix.stake.fun, holds 0.45%.</p><p>The restart also produced the uptime problem pseudo-jailing is meant to handle. 20 of the 100 validators in the active set have made no proposals since 11 September, holding 5.8% of registered stake; <a href="/ideas/dao-grow-validator-set" rel="noopener">the recruitment card</a> has the measurement. The protocol keeps them in the set while they earn no emissions, so their delegators earn nothing until the operator brings the node back or the delegators move their stake.</p>`,
  },
];

const BANNED = new RegExp(`[${String.fromCharCode(0xa0, 0x2014)}]`);
for (const e of EDITS) {
  if (BANNED.test(e.section + e.message)) throw new Error(`U+00A0 or em dash in ${e.slug}`);
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage('ideas', e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['ideas', e.slug]);
    if (!rows.length) throw new Error(`${e.slug}: page not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (blocks.some((b) => b.text?.includes(SENTINEL))) {
      console.log(`  ${e.slug}: already applied, no write`);
      continue;
    }
    const hits = blocks.filter((b) => b.type === 'content' && b.text?.includes(ANCHOR));
    if (hits.length !== 1) throw new Error(`${e.slug}: anchor matched ${hits.length} blocks`);
    hits[0].text = hits[0].text.replace(ANCHOR, e.section + ANCHOR);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  (+${e.section.length} chars)`);
    if (DRY) continue;
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, 'minor', AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  client.release();
  await pool.end();
}
