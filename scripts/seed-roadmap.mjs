import { uid, insertPages } from './seed-utils.mjs';

const pages = [
  // ── PROTOCOL ──────────────────────────────────────────────
  {
    slug: 'xian-protocol-upgrade',
    title: "Xi'an Protocol Upgrade",
    excerpt: "Fully sharded Cerberus consensus delivering infinite linear scalability and unlimited atomic composability.",
    metadata: { status: 'Proposed', priority: 'High', quarter: 'Backlog', category: 'Protocol', owner: 'Community' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Protocol Upgrade</td></tr><tr><td><strong>Status</strong></td><td>Research / Testing</td></tr><tr><td><strong>Milestone</strong></td><td>Xi\'an (4th major release)</td></tr><tr><td><strong>Predecessor</strong></td><td>Babylon (current mainnet)</td></tr><tr><td><strong>Key Feature</strong></td><td>Fully sharded Cerberus</td></tr><tr><td><strong>Test Network</strong></td><td>Cassandra</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>Xi\'an is the fourth and final major milestone in the <a href="/contents/tech/core-concepts/radix-roadmap" rel="noopener">Radix roadmap</a>, named after the ancient Chinese capital. It will implement the fully sharded form of the <a href="/contents/tech/core-protocols/cerberus-consensus" rel="noopener">Cerberus consensus protocol</a>, delivering infinite linear scalability and unlimited atomic composability to the Radix network.</p><p>Xi\'an follows the progression from <a href="https://learn.radixdlt.com/article/what-is-the-radix-roadmap" target="_blank" rel="noopener">Olympia → Alexandria → Babylon → Xi\'an</a>, with each release adding fundamental capabilities. While Babylon (live since September 2023) introduced the full Radix stack (Scrypto, Radix Engine v2, Radix Wallet), Xi\'an will unlock the network\'s ultimate scaling potential.</p>' },
      { id: uid(), type: 'content', text: '<h2>Key Capabilities</h2><ul><li><strong>Infinite linear scalability</strong> — adding more validator shards proportionally increases network throughput with no theoretical ceiling</li><li><strong>Unlimited atomic composability</strong> — cross-shard transactions maintain full atomicity, preserving DeFi composability at any scale</li><li><strong>Uncapped validator set</strong> — the current 100-validator cap is anticipated to be lifted, allowing unlimited validator participation</li><li><strong>Commodity hardware</strong> — validators can run on standard datacenter or even desktop hardware, as demonstrated by <a href="https://www.radixdlt.com/blog/hyperscale-update-500k-public-test-done" target="_blank" rel="noopener">Hyperscale testing on AWS m6i.xlarge instances</a></li></ul>' },
      { id: uid(), type: 'content', text: '<h2>Current Progress</h2><p>Implementations of sharded Cerberus are being tested on the <strong>Cassandra test network</strong>. The <a href="https://www.radixdlt.com/blog/hyperscale-update-500k-public-test-done" target="_blank" rel="noopener">Hyperscale public test</a> in January 2026 demonstrated 500,000+ sustained TPS across 128 shards on commodity hardware, validating the core scaling thesis. A <a href="https://t.me/hyperscale_rs" target="_blank" rel="noopener">community-led Rust implementation (hyperscale-rs)</a> is also underway.</p><p>No mainnet release date has been announced. The path to Xi\'an depends on further Hyperscale R&D and community-driven development following the Foundation\'s 2026 transition strategy.</p>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://learn.radixdlt.com/article/what-is-the-radix-roadmap" target="_blank" rel="noopener">Radix Roadmap — Knowledge Base</a></li><li><a href="https://arxiv.org/pdf/2008.04450" target="_blank" rel="noopener">Cerberus Whitepaper (arXiv)</a></li><li><a href="https://www.radixdlt.com/blog/2026-strategy-the-next-chapter-of-radix" target="_blank" rel="noopener">2026 Strategy: The Next Chapter of Radix</a></li></ul>' },
    ],
  },
  {
    slug: 'hyperscale-open-source',
    title: 'Hyperscale Open Source Release',
    excerpt: "Open-sourcing all Hyperscale code, documentation, and operational material for community reproduction and R&D.",
    metadata: { status: 'In Progress', priority: 'High', quarter: 'Q1 2026', category: 'Protocol', owner: 'Radix Foundation' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Open Source Release</td></tr><tr><td><strong>Status</strong></td><td>In Progress</td></tr><tr><td><strong>Performance</strong></td><td>500k+ sustained TPS</td></tr><tr><td><strong>Peak TPS</strong></td><td>800k+</td></tr><tr><td><strong>Shards Tested</strong></td><td>128</td></tr><tr><td><strong>Nodes in Public Test</strong></td><td>590+</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>Following the <a href="https://www.radixdlt.com/blog/interim-hyperscale-closing-the-chapter" target="_blank" rel="noopener">completion of the interim Hyperscale phase</a>, the Radix Foundation plans to open-source all remaining code, documentation, and operational material. This will enable the community to independently reproduce test results, verify performance claims, and build upon the codebase for future R&D.</p>' },
      { id: uid(), type: 'content', text: '<h2>What Will Be Released</h2><ul><li><strong>Source code</strong> — the full Hyperscale codebase used in the 500k+ TPS public test</li><li><strong>Setup guides</strong> — Terraform and Ansible automation for deploying test networks</li><li><strong>Network configuration</strong> — shard topology, validator setup, bootstrap node configs</li><li><strong>Workload tooling</strong> — spam/load generation tools optimized for multi-core utilization</li><li><strong>Reproducibility guidance</strong> — documentation for replicating the public test at scale</li><li><strong>Dashboards and log files</strong> — observability tooling from the public test</li></ul>' },
      { id: uid(), type: 'content', text: '<h2>Test Results</h2><p>The <a href="https://www.radixdlt.com/blog/hyperscale-update-500k-public-test-done" target="_blank" rel="noopener">January 2026 public test</a> sustained 500,000 TPS with peaks above 800,000 TPS. Transactions were real DeFi-style swaps executed across 128 shards on commodity AWS hardware (m6i.xlarge: 4 cores, 16GB RAM). The test confirmed linear scaling — doubling from 64 to 128 shards doubled throughput proportionally. The network included 384 bootstrap nodes, 40 validator nodes, and 6 load-generation nodes.</p>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/hyperscale-update-500k-public-test-done" target="_blank" rel="noopener">Hyperscale Update: 500k+ Public Test Done</a></li><li><a href="https://www.radixdlt.com/blog/interim-hyperscale-closing-the-chapter" target="_blank" rel="noopener">Interim Hyperscale: Closing the Chapter</a></li></ul>' },
    ],
  },
  {
    slug: 'hyperscale-rs-community',
    title: 'Hyperscale-RS Community Implementation',
    excerpt: "Community-led Rust implementation of the Hyperscale sharded consensus protocol.",
    metadata: { status: 'In Progress', priority: 'High', quarter: 'Q2 2026', category: 'Protocol', owner: 'Community (hyperscale-rs)' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Community Development</td></tr><tr><td><strong>Language</strong></td><td>Rust</td></tr><tr><td><strong>Status</strong></td><td>Active Development</td></tr><tr><td><strong>Telegram</strong></td><td><a href="https://t.me/hyperscale_rs" target="_blank" rel="noopener">hyperscale-rs for Radix</a></td></tr><tr><td><strong>Foundation Support</strong></td><td>Provisioned compute capacity</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>Hyperscale-RS is a community-led initiative to build a Rust implementation of the Hyperscale sharded consensus protocol. Following the <a href="https://www.radixdlt.com/blog/interim-hyperscale-closing-the-chapter" target="_blank" rel="noopener">Foundation\'s transition of Hyperscale development to the community</a>, this project represents the primary path toward bringing sharded consensus to the Radix mainnet.</p><p>The Radix Foundation has provisioned compute capacity for the team to run scaled tests, and the upcoming open-source release of the original Hyperscale codebase will provide additional reference material.</p>' },
      { id: uid(), type: 'content', text: '<h2>Background</h2><p>The original Hyperscale implementation was developed under the Foundation\'s interim phase, achieving 500,000+ sustained TPS in public testing. With the 2026 strategy shifting to community-led development, the hyperscale-rs team — along with other community initiatives — is taking ownership of advancing the sharding roadmap.</p><p>The team coordinates via the <a href="https://t.me/hyperscale_rs" target="_blank" rel="noopener">hyperscale-rs Telegram group</a> (320+ members).</p>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://t.me/hyperscale_rs" target="_blank" rel="noopener">hyperscale-rs Telegram Group</a></li><li><a href="https://www.radixdlt.com/blog/2026-strategy-the-next-chapter-of-radix" target="_blank" rel="noopener">2026 Strategy: The Next Chapter of Radix</a></li></ul>' },
    ],
  },
  {
    slug: 'mfa-security-shield',
    title: 'Multi-Factor Security Shield',
    excerpt: "On-chain multi-factor authentication with phone, hardware, and social recovery factors for Radix accounts.",
    metadata: { status: 'Testing', priority: 'High', quarter: 'Q1 2026', category: 'Protocol', owner: 'RDX Works' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Security Feature</td></tr><tr><td><strong>Status</strong></td><td>Phase 2 on Stokenet</td></tr><tr><td><strong>Phases</strong></td><td>3 (Create → Update → Recover)</td></tr><tr><td><strong>Factors</strong></td><td>Phone, Ledger, Arculus, Mnemonic, Trusted Contact</td></tr><tr><td><strong>Mainnet</strong></td><td>After all phases tested</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>Multi-Factor Smart Accounts bring network-level multi-factor authentication to Radix, replacing single seed phrase control with configurable "Security Shields." Unlike account abstraction on other chains, Radix implements MFA directly at the protocol level via the <a href="/contents/tech/core-concepts/access-controller" rel="noopener">Access Controller</a>, eliminating single points of failure.</p><p>A Security Shield combines multiple authentication factors — phone, Ledger hardware wallet, Arculus Card, off-device mnemonic, or a trusted person — into a rule set that governs account access.</p>' },
      { id: uid(), type: 'content', text: '<h2>Rollout Phases</h2><h3>Phase 1 — Create & Sign (Live on Stokenet)</h3><p>Users can configure a Security Shield and apply it to accounts or personas. The wallet enforces shield-based signing rules. <a href="https://www.radixdlt.com/blog/multi-factor-smart-accounts-arrive-on-stokenet-phase-1-is-live" target="_blank" rel="noopener">Launched October 2025</a>.</p><h3>Phase 2 — Update Shield (Live on Stokenet)</h3><p>Users can modify existing shield configurations and exercise recovery-related functions including timed delays. <a href="https://www.radixdlt.com/blog/radix-review-2025" target="_blank" rel="noopener">Launched December 2025</a>.</p><h3>Phase 3 — Recovery Without Backup (Upcoming)</h3><p>The final phase enables account recovery when a primary device is lost or compromised, completing the full MFA lifecycle.</p>' },
      { id: uid(), type: 'content', text: '<h2>Mainnet Timeline</h2><p>All three phases are being tested on Stokenet first. Once community feedback and testing is complete across all phases, the feature will be deployed to mainnet. The <a href="https://www.radixdlt.com/blog/2026-strategy-the-next-chapter-of-radix" target="_blank" rel="noopener">2026 Strategy</a> lists MFA Phase 3 completion and mainnet launch as an immediate Phase 1 priority.</p>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/multi-factor-smart-accounts-arrive-on-stokenet-phase-1-is-live" target="_blank" rel="noopener">MFA Phase 1 Announcement</a></li><li><a href="https://www.radixdlt.com/blog/introducing-multi-factor-smart-accounts-a-step-by-step-rollout-on-stokenet" target="_blank" rel="noopener">MFA Step-by-Step Rollout Guide</a></li></ul>' },
    ],
  },

  // ── GOVERNANCE ────────────────────────────────────────────
  {
    slug: 'radix-accountability-council',
    title: 'Radix Accountability Council',
    excerpt: "Five-member elected council guiding the transition from Foundation-led to community-led governance.",
    metadata: { status: 'Done', priority: 'High', quarter: 'Q1 2026', category: 'Governance', owner: 'RAC (Peachy, Faraz, Jazzer, Avaunt, projectShift)' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Governance Body</td></tr><tr><td><strong>Members</strong></td><td>5 (elected Feb 2026)</td></tr><tr><td><strong>Participation</strong></td><td>1.34B XRD / 1,151 accounts</td></tr><tr><td><strong>Role</strong></td><td>Facilitators, not commanders</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>The Radix Accountability Council (RAC) was established in February 2026 via <a href="https://www.radixdlt.com/blog/consultation-results-radix-accountability-council" target="_blank" rel="noopener">community consultation</a> to guide the transition from Foundation-led to community-led governance. Over 1.34 billion XRD from 1,151 unique accounts participated in the vote.</p>' },
      { id: uid(), type: 'content', text: '<h2>Elected Members</h2><ol><li><strong>Peachy</strong> — 1.248B XRD (92.76%)</li><li><strong>Faraz</strong> — 1.129B XRD (83.87%)</li><li><strong>Jazzer_9F</strong> — 1.116B XRD (82.92%)</li><li><strong>Avaunt</strong> — 786.4M XRD (58.44%)</li><li><strong>projectShift</strong> — 769.9M XRD (57.22%)</li></ol><p>All elected members received supermajority support, indicating broad community consensus.</p>' },
      { id: uid(), type: 'content', text: '<h2>Responsibilities</h2><ul><li>Establish operational framework for the Council</li><li>Coordinate administrative requirements for the 2026 transition</li><li>Serve as primary interface between community will and Foundation execution</li><li>Facilitate (not direct) decision-making on RFPs, governance proposals, and infrastructure transition</li></ul>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/consultation-results-radix-accountability-council" target="_blank" rel="noopener">Consultation Results: Radix Accountability Council</a></li><li><a href="https://www.radixdlt.com/blog/2026-strategy-the-next-chapter-of-radix" target="_blank" rel="noopener">2026 Strategy: The Next Chapter of Radix</a></li></ul>' },
    ],
  },
  {
    slug: 'validator-subsidy-sunset',
    title: 'Validator Subsidy Sunset',
    excerpt: "Phased wind-down of the Foundation validator subsidy from February through June 2026.",
    metadata: { status: 'In Progress', priority: 'High', quarter: 'Q1 2026', category: 'Governance', owner: 'RAC / Foundation' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Economic Policy</td></tr><tr><td><strong>Approval</strong></td><td>71.6% (740.7M XRD)</td></tr><tr><td><strong>Participation</strong></td><td>1.03B XRD / 604 accounts</td></tr><tr><td><strong>End Date</strong></td><td>June 2026</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>The Radix community <a href="https://www.radixdlt.com/blog/consultation-results-the-future-of-the-validator-subsidy" target="_blank" rel="noopener">voted decisively</a> to end the Foundation-administered validator subsidy, transitioning validators to fee-based sustainability. The plan tapers the subsidy over five months rather than halting it abruptly.</p>' },
      { id: uid(), type: 'content', text: '<h2>Tapering Schedule</h2><h3>Phase 1 — Foundation Administered</h3><ul><li><strong>February 2026:</strong> Capped at 400k XRD or $350 USD (whichever is lower)</li><li><strong>March 2026:</strong> Capped at 400k XRD or $200 USD (whichever is lower)</li></ul><h3>Phase 2 — Community Administered</h3><ul><li><strong>April–May 2026:</strong> Reduced to $100 USD paid in XRD</li></ul><h3>Phase 3 — Conclusion</h3><ul><li><strong>June 2026:</strong> Subsidy ends completely</li></ul>' },
      { id: uid(), type: 'content', text: '<h2>Impact</h2><p>Validators must transition to fee-based revenue models. The community recommends validators adjust fees, promote their nodes, and properly unregister if exiting. Stakers should diversify across multiple validators and monitor node performance during the transition period.</p>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/consultation-results-the-future-of-the-validator-subsidy" target="_blank" rel="noopener">Consultation Results: The Future of the Validator Subsidy</a></li></ul>' },
    ],
  },
  {
    slug: 'governance-snapshot-rules',
    title: 'Governance Snapshot Asset Rules',
    excerpt: "Community-approved definition of eligible assets for governance voting weight in consultations.",
    metadata: { status: 'Done', priority: 'High', quarter: 'Q1 2026', category: 'Governance', owner: 'RAC / Foundation' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Governance Standard</td></tr><tr><td><strong>Participation</strong></td><td>1.4B XRD / 743 accounts</td></tr><tr><td><strong>Threshold</strong></td><td>60% approval required</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>The Radix community <a href="https://www.radixdlt.com/blog/consultation-results-defining-eligible-assets-for-snapshots" target="_blank" rel="noopener">completed a consultation</a> to define which assets count as valid voting power in governance snapshots. Over 1.4 billion XRD from 743 accounts participated.</p>' },
      { id: uid(), type: 'content', text: '<h2>Approved Assets (≥60% Support)</h2><ol><li><strong>XRD Staked on Any Validator</strong> — 69–79% support</li><li><strong>Liquid XRD in Accounts</strong> — 69% support</li><li><strong>XRD in Supported DEX Pools</strong> — 60% support (currently limited to Radix Rewards Season 1 pools)</li></ol><h2>Rejected Assets (&lt;60%)</h2><ul><li><strong>Time-Locked XRD</strong> — 44% support</li><li><strong>Lent XRD</strong> — 28% support</li></ul>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/consultation-results-defining-eligible-assets-for-snapshots" target="_blank" rel="noopener">Consultation Results: Defining Eligible Assets for Snapshots</a></li></ul>' },
    ],
  },
  {
    slug: 'consultations-v2',
    title: 'Consultations V2 dApp',
    excerpt: "Open-source two-phase governance dApp with temperature checks and formal proposals.",
    metadata: { status: 'Done', priority: 'High', quarter: 'Q1 2026', category: 'Governance', owner: 'Foundation / Community' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Governance Tooling</td></tr><tr><td><strong>Status</strong></td><td>Live on Stokenet, open-sourced</td></tr><tr><td><strong>Open Source</strong></td><td>Feb 22, 2026</td></tr><tr><td><strong>Components</strong></td><td>Scrypto + Backend + Frontend</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>Consultations V2 is the revamped governance dApp enabling community-led decision making on Radix. It introduces a two-phase voting structure: a <strong>Temperature Check</strong> phase to gauge whether a proposal should proceed, followed by a <strong>Formal Proposal</strong> phase for the binding vote.</p><p>The V2 was launched on Stokenet in February 2026 and fully <a href="https://github.com/radixdlt" target="_blank" rel="noopener">open-sourced on GitHub</a> on February 22, 2026, with Scrypto smart contracts, backend, and frontend code all available for community deployment.</p>' },
      { id: uid(), type: 'content', text: '<h2>Active Proposals (Feb 2026)</h2><ul><li><strong>Community DAO Jurisdiction</strong> — selecting legal jurisdiction for the community DAO entity</li><li><strong>Radix Rewards Season 2 Pool</strong> — defining the token allocation for Season 2</li><li><strong>Season 2 Activities Framework</strong> — specifying eligible activities for earning rewards</li></ul>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/2026-strategy-the-next-chapter-of-radix" target="_blank" rel="noopener">2026 Strategy: The Next Chapter of Radix</a></li></ul>' },
    ],
  },
  {
    slug: 'community-dao-formation',
    title: 'Community DAO Formation',
    excerpt: "Establishing full on-chain governance via DAO or multi-sig for community-controlled funding allocation.",
    metadata: { status: 'Proposed', priority: 'High', quarter: 'Q3 2026', category: 'Governance', owner: 'RAC / Community' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Governance Structure</td></tr><tr><td><strong>Phase</strong></td><td>Phase 3 of 2026 Strategy</td></tr><tr><td><strong>Status</strong></td><td>Jurisdiction consultation active</td></tr><tr><td><strong>Tooling</strong></td><td><a href="https://github.com/Stabilis-Labs/DAOpensource" target="_blank" rel="noopener">DAOpensource (Scrypto)</a></td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>The final phase of Radix\'s <a href="https://www.radixdlt.com/blog/2026-strategy-the-next-chapter-of-radix" target="_blank" rel="noopener">2026 decentralization strategy</a> envisions full community control of funding allocation and distribution via on-chain governance. Community members will submit proposals for funding in marketing, code, or business development, with the ecosystem voting on priorities.</p>' },
      { id: uid(), type: 'content', text: '<h2>Transition Path</h2><h3>Phase 1 (Current) — Foundation Administered</h3><p>Foundation maintains security, reviews PRs, and runs non-binding consultations to gauge community sentiment while governance structures are designed.</p><h3>Phase 2 — Community-Initiated RFPs</h3><p>Community proposes and votes on RFPs for marketing, partnerships, integrations, and incentive structures.</p><h3>Phase 3 — Full Decentralization</h3><p>On-chain governance (DAO/Multi-sig) controls allocation and distribution of funding. The Foundation\'s brand, trademarks, and IP transfer to community custody via blind trusts or DAO-controlled entities.</p>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/2026-strategy-the-next-chapter-of-radix" target="_blank" rel="noopener">2026 Strategy: The Next Chapter of Radix</a></li><li><a href="https://www.radixdlt.com/blog/2026-strategy-faq" target="_blank" rel="noopener">2026 Strategy FAQ</a></li><li><a href="https://github.com/Stabilis-Labs/DAOpensource" target="_blank" rel="noopener">DAOpensource — Scrypto DAO Package</a></li></ul>' },
    ],
  },

  // ── ECOSYSTEM ─────────────────────────────────────────────
  {
    slug: 'radix-rewards-season-2',
    title: 'Radix Rewards Season 2',
    excerpt: "Community-proposed continuation of the Radix incentive program to drive on-chain activity.",
    metadata: { status: 'Proposed', priority: 'Medium', quarter: 'Q1 2026', category: 'Ecosystem', owner: 'RAC / Community' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Incentive Program</td></tr><tr><td><strong>Predecessor</strong></td><td>Season 1 (114.3M XRD distributed)</td></tr><tr><td><strong>Status</strong></td><td>Temperature Check (74% support)</td></tr><tr><td><strong>S1 Impact</strong></td><td>Doubled weekly transactions &amp; DEX volume</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>Following the success of <a href="https://www.radixdlt.com/blog/radix-rewards-s1-distribution" target="_blank" rel="noopener">Radix Rewards Season 1</a>, which distributed 114.3 million XRD and doubled on-chain transactions and DEX volume, the community has proposed Season 2 with 74% support in an initial RFC.</p><p>The RAC has escalated this to a formal governance temperature check, with two active consultations: one defining the S2 reward pool and another specifying eligible activities.</p>' },
      { id: uid(), type: 'content', text: '<h2>Season 1 Results</h2><ul><li><strong>Total Distribution:</strong> 114,347,194 XRD (including S0 bonuses)</li><li><strong>Vesting:</strong> 20% immediate, 80% over 7 days with Diamond Hands bonus</li><li><strong>Impact:</strong> Doubled weekly on-chain transactions and DEX trading volume</li><li><strong>Ecosystem metrics:</strong> CaviarNine $250M+ cumulative volume, Astrolescent $30M+ swap volume, 53,114+ deployed components</li></ul>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/radix-rewards-s1-distribution" target="_blank" rel="noopener">Radix Rewards S1 Distribution</a></li><li><a href="https://incentives.radixdlt.com/" target="_blank" rel="noopener">Rewards Portal</a></li></ul>' },
    ],
  },
  {
    slug: 'hyperlane-bridge-expansion',
    title: 'Hyperlane Bridge Route Expansion',
    excerpt: "Expanding cross-chain warp routes to additional networks and assets based on community demand.",
    metadata: { status: 'In Progress', priority: 'Medium', quarter: 'Q1 2026', category: 'Ecosystem', owner: 'Hyperlane / Community' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Cross-chain Bridge</td></tr><tr><td><strong>Live Since</strong></td><td>September 5, 2025</td></tr><tr><td><strong>Current Assets</strong></td><td>USDC, USDT, wBTC, ETH</td></tr><tr><td><strong>Current Networks</strong></td><td>Ethereum, Arbitrum, Base, BSC</td></tr><tr><td><strong>Pending</strong></td><td>Solana + additional routes</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p><a href="https://www.radixdlt.com/blog/hyperlane-is-live" target="_blank" rel="noopener">Hyperlane went live on Radix mainnet</a> in September 2025, bringing permissionless, modular cross-chain interoperability. The integration enables bridging of USDC, USDT, wBTC, and ETH from Ethereum, Arbitrum, Base, and BSC into the Radix DeFi ecosystem.</p><p>The bridge is accessible via <a href="https://astrolescent.com" target="_blank" rel="noopener">Astrolescent</a> (Radix-native frontend) and <a href="https://nexus.hyperlane.xyz" target="_blank" rel="noopener">Hyperlane Nexus</a> (reference app). New routes — including Solana — are being added based on community demand.</p>' },
      { id: uid(), type: 'content', text: '<h2>Roadmap</h2><ul><li>Expand warp routes to additional networks based on community demand</li><li>Solana route deployment (announced as coming soon)</li><li>Permissionless architecture enables anyone to deploy new routes without centralized approval</li><li>Streamlined developer integration for building cross-chain dApps on Radix</li></ul>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/hyperlane-is-live" target="_blank" rel="noopener">Hyperlane is Live! — Radix Blog</a></li><li><a href="https://astrolescent.com" target="_blank" rel="noopener">Astrolescent Bridge</a></li><li><a href="https://nexus.hyperlane.xyz" target="_blank" rel="noopener">Hyperlane Nexus</a></li></ul>' },
    ],
  },

  // ── COMMUNITY / INFRASTRUCTURE ────────────────────────────
  {
    slug: 'gateway-service-rfp',
    title: 'Gateway Service Decentralization',
    excerpt: "RFP for independent operators to run the Babylon Gateway API that powers wallets and dApps.",
    metadata: { status: 'In Progress', priority: 'High', quarter: 'Q1 2026', category: 'Community', owner: 'Foundation / RAC' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Infrastructure RFP</td></tr><tr><td><strong>Service</strong></td><td>Babylon Gateway Endpoint</td></tr><tr><td><strong>Database</strong></td><td>~2TB PostgreSQL (60GB/mo growth)</td></tr><tr><td><strong>SLA Target</strong></td><td>99.9% uptime, &lt;1s latency</td></tr><tr><td><strong>RFP Opened</strong></td><td>February 3, 2026</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>The Babylon Gateway is the primary API that aggregates ledger data into a queryable PostgreSQL database, enabling transaction submission and queries for the <a href="/contents/tech/core-concepts/radix-wallet" rel="noopener">Radix Wallet</a>, Dashboard, and most ecosystem dApps. As part of the <a href="https://www.radixdlt.com/blog/the-next-phase-of-decentralization-rfps-for-gateway-and-relay-services" target="_blank" rel="noopener">decentralization transition</a>, the Foundation is seeking one or more professional operators to take over this service.</p>' },
      { id: uid(), type: 'content', text: '<h2>Requirements</h2><ul><li><strong>Database:</strong> ~2TB with 60GB monthly growth</li><li><strong>Uptime:</strong> 99.9% availability</li><li><strong>Latency:</strong> &lt;1 second query response globally</li><li><strong>Revenue model:</strong> Operators must guarantee current usage levels for public services (Wallet, Dashboard) but may commercialize premium access for data aggregators, institutions, and high-volume dApps</li></ul>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/the-next-phase-of-decentralization-rfps-for-gateway-and-relay-services" target="_blank" rel="noopener">RFPs for Gateway and Relay Services</a></li><li><a href="https://www.radixdlt.com/blog/the-foundation-operational-stack-mapping-the-2026-transition" target="_blank" rel="noopener">Foundation Operational Stack</a></li></ul>' },
    ],
  },
  {
    slug: 'signaling-relay-rfp',
    title: 'Signaling & Relay Services RFP',
    excerpt: "RFPs for decentralizing the wallet signaling server and mobile browser connect relay.",
    metadata: { status: 'In Progress', priority: 'High', quarter: 'Q1 2026', category: 'Community', owner: 'Foundation / RAC' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Infrastructure RFP</td></tr><tr><td><strong>Services</strong></td><td>Signaling Server + Connect Relay</td></tr><tr><td><strong>Signaling Latency</strong></td><td>&lt;300ms globally</td></tr><tr><td><strong>Peak Connections</strong></td><td>~6,000 concurrent</td></tr><tr><td><strong>RFP Opened</strong></td><td>February 3, 2026</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>Two critical infrastructure services are being transitioned from Foundation to community/commercial operators via <a href="https://www.radixdlt.com/blog/the-next-phase-of-decentralization-rfps-for-gateway-and-relay-services" target="_blank" rel="noopener">RFPs opened February 3, 2026</a>:</p><ul><li><strong>Signaling Server</strong> — establishes peer-to-peer WebRTC connections between the Radix Wallet mobile app and the Chrome desktop connector extension. Requires &lt;300ms global latency, strict privacy (no payload inspection), and handling ~6,000 concurrent peak connections.</li><li><strong>Connect Relay (RCR)</strong> — buffers encrypted messages between mobile browsers and the Radix Wallet app. Requires end-to-end encryption, aggressive rate limiting (600s TTL), and DDoS mitigation.</li></ul>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/the-next-phase-of-decentralization-rfps-for-gateway-and-relay-services" target="_blank" rel="noopener">RFPs for Gateway and Relay Services</a></li><li><a href="https://www.radixdlt.com/blog/the-foundation-operational-stack-mapping-the-2026-transition" target="_blank" rel="noopener">Foundation Operational Stack: Mapping the 2026 Transition</a></li></ul>' },
    ],
  },
  {
    slug: 'p3-services-handover',
    title: 'P3 Community Services Handover',
    excerpt: "Transitioning non-critical Foundation services like Dashboard, RadQuest, and dev tools to community operators.",
    metadata: { status: 'Proposed', priority: 'Low', quarter: 'Q2 2026', category: 'Community', owner: 'RAC / Community' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Infrastructure Transition</td></tr><tr><td><strong>Priority</strong></td><td>P3 — Non-critical but maintained</td></tr><tr><td><strong>Services</strong></td><td>15+ dApps, tools, and platforms</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>Beyond the critical P1 infrastructure (Gateway, Signaling, Relay), the <a href="https://www.radixdlt.com/blog/the-foundation-operational-stack-mapping-the-2026-transition" target="_blank" rel="noopener">Foundation\'s operational stack</a> includes numerous P3 services that represent opportunities for community teams to adopt, improve, or replace.</p>' },
      { id: uid(), type: 'content', text: '<h2>Services Available for Handover</h2><h3>User-Facing</h3><ul><li>Asset service (icons for dApps/tokens)</li><li>Image service (Cloudflare compression/caching)</li><li>Token/NFT price service</li><li>Dashboard (transaction indexing; alternatives like Radxplorer exist)</li><li>RadQuest (onboarding dApp)</li><li>Gumball Club (demo application)</li><li>idOS Proof-of-Personhood integration</li><li>Radix Rewards system</li><li>Consultation dApp</li></ul><h3>Developer Tooling</h3><ul><li>Radix dApp Toolkit</li><li>Dev Console &amp; Sandbox</li><li>docs.radixdlt.com</li><li>academy.radixdlt.com (live but unmaintained)</li><li>learn.radixdlt.com knowledge base</li><li>Fullstack dApp example</li></ul>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/the-foundation-operational-stack-mapping-the-2026-transition" target="_blank" rel="noopener">Foundation Operational Stack: Mapping the 2026 Transition</a></li></ul>' },
    ],
  },
  {
    slug: 'core-code-governance',
    title: 'Community Code Governance',
    excerpt: "Transitioning maintenance of core Radix repositories — Node, Scrypto, Wallet — to community-led governance.",
    metadata: { status: 'Proposed', priority: 'Medium', quarter: 'Q2 2026', category: 'Community', owner: 'RAC / Community' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Development Governance</td></tr><tr><td><strong>Priority</strong></td><td>P2 — High-use, active maintenance</td></tr><tr><td><strong>Repositories</strong></td><td>Node, Gateway, Scrypto, RET, Wallet, Connector</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>The Radix Foundation currently maintains all core code repositories including the Node software, Babylon Gateway, Scrypto language, Radix Engine Toolkit, Wallet (iOS/Android), and Connector Extension. Per the <a href="https://www.radixdlt.com/blog/2026-strategy-the-next-chapter-of-radix" target="_blank" rel="noopener">2026 Strategy</a>, these will transition to community-led governance.</p><p>During Phase 1, the Foundation continues security reviews and PR maintenance while the community designs long-term governance models. Eventually, community members and funded contributors will take ownership of code quality, security audits, and release management.</p>' },
      { id: uid(), type: 'content', text: '<h2>Repositories in Scope</h2><ul><li>Radix Node Software</li><li>Babylon Gateway API</li><li>Scrypto programming language</li><li>Radix Engine Toolkit (RET)</li><li>Radix Wallet (iOS &amp; Android)</li><li>Radix Connector Extension (Chrome)</li><li>Radix Ledger App</li><li>Supporting libraries and ROLA</li></ul>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://github.com/radixdlt" target="_blank" rel="noopener">Radix DLT GitHub</a></li><li><a href="https://www.radixdlt.com/blog/2026-strategy-the-next-chapter-of-radix" target="_blank" rel="noopener">2026 Strategy: The Next Chapter of Radix</a></li><li><a href="https://www.radixdlt.com/blog/the-foundation-operational-stack-mapping-the-2026-transition" target="_blank" rel="noopener">Foundation Operational Stack</a></li></ul>' },
    ],
  },

  // ── TOOLING ───────────────────────────────────────────────
  {
    slug: 'scrypto-modern-rust',
    title: 'Scrypto 1.3.1: Modern Rust Support',
    excerpt: "Scrypto unlocks Rust 1.92.0+ support with a new WASM build pipeline, ending the 1.81.0 lockdown.",
    metadata: { status: 'Done', priority: 'Medium', quarter: 'Q1 2026', category: 'Tooling', owner: 'Foundation' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Developer Tooling</td></tr><tr><td><strong>Version</strong></td><td>Scrypto 1.3.1</td></tr><tr><td><strong>Released</strong></td><td>January 20, 2026</td></tr><tr><td><strong>Rust Support</strong></td><td>Up to 1.92.0+</td></tr><tr><td><strong>Previous Limit</strong></td><td>Rust 1.81.0</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p><a href="https://www.radixdlt.com/blog/scrypto-1-3-1-unlocking-modern-rust-support" target="_blank" rel="noopener">Scrypto 1.3.1</a> removes the Rust 1.81.0 version lock that previously constrained Radix developers. The update resolves conflicts between modern WASM compiler optimizations and Radix Engine safety requirements by rebuilding the Rust standard library during package compilation, explicitly using the MVP WASM feature set.</p>' },
      { id: uid(), type: 'content', text: '<h2>Developer Benefits</h2><ul><li>Access to Rust 1.92.0+ features, Clippy improvements, and formatting enhancements</li><li>Better IDE integration with modern Rust tooling</li><li>Easier integration with third-party <code>no_std</code> crates requiring updated Rust versions</li><li>Future-proof development environments</li></ul><p>The Radix Engine Toolkit is slated for updates to support Scrypto 1.3.1 compatibility.</p>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/scrypto-1-3-1-unlocking-modern-rust-support" target="_blank" rel="noopener">Scrypto 1.3.1: Unlocking Modern Rust Support</a></li></ul>' },
    ],
  },
  {
    slug: 'ret-scrypto-131-update',
    title: 'Radix Engine Toolkit Update',
    excerpt: "Updating the Radix Engine Toolkit to support Scrypto 1.3.1 and modern Rust toolchains.",
    metadata: { status: 'In Progress', priority: 'Medium', quarter: 'Q1 2026', category: 'Tooling', owner: 'Foundation' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Developer Tooling</td></tr><tr><td><strong>Dependency</strong></td><td>Scrypto 1.3.1</td></tr><tr><td><strong>Status</strong></td><td>In Progress</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>The Radix Engine Toolkit (RET) is being updated to support <a href="https://www.radixdlt.com/blog/scrypto-1-3-1-unlocking-modern-rust-support" target="_blank" rel="noopener">Scrypto 1.3.1</a> and modern Rust toolchains. RET provides essential developer utilities for building and testing Scrypto components, transaction construction, and manifest building.</p><p>This update ensures the full developer toolchain is compatible with Rust 1.92.0+ and the new WASM build pipeline introduced in Scrypto 1.3.1.</p>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://github.com/radixdlt" target="_blank" rel="noopener">Radix DLT GitHub</a></li><li><a href="https://www.radixdlt.com/blog/scrypto-1-3-1-unlocking-modern-rust-support" target="_blank" rel="noopener">Scrypto 1.3.1 Announcement</a></li></ul>' },
    ],
  },

  // ── DONE MILESTONES ───────────────────────────────────────
  {
    slug: 'cuttlefish-upgrade',
    title: 'Cuttlefish Protocol Upgrade',
    excerpt: "Mainnet protocol upgrade introducing native subintents for composable mini-transactions.",
    metadata: { status: 'Done', priority: 'High', quarter: 'Q1 2026', category: 'Protocol', owner: 'RDX Works' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Protocol Upgrade</td></tr><tr><td><strong>Released</strong></td><td>December 18, 2024</td></tr><tr><td><strong>Key Feature</strong></td><td>Native Subintents</td></tr><tr><td><strong>Built On By</strong></td><td>Atomix, Bullring</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>The Cuttlefish protocol upgrade went live on mainnet in December 2024, introducing <strong>native subintents</strong> — modular mini-transactions that users can pre-sign and pass around. This enables new DeFi patterns like peer-to-peer trading and parallel auctions without intermediary smart contracts.</p>' },
      { id: uid(), type: 'content', text: '<h2>Ecosystem Adoption</h2><ul><li><strong><a href="https://www.radixdlt.com/blog/radix-subintents-in-action-peer-to-peer-trading-with-atomix" target="_blank" rel="noopener">Atomix</a></strong> — peer-to-peer trading platform built entirely on subintents</li><li><strong>Bullring</strong> — parallel auction system leveraging subintent composability</li></ul><p>Subintents represent a novel DeFi primitive unique to Radix, enabling use cases that are impossible or impractical on other L1s.</p>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/radix-subintents-in-action-peer-to-peer-trading-with-atomix" target="_blank" rel="noopener">Radix Subintents in Action: Peer-to-Peer Trading with Atomix</a></li></ul>' },
    ],
  },
  {
    slug: 'hyperlane-bridge-launch',
    title: 'Hyperlane Bridge Launch',
    excerpt: "Permissionless cross-chain bridge connecting Radix to Ethereum, Arbitrum, Base, and BSC.",
    metadata: { status: 'Done', priority: 'High', quarter: 'Q1 2026', category: 'Ecosystem', owner: 'Hyperlane / Astrolescent' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Cross-chain Bridge</td></tr><tr><td><strong>Launched</strong></td><td>September 5, 2025</td></tr><tr><td><strong>Assets</strong></td><td>USDC, USDT, wBTC, ETH</td></tr><tr><td><strong>Networks</strong></td><td>Ethereum, Arbitrum, Base, BSC</td></tr><tr><td><strong>Architecture</strong></td><td>Permissionless (Hyperlane)</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p><a href="https://www.radixdlt.com/blog/hyperlane-is-live" target="_blank" rel="noopener">Hyperlane went live on Radix</a> in September 2025, delivering permissionless, modular cross-chain interoperability. The integration enables bridging of major assets (USDC, USDT, wBTC, ETH) from Ethereum, Arbitrum, Base, and BSC into the Radix DeFi ecosystem.</p><p>The bridge is accessible via Astrolescent\'s Radix-native frontend and the Hyperlane Nexus reference app. Its permissionless architecture means new routes can be deployed without centralized approval.</p>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/hyperlane-is-live" target="_blank" rel="noopener">Hyperlane is Live! — Radix Blog</a></li><li><a href="https://astrolescent.com" target="_blank" rel="noopener">Astrolescent</a></li><li><a href="https://nexus.hyperlane.xyz" target="_blank" rel="noopener">Hyperlane Nexus</a></li></ul>' },
    ],
  },
  {
    slug: 'redstone-oracles',
    title: 'RedStone Oracle Integration',
    excerpt: "Institutional-grade price feeds with 1,200+ data sources live on Radix mainnet.",
    metadata: { status: 'Done', priority: 'Medium', quarter: 'Q1 2026', category: 'Ecosystem', owner: 'RedStone' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Oracle Integration</td></tr><tr><td><strong>Launched</strong></td><td>June 2025</td></tr><tr><td><strong>Feeds</strong></td><td>1,200+</td></tr><tr><td><strong>Provider</strong></td><td>RedStone</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>RedStone Oracles went live on Radix mainnet in June 2025, providing institutional-grade price feeds with over 1,200 available data sources. This integration gives Radix DeFi protocols access to reliable, tamper-resistant pricing data for lending, derivatives, and other financial applications.</p><p>The <a href="https://www.radixdlt.com/blog/radix-review-2025" target="_blank" rel="noopener">Zellic security audit</a> completed in May 2025 found zero critical or high-severity issues, providing additional confidence in the network\'s security posture for DeFi applications relying on oracle data.</p>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/radix-review-2025" target="_blank" rel="noopener">Radix Review 2025</a></li></ul>' },
    ],
  },
  {
    slug: 'proof-of-personhood',
    title: 'Proof of Personhood (idOS)',
    excerpt: "On-chain identity verification badges via idOS integration for Sybil resistance and governance.",
    metadata: { status: 'Done', priority: 'Medium', quarter: 'Q1 2026', category: 'Ecosystem', owner: 'idOS / Foundation' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Identity Verification</td></tr><tr><td><strong>Launched</strong></td><td>November 2025</td></tr><tr><td><strong>Provider</strong></td><td>idOS Network</td></tr><tr><td><strong>Mechanism</strong></td><td>Badge-based (Radix native)</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p><a href="https://www.radixdlt.com/blog/proof-of-personhood-launches-on-radix-with-idos" target="_blank" rel="noopener">Proof-of-Personhood launched on Radix</a> in November 2025 via integration with the idOS network. The system issues a Badge — a tokenized credential in the user\'s wallet — that proves uniqueness without exposing personal data.</p><p>For developers, requiring a PoP badge is a single line of Scrypto code. For users, verification is a one-click wallet approval. The badge is critical for decentralized governance (Sybil resistance), reward programs (preventing gaming), and future permissioned DeFi applications.</p>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/proof-of-personhood-launches-on-radix-with-idos" target="_blank" rel="noopener">Proof-of-Personhood Launches on Radix with idOS</a></li><li><a href="https://idos.radixdlt.com/" target="_blank" rel="noopener">Radix idOS Proof-of-Personhood Portal</a></li></ul>' },
    ],
  },
  {
    slug: 'hyperscale-500k-test',
    title: 'Hyperscale 500k TPS Public Test',
    excerpt: "Public network test sustaining 500,000+ TPS with 590+ nodes on commodity hardware across 128 shards.",
    metadata: { status: 'Done', priority: 'High', quarter: 'Q1 2026', category: 'Protocol', owner: 'Foundation / Community' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Performance Milestone</td></tr><tr><td><strong>Date</strong></td><td>January 31, 2026</td></tr><tr><td><strong>Sustained TPS</strong></td><td>500,000+</td></tr><tr><td><strong>Peak TPS</strong></td><td>800,000+</td></tr><tr><td><strong>Nodes</strong></td><td>590+</td></tr><tr><td><strong>Shards</strong></td><td>128</td></tr><tr><td><strong>Hardware</strong></td><td>Commodity (m6i.xlarge)</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>The <a href="https://www.radixdlt.com/blog/hyperscale-update-500k-public-test-done" target="_blank" rel="noopener">Hyperscale public test</a> in January 2026 demonstrated the most significant throughput milestone in Radix history. The network sustained 500,000+ transactions per second with peaks exceeding 800,000 TPS, processing real DeFi-style swaps across 128 shards with full cross-shard atomic composability.</p>' },
      { id: uid(), type: 'content', text: '<h2>Key Results</h2><ul><li><strong>Linear scaling confirmed:</strong> 250k TPS on 64 shards → 500k TPS on 128 shards (exact proportional scaling)</li><li><strong>Real workload:</strong> complex DeFi swap transactions, not simple transfers</li><li><strong>Open participation:</strong> 590+ nodes from datacenters, desktops, and laptops</li><li><strong>Commodity hardware:</strong> validators ran on AWS m6i.xlarge (4 cores, 16GB RAM)</li><li><strong>Infrastructure:</strong> 384 bootstrap nodes, 40 validators, 6 load generators</li></ul>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/hyperscale-update-500k-public-test-done" target="_blank" rel="noopener">Hyperscale Update: 500k+ Public Test Done</a></li><li><a href="https://www.radixdlt.com/blog/interim-hyperscale-closing-the-chapter" target="_blank" rel="noopener">Interim Hyperscale: Closing the Chapter</a></li></ul>' },
    ],
  },
];

insertPages(pages, 'roadmap', 'Initial roadmap item')
  .catch(err => { console.error(err); process.exit(1); });
