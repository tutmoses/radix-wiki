// Run 571 (contents/history rotation), 11 Oct 2026. Flexathon: the closing section no
// longer dates Xi'an to 2027 as a live schedule (the hub's run-559 wording: the
// 30 Nov 2024 Radix Labs roadmap, no current date), and its em dashes become spaced en
// dashes. Austin Developer Event: placed after the Alexandria Preview Event, which it
// never linked, and its organiser links to the RDX Works page.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const ROADMAP = 'https://www.radixdlt.com/blog/radix-labs-roadmap---to-hyperscale-and-beyond';

const EDITS = [
  {
    slug: 'flexathon',
    sentinel: 'Radix Labs roadmap of 30 November 2024',
    change: 'minor',
    message: 'Run 571: the closing section no longer gives Xi\'an a 2027 date as a live schedule; it names the 30 November 2024 Radix Labs roadmap that set the date and says no current date is published, matching the History hub. Em dashes replaced with spaced en dashes. GitHub repository list re-read (Hyperscale, Milagro fork) and unchanged.',
    swaps: [
      [
        'Multiple shard groups are scheduled for <a rel="noopener" class="link" href="/contents/tech/releases/radix-mainnet-xian">Xi’an</a>, dated 2027, and the sharded execution work',
        `Multiple shard groups were the aim of <a rel="noopener" class="link" href="/contents/tech/releases/radix-mainnet-xian">Xi’an</a>, which the <a target="_blank" rel="noopener noreferrer" href="${ROADMAP}">Radix Labs roadmap of 30 November 2024</a> put in the second half of 2027 and which has no current published date, and the sharded execution work`,
      ],
    ],
    dashes: true,
  },
  {
    slug: 'austin-developer-event',
    sentinel: 'href="/contents/history/alexandria-preview-event"',
    change: 'patch',
    message: 'Run 571: placed as the third in-person Radix developer event, after the Alexandria Preview Event (New York, 12 Nov 2021) and Lisbon, with a link to the APE page; infobox organiser links to /ecosystem/rdx-works.',
    swaps: [
      ['<th>Organizer</th><td>RDX Works</td>', '<th>Organizer</th><td><a href="/ecosystem/rdx-works" rel="noopener">RDX Works</a></td>'],
      [
        'Austin was the second and last of the 2022 conference-adjacent developer days.',
        'Austin was the second and last of the 2022 conference-adjacent developer days, and the third in-person Radix developer event, after Lisbon and the <a href="/contents/history/alexandria-preview-event" rel="noopener">Alexandria Preview Event</a> in New York on 12 November 2021, where Scrypto was first released.',
      ],
    ],
  },
];

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage('contents/history', e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', ['contents/history', e.slug]);
    if (!rows.length) throw new Error(`${e.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(e.sentinel)) {
      console.log(`  ${e.slug}: already applied – no write`);
      continue;
    }
    let json = JSON.stringify(page.content);
    for (const [from, to] of e.swaps) {
      const f = JSON.stringify(from).slice(1, -1);
      if (!json.includes(f)) throw new Error(`${e.slug}: not found: ${from.slice(0, 80)}`);
      json = json.replace(f, JSON.stringify(to).slice(1, -1));
    }
    if (e.dashes) json = json.replaceAll(' \u2014 ', ' – ').replaceAll('\u2014', ' – ');
    if (json.includes('\u2014')) throw new Error(`${e.slug}: em dash survives`);
    const blocks = JSON.parse(json);
    const version = await writeRevision(client, page, blocks,
      { change: e.change, message: e.message, verified: true, dry: DRY });
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  }
});
