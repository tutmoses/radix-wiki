// scripts/seed-hyperscale-rs.mjs
// One-time script to create the hyperscale-rs wiki page
import pg from 'pg';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

config();

const uid = () => randomUUID();

const AUTHOR_ID = 'cmk5t48vx0000005zc5se4dqz'; // Hydrate
const TAG_PATH = 'contents/tech/research';
const SLUG = 'hyperscale-rs';
const TITLE = 'hyperscale-rs';
const EXCERPT = 'Community-built Rust implementation of the Hyperscale consensus protocol, targeting a viable Xi\'an network for Radix DLT.';

const content = [
  // Infobox
  {
    id: uid(),
    type: 'infobox',
    blocks: [
      {
        id: uid(),
        type: 'content',
        text: `<table>
<tbody>
<tr><td colspan="2"><strong>hyperscale-rs</strong></td></tr>
<tr><td>Type</td><td>Consensus Protocol Implementation</td></tr>
<tr><td>Language</td><td>Rust (94.4%)</td></tr>
<tr><td>Status</td><td>Work in Progress (v0.0.6)</td></tr>
<tr><td>Commits</td><td>519</td></tr>
<tr><td>Lead</td><td><a href="https://github.com/flightofthefox" target="_blank" rel="noopener">flightofthefox</a> (<a href="https://proven.network" target="_blank" rel="noopener">proven.network</a>)</td></tr>
<tr><td>GitHub</td><td><a href="https://github.com/hyperscalers/hyperscale-rs" target="_blank" rel="noopener">hyperscalers/hyperscale-rs</a></td></tr>
<tr><td>Telegram</td><td><a href="https://t.me/hyperscale_rs" target="_blank" rel="noopener">t.me/hyperscale_rs</a> (316 members)</td></tr>
<tr><td>Stars / Forks</td><td>16 / 10</td></tr>
<tr><td>Contributors</td><td>4</td></tr>
<tr><td>Platforms</td><td>Linux (x86_64), macOS (ARM64)</td></tr>
</tbody>
</table>`,
      },
    ],
  },

  // Introduction
  {
    id: uid(),
    type: 'content',
    text: `<h2>Introduction</h2>
<p><strong>hyperscale-rs</strong> is a <a href="https://github.com/hyperscalers/hyperscale-rs" target="_blank" rel="noopener">community-built Rust implementation</a> of the Hyperscale consensus protocol for the Radix DLT ecosystem. The project's stated goal is to produce a viable <a href="https://www.radixdlt.com/blog/radix-labs-roadmap---to-hyperscale-and-beyond" target="_blank" rel="noopener">Xi'an candidate</a> — the next-generation sharded consensus layer that will enable Radix to become what its community describes as "the world's first linearly scalable Layer 1 network."</p>
<p>Led by <strong>flightofthefox</strong> of <a href="https://proven.network" target="_blank" rel="noopener">proven.network</a>, the project was <a href="https://t.me/hyperscale_rs" target="_blank" rel="noopener">publicly announced</a> with the opening of its source code and an invitation for community review and contribution. It is community-funded through a Radix donation address and represents an independent effort to improve upon the official reference implementation of Hyperscale.</p>`,
  },

  // Background
  {
    id: uid(),
    type: 'content',
    text: `<h2>Background: Hyperscale &amp; Xi'an</h2>
<p>Radix's long-term roadmap centres on achieving linear scalability — the ability to increase throughput proportionally by adding more shards to the network. The <a href="https://radixecosystem.com/news/hyperscale-alpha-part-i-the-inception-of-a-hybrid-consensus-mechanism-the-radix-blog-radix-dlt" target="_blank" rel="noopener">Hyperscale Alpha consensus mechanism</a> (formerly known as Cassandra) represents Radix's approach to this problem, combining principles from Nakamoto consensus and classical Byzantine Fault Tolerant (BFT) protocols.</p>
<p>In public testing, the Hyperscale protocol <a href="https://getradix.com/updates/news/hyperscale-update-500k-public-test-done-the-radix-blog-radix-dlt" target="_blank" rel="noopener">sustained over 500,000 transactions per second</a> with peaks exceeding 700,000 TPS across more than 590 participating nodes. Private testing demonstrated linear scaling at roughly 250,000 TPS on 64 shards and maintained the same per-shard throughput at 500,000 TPS on 128 shards.</p>
<p>The <a href="https://www.radixdlt.com/blog/radix-labs-roadmap---to-hyperscale-and-beyond" target="_blank" rel="noopener">Xi'an production track</a> will implement this hybrid consensus mechanism into a production network candidate, with an Alpha release targeted for early 2027. A significant portion of the Xi'an work involves reimplementing the stack entirely in Rust, moving away from Java and the hybrid nature of the current Babylon network.</p>`,
  },

  // Architecture
  {
    id: uid(),
    type: 'content',
    text: `<h2>Architecture</h2>
<p>hyperscale-rs is architected as a <a href="https://github.com/hyperscalers/hyperscale-rs" target="_blank" rel="noopener">pure consensus layer</a> — deliberately containing no I/O, no locks, and no async code. This design decision enables deterministic simulation testing as a core design principle, allowing the entire consensus logic to be tested without non-determinism from network or disk operations.</p>
<h3>Consensus Mechanism</h3>
<p>The protocol uses a faster <strong>two-chain commit</strong> derived from <strong>HotStuff-2</strong>. The lead developer evaluated HotStuff-1 during the BFT module implementation but concluded that the theoretical latency improvement was not worth the added complexity — describing HotStuff-2 as being in the "Goldilocks zone."</p>
<p>Key consensus features include:</p>
<ul>
<li><strong>Optimistic pipelining</strong> — proposers can submit new blocks immediately after quorum certificate (QC) formation, without waiting for the previous block to be fully committed</li>
<li><strong>One-round finality</strong> — BFT provides finality with no possibility of reorganisation after QC</li>
<li><strong>Cross-shard livelock prevention</strong> — enhanced mechanisms for detecting and resolving deadlocks across shards</li>
<li><strong><a href="https://pprogrammingg.github.io/web3_modules/hyperscale-rs/module-01b-tx-flow.html" target="_blank" rel="noopener">Two-phase commit</a></strong> for cross-shard atomicity, where a coordinator sends prepare messages, shards lock resources, then commit or abort</li>
</ul>
<h3>Fault Model</h3>
<p>The system uses <strong>n = 3f+1</strong> validators per shard, tolerating up to <em>f</em> Byzantine nodes, with a <a href="https://pprogrammingg.github.io/web3_modules/hyperscale-rs/module-01b-tx-flow.html" target="_blank" rel="noopener">quorum requirement of 2f+1</a> votes for QC formation.</p>
<h3>Radix Engine Integration</h3>
<p>Unlike the reference implementation, hyperscale-rs integrates with the real Radix Engine for smart contract execution, providing actual transaction processing rather than simulated execution.</p>`,
  },

  // Crate Structure
  {
    id: uid(),
    type: 'content',
    text: `<h2>Crate Structure</h2>
<p>The project is organised as a <a href="https://github.com/hyperscalers/hyperscale-rs" target="_blank" rel="noopener">modular system of 15+ Rust crates</a>, each handling a specific responsibility:</p>
<h3>Core</h3>
<ul>
<li><strong>hyperscale-types</strong> — fundamental data structures: cryptographic hashes, blocks, votes, quorum certificates</li>
<li><strong>hyperscale-core</strong> — trait-based architecture foundation and state machines</li>
<li><strong>hyperscale-bft</strong> — Byzantine fault-tolerant consensus mechanics: block proposal, voting, view changes</li>
</ul>
<h3>Execution</h3>
<ul>
<li><strong>hyperscale-execution</strong> — transaction processing with two-phase commit coordination</li>
<li><strong>hyperscale-mempool</strong> — transaction pool administration and shard-specific queuing</li>
<li><strong>hyperscale-livelock</strong> — cross-shard deadlock detection and resolution</li>
</ul>
<h3>Infrastructure</h3>
<ul>
<li><strong>hyperscale-node</strong> — integrates all subsystems into a complete node</li>
<li><strong>hyperscale-production</strong> — networking via libp2p and persistence via RocksDB</li>
</ul>
<h3>Testing &amp; Tooling</h3>
<ul>
<li><strong>hyperscale-simulator</strong> — deterministic simulation testing framework with configurable network conditions</li>
<li><strong>hyperscale-spammer</strong> — load generation utility for performance evaluation and benchmarking</li>
</ul>`,
  },

  // Transaction Flow
  {
    id: uid(),
    type: 'content',
    text: `<h2>Transaction Flow</h2>
<p>The <a href="https://pprogrammingg.github.io/web3_modules/hyperscale-rs/module-01b-tx-flow.html" target="_blank" rel="noopener">transaction lifecycle</a> follows a 14-step pipeline from user submission to finality, spanning three phases:</p>
<h3>Pre-Consensus (Steps 1–6)</h3>
<p>A user signs a transaction externally, which is submitted via an RPC gateway. The node receives the raw bytes, converts them to internal events, and performs cross-shard analysis to determine which NodeIDs (components, resources, packages, accounts) are touched. Transactions enter shard-specific mempools; cross-shard transactions are propagated to all involved shards via libp2p Gossipsub.</p>
<h3>BFT Consensus (Steps 7–11)</h3>
<p>Proposer selection occurs deterministically per round (e.g., round-robin by validator identity). The proposer builds a block from mempool transactions. Validators authenticate the block and broadcast votes. A quorum certificate is formed when 2f+1 votes are collected — notably, the QC is not sent as a separate message but is formed by the next proposer from collected votes. The block is committed once the commit rule is satisfied.</p>
<h3>Execution &amp; Finality (Steps 12–14)</h3>
<p>Committed transactions are executed per shard using the Radix Engine. Cross-shard coordination uses a two-phase commit protocol where the coordinator sends prepare messages, shards lock resources without visible state changes, then commit or abort with state applied in an agreed order. BFT provides one-round finality with no possibility of reorganisation.</p>`,
  },

  // Improvements Over Reference
  {
    id: uid(),
    type: 'content',
    text: `<h2>Improvements Over Reference Implementation</h2>
<p>According to <a href="https://t.me/hyperscale_rs" target="_blank" rel="noopener">the project's pinned announcement</a>, hyperscale-rs aims to improve upon the official Hyperscale reference implementation in several areas:</p>
<ul>
<li><strong>Better architected</strong> — modular crate structure replacing monolithic code</li>
<li><strong>Better documented</strong> — improved code documentation and community-contributed learning materials</li>
<li><strong>Better tested</strong> — deterministic simulation testing as a core design principle</li>
<li><strong>More modular and maintainable</strong> — ongoing refactoring work to break down what was described as "kitchen drawer" crates into more focused, understandable modules</li>
<li><strong>More closely aligned with production values</strong> — designed with real-world deployment in mind</li>
<li><strong>More observable</strong> — enhanced monitoring and debugging capabilities</li>
<li><strong>Significant upgrades to the consensus process</strong> — including the HotStuff-2 based approach</li>
<li><strong>Safety violation fixes</strong> — addresses serious safety violations identified in the reference implementation</li>
<li><strong>Real Radix Engine</strong> — uses the actual Radix Engine for smart contract execution rather than an alternative execution environment</li>
</ul>
<p>The lead developer notes that the implementation may currently be <em>slower</em> in practice due to the overhead of fixing safety bugs and using the more resource-intensive real Radix Engine, but states that an apples-to-apples comparison would show faster performance.</p>`,
  },

  // Development & Community
  {
    id: uid(),
    type: 'content',
    text: `<h2>Development &amp; Community</h2>
<p>hyperscale-rs is developed openly with an <a href="https://t.me/hyperscale_rs" target="_blank" rel="noopener">active Telegram community</a> of 316 members. The project's development is tracked through automated GitHub commit notifications in the channel via a Kit-Watcher bot.</p>
<h3>Key Contributors</h3>
<ul>
<li><strong>flightofthefox</strong> (<a href="https://proven.network" target="_blank" rel="noopener">proven.network</a>) — lead developer and channel admin</li>
<li><strong>wizzl0r</strong> — channel owner, involved in PR reviews and testing infrastructure</li>
<li><strong>Radical</strong> — code reviewer, working through the codebase and <a href="https://pprogrammingg.github.io/web3_modules/hyperscale-rs/module-01b-tx-flow.html" target="_blank" rel="noopener">contributing documentation</a> on transaction flow</li>
</ul>
<h3>Current Development Focus</h3>
<p>As of February 2026, active work includes refactoring runner crates to be more modular and accessible to newcomers. The project has identified a need for contributors with experience in Terraform, Infrastructure-as-Code (IaC), and cloud infrastructure to help with end-to-end testing.</p>
<h3>Funding</h3>
<p>The project is community-funded through a <a href="https://t.me/hyperscale_rs" target="_blank" rel="noopener">Radix donation address</a>, with community members contributing voluntarily to support ongoing development.</p>`,
  },

  // External Links
  {
    id: uid(),
    type: 'content',
    text: `<h2>External Links</h2>
<ul>
<li><a href="https://github.com/hyperscalers/hyperscale-rs" target="_blank" rel="noopener">GitHub Repository — hyperscalers/hyperscale-rs</a></li>
<li><a href="https://t.me/hyperscale_rs" target="_blank" rel="noopener">Telegram Community — hyperscale-rs for Radix</a></li>
<li><a href="https://pprogrammingg.github.io/web3_modules/hyperscale-rs/module-01b-tx-flow.html" target="_blank" rel="noopener">Transaction Flow Documentation</a></li>
<li><a href="https://www.radixdlt.com/blog/radix-labs-roadmap---to-hyperscale-and-beyond" target="_blank" rel="noopener">Radix Labs Roadmap — To Hyperscale and Beyond</a></li>
<li><a href="https://radixecosystem.com/news/hyperscale-alpha-part-i-the-inception-of-a-hybrid-consensus-mechanism-the-radix-blog-radix-dlt" target="_blank" rel="noopener">Hyperscale Alpha Part I — The Inception of a Hybrid Consensus Mechanism</a></li>
<li><a href="https://getradix.com/updates/news/hyperscale-update-500k-public-test-done-the-radix-blog-radix-dlt" target="_blank" rel="noopener">Hyperscale Update — 500k+ Public Test Done</a></li>
</ul>`,
  },
];

// Insert via direct SQL
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: { rejectUnauthorized: false },
});

try {
  const client = await pool.connect();

  const pageId = `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const contentJson = JSON.stringify(content);

  // Check if page already exists
  const existing = await client.query(
    'SELECT id FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG]
  );

  if (existing.rows.length > 0) {
    console.log('Page already exists, skipping creation.');
    client.release();
    await pool.end();
    process.exit(0);
  }

  // Insert page
  await client.query(
    `INSERT INTO pages (id, slug, title, content, excerpt, tag_path, metadata, version, author_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, '{}'::jsonb, '1.0.0', $7, $8, $8)`,
    [pageId, SLUG, TITLE, contentJson, EXCERPT, TAG_PATH, AUTHOR_ID, now]
  );

  // Insert initial revision
  const revisionId = `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, changes, author_id, message, created_at)
     VALUES ($1, $2, $3::jsonb, $4, '1.0.0', 'major', '[]'::jsonb, $5, 'Initial version', $6)`,
    [revisionId, pageId, contentJson, TITLE, AUTHOR_ID, now]
  );

  console.log(`Created page: ${TAG_PATH}/${SLUG} (id: ${pageId})`);

  client.release();
  await pool.end();
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  await pool.end();
  process.exit(1);
}
