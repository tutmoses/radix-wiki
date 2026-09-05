/**
 * Run 363 — Eagle Ray.
 *
 * On 2 September 2026, thirty-nine hours into the mainnet halt, an open pull
 * request appeared against radixdlt-scrypto introducing a new named protocol
 * update, Eagle Ray, whose single effect is a receiver-visibility check on
 * method invocations. Nothing on the wiki mentioned it. This adds the section
 * to the protocol-updates page, adds the day-five instalment to the incident
 * chronicle, and corrects the incident page's claim that nothing had been
 * published to the Engine repository.
 *
 * Sources: github.com/radixdlt/radixdlt-scrypto/pull/2093 (files, commits,
 * reviews, base sha), mainnet gateway-status + /state/validators/list read at
 * 07:03 UTC 4 September 2026, docs.radixdlt.com/docs/eagle-ray (404).
 */
import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const DRY = process.argv.includes('--dry-run');
const SENTINEL = 'Eagle Ray';

const PR = 'https://github.com/radixdlt/radixdlt-scrypto/pull/2093';
const A = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const eagleRaySection = `<h2>Eagle Ray (Proposed, September 2026)</h2>
<p><strong>Eagle Ray</strong> is the sixth name in the sequence and the only one so far to exist in code without existing in the documentation: ${A('https://docs.radixdlt.com/docs/eagle-ray', 'docs.radixdlt.com/docs/eagle-ray')} answers HTTP 404. What exists is a single pull request against radixdlt-scrypto, ${A(PR, '#2093, &ldquo;0xOmarA/vault access&rdquo;')}, opened at 12:26:45&nbsp;UTC on 2 September 2026 by ${A('https://github.com/0xOmarA', '0xOmarA')} &ndash; the fifth-largest contributor to the repository, and the author of most of the ${A('https://github.com/radixdlt/radix-engine-toolkit', 'Radix Engine Toolkit')} &ndash; from a branch in the radixdlt organisation&rsquo;s own repository rather than a fork. It is open, unreviewed and unmerged; its base branch <code>develop</code> is still at commit <code>858c70f1</code> of 27 March 2026, and the only comment on it is an automated benchmark run.</p>
<p>Its commits date it. The earliest of the six is <strong>31 August 2026 at 22:41:32&nbsp;UTC</strong>, one hour and twenty-two minutes after the last round <a href="/contents/history/hyperlane-asset-drain-2026" rel="noopener">the mainnet ledger committed before it halted</a>. <code>Add Eagle Ray protocol update</code> follows at 23:27:33 and <code>Add a receiver check to kernel_invoke</code> at 00:12:54 the next morning; two commits on 2 September move that check out of the kernel and into the system layer.</p>
<p>The update itself is deliberately small. <code>EagleRaySettings</code> carries one setting, a system-version update, and its single batch flashes a replacement <code>SystemBoot</code> substate onto the boot-loader partition of the transaction tracker, advancing the system logic from <code>SystemVersion::V4</code> to <code>V5</code> while carrying the previous parameters across. No blueprint is published and no ledger state is migrated. <code>ProtocolVersion::LATEST</code> becomes <code>EagleRay</code>, ahead of Dugong.</p>
<p>V5 enables exactly one behaviour, <code>should_check_method_receiver_access</code>. Before an invocation proceeds, the system now asks whether the calling frame can actually see the node whose method it is about to call: a <code>Direct</code> method &ndash; the type used for recall and other direct vault access &ndash; requires direct visibility of the receiver, ordinary <code>Main</code> and module methods require ordinary visibility, and roots, functions and blueprint hooks are exempt. A call that fails is rejected with a new error, <code>SystemError::InvalidInvokeAccess</code>. What that replaces is legible in the test suite: <code>test_recall_on_internal_vault</code> previously expected the attempt to die deep in the kernel&rsquo;s frame construction, at <code>PassMessageError::DirectRefNotFound</code>, and now expects <code>InvalidInvokeAccess</code> instead. The same pull request also narrows a Dugong behaviour that had been written as &ldquo;V4 and later&rdquo; to V4 alone, with the comment that <q>Dugong&rsquo;s V4-only behavior must not carry into later versions</q>.</p>
<p>None of it has reached a network. ${A('https://github.com/radixdlt/babylon-node/releases', 'babylon-node')}&rsquo;s newest release is still <code>v1.3.0.5</code> of 1 June 2026 and the node repository carries no Eagle Ray branch, so there is as yet no node version for a validator to signal readiness for. Read on 4 September 2026; nothing here is an announcement, and the scope Eagle Ray finally carries may change before anyone is asked to run it.</p>`;

const daySection = `<h2 id="day-five-the-fix-is-on-github">Day five: the fix is on GitHub, under a name the network has not heard</h2>
<p>Read at <strong>07:03:39&nbsp;UTC on 4 September 2026</strong>, ${A('https://mainnet.radixdlt.com/status/gateway-status', 'the Gateway status endpoint')} returns the same ledger for a seventeenth consecutive reading: state version 557,840,622, epoch 339,896, round 102, proposer round timestamp 21:19:06.179&nbsp;UTC. That is <strong>eighty-one hours and forty-four minutes</strong> without a committed round. <code>/state/validators/list</code> answers HTTP 500 and counts the gap itself, <q>it is currently 3 days, 9 hours, 48 minutes, 38 seconds behind</q>, with <code>current_sync_delay_seconds</code> 294,518 against a <code>max_allowed_sync_delay_seconds</code> of 720.</p>
<p>The repair has become readable, and it was readable before this reading. At <strong>12:26:45&nbsp;UTC on 2 September</strong> &ndash; thirty-nine hours into the halt, and seven hours before ${'<a href="#day-three-evening-first-technical-account" rel="noopener">the first public account of the flaw</a>'} was given in a chat group &ndash; ${A(PR, 'pull request #2093')} was opened against radixdlt-scrypto&rsquo;s <code>develop</code> branch, titled <q>0xOmarA/vault access</q>. Its author is ${A('https://github.com/0xOmarA', '0xOmarA')}, the same contributor whose forensic notes this page records from the first night. It is still open, unreviewed and unmerged.</p>
<p>The six commits on it date the work. The earliest is <strong>31 August at 22:41:32&nbsp;UTC</strong>, one hour and twenty-two minutes after the last round the network committed; <code>Add Eagle Ray protocol update</code> lands at 23:27:33, and <code>Add a receiver check to kernel_invoke</code> at 00:12:54 on 1 September &ndash; under three hours after the halt, and roughly six hours before the ${'<a href="#day-two" rel="noopener">first official update</a>'} said anything in public. Two further commits on 2 September move the check from the kernel into the system layer.</p>
<p><a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray</a> is a new named protocol update, the next after Dugong in the alphabetical sequence, and it is the second of the ${'<a href="#shape-of-the-fix" rel="noopener">four steps the council named</a>'} as well as the first: the code fix and the protocol upgrade that carries it are the same pull request. Its whole content is a flash update that advances the system logic from <code>SystemVersion::V4</code> to <code>V5</code>, and V5 turns on a single check. Before an invocation runs, the system asks whether the calling frame can actually see the node whose method it is calling &ndash; direct methods, the type used for recall and other direct vault access, requiring direct visibility of the receiver &ndash; and rejects the call otherwise with a new error, <code>SystemError::InvalidInvokeAccess</code>. That is the handle nobody tried, given a lock: the test the change rewrites is <code>test_recall_on_internal_vault</code>, which used to fail obscurely inside the kernel&rsquo;s frame construction and now fails cleanly at the system layer.</p>
<p>Two things follow, and they pull in opposite directions. The fix matches the flaw as ${'<a href="#the-first-public-account-of-the-flaw" rel="noopener">both public accounts of it</a>'} described it &ndash; a method reached on a vault the caller had no authority over &ndash; and it was written within hours, not days. But four days later it has no review, no merge, and no node: ${A('https://github.com/radixdlt/babylon-node/releases', 'babylon-node')}&rsquo;s newest release is still <code>v1.3.0.5</code> of 1 June 2026, the node repository carries no Eagle Ray branch, and a protocol update reaches mainnet only when validators signal readiness for a node version that contains it. Steps three and four of the council&rsquo;s list have not started. ${A('https://www.radixdlt.com/blog', 'The Foundation&rsquo;s blog')} still carries nothing about the incident and ${A('https://radixdao.org/notices.json', 'the DAO&rsquo;s notice feed')} still ends on 29 August, so the most concrete public statement about how the network gets restarted remains an unannounced pull request that anyone could have read for two days.</p>`;

const OLD_UNRESOLVED =
  'Nothing had been published to the node or Engine repositories, the Foundation’s blog or the DAO’s notice feed when this page was last re-read, and no date has been offered.';
const NEW_UNRESOLVED =
  'The Engine half of that work is now public and has been since 2 September: <a href="' + PR +
  '" target="_blank" rel="noopener">pull request #2093</a> introduces the <a href="/contents/tech/releases/protocol-updates" rel="noopener">Eagle Ray</a> protocol update and the receiver check it exists to carry, and it remains open, unreviewed and unmerged. Nothing has been published to the node repository, the Foundation’s blog or the DAO’s notice feed, no validator has a node version to signal readiness for, and no date has been offered.';

const EXT_LINK_ANCHOR = '<li>' + A('https://docs.radixdlt.com/docs/dugong', 'Dugong \u2013 Radix Docs') + '</li>';
const EXT_LINK_ADD = EXT_LINK_ANCHOR + '<li>' + A(PR, 'radixdlt-scrypto pull request #2093') + ' &ndash; the Eagle Ray protocol update and the receiver check</li>';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const load = async (tagPath, slug) => {
  if (isLockedPage(tagPath, slug)) throw new Error(`${tagPath}/${slug} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [tagPath, slug]);
  if (!rows.length) throw new Error(`${tagPath}/${slug} not found`);
  return rows[0];
};

const commit = async (page, blocks, version, changeType, message) => {
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  (${blocks.length} blocks)`);
  if (DRY) return;
  const now = new Date().toISOString();
  const json = JSON.stringify(blocks);
  await client.query('BEGIN');
  await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3 WHERE id=$4', [json, version, now, page.id]);
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [cuid(), page.id, json, page.title, version, changeType, AUTHOR_ID, message, now]);
  await client.query('COMMIT');
};

try {
  // ---- 1. contents/tech/releases/protocol-updates ----
  const pu = await load('contents/tech/releases', 'protocol-updates');
  if (JSON.stringify(pu.content).includes(SENTINEL)) {
    console.log('  protocol-updates: already applied');
  } else {
    const blocks = JSON.parse(JSON.stringify(pu.content));
    const dugongIdx = blocks.findIndex((b) => (b.text || '').includes('<h2>Dugong (In Development)</h2>'));
    if (dugongIdx < 0) throw new Error('protocol-updates: Dugong section not found');
    blocks.splice(dugongIdx + 1, 0, { id: uid(), type: 'content', text: eagleRaySection });

    const extIdx = blocks.findIndex((b) => (b.text || '').includes(EXT_LINK_ANCHOR));
    if (extIdx < 0) throw new Error('protocol-updates: external-links anchor not found');
    blocks[extIdx].text = blocks[extIdx].text.replace(EXT_LINK_ANCHOR, EXT_LINK_ADD);

    await commit(pu, blocks, '1.2.0', 'minor',
      'Add Eagle Ray, the protocol update introduced in radixdlt-scrypto PR #2093 on 2 September 2026: what it changes (SystemBoot V4 -> V5, the method-receiver visibility check, SystemError::InvalidInvokeAccess), its commit timeline against the mainnet halt, and its status as open, unreviewed and unmerged with no node release.');
  }

  // ---- 2. contents/history/hyperlane-asset-drain-2026 ----
  const inc = await load('contents/history', 'hyperlane-asset-drain-2026');
  if (JSON.stringify(inc.content).includes(SENTINEL)) {
    console.log('  hyperlane-asset-drain-2026: already applied');
  } else {
    const blocks = JSON.parse(JSON.stringify(inc.content));
    const dayFourIdx = blocks.findIndex((b) => (b.text || '').includes('id="day-four-two-prices"'));
    if (dayFourIdx < 0) throw new Error('incident: day-four section not found');
    blocks.splice(dayFourIdx + 1, 0, { id: uid(), type: 'content', text: daySection });

    const unresolvedIdx = blocks.findIndex((b) => (b.text || '').includes(OLD_UNRESOLVED));
    if (unresolvedIdx < 0) throw new Error('incident: unresolved sentence not found');
    blocks[unresolvedIdx].text = blocks[unresolvedIdx].text.replace(OLD_UNRESOLVED, NEW_UNRESOLVED);

    await commit(inc, blocks, '2.11.0', 'minor',
      'Day five: the fix is public. radixdlt-scrypto PR #2093, opened 2 September at 12:26:45 UTC, introduces the Eagle Ray protocol update whose only effect is a method-receiver visibility check (SystemError::InvalidInvokeAccess); its earliest commit is dated 82 minutes after the last committed round. Still open, unreviewed, unmerged, with no node release. Corrects the standing claim that nothing had been published to the Engine repository. Gateway reading at 07:03:39 UTC, 81h44m without a round.');
  }
} finally {
  client.release();
  await pool.end();
}
