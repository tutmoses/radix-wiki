import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

// Run 334. Run 333 caught @DELIVER_XRD only because this wiki had copied one token's
// on-ledger social_urls onto its page, and banked the gap: the ledger publishes socials
// this advisory had never enumerated. This is the enumeration. Every resource address
// cited on the 148 ecosystem pages was read at the Gateway, every Telegram handle in
// its metadata resolved against Telegram, and one of the twelve is held by nobody.

const TAG_PATH = 'contents/resources';
const SLUG = 'recycled-telegram-handles';
const SENTINEL = 'The handles the ledger publishes';
const DRY = process.argv.includes('--dry-run');

const NEW_BLOCK = `<h2>The handles the ledger publishes: 30 August 2026</h2>
<p>Every sweep above began with a citation on this wiki. That is the wrong starting point for a handle a token carries in its own metadata, because the wallet, the explorer and the aggregator will render it whether or not any wiki ever cited it. So the sweep was run again from the ledger instead. The <strong>148 pages</strong> of the <a href="/ecosystem" rel="noopener">ecosystem directory</a> name <strong>72 distinct resource addresses</strong>; all 72 were read from the <a href="https://docs.radixdlt.com/docs/network-gateway" target="_blank" rel="noopener">Radix Gateway</a> on 30&nbsp;August&nbsp;2026, and <strong>twelve</strong> of them publish a Telegram handle in <code>social_urls</code> or <code>telegram_profile_url</code>. Each of the twelve was then resolved against Telegram itself rather than read off a web page.</p>
<table><tbody>
<tr><th>Handle in the token&rsquo;s metadata</th><th>Token</th><th>What answers</th><th>Created</th></tr>
<tr><td><code>@defiplaza</code></td><td>DFP2</td><td>Group, &ldquo;DefiPlaza: Turning IL into Profit&rdquo;</td><td>10 May 2021</td></tr>
<tr><td><code>@xrdSingularityX</code></td><td>SINX</td><td>Group, &ldquo;Space Cafe (SINX)&rdquo;</td><td>25 Aug 2022</td></tr>
<tr><td><code>@astrolescent_official</code></td><td>ASTRL</td><td>Group, &ldquo;Astrolescent Official&rdquo;</td><td>30 Sep 2023</td></tr>
<tr><td><code>@chugchugchugchug</code></td><td>ANTH</td><td>Group, &ldquo;CHUG&rdquo;</td><td>6 Feb 2024</td></tr>
<tr><td><code>@WeAreMonstas</code></td><td>MXRD</td><td>Group, &ldquo;WeAreMonstas&rdquo;</td><td>21 Mar 2024</td></tr>
<tr><td><code>@addixanonymous</code></td><td>HIT</td><td>Group, &ldquo;$HIT Zone&rdquo;</td><td>22 Mar 2024</td></tr>
<tr><td><code>@radixreview</code></td><td>RR</td><td>Channel, &ldquo;RADIX REVIEW&rdquo;</td><td>4 Oct 2024</td></tr>
<tr><td><code>@HugZone</code></td><td>HUG</td><td>Group, &ldquo;Hug Zone&rdquo;</td><td>9 May 2025</td></tr>
<tr><td><code>@hydraxrd</code></td><td>HYDR</td><td>Group, &ldquo;HYDRA&rdquo;</td><td>7 Feb 2026</td></tr>
<tr><td><code>@ascent_xrd</code></td><td>ASCENT</td><td>Group, &ldquo;Ascent&rdquo;</td><td>4 Jun 2026</td></tr>
<tr><td><code>@DELIVER_XRD</code></td><td>DELIVER</td><td><strong>Recycled</strong> &ndash; channel &ldquo;deliver_xrd&rdquo;, four subscribers, Collab.Land gate</td><td>1 Jun 2026</td></tr>
<tr><td><code>@WhyNotXRD</code></td><td>WHY</td><td><strong>Held by nobody</strong> &ndash; <code>USERNAME_NOT_OCCUPIED</code></td><td>&ndash;</td></tr>
</tbody></table>
<p>Ten of the twelve are what the page beside them says they are. The eleventh is the recycled channel <a href="/ecosystem/deliver" rel="noopener">recorded above</a>. The twelfth is a state this advisory had not seen before, and it is the one worth naming: <a href="/ecosystem/whynot" rel="noopener">WhyNot</a>&rsquo;s $WHY token publishes <code>https://t.me/WhyNotXRD</code> in two metadata fields, the project&rsquo;s Linktree publishes it too, and Telegram reports the username as unregistered. It is not a dead channel. It is an <strong>empty slot</strong>, and it is the precondition for every other row in the tables above: the recycled handles were all in this state first, for as long as it took someone to notice.</p>
<p>The creation dates are the reason the resolution has to be done at Telegram rather than at a web page. A channel that answers at the right handle can still be younger than the token that cites it, and only the creation date shows it: <code>@DELIVER_XRD</code> answers, looks ordinary from a link, and postdates the token&rsquo;s metadata by sixteen months. Two of the twelve are legitimately recent for the same reason and are not suspect at all &ndash; <code>@hydraxrd</code> and <code>@ascent_xrd</code> belong to projects that started in 2026. A date does not decide the question; it is what makes the question askable.</p>`;

const INFOBOX_EDIT = [
  '<tr><td><strong>Observed</strong></td><td>1, 20 and 30 August 2026</td></tr>',
  `<tr><td><strong>On-ledger handles swept</strong></td><td>12, from the metadata of the 72 tokens cited on the <a href="/ecosystem" rel="noopener">ecosystem directory</a> &ndash; 1 recycled, 1 unregistered</td></tr>
<tr><td><strong>Observed</strong></td><td>1, 20 and 30 August 2026</td></tr>`,
];

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied - no write');
    process.exit(0);
  }

  const ib = blocks[0].blocks[0];
  if (!ib.text.includes(INFOBOX_EDIT[0])) throw new Error('infobox anchor missing');
  ib.text = ib.text.replace(INFOBOX_EDIT[0], INFOBOX_EDIT[1]);

  const idx = blocks.findIndex((b) => b.text && b.text.includes('An eleventh handle, published by the ledger'));
  if (idx === -1) throw new Error('eleventh-handle block not found');
  blocks.splice(idx + 1, 0, { id: uid(), type: 'content', text: NEW_BLOCK });

  const version = '1.3.0';
  const now = new Date().toISOString();
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}`);
  console.log(`  blocks ${page.content.length} -> ${blocks.length}`);
  console.log(`  infobox ${page.content[0].blocks[0].text.length} -> ${ib.text.length} B`);
  console.log(`  bytes ${JSON.stringify(page.content).length} -> ${JSON.stringify(blocks).length}`);
  if (!DRY) {
    const json = JSON.stringify(blocks);
    await client.query('BEGIN');
    await client.query(
      'UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'minor', AUTHOR_ID,
       'Enumerate the handles the ledger itself publishes, which every sweep so far had missed: the 148 ecosystem pages cite 72 resource addresses, 12 of which carry a Telegram handle in their metadata, all resolved at Telegram on 30 August 2026 with creation dates. Ten are the projects named beside them, one is the recycled DELIVER channel, and @WhyNotXRD returns USERNAME_NOT_OCCUPIED - an empty slot, which is the state every recycled handle passed through first.',
       now]);
    await client.query('COMMIT');
    console.log('  written');
  }
} finally {
  client.release();
  await pool.end();
}
