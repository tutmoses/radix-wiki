// Sweep 476: link the new /contents/tech/research/hyperscale-vm page from the two
// pages that describe the VM without naming it, and bring hyperscale-rs's stale
// VM counts up to the repositories as read on 24 September 2026 (hyperscale-vm:
// 1,218 commits on main, all by flightofthefox; hyperscale-rs Cargo.toml: 13 path
// crates from vm/; hyperscale-rs/crates: 34 entries).
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const SENTINEL = 'href="/contents/tech/research/hyperscale-vm"';
const VM = '<a href="/contents/tech/research/hyperscale-vm" rel="noopener">hyperscale-vm</a>';

const EDITS = [
  {
    tagPath: 'contents/tech/releases',
    slug: 'radix-mainnet-xian',
    changeType: 'patch',
    message: 'Execution Layer names the purpose-built VM, hyperscale-vm, and links its new page.',
    replace: [[
      'is <a href="https://t.me/hyperscale_rs/10334" target="_blank" rel="noopener">underway</a> rather than a sharding retrofit',
      `is <a href="https://t.me/hyperscale_rs/10334" target="_blank" rel="noopener">underway</a>, now developed as ${VM}, rather than a sharding retrofit`,
    ]],
  },
  {
    tagPath: 'contents/tech/research',
    slug: 'hyperscale-rs',
    changeType: 'patch',
    message: 'Infobox and Crate Structure: link the new hyperscale-vm page and update the VM counts from the repositories (1,218 commits; 13 vm/ path crates; 34 workspace crates), read 24 September 2026.',
    replace: [
      [
        'The purpose-built <a href="https://github.com/hyperscalers/hyperscale-vm" target="_blank" rel="noopener">hyperscalers/hyperscale-vm</a> (created 30 July 2026; 133 commits, all by the lead developer)',
        `The purpose-built ${VM} (<a href="https://github.com/hyperscalers/hyperscale-vm" target="_blank" rel="noopener">repository</a> created 30 July 2026; 1,218 commits by 24 September 2026, all by the lead developer)`,
      ],
      [
        'declares seven <code>hyperscale-vm-*</code> path crates and no Radix dependency',
        'declares 13 path crates from the VM repository and no Radix dependency',
      ],
      [
        '<td>33 (Cargo workspace), plus the seven VM crates in the <code>vm/</code> submodule</td>',
        '<td>34 (Cargo workspace), plus 13 VM crates from the <code>vm/</code> submodule (24 September 2026)</td>',
      ],
      [
        'Cargo workspace of 33 crates</a>, with the execution engine\'s seven more in the <code>vm/</code> submodule beside it',
        `Cargo workspace of 34 crates</a>, with 13 more from the execution engine, ${VM}, in the <code>vm/</code> submodule beside it`,
      ],
    ],
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const bump = (v) => { const [a, b, c] = v.split('.').map(Number); return `${a}.${b}.${c + 1}`; };

try {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(SENTINEL)) { console.log(`  ${e.slug}: already applied, no write`); continue; }

    const walk = (bs, from, to) => {
      let n = 0;
      for (const b of bs) {
        if (typeof b.text === 'string' && b.text.includes(from)) { b.text = b.text.split(from).join(to); n++; }
        if (Array.isArray(b.blocks)) n += walk(b.blocks, from, to);
        if (Array.isArray(b.columns)) for (const c of b.columns) n += walk(c.blocks ?? [], from, to);
      }
      return n;
    };
    for (const [from, to] of e.replace) {
      const n = walk(blocks, from, to);
      if (n !== 1) throw new Error(`${e.slug}: expected 1 match, got ${n} for "${from.slice(0, 60)}"`);
    }

    const version = bump(page.version);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
    if (!DRY) {
      const now = new Date().toISOString();
      const json = JSON.stringify(blocks);
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, version, e.changeType, AUTHOR_ID, e.message, now]);
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
