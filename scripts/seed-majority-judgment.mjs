// scripts/seed-majority-judgment.mjs — Majority Judgment, the election method the
// Radix DAO adopted as its default.
//
// Run 377. Six pages on this wiki name Majority Judgment and none explains it,
// and the one thing a reader most needs is the thing every summary of the method
// gets wrong here: Radix does NOT settle a grade at the median. It settles it at
// three-fifths of the voting power cast, and says so in terms.
import { uid, insertPages } from './seed-utils.mjs';

const PVF = 'https://github.com/RadixDAO/governance-framework/blob/main/pending/governance/proposal-and-voting-framework.md';
const PARAMS = 'https://github.com/RadixDAO/governance-framework/blob/main/pending/parameters/dao-parameters-registry.md';
const PNAS = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1885569/';
const COMPONENT = 'https://dashboard.radixdlt.com/component/component_rdx1cp90ys553uwxuckev249x5wezucqru0u4qr7qdxdc9tlpmnh93242k';

const content = [
  {
    id: uid(),
    type: 'infobox',
    blocks: [{
      id: uid(),
      type: 'content',
      text:
        '<table><tbody>' +
        '<tr><td><strong>Method</strong></td><td>Majority Judgment (MJ)</td></tr>' +
        '<tr><td><strong>Type</strong></td><td>Graded, or evaluative, voting</td></tr>' +
        '<tr><td><strong>Proposed by</strong></td><td>Michel Balinski and Rida Laraki</td></tr>' +
        '<tr><td><strong>First published</strong></td><td>2007, <em>Proceedings of the National Academy of Sciences</em> 104(21)</td></tr>' +
        '<tr><td><strong>Ballot</strong></td><td>One grade per candidate, every candidate graded</td></tr>' +
        '<tr><td><strong>Radix grade scale</strong></td><td>Excellent, Very Good, Good, Acceptable, Poor</td></tr>' +
        '<tr><td><strong>Radix counting share</strong></td><td>Three-fifths of voting power cast (not the median)</td></tr>' +
        '<tr><td><strong>Used by Radix for</strong></td><td>Electing the <a href="/ecosystem/radix-accountability-council" class="link">Permanent RAC</a>, seven seats</td></tr>' +
        '<tr><td><strong>Status</strong></td><td>Deployed on mainnet, never used</td></tr>' +
        '</tbody></table>',
    }],
  },
  {
    id: uid(),
    type: 'content',
    text:
      '<p><strong>Majority Judgment</strong> is a voting method in which each voter grades every candidate on one shared scale of words rather than ranking them or picking one. ' +
      'It was set out by Michel Balinski and Rida Laraki in <em>A theory of measuring, electing, and ranking</em>, published in the <em>Proceedings of the National Academy of Sciences</em> in May 2007.<sup class="cite"><a href="#ref-1">[1]</a></sup> ' +
      'The argument behind it is that a ballot asking who you prefer collects less information than a ballot asking how good each candidate is, and that a method counting grades can escape some of the failures that follow from counting preferences.</p>' +
      '<p>The <a href="/contents/tech/core-concepts/radix-governance" class="link">Radix DAO governance framework</a> adopts it as the default mechanism for every election the DAO holds, including the seven-seat <a href="/ecosystem/radix-accountability-council" class="link">Permanent Radix Accountability Council</a>.<sup class="cite"><a href="#ref-2">[2]</a></sup> ' +
      'Radix implements one deliberate departure from the published method, and it is the detail this page exists to state plainly: the share of voting power that settles a candidate&rsquo;s grade is <strong>three-fifths</strong>, not one half. Radix elections are not decided on the median grade.</p>',
  },
  {
    id: uid(),
    type: 'content',
    text:
      '<h2 id="how-the-count-works">How the count works</h2>' +
      '<p>Every valid ballot assigns exactly one grade to every candidate on the list. A ballot that leaves any candidate ungraded is invalid and is not counted, and the Radix framework requires the ballot interface to refuse an incomplete submission at the point of casting, so that honest voter error cannot show up later as low turnout.<sup class="cite"><a href="#ref-2">[2]</a></sup> ' +
      'Each voter&rsquo;s full voting power is applied to each grade that voter assigns. There is no Abstain grade: a voter who does not want to support a candidate grades them low, and the scale itself carries that.</p>' +
      '<p>Counting a candidate is one pass down the scale. Start at the highest grade and accumulate the voting power that placed the candidate at that grade or above. The first grade at which the running total reaches the required share is the candidate&rsquo;s <strong>qualifying grade</strong>. Under the published method that share is one half and the result is the candidate&rsquo;s median grade, which Balinski and Laraki call the majority grade. Under the Radix framework the share is three-fifths, which is why the result is not a median and the framework does not call it one.</p>' +
      '<p>Because every valid ballot grades every candidate, the voting power measured is identical for every candidate in the round. Qualifying grades are therefore directly comparable, and no candidate can be flattered by having been graded on fewer ballots than a rival.</p>',
  },
  {
    id: uid(),
    type: 'content',
    text:
      '<h2 id="the-radix-variant">The Radix variant, term by term</h2>' +
      '<p>Four settings do the work, and three of them live in the framework text rather than in the parameter registry, which means changing them is an amendment rather than a parameter change.<sup class="cite"><a href="#ref-3">[3]</a></sup></p>' +
      '<table><thead><tr><th>Term</th><th>Value</th><th>What it does</th></tr></thead><tbody>' +
      '<tr><td>Grade scale</td><td>Excellent, Very Good, Good, Acceptable, Poor</td><td>Five ordered grades. The order is normative; the implementation indices 4 down to 0 encode the order and are never averaged</td></tr>' +
      '<tr><td>Grade Quantile</td><td>Three-fifths, fixed in the framework, not a parameter</td><td>The share of voting power cast that must place a candidate at or above a grade for that grade to be theirs</td></tr>' +
      '<tr><td>Minimum Qualifying Grade</td><td><em>Good</em></td><td>The lowest qualifying grade at which a candidate may be seated at all. A ranking alone does not seat someone the electorate grades below the floor</td></tr>' +
      '<tr><td>Quorum</td><td>7% of eligible voting power</td><td>Participation needed for the round to count, unchanged on the single permitted rerun</td></tr>' +
      '</tbody></table>' +
      '<p>The quantile is set to three-fifths so that it matches the 60% approval threshold the DAO&rsquo;s other election mechanism applies per candidate, putting the same share-of-turnout test to a candidate whichever mechanism is in force.<sup class="cite"><a href="#ref-3">[3]</a></sup> ' +
      'The two settings are not independent of one another: raising the quantile lowers every qualifying grade computed on the same ballots, so a floor left unchanged silently becomes a higher bar.</p>' +
      '<p>Radix also resolves an exact split upward where some of the literature resolves it downward. Where the running total arrives at exactly three-fifths at a grade, that grade is the qualifying grade, so a candidate graded Excellent by exactly three-fifths of the voting power cast and Poor by the rest qualifies at <em>Excellent</em>. The framework gives its reason: the rule follows from a single accumulation pass and can be checked against the published tallies without a second rule.<sup class="cite"><a href="#ref-2">[2]</a></sup></p>',
  },
  {
    id: uid(),
    type: 'content',
    text:
      '<h2 id="ties">Ties, and what a low turnout buys</h2>' +
      '<p>Candidates are ranked by qualifying grade, and that ranking is itself the seating order, so there is no separate confirmation round of the kind the two-stage mechanism needs. Where two candidates share a qualifying grade and the tie decides a seat, it is broken by the <strong>majority gauge</strong>: for each tied candidate, compare the share of voting power that graded them above their qualifying grade against the share that graded them below it. The framework applies the gauge rather than the iterative middlemost-grade formulation, on the stated ground that the gauge is computed in one pass over the published tallies and can be verified by any member from the result.<sup class="cite"><a href="#ref-2">[2]</a></sup></p>' +
      '<p>A round that closes below quorum may be re-run exactly once, and the rerun is deliberately not made easier: same quorum, same quantile, same electability floor, same snapshot of the electorate, with double the voting period. The framework spells out why, and the reasoning is worth reading whatever one thinks of the method. A rerun on lower thresholds is a different question rather than more time to answer the same one, and a reduced quorum would make the rerun cheaper to control than the round it exists to rescue, which is an incentive to suppress turnout in the first round.<sup class="cite"><a href="#ref-2">[2]</a></sup> ' +
      'If the rerun also closes below quorum, no candidate is elected and every seat is referred to vacancy handling.</p>',
  },
  {
    id: uid(),
    type: 'content',
    text:
      '<h2 id="on-ledger">The mechanism is on the ledger, and has never run</h2>' +
      '<p>Majority Judgment is not only drafted. The governance <a href="/contents/tech/core-concepts/components" class="link">component</a> the framework routes through is deployed on Radix mainnet, running <a href="/contents/tech/core-concepts/blueprints-and-packages" class="link">blueprint</a> <code>Governance</code> v1.0.0, and among its nineteen methods is <code>vote_on_majority_judgment_election</code>. Its stored state holds a <code>majority_judgment_elections</code> key-value store alongside <code>temperature_checks</code> and <code>proposals</code>, each with its own counter.<sup class="cite"><a href="#ref-4">[4]</a></sup> ' +
      'Read from the ledger repeatedly through August 2026, all three counters read <strong>0</strong>. The contract the whole framework depends on is live and has processed nothing, which is the correct state while nothing in the framework is yet operative.</p>' +
      '<p>Two things stand between the method and its first use. Ratification of the Governance Framework is an activation condition of the DAO&rsquo;s Operating Agreement and needs a vote, and the <a href="/contents/history/hyperlane-asset-drain-2026" class="link">network halt</a> that began on 31 August 2026 stopped the ledger a vote would have to run on. ' +
      'The <a href="/ecosystem/radix-accountability-council" class="link">council</a> responded by removing the seven-day limit on the discussion phase and leaving it open-ended, so the first Radix election held under Majority Judgment has no date.</p>' +
      '<p>One further caution for anyone reading the deployed contract against the written rules. The component&rsquo;s election parameter set carries a field named <code>minimum_median_grade</code>, and the framework it implements settles grades at the Grade Quantile and not at the median. The name is a leftover from an earlier reading; the framework text is the authority on what the field means.</p>',
  },
  {
    id: uid(),
    type: 'content',
    text:
      '<h2 id="see-also">See also</h2>' +
      '<ul>' +
      '<li><a href="/contents/tech/core-concepts/radix-governance" class="link">Radix Governance</a></li>' +
      '<li><a href="/ecosystem/radix-accountability-council" class="link">Radix Accountability Council</a></li>' +
      '<li><a href="/ideas/dao-elect-permanent-rac" class="link">Governance WG: Elect the Permanent RAC</a></li>' +
      '<li><a href="/ideas/radix-network-dao-charter" class="link">Radix DAO Charter</a></li>' +
      '</ul>' +
      '<h2 id="external-links">External links</h2>' +
      '<ul>' +
      `<li><a href="${PNAS}" target="_blank" rel="noopener">Balinski and Laraki, <em>A theory of measuring, electing, and ranking</em></a>, PNAS 104(21):8720, 2007</li>` +
      `<li><a href="${PVF}" target="_blank" rel="noopener">Proposal &amp; Voting Framework</a>, RadixDAO/governance-framework, section 6.2.4</li>` +
      `<li><a href="${PARAMS}" target="_blank" rel="noopener">DAO Parameters Registry</a>, RadixDAO/governance-framework, sections 3.5 and 6B</li>` +
      `<li><a href="${COMPONENT}" target="_blank" rel="noopener">The deployed governance component</a> on the Radix Dashboard</li>` +
      '</ul>',
  },
  {
    id: uid(),
    type: 'references',
    title: 'References',
    items: [
      { id: uid(), url: PNAS, text: 'Michel Balinski and Rida Laraki, &ldquo;A theory of measuring, electing, and ranking&rdquo;, <em>PNAS</em> 104(21):8720, 22 May 2007' },
      { id: uid(), url: PVF, text: 'RadixDAO governance-framework &ndash; <em>Proposal &amp; Voting Framework</em>, sections 4.5, 6.2.4, 6.3 and 6.5' },
      { id: uid(), url: PARAMS, text: 'RadixDAO governance-framework &ndash; <em>DAO Parameters Registry</em>, sections 3.5 and 6B' },
      { id: uid(), url: COMPONENT, text: 'Radix Dashboard &ndash; the deployed <em>Governance</em> v1.0.0 component, read at epoch 338,958 on 28 August 2026' },
    ],
  },
];

const EXCERPT =
  'The graded election method the Radix DAO adopted as its default: every voter grades every candidate, and a grade is settled at three-fifths, not the median.';

console.log(`excerpt length: ${EXCERPT.length}`);

await insertPages(
  [{
    tagPath: 'contents/tech/core-concepts',
    slug: 'majority-judgment',
    title: 'Majority Judgment',
    metadata: { excerpt: EXCERPT, quality: '🌱 Start' },
    content,
  }],
  'contents/tech/core-concepts',
  'Initial page. Majority Judgment as published by Balinski and Laraki, and as varied by the Radix DAO governance framework, which settles a grade at three-fifths of the voting power cast rather than at the median.',
);
