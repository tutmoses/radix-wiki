// Sweep 522: /ecosystem/avaunt-staking, 2 Oct 2026. The ecosystem link audit found
// avaunt-staking.com answering Vercel 404 DEPLOYMENT_NOT_FOUND (107-byte body). The page still
// said the site "is still online" and cited it live three times. Last Wayback capture is
// 13 Oct 2025 (CDX). The validator's own metadata, read from the Gateway at epoch 346,035
// (19:09 UTC 2 Oct), still names https://avaunt-staking.com as info_url and loads its icon from
// /images/logo.png on that domain. No fee or stake figure added (1 Oct scope rule).
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'ecosystem';
const SLUG = 'avaunt-staking';
const ARCHIVE = 'https://web.archive.org/web/20251013053619/https://avaunt-staking.com/';
const SENTINEL = '20251013053619';
const DASH = 'https://dashboard.radixdlt.com/validator/validator_rdx1sd9uhhpml8vjz8uz0tut9jzv2mx326jdusfxjpccccj2904s8ndhqq';
const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const OLD = 'the <a href="https://avaunt-staking.com" target="_blank" rel="noopener">avaunt-staking.com</a> site is still online but is a 2023 artefact, its footer reading "Copyright &copy; 2023" and its Radix section still announcing that "Radix is now LIVE".';
const NEW = `the avaunt-staking.com site was a 2023 artefact to the end, its ${a(ARCHIVE, 'last archived copy')} (13 October 2025) still carrying a 2023 copyright footer and a Radix section announcing that "Radix is now LIVE". The site is now gone: read on 2 October 2026, the domain answers with Vercel's "deployment not found" error. The validator has not caught up. Its on-ledger metadata, read from the Radix Gateway the same day, still gives avaunt-staking.com as its <code>info_url</code> and loads its icon from that domain, so wallets and dashboards that follow either get nothing back. The ${a(DASH, 'validator\'s Radix Dashboard page')} carries its current name, fee and stake.`;

const DRY = process.argv.includes('--dry-run');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  if (JSON.stringify(page.content).includes(SENTINEL)) { console.log('  already applied, no write'); process.exit(0); }
  const blocks = JSON.parse(JSON.stringify(page.content));
  const [top, legacy] = blocks;
  if (!top?.text?.includes(OLD)) throw new Error('OLD sentence not found');
  top.text = top.text.replace(OLD, NEW);
  const liveCites = (legacy.text.match(/<a href="https:\/\/avaunt-staking\.com">/g) || []).length;
  if (liveCites !== 2) throw new Error(`expected 2 live cites in legacy block, found ${liveCites}`);
  legacy.text = legacy.text.replaceAll('<a href="https://avaunt-staking.com">', `<a href="${ARCHIVE}" target="_blank" rel="noopener">`);
  const json = JSON.stringify(blocks);
  if (/https:\/\/avaunt-staking\.com"/.test(json)) throw new Error('live avaunt-staking.com link remains');
  if (/\u2014|\u00a0/.test(NEW)) throw new Error('em dash or nbsp in new text');

  const version = '3.3.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  if (DRY) console.log(NEW);
  if (!DRY) {
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 522: avaunt-staking.com is offline (Vercel DEPLOYMENT_NOT_FOUND, read 2 Oct 2026). The page said the site was still online; the three citations to it now point at the last Wayback capture (13 Oct 2025). Noted that the validator\'s on-ledger info_url and icon_url still point at the dead domain (Gateway, epoch 346,035), with a link to its Radix Dashboard page.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
