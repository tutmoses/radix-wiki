// sweep 434 – ecosystem rotation, the two stalest unlocked pages after run 432 (radixcharts, quackspace),
// plus the status index entry the second one moves. Ledger figures from the Radix Gateway at epoch
// 341,043 (state version 558,278,857, 11:07 UTC 15 September 2026).
//
// 1. /ecosystem/radixcharts (v3.0.0, 8 August). The August section said the validator was left running
//    by an operator whose purpose had ended. The ledger says the node changed hands in March:
//    - 24 Mar 13:44 UTC, txid_rdx1yaus8y5h...: owner badge [830c67cb...] withdrawn from
//      account_rdx16y5aujpf... and deposited to account_rdx12xt5wjz7..., whose first transaction was
//      12:16 UTC that day. /state/non-fungible/location still puts the badge there.
//    - 25 Mar 20:40 UTC, txid_rdx1lkc59sr4...: SET_METADATA with key "Radix Charts Validator node - now
//      maintained by Cronos" and value "<METADATA_VALIDATOR_DESCRIPTION>", and key "Radix Charts V2" with
//      value "<METADATA_VALIDATOR_NAME>". Both entries are still on the validator; `description` is
//      unchanged since state version 65,515,659.
//    - 27 Mar 15:25 UTC, txid_rdx1lhyn2a4f...: update_key 030b73ef... -> 03960b23..., name = Radix Charts V2.
//    - A separate validator named Cronos (validator_rdx1sdwqm6vs...) was created 22 Mar 14:01 UTC by
//      account_rdx12xknv0yp..., a different account; it holds 7.89 XRD, rank 121 of 186 registered.
//    Stake 23,658,628.66 XRD, rank 46 of 186 registered (27,229,258, rank 44, on 8 August); fee 0.025,
//    no change request. Uptime: 15-30 Aug made 43,321 missed 122. From the restart (11:30 UTC 11 Sept)
//    made 904 missed 2,248; from 10:00 UTC 14 Sept made 899 missed 3; from 08:00 made 907 missed 67.
//    So 5 made / 2,245 missed before it came back between 08:00 and 10:00 UTC on 14 September.
//    radixcharts.com still serves the closure notice (200, 3,316 B). The Crew Labs bullet cited
//    radixcharts.com, which says nothing about Crew Labs, and is removed.
// 2. /ecosystem/quackspace (v8.2.3, 13 August). The body was the project's pitch essay ("5 Ways ...").
//    Read 15 September: quack.space 200, a Bluesky client ("A Radix-first gateway into Bluesky") with
//    feed, profile, app passwords, Tip Cart building a Radix manifest, login by wallet + XRD domain.
//    dApp definition account_rdx12ylx0vtj... name Quack Space, description "The exclusive Bluesky server
//    for .xrd domain owners.", claimed_websites quack.space, www.quack.space, swap.quack.space
//    (NXDOMAIN); last transaction 13 May 2026. pds.quack.space resolves (34.169.126.248) and timed out
//    on 443 and 80 at 11:08, 11:12 and 11:16 UTC. Account quackspace.pds.quack.space (did:plc:bt3uqp...)
//    created 14 Jan 2026, 255 posts, 15 followers, last post 30 April 2026; bsky.network getRepoStatus
//    active, rev 3mkqjky5qjs2f (the 30 April post). t.me/QuackSpace 33 members. Status Active -> Dormant.
// 3. /contents/resources/radix-ecosystem-operational-status (v1.21.0): Quack Space moves from
//    Operational / Media to Dormant / Media; counts 59 -> 58 and 48 -> 49 in the headings and infobox.
//
// Run:  node scripts/sweep-434-radixcharts-handover-quackspace.mjs [--dry-run]

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config({ quiet: true });

const DRY = process.argv.includes('--dry-run');
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const L = (href, text) => `<a href="${href}" rel="noopener">${text}</a>`;

const GATEWAY = 'https://docs.radixdlt.com/docs/network-gateway';
const DASH = 'https://dashboard.radixdlt.com';
const DRAIN = '/contents/history/hyperlane-asset-drain-2026';
const STAKING = '/contents/tech/core-concepts/staking';
const RC_VAL = `${DASH}/network-staking/validator_rdx1svxx0jetjwnptndj60sm8h7ljs0v88fl6xhwcyp6ar397agwd0ezaz`;
const RC_BADGE_TX = `${DASH}/transaction/txid_rdx1yaus8y5hs3h3fhxvh6jdkrturg6r83durrr4swu4xetwtpkjldfsqm47dp`;
const RC_META_TX = `${DASH}/transaction/txid_rdx1lkc59sr4tx0tjxw7c2vgjln4qr3m9uhpv3h8ywtdww6fh0z5hk7qpn2mju`;
const RC_KEY_TX = `${DASH}/transaction/txid_rdx1lhyn2a4f0vq4kfrckw0vlg7aq04p8uangmvtwgm02ppgr5ug5vxqy64085`;
const CRONOS_VAL = `${DASH}/network-staking/validator_rdx1sdwqm6vs59vxpcf65s3zg0p23q9u0krj8mshutm2me5snt83vd9030`;
const QS_DAPP = `${DASH}/account/account_rdx12ylx0vtjhuv2hng373a445mjvxjwcy8jf49pr755r5es0nv3nv6vr7`;
const QS_BSKY = 'https://bsky.app/profile/quackspace.pds.quack.space';
const QS_LAST_POST = `${QS_BSKY}/post/3mkqjky54ys2f`;
const ATPROTO = 'https://atproto.com/guides/overview';

const EDITS = [
  {
    tagPath: 'ecosystem', slug: 'radixcharts', version: '4.0.0', changeType: 'major', verified: true,
    sentinel: '<h2>Validator under a new owner</h2>',
    message: 'The validator changed hands in March 2026, which the August section missed: the owner badge moved to a new account on 24 March, which replaced the node key on 27 March and on 25 March wrote a "now maintained by Cronos" description as a metadata key with a template placeholder as its value, leaving the description wallets read unchanged. The node made 5 proposals and missed 2,245 between the 11 September restart and 14 September. Stake 23.7m XRD, rank 46 of 186, read at epoch 341,043. Status note rewritten, intro past-tensed, an uncited Crew Labs partnership removed.',
    apply(blocks) {
      const note = blocks.find((b) => b.id === '7a61d012-e343-4783-9c1c-e68520b87936');
      if (!note) throw new Error('radixcharts status note missing');
      note.text = [
        `<h2>Status</h2>`,
        `<p>RadixCharts has closed. ${A('https://radixcharts.com/', 'radixcharts.com')} serves a single notice saying its "data analytics service for RadixDLT is no longer available", with one link, to the ${A('https://www.radixdlt.com/ecosystem-directory', 'Radix ecosystem directory')}. The documentation site, docs.radixcharts.com, no longer resolves, so the feature descriptions below cite archived copies. The validator the project ran is still in the active set under a new owner; <em>Validator under a new owner</em> below records the handover.</p>`,
      ].join('\n');

      const body = blocks.find((b) => b.id === 'block-radixcharts-1');
      if (!body) throw new Error('radixcharts body missing');
      const tense = [
        ['is an analytics platform that provides real-time insights', 'was an analytics platform that provided real-time insights'],
        ['Founded in 2022, it offers various', 'Founded in 2022, it offered'],
        ['The platform showcases information', 'The platform showed information'],
      ];
      for (const [from, to] of tense) {
        if (!body.text.includes(from)) throw new Error(`radixcharts intro phrase not found: ${from}`);
        body.text = body.text.replace(from, to);
      }
      const crew = /<li><strong>Crew Labs<\/strong>[\s\S]*?<\/li>\n?/;
      if (!crew.test(body.text)) throw new Error('Crew Labs bullet not found');
      body.text = body.text.replace(crew, '');

      const ledger = blocks.find((b) => b.id === '01819630-dcac-44e3-81c8-c126fdb2699e');
      if (!ledger) throw new Error('radixcharts ledger block missing');
      ledger.text = [
        `<h2>Validator under a new owner</h2>`,
        `<p>RadixCharts funded itself partly through a validator, ${A(RC_VAL, 'Radix Charts V2')}. Read from the ${A(GATEWAY, 'Radix Gateway')} on 15 September 2026, it is registered, accepts delegated stake and holds 23.7m XRD, the 46th-largest stake of the 186 registered validators, down from 27.2m on 8 August. It charges a 2.5% fee with no change pending.</p>`,
        `<p>Whoever holds a validator’s owner badge, a token the network mints when the validator is created, controls it. On 24 March 2026 ${A(RC_BADGE_TX, 'a transaction')} withdrew the Radix Charts V2 badge from the account that held it and deposited it in an account that had made its first transaction 90 minutes earlier. The badge is still there. On 27 March the new account ${A(RC_KEY_TX, 'replaced the validator’s public key')}, which is how an owner moves validation to a different node, and set the validator’s name to Radix Charts V2.</p>`,
        `<p>Two days before that, on 25 March, the same account ${A(RC_META_TX, 'wrote two metadata entries')} with the key and value reversed. One entry is keyed by the sentence "Radix Charts Validator node - now maintained by Cronos" and holds the template placeholder <code>&lt;METADATA_VALIDATOR_DESCRIPTION&gt;</code>; the other is keyed "Radix Charts V2" and holds <code>&lt;METADATA_VALIDATOR_NAME&gt;</code>. Wallets and explorers read the entry keyed <code>description</code>, which was never changed and still tells delegators that staking supports the further development of RadixCharts. A separate validator named ${A(CRONOS_VAL, 'Cronos')} was created on 22 March from a different account and holds 8 XRD of stake.</p>`,
        `<p>The node stopped proposing when mainnet restarted on 11 September after the ${L(DRAIN, 'Hyperlane asset drain')} halt. Between the restart and the morning of 14 September it made 5 proposals and missed 2,245; it came back between 08:00 and 10:00 UTC that day and has missed 3 since. In the fifteen days to 30 August it made 43,321 and missed 122. Delegated XRD is not at risk from downtime, because Radix has ${L(STAKING, 'no slashing')}; delegators lose the emissions for the epochs the node misses.</p>`,
      ].join('\n');
    },
  },
  {
    tagPath: 'ecosystem', slug: 'quackspace', version: '9.0.0', changeType: 'major', verified: true,
    sentinel: '<h2>How it works</h2>',
    metadata: { status: '🟠 Dormant', excerpt: 'VandyILL’s Bluesky server for Radix users, who sign in with an XRD domain. Its server stopped answering by September 2026.' },
    message: 'Rewritten from the client, the ledger and the AT Protocol network, replacing the project’s pitch essay. Quack Space is a Bluesky server and client for XRD domain owners. Status Active -> Dormant: its own account last posted on 30 April 2026, its dApp definition last transacted on 13 May, and pds.quack.space timed out on three attempts between 11:08 and 11:16 UTC on 15 September. Pitched features the client does not offer are named as such.',
    apply(blocks) {
      const body = blocks.find((b) => b.id === 'a3974d78-aaf3-440a-87c2-fd172773562f');
      if (!body) throw new Error('quackspace body missing');
      body.text = [
        `<p><strong>Quack Space</strong> is a Bluesky server for Radix users, built by VandyILL, who also made ${L('/ecosystem/radix-rolodex', 'Radix Rolodex')} and ${L('/ecosystem/doubt-it', 'Doubt/it!')}. Bluesky runs on the ${A(ATPROTO, 'AT Protocol')}, in which every account lives on a personal data server (PDS) run by the user or a provider, and an account can move from one server to another with its posts and followers. Quack Space runs a PDS at pds.quack.space, whose accounts take handles ending in that name, and a web client at ${A('https://quack.space', 'quack.space')} that calls itself "a Radix-first gateway into Bluesky". Its ${A(QS_DAPP, 'dApp definition')}, the Radix account that identifies a dApp to the wallet, describes it as the exclusive Bluesky server for owners of .xrd domains.</p>`,
        `<h2>How it works</h2>`,
        `<p>A user connects the Radix Wallet to quack.space and proves they own a name from ${L('/ecosystem/xrd-domains', 'XRD Domains')}, which signs them in to their account on the Quack Space PDS. The client has a feed of posts from accounts on that server, a feed of accounts the user follows, a profile editor, and app passwords that let the same account sign in to other Bluesky clients. Its Tip Cart collects token tips across several posts and pays them in one Radix transaction, showing the transaction manifest before the wallet signs it.</p>`,
        `<p>The project’s pitch, which this page carried until September 2026, described more: views and votes weighted by the tokens a user holds, a feed filtered by those tokens, a Flock Commander module that organised users into missions checked by Telegram bots, and reply airdrops. The client’s interface as read on 15 September 2026 has none of them; its sections are the two feeds, the profile, settings, the Tip Cart and past orders. Polls on Quack Space also feed the trivia game ${L('/ecosystem/doubt-it', 'Doubt/it!')}.</p>`,
        `<h2>Status</h2>`,
        `<p>The project’s own account, ${A(QS_BSKY, 'quackspace.pds.quack.space')}, joined Bluesky on 14 January 2026 and has posted 255 times to 15 followers; ${A(QS_LAST_POST, 'its last post')} was on 30 April. The dApp definition’s most recent transaction was on 13 May. The ${A('https://t.me/QuackSpace', 'Telegram group')} has 33 members.</p>`,
        `<p>On 15 September 2026 the server did not answer. The pds.quack.space hostname resolves, but three connection attempts between 11:08 and 11:16 UTC timed out over both HTTPS and HTTP, and the Bluesky relay still holds the project account at the revision of its 30 April post. The quack.space client still loads. swap.quack.space, which the dApp definition lists as one of its websites, does not resolve. Nobody has announced a shutdown, so this wiki lists Quack Space as Dormant rather than Closed.</p>`,
        `<h2>External Links</h2>`,
        `<ul><li>${A('https://quack.space', 'quack.space')} – the web client</li><li>${A(QS_BSKY, 'Quack Space on Bluesky')}</li><li>${A('https://t.me/QuackSpace', 'Quack Space on Telegram')}</li><li>${A('https://x.com/QuackSpacePDS', 'Quack Space on X')}</li></ul>`,
      ].join('\n');
    },
  },
  {
    tagPath: 'contents/resources', slug: 'radix-ecosystem-operational-status', version: '1.21.1', changeType: 'patch', verified: false,
    sentinel: '<h2>Dormant (49)</h2>',
    message: 'Quack Space moves from Operational to Dormant, following its page (sweep 434): no post since 30 April 2026 and its server unreachable on 15 September. Operational 59 -> 58, Dormant 48 -> 49.',
    apply(blocks) {
      const LI = '<li><a href="/ecosystem/quackspace" rel="noopener">Quack Space</a></li>\n';
      const swap = (text, from, to, what) => {
        if (!text.includes(from)) throw new Error(`index: ${what} not found`);
        return text.replace(from, to);
      };
      const info = blocks.find((b) => b.id === '1545b6e5-2900-481b-9f3b-046594bdd654')?.blocks[0];
      if (!info) throw new Error('index infobox missing');
      info.text = swap(info.text, '<td><strong>Operational</strong></td><td>59</td>', '<td><strong>Operational</strong></td><td>58</td>', 'infobox operational count');
      info.text = swap(info.text, '<td><strong>Dormant</strong></td><td>48</td>', '<td><strong>Dormant</strong></td><td>49</td>', 'infobox dormant count');

      const op = blocks.find((b) => b.id === '4bf64faf-7e06-4f82-9bf6-26135c33e2b5');
      if (!op) throw new Error('index operational block missing');
      op.text = swap(op.text, '<h2>Operational (59)</h2>', '<h2>Operational (58)</h2>', 'operational heading');
      op.text = swap(op.text, LI, '', 'operational Quack Space entry');

      const dormant = blocks.find((b) => b.id === 'df9d98a5-9c9a-42bf-ada0-c255ba802fa3');
      if (!dormant) throw new Error('index dormant block missing');
      dormant.text = swap(dormant.text, '<h2>Dormant (48)</h2>', '<h2>Dormant (49)</h2>', 'dormant heading');
      const radixList = '<li><a href="/ecosystem/radix-list" rel="noopener">Radix List</a></li>';
      dormant.text = swap(dormant.text, `<h3>Media</h3>\n<ul>\n${radixList}`, `<h3>Media</h3>\n<ul>\n${LI}${radixList}`, 'dormant Media list');
    },
  },
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  for (const e of EDITS) {
    if (isLockedPage(e.tagPath, e.slug)) throw new Error(`${e.tagPath}/${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content, metadata FROM pages WHERE tag_path = $1 AND slug = $2', [e.tagPath, e.slug]);
    if (!rows.length) throw new Error(`${e.tagPath}/${e.slug} not found`);
    const page = rows[0];
    const blocks = JSON.parse(JSON.stringify(page.content));
    if (JSON.stringify(blocks).includes(JSON.stringify(e.sentinel).slice(1, -1))) {
      console.log(`  ${e.slug}: already applied – no write`);
      continue;
    }
    e.apply(blocks);
    const json = JSON.stringify(blocks);
    if (/\u2014|\u00a0/.test(json) && e.slug !== 'radix-ecosystem-operational-status') {
      throw new Error(`${e.slug}: em dash or non-breaking space in new content`);
    }
    const metadata = e.metadata ? { ...(page.metadata || {}), ...e.metadata } : page.metadata;
    if (metadata?.excerpt && metadata.excerpt.length > 160) throw new Error(`${e.slug}: excerpt ${metadata.excerpt.length} chars`);
    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  (${page.content.length} -> ${blocks.length} blocks)`);
    if (e.metadata) console.log(`        metadata: ${JSON.stringify(e.metadata)}`);
    if (DRY) continue;
    const now = new Date().toISOString();
    await client.query('BEGIN');
    await client.query(
      `UPDATE pages SET content = $1, version = $2, metadata = $3, updated_at = $4${e.verified ? ', last_verified_at = $4' : ''} WHERE id = $5`,
      [json, e.version, JSON.stringify(metadata), now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, e.changeType, AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
  }
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  throw err;
} finally {
  client.release();
  await pool.end();
}
