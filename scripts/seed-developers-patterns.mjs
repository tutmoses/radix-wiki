// scripts/seed-developers-patterns.mjs
// Batch seed script for developers/patterns wiki pages
import pg from 'pg';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

config();

const uid = () => randomUUID();
const AUTHOR_ID = 'cmk5t48vx0000005zc5se4dqz'; // Hydrate

const pages = [
  // ─────────────────────────────────────────────
  // 1. Badge-Gated Authorization
  // ─────────────────────────────────────────────
  {
    tagPath: 'developers/patterns',
    slug: 'badge-gated-authorization',
    title: 'Badge-Gated Authorization',
    excerpt: 'Use badge resources as unforgeable credentials to gate method access on Scrypto components.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Badge-Gated Authorization</strong></td></tr>
<tr><td>Pattern Type</td><td>Access Control</td></tr>
<tr><td>Difficulty</td><td>Beginner–Intermediate</td></tr>
<tr><td>Concepts</td><td><a href="/contents/tech/core-concepts/access-rules-and-auth-zones" rel="noopener">Access Rules</a>, <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">Proofs</a>, Badges</td></tr>
<tr><td>Official Docs</td><td><a href="https://docs.radixdlt.com/docs/auth" target="_blank" rel="noopener">Authorization — Proofs</a></td></tr>
<tr><td>Example</td><td><a href="https://docs.radixdlt.com/docs/user-badge-pattern" target="_blank" rel="noopener">User Badge Pattern</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p>In most smart contract platforms, access control is based on the caller's <em>address</em> — a pattern that leads to fragile permission systems and common exploits like reentrancy. Radix takes a fundamentally different approach: access is gated by <strong>badges</strong>, which are standard <a href="/contents/tech/core-concepts/asset-oriented-programming" rel="noopener">resources</a> (fungible or non-fungible) that serve as unforgeable credentials. A caller is authorised not because of <em>who they are</em> but because of <em>what they hold</em>.</p>
<p>This pattern is central to Scrypto development and appears in virtually every non-trivial dApp on Radix.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>How It Works</h2>
<h3>Access Rules</h3>
<p>When a component is instantiated, its methods can be protected with <a href="/contents/tech/core-concepts/access-rules-and-auth-zones" rel="noopener">access rules</a> that specify which badge(s) must be present for a call to succeed. The <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> checks these rules automatically before executing any method — there is no manual <code>require(msg.sender == owner)</code> logic.</p>
<pre><code>enable_method_auth! {
    roles {
        admin =&gt; updatable_by: [];
        minter =&gt; updatable_by: [admin];
    },
    methods {
        mint_tokens =&gt; restrict_to: [minter, admin];
        update_price =&gt; restrict_to: [admin];
        buy =&gt; PUBLIC;
    }
}</code></pre>
<h3>Proofs and the Auth Zone</h3>
<p>When a method requires a badge, the caller provides a <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">Proof</a> — a cryptographic attestation that a resource exists in the caller's possession without transferring it. Proofs can be placed on the <strong>Auth Zone</strong> (a transaction-scoped container) so that multiple method calls within the same transaction can share the same authorisation context.</p>
<pre><code># Transaction manifest: create proof and call restricted method
CREATE_PROOF_FROM_ACCOUNT_OF_AMOUNT
    Address("account_rdx...")
    Address("resource_rdx...admin_badge...")
    Decimal("1")
;
CALL_METHOD
    Address("component_rdx...")
    "update_price"
    Decimal("1.50")
;</code></pre>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Common Badge Patterns</h2>
<h3>Admin Badge</h3>
<p>The most basic pattern: mint a single non-fungible badge at instantiation and return it to the deployer. Methods like <code>withdraw_fees</code>, <code>update_config</code>, or <code>pause</code> are gated behind this badge.</p>
<h3>User Badge</h3>
<p>The <a href="https://docs.radixdlt.com/docs/user-badge-pattern" target="_blank" rel="noopener">User Badge Pattern</a> issues a non-fungible badge to each user when they register. The badge's non-fungible data stores user-specific state (balances, permissions, membership tier). Methods read the caller's badge data to personalise behaviour without maintaining a separate user registry.</p>
<h3>Multi-Signature</h3>
<p>Access rules support boolean logic: <code>require_n_of(2, [badge_a, badge_b, badge_c])</code> creates a 2-of-3 multi-sig gate. This is useful for treasury management, protocol upgrades, or any high-stakes operation.</p>
<h3>Soulbound Badges</h3>
<p>By creating a non-transferable resource (restrict <code>Deposit</code> and <code>Withdraw</code> actions), a badge becomes soulbound to the original recipient's account. This is ideal for identity credentials, certificates, or membership tokens that should not change hands.</p>
<h2>External Links</h2>
<ul>
<li><a href="https://docs.radixdlt.com/docs/auth" target="_blank" rel="noopener">Authorization — Proofs — Official Docs</a></li>
<li><a href="https://docs.radixdlt.com/docs/user-badge-pattern" target="_blank" rel="noopener">User Badge Pattern — Official Docs</a></li>
<li><a href="https://docs.radixdlt.com/docs/account-deposit-patterns" target="_blank" rel="noopener">Account Deposit Patterns — Official Docs</a></li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 2. Vault & Resource Patterns
  // ─────────────────────────────────────────────
  {
    tagPath: 'developers/patterns',
    slug: 'vault-and-resource-patterns',
    title: 'Vault & Resource Patterns',
    excerpt: 'Manage on-ledger resources safely using vaults, buckets, and Scrypto resource containers.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Vault & Resource Patterns</strong></td></tr>
<tr><td>Pattern Type</td><td>Resource Management</td></tr>
<tr><td>Difficulty</td><td>Beginner</td></tr>
<tr><td>Concepts</td><td><a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">Buckets, Proofs & Vaults</a></td></tr>
<tr><td>Official Docs</td><td><a href="https://docs.radixdlt.com/docs/buckets-and-vaults" target="_blank" rel="noopener">Vaults and Buckets</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p>Radix enforces a strict invariant: every <a href="/contents/tech/core-concepts/asset-oriented-programming" rel="noopener">resource</a> must exist inside a container at all times. There are two container types: <strong>Vaults</strong> (permanent, on-ledger storage) and <strong>Buckets</strong> (temporary, transaction-scoped carriers). The <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> guarantees that resources cannot be duplicated, accidentally destroyed, or left in limbo — if your transaction ends with an undeposited bucket, it fails. This "physical resource" model eliminates entire categories of bugs common in other smart contract platforms.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Vault Patterns</h2>
<h3>Single-Vault Component</h3>
<p>The simplest pattern: a component holds one vault to store a single resource type. A token sale component, for example, stores tokens in a vault and returns XRD payment to the buyer's account.</p>
<pre><code>struct TokenSale {
    token_vault: Vault,    // holds tokens for sale
    xrd_vault: Vault,      // collects XRD payments
    price: Decimal,
}</code></pre>
<h3>Multi-Vault Component (HashMap)</h3>
<p>When a component needs to manage arbitrary resource types (e.g. a DEX liquidity pool or a wallet-like component), use a <code>HashMap&lt;ResourceAddress, Vault&gt;</code>. When a new resource type is deposited, create a new vault; when an existing type arrives, deposit into the matching vault.</p>
<pre><code>struct MultiVault {
    vaults: HashMap&lt;ResourceAddress, Vault&gt;,
}

impl MultiVault {
    pub fn deposit(&amp;mut self, bucket: Bucket) {
        let addr = bucket.resource_address();
        self.vaults
            .entry(addr)
            .or_insert_with(|| Vault::new(addr))
            .put(bucket);
    }
}</code></pre>
<h3>Vault Take & Put</h3>
<p>Withdraw resources from a vault with <code>.take(amount)</code> (returns a Bucket) or <code>.take_all()</code>. Deposit with <code>.put(bucket)</code>. For non-fungibles, use <code>.take_non_fungible(&amp;id)</code> or <code>.take_non_fungibles(&amp;ids)</code> to withdraw specific items.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Bucket Patterns</h2>
<h3>Bucket Passing (Move Semantics)</h3>
<p>Buckets use Rust's ownership model — passing a bucket to a function <em>moves</em> it. The caller no longer has access. This prevents double-spending at the language level:</p>
<pre><code>// Caller creates a bucket, passes it to the component
let payment: Bucket = account.withdraw(xrd_address, dec!("100"));
let tokens: Bucket = sale_component.buy(payment);
// 'payment' is now consumed — cannot be used again
account.deposit(tokens);</code></pre>
<h3>Bucket Splitting</h3>
<p>Use <code>.take(amount)</code> on a bucket to split it into two buckets — the original retains the remainder. This is how you implement partial fills, fee extraction, or distributing resources across multiple destinations within a single transaction.</p>
<h3>The Worktop</h3>
<p>In <a href="/contents/tech/core-protocols/transaction-manifests" rel="noopener">transaction manifests</a>, returned resources land on the <strong>worktop</strong> — a temporary staging area. Use <code>TAKE_FROM_WORKTOP</code> to create named buckets from worktop resources, then pass them to subsequent method calls. The transaction fails if any resources remain on the worktop at the end.</p>
<h2>External Links</h2>
<ul>
<li><a href="https://docs.radixdlt.com/docs/buckets-and-vaults" target="_blank" rel="noopener">Vaults and Buckets — Official Docs</a></li>
<li><a href="https://docs.radixdlt.com/docs/resources" target="_blank" rel="noopener">Resources — Official Docs</a></li>
<li><a href="https://docs-babylon.radixdlt.com/main/scrypto/examples/regulated-token.html" target="_blank" rel="noopener">Regulated Token Example — Official Docs</a></li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 3. Oracle Integration
  // ─────────────────────────────────────────────
  {
    tagPath: 'developers/patterns',
    slug: 'oracle-integration',
    title: 'Oracle Integration',
    excerpt: 'Bring off-chain data on-ledger for Scrypto components using push and pull oracle patterns.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Oracle Integration</strong></td></tr>
<tr><td>Pattern Type</td><td>External Data</td></tr>
<tr><td>Difficulty</td><td>Intermediate–Advanced</td></tr>
<tr><td>Concepts</td><td>Oracles, Price Feeds, Cross-Ledger Data</td></tr>
<tr><td>Challenge</td><td><a href="https://radixdlt.medium.com/scrypto-oracles-challenge-is-live-the-radix-blog-radix-dlt-6b958c4d9948" target="_blank" rel="noopener">Scrypto Oracles Challenge</a></td></tr>
<tr><td>Example Provider</td><td><a href="https://blog.redstone.finance/2025/06/12/redstone-brings-secure-gas-efficient-oracle-solutions-to-radix-defi-ecosystem/" target="_blank" rel="noopener">RedStone on Radix</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p>Scrypto components execute deterministically on the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> and can only access data already present on the ledger — they cannot make HTTP calls or read external APIs. When a dApp needs external data (asset prices, exchange rates, weather data, random numbers), it requires an <strong>oracle</strong>: a service that bridges off-chain information to on-ledger state.</p>
<p>Oracle design is one of the most challenging aspects of decentralised application development. This article covers the two main oracle patterns on Radix, their trade-offs, and how to integrate existing oracle providers.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Push Oracles</h2>
<p>A push oracle is an off-chain service that periodically submits transactions to update on-ledger price data. A Scrypto component stores the latest values and exposes a read method that other components call.</p>
<h3>Architecture</h3>
<ol>
<li>An off-chain relayer monitors data sources (exchange APIs, aggregator feeds).</li>
<li>The relayer signs and submits a transaction calling <code>update_price(asset, price, timestamp)</code> on the oracle component.</li>
<li>The oracle component, protected by an <a href="/developers/patterns/badge-gated-authorization" rel="noopener">admin badge</a>, stores the update in an on-ledger vault or key-value store.</li>
<li>Consumer components call <code>get_price(asset)</code> to read the latest value.</li>
</ol>
<h3>Trade-offs</h3>
<ul>
<li><strong>Pros</strong>: Simple consumer integration, predictable data freshness, works with any data type.</li>
<li><strong>Cons</strong>: Relayer must pay transaction fees for every update, data staleness between updates, single-point-of-failure if the relayer goes offline.</li>
</ul>
<h3>Mitigations</h3>
<p>Include a <code>timestamp</code> field in each price update and check staleness in consumer logic: reject prices older than a threshold (e.g. 5 minutes). Use multiple independent relayers with a median/aggregation mechanism to reduce trust assumptions.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Pull Oracles</h2>
<p>A pull oracle delivers data <em>within the consumer's transaction</em> rather than pre-posting it on-ledger. The oracle provider signs the data off-chain, and the consumer's transaction manifest includes both the signed data payload and a verification call to the oracle contract.</p>
<h3>Architecture</h3>
<ol>
<li>The consumer's frontend fetches a signed price attestation from the oracle provider's API.</li>
<li>The frontend constructs a <a href="/contents/tech/core-protocols/transaction-manifests" rel="noopener">transaction manifest</a> that first calls the oracle component's <code>verify_and_store(signed_data)</code> method, then calls the consumer component's business logic.</li>
<li>The oracle component verifies the provider's signature and exposes the data for the remainder of the transaction.</li>
</ol>
<h3>Trade-offs</h3>
<ul>
<li><strong>Pros</strong>: Data is always fresh (fetched at transaction time), no relayer infrastructure needed, consumer pays the gas.</li>
<li><strong>Cons</strong>: More complex frontend integration, requires the oracle provider to run a signing API, consumer must handle the multi-step manifest.</li>
</ul>
<h3>RedStone on Radix</h3>
<p><a href="https://blog.redstone.finance/2025/06/12/redstone-brings-secure-gas-efficient-oracle-solutions-to-radix-defi-ecosystem/" target="_blank" rel="noopener">RedStone</a> is an example of a pull oracle that has integrated with Radix. Its price feeds are delivered as signed payloads that Scrypto components verify on-chain, treating the data as a first-class resource within the <a href="/contents/tech/core-concepts/asset-oriented-programming" rel="noopener">asset-oriented</a> model.</p>
<h2>External Links</h2>
<ul>
<li><a href="https://radixdlt.medium.com/scrypto-oracles-challenge-is-live-the-radix-blog-radix-dlt-6b958c4d9948" target="_blank" rel="noopener">Scrypto Oracles Challenge — Radix Blog</a></li>
<li><a href="https://blog.redstone.finance/2025/06/12/redstone-brings-secure-gas-efficient-oracle-solutions-to-radix-defi-ecosystem/" target="_blank" rel="noopener">RedStone on Radix — RedStone Blog</a></li>
<li><a href="https://www.radixdlt.com/blog/will-radix-offer-decentralized-data-storage" target="_blank" rel="noopener">Will Radix Offer Decentralized Data Storage? — Radix Blog</a></li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 4. Multi-Component Architecture
  // ─────────────────────────────────────────────
  {
    tagPath: 'developers/patterns',
    slug: 'multi-component-architecture',
    title: 'Multi-Component Architecture',
    excerpt: 'Design modular Scrypto dApps by composing small, reusable blueprints into larger systems.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Multi-Component Architecture</strong></td></tr>
<tr><td>Pattern Type</td><td>Application Architecture</td></tr>
<tr><td>Difficulty</td><td>Intermediate</td></tr>
<tr><td>Concepts</td><td><a href="/contents/tech/core-concepts/blueprints-and-packages" rel="noopener">Blueprints & Packages</a>, Composition</td></tr>
<tr><td>Official Docs</td><td><a href="https://docs.radixdlt.com/docs/scrypto-design-patterns" target="_blank" rel="noopener">Scrypto Design Patterns</a></td></tr>
<tr><td>Catalog</td><td><a href="https://www.radixdlt.com/blog/build-defi-dapps-faster-on-radix" target="_blank" rel="noopener">Blueprint Catalog</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p>Scrypto separates the concept of "smart contract" into two distinct things: <a href="/contents/tech/core-concepts/blueprints-and-packages" rel="noopener">blueprints</a> (reusable templates) and <strong>components</strong> (live instances on the ledger). This separation enables a modular architecture where small, well-tested blueprints are composed into larger systems — much like how object-oriented programming uses classes and composition. The official <a href="https://docs.radixdlt.com/docs/scrypto-design-patterns" target="_blank" rel="noopener">Scrypto Design Patterns</a> documentation recommends this approach as the default for non-trivial dApps.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Separation of Concerns</h2>
<p>Instead of building a monolithic blueprint, decompose your dApp into small blueprints with a single responsibility:</p>
<ul>
<li><strong>TokenSale</strong> — handles pricing and token distribution</li>
<li><strong>Treasury</strong> — manages collected funds, fee withdrawal</li>
<li><strong>AccessControl</strong> — issues and manages <a href="/developers/patterns/badge-gated-authorization" rel="noopener">badges</a></li>
<li><strong>PriceFeed</strong> — wraps an <a href="/developers/patterns/oracle-integration" rel="noopener">oracle</a> and exposes prices to other components</li>
</ul>
<p>Each blueprint is easier to test in isolation, reason about for security, and audit independently. Smaller blueprints are also more reusable — a Treasury blueprint can serve a DEX, a lending protocol, or a DAO with no changes.</p>
<h3>Inter-Component Calls</h3>
<p>Components call each other's methods using their on-ledger address. A component can store another component's address in its state and invoke methods on it:</p>
<pre><code>struct MyDapp {
    treasury: Global&lt;Treasury&gt;,
    price_feed: Global&lt;PriceFeed&gt;,
}

impl MyDapp {
    pub fn buy(&amp;mut self, payment: Bucket) -&gt; Bucket {
        let price = self.price_feed.get_price("XRD/USD");
        // ... calculate tokens owed ...
        self.treasury.deposit(payment);
        // ... return tokens ...
    }
}</code></pre>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Blueprint Reuse & the Catalog</h2>
<p>Radix encourages sharing blueprints as published packages that anyone can instantiate. The <a href="https://www.radixdlt.com/blog/build-defi-dapps-faster-on-radix" target="_blank" rel="noopener">Blueprint Catalog</a> concept allows developers to find, audit, and reuse existing blueprints rather than reimplementing common patterns.</p>
<h3>Importing External Blueprints</h3>
<p>To use a blueprint from another package, import it by its package address and instantiate or call it. The Scrypto <code>extern_blueprint!</code> macro generates type-safe bindings:</p>
<pre><code>extern_blueprint! {
    "package_rdx...",       // on-ledger package address
    PriceFeed {             // blueprint name
        fn get_price(&amp;self, pair: String) -&gt; Decimal;
    }
}</code></pre>
<p>This generates a type you can use in your component's state and method signatures, with full compile-time type checking.</p>
<h3>Factory Pattern</h3>
<p>A common pattern for dApps that create multiple similar components (e.g. a DEX creating liquidity pools): write a <strong>factory blueprint</strong> whose instantiation function creates and configures child components, returning their addresses and any admin badges.</p>
<h2>External Links</h2>
<ul>
<li><a href="https://docs.radixdlt.com/docs/scrypto-design-patterns" target="_blank" rel="noopener">Scrypto Design Patterns — Official Docs</a></li>
<li><a href="https://docs.radixdlt.com/docs/blueprints-and-components" target="_blank" rel="noopener">Blueprints and Components — Official Docs</a></li>
<li><a href="https://www.radixdlt.com/blog/build-defi-dapps-faster-on-radix" target="_blank" rel="noopener">Blueprint Catalog: Build DeFi dApps Faster — Radix Blog</a></li>
<li><a href="https://docs-babylon.radixdlt.com/main/scrypto/design-patterns/reusable-blueprint-pattern.html" target="_blank" rel="noopener">Reusable Blueprints Pattern — Official Docs</a></li>
</ul>`
      },
    ],
  },
];

// ─────────────────────────────────────────────
// Database insertion
// ─────────────────────────────────────────────
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

try {
  let inserted = 0;
  let skipped = 0;

  for (const page of pages) {
    const existing = await client.query(
      'SELECT id FROM pages WHERE tag_path = $1 AND slug = $2',
      [page.tagPath, page.slug]
    );

    if (existing.rows.length > 0) {
      console.log(`SKIP: ${page.tagPath}/${page.slug} (already exists)`);
      skipped++;
      continue;
    }

    const pageId = uid();
    const revisionId = uid();
    const now = new Date().toISOString();
    const contentJson = JSON.stringify(page.content);

    await client.query('BEGIN');

    await client.query(
      `INSERT INTO pages (id, slug, title, content, excerpt, tag_path, metadata, version, author_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, '{}'::jsonb, '1.0.0', $7, $8, $8)`,
      [pageId, page.slug, page.title, contentJson, page.excerpt, page.tagPath, AUTHOR_ID, now]
    );

    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, changes, author_id, message, created_at)
       VALUES ($1, $2, $3::jsonb, $4, '1.0.0', 'major', '[]'::jsonb, $5, 'Initial version', $6)`,
      [revisionId, pageId, contentJson, page.title, AUTHOR_ID, now]
    );

    await client.query('COMMIT');
    console.log(`INSERT: ${page.tagPath}/${page.slug}`);
    inserted++;
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Error:', err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
