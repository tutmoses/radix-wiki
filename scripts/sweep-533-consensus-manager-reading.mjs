// Sweep 533 (contents/tech): Consensus Manager's ledger reading re-taken on 4 Oct 2026, with the
// epoch average across the 31 Aug – 11 Sep halt; the DeSci page's PsyDAO site link unlinked
// (psydao.io lapsed at its registrar on 22 Sep 2026 and serves Namecheap's expired-domain page).
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const SENTINEL = 'epoch 346,564';

const CM_LEDGER_OLD = '<tr><th>Ledger reading</th><td>Epoch 334,399 &middot; 12 August 2026</td></tr>';
const CM_LEDGER_NEW = '<tr><th>Ledger reading</th><td>Epoch 346,565 &middot; 4 October 2026</td></tr>';

const CM_SET_NEW =
  '<p>At epoch 346,564, on 4 October 2026, the mainnet ledger carried 289 validator components, of which 100 were active, holding 4.68bn XRD of stake between them. The distribution across those seats is steep: the largest active validator, SRWA, held 257m XRD and the hundredth, Malu, held 26,680 XRD. The hundredth seat is cheap because the cap is a fixed count, not a stake threshold.</p>';

const CM_ROUNDS_ADD =
  '<p>Read again on 4 October 2026, epoch 346,564 ran from about 15:09 to 15:14 UTC and closed after about 560 rounds, close to two a second, so it too ended on the clock. Between the two readings the counter advanced 12,166 epochs in 52.8 days, an average of 6.25 minutes an epoch. The difference is the halt: mainnet produced no rounds for ten and a half days after someone used an engine bug to drain the network of its Hyperlane-bridged assets on 31 August (see <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane Asset Drain</a>), until the Eagle Ray protocol update enacted on 11 September. With that stretch removed the average is 5.00 minutes. Because the unstaking delay is counted in epochs, an unstake caught across the halt came due about ten days later in calendar time than its 2,016 epochs suggest.</p>';

const PSY_OLD = '<a target=\\"_blank\\" rel=\\"noopener noreferrer nofollow\\" class=\\"link\\" href=\\"https://www.psydao.io/\\">PsyDAO</a>';

async function load(tagPath, slug) {
  if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [tagPath, slug]);
  if (!rows.length) throw new Error(`${tagPath}/${slug} not found`);
  return rows[0];
}

async function save(page, blocks, version, changeType, message, stamp) {
  const json = JSON.stringify(blocks);
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (DRY) return;
  const now = new Date().toISOString();
  await client.query('BEGIN');
  await client.query(
    `UPDATE pages SET content=$1, version=$2, updated_at=$3${stamp ? ', last_verified_at=$3' : ''} WHERE id=$4`,
    [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, changeType, AUTHOR_ID, message, now]);
  await client.query('COMMIT');
}

const mapText = (blocks, fn) => blocks.map((b) => ({
  ...b,
  ...(typeof b.text === 'string' ? { text: fn(b.text) } : {}),
  ...(Array.isArray(b.blocks) ? { blocks: mapText(b.blocks, fn) } : {}),
}));

try {
  // 1. Consensus Manager
  const cm = await load('contents/tech/core-concepts', 'consensus-manager');
  const cmRaw = JSON.stringify(cm.content);
  if (cmRaw.includes(SENTINEL)) {
    console.log('  consensus-manager: already applied – no write');
  } else {
    let hits = 0;
    const blocks = mapText(JSON.parse(cmRaw), (t) => {
      let out = t;
      if (out.includes(CM_LEDGER_OLD)) { out = out.replace(CM_LEDGER_OLD, CM_LEDGER_NEW); hits++; }
      const set = out.match(/<p>At epoch 334,399 the mainnet ledger carried[\s\S]*?<\/p>/);
      if (set) { out = out.replace(set[0], CM_SET_NEW); hits++; }
      const rounds = out.match(/<p>Read live on 12 August 2026,[\s\S]*?<\/p>/);
      if (rounds) { out = out.replace(rounds[0], rounds[0] + CM_ROUNDS_ADD); hits++; }
      return out;
    });
    if (hits !== 3) throw new Error(`consensus-manager: expected 3 replacements, got ${hits}`);
    await save(cm, blocks, '2.1.0', 'minor',
      'Ledger reading re-taken on 4 Oct 2026 from the Radix Gateway (status and validators/list): epoch 346,564, 289 validator components, 100 active, 4.68bn XRD active stake, largest SRWA 257m, hundredth Malu 26,680. New paragraph on the 4 Oct epoch (~560 rounds, ended on the clock) and the 12 Aug – 4 Oct average: 6.25 min an epoch, 5.00 min with the 31 Aug – 11 Sep halt removed (halt bounds from /contents/history/hyperlane-asset-drain-2026-timeline).',
      true);
  }

  // 2. DeSci: PsyDAO site link
  const ds = await load('contents/tech/core-concepts', 'decentralized-science-desci');
  const dsRaw = JSON.stringify(ds.content);
  if (!dsRaw.includes(PSY_OLD)) {
    console.log('  decentralized-science-desci: PsyDAO link already gone – no write');
  } else {
    const fixed = dsRaw.replace(PSY_OLD, 'PsyDAO');
    await save(ds, JSON.parse(fixed), '1.2.6', 'patch',
      'Unlinked PsyDAO\'s website: psydao.io passed its registrar expiry on 22 Sep 2026 and serves Namecheap\'s expired-domain page over HTTP and no TLS (read 4 Oct 2026). Its X, Discord and Telegram links stay.',
      false);
  }
} finally {
  client.release();
  await pool.end();
}
