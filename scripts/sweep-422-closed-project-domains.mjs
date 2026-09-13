import pg from 'pg';
import { config } from 'dotenv';
import { cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const EXT = 'target="_blank" rel="noopener"';
const IDA = 'resource_rdx1thn35hp873d6mmev4a0g4z9all24lpmxgzjgjned5qadvhmjg605g6';

const edits = [
  {
    slug: 'xidar',
    expectVersion: '2.2.1',
    version: '2.3.0',
    changeType: 'minor',
    sentinel: 'xidar-domain-reregistered',
    message: 'Sweep 422: this page said on 30 July 2026 that xidar.io "has no DNS record at all" and warned an unregistered domain can be bought by anyone. It was: the registry\'s RDAP records a new Namecheap registration on 4 August 2026, and read on 13 September 2026 the domain 301s through chineseacupuncture.in and genericdawa.in to a Vietnamese-language slot-gambling affiliate page. Wayback shows xidar.io serving the project\'s own page to November 2024 and redirecting to my.xidar.io from December 2024; my.xidar.io has no DNS record. Added a section on the domain and the token, read at the Gateway at epoch 340,419: $IDA supply 239,160,000 (not the 240 million the page stated as fixed), minter DenyAll and locked, burner owner, 5,532 holders, largest account 86,805,514 IDA. Its info_url metadata is still https://xidar.io and unlocked, so anything that displays it points holders at the gambling page. None of the new domains is linked. Also cut two promotional claims ("industry-leading", Radix as "the only platform") down to what XIDAR said.',
    replacements: [
      {
        from: 'Radix was chosen by XIDAR due to its unique, comprehensive, integrated bottom-up technological approach. XIDAR viewed Radix as the only platform that can fully support its vision of Web3 DeFi and offers the ability to fully leverage a decentralized network that enables fast and secure development without sacrificing scalability or composability.</p>',
        to: 'XIDAR said it chose Radix because it saw it as the only network that could support its plans for DeFi without giving up scalability or composability.</p>',
      },
      {
        from: 'The XIDAR Wallet was an industry-leading browser and soon-to-be mobile wallet for the Radix network.',
        to: 'The XIDAR Wallet was a browser wallet for the Radix network, with a mobile version announced.',
      },
      {
        from: 'It had a fixed supply of 240 million tokens. The $IDA tokens would represent a vital utility asset within the XIDAR ecosystem and would continue to play a pivotal role in all its products and services. In particular, $IDA tokens would empower users with decision-making capabilities in XIDAR&#39;s upcoming investment DAO (Decentralized Autonomous Organization) and provide access to premium features within the XIDAR wallet. XIDAR planned to announce further benefits related to its upcoming no-code dApp creator.</p>',
        to: 'Its tokenomics allocated 240 million tokens; the ledger holds slightly fewer (see below). XIDAR said $IDA would give holders a vote in a planned investment DAO (Decentralized Autonomous Organization) and access to premium features in the wallet, and that further uses would follow with a no-code dApp creator.</p>',
      },
      {
        from: '<p><em>Website (30 July 2026): <code>xidar.io</code> has no DNS record at all. An unregistered domain can be bought by anyone – four defunct Radix projects&#39; domains have already been re-registered as unrelated landing pages – so the link has been removed from this page&#39;s facts table.</em></p>',
        to: '<h2>The Domain and the Token After the Project</h2>'
          + `<p id="xidar-domain-reregistered">The <a href="https://web.archive.org/web/20241113052046/https://xidar.io/" ${EXT}>Wayback Machine's November 2024 capture</a> of <code>xidar.io</code> is still the project's own page, "XIDAR – Your Gateway to Simplicity". <a href="https://web.archive.org/web/20241204225125/https://xidar.io/" ${EXT}>From December 2024</a> the address redirected to the app at <code>my.xidar.io</code>, which today has no DNS record.</p>`
          + `<p>On 30 July 2026 <code>xidar.io</code> had no DNS record either, and this page warned that an unregistered domain can be bought by anyone. Five days later someone bought it: the <a href="https://rdap.identitydigital.services/rdap/domain/xidar.io" ${EXT}>registry record</a> shows a new registration through Namecheap on 4 August 2026. Read on 13 September 2026, the domain redirects through two unrelated Indian domains to a Vietnamese-language online slot-gambling affiliate page. None of these addresses is linked from this wiki.</p>`
          + `<p>The token outlived both. <a href="https://dashboard.radixdlt.com/resource/${IDA}" ${EXT}>XIDAR</a> ($IDA), read at the <a href="https://radix-babylon-gateway-api.redoc.ly/" ${EXT}>Radix Gateway</a> on 13 September 2026 at epoch 340,419, has a supply of <strong>239,160,000 IDA</strong>, 840,000 fewer than the tokenomics above allocate. Its minter is set to <code>DenyAll</code> and locked, so no more can be created; the burn rule belongs to the token's owner. It has <strong>5,532</strong> holders, and the largest single account holds 86,805,514 IDA, about 36% of supply.</p>`
          + '<p>The token\'s own metadata still gives <code>https://xidar.io</code> as its <code>info_url</code> and a <code>my.xidar.io</code> address for its icon, and neither field is locked. Any wallet or explorer that shows a token\'s info URL shows this one, and it now leads to the gambling page. Because the fields are unlocked, whoever holds the role that sets the token\'s metadata could still change them.</p>',
      },
    ],
  },
  {
    slug: 'launchspace',
    expectVersion: '2.3.1',
    version: '3.0.0',
    changeType: 'major',
    sentinel: 'launchspace-offered',
    message: 'Sweep 422: the article restated the same three services (accelerator, blueprint marketplace, audit marketplace) five times under Mission, Features, Blueprint, Benefits and Security, and twice described Scrypto as "a technology that aims to enhance the security and accuracy of digital identities and transactions" and blueprints as building blocks "for secure and efficient digital identities and transactions". Scrypto is Radix\'s Rust smart-contract SDK and a blueprint is the template components are instantiated from. Condensed to one account of what Launchspace offered, linked to the Scrypto page. The website note also said launchspace.app has no DNS record; RDAP, read 13 September 2026, shows it still registered (24 February 2021 to 24 February 2033) and delegated to Cloudflare nameservers, with no address record, so nothing loads. beta.launchspace.app still has no record. The See also link is kept.',
    rewrite: {
      startsWith: '<p><strong>Launchspace</strong> was an accelerator for decentralized applications',
      text: '<p><strong>Launchspace</strong> was an accelerator for decentralized applications (dApps) built on Radix. It also ran a marketplace where developers could sell <a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a> blueprints and offer audits.</p>'
        + '<h2 id="launchspace-offered">What It Offered</h2>'
        + '<ul>'
        + '<li><strong>Accelerator.</strong> Mentorship, technical help and guidance for teams building and launching dApps on Radix, along with introductions to other builders and investors in the ecosystem.</li>'
        + '<li><strong>Blueprint marketplace.</strong> Developers could share and sell Scrypto blueprints, the templates that Radix components are instantiated from, so that other teams could start from existing code rather than from scratch.</li>'
        + '<li><strong>Audit marketplace.</strong> Developers could offer security audits of Radix dApps to the teams building them.</li>'
        + '</ul>'
        + `<p><em>Website (13 September 2026): <code>beta.launchspace.app</code> has no DNS record. <code>launchspace.app</code> is <a href="https://rdap.org/domain/launchspace.app" ${EXT}>still registered</a>, from 24 February 2021 until 2033, and points at Cloudflare nameservers, but it publishes no address, so nothing loads. The link stays out of this page's facts table.</em></p>`
        + '<h2>See also</h2><ul><li><a href="/ecosystem/caper" rel="noopener">Caper</a> – bonding-curve fundraising for DAO formation</li></ul>',
    },
  },
  {
    slug: 'arcane-labyrinth',
    expectVersion: '2.2.1',
    version: '2.2.2',
    changeType: 'patch',
    sentinel: 'Neither arcanelabyrinth.io nor',
    message: 'Sweep 422: the infobox gave the official reference as "arcanelabyrinth.io (offline)". Checked 13 September 2026, the domain is not registered (whois.nic.io: Domain not found), and neither is arcanelabyrinth.com (Verisign: No match), the site cleared from the facts table on 30 July. "Offline" undersold it: either name can be bought by anyone, so neither is named as the project\'s reference.',
    replacements: [
      {
        from: '<td>arcanelabyrinth.io (offline)</td>',
        to: '<td>None. Neither arcanelabyrinth.io nor arcanelabyrinth.com is registered (13 September 2026).</td>',
      },
    ],
  },
  {
    slug: 'nftwars',
    expectVersion: '2.2.0',
    version: '2.2.1',
    changeType: 'patch',
    dropMetadata: 'website',
    message: 'Sweep 422: metadata.website was still https://nftwars.app, which renders as a live-looking Website row in the facts table. The article itself says the domain is NXDOMAIN, and RDAP (13 September 2026) returns 404: it is unregistered and can be bought by anyone, which is how xidar.io became a gambling redirect five days after this wiki noted it had lapsed. Removed from metadata; the Wayback links in External Links are the record of the site. Found by the by-hand metadata URL probe, which scripts/check-links.mjs does not do.',
  },
];

if (JSON.stringify(edits).includes(' ')) throw new Error('script contains a literal U+00A0');

const textNodes = (blocks) => blocks.flatMap((b) => [...(typeof b.text === 'string' ? [b] : []), ...(b.blocks ? textNodes(b.blocks) : [])]);

try {
  for (const e of edits) {
    if (isLockedPage('ecosystem', e.slug)) throw new Error(`ecosystem/${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', ['ecosystem', e.slug]);
    if (!rows.length) throw new Error(`ecosystem/${e.slug} not found`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    const metadata = { ...page.metadata };
    const applied = e.dropMetadata ? !(e.dropMetadata in metadata) : JSON.stringify(blocks).includes(e.sentinel);
    if (applied) {
      console.log(`  ${e.slug}: already applied, no write`);
      continue;
    }
    if (page.version !== e.expectVersion) throw new Error(`${e.slug}: expected v${e.expectVersion}, found v${page.version}`);

    for (const r of e.replacements ?? []) {
      let hits = 0;
      for (const n of textNodes(blocks)) {
        const count = n.text.split(r.from).length - 1;
        if (!count) continue;
        n.text = n.text.split(r.from).join(r.to);
        hits += count;
      }
      if (hits !== 1) throw new Error(`${e.slug}: expected 1 match for "${r.from.slice(0, 60)}", found ${hits}`);
    }
    if (e.rewrite) {
      const targets = textNodes(blocks).filter((n) => n.text.startsWith(e.rewrite.startsWith));
      if (targets.length !== 1) throw new Error(`${e.slug}: expected 1 block to rewrite, found ${targets.length}`);
      targets[0].text = e.rewrite.text;
    }
    if (e.dropMetadata) delete metadata[e.dropMetadata];

    console.log(`  ${DRY ? '[dry] ' : ''}ecosystem/${e.slug}  v${page.version} -> v${e.version}  (${e.changeType})`);
    if (DRY) continue;

    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, metadata=$2, version=$3, updated_at=$4 WHERE id=$5',
      [json, JSON.stringify(metadata), e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, e.changeType, AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
  }
} finally {
  client.release();
  await pool.end();
}
