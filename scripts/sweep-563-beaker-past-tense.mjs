// Sweep 563: /ecosystem/beaker is Closed, but its infobox Status row still read "Minimal version running on
// Radix Betanet 2" and its Features section "At the moment, Beaker was running ... Beaker currently used".
// The Wayback Machine dates the end: the beaker.fi app is last captured 25 Sep 2023, three days before
// Babylon mainnet, and by 21 Jun 2024 the domain served an unrelated French tournament site (N_0VERTIME).
// The Further Reading link is the team's own arXiv paper, so it gets its title and authors (arXiv
// 2301.08558, Conrad, Vinciguerra, Méroué, 20 Jan 2023) and the team list cites it.
import { isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'beaker';
const SENTINEL = 'beaker-wound-down';
const PAPER = 'https://arxiv.org/abs/2301.08558';
const LAST_APP = 'https://web.archive.org/web/20230925221846/https://beaker.fi/';
const REUSED = 'https://web.archive.org/web/20240621225610/https://beaker.fi/';
const DOCS = 'https://web.archive.org/web/20230121161314/https://docs.beaker.fi/';

const EDITS = [
  [`<td>Minimal version running on Radix Betanet 2</td>`,
   `<td>Closed. A minimal version ran on Radix Betanet 2; the app is <a href="${LAST_APP}" target="_blank" rel="noopener">last captured on 25 September 2023</a></td>`],
  [`<td>No token planned; the team is opposed to issuing speculative "DAO tokens"</td>`,
   `<td>None; the team opposed issuing speculative "DAO tokens"</td>`],
  [`<p>At the moment, Beaker was running a minimal version on the Radix Betanet 2. These features included swapping and providing liquidity. Beaker currently used a Uniswap v2 AMM model where fees were not automatically compounded.`,
   `<p>Beaker ran a minimal version on Radix Betanet 2, which supported swapping and providing liquidity. It used a Uniswap v2 AMM model in which fees were not automatically compounded, a choice the team argued for in <a href="${PAPER}" target="_blank" rel="noopener">its own paper</a>: the protocol is safer and more profitable when nobody recompounds fees.`],
  [`<p>At the moment, Beaker did not plan to emit a token. They were very sceptical about the real utility of &quot;DAO tokens&quot; and believed that they are mainly speculative assets that some projects use to make a profit.`,
   `<p>Beaker did not plan to issue a token. The team was sceptical of the real utility of &quot;DAO tokens&quot; and saw them mainly as speculative assets that some projects use to make a profit.`],
  [`<p>The team behind Beaker consisted of three master&#39;s degree students from <a href="https://www.ens-lyon.fr">Ecole Normale Superieure de Lyon</a>.</p>`,
   `<p>The team behind Beaker consisted of three master&#39;s degree students from <a href="https://www.ens-lyon.fr" target="_blank" rel="noopener">École Normale Supérieure de Lyon</a>, who are the authors of <a href="${PAPER}" target="_blank" rel="noopener">its arXiv paper</a>.</p>`],
  [`<a href="${DOCS}"><strong>official Beaker documentation</strong></a>`,
   `<a href="${DOCS}" target="_blank" rel="noopener"><strong>archived Beaker documentation</strong></a>`],
  [/<p><em>Website \(30 July 2026\):[\s\S]*?<\/em><\/p><h2>Further Reading<\/h2>\s*<p><a href="https:\/\/arxiv\.org\/pdf\/2301\.08558\.pdf">https:\/\/arxiv\.org\/pdf\/2301\.08558\.pdf<\/a><\/p>/,
   `<h2 id="${SENTINEL}">End of the project</h2>
<p>The Wayback Machine last captures the Beaker app at beaker.fi on <a href="${LAST_APP}" target="_blank" rel="noopener">25 September 2023</a>, three days before the <a href="/contents/tech/releases/radix-mainnet-babylon">Babylon mainnet</a> release. No closing announcement has been found. By <a href="${REUSED}" target="_blank" rel="noopener">21 June 2024</a> the domain served an unrelated French tournament site, and on 30 July 2026 <code>beaker.fi</code> had no DNS record at all, so the website link has been removed from the facts table.</p>
<h2>Further Reading</h2>
<ul><li>Théodore Conrad, Arthur Vinciguerra and Guillaume Méroué, <a href="${PAPER}" target="_blank" rel="noopener"><em>About constant-product automated market makers</em></a>, arXiv:2301.08558, 20 January 2023.</li></ul>`],
];

const swap = (b, from, to) => {
  let n = 0;
  const hit = typeof from === 'string' ? b.text?.includes(from) : from.test(b.text ?? '');
  if (hit) { b.text = b.text.replace(from, to); n++; }
  for (const c of b.blocks ?? []) n += swap(c, from, to);
  return n;
};

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied – no write'); return; }
  for (const [from, to] of EDITS) {
    const n = blocks.reduce((s, b) => s + swap(b, from, to), 0);
    if (n !== 1) throw new Error(`edit matched ${n} times: ${String(from).slice(0, 60)}`);
  }
  if (/At the moment|currently used|running on Radix Betanet/.test(JSON.stringify(blocks))) throw new Error('present tense still present');
  const version = await writeRevision(client, page, blocks, {
    change: 'minor',
    message: 'Closed project written in the past tense: infobox Status no longer says a version is running on Betanet 2, and Features/Tokenomics drop "at the moment" and "currently". New End of the project section dates the end from the Wayback Machine (app last captured 25 Sep 2023, domain reused by an unrelated site by 21 Jun 2024). Further Reading names the team\'s arXiv paper 2301.08558, now also cited for the fee-compounding design and the team.',
    verified: true, dry: DRY,
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
