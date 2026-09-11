/**
 * sweep 414 — ideas rotation.
 *
 * Two of the board's three ⚙️ Protocol cards were written before the events that
 * decide them, and the rotation caught both on the same day.
 *
 * dao-protocol-dry-run-snap asks the DAO to fund a rehearsal of a mainnet protocol
 * upgrade, so that whoever changes the engine next knows the process works. On
 * 11 September 2026 the real upgrade went through instead, unfunded, with the
 * network already halted. The card's deliverable that survives is the write-up.
 *
 * dao-xian-protocol-upgrade asks the DAO to scope and budget continued protocol
 * R&D via RFP. Since 3 September the author of the only candidate implementation
 * has refused further Radix funding, and on 11 September he declined to hold a
 * view on what becomes of the network at all. The card stops at 1 August.
 *
 * Idempotent on two sentinels. --dry-run prints the version moves.
 */
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage, withClient, assertLinkShapes } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const TAG = 'ideas';

const DRY_RUN_SENTINEL = 'dry-run-overtaken';
const XIAN_SENTINEL = 'counterparty-withdrawn';

const DRY_RUN_HTML = `<h2 id="${DRY_RUN_SENTINEL}">The rehearsal was overtaken by the real thing (11 September 2026)</h2>
<p>The dry-run thread's premise is that nobody left on the network has taken a protocol upgrade through end to end, so the next person to change the engine should practise on an upgrade whose payload does not matter. On <strong>11 September 2026</strong> the upgrade that mattered went first. <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray</a> enacted at the start of epoch 339,898 to close the engine flaw behind the <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">Hyperlane asset drain</a>, and it is the only protocol update in Radix's mainnet history that enacts on an epoch number rather than on a validator readiness signal.</p>
<p>Each element projectShift specified for the exercise has a counterpart in what actually happened, which is why the comparison is worth making rather than a coincidence. A running network to test against: the node runner coordinating the release told the developer group the sequence had been <a href="https://t.me/RadixDevelopers/66389" target="_blank" rel="noopener">&ldquo;testing extensively over the last days/week&rdquo;</a> on test networks. A fault planted on purpose: a <code>VaultDrainer</code> blueprint that had been <a href="https://t.me/RadixDevelopers/66391" target="_blank" rel="noopener">&ldquo;hammering on the unpatched test networks, The moratorium and the enacted network&rdquo;</a>. A halted network to recover from: mainnet, which produced no round for 254 hours. The fix was then proved against mainnet itself rather than against a rehearsal of it &mdash; the blueprint was published to mainnet at 12:35&nbsp;UTC and the call that drains a vault was <a href="https://t.me/RadixDevelopers/66392" target="_blank" rel="noopener">refused</a>, permanently rejected with the new <code>SystemError::InvalidInvokeAccess</code>.</p>
<p>For this card the consequence is narrow and it favours one deliverable over the others. Rehearsing the mechanics is worth less now, because the mechanics have been exercised under real load by the people who would have run the rehearsal. <strong>Writing the result up is worth more</strong>, because the process the next upgrade follows now has a worked mainnet precedent instead of a hypothetical one, and that precedent currently exists only as Telegram messages and a commit history. The <a href="/ecosystem/radix-accountability-council" rel="noopener">Radix Accountability Council</a> asked for <a href="https://t.me/RadixAccountabilityCouncil/1026" target="_blank" rel="noopener">a few days before it publishes a report</a> when it announced the restart at 14:37&nbsp;UTC; that report is the nearest thing to the write-up this card asks for, and it is not the DAO's. The MetaMask Snap half of the card is untouched by any of it.</p>`;

const XIAN_HTML = `<h2 id="${XIAN_SENTINEL}">The funding decision lost its counterparty (3&ndash;11 September 2026)</h2>
<p>The deliverables below ask the DAO to identify who carries Xi'an, and to scope and budget that work through an RFP. Both assume a willing recipient. At <strong>00:28&nbsp;UTC on 3 September 2026</strong> the author of the only candidate implementation removed himself from that position, writing in the <a href="/contents/tech/research/hyperscale-rs" rel="noopener">hyperscale-rs</a> channel that he had <a href="https://t.me/hyperscale_rs/11644" target="_blank" rel="noopener">&ldquo;decided not to pursue any proposal, grants or ongoing engagements with radix as a network, dao, or otherwise&rdquo;</a>, and confirming the same morning that the scope of the refusal is future funding rather than the work: <a href="https://t.me/hyperscale_rs/11822" target="_blank" rel="noopener">&ldquo;I do not wish to pursue additional grants from Radix&rdquo;</a>. The <a href="https://radixtalk.com/t/rfc-xian-delivering-hyperscale-for-radix/2280" target="_blank" rel="noopener">RFC</a> that this card's budget question was built around stands on the forum unaltered and unfunded.</p>
<p>On <strong>11 September 2026</strong>, asked directly in the channel what becomes of the community and its XRD now, he answered the adoption question and declined the stewardship one in the same message: <a href="https://t.me/hyperscale_rs/12194" target="_blank" rel="noopener">&ldquo;i intend for hyperscale to be an open source project in the most exemplary sense&hellip; i want to focus on building good primitives, and it doesn't matter overmuch to me who ends up using them&rdquo;</a>, and on what becomes of Radix holders, &ldquo;i don't know mate. it is not really something that i have any control over &mdash; and as such, i don't think about at all.&rdquo; Authorship is confirmed at the message's own public embed.</p>
<p>That leaves this card a genuine decision rather than a stalled one, and changes what it is a decision about. The dual MIT/Apache-2.0 licence committed in August 2026 is irrevocable, so the code is available to Radix whether or not anyone is paid to bring it here; what is not available is the author's commitment that Radix is where it lands, or his participation in an RFP. The question the DAO now faces is adoption and integration &mdash; who ports, tests and operates someone else's open-source protocol, and who migrates the state onto it &mdash; not the R&amp;D procurement this card was drafted to settle. The developer has said he would help with a state migration <a href="https://t.me/hyperscale_rs/11403" target="_blank" rel="noopener">&ldquo;if Radix still exists, and the DAO wants help&rdquo;</a>, which is the one piece of the handover still offered.</p>`;

const EDITS = [
  { slug: 'dao-protocol-dry-run-snap', sentinel: DRY_RUN_SENTINEL, html: DRY_RUN_HTML, version: '1.2.0',
    message: "The dry-run RFC asks for a rehearsal of a mainnet protocol upgrade; Eagle Ray took mainnet through the real one on 11 September 2026, with the fault planted on test networks and the fix then proved against live vaults. Records which of the card's deliverables that leaves standing — the write-up, which the Accountability Council's promised report is the nearest thing to." },
  { slug: 'dao-xian-protocol-upgrade', sentinel: XIAN_SENTINEL, html: XIAN_HTML, version: '1.2.0',
    message: "The card's funding question assumed a recipient. Records the 3 September withdrawal of any further Radix grants by the author of the only candidate implementation, and his 11 September answer on adoption and on the community's future, both authorship-verified at their Telegram embeds. Reframes the open decision as adoption and integration rather than R&D procurement." },
];

await withClient(async (client) => {
  for (const e of EDITS) {
    if (isLockedPage(TAG, e.slug)) throw new Error(`${e.slug} is LOCKED`);
    const { rows } = await client.query(
      'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG, e.slug]);
    if (!rows.length) throw new Error(`${e.slug}: page not found`);
    const page = rows[0];

    const blocks = JSON.parse(JSON.stringify(page.content));
    if (blocks.some((b) => (b.text || '').includes(e.sentinel))) {
      console.log(`  ${e.slug}: already applied — no write`);
      continue;
    }

    // The card is one content block ending in Deliverables / Dependencies / Sources.
    // The new section goes before Deliverables, where the scope notes already sit.
    const bi = blocks.findIndex((b) => (b.text || '').includes('<h2>Deliverables</h2>'));
    if (bi < 0) throw new Error(`${e.slug}: no Deliverables heading to insert above`);
    const before = blocks[bi].text;
    blocks[bi].text = before.replace('<h2>Deliverables</h2>', `${e.html}\n<h2>Deliverables</h2>`);
    if (blocks[bi].text === before) throw new Error(`${e.slug}: insert no-opped`);
    assertLinkShapes(blocks, e.slug);

    console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${e.version}  (+${e.html.length} chars)`);
    if (DRY) continue;

    const now = new Date().toISOString();
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, e.version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, e.version, 'minor', AUTHOR_ID, e.message, now]);
    await client.query('COMMIT');
    console.log(`  wrote ${e.slug}`);
  }
});
