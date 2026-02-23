import pg from 'pg';
import { randomUUID, randomBytes } from 'crypto';
import { config } from 'dotenv';
config();

const uid = () => randomUUID();
const cuid = () => 'c' + randomBytes(12).toString('hex').slice(0, 24);
const AUTHOR_ID = 'cmk5t48vx0000005zc5se4dqz';
const TAG_PATH = 'roadmap';

const pages = [
  {
    slug: 'wallet-txmanifest-support',
    title: 'Wallet Raw TxManifest Support',
    excerpt: "In-wallet pasting of raw transaction manifests for direct component interaction without Radix Connect.",
    metadata: { status: 'In Progress', priority: 'Medium', quarter: 'Q1 2026', category: 'Tooling', owner: 'RDX Works (Wallet Team)' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Wallet Feature</td></tr><tr><td><strong>Status</strong></td><td>In Development</td></tr><tr><td><strong>Source</strong></td><td>Adam (CSO Radix Foundation), RAC General</td></tr><tr><td><strong>Goal</strong></td><td>Remove dependency on Radix Connect</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>The Radix Wallet team is adding the ability to paste raw <a href="/developers/reference/transaction-manifest" rel="noopener">transaction manifests</a> directly into the wallet, enabling users to interact with on-chain components without requiring the Radix Connect browser extension or a dApp frontend.</p><p>This feature was announced by Adam (CSO, Radix Foundation) in the <a href="https://t.me/RadixAccountabilityCouncil" target="_blank" rel="noopener">RAC Telegram group</a> on February 19, 2026, as part of efforts to reduce dependency on Foundation-operated infrastructure ahead of the 2026 transition.</p>' },
      { id: uid(), type: 'content', text: '<h2>Impact</h2><ul><li><strong>Decentralization:</strong> Users can submit transactions even if the Signaling Server or Connect Relay are temporarily unavailable</li><li><strong>Power users:</strong> Enables direct component interaction for developers and advanced users</li><li><strong>Emergency access:</strong> Provides a fallback transaction method independent of third-party infrastructure</li></ul>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://t.me/RadixAccountabilityCouncil" target="_blank" rel="noopener">RAC Telegram Group</a></li></ul>' },
    ],
  },
  {
    slug: 'wallet-endpoint-selection',
    title: 'Wallet Signal/Relay Endpoint Selection',
    excerpt: "User-selectable signaling server and relay endpoints in the Radix Wallet, mirroring gateway selection.",
    metadata: { status: 'In Progress', priority: 'Medium', quarter: 'Q1 2026', category: 'Tooling', owner: 'RDX Works (Wallet Team)' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Wallet Feature</td></tr><tr><td><strong>Status</strong></td><td>In Development</td></tr><tr><td><strong>Source</strong></td><td>Adam (CSO Radix Foundation), RAC General</td></tr><tr><td><strong>Mirrors</strong></td><td>Existing Gateway selection UI</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>The wallet team is updating the signal server and relay system to give users direct control over which endpoints they connect to — similar to the existing gateway selection feature in the <a href="/contents/tech/core-concepts/radix-wallet" rel="noopener">Radix Wallet</a>.</p><p>This is critical for the <a href="/roadmap/signaling-relay-rfp" rel="noopener">infrastructure decentralization</a> effort. As the Foundation opens RFPs for independent operators to run Signaling Servers and Connect Relays, the wallet must support pointing to alternative providers rather than being hardcoded to Foundation endpoints.</p>' },
      { id: uid(), type: 'content', text: '<h2>Impact</h2><ul><li><strong>Multi-provider resilience:</strong> Users can switch providers if one goes down</li><li><strong>Pre-transition readiness:</strong> Infrastructure decentralization can proceed before Foundation sunset</li><li><strong>Competitive market:</strong> Enables commercial operators to offer differentiated service tiers</li></ul>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/the-next-phase-of-decentralization-rfps-for-gateway-and-relay-services" target="_blank" rel="noopener">RFPs for Gateway and Relay Services</a></li></ul>' },
    ],
  },
  {
    slug: 'market-making-transition',
    title: 'Market Making Transition',
    excerpt: "Seven-step plan to transition XRD market making from Foundation management to community/third-party oversight.",
    metadata: { status: 'In Progress', priority: 'High', quarter: 'Q1 2026', category: 'Governance', owner: 'RAC / Foundation' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Financial Operations Transition</td></tr><tr><td><strong>Steps</strong></td><td>7</td></tr><tr><td><strong>Status</strong></td><td>Step 1-2 (RAC briefing)</td></tr><tr><td><strong>Models</strong></td><td>A: Standard, B: Community-Directed, C: Third-Party Manager</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>As part of the 2026 decentralization strategy, XRD market making operations must transition from Foundation control to community or third-party management. The <a href="https://docs.google.com/spreadsheets/d/1PN1iOdHa9JJRbHgIkY0Mi4Sbyc5uz1qn053_gXL7IOs" target="_blank" rel="noopener">Community Transition Planner</a> outlines a seven-step process for this handover.</p>' },
      { id: uid(), type: 'content', text: '<h2>Transition Steps</h2><ol><li><strong>Assign MM Lead</strong> — RAC appoints a member with DeFi/CeFi experience to own the workstream</li><li><strong>Foundation Briefing</strong> — RAC briefed on current MM arrangement (exchanges, spread targets, cost, performance)</li><li><strong>Review Proposals</strong> — Evaluate incoming third-party MM management proposals</li><li><strong>Choose Model</strong> — Option A: MM manages strategy (simplest); Option B: Community directs strategy (more control); Option C: Community hires a third-party manager (most oversight)</li><li><strong>Allocate Capital</strong> — Determine how much treasury to dedicate to market making</li><li><strong>Governance Proposal</strong> — Community ratifies chosen model and capital allocation via formal vote</li><li><strong>Formal Onboarding</strong> — Community entity onboards with the MM; Foundation steps back</li></ol>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://www.radixdlt.com/blog/2026-strategy-the-next-chapter-of-radix" target="_blank" rel="noopener">2026 Strategy: The Next Chapter of Radix</a></li></ul>' },
    ],
  },
  {
    slug: 'dao-treasury-custody',
    title: 'DAO Treasury Custody Setup',
    excerpt: "Establishing secure custody for community DAO treasury assets via PrimeVault or native multi-sig.",
    metadata: { status: 'In Progress', priority: 'High', quarter: 'Q1 2026', category: 'Governance', owner: 'RAC' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Treasury Management</td></tr><tr><td><strong>Options</strong></td><td>PrimeVault, Native Multi-sig, Gnosis Safe (eXRD)</td></tr><tr><td><strong>Assets</strong></td><td>XRD + stablecoins</td></tr><tr><td><strong>Status</strong></td><td>Evaluating custody solutions</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>Before the Foundation can transfer assets to the community DAO entity, a secure custody solution must be in place. Three approaches are being evaluated in the <a href="https://t.me/RadixAccountabilityCouncil" target="_blank" rel="noopener">RAC</a>:</p><ul><li><strong>PrimeVault</strong> — institutional custodian already used by the Foundation. RAC members would be added as authorized signers, then Foundation access revoked.</li><li><strong>Native Radix Multi-sig</strong> — on-chain multi-signature wallet using Radix\'s access controller primitives. Two community designs exist: xStelea\'s multi-account signing approach and Don Marco\'s <a href="https://radixtalk.com/t/dao-multisig-wallet/2164" target="_blank" rel="noopener">component-based preset-action model</a>.</li><li><strong>Gnosis Safe (eXRD)</strong> — EVM multi-sig holding bridged eXRD via Hyperlane. Trivial to set up and zero cost, but introduces bridge dependency risk.</li></ul>' },
      { id: uid(), type: 'content', text: '<h2>Proposed PrimeVault Handover</h2><ol><li>Foundation completes remaining payments from treasury</li><li>Foundation adds RAC members as PrimeVault users with separate credentials</li><li>Foundation is removed from the PrimeVault account</li><li>RAC members become sole owners/admins</li></ol><p>The RAC favors this approach for its speed and security, with a longer-term migration to native multi-sig once the tooling matures.</p>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://radixtalk.com/t/dao-multisig-wallet/2164" target="_blank" rel="noopener">DAO Multisig Wallet — RadixTalk</a></li><li><a href="https://t.me/RadixAccountabilityCouncil" target="_blank" rel="noopener">RAC Telegram Group</a></li></ul>' },
    ],
  },
  {
    slug: 'radix-name-service-v2',
    title: 'Radix Name Service v2',
    excerpt: "Community-built decentralized .xrd domain name system with subdomains, reverse resolution, and stablecoin bonds.",
    metadata: { status: 'In Progress', priority: 'Medium', quarter: 'Q2 2026', category: 'Ecosystem', owner: 'Community (Wylie)' },
    content: [
      { id: uid(), type: 'infobox', blocks: [{ id: uid(), type: 'content', text: '<table><tbody><tr><td><strong>Type</strong></td><td>Ecosystem Infrastructure</td></tr><tr><td><strong>Status</strong></td><td>Stokenet deployment</td></tr><tr><td><strong>Builder</strong></td><td>Wylie (community developer)</td></tr><tr><td><strong>Predecessor</strong></td><td>Original RNS (separate project)</td></tr></tbody></table>' }] },
      { id: uid(), type: 'content', text: '<h2>Overview</h2><p>A brand new decentralized name service for Radix is being built by community developer Wylie, announced in the <a href="https://t.me/RadixDevelopers" target="_blank" rel="noopener">Radix Developer Discussion</a> group on February 18, 2026. It is intentionally a clean break from the original RNS for legal reasons, using a new namespace.</p>' },
      { id: uid(), type: 'content', text: '<h2>Features</h2><ul><li><strong>Human-readable .xrd domains</strong> backed by bonded USD stablecoins</li><li><strong>Subdomains</strong> — create, edit, delete under any registered domain (e.g., blog.alice.xrd)</li><li><strong>Arbitrary data records</strong> — wallet addresses, social links, metadata</li><li><strong>Reverse resolution</strong> — look up a domain by account address</li><li><strong>NFT domain import</strong> — existing domain NFT holders can prove ownership and receive equivalent .xrd domains</li><li><strong>Third-party registrars</strong> — anyone can sign up as a registrar, set fees, and earn commission</li><li><strong>Bond model</strong> — domains backed by stablecoins (not burned); owners can rebond to a different stablecoin or unbond to reclaim</li><li><strong>Immutable after launch</strong> — admin badge is burned on go-live, permanently removing all admin control</li></ul>' },
      { id: uid(), type: 'content', text: '<h2>External Links</h2><ul><li><a href="https://t.me/RadixDevelopers" target="_blank" rel="noopener">Radix Developer Discussion</a></li></ul>' },
    ],
  },
];

// ── INSERT ──────────────────────────────────────────────────

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  let inserted = 0, skipped = 0;

  try {
    for (const page of pages) {
      const existing = await client.query(
        'SELECT id FROM pages WHERE tag_path = $1 AND slug = $2',
        [TAG_PATH, page.slug],
      );
      if (existing.rows.length > 0) { skipped++; continue; }

      const id = cuid();
      const revId = cuid();
      const now = new Date().toISOString();

      await client.query('BEGIN');

      await client.query(
        `INSERT INTO pages (id, slug, title, content, excerpt, tag_path, metadata, version, author_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
        [id, page.slug, page.title, JSON.stringify(page.content), page.excerpt, TAG_PATH, JSON.stringify(page.metadata), '1.0.0', AUTHOR_ID, now],
      );

      await client.query(
        `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [revId, id, JSON.stringify(page.content), page.title, '1.0.0', 'major', AUTHOR_ID, 'Initial roadmap item (Telegram research)', now],
      );

      await client.query('COMMIT');
      inserted++;
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log(`Done. Inserted: ${inserted}, Skipped: ${skipped}`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
