/**
 * sweep 483 - developers rotation. The Radix Desktop Tool's repository is gone.
 *
 * github.com/atlantis-l/Radix-Desktop-Tool passed the developers link audit of
 * run 466 (21 September) and answered 404 in the history audit of run 475
 * (23 September), which repointed only the hackathon page's citation. Read
 * 25 September 2026: the repo URL 404s, api.github.com/repos/... 404s, and the
 * atlantis-l account holds one unrelated repository from 2022
 * (pancakeswap-prediction-bot-improved). The tool's own page still said "the
 * code still works against the current network" and linked the dead repo, as
 * did the /developers hub.
 *
 * Copies of the source survive:
 *   - Wayback capture 20240603055101 of the repo page (200, 331 KB, read today;
 *     the same capture run 475 used);
 *   - github.com/ziyeziye/Radix-Desktop-Tool, a re-upload (fork: false) whose
 *     commit history ends on atlantis-l's commits of 5 April 2024 ("version",
 *     "optimize"). A second copy, noriki0202/Radix-Desktop-Tool, carries the
 *     same commits re-authored as "Eirik" and is not cited.
 *
 * Status moves Dormant -> Closed: the author withdrew the source, so there is
 * no maintained distribution left.
 *
 * Idempotent: each page is skipped if its sentinel is already stored.
 */
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage, assertLinkShapes, withClient } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const DEAD = 'https://github.com/atlantis-l/Radix-Desktop-Tool';
const WAYBACK = 'https://web.archive.org/web/20240603055101/https://github.com/atlantis-l/Radix-Desktop-Tool';
const MIRROR = 'https://github.com/ziyeziye/Radix-Desktop-Tool';

const STATUS_HTML = `<h2>Status</h2>
<p>The author deleted the repository in September 2026. It was online on 21 September and answered 404 on 23 September; the <a href="https://api.github.com/repos/atlantis-l/Radix-Desktop-Tool" target="_blank" rel="noopener">GitHub API</a> reports it gone, and the <a href="https://github.com/atlantis-l" target="_blank" rel="noopener">atlantis-l account</a> now holds one unrelated repository from 2022 (read 25 September 2026). The last release, v0.2.4, and the last commit both date from April 2024.</p>
<p>The source survives in copies. The <a href="${WAYBACK}" target="_blank" rel="noopener">Wayback Machine capture of 3 June 2024</a> preserves the repository page, and <a href="${MIRROR}" target="_blank" rel="noopener">ziyeziye/Radix-Desktop-Tool</a> is a re-upload whose history ends on the author's commits of 5 April 2024. The author maintains neither. The airdrop feature takes a private key, so read a copy in full before running it, try it on <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> first, and fund a throwaway account rather than a main one.</p>`;

const LINKS_HTML = `<h2>External Links</h2>
<ul>
<li><a href="${WAYBACK}" target="_blank" rel="noopener">Radix Desktop Tool on GitHub</a> – Wayback Machine capture of 3 June 2024; the original repository was deleted in September 2026</li>
<li><a href="${MIRROR}" target="_blank" rel="noopener">ziyeziye/Radix-Desktop-Tool</a> – a third-party copy of the source (MIT), not maintained by the author</li>
<li><a href="/developers" rel="noopener">Building on Radix</a> – the wider community tooling index</li>
</ul>`;

const PAGES = [
  {
    tagPath: 'developers/tools',
    slug: 'radix-desktop-tool',
    version: '3.2.0',
    changeType: 'minor',
    verify: true,
    sentinel: 'The author deleted the repository in September 2026',
    mutate(blocks, metadata) {
      const status = blocks.find((b) => (b.text || '').startsWith('<h2>Status</h2>'));
      const links = blocks.find((b) => (b.text || '').startsWith('<h2>External Links</h2>'));
      if (!status || !links) throw new Error('Status or External Links block missing');
      if (!status.text.includes('The project is not archived')) throw new Error('Status block is not the expected text');
      status.text = STATUS_HTML;
      links.text = LINKS_HTML;
      if (metadata.github !== DEAD) throw new Error(`metadata.github is ${metadata.github}`);
      return { ...metadata, github: WAYBACK, status: '🔴 Closed' };
    },
    message:
      'The source repository github.com/atlantis-l/Radix-Desktop-Tool was deleted between 21 and 23 September 2026 (404; ' +
      'the GitHub API reports it gone; the account holds one unrelated 2022 repository, read 25 September 2026). Status ' +
      'Dormant -> Closed; the Status section no longer says the code is available and names the surviving copies (Wayback ' +
      'capture of 3 June 2024, ziyeziye/Radix-Desktop-Tool re-upload ending on the author\'s 5 April 2024 commits) with the ' +
      'private-key caution; External Links and metadata.github repointed. wiki-sweep run 483.',
  },
  {
    tagPath: 'developers',
    slug: '',
    version: null, // patch bump of whatever is stored
    changeType: 'patch',
    verify: false,
    sentinel: 'repository deleted September 2026',
    mutate(blocks, metadata) {
      const from = `(<a target="_blank" rel="noopener noreferrer" class="link" href="${DEAD}">GitHub</a>) &ndash; open-source MIT desktop utility`;
      const to = `(<a target="_blank" rel="noopener noreferrer" class="link" href="${WAYBACK}">archived</a>, repository deleted September 2026) &ndash; open-source MIT desktop utility`;
      const hits = blocks.filter((b) => (b.text || '').includes(from));
      if (hits.length !== 1) throw new Error(`hub: expected 1 block holding the link, found ${hits.length}`);
      hits[0].text = hits[0].text.split(from).join(to);
      return metadata;
    },
    message:
      'Radix Desktop Tool entry: the GitHub link pointed at a repository deleted in September 2026; repointed to the ' +
      'Wayback capture of 3 June 2024 and marked deleted. wiki-sweep run 483.',
  },
];

const bumpPatch = (v) => v.split('.').map((n, i) => (i === 2 ? Number(n) + 1 : n)).join('.');

await withClient(async (client) => {
  for (const p of PAGES) {
    if (isLockedPage(p.tagPath, p.slug)) throw new Error(`${p.tagPath}/${p.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2',
      [p.tagPath, p.slug],
    );
    if (!rows.length) throw new Error(`${p.tagPath}/${p.slug} not found`);
    const page = rows[0];
    if (JSON.stringify(page.content).includes(p.sentinel)) {
      console.log(`  ${page.title}: already applied - no write`);
      continue;
    }
    const blocks = JSON.parse(JSON.stringify(page.content));
    const metadata = p.mutate(blocks, JSON.parse(JSON.stringify(page.metadata || {})));
    assertLinkShapes(blocks, page.title);
    if (JSON.stringify(blocks).includes(`"${DEAD}"`) || JSON.stringify(blocks).includes(`href=\\"${DEAD}\\"`)) {
      throw new Error(`${page.title}: dead repo link still present`);
    }
    const version = p.version ?? bumpPatch(page.version);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
    if (DRY) continue;
    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      p.verify
        ? 'UPDATE pages SET content = $1, version = $2, updated_at = $3, last_verified_at = $3, metadata = $5 WHERE id = $4'
        : 'UPDATE pages SET content = $1, version = $2, updated_at = $3, metadata = $5 WHERE id = $4',
      [json, version, now, page.id, JSON.stringify(metadata)],
    );
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, p.changeType, AUTHOR_ID, p.message, now],
    );
    await client.query('COMMIT');
  }
});
