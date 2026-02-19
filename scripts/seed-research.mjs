// scripts/seed-research.mjs
// Batch seed script for contents/tech/research wiki pages
import pg from 'pg';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

config();

const uid = () => randomUUID();
const AUTHOR_ID = 'cmk5t48vx0000005zc5se4dqz'; // Hydrate

const pages = [
  // ─────────────────────────────────────────────
  // 1. Cerberus Whitepaper & Academic Validation
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/research',
    slug: 'cerberus-whitepaper',
    title: 'Cerberus Whitepaper & Academic Validation',
    excerpt: 'The Cerberus academic paper, its peer review at JSys, and the UC Davis collaboration that formally validated Radix consensus.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Cerberus Whitepaper</strong></td></tr>
<tr><td>Full Title</td><td>Cerberus: Minimalistic Multi-shard Byzantine-resilient Transaction Processing</td></tr>
<tr><td>Authors</td><td>Florian Cäsar, Daniel P. Hughes, Joshua Primero, Mohammad Sadoghi</td></tr>
<tr><td>First Published</td><td>August 2020 (<a href="https://arxiv.org/abs/2008.04450" target="_blank" rel="noopener">arXiv</a>)</td></tr>
<tr><td>Peer Review</td><td><a href="https://www.jsys.org/" target="_blank" rel="noopener">Journal of Systems Research (JSys)</a>, 2023</td></tr>
<tr><td>Academic Partner</td><td><a href="https://expolab.org/" target="_blank" rel="noopener">UC Davis ExpoLab</a></td></tr>
<tr><td>Subject</td><td>Distributed Consensus, Sharding, BFT</td></tr>
<tr><td>Related</td><td><a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus Protocol</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p>The Cerberus whitepaper, first published on <a href="https://arxiv.org/abs/2008.04450" target="_blank" rel="noopener">arXiv in August 2020</a>, presents a consensus protocol designed to achieve parallelised transaction processing across an effectively unlimited number of shards while preserving <a href="/contents/tech/core-concepts/atomic-composability" rel="noopener">atomic composability</a>. The paper was authored by Florian Cäsar, <a href="https://www.radixdlt.com/blog-author/dan-hughes" target="_blank" rel="noopener">Daniel P. Hughes</a> (founder of Radix), Joshua Primero, and <a href="https://expolab.org/team.html" target="_blank" rel="noopener">Professor Mohammad Sadoghi</a> of the University of California, Davis.</p>
<p>Unlike most blockchain whitepapers that remain unreviewed, Cerberus underwent rigorous academic scrutiny and was accepted into the <a href="https://www.jsys.org/" target="_blank" rel="noopener">Journal of Systems Research (JSys)</a> in 2023 after a full peer-review process. This places Radix among a small number of public ledger projects whose core consensus mechanism has been validated to the highest academic standards.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Paper Overview</h2>
<p>The paper addresses a fundamental tension in distributed ledger design: how to shard a network for scalability without sacrificing the ability to atomically compose transactions across shards. The authors argue that existing sharded protocols either impose global ordering (limiting throughput) or sacrifice atomicity (breaking composability).</p>
<h3>Problem Statement</h3>
<p>Traditional blockchains process transactions sequentially on a single chain, creating a throughput bottleneck. <a href="/contents/tech/core-concepts/sharding" rel="noopener">Sharding</a> partitions the ledger across independent groups of validators, enabling parallel processing. However, when a transaction touches data on multiple shards, the shards must coordinate — and prior approaches either relied on expensive cross-shard locking mechanisms, required global consensus, or could not guarantee atomicity.</p>
<h3>Three Protocol Variants</h3>
<p>Cerberus is presented in three variants of increasing robustness:</p>
<ul>
<li><strong>Core-Cerberus</strong> — operates under strict environmental assumptions with well-behaved clients, requiring no additional coordination beyond single-shard BFT consensus. Each shard independently decides to commit or abort, and the UTXO-based state model prevents double-spending without global ordering.</li>
<li><strong>Optimistic-Cerberus</strong> — avoids extra coordination phases during normal operation but includes recovery mechanisms for Byzantine behaviour, accepting higher costs only when attacks are detected.</li>
<li><strong>Pessimistic-Cerberus</strong> — adds proactive coordination phases that allow operation in fully adversarial environments, trading some latency for consistent safety guarantees regardless of client behaviour.</li>
</ul>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>UC Davis Collaboration</h2>
<p>In 2020, Radix <a href="https://www.radixdlt.com/blog/radix-partners-with-top-us-research-lab-to-bring-its-new-cerberus-consensus-to-life" target="_blank" rel="noopener">partnered with UC Davis' ExpoLab</a>, led by Professor Mohammad Sadoghi, to provide independent academic validation of Cerberus. The ExpoLab team included postdoctoral fellow Jelle Hellings, and PhD candidates Suyash Gupta and Sajjad Rahnama — researchers with deep expertise in Byzantine fault-tolerant systems.</p>
<p>The collaboration focused on four areas:</p>
<ul>
<li><strong>Formal mathematical proofs</strong> — creating rigorous proofs of safety and liveness for each protocol variant, going beyond the original whitepaper's informal arguments.</li>
<li><strong>Security analysis</strong> — identifying potential attack vectors (equivocation, cross-shard deadlocks, validator collusion) and verifying that the protocol's mitigations hold under adversarial conditions.</li>
<li><strong>Implementation testing</strong> — deploying Cerberus on ExpoLab's <a href="https://expolab.org/" target="_blank" rel="noopener">ExpoDB platform</a> to benchmark real-world performance, latency, and throughput characteristics.</li>
<li><strong>Comparative analysis</strong> — benchmarking Cerberus against other sharded BFT protocols (AHL, ByShard, Caper) on scalability, liveness, and safety metrics.</li>
</ul>
<p>The resulting peer-reviewed evaluation, published in JSys, confirmed that Cerberus achieves linear throughput scaling with the number of shards while maintaining atomic cross-shard commitment — a combination no prior protocol had demonstrated under formal analysis.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Key Technical Contributions</h2>
<p>The paper makes several contributions to distributed systems research:</p>
<ul>
<li><strong>Braided consensus</strong> — Cerberus "braids" independent single-shard BFT consensus instances (3-chains) into an emergent multi-shard consensus (a 3-braid). Each shard runs its own HotStuff-derived BFT instance; when a transaction spans multiple shards, their consensus processes are temporarily linked to reach a joint commit-or-abort decision.</li>
<li><strong>Minimised coordination</strong> — cross-shard commitment requires only a single additional consensus step per involved shard, with no global ordering or leader election. Shards that are not involved in a given transaction are unaffected.</li>
<li><strong>UTXO-based conflict prevention</strong> — by adopting a <a href="/contents/tech/core-concepts/substate-model" rel="noopener">substate</a> (UTXO-like) model, data must be consumed and recreated to be modified, preventing concurrent modification conflicts without cross-shard locks.</li>
<li><strong>Cluster-send primitive</strong> — a communication primitive that prevents equivocation by ensuring a validator cannot send conflicting messages to different shards within the same transaction.</li>
</ul>
<h2>External Links</h2>
<ul>
<li><a href="https://arxiv.org/abs/2008.04450" target="_blank" rel="noopener">Cerberus paper on arXiv</a></li>
<li><a href="https://assets.website-files.com/6053f7fca5bf627283b582c2/608811e3f5d21f235392fee1_Cerberus-Whitepaper-v1.01.pdf" target="_blank" rel="noopener">Cerberus Whitepaper v1.01 (PDF)</a></li>
<li><a href="https://www.radixdlt.com/blog/radix-partners-with-top-us-research-lab-to-bring-its-new-cerberus-consensus-to-life" target="_blank" rel="noopener">Radix–UC Davis partnership announcement</a></li>
<li><a href="https://www.radixdlt.com/blog/cerberus-infographic-series-chapter-i" target="_blank" rel="noopener">Cerberus Infographic Series</a></li>
<li><a href="https://www.jsys.org/" target="_blank" rel="noopener">Journal of Systems Research</a></li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 2. Radix Economic Model
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/research',
    slug: 'radix-economic-model',
    title: 'Radix Economic Model',
    excerpt: 'The economic design of the Radix network: XRD emissions, fee burning, DPoS incentive alignment, and stablecoin reserve governance.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Radix Economic Model</strong></td></tr>
<tr><td>Native Asset</td><td><a href="/contents/tech/core-protocols/xrd-token" rel="noopener">$XRD</a></td></tr>
<tr><td>Max Supply</td><td>24 billion XRD</td></tr>
<tr><td>Genesis Allocation</td><td>12 billion (July 2021)</td></tr>
<tr><td>Network Emissions</td><td>~300 million XRD/year over ~40 years</td></tr>
<tr><td>Fee Burn Rate</td><td>50% of base transaction fees</td></tr>
<tr><td>Consensus</td><td><a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Delegated Proof of Stake</a></td></tr>
<tr><td>Active Validator Set</td><td>Top 100 by stake</td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p>The Radix economic model is designed to align network security incentives with long-term ecosystem growth. Unlike many layer-1 protocols that rely primarily on transaction fees or fixed block rewards, Radix uses a combination of programmatic <a href="/contents/tech/core-concepts/network-emissions" rel="noopener">XRD emissions</a>, fee burning, and <a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">delegated proof of stake</a> to create a self-sustaining economic loop. The model was outlined in the <a href="https://medium.com/@radixdlt/radix-economics-proposal-v2-ffcb14060594" target="_blank" rel="noopener">Radix Economics Proposal v2</a> and refined through community governance.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Token Supply & Allocation</h2>
<p>XRD has a hard cap of <strong>24 billion tokens</strong>. Half were minted at network genesis in July 2021; the other half is emitted over approximately 40 years as staking rewards.</p>
<h3>Genesis Allocation (12 Billion XRD)</h3>
<p>The initial distribution was structured to fund development, reward early participants, and reserve capital for ecosystem initiatives:</p>
<table><tbody>
<tr><td><strong>Category</strong></td><td><strong>Amount</strong></td><td><strong>Share</strong></td></tr>
<tr><td>Radix Community (early contributors, 2013–2017)</td><td>3,000M</td><td>12.5%</td></tr>
<tr><td>RDX Works Ltd (founder retention)</td><td>2,400M</td><td>10.0%</td></tr>
<tr><td>Stablecoin Reserve (locked)</td><td>2,400M</td><td>10.0%</td></tr>
<tr><td>Radix Tokens (Jersey) Limited</td><td>2,158M</td><td>9.0%</td></tr>
<tr><td>October 2020 Token Sale</td><td>642M</td><td>2.7%</td></tr>
<tr><td>Developer Incentives</td><td>600M</td><td>2.5%</td></tr>
<tr><td>Network Subsidy (validator grants)</td><td>600M</td><td>2.5%</td></tr>
<tr><td>Liquidity Incentives</td><td>200M</td><td>0.8%</td></tr>
</tbody></table>
<p>All genesis tokens except the Stablecoin Reserve were fully unlocked at launch. The <a href="https://learn.radixdlt.com/article/how-was-the-xrd-token-allocated" target="_blank" rel="noopener">allocation details</a> are published by the Radix Foundation.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Emission Mechanics</h2>
<p>The remaining 12 billion XRD is minted by the protocol as <a href="/contents/tech/core-concepts/network-emissions" rel="noopener">network emissions</a>, distributed to validators and their delegators at approximately 300 million XRD per year. Emissions serve two purposes: compensating validators for securing the network, and gradually broadening token distribution over time.</p>
<p>Emission rates are not fixed in perpetuity — the <a href="/contents/tech/core-protocols/xrd-token" rel="noopener">XRD protocol parameters</a> include adjustment mechanisms tied to epoch duration and network utilisation metrics. This allows the emission curve to adapt if network conditions change significantly, though changes require protocol-level updates and community signalling.</p>
<h3>Delegated Proof of Stake</h3>
<p>XRD holders delegate stake to <a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">validator nodes</a> to participate in consensus. The top 100 validators by total delegated stake form the active set and are eligible to receive emissions. Validators set a commission percentage (deducted from their delegators' rewards), creating a competitive market for staking services. Delegators receive <a href="/contents/tech/core-concepts/liquid-stake-units" rel="noopener">Liquid Stake Units (LSUs)</a> — fungible tokens representing their staked position — which can be freely transferred or used in DeFi while the underlying XRD continues earning rewards.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Fee Burning & Deflationary Pressure</h2>
<p>Every transaction on Radix incurs a fee denominated in XRD. The protocol permanently burns 50% of the base network fee, removing those tokens from circulation forever. The remaining 50% is distributed to validators as additional compensation on top of emissions.</p>
<p>This burn mechanism introduces deflationary pressure that partially offsets ongoing emissions. As network usage grows and total transaction volume increases, the burn rate rises proportionally. In a mature network with high transaction throughput, the annual burn could approach or exceed annual emissions — at which point XRD becomes net-deflationary, similar in principle to Ethereum's <a href="https://eips.ethereum.org/EIPS/eip-1559" target="_blank" rel="noopener">EIP-1559</a> mechanism but applied natively from launch rather than retrofitted.</p>
<h2>Stablecoin Reserve Governance</h2>
<p>Of the 12 billion genesis tokens, 2.4 billion XRD (10% of max supply) were locked in a Stablecoin Reserve — earmarked to bootstrap decentralised stablecoin projects native to Radix. The Radix Foundation has a 10-year window (from July 2021) to disburse these tokens.</p>
<p>In 2025, the Radix Foundation <a href="https://bitrss.com/radix-foundation-opens-consultation-on-repurposing-2-4-billion-xrd-stablecoin-reserve-86800" target="_blank" rel="noopener">opened a community consultation</a> on repurposing the reserve toward broader ecosystem growth. The consultation received overwhelming support (91% of weighted votes) for reallocating 1 billion XRD to a multi-season incentives campaign aimed at boosting on-chain liquidity and economic activity.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Incentive Alignment</h2>
<p>The economic model is designed so that all participants' incentives converge on network health:</p>
<ul>
<li><strong>Validators</strong> earn emissions and fee shares, incentivising uptime and honest behaviour. Validators with poor performance lose delegators and fall out of the top 100.</li>
<li><strong>Delegators</strong> earn staking yield via LSUs while contributing to network security. The liquid nature of LSUs means capital is not locked away, reducing the opportunity cost of staking.</li>
<li><strong>Developers</strong> can set <a href="/contents/tech/core-concepts/component-royalties" rel="noopener">component royalties</a> on their blueprints, earning XRD each time their code is called. This creates a sustainable revenue model for open-source DeFi development.</li>
<li><strong>Users</strong> pay transaction fees that are low enough for practical use but high enough to prevent spam. Fee burning ensures that network usage benefits all XRD holders through supply reduction.</li>
</ul>
<h2>External Links</h2>
<ul>
<li><a href="https://medium.com/@radixdlt/radix-economics-proposal-v2-ffcb14060594" target="_blank" rel="noopener">Radix Economics Proposal v2</a></li>
<li><a href="https://learn.radixdlt.com/article/start-here-radix-tokens-and-tokenomics" target="_blank" rel="noopener">Radix Tokens and Tokenomics — Knowledge Base</a></li>
<li><a href="https://learn.radixdlt.com/article/how-was-the-xrd-token-allocated" target="_blank" rel="noopener">XRD Token Allocation — Knowledge Base</a></li>
<li><a href="https://tokenomicshub.xyz/radix" target="_blank" rel="noopener">Radix on Tokenomics Hub</a></li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 3. Consensus Evolution at Radix
  // ─────────────────────────────────────────────
  {
    tagPath: 'contents/tech/research',
    slug: 'consensus-evolution',
    title: 'Consensus Evolution at Radix',
    excerpt: 'How Radix iterated through six consensus designs — from eMunie to Cerberus — over a decade of distributed ledger research.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Consensus Evolution at Radix</strong></td></tr>
<tr><td>Founder</td><td><a href="https://www.radixdlt.com/blog-author/dan-hughes" target="_blank" rel="noopener">Dan Hughes</a></td></tr>
<tr><td>Research Period</td><td>2013–2023</td></tr>
<tr><td>Iterations</td><td>6 (eMunie → Blocktrees → DAG → CAST → Tempo → Cerberus)</td></tr>
<tr><td>Current Protocol</td><td><a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a></td></tr>
<tr><td>Academic Validation</td><td><a href="/contents/tech/research/cerberus-whitepaper" rel="noopener">JSys peer-reviewed paper (2023)</a></td></tr>
<tr><td>Key Constraint</td><td>Atomic composability + linear scalability</td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p>Radix's consensus protocol is the result of over a decade of iterative research by founder <a href="https://www.radixdlt.com/blog-author/dan-hughes" target="_blank" rel="noopener">Dan Hughes</a>. Between 2013 and 2020, Hughes designed, built, and discarded five distinct consensus architectures — each solving problems revealed by its predecessor — before arriving at <a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus</a>, the protocol that powers the Radix mainnet today. This article traces that research journey, examining what each iteration contributed and why it was ultimately superseded.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>eMunie (2013–2015)</h2>
<p>Hughes' distributed ledger work began with <a href="/contents/tech/research/emunie" rel="noopener">eMunie</a>, a project launched in March 2013 — before Ethereum's whitepaper was published. eMunie was conceived as a platform for a decentralised stablecoin with an autonomous supply model that could expand and contract to maintain purchasing-power parity. The project used Delegated Proof of Stake and included features that were ahead of their time: an integrated naming system (predating ENS), encrypted messaging, a decentralised marketplace, and an asset creation system.</p>
<p>eMunie demonstrated that a broad-featured decentralised platform was technically feasible, but its consensus design was not built for the scale required by global finance. Hughes recognised that the underlying data structures — not just the consensus rules — needed rethinking.</p>
<h2>Blocktrees & DAG Experiments (2015–2016)</h2>
<p>Hughes explored alternative data structures to move beyond linear blockchain limitations. <strong>Blocktrees</strong> extended the blockchain into a tree structure where branches could process transactions independently, merging periodically. <strong>Directed Acyclic Graphs (DAGs)</strong> — a structure later popularised by IOTA — allowed transactions to reference multiple predecessors, enabling parallel validation.</p>
<p>Both approaches improved throughput over single-chain designs but introduced new problems. Blocktrees required complex merge logic and struggled with conflict resolution across branches. DAGs, while elegant for simple transfers, made it difficult to guarantee deterministic ordering for smart contract execution — a prerequisite for composable DeFi.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>CAST (2016–2017)</h2>
<p><strong>Channeled Asynchronous State Trees (CAST)</strong> was Hughes' attempt to combine the best aspects of blocktrees and DAGs with a state-sharding model. CAST partitioned the ledger into channels that could process transactions asynchronously, with a tree structure for state management. This design moved closer to the sharded architecture that would eventually characterise Radix, but the asynchronous coordination model introduced edge cases around cross-channel atomicity that proved difficult to resolve formally.</p>
<h2>Tempo (2017–2019)</h2>
<p><a href="/contents/tech/research/tempo-consensus-mechanism" rel="noopener">Tempo</a> was the fifth iteration and the first to achieve public recognition. Proposed in September 2017, it introduced two innovations that would carry forward into Cerberus:</p>
<ul>
<li><strong>Pre-sharding</strong> — the ledger was partitioned into 2<sup>64</sup> (18.4 quintillion) fixed shards from genesis, so the shard space never needed to be reorganised as the network grew.</li>
<li><strong>Lazy consensus</strong> — nodes only communicated when necessary to resolve conflicts, dramatically reducing coordination overhead for non-conflicting transactions.</li>
</ul>
<p>Tempo used logical clocks and temporal proofs to establish ordering between events across shards. In June 2019, Radix conducted a <a href="https://www.radixdlt.com/blog" target="_blank" rel="noopener">public test</a> replaying 10 years of Bitcoin transactions onto a Tempo network, processing them in under 30 minutes and achieving over 1 million TPS.</p>
<p>However, Tempo had critical weaknesses: it lacked absolute transaction finality (relying on probabilistic guarantees), and analysis revealed the <strong>Weak Atom Problem</strong> — a class of cross-shard attacks where a malicious client could exploit the lazy consensus model to create conflicting transactions on different shards. Tempo also lacked robust Sybil protection for its validator selection mechanism.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Cerberus (2020–Present)</h2>
<p>Cerberus, the sixth iteration, was <a href="https://arxiv.org/abs/2008.04450" target="_blank" rel="noopener">published in August 2020</a> and directly addressed every weakness identified in Tempo. Its key design decisions were shaped by a decade of lessons:</p>
<ul>
<li><strong>From lazy consensus to BFT</strong> — Cerberus replaced Tempo's probabilistic lazy consensus with deterministic BFT consensus (derived from <a href="https://arxiv.org/abs/1803.05069" target="_blank" rel="noopener">HotStuff</a>), providing absolute finality on every transaction.</li>
<li><strong>Braided consensus for atomicity</strong> — rather than relying on after-the-fact conflict detection, Cerberus braids independent BFT instances across shards into a single atomic commitment. This eliminates the Weak Atom Problem by design.</li>
<li><strong>Pre-sharding preserved</strong> — the practically unlimited shard space from Tempo was retained, maintaining linear scalability as validators are added.</li>
<li><strong>Formal validator sets</strong> — each shard has a defined validator set with stake-weighted selection, providing Sybil resistance that Tempo lacked.</li>
</ul>
<p>The protocol was <a href="/contents/tech/research/cerberus-whitepaper" rel="noopener">peer-reviewed and validated</a> through a collaboration with UC Davis' ExpoLab. Testing demonstrated over 10 million TPS on 1,024 shards with linear throughput scaling.</p>
<h3>Ongoing Research</h3>
<p>Post-Cerberus research continues through projects like <a href="/contents/tech/research/cassandra" rel="noopener">Cassandra</a> (investigating liveness guarantees and dynamic validator sets) and <a href="/contents/tech/research/hyperscale-rs" rel="noopener">hyperscale-rs</a> (a community-built Rust implementation exploring the next-generation Xi'an release). Dan Hughes has stated that the Xi'an upgrade will bring further improvements to shard-level liveness, validator rotation, and throughput — building on Cerberus rather than replacing it.</p>
<h2>External Links</h2>
<ul>
<li><a href="https://www.radixdlt.com/blog-author/dan-hughes" target="_blank" rel="noopener">Dan Hughes on the Radix Blog</a></li>
<li><a href="https://arxiv.org/abs/2008.04450" target="_blank" rel="noopener">Cerberus paper (arXiv)</a></li>
<li><a href="https://daks2k3a4ib2z.cloudfront.net/59b6f7652473ae000158679b/59ca573e4873510001375b15_RadixDLT-Whitepaper-v1.1.pdf" target="_blank" rel="noopener">Tempo Whitepaper (PDF)</a></li>
<li><a href="https://www.radixdlt.com/blog/cerberus-infographic-series-chapter-i" target="_blank" rel="noopener">Cerberus Infographic Series</a></li>
</ul>`
      },
    ],
  },
];

// ─────────────────────────────────────────────
// Database insertion
// ─────────────────────────────────────────────
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  let inserted = 0;
  let skipped = 0;

  for (const page of pages) {
    const existing = await client.query(
      'SELECT id FROM pages WHERE tag_path = $1 AND slug = $2',
      [page.tagPath, page.slug]
    );

    if (existing.rows.length > 0) {
      console.log(`SKIP: ${page.tagPath}/${page.slug} (already exists)`);
      skipped++;
      continue;
    }

    const pageId = uid();
    const revisionId = uid();
    const now = new Date().toISOString();
    const contentJson = JSON.stringify(page.content);

    await client.query('BEGIN');

    await client.query(
      `INSERT INTO pages (id, slug, title, content, excerpt, tag_path, metadata, version, author_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, '{}'::jsonb, '1.0.0', $7, $8, $8)`,
      [pageId, page.slug, page.title, contentJson, page.excerpt, page.tagPath, AUTHOR_ID, now]
    );

    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, changes, author_id, message, created_at)
       VALUES ($1, $2, $3::jsonb, $4, '1.0.0', 'major', '[]'::jsonb, $5, 'Initial version', $6)`,
      [revisionId, pageId, contentJson, page.title, AUTHOR_ID, now]
    );

    await client.query('COMMIT');
    console.log(`INSERT: ${page.tagPath}/${page.slug}`);
    inserted++;
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Error:', err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
