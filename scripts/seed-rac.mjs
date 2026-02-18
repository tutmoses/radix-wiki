// scripts/seed-rac.mjs
// One-time script to create the Radix Accountability Council wiki page
import pg from 'pg';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

config();

const uid = () => randomUUID();

const AUTHOR_ID = 'cmk5t48vx0000005zc5se4dqz'; // Hydrate
const TAG_PATH = 'community';
const SLUG = 'radix-accountability-council';
const TITLE = 'Radix Accountability Council';
const EXCERPT = 'Five-member community-elected council guiding the transition from the Radix Foundation to the Radix DLT DAO.';

const content = [
  // Infobox
  {
    id: uid(),
    type: 'infobox',
    blocks: [
      {
        id: uid(),
        type: 'content',
        text: `<table>
<tbody>
<tr><td colspan="2"><strong>Radix Accountability Council</strong></td></tr>
<tr><td>Type</td><td>Governance Body</td></tr>
<tr><td>Status</td><td>Active (Season 1)</td></tr>
<tr><td>Established</td><td>February 2026</td></tr>
<tr><td>Members</td><td>Peachy, Faraz, Jazzer_9F, Avaunt, projectShift</td></tr>
<tr><td>Council Size</td><td>5 (elected via <a href="https://www.radixdlt.com/blog/rac-consultation-results" target="_blank" rel="noopener">approval voting</a>)</td></tr>
<tr><td>Election Turnout</td><td>1.34B XRD / 1,151 accounts</td></tr>
<tr><td>Telegram</td><td><a href="https://t.me/RadixAccountabilityCouncil" target="_blank" rel="noopener">t.me/RadixAccountabilityCouncil</a> (351 members)</td></tr>
<tr><td>Consultations</td><td><a href="https://www.radixtalk.com" target="_blank" rel="noopener">RadixTalk</a></td></tr>
</tbody>
</table>`,
      },
    ],
  },

  // Introduction
  {
    id: uid(),
    type: 'content',
    text: `<h2>Introduction</h2>
<p>The <strong>Radix Accountability Council (RAC)</strong> is a <a href="https://www.radixdlt.com/blog/rac-consultation-results" target="_blank" rel="noopener">five-member community-elected body</a> tasked with guiding the transition from the Radix Foundation to the <strong>Radix DLT DAO (RDD)</strong>. Established in February 2026 following a series of community consultations, the council serves as the primary interface between the Radix community and the Foundation during the decentralisation of governance.</p>
<p>The RAC's <a href="https://t.me/RadixAccountabilityCouncil" target="_blank" rel="noopener">charter defines three core responsibilities</a>: establishing the structures and processes needed to achieve the transition, executing community will as a multi-signer on RDD-associated structures, and representing RDD interests on matters of the Foundation transition. The council operates through an <a href="https://t.me/RadixAccountabilityCouncil" target="_blank" rel="noopener">open Telegram channel</a> with 351 members, where RAC members post as admins and the broader community can observe proceedings.</p>`,
  },

  // Background
  {
    id: uid(),
    type: 'content',
    text: `<h2>Background: Foundation to DAO Transition</h2>
<p>Since its inception, the <strong>Radix Foundation</strong> has served as the custodial entity overseeing the development and operational infrastructure of the Radix network. As the network matured, a <a href="https://www.radixdlt.com/blog/establishing-the-radix-accountability-council" target="_blank" rel="noopener">community consultation process</a> was initiated to transition governance authority from the Foundation to a community-run decentralised autonomous organisation — the Radix DLT DAO.</p>
<p>The consultation to <a href="https://www.radixdlt.com/blog/establishing-the-radix-accountability-council" target="_blank" rel="noopener">establish the RAC</a> recognised that a structured transition body was needed to bridge the gap between Foundation-led and community-led governance. Rather than an abrupt handover, the council model provides continuity through elected representatives who can negotiate with the Foundation, manage multi-signature authority over DAO structures, and ensure community interests are represented throughout the process.</p>`,
  },

  // Election & Consultation Results
  {
    id: uid(),
    type: 'content',
    text: `<h2>Election &amp; Consultation Results</h2>
<p>RAC members were elected through an <a href="https://www.radixdlt.com/blog/rac-consultation-results" target="_blank" rel="noopener">approval voting mechanism</a> where XRD holders could vote for up to five candidates from the pool of nominees. The consultation drew participation from <strong>1,151 unique accounts</strong> representing approximately <strong>1.34 billion XRD</strong> in voting weight.</p>
<h3>Council Size</h3>
<p>A separate consultation on council size resulted in <strong>five members</strong> winning with 56.91% of 1.30B XRD, over alternatives of three (18.94%), seven (16.23%), or nine (7.93%) members.</p>
<h3>Elected Members</h3>
<table>
<thead><tr><th>Member</th><th>Approval %</th></tr></thead>
<tbody>
<tr><td>Peachy</td><td>92.76%</td></tr>
<tr><td>Faraz | Radstakes</td><td>83.87%</td></tr>
<tr><td>Jazzer_9F</td><td>82.92%</td></tr>
<tr><td>Avaunt</td><td>58.44%</td></tr>
<tr><td>projectShift</td><td>57.22%</td></tr>
</tbody>
</table>
<p>Adam, CSO of the Radix Foundation, participates in the <a href="https://t.me/RadixAccountabilityCouncil" target="_blank" rel="noopener">RAC Telegram channel</a> as a Foundation representative but is not a council member.</p>`,
  },

  // Responsibilities
  {
    id: uid(),
    type: 'content',
    text: `<h2>Responsibilities</h2>
<p>The RAC's <a href="https://t.me/RadixAccountabilityCouncil" target="_blank" rel="noopener">pinned charter</a> defines three core areas of responsibility:</p>
<ol>
<li><strong>Establish transition structures</strong> — Create and refine the legal, organisational, and governance structures needed for the Radix Foundation to hand over operational control to the Radix DLT DAO.</li>
<li><strong>Execute community will</strong> — Act as multi-signers on RDD-associated structures, ensuring that decisions made through community consultations are faithfully executed on-chain and off-chain.</li>
<li><strong>Represent RDD interests</strong> — Serve as the community's voice in negotiations with the Radix Foundation on matters relating to the transition, including asset transfers, intellectual property, and operational handovers.</li>
</ol>`,
  },

  // Active Consultations
  {
    id: uid(),
    type: 'content',
    text: `<h2>Active Consultations</h2>
<p>As of February 2026, the RAC is facilitating several consultations through <a href="https://www.radixtalk.com" target="_blank" rel="noopener">RadixTalk</a>:</p>
<h3>Season 2 of Radix Rewards</h3>
<p>A <a href="https://www.radixtalk.com/consultation/01JMCQ7SAX2B0Y72SHV1YPEWQP" target="_blank" rel="noopener">draft consultation</a> on the continuation and structure of the Radix Rewards programme, which incentivises network participation and ecosystem development.</p>
<h3>DAO Entity Location</h3>
<p>A <a href="https://www.radixtalk.com/consultation/01JMCQKMZ3MPNZWWSXRG6FD4XR" target="_blank" rel="noopener">draft consultation</a> on the legal jurisdiction and entity type for the Radix DLT DAO. Options under consideration include a Wyoming Decentralised Unincorporated Nonprofit Association (WY DUNA), Cayman Islands Foundation, Marshall Islands DAO LLC, Abu Dhabi entity, or other jurisdictions.</p>
<h3>Instabridge IP Acquisition</h3>
<p>A question raised in the <a href="https://t.me/RadixAccountabilityCouncil" target="_blank" rel="noopener">RAC channel</a> regarding the Foundation's acquisition of intellectual property from Instabridge, seeking clarity on the terms and relevance to the DAO transition.</p>`,
  },

  // Foundation Operational Stack
  {
    id: uid(),
    type: 'content',
    text: `<h2>Foundation Operational Stack</h2>
<p>As part of the transition planning, the Radix Foundation published its <a href="https://www.radixdlt.com/blog/the-foundation-operational-stack" target="_blank" rel="noopener">Operational Stack</a> — a prioritised inventory of all services and infrastructure currently maintained by the Foundation that will eventually need to be transferred to or replicated by the DAO.</p>
<h3>Priority 1 — Critical Infrastructure</h3>
<p>Services essential for network operation that require immediate continuity planning:</p>
<ul>
<li><strong>Gateway API</strong> — the primary interface for applications to interact with the Radix network</li>
<li><strong>Connect Relay</strong> — facilitates communication between dApps and the Radix Wallet</li>
<li><strong>Signaling Server</strong> — supports peer-to-peer connection establishment</li>
</ul>
<h3>Priority 2 — Important Services</h3>
<p>Services with significant user impact that need transition plans:</p>
<ul>
<li>Node software distribution and updates</li>
<li>Radix Wallet (desktop and mobile)</li>
<li>Official website and documentation</li>
</ul>
<h3>Priority 3 — Supporting Tools</h3>
<p>Developer tools, network dashboards, and documentation portals that enhance the ecosystem but are not critical for network operation.</p>`,
  },

  // External Links
  {
    id: uid(),
    type: 'content',
    text: `<h2>External Links</h2>
<ul>
<li><a href="https://t.me/RadixAccountabilityCouncil" target="_blank" rel="noopener">Telegram — Radix Accountability Council</a></li>
<li><a href="https://www.radixdlt.com/blog/rac-consultation-results" target="_blank" rel="noopener">RAC Consultation Results — Radix Blog</a></li>
<li><a href="https://www.radixdlt.com/blog/establishing-the-radix-accountability-council" target="_blank" rel="noopener">Establishing the RAC — Radix Blog</a></li>
<li><a href="https://www.radixdlt.com/blog/the-foundation-operational-stack" target="_blank" rel="noopener">The Foundation Operational Stack — Radix Blog</a></li>
<li><a href="https://www.radixtalk.com" target="_blank" rel="noopener">RadixTalk — Community Consultation Platform</a></li>
</ul>`,
  },
];

// Insert via direct SQL
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: { rejectUnauthorized: false },
});

try {
  const client = await pool.connect();

  const pageId = `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const contentJson = JSON.stringify(content);

  // Check if page already exists
  const existing = await client.query(
    'SELECT id FROM pages WHERE tag_path = $1 AND slug = $2',
    [TAG_PATH, SLUG]
  );

  if (existing.rows.length > 0) {
    console.log('Page already exists, skipping creation.');
    client.release();
    await pool.end();
    process.exit(0);
  }

  // Insert page
  await client.query(
    `INSERT INTO pages (id, slug, title, content, excerpt, tag_path, metadata, version, author_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, '{}'::jsonb, '1.0.0', $7, $8, $8)`,
    [pageId, SLUG, TITLE, contentJson, EXCERPT, TAG_PATH, AUTHOR_ID, now]
  );

  // Insert initial revision
  const revisionId = `cm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await client.query(
    `INSERT INTO revisions (id, page_id, content, title, version, change_type, changes, author_id, message, created_at)
     VALUES ($1, $2, $3::jsonb, $4, '1.0.0', 'major', '[]'::jsonb, $5, 'Initial version', $6)`,
    [revisionId, pageId, contentJson, TITLE, AUTHOR_ID, now]
  );

  console.log(`Created page: ${TAG_PATH}/${SLUG} (id: ${pageId})`);

  client.release();
  await pool.end();
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  await pool.end();
  process.exit(1);
}
