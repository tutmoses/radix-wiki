// Sweep 554 (ecosystem rotation, staleness head): give Launchspace an infobox and a
// sourced account of its Babylon beta, read from the Internet Archive's copy of
// beta.launchspace.app (24 May 2024) and the project's GitHub account.
import { uid, isLockedPage, withClient, writeRevision } from './seed-utils.mjs';

const DRY = process.argv.includes('--dry-run');
const TAG_PATH = 'ecosystem';
const SLUG = 'launchspace';
const SENTINEL = 'id="launchspace-babylon-beta"';

const WB = 'https://web.archive.org/web/20240524184414/https://beta.launchspace.app/';
const BUNDLE = 'https://web.archive.org/web/20240524194158id_/https://beta.launchspace.app/static/js/main.24828c82.js';

const infobox = {
  id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text:
    '<table><tbody><tr><th colspan="2">Launchspace</th></tr>' +
    '<tr><td><strong>Type</strong></td><td>dApp accelerator with blueprint and audit marketplaces</td></tr>' +
    '<tr><td><strong>Status</strong></td><td>🔴 Closed – no site resolves (read 8 October 2026)</td></tr>' +
    '<tr><td><strong>Domain registered</strong></td><td><a href="https://rdap.org/domain/launchspace.app" target="_blank" rel="noopener">24 February 2021</a></td></tr>' +
    `<tr><td><strong>Last archived app</strong></td><td><a href="${WB}" target="_blank" rel="noopener">beta.launchspace.app, 24 May 2024</a></td></tr>` +
    '<tr><td><strong>GitHub</strong></td><td><a href="https://github.com/launchspace" target="_blank" rel="noopener">launchspace</a></td></tr>' +
    '</tbody></table>' }],
};

const beta = {
  id: uid(), type: 'content', text:
    '<h2 id="launchspace-babylon-beta">The Babylon beta</h2>' +
    `<p>The last working version of Launchspace on record is the beta app at <code>beta.launchspace.app</code>, which the <a href="${WB}" target="_blank" rel="noopener">Internet Archive captured on 24 May 2024</a>, eight months after the Babylon upgrade. Its page title read "Launchspace - Accelerator for dApps", and the project's <a href="https://github.com/launchspace" target="_blank" rel="noopener">GitHub account</a>, opened on 25 February 2021, still describes it as an "Accelerator for Radix dApps" and links the beta as its website.</p>` +
    `<p>The <a href="${BUNDLE}" target="_blank" rel="noopener">archived application bundle</a> shows how the beta was organised. Members published projects and apps, and contributors were tagged by role: blueprint, audit, frontend, backend, devops, design, product, community, growth, legal and admin. The blueprint and audit roles are the two marketplaces described above; the audit section is labelled "Audits for Scrypto Blueprints". The bundle carries the Radix dApp Toolkit configuration for mainnet and the test networks, and the only dApp definition address in it is a Stokenet account, so the beta as captured was connected to Radix's test network rather than to mainnet. It also offered sign-in with GitHub and called an API at <code>api.launchspace.app</code>, which no longer resolves.</p>` +
    '<p>The trail ends there. The GitHub account holds one repository, <a href="https://github.com/launchspace/issues" target="_blank" rel="noopener">an issue tracker</a> created and last pushed on 1 January 2024, with no issues filed. The Internet Archive holds no capture of the beta after May 2024.</p>',
};

await withClient(async (client) => {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];
  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) { console.log('  already applied, no write'); return; }
  if (blocks.some((b) => b.type === 'infobox')) throw new Error('page already has an infobox');

  const main = blocks.find((b) => b.text?.includes('<h2 id="launchspace-offered">'));
  if (!main) throw new Error('main block not found');
  const OLD_NOTE = /<p><em>Website \(13 September 2026\):[\s\S]*?<\/em><\/p>/;
  if (!OLD_NOTE.test(main.text)) throw new Error('website note not found');
  main.text = main.text.replace(OLD_NOTE,
    '<p><em>Website (8 October 2026): neither <code>launchspace.app</code> nor <code>beta.launchspace.app</code> resolves to an address. The domain is <a href="https://rdap.org/domain/launchspace.app" target="_blank" rel="noopener">still registered</a>, until 2033, on Cloudflare nameservers.</em></p>');

  const out = [infobox, ...blocks];
  out.splice(out.indexOf(main) + 1, 0, beta);

  const version = await writeRevision(client, page, out, {
    change: 'minor', verified: true, dry: DRY,
    message: 'Add an infobox and a sourced section on the Babylon beta, read from the Internet Archive capture of beta.launchspace.app (24 May 2024) and github.com/launchspace; website note re-read 8 Oct 2026 (sweep 554).',
  });
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
});
