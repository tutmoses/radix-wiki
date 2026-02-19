// scripts/seed-developers-build.mjs
// Batch seed script for developers/build wiki pages
import pg from 'pg';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';

config();

const uid = () => randomUUID();
const AUTHOR_ID = 'cmk5t48vx0000005zc5se4dqz'; // Hydrate

const pages = [
  // ─────────────────────────────────────────────
  // 1. Setting Up Your Development Environment
  // ─────────────────────────────────────────────
  {
    tagPath: 'developers/build',
    slug: 'development-environment',
    title: 'Setting Up Your Development Environment',
    excerpt: 'Install Rust, the Scrypto toolchain, and configure your IDE to start building on Radix.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Development Environment Setup</strong></td></tr>
<tr><td>Difficulty</td><td>Beginner</td></tr>
<tr><td>Est. Time</td><td>20–30 minutes</td></tr>
<tr><td>Prerequisites</td><td>macOS, Linux, or Windows with WSL</td></tr>
<tr><td>Language</td><td><a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a> (Rust-based)</td></tr>
<tr><td>Key Tools</td><td><code>rustup</code>, <code>scrypto</code> CLI, <code>resim</code></td></tr>
<tr><td>Official Docs</td><td><a href="https://docs.radixdlt.com/docs/getting-rust-scrypto" target="_blank" rel="noopener">Getting Rust & Scrypto</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p>Radix smart contracts are written in <a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a>, an <a href="/contents/tech/core-concepts/asset-oriented-programming" rel="noopener">asset-oriented</a> language built on Rust. Before writing any code, you need three things: the Rust compiler toolchain, the Scrypto-specific libraries and CLI tools, and an IDE with Rust support. This guide walks through the complete setup on macOS, Linux, and Windows.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Installing Rust</h2>
<p>Scrypto requires a specific version of the Rust toolchain managed through <a href="https://rustup.rs/" target="_blank" rel="noopener">rustup</a>. Install it with the following command:</p>
<pre><code>curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh</code></pre>
<p>After installation, restart your terminal and verify:</p>
<pre><code>rustup --version
rustc --version
cargo --version</code></pre>
<p>Scrypto pins a specific Rust nightly version to ensure reproducible builds. The <code>scrypto</code> CLI will manage this automatically, but you may need to add the <code>wasm32-unknown-unknown</code> target for compiling to WebAssembly:</p>
<pre><code>rustup target add wasm32-unknown-unknown</code></pre>
<h3>Windows Users</h3>
<p>On Windows, Scrypto development requires <a href="https://learn.microsoft.com/en-us/windows/wsl/install" target="_blank" rel="noopener">Windows Subsystem for Linux (WSL)</a>. Install WSL 2 with Ubuntu, then follow the Linux instructions inside your WSL terminal. Native Windows builds are not supported.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Installing the Scrypto Toolchain</h2>
<p>With Rust installed, add the Scrypto-specific tools. The official <a href="https://docs.radixdlt.com/docs/getting-rust-scrypto" target="_blank" rel="noopener">installation guide</a> provides platform-specific instructions, but the core steps are:</p>
<pre><code># Install the Scrypto CLI and Radix Engine Simulator
cargo install radix-clis</code></pre>
<p>This installs two command-line tools:</p>
<ul>
<li><strong><code>scrypto</code></strong> — creates new packages, builds them to WASM, runs tests, and formats code. Wraps <code>cargo</code> with Scrypto-specific configuration.</li>
<li><strong><code>resim</code></strong> — the <strong>Radix Engine Simulator</strong>, a local ledger emulator for testing. You can create accounts, publish packages, call functions, and inspect state without connecting to any network.</li>
</ul>
<p>Verify the installation:</p>
<pre><code>scrypto --version
resim --version</code></pre>
<h3>Updating Scrypto</h3>
<p>When a new Scrypto version is released (often alongside <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> or mainnet protocol updates), update with:</p>
<pre><code>cargo install radix-clis --force</code></pre>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>IDE Setup</h2>
<p>Any editor with Rust support works, but <a href="https://code.visualstudio.com/" target="_blank" rel="noopener">Visual Studio Code</a> is recommended. Install these extensions:</p>
<ul>
<li><strong><a href="https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer" target="_blank" rel="noopener">rust-analyzer</a></strong> — provides autocomplete, inline type hints, error highlighting, and go-to-definition for Rust and Scrypto code.</li>
<li><strong><a href="https://marketplace.visualstudio.com/items?itemName=RadixPublishing.radix-developer-tools" target="_blank" rel="noopener">Radix Developer Tools</a></strong> — adds syntax highlighting for <a href="/contents/tech/core-protocols/transaction-manifests" rel="noopener">transaction manifest</a> files (<code>.rtm</code>), making it easier to read and write deployment and interaction manifests.</li>
</ul>
<p>For JetBrains users, <a href="https://www.jetbrains.com/rust/" target="_blank" rel="noopener">RustRover</a> or the IntelliJ Rust plugin provides equivalent Rust language support, though no Radix-specific manifest extension exists for that platform.</p>
<h2>Creating Your First Package</h2>
<p>With everything installed, scaffold a new Scrypto package:</p>
<pre><code>scrypto new-package my-first-dapp
cd my-first-dapp</code></pre>
<p>This creates a standard Rust project structure with Scrypto dependencies pre-configured: <code>Cargo.toml</code>, <code>src/lib.rs</code> (containing a "Hello" blueprint), and a <code>tests/</code> directory. Build it with:</p>
<pre><code>scrypto build</code></pre>
<p>If the build succeeds, you are ready to start developing on Radix.</p>
<h2>External Links</h2>
<ul>
<li><a href="https://docs.radixdlt.com/docs/getting-rust-scrypto" target="_blank" rel="noopener">Getting Rust & Scrypto — Official Docs</a></li>
<li><a href="https://docs.radixdlt.com/docs/setting-up-for-scrypto-development" target="_blank" rel="noopener">Setting Up for Scrypto Development — Official Docs</a></li>
<li><a href="https://github.com/radixdlt/radixdlt-scrypto" target="_blank" rel="noopener">radixdlt-scrypto — GitHub</a></li>
<li><a href="https://marketplace.visualstudio.com/items?itemName=RadixPublishing.radix-developer-tools" target="_blank" rel="noopener">Radix Developer Tools — VS Code Extension</a></li>
<li><a href="https://rustup.rs/" target="_blank" rel="noopener">rustup — Rust Toolchain Installer</a></li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 2. Building & Testing Scrypto Packages
  // ─────────────────────────────────────────────
  {
    tagPath: 'developers/build',
    slug: 'building-and-testing',
    title: 'Building & Testing Scrypto Packages',
    excerpt: 'Create, build, and test Scrypto blueprints using the scrypto CLI, resim simulator, and the scrypto-test framework.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Building & Testing Scrypto Packages</strong></td></tr>
<tr><td>Difficulty</td><td>Beginner–Intermediate</td></tr>
<tr><td>Est. Time</td><td>45–60 minutes</td></tr>
<tr><td>Prerequisites</td><td><a href="/developers/build/development-environment" rel="noopener">Dev environment setup</a></td></tr>
<tr><td>Language</td><td><a href="/contents/tech/core-protocols/scrypto-programming-language" rel="noopener">Scrypto</a></td></tr>
<tr><td>Key Tools</td><td><code>scrypto</code>, <code>resim</code>, <code>scrypto-test</code></td></tr>
<tr><td>Official Docs</td><td><a href="https://docs.radixdlt.com/docs/scrypto-1" target="_blank" rel="noopener">Scrypto Documentation</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p>Once your <a href="/developers/build/development-environment" rel="noopener">development environment</a> is set up, the next step is understanding the Scrypto development workflow: creating packages, writing <a href="/contents/tech/core-concepts/blueprints-and-packages" rel="noopener">blueprints</a>, building to WebAssembly, and testing locally. Radix provides two complementary testing approaches — the <code>resim</code> simulator for interactive exploration and the <code>scrypto-test</code> framework for automated testing.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Package Structure</h2>
<p>A Scrypto package is a standard Rust crate with Scrypto-specific dependencies. When you run <code>scrypto new-package my-dapp</code>, you get:</p>
<pre><code>my-dapp/
├── Cargo.toml          # Dependencies (scrypto crate)
├── src/
│   └── lib.rs          # Blueprint definitions
└── tests/
    └── lib.rs          # Test suite</code></pre>
<p>The <code>src/lib.rs</code> file contains one or more <a href="/contents/tech/core-concepts/blueprints-and-packages" rel="noopener">blueprints</a> — reusable templates that define the structure and logic of on-ledger components. Each blueprint is annotated with the <code>#[blueprint]</code> macro and contains a struct (state) and an <code>impl</code> block (functions and methods).</p>
<h3>Building</h3>
<p>Compile your package to WebAssembly with:</p>
<pre><code>scrypto build</code></pre>
<p>This produces a <code>.wasm</code> binary and a <code>.rpd</code> (Radix Package Definition) file in the <code>target/</code> directory. The <code>.rpd</code> contains the package's ABI — the blueprint names, functions, methods, and their type signatures — which the <a href="/contents/tech/core-protocols/radix-engine" rel="noopener">Radix Engine</a> uses to validate calls at runtime.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Interactive Testing with resim</h2>
<p>The Radix Engine Simulator (<code>resim</code>) is a local ledger emulator that lets you publish packages, instantiate components, and call methods without connecting to any network. It is invaluable for rapid iteration.</p>
<h3>Core Commands</h3>
<pre><code># Reset simulator state
resim reset

# Create a new account (returns address, public key, private key, owner badge)
resim new-account

# Set the active account
resim set-default-account &lt;account_address&gt; &lt;private_key&gt; &lt;owner_badge_address&gt;

# Publish a package (returns package address)
resim publish .

# Call a blueprint function (e.g. instantiate a component)
resim call-function &lt;package_address&gt; &lt;BlueprintName&gt; &lt;function_name&gt; [args...]

# Call a method on an instantiated component
resim call-method &lt;component_address&gt; &lt;method_name&gt; [args...]

# Inspect an entity's state
resim show &lt;address&gt;</code></pre>
<h3>Typical Workflow</h3>
<ol>
<li><code>resim reset</code> — start with a clean ledger</li>
<li><code>resim new-account</code> — create a test account</li>
<li><code>resim publish .</code> — deploy your package</li>
<li><code>resim call-function</code> — instantiate a component from your blueprint</li>
<li><code>resim call-method</code> — interact with the component</li>
<li><code>resim show</code> — inspect state, balances, and <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">vaults</a></li>
</ol>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Automated Testing with scrypto-test</h2>
<p>While <code>resim</code> is great for exploration, production packages need automated tests. Radix provides two testing frameworks:</p>
<h3>Unit Testing: scrypto-test</h3>
<p>The <a href="https://docs.radixdlt.com/docs/scrypto-test" target="_blank" rel="noopener">scrypto-test</a> framework uses an invocation-based approach — you call blueprint functions and methods directly in Rust, receiving actual <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults" rel="noopener">Bucket</a> and Proof objects that you can assert against. At its core is the <code>TestEnvironment</code> struct, which encapsulates a self-contained Radix Engine instance.</p>
<pre><code>use scrypto_test::prelude::*;

#[test]
fn test_instantiation() {
    let mut env = TestEnvironment::new();
    let package = Package::compile_and_publish(".", &mut env).unwrap();
    // Call functions, assert on returned buckets/proofs
}</code></pre>
<p>Key utilities include <code>BucketFactory</code> and <code>ProofFactory</code> for creating test resources, with strategies like <code>CreationStrategy::DisableAuthAndMint</code> for bypassing auth in test contexts.</p>
<h3>Integration Testing: TestRunner</h3>
<p>The <a href="https://docs.radixdlt.com/docs/learning-to-test-a-multi-blueprint-package" target="_blank" rel="noopener">TestRunner</a> is an in-memory ledger simulator where you interact as an external user submitting transactions. It applies all the same costing limits and auth checks as the real network, making it ideal for end-to-end testing.</p>
<p>Run all tests with:</p>
<pre><code>scrypto test</code></pre>
<p>This wraps <code>cargo test</code> with the correct Scrypto feature flags and environment.</p>
<h2>External Links</h2>
<ul>
<li><a href="https://docs.radixdlt.com/docs/resim-radix-engine-simulator" target="_blank" rel="noopener">Resim — Radix Engine Simulator</a></li>
<li><a href="https://docs.radixdlt.com/docs/scrypto-test" target="_blank" rel="noopener">scrypto-test Framework — Official Docs</a></li>
<li><a href="https://docs.rs/scrypto-test/latest/scrypto_test/" target="_blank" rel="noopener">scrypto-test API Reference — docs.rs</a></li>
<li><a href="https://docs.radixdlt.com/docs/learning-to-test-a-multi-blueprint-package" target="_blank" rel="noopener">Testing Multi-Blueprint Packages — Official Docs</a></li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 3. Deploying to Stokenet & Mainnet
  // ─────────────────────────────────────────────
  {
    tagPath: 'developers/build',
    slug: 'deploying-packages',
    title: 'Deploying to Stokenet & Mainnet',
    excerpt: 'Deploy Scrypto packages to the Radix test network and mainnet using the Developer Console and transaction manifests.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Deploying Scrypto Packages</strong></td></tr>
<tr><td>Difficulty</td><td>Intermediate</td></tr>
<tr><td>Est. Time</td><td>30–45 minutes</td></tr>
<tr><td>Prerequisites</td><td><a href="/developers/build/building-and-testing" rel="noopener">Build & test locally</a>, Radix Wallet</td></tr>
<tr><td>Networks</td><td><a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> (testnet), Mainnet</td></tr>
<tr><td>Key Tools</td><td>Developer Console, Radix Wallet, <code>resim</code></td></tr>
<tr><td>Console (Stokenet)</td><td><a href="https://stokenet-console.radixdlt.com/deploy-package" target="_blank" rel="noopener">stokenet-console.radixdlt.com</a></td></tr>
<tr><td>Console (Mainnet)</td><td><a href="https://console.radixdlt.com/deploy-package" target="_blank" rel="noopener">console.radixdlt.com</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p>After <a href="/developers/build/building-and-testing" rel="noopener">building and testing</a> your Scrypto package locally with <code>resim</code>, the next step is deploying it to a live network. Radix has two public networks: <a href="/contents/tech/releases/stokenet" rel="noopener">Stokenet</a> (the test network, running the same protocol as mainnet) and <strong>Mainnet</strong> (the production network). This guide covers the deployment workflow for both, using the Radix Developer Console.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Deployment Prerequisites</h2>
<p>Before deploying, ensure you have:</p>
<ul>
<li><strong>A built package</strong> — run <code>scrypto build</code> in your project directory. This produces a <code>.wasm</code> file and a <code>.rpd</code> file in <code>target/wasm32-unknown-unknown/release/</code>.</li>
<li><strong>The <a href="https://wallet.radixdlt.com/" target="_blank" rel="noopener">Radix Wallet</a></strong> — installed on your mobile device (iOS or Android) with an account created.</li>
<li><strong>The <a href="https://chromewebstore.google.com/detail/radix-wallet-connector/bfeplaecgkoeckiidkgkmlllfbaanlkl" target="_blank" rel="noopener">Radix Wallet Connector</a></strong> — a Chrome extension that bridges your browser to the mobile wallet.</li>
<li><strong>XRD for fees</strong> — on Stokenet, use the built-in faucet to get free test XRD; on Mainnet, you need real XRD in your account.</li>
</ul>
<h3>Getting Test XRD</h3>
<p>Stokenet provides a faucet accessible through the <a href="https://stokenet-console.radixdlt.com/" target="_blank" rel="noopener">Stokenet Developer Console</a>. Connect your wallet, navigate to the faucet, and request test XRD. These tokens have no value and are solely for development purposes.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Deploying via the Developer Console</h2>
<p>The <a href="https://stokenet-console.radixdlt.com/deploy-package" target="_blank" rel="noopener">Radix Developer Console</a> provides a web UI for package deployment without writing deployment scripts manually.</p>
<ol>
<li><strong>Open the Console</strong> — navigate to the Deploy Package page on either <a href="https://stokenet-console.radixdlt.com/deploy-package" target="_blank" rel="noopener">Stokenet</a> or <a href="https://console.radixdlt.com/deploy-package" target="_blank" rel="noopener">Mainnet</a>.</li>
<li><strong>Connect your wallet</strong> — click the Connect button and approve the connection in your Radix Wallet.</li>
<li><strong>Upload your package</strong> — select the <code>.wasm</code> and <code>.rpd</code> files from your build output directory.</li>
<li><strong>Review the transaction</strong> — the Console constructs a <a href="/contents/tech/core-protocols/transaction-manifests" rel="noopener">transaction manifest</a> that publishes your package to the ledger. Review it in your wallet.</li>
<li><strong>Sign and submit</strong> — approve the transaction in your wallet. After confirmation, you receive a <strong>package address</strong> — the on-ledger identifier for your deployed blueprint(s).</li>
</ol>
<h3>Deploying via Transaction Manifest</h3>
<p>For automated deployments or CI/CD pipelines, you can submit a raw deployment manifest through the Console's "Send Raw Transaction" page or programmatically via the <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway API</a>. The <a href="https://github.com/radixdlt/typescript-radix-engine-toolkit" target="_blank" rel="noopener">TypeScript Radix Engine Toolkit</a> provides builders for constructing deployment transactions programmatically.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Post-Deployment</h2>
<p>After deployment, your package is live on the ledger and immutable — the code cannot be changed. To update logic, you deploy a new package version and migrate users.</p>
<h3>Verifying Your Deployment</h3>
<p>Use the Developer Console to search for your package address and inspect its blueprints, functions, and methods. On Stokenet, the <a href="https://stokenet-console.radixdlt.com/" target="_blank" rel="noopener">Console</a> shows the full package definition and allows you to call functions directly from the browser.</p>
<h3>Instantiating Components</h3>
<p>A deployed package contains <a href="/contents/tech/core-concepts/blueprints-and-packages" rel="noopener">blueprints</a> — to create usable on-ledger components, you call an instantiation function (typically named <code>instantiate</code> or <code>new</code>) via a transaction manifest. This returns a component address that your frontend can interact with.</p>
<h3>Stokenet → Mainnet Migration</h3>
<p>Stokenet runs the same protocol version as Mainnet, so packages that work on Stokenet will work on Mainnet. The migration process is straightforward: rebuild your package (to ensure a clean build), deploy to Mainnet via the <a href="https://console.radixdlt.com/deploy-package" target="_blank" rel="noopener">Mainnet Console</a>, instantiate your components, and update your frontend's network configuration and component addresses.</p>
<h2>External Links</h2>
<ul>
<li><a href="https://stokenet-console.radixdlt.com/deploy-package" target="_blank" rel="noopener">Stokenet Developer Console — Deploy Package</a></li>
<li><a href="https://console.radixdlt.com/deploy-package" target="_blank" rel="noopener">Mainnet Developer Console — Deploy Package</a></li>
<li><a href="https://docs.radixdlt.com/docs/concepts-environments" target="_blank" rel="noopener">Radix Environments — Official Docs</a></li>
<li><a href="https://github.com/radixdlt/typescript-radix-engine-toolkit" target="_blank" rel="noopener">TypeScript Radix Engine Toolkit — GitHub</a></li>
</ul>`
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 4. Building a Frontend dApp
  // ─────────────────────────────────────────────
  {
    tagPath: 'developers/build',
    slug: 'frontend-dapp',
    title: 'Building a Frontend dApp',
    excerpt: 'Connect a web application to the Radix Wallet and interact with on-ledger components using the Radix dApp Toolkit.',
    content: [
      {
        id: uid(), type: 'infobox', blocks: [{
          id: uid(), type: 'content',
          text: `<table><tbody>
<tr><td colspan="2"><strong>Building a Frontend dApp</strong></td></tr>
<tr><td>Difficulty</td><td>Intermediate</td></tr>
<tr><td>Est. Time</td><td>60–90 minutes</td></tr>
<tr><td>Prerequisites</td><td>Node.js, a <a href="/developers/build/deploying-packages" rel="noopener">deployed Scrypto package</a></td></tr>
<tr><td>Language</td><td>TypeScript / JavaScript</td></tr>
<tr><td>Key Library</td><td><a href="https://www.npmjs.com/package/@radixdlt/radix-dapp-toolkit" target="_blank" rel="noopener">@radixdlt/radix-dapp-toolkit</a></td></tr>
<tr><td>Scaffolding</td><td><code>npx create-radix-app@latest</code></td></tr>
<tr><td>Official Docs</td><td><a href="https://docs.radixdlt.com/docs/building-a-frontend-dapp" target="_blank" rel="noopener">Building a Frontend dApp</a></td></tr>
</tbody></table>`
        }]
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Introduction</h2>
<p>A Radix dApp consists of two layers: on-ledger <a href="/contents/tech/core-concepts/blueprints-and-packages" rel="noopener">blueprints</a> deployed as Scrypto packages, and an off-ledger frontend that connects to the user's <a href="https://wallet.radixdlt.com/" target="_blank" rel="noopener">Radix Wallet</a> to sign and submit transactions. The <a href="https://github.com/radixdlt/radix-dapp-toolkit" target="_blank" rel="noopener">Radix dApp Toolkit (RDT)</a> is the official TypeScript library that handles wallet connection, session management, data requests, and transaction submission. This guide covers integrating RDT into a web application.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Project Setup</h2>
<p>The fastest way to start is the official scaffolding tool:</p>
<pre><code>npx create-radix-app@latest</code></pre>
<p>This generates a project with RDT pre-configured, the Connect Button wired up, and example transaction code. Alternatively, add RDT to an existing project:</p>
<pre><code>npm install @radixdlt/radix-dapp-toolkit</code></pre>
<h3>Initialising the Toolkit</h3>
<p>Create an RDT instance with your dApp's configuration:</p>
<pre><code>import { RadixDappToolkit, RadixNetwork } from '@radixdlt/radix-dapp-toolkit'

const rdt = RadixDappToolkit({
  dAppDefinitionAddress: 'account_rdx...', // your dApp definition account
  networkId: RadixNetwork.Stokenet,         // or RadixNetwork.Mainnet
  applicationName: 'My dApp',
  applicationVersion: '1.0.0',
})</code></pre>
<p>The <code>dAppDefinitionAddress</code> is a Radix account that you own, registered as your dApp's identity through the <a href="https://console.radixdlt.com/" target="_blank" rel="noopener">Developer Console</a> metadata settings. This is how the wallet identifies your application to the user.</p>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Wallet Connection & Authentication</h2>
<p>RDT provides the <strong>√ Connect Button</strong>, a framework-agnostic web component that handles the full wallet connection flow:</p>
<pre><code>&lt;!-- Add to your HTML --&gt;
&lt;radix-connect-button /&gt;</code></pre>
<p>When a user clicks the button, RDT coordinates with the <a href="https://chromewebstore.google.com/detail/radix-wallet-connector/bfeplaecgkoeckiidkgkmlllfbaanlkl" target="_blank" rel="noopener">Radix Wallet Connector</a> browser extension to establish a connection to the user's mobile wallet. The user authenticates using a <strong>Persona</strong> — a reusable identity that can share selected accounts and personal data with your dApp.</p>
<h3>Requesting Account Data</h3>
<p>Configure what data your dApp needs at connection time:</p>
<pre><code>import { DataRequestBuilder } from '@radixdlt/radix-dapp-toolkit'

rdt.walletApi.setRequestData(
  DataRequestBuilder.accounts().atLeast(1),
  DataRequestBuilder.persona().withProof(),
)</code></pre>
<p>This asks the user to share at least one account address and a cryptographic proof of Persona ownership. For <a href="/contents/tech/core-protocols/rola-authentication" rel="noopener">ROLA (Radix Off-Ledger Authentication)</a>, provide a challenge generator that fetches a 32-byte hex challenge from your backend:</p>
<pre><code>rdt.walletApi.provideChallengeGenerator(async () =&gt; {
  const res = await fetch('/api/auth/challenge')
  return (await res.json()).challenge
})</code></pre>`
      },
      {
        id: uid(), type: 'content',
        text: `<h2>Submitting Transactions</h2>
<p>Radix transactions are built using <a href="/contents/tech/core-protocols/transaction-manifests" rel="noopener">transaction manifests</a> — a declarative syntax that describes what the transaction should do. Your dApp sends a manifest <em>stub</em> to the wallet; the wallet completes it by adding fee payment and any user-specified assertions.</p>
<pre><code>const result = await rdt.walletApi.sendTransaction({
  transactionManifest: \`
    CALL_METHOD
      Address("component_rdx...")
      "buy_token"
      Decimal("100")
    ;
    CALL_METHOD
      Address("\${accountAddress}")
      "deposit_batch"
      Expression("ENTIRE_WORKTOP")
    ;
  \`,
})</code></pre>
<p>The user reviews the transaction in their wallet — seeing exactly which assets move where — signs it, and the wallet submits it to the network. Your dApp receives a transaction hash that you can track via the <a href="/contents/tech/core-protocols/radix-gateway-api" rel="noopener">Gateway API</a>.</p>
<h3>Reacting to Wallet Data</h3>
<p>Subscribe to wallet state changes to update your UI in real time:</p>
<pre><code>rdt.walletApi.walletData$.subscribe((walletData) =&gt; {
  const accounts = walletData.accounts
  // Update UI with connected accounts
})</code></pre>
<h2>External Links</h2>
<ul>
<li><a href="https://github.com/radixdlt/radix-dapp-toolkit" target="_blank" rel="noopener">Radix dApp Toolkit — GitHub</a></li>
<li><a href="https://www.npmjs.com/package/@radixdlt/radix-dapp-toolkit" target="_blank" rel="noopener">@radixdlt/radix-dapp-toolkit — npm</a></li>
<li><a href="https://docs.radixdlt.com/docs/building-a-frontend-dapp" target="_blank" rel="noopener">Building a Frontend dApp — Official Docs</a></li>
<li><a href="https://docs.radixdlt.com/docs/learning-to-run-your-first-front-end-dapp" target="_blank" rel="noopener">Run Your First Frontend dApp — Official Docs</a></li>
<li><a href="https://github.com/radixdlt/wallet-sdk" target="_blank" rel="noopener">Radix Wallet SDK — GitHub</a></li>
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
