// Sweep 545: /contents/tech/core-concepts/trust-boundary said braided sharding keeps the whole network inside one
// trust boundary, in the present tense. Babylon is one shard group with nothing to braid, and hyperscale-rs, the
// Xi'an candidate, does not braid (t.me/hyperscale_rs/10314). Rewrites the Radix section against the
// hyperscale-rs record, replaces the unsourced generic section with OWASP's definition, and fixes the infobox row.
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const TAG_PATH = 'contents/tech/core-concepts';
const SLUG = 'trust-boundary';
const SENTINEL = 'hyperscale_rs/11105';
const DRY = process.argv.includes('--dry-run');

const OLD_ROW = 'Linear scaling via braided <a href="/contents/tech/core-concepts/sharding" rel="noopener">sharding</a> keeps the whole network inside one trust boundary – atomic cross-shard composability, no bridges';
const NEW_ROW = 'Babylon mainnet is one shard group, so the whole ledger sits inside one trust boundary. The planned <a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi’an</a> release would split it into many shard groups with no bridges between them';

const INTRO = '<p>A <strong>trust boundary</strong> [ /trʌst ˈbaʊndəri/ ] is the point in a system where the level of trust changes: on one side a component can rely on how the rest behaves, and on the other it has to check what it receives. In blockchains, each ledger is its own trust boundary, which is why moving an asset from one chain to another needs a bridge.</p>';

const GENERAL = '<h2>In security engineering</h2><p>Threat modelling draws trust boundaries on a data-flow diagram of the system. <a href="https://owasp.org/www-community/Threat_Modeling_Process" target="_blank" rel="noopener">OWASP’s threat modelling process</a> defines a boundary as “any location where the level of trust changes”, and places one wherever data enters or leaves the application: a login form, a network firewall, or the interface between two processes running with different privileges. Checks such as authentication, input validation and access control sit at the boundary, because nothing on the far side is assumed to behave.</p><p>Between blockchains the far side is another ledger with its own validators. A <a href="https://docs.chainswap.com/mechanism/chainswap-architecture" target="_blank" rel="noopener">burn-and-mint bridge</a> destroys or locks a token on one chain and issues a wrapped copy on the other, and the copy is only as good as whoever attests that the first step happened.</p>';

const RADIX = '<h2>Radix and the single-ledger trust boundary</h2><p>Most blockchains scale by adding ledgers, such as sidechains, rollups or app-chains, and each new ledger draws a new trust boundary. Radix is designed to scale by splitting one ledger instead.</p><p>Today that ledger is not split. <a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">Babylon</a>, live since 28 September 2023, runs <a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a> as a single shard group, so every account, component and resource sits inside one trust boundary and any transaction can touch any of them <a href="/contents/tech/core-concepts/atomic-composability" rel="noopener">atomically</a>.</p><p><a href="/contents/tech/releases/radix-mainnet-xian" rel="noopener">Xi’an</a>, the planned next release, would spread the ledger across many <a href="/contents/tech/core-concepts/shard-groups" rel="noopener">shard groups</a> that remain one network. In <a href="/contents/tech/research/hyperscale-rs" rel="noopener">hyperscale-rs</a>, the community project building it, every validator works out from the beacon chain which shards a transaction involves; the nodes holding that state share it, and each executes the transaction independently. Assets do not cross a bridge between shards or turn into wrapped copies. The <a href="/contents/tech/research/cerberus-whitepaper" rel="noopener">Cerberus whitepaper</a> proposed braiding the shards’ consensus together for cross-shard transactions; hyperscale-rs does not, and its lead developer gave the reason as <a href="https://t.me/hyperscale_rs/10314" target="_blank" rel="noopener">“braiding is a terrible idea. makes shards co-dependent on each other for liveness”</a>.</p><p>Splitting the ledger keeps one boundary around the network, but each shard has to trust the others’ validators. A shard does not hold another shard’s state, so it cannot check that shard’s work: <a href="https://t.me/hyperscale_rs/11105" target="_blank" rel="noopener">“if they did - it would not be a sharded system”</a>. A group holding a two-thirds quorum inside any one shard could <a href="https://t.me/hyperscale_rs/11107" target="_blank" rel="noopener">write that shard’s state as it chose</a>, and because <a href="/contents/tech/core-protocols/xrd-token" rel="noopener">XRD</a> exists in every shard, the damage would reach the whole network. hyperscale-rs therefore puts its security design into how validators are assigned to shards, described on its own page. Xi’an has no release date.</p>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query('SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied – no write');
    process.exit(0);
  }
  const row = blocks[0]?.blocks?.[0];
  if (!row?.text?.includes(OLD_ROW)) throw new Error('infobox row not found');
  row.text = row.text.replace(OLD_ROW, NEW_ROW);
  const set = (prefix, text) => {
    const b = blocks.find((x) => x.type === 'content' && x.text.startsWith(prefix));
    if (!b) throw new Error(`no block starting ${prefix}`);
    b.text = text;
  };
  set('<p><strong>A Trust Boundary</strong>', INTRO);
  set('<h2>Overview</h2>', GENERAL);
  set('<h2>Radix and the single-ledger trust boundary</h2>', RADIX);
  const version = '1.2.0';
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}, ${JSON.stringify(page.content).length} -> ${JSON.stringify(blocks).length} chars`);
  if (!DRY) {
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4', [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
        'Sweep 545: the page said braided sharding keeps Radix inside one trust boundary, in the present tense. Babylon is one shard group, and hyperscale-rs, the Xi’an candidate, does not braid (t.me/hyperscale_rs/10314). Radix section rewritten against the hyperscale-rs record, including the per-shard trust assumption (11105, 11107); unsourced generic section replaced with OWASP’s definition; infobox row corrected.', now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
