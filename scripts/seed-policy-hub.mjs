// scripts/seed-policy-hub.mjs — the /policy category's own article (hub at the empty slug).
//
// Run 377 (policy rotation). /policy had no hub article, so the category page's
// meta description came from the `policy` node in src/lib/tags.ts, which names
// FIVE policies against the seven the category actually holds (the run-309
// finding). generateMetadata prefers a hub article's metadata.excerpt over the
// node description, so the hub fixes that in content rather than in code.
import { uid, insertPages } from './seed-utils.mjs';

const EXCERPT =
  'Seven standards behind every article: verifiability, neutral point of view, no original research, notability, conflict of interest, freshness, editorial notices';

const infobox = {
  id: uid(),
  type: 'infobox',
  blocks: [{
    id: uid(),
    type: 'content',
    text:
      '<table><tbody>' +
      '<tr><td><strong>Category</strong></td><td>Policy</td></tr>' +
      '<tr><td><strong>Policies</strong></td><td>Seven</td></tr>' +
      '<tr><td><strong>Core</strong></td><td><a href="/policy/verifiability" class="link">Verifiability</a>, <a href="/policy/neutral-point-of-view" class="link">NPOV</a>, <a href="/policy/no-original-research" class="link">No original research</a></td></tr>' +
      '<tr><td><strong>Applies to</strong></td><td>Every article on RADIX Wiki</td></tr>' +
      '<tr><td><strong>Enforced by</strong></td><td><a href="/policy/editorial-notices" class="link">Editorial notices</a> and the rotating maintenance sweep</td></tr>' +
      '<tr><td><strong>First adopted</strong></td><td>31 July 2026</td></tr>' +
      '<tr><td><strong>Log</strong></td><td><a href="/contents/tech/operations/wiki-maintenance-log" class="link">Wiki Maintenance Log</a></td></tr>' +
      '</tbody></table>',
  }],
};

const content = [
  infobox,
  {
    id: uid(),
    type: 'content',
    text:
      '<p><strong>RADIX Wiki editorial policy</strong> is the set of standards every article on this wiki is held to. There are seven of them, and they were adopted in two waves: five on 31 July 2026, ' +
      '<a href="/policy/conflict-of-interest" class="link">conflict of interest</a> shortly after, and <a href="/policy/editorial-notices" class="link">editorial notices</a> on 26 August 2026.</p>' +
      '<p>The policies are not a style guide. Each one answers a different question about a page, and each names what happens when a page fails it. Three are content policies in the sense that they govern what an article may say; ' +
      'one decides whether an article should exist at all; one is about the contributor rather than the page; and one describes the machinery the other six use to flag their own failures.</p>',
  },
  {
    id: uid(),
    type: 'content',
    text:
      '<h2 id="the-seven-policies">The seven policies</h2>' +
      '<table><thead><tr><th>Policy</th><th>Type</th><th>The question it answers</th><th>Enforcement</th></tr></thead><tbody>' +
      '<tr><td><a href="/policy/verifiability" class="link">Verifiability</a></td><td>Sourcing (core)</td><td>Can a reader check this claim against a published source?</td><td><em>[citation needed]</em> tags; <em>Needs citations</em> notice</td></tr>' +
      '<tr><td><a href="/policy/neutral-point-of-view" class="link">Neutral point of view</a></td><td>Content (core)</td><td>Is the subject represented fairly and without editorial bias?</td><td><em>Written like an advertisement</em> notice; attribution</td></tr>' +
      '<tr><td><a href="/policy/no-original-research" class="link">No original research</a></td><td>Content (core)</td><td>Has anyone but this wiki said it?</td><td>Moved to <a href="/blog" class="link">Blog</a> or <a href="/ideas" class="link">Ideas</a>; sourcing</td></tr>' +
      '<tr><td><a href="/policy/notability" class="link">Notability</a></td><td>Inclusion</td><td>Does this subject merit its own article?</td><td>Merge into a broader page; <em>Stub</em> notice</td></tr>' +
      '<tr><td><a href="/policy/conflict-of-interest" class="link">Conflict of interest</a></td><td>Conduct</td><td>Does the contributor have a stake in the subject?</td><td><em>Conflict of interest</em> notice; attribution; sourcing</td></tr>' +
      '<tr><td><a href="/policy/freshness" class="link">Freshness</a></td><td>Sourcing (Radix-specific)</td><td>Was this checked recently enough to still be true?</td><td>Automatic <em>May be outdated</em> notice; <em>Last Verified</em> stamp</td></tr>' +
      '<tr><td><a href="/policy/editorial-notices" class="link">Editorial notices</a></td><td>Editorial process</td><td>How does the wiki say out loud that a page needs work?</td><td>Notice blocks and derived tracking categories</td></tr>' +
      '</tbody></table>',
  },
  {
    id: uid(),
    type: 'content',
    text:
      '<h2 id="how-they-fit-together">How they fit together</h2>' +
      '<p>Verifiability is the first standard, and two of the others are derived from it rather than independent of it. ' +
      '<a href="/policy/no-original-research" class="link">No original research</a> is verifiability applied to interpretation: an inference this wiki draws from on-chain data is not verifiable however sound it is, because there is nothing published to check it against. ' +
      '<a href="/policy/freshness" class="link">Freshness</a> is verifiability applied to time: a claim correctly sourced a year ago can be false today, which is why every factual page carries a <em>Last Verified</em> date and is treated as stale 180 days after it.<sup class="cite"><a href="#ref-1">[1]</a></sup></p>' +
      '<p><a href="/policy/conflict-of-interest" class="link">Conflict of interest</a> is derived from <a href="/policy/neutral-point-of-view" class="link">neutral point of view</a> in the same way, but it is a fact about a contributor rather than about a page. A conflict is not misconduct and is not a reason to keep someone out; it is a reason to disclose, to source harder, and to let someone else make the contested call.</p>' +
      '<p><a href="/policy/notability" class="link">Notability</a> is the only one of the seven that is asked before a page exists, and it is the only one whose answer can be <em>not yet</em>. The rest are asked of a page that is already here.</p>',
  },
  {
    id: uid(),
    type: 'content',
    text:
      '<h2 id="enforcement">What enforcement actually looks like</h2>' +
      '<p>Five of the six content and conduct policies name a notice as their enforcement, and <a href="/policy/editorial-notices" class="link">editorial notices</a> is the page that describes what those notices are. Two kinds exist and they behave differently. ' +
      'A notice an editor places sits on one article and stays until an editor removes it. A tracking category is derived by the site from the page itself, is never stored on the page, and cannot be dismissed by editing: it clears when the underlying condition clears.</p>' +
      '<p>The <em>May be outdated</em> notice is the clearest case. It is generated at render time from the page&rsquo;s own dates, so the only thing that clears it is a fresh verification, and the only thing on this wiki that can record one is the rotating maintenance sweep. ' +
      'Which pages currently carry which notice, and what the sweep has done about them, is public in the <a href="/contents/tech/operations/wiki-maintenance-log" class="link">Wiki Maintenance Log</a>.</p>',
  },
  {
    id: uid(),
    type: 'content',
    text:
      '<h2 id="see-also">See also</h2>' +
      '<ul>' +
      '<li><a href="/contents/tech/operations/wiki-maintenance-log" class="link">Wiki Maintenance Log</a>, the running record of what the maintenance sweep found and changed</li>' +
      '<li><a href="/contents/resources/legal/terms-of-use" class="link">Terms of Use</a></li>' +
      '<li><a href="/maintenance" class="link">Maintenance</a>, the derived tracking categories</li>' +
      '</ul>' +
      '<h2 id="external-links">External links</h2>' +
      '<ul>' +
      '<li><a href="https://en.wikipedia.org/wiki/Wikipedia:Core_content_policies" target="_blank" rel="noopener">Wikipedia: Core content policies</a>, the three-policy model these seven extend</li>' +
      '</ul>',
  },
  {
    id: uid(),
    type: 'references',
    title: 'References',
    items: [
      { id: uid(), url: 'https://en.wikipedia.org/wiki/Wikipedia:Core_content_policies', text: 'Wikipedia &ndash; <em>Wikipedia:Core content policies</em>' },
    ],
  },
];

console.log(`excerpt length: ${EXCERPT.length}`);

await insertPages(
  [{ tagPath: 'policy', slug: '', title: 'RADIX Wiki Editorial Policy', metadata: { excerpt: EXCERPT, quality: '🥈 B-class' }, content }],
  'policy',
  'Hub article for the Policy category: the seven editorial policies, what each one decides, and how they are enforced. Written because /policy had no article of its own and the category description named only five of them.',
);
