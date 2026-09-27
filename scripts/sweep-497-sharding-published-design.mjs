/**
 * Sweep 497: the two stalest contents/tech pages by verification age (both 2 Aug).
 *
 * /contents/tech/core-concepts/sharding
 *   - The Deterministic Shard Indexing formula was a pasted KaTeX render, readable
 *     as "si=mod piSs=shard indexp=public keyS=total..." with zero-width spaces.
 *     Replaced with the formula in plain HTML.
 *   - Deterministic indexing and the four Network Security mechanisms (root shards,
 *     fee-driven multi-shard support, stake-scaled shard count) are the Tempo-era
 *     published design (radixdlt.com/blog/sharding-in-radix, 2 Aug 2018: "Your
 *     public key determines the shard your wallet lives on", "the system pulls
 *     nodes into underserved shards"). The page presented them as how Radix runs.
 *     Babylon runs one validator set; the Xi'an candidate derives committees from a
 *     beacon chain (shard-groups page). Framed accordingly; the closing claim that
 *     they "ensure" secure scaling becomes what they were intended to do.
 *   - Modern Implementations stopped at Ethereum's 64 shard chains. ethereum.org:
 *     proto-danksharding (EIP-4844) live with Dencun, March 2024; Fusaka live
 *     3 December 2025 with PeerDAS, each node holding a subset of blob data.
 *
 * /contents/tech/core-concepts/rollups
 *   - L2BEAT figures re-read from l2beat.com/api/scaling/summary, 27 Sep 2026
 *     (chart point 13:00 UTC): 22 layer-2 rollups on Ethereum (11 optimistic,
 *     11 ZK); Base 16.5bn TVS, Arbitrum One 11.7bn. The page had Arbitrum One
 *     largest at 17.7bn. No dollar signs: the renderer reads them as maths.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const NBSP = String.fromCharCode(160);
const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'contents/tech/core-concepts';
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const TEMPO_POST = 'https://www.radixdlt.com/blog/sharding-in-radix';

const PAGES = [
  {
    slug: 'sharding',
    version: '2.1.0',
    sentinel: 'id="published-design-note"',
    edits: [
      {
        find: /<p>si=mod[^<]*<\/p>/,
        replace: `<p><code>s<sub>i</sub> = p<sub>i</sub> mod S</code>, where <code>s<sub>i</sub></code> is the shard index, <code>p<sub>i</sub></code> the public key and <code>S</code> the size of the shard space.</p><p id="published-design-note">This is the published design, and the ${ext(TEMPO_POST, '2018 Radix post that describes it')} predates Cerberus: it says a wallet's public key determines the shard it lives on. It has no effect on <a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">Babylon</a>, which runs a single shard group, and the Xi’an candidate places a substate key by the shape of its shard trie rather than by a modulus, as the section above describes.</p>`,
      },
      {
        find: '<h3>Network Security</h3>',
        replace: `<h3>Network Security</h3><p>The four mechanisms below come from the same Tempo-era design, in which ${ext(TEMPO_POST, 'each node maintained as many shards as it could and the system pulled nodes into underserved shards')}. None of them runs today. On Babylon every active <a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">validator</a> validates every transaction, so there is no shard to choose. The Xi’an candidate replaces free-market shard selection with committees that a beacon chain assigns, one seat and one vote each, rotated one member at a time; the <a href="/contents/tech/core-concepts/shard-groups" rel="noopener">shard groups</a> page sets out how.</p>`,
      },
      {
        find: 'Together, these mechanisms ensure Radix can securely scale to an exponentially growing shard space without running into coverage gaps or centralization issues. The network organically self-regulates to distribute validation across shards.',
        replace: 'Together, these mechanisms were meant to let the network scale to a very large shard space without leaving any shard short of validators, by paying more for the shards fewest validators served.',
      },
      {
        find: 'each capable of processing transactions and smart contracts independently.</p></li>',
        replace: `each capable of processing transactions and smart contracts independently. Ethereum dropped that plan for what it calls data sharding, in which rollups execute transactions and post the data to the base layer in blobs: ${ext('https://ethereum.org/en/roadmap/danksharding/', 'proto-danksharding (EIP-4844) went live with the Dencun upgrade in March 2024')}, and the ${ext('https://ethereum.org/en/roadmap/fusaka/', 'Fusaka upgrade of 3 December 2025 added PeerDAS')}, under which each node stores a subset of the blob data rather than all of it. See <a href="/contents/tech/core-concepts/rollups" rel="noopener">rollups</a>.</p></li>`,
      },
    ],
  },
  {
    slug: 'rollups',
    version: '1.2.0',
    sentinel: 'Base the largest at about 16.5 billion',
    edits: [
      {
        find: 'As of mid-2026, <a href="https://l2beat.com/scaling/summary" target="_blank" rel="noopener">L2BEAT tracks roughly twenty-two Ethereum rollups</a> alongside validiums and optimiums, with Arbitrum One the largest at about $17.7 billion in total value secured;',
        replace: 'On 27 September 2026, <a href="https://l2beat.com/scaling/summary" target="_blank" rel="noopener">L2BEAT tracked 22 layer-2 rollups on Ethereum</a>, 11 optimistic and 11 zero-knowledge, alongside validiums and optimiums, with Base the largest at about 16.5 billion US dollars in total value secured and Arbitrum One second at about 11.7 billion;',
      },
      { find: 'accessed July 2026', replace: 'accessed 27 September 2026' },
    ],
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const MESSAGES = {
  sharding: 'Deterministic Shard Indexing formula was a garbled KaTeX paste; replaced with plain HTML. Deterministic indexing and the four Network Security mechanisms framed as the Tempo-era published design (radixdlt.com/blog/sharding-in-radix, 2018), not how Babylon or the Xi’an candidate run; links to shard-groups and validator-nodes. Modern Implementations: Ethereum dropped shard chains for data sharding, EIP-4844 in Dencun (March 2024) and PeerDAS in Fusaka (3 December 2025), per ethereum.org.',
  rollups: 'L2BEAT figures re-read 27 September 2026 from l2beat.com/api/scaling/summary: 22 layer-2 rollups on Ethereum (11 optimistic, 11 ZK); Base largest at about 16.5bn USD TVS, Arbitrum One about 11.7bn. Replaces the mid-2026 reading that had Arbitrum One largest at 17.7bn.',
};

try {
  for (const p of PAGES) {
    if (isLockedPage(TAG_PATH, p.slug)) throw new Error(`${p.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, p.slug]);
    if (!rows.length) throw new Error(`${p.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(JSON.stringify(p.sentinel).slice(1, -1))) {
      console.log(`  ${p.slug}: already applied – no write`);
      continue;
    }
    const texts = [];
    const walk = (bs) => bs.forEach((b) => { if (typeof b.text === 'string') texts.push(b); walk(b.blocks ?? []); (b.columns ?? []).forEach((c) => walk(c.blocks ?? [])); });
    walk(blocks);
    for (const { find, replace } of p.edits) {
      const hits = texts.filter((b) => (typeof find === 'string' ? b.text.split(find).length - 1 : (b.text.match(new RegExp(find, 'g')) ?? []).length) > 0);
      const n = hits.reduce((a, b) => a + (typeof find === 'string' ? b.text.split(find).length - 1 : b.text.match(new RegExp(find, 'g')).length), 0);
      if (n !== 1) throw new Error(`${p.slug}: expected 1 match, got ${n}: ${String(find).slice(0, 80)}`);
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
        [cuid(), page.id, json, page.title, p.version, 'minor', AUTHOR_ID, MESSAGES[p.slug], now]);
      await client.query('COMMIT');
    }
  }
} finally {
  client.release();
  await pool.end();
}
