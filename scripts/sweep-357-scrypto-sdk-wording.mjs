import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');

const MESSAGE = 'Scrypto is a Rust SDK, not a language: the crate, its macros and the CLI, with cargo and rustc doing the compiling. Follows the reframing of the Scrypto page (v2.0.0) after its lead developer said so on 2 September 2026 (t.me/hyperscale_rs/11575).';

const TARGETS = [
  { tagPath: 'ecosystem', slug: 'bondefi', edits: [
    ['using Scrypto, Radix&#39;s Rust-based smart contract programming language',
     'using Scrypto, Radix&#39;s Rust SDK for smart contracts'] ] },
  { tagPath: 'ecosystem', slug: 'root-finance', edits: [
    ['written in Scrypto, a programming language designed for the Radix DLT',
     'written in Scrypto, the Rust SDK for building on Radix DLT'] ] },
  { tagPath: 'ecosystem', slug: 'stabilis', edits: [
    ['the Radix platform and its Scrypto programming language', 'the Radix platform and its Scrypto SDK'],
    ['implemented using Radix&#39;s Scrypto programming language', 'implemented using Radix&#39;s Scrypto SDK'],
    ['Built on Radix&#39;s Scrypto language.', 'Built on Radix&#39;s Scrypto SDK.'] ] },
  { tagPath: 'ecosystem', slug: 'impahla', edits: [
    ['<strong>Coding Language</strong>', '<strong>Tooling</strong>'],
    ['Scrypto language simplified the development process', 'Scrypto SDK simplified the development process'] ] },
  { tagPath: 'ecosystem', slug: 'dogecube', edits: [
    ['the Radix network and its smart contract language Scrypto', 'the Radix network and its Scrypto smart-contract SDK'] ] },
  { tagPath: 'ecosystem', slug: 'radix-foundation', edits: [
    ['such as the Radix Engine, Scrypto programming language, wallets', 'such as the Radix Engine, the Scrypto SDK, wallets'],
    ['including the Radix Engine, the Scrypto programming language, and various wallets',
     'including the Radix Engine, the Scrypto SDK, and various wallets'] ] },
  { tagPath: 'developers/getting-started', slug: '01-install-scrypto', edits: [
    ["Scrypto is Radix's smart-contract language, built on Rust.",
     "Scrypto is Radix's smart-contract SDK for Rust: a crate, a set of macros and a CLI that build a blueprint crate into WebAssembly."] ] },
  { tagPath: 'ecosystem', slug: 'academia-scrypto', edits: [
    [', the asset-oriented smart-contract language <a href="https://docs.radixdlt.com/docs"',
     ', the asset-oriented smart-contract SDK <a href="https://docs.radixdlt.com/docs"'],
    ['motivations for learning Scrypto mirrored the language', 'motivations for learning Scrypto mirrored the SDK'],
    ['it reflects the language as it stood at that time', 'it reflects Scrypto as it stood at that time'] ] },
];

for (const t of TARGETS) for (const [, to] of t.edits) {
  if (/[\u00A0\u2014]/.test(to)) throw new Error(`${t.slug}: replacement carries a non-breaking space or em dash`);
}

const bumpPatch = (v) => { const [a, b, c] = v.split('.').map(Number); return `${a}.${b}.${c + 1}`; };

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const { tagPath, slug, edits } of TARGETS) {
    if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [tagPath, slug]);
    if (!rows.length) throw new Error(`${tagPath}/${slug} not found`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    const applied = [];
    for (const [from, to] of edits) {
      let hits = 0;
      const walk = (bs) => bs.forEach((b) => {
        if (b.type === 'infobox') return walk(b.blocks || []);
        if (typeof b.text === 'string' && b.text.includes(from)) {
          hits += b.text.split(from).length - 1;
          b.text = b.text.split(from).join(to);
        }
      });
      walk(blocks);
      applied.push(hits);
    }
    const total = applied.reduce((a, b) => a + b, 0);
    if (total === 0) { console.log(`  ${tagPath}/${slug}: already applied, no write`); continue; }
    if (applied.some((h) => h === 0)) throw new Error(`${tagPath}/${slug}: partial match ${JSON.stringify(applied)} - inspect before writing`);

    const version = bumpPatch(page.version);
    console.log(`  ${DRY ? '[dry] ' : ''}${(tagPath + '/' + slug).padEnd(48)} v${page.version} -> v${version}  edits ${applied.join(',')}`);
    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
        [json, version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, version, 'patch', AUTHOR_ID, MESSAGE, now]);
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
