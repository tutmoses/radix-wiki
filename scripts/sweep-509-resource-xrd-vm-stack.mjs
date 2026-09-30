/**
 * Sweep 509: the two stalest contents/tech pages by verification age (both 6 Aug).
 *
 * /contents/tech/core-concepts/resources
 *   - XRD worked example re-read live at state version 560,465,743 (epoch 345,411,
 *     30 Sep 2026 15:05 UTC): total supply 13,538,608,782.71, authority table
 *     unchanged and every updater still locked.
 *   - The "Global Caller" link pointed at the XRD resource itself. The genesis code
 *     names the caller: bootstrap.rs L419/L423 set minter and burner to
 *     rule!(require(global_caller(CONSENSUS_MANAGER))). The page hedged with "in
 *     practice"; it now cites the rule.
 *
 * /contents/tech/core-protocols/vm-layer
 *   - WasmValidatorConfigV1's max_stack_size of 1024 was described as 1,024 call
 *     FRAMES. radix-wasm-instrument's inject_stack_limiter counts stack values:
 *     each function costs its locals plus its maximal value-stack height, summed
 *     over the calls in progress (docs.rs, radix-wasm-instrument 1.0.0).
 *   - wasmi is pinned at =0.39.1 in the workspace Cargo.toml (L136), commented as
 *     requiring explicit upgrades for non-determinism testing.
 *   - What Xi'an Changes claimed the native blueprint set survives. hyperscale-vm
 *     at 629fbd5 (27 Sep) pins wasmtime =48.0.2 (cranelift, winch, pulley), meters
 *     with a separate fuel-meter crate, and ships account and staking as prebuilt
 *     WASM blobs in crates/stdlib, so there is no native/WASM split to survive.
 *     The 24 Sep migration answer (t.me/hyperscale_rs/12978) is linked through the
 *     Hyperscale VM page, which carries it in full.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const NBSP = String.fromCharCode(160);
const DRY = process.argv.includes('--dry-run');
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const SCRYPTO = 'https://github.com/radixdlt/radixdlt-scrypto/blob/a62393f716153ea2e4a4342210a47b8214941592';
const HVM = 'https://github.com/hyperscalers/hyperscale-vm/tree/629fbd56dc5253486547e53fb7edbde7054573f0';
const HVM_BLOB = 'https://github.com/hyperscalers/hyperscale-vm/blob/629fbd56dc5253486547e53fb7edbde7054573f0';

const PAGES = [
  {
    tagPath: 'contents/tech/core-concepts',
    slug: 'resources',
    version: '2.1.0',
    sentinel: 'state version 560,465,743',
    message: 'XRD worked example re-read live at state version 560,465,743 (epoch 345,411, 30 Sep 2026): supply 13,538,608,782.71, authority table unchanged and locked. The Global Caller link pointed at the XRD resource; it now cites the genesis rule in bootstrap.rs (minter and burner require global_caller(CONSENSUS_MANAGER)), replacing the "in practice" hedge.',
    edits: [
      {
        find: 'Read live from mainnet at state version 546564033 (epoch 332718, 6 August 2026, 23:05 UTC), <a href="/contents/tech/core-protocols/xrd-token" rel="noopener">XRD</a> carries 18 decimals, a total supply of 13,503,704,464.97 and this authority table:',
        replace: 'Read live from mainnet at state version 560,465,743 (epoch 345,411, 30 September 2026, 15:05 UTC), <a href="/contents/tech/core-protocols/xrd-token" rel="noopener">XRD</a> carries 18 decimals, a total supply of 13,538,608,782.71, about 34.9 million more than at the 6 August reading, and this authority table:',
      },
      {
        find: 'First, XRD is mintable, which surprises people who read "fixed supply" into a native token — but the badge its <code>minter</code> requires is a <a href="https://dashboard.radixdlt.com/resource/resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd" target="_blank" rel="noopener">Global Caller</a> badge, the implicit proof the engine issues to a component when it calls another component. Only one specific on-ledger component can present it, and in practice the mint path is the <a href="/contents/tech/core-concepts/consensus-manager" rel="noopener">consensus manager</a> paying <a href="/contents/tech/core-concepts/network-emissions" rel="noopener">validator emissions</a> each epoch.',
        replace: `First, XRD is mintable, which surprises people who read "fixed supply" into a native token. But the badge its <code>minter</code> requires is a Global Caller badge, the implicit proof the engine issues to a component when it calls another component, and the genesis code names which one: ${ext(`${SCRYPTO}/radix-engine/src/system/bootstrap.rs#L419-L423`, '<code>require(global_caller(CONSENSUS_MANAGER))</code>')}, for <code>minter</code> and <code>burner</code> alike. The <a href="/contents/tech/core-concepts/consensus-manager" rel="noopener">consensus manager</a> is the only caller that can present it, and it mints to pay <a href="/contents/tech/core-concepts/network-emissions" rel="noopener">validator emissions</a> each epoch.`,
      },
    ],
  },
  {
    tagPath: 'contents/tech/core-protocols',
    slug: 'vm-layer',
    version: '2.1.0',
    sentinel: 'caps the WASM stack at 1,024 values',
    message: 'Stack limit: WasmValidatorConfigV1 max_stack_size 1024 counts stack values (locals plus maximal value-stack height per active call, per radix-wasm-instrument inject_stack_limiter), not call frames. wasmi pin (=0.39.1, Cargo.toml L136) added. What Xi\'an Changes: hyperscale-vm at 629fbd5 pins wasmtime 48.0.2, meters with its own fuel-meter crate and ships account and staking as prebuilt WASM in crates/stdlib, so the claim that the native blueprint set survives is removed; 24 Sep migration answer linked via the Hyperscale VM page.',
    edits: [
      {
        find: '<td><code>wasmi</code> interpreter</td>',
        replace: '<td><code>wasmi</code> 0.39.1 interpreter</td>',
      },
      {
        find: '</a>, an interpreter targeting the WebAssembly MVP.',
        replace: `</a>, an interpreter targeting the WebAssembly MVP, pinned to exactly version 0.39.1 in the ${ext(`${SCRYPTO}/Cargo.toml#L136`, 'workspace manifest')} because any upgrade has to be tested for non-determinism first.`,
      },
      {
        find: '<code>WasmValidatorConfigV1</code></a> caps the call stack at 1,024 frames, so recursion terminates as a clean transaction failure instead of exhausting a validator\'s memory.',
        replace: `<code>WasmValidatorConfigV1</code></a> caps the WASM stack at 1,024 values. The unit is not a call frame: ${ext('https://docs.rs/radix-wasm-instrument/1.0.0/radix_wasm_instrument/fn.inject_stack_limiter.html', 'the stack limiter')} charges each function its locals plus the deepest point of its value stack, summed over the calls in progress, so deep recursion ends as a clean transaction failure instead of exhausting a validator's memory.`,
      },
      {
        find: 'Read against this page, that is a precise claim: the VM boundary and the native blueprint set survive; the interpreter, the metering strategy and the substate access underneath them do not. No migration has been scheduled.',
        replace: `The engine's repository has since made the lower layers concrete, and they share little with this page. ${ext(`${HVM_BLOB}/Cargo.toml#L62`, 'Hyperscale VM pins wasmtime 48.0.2')}, with its Cranelift and Winch compilers and its Pulley interpreter, where Babylon pins wasmi; metering is its own ${ext(`${HVM}/crates/meter`, 'fuel meter')} pass; and the account and staking packages ship as ${ext(`${HVM}/crates/stdlib/blobs`, 'prebuilt WebAssembly')} rather than native Rust, so the two-VM split described above has no counterpart there. On 24 September the lead developer ${ext('https://t.me/hyperscale_rs/12978', 'said')} Babylon's ledger would be transformed at a new genesis and that developers might need to rebuild their contracts; the plan and its caveats are on the <a href="/contents/tech/research/hyperscale-vm" rel="noopener">Hyperscale VM</a> page. No migration has been scheduled.`,
      },
    ],
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const p of PAGES) {
    if (isLockedPage(p.tagPath, p.slug)) throw new Error(`${p.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [p.tagPath, p.slug]);
    if (!rows.length) throw new Error(`${p.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(p.sentinel)) {
      console.log(`  ${p.slug}: already applied – no write`);
      continue;
    }
    const texts = [];
    const walk = (bs) => bs.forEach((b) => { if (typeof b.text === 'string') texts.push(b); walk(b.blocks ?? []); (b.columns ?? []).forEach((c) => walk(c.blocks ?? [])); });
    walk(blocks);
    for (const { find, replace } of p.edits) {
      const hits = texts.filter((b) => b.text.includes(find));
      const n = hits.reduce((a, b) => a + b.text.split(find).length - 1, 0);
      if (n !== 1) throw new Error(`${p.slug}: expected 1 match, got ${n}: ${find.slice(0, 80)}`);
      hits[0].text = hits[0].text.replace(find, () => replace);
    }
    const json = JSON.stringify(blocks);
    if (json.includes(NBSP) !== JSON.stringify(page.content).includes(NBSP)) throw new Error('nbsp introduced');
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${p.version}  (${JSON.stringify(page.content).length} -> ${json.length} chars)`);
    if (!DRY) {
      const now = new Date().toISOString();
      await client.query('BEGIN');
      await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, p.version, now, page.id]);
      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cuid(), page.id, json, page.title, p.version, 'minor', AUTHOR_ID, p.message, now]);
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
