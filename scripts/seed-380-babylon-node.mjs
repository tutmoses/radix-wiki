// scripts/seed-380-babylon-node.mjs — run 380 (contents/tech rotation).
//
// Closes the 2026-09-06 Week in Review backlog request for a babylon-node page.
// The wiki carries core-protocols pages for the engine, the two APIs and the
// consensus specification, but none for the node implementation that actually
// runs mainnet — the repository every protocol update has to reach before a
// validator can signal readiness for it. Every figure below was read from the
// GitHub API, the repository's own README and LICENSE, and docs.radixdlt.com on
// 7 September 2026; the halt figures come from a pinned Gateway read.

import { uid, insertPages } from './seed-utils.mjs';

const pages = [
  {
    tagPath: 'contents/tech/core-protocols',
    slug: 'babylon-node',
    title: 'Babylon Node',
    metadata: {
      excerpt:
        'The Java and Rust node implementation that runs Radix mainnet, embeds the Radix Engine, and carries every protocol update to the validator set.',
    },
    content: [
      {
        id: uid(),
        type: 'infobox',
        blocks: [
          {
            id: uid(),
            type: 'content',
            text:
              '<table><tbody>' +
              '<tr><th>Software</th><td>The Radix node for the Babylon network and beyond</td></tr>' +
              '<tr><th>Repository</th><td><a href="https://github.com/radixdlt/babylon-node" target="_blank" rel="noopener">radixdlt/babylon-node</a>, created 25 April 2022</td></tr>' +
              '<tr><th>Languages</th><td>Java (consensus, networking) and Rust (Core API, state manager); TypeScript for generated clients</td></tr>' +
              '<tr><th>Licence</th><td><a href="https://www.radixfoundation.org/licenses/license-v1" target="_blank" rel="noopener">Radix License 1.0</a>, July 2021</td></tr>' +
              '<tr><th>Engine</th><td>Pulled in from <a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a>, not vendored in this repository</td></tr>' +
              '<tr><th>Latest release</th><td><a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.3.0.5" target="_blank" rel="noopener">v1.3.0.5</a>, 1 June 2026 &ndash; an opt-in release carrying no protocol change</td></tr>' +
              '<tr><th>Protocol line</th><td>v1.0.0 Genesis &middot; v1.1.0 Anemone &middot; v1.2.0 Bottlenose &middot; v1.3.0 Cuttlefish</td></tr>' +
              '<tr><th>Default branch</th><td><code>develop</code> &ndash; last commit 12 March 2025, while releases are cut from <code>main</code></td></tr>' +
              '<tr><th>Primary sources</th><td><a href="https://github.com/radixdlt/babylon-node/blob/main/README.md" target="_blank" rel="noopener">README</a> &middot; <a href="https://docs.radixdlt.com/docs/node-protocol-updates" target="_blank" rel="noopener">Node Protocol Updates</a></td></tr>' +
              '</tbody></table>',
          },
        ],
      },
      {
        id: uid(),
        type: 'content',
        text:
          '<h2>Overview</h2>' +
          '<p><strong>Babylon Node</strong> is the software that runs the Radix network. Its repository, <a href="https://github.com/radixdlt/babylon-node" target="_blank" rel="noopener">radixdlt/babylon-node</a>, describes itself as "the Radix node, updated for Babylon" and states that it <em>embeds</em> the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a>, which lives in the separate <a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a> repository. That separation is the single most useful thing to know about it: the rules a transaction is executed under are written elsewhere, and this repository is what carries them to the machines that run the ledger.</p>' +
          '<p>The node is where <a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">consensus</a>, peer-to-peer networking, the <a href="/contents/tech/core-protocols/radix-core-api" rel="noopener">Core API</a> and the engine meet in one process. The <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway API</a> that most applications read the ledger through is not part of it; the Gateway is a separate service that reads from a node. A <a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">validator</a> is a node whose operator has registered it on-ledger and attracted <a href="/contents/tech/core-concepts/staking" rel="noopener">stake</a>, and running one is documented in this wiki’s own <a href="/developers/infrastructure/01-running-a-node" rel="noopener">infrastructure guide</a>.</p>',
      },
      {
        id: uid(),
        type: 'content',
        text:
          '<h2>What is inside it</h2>' +
          '<p>The repository’s <a href="https://github.com/radixdlt/babylon-node/blob/main/README.md" target="_blank" rel="noopener">README</a> maps the tree, and the division it describes is a language boundary as much as a functional one. GitHub measures the checkout at roughly 16.7&nbsp;MB of Java against 4.9&nbsp;MB of Rust and 3.4&nbsp;MB of TypeScript.</p>' +
          '<ul>' +
          '<li><code>core</code> &ndash; the node itself: consensus and networking, in Java. The README describes it as including "a variant implementation of the <a href="https://arxiv.org/abs/1803.05069" target="_blank" rel="noopener">HotStuff</a> BFT-style consensus", which is the plainest statement in Radix’s own source of what secures Babylon mainnet. Cerberus running unsharded, as it does on mainnet, is equivalent to that original HotStuff protocol.</li>' +
          '<li><code>core-rust</code> &ndash; the Core API and the "State Manager" that wraps the Babylon engine, in Rust. This is the module that pulls the engine in from radixdlt-scrypto.</li>' +
          '<li><code>core-rust-bridge</code> &ndash; the Java side of the boundary between those two, which the README expects will eventually be folded into <code>core</code>.</li>' +
          '<li><code>cli-tools</code>, <code>common</code>, <code>shell</code>, <code>docker</code> and <code>testnet-node</code> &ndash; the operator surface: command-line helpers, shared Java utilities, the interactive Radix Shell, a local multi-node network, and a one-script development node for integrators.</li>' +
          '</ul>' +
          '<p>The engine dependency is the reason a change to how transactions execute is not, by itself, a change to the node. It becomes one when a node release picks the new engine up.</p>',
      },
      {
        id: uid(),
        type: 'content',
        text:
          '<h2>How a protocol update reaches mainnet</h2>' +
          '<p>Radix does not switch rules when nodes are updated. It switches when the validator set says it is ready. The node supports two triggers, described in <a href="https://docs.radixdlt.com/docs/node-protocol-updates" target="_blank" rel="noopener">Radix’s node documentation</a>: unconditional enactment at the start of a named epoch, used for genesis and test environments, and validator readiness signalling, which is "the standard option for mainnet protocol updates".</p>' +
          '<p>Under the second, each validator has room for exactly one optional readiness signal at a time, and the signal is not the update’s name but a unique string derived from the protocol version and its trigger condition. Enactment is bounded by a <code>lower_bound_epoch_inclusive</code> and an <code>upper_bound_epoch_exclusive</code>, and gated on one or more readiness thresholds, each pairing a <code>required_ratio_of_stake_supported</code> with a <code>required_consecutive_completed_epochs_of_support</code>. A threshold is met when validators representing at least that share of the active set’s stake have been signalling continuously for that many epochs.</p>' +
          '<p>The three mainnet updates configured so far, with the node release each shipped in:</p>' +
          '<table><thead><tr><th>Update</th><th>Node</th><th>Readiness signal</th><th>Epoch window</th><th>Requirement</th></tr></thead><tbody>' +
          '<tr><td>Anemone</td><td>v1.1.0</td><td><code>220e2a4a4e86e3e6000000000anemone</code></td><td>[70019, 74051)</td><td>75% of stake for ~4 days</td></tr>' +
          '<tr><td>Bottlenose</td><td>v1.2.0</td><td><code>86894b9104afb73a000000bottlenose</code></td><td>[104291, 112355)</td><td>75% of stake for ~2 weeks</td></tr>' +
          '<tr><td>Cuttlefish</td><td>v1.3.0</td><td><code>96e00440adafe5e2000000cuttlefish</code></td><td>[158682, 161562)</td><td>75% of stake for ~2 weeks</td></tr>' +
          '</tbody></table>' +
          '<p>Cuttlefish enacted at epoch 160923, inside that window. Execution itself is handled by the node: the final consensus proof of the preceding epoch signs off on the enactment, so the epoch cannot end unless a quorum agrees it should proceed, and the update then commits zero or more batches of system "flash" transactions that rewrite engine substates directly. An operator can ask a running node what it has enacted and what is pending through its System Health endpoint, by default <code>http://localhost:3334/system/health</code>, which lists both with their readiness signal names.</p>' +
          '<p>The consequence for a reader watching for an upgrade is precise: until a node release exists that contains a protocol version, there is nothing for a validator to signal, and therefore no readiness figure to watch. See <a href="/contents/tech/releases/protocol-updates" rel="noopener">Protocol Updates</a> for what each one changed.</p>',
      },
      {
        id: uid(),
        type: 'content',
        text:
          '<h2>Release history and branch topology</h2>' +
          '<p>The repository’s releases follow the protocol line rather than a calendar. The original protocol version, <code>babylon</code>, arrived with the v1.0.0 node and was enacted immediately at the <a href="/contents/tech/releases/radix-mainnet-babylon" rel="noopener">Babylon</a> migration; v1.1.0, v1.2.0 and v1.3.0 carried Anemone, Bottlenose and Cuttlefish. Everything since has been a patch on the Cuttlefish line: v1.3.0.1 and v1.3.0.2 in December 2024 and January 2025, then v1.3.0.4 on 2 April 2026 and <a href="https://github.com/radixdlt/babylon-node/releases/tag/v1.3.0.5" target="_blank" rel="noopener">v1.3.0.5</a> on 1 June 2026. All five are still named "Cuttlefish", and none carries a protocol change.</p>' +
          '<p>Where that work happens is not where the repository’s front page points. GitHub serves <code>develop</code> as the default branch, and <code>develop</code>’s tip is commit <code>12919a01</code>, "Update development docs", of 12 March 2025. The release line is <code>main</code>, whose tip <code>959b081e</code> of 1 June 2026 is the exact commit tagged v1.3.0.5. The two branches have diverged rather than drifted: GitHub’s comparison puts 28 commits on <code>main</code> that are not on <code>develop</code>, and 223 on <code>develop</code> that are not on <code>main</code>. A reader who opens the repository to judge whether the node is being worked on sees, by default, a branch that stopped eighteen months ago.</p>',
      },
      {
        id: uid(),
        type: 'content',
        text:
          '<h2>Status during the September 2026 halt</h2>' +
          '<p>Mainnet has not committed a round since 31 August 2026 at 21:19:06.179&nbsp;UTC, at epoch 339,896 and state version 557,840,622, following <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">the Hyperlane asset drain</a>. Read on 7 September 2026, this repository shows nothing that would end that: the newest release is still v1.3.0.5 of 1 June, there is no branch or tag naming a forthcoming protocol version, and the newest release therefore carries no rule change for a validator to signal readiness for.</p>' +
          '<p>The candidate fix is not in this repository at all. It is <a href="https://github.com/radixdlt/radixdlt-scrypto/pull/2093" target="_blank" rel="noopener">pull request #2093</a> against radixdlt-scrypto, the engine repository this one embeds, adding a receiver check to method invocation under a new protocol version. Nothing in that pull request reaches the network until an engine release carrying it is pulled into a node release, that node release is published, and enough of the validator set signals for it. The repository’s only activity on 6 September was continuous-integration housekeeping, in two open pull requests from the same author: <a href="https://github.com/radixdlt/babylon-node/pull/1074" target="_blank" rel="noopener">#1074</a>, "Test workflow", a single file against <code>develop</code>, and <a href="https://github.com/radixdlt/babylon-node/pull/1075" target="_blank" rel="noopener">#1075</a>, removing unused Phylum and Postman CI jobs across five files against <code>main</code>. The same pattern appeared in radixdlt-scrypto the same day. Repository activity during an outage is easy to mistake for progress on the outage; on both repositories, so far, it has not been.</p>',
      },
      {
        id: uid(),
        type: 'content',
        text:
          '<h2>See Also</h2>' +
          '<ul>' +
          '<li><a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a></li>' +
          '<li><a href="/contents/tech/core-protocols/cerberus-consensus-protocol" rel="noopener">Cerberus (Consensus Protocol)</a></li>' +
          '<li><a href="/contents/tech/core-protocols/radix-core-api" rel="noopener">Radix Core API</a></li>' +
          '<li><a href="/contents/tech/releases/protocol-updates" rel="noopener">Protocol Updates</a></li>' +
          '<li><a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">Validator Nodes</a></li>' +
          '<li><a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a></li>' +
          '<li><a href="/developers/infrastructure/01-running-a-node" rel="noopener">Running a Node</a></li>' +
          '</ul>' +
          '<h2>External Links</h2>' +
          '<ul>' +
          '<li><a href="https://github.com/radixdlt/babylon-node" target="_blank" rel="noopener">radixdlt/babylon-node</a> &ndash; the repository</li>' +
          '<li><a href="https://github.com/radixdlt/babylon-node/releases" target="_blank" rel="noopener">Releases</a> &ndash; the node release line</li>' +
          '<li><a href="https://docs.radixdlt.com/docs/node-protocol-updates" target="_blank" rel="noopener">Node Protocol Updates</a> &ndash; readiness signalling, thresholds and the mainnet table</li>' +
          '<li><a href="https://docs.radixdlt.com/docs/protocol-updates" target="_blank" rel="noopener">Protocol Updates</a> &ndash; Radix Docs</li>' +
          '<li><a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto</a> &ndash; the engine the node embeds</li>' +
          '<li><a href="https://www.radixfoundation.org/licenses/license-v1" target="_blank" rel="noopener">Radix License 1.0</a></li>' +
          '</ul>',
      },
    ],
  },
];

await insertPages(
  pages,
  'contents/tech/core-protocols',
  'New page: the node implementation that runs Radix mainnet: repository layout, the Java/Rust split, protocol-update readiness signalling with the mainnet table, release line and branch topology, and its state during the September 2026 halt. Sourced from the repository README and LICENSE, the GitHub API and docs.radixdlt.com, read 7 September 2026.',
);
