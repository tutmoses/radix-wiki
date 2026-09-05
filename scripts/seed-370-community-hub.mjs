/**
 * Run 370 (community rotation) — the /community category has no hub article.
 *
 * /community holds twelve profile pages and renders as a bare card grid with no head, the same
 * gap run 369 closed for /ecosystem. A category's own article is a page row at the empty slug,
 * so this creates one: who the section profiles, measured; how a person earns a page, pointing
 * at the notability policy rather than restating it; where the community actually talks; and,
 * stated plainly, how much of the community this directory does not yet cover.
 *
 * Every count here was read from the pages table on 2026-09-05, and the halt figures from
 * mainnet.radixdlt.com/status/gateway-status at 11:03 UTC the same day.
 */
import { uid, insertPages } from './seed-utils.mjs';

const content = [
  { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text:
    '<table><tbody>'
    + '<tr><th colspan="2">Radix Community</th></tr>'
    + '<tr><td><strong>Scope</strong></td><td>The people who built, run and govern <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix</a></td></tr>'
    + '<tr><td><strong>Profiles in this directory</strong></td><td>12 (read 5 September 2026)</td></tr>'
    + '<tr><td><strong>Company founder and officers</strong></td><td>5</td></tr>'
    + '<tr><td><strong>Independent contributors</strong></td><td>6</td></tr>'
    + '<tr><td><strong>Pseudonymous</strong></td><td>4</td></tr>'
    + '<tr><td><strong>Inclusion test</strong></td><td><a href="/policy/notability" rel="noopener">Notability</a></td></tr>'
    + '<tr><td><strong>Elected body</strong></td><td><a href="/ecosystem/radix-accountability-council" rel="noopener">Radix Accountability Council</a></td></tr>'
    + '<tr><td><strong>Written record</strong></td><td><a href="/ecosystem/radixtalk" rel="noopener">RadixTalk</a></td></tr>'
    + '<tr><td><strong>Network</strong></td><td>Mainnet halted since 21:19&nbsp;UTC, 31 August 2026</td></tr>'
    + '</tbody></table>' }] },

  { id: uid(), type: 'content', text:
    '<h2>Introduction</h2>'
    + '<p>This section profiles people rather than projects. Where the <a href="/ecosystem" rel="noopener">ecosystem directory</a> records what was built on <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix</a>, this one records who built it, who runs it, and who is arguing about what happens to it next: the founder and officers of the companies that made the network, and the independent developers, node operators and writers who have kept working on it without being paid to.</p>'
    + '<p>The rule for a page here is the same as everywhere else on this wiki. A profile is written from what a person did and what can be sourced for it, not from what they say about themselves, and it stays after they stop. One of the twelve died in 2025 and several of the others have since left the companies they are here for; their pages stay, because a directory that quietly removes people is a worse record of the network than one that does not.</p>' },

  { id: uid(), type: 'content', text:
    '<h2>Who is profiled here</h2>'
    + '<p>Read on 5 September 2026 the section holds <strong>twelve profiles</strong>. Five are the founder and officers of the companies that built and funded Radix: <a href="/community/dan-hughes" rel="noopener">Dan Hughes</a>, who wrote the protocol and died in July 2025; <a href="/community/piers-ridyard" rel="noopener">Piers Ridyard</a>, chief executive of <a href="/ecosystem/rdx-works" rel="noopener">RDX Works</a> and the project&rsquo;s public voice from 2018; <a href="/community/matthew-hine" rel="noopener">Matthew Hine</a>, its chief product officer and the author of most of the asset-oriented essays that made the technical case; <a href="/community/adam-simmons" rel="noopener">Adam Simmons</a>, chief strategy officer of the <a href="/ecosystem/radix-foundation" rel="noopener">Radix Foundation</a> until April 2026; and <a href="/community/andy-jarrett" rel="noopener">Andy Jarrett</a>, who since February 2025 has been the UK Foundation&rsquo;s only serving director.</p>'
    + '<p>Six are independent contributors, and between them they cover most of what the network currently depends on that no company is paying for: <a href="/community/flightofthefox" rel="noopener">flightofthefox</a>, who writes <a href="/contents/tech/research/hyperscale-rs" rel="noopener">hyperscale-rs</a>, the leading candidate to deliver the sharded consensus layer; <a href="/community/daffy" rel="noopener">Daffy</a>, who drafted the <a href="/contents/tech/core-concepts/radix-governance" rel="noopener">DAO governance framework</a> and hosts most of the community-run test network; <a href="/community/kangaderoo" rel="noopener">Kangaderoo</a>, who contributed blueprints and front-end code through the Babylon release; <a href="/community/vandyill" rel="noopener">VandyILL</a>, who builds games, small web tools and a set of published agent-payment experiments; <a href="/community/genki" rel="noopener">GenkiPool</a>, who writes open-source tooling and Spanish-language teaching material; and <a href="/community/gilesmorris-me" rel="noopener">Giles Morris</a>, a former accountant who models what the network costs to run. The twelfth page, <a href="/community/cryptoants" rel="noopener">CryptoAnts</a>, is an unfilled placeholder left over from an earlier sign-up flow and is the only entry here that is not a written profile.</p>'
    + '<p>Four of the eleven written profiles are of people who work under a handle rather than a legal name. That is recorded as it is found: this wiki names people the way they publish, and does not treat a pseudonym as a reason to leave someone out or as an invitation to identify them.</p>' },

  { id: uid(), type: 'content', text:
    '<h2>How a person earns a page</h2>'
    + '<p>The test is the wiki&rsquo;s <a href="/policy/notability" rel="noopener">notability</a> policy, which asks for significant independent coverage or a material role in how the network runs. For a person that usually means the second: code that others depend on, a document that governance actually uses, infrastructure that other people build against, or an office with decisions attached to it. Holding a large amount of XRD is not a qualification, and neither is being active in a chat group.</p>'
    + '<p>What follows from that is a section shaped by consequence rather than by prominence. Five of the twelve held an office at a Radix company, and the other seven are here for something they made or maintain. It also means the section is unbalanced on purpose: a pseudonymous developer with no public identity at all can carry a longer page than a serving officer of the Foundation, if more of what they did is on the record.</p>' },

  { id: uid(), type: 'content', text:
    '<h2>Where the community actually talks</h2>'
    + '<p>Almost all of it happens in chat, and almost none of it survives there. The day-to-day conversation runs across a handful of public Telegram groups, one per audience: the main developer group, the announcements channel, the hyperscale-rs project group where the next consensus layer is being written in the open, and the <a href="/ecosystem/radix-accountability-council" rel="noopener">Accountability Council&rsquo;s</a> own channel, which its page records at 351 members. None of it is indexed, none of it is quotable a month later, and a decision taken in it leaves no address a reader can be sent to.</p>'
    + '<p>The written record is <a href="/ecosystem/radixtalk" rel="noopener">RadixTalk</a>, the community-run forum that has been going since December 2021 and that its page records at 700 topics and 6,206 posts from 633 accounts. That is where proposals, requests for comment and node-operator troubleshooting are set down in a form that can be cited, and it is where the <a href="/contents/tech/core-concepts/radix-governance" rel="noopener">DAO transition</a> is being argued out before anything reaches a binding vote. Most citations in this section point at one of those two places, and where a claim rests on a chat message the page says so and links the message.</p>' },

  { id: uid(), type: 'content', text:
    '<h2>What this directory does not cover</h2>'
    + '<p>Twelve profiles against 150 project pages in the <a href="/ecosystem" rel="noopener">ecosystem directory</a> is not a description of the Radix community; it is a start on one. The gaps are specific and known. There is no profile of a single mainnet <a href="/contents/tech/core-concepts/validator-nodes" rel="noopener">validator operator</a>, although the ledger names every one of them and their fee decisions move real stake. The <a href="/ecosystem/radix-accountability-council" rel="noopener">Accountability Council&rsquo;s</a> five elected members are recorded on the council&rsquo;s own page and not individually here. The people running the larger exchanges and money markets appear only inside their projects&rsquo; pages.</p>'
    + '<p>None of that is a policy against writing them. It is simply what has been written so far, and the fastest way to change it is to write one: the section takes contributions the same way the rest of the wiki does.</p>' },

  { id: uid(), type: 'content', text:
    '<h2>The network these people run has stopped</h2>'
    + '<p>Radix mainnet stopped committing rounds at <strong>21:19:06&nbsp;UTC on 31 August 2026</strong> and has not restarted. Validators holding more than two thirds of stake broke liveness deliberately, hours after <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">every Hyperlane-bridged asset on the network was drained</a> through a flaw in the Radix Engine. Read at 11:03&nbsp;UTC on 5 September, the <a href="https://mainnet.radixdlt.com/status/gateway-status" target="_blank" rel="noopener">Gateway status endpoint</a> still returns the same last committed ledger, state version 557,840,622 at epoch 339,896, round 102, one hundred and nine hours later.</p>'
    + '<p>That makes this section unusually load-bearing for a directory of people. A halted network has no automatic way back: restarting it is a decision taken by the validator operators who stopped it, coordinated through the <a href="/ecosystem/radix-accountability-council" rel="noopener">Accountability Council</a> and the Foundation, on a fix written by whoever is available to write it. The names in this section are most of the people in a position to do any of that, and the pages record what each of them has actually said and done since the halt, dated, rather than what the ecosystem hopes they will do next.</p>' },
];

await insertPages(
  [{ tagPath: 'community', slug: '', title: 'Radix Community',
     metadata: { excerpt: 'The twelve people this wiki profiles: who built and runs Radix, how a person earns a page here, where the community writes things down, and who is still missing.' },
     content }],
  'community',
  'Hub article for the Community category, which had none. Twelve profile pages rendered as a bare card grid with no head. Composition measured from the pages table on 5 September 2026: 5 company founder and officers, 6 independent contributors, 1 unfilled placeholder, 4 of the 11 written profiles pseudonymous.',
);
