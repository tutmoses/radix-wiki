// Sweep 406 — /contents/tech/core-concepts/finite-state-machines
//
// Closes the run-393 backlog item. The page was the thinnest in contents/tech
// (5.6 KB, last touched 20 July 2026, never verified) and its infobox contained a
// YouTube iframe and no facts table, breaking the infobox-first rule this wiki
// applies everywhere else. Two further problems were worse than the thinness:
//
//   1. "Most DeFi breaches on Ethereum arise from the intricacies associated with
//      SCs" was an unsourced superlative.
//   2. "Radix has strategically incorporated Finite State Machines into its
//      architecture" is not a claim Radix's own documentation makes, and the worked
//      example that followed it ("from initiation, to validation, to execution, and
//      finally to completion") described nothing that exists, in the conditional.
//
// This rewrite keeps both videos, puts a facts table in the infobox, sources the
// formal definition to the NIST Dictionary of Algorithms and Data Structures, and
// replaces the Radix section with the lifecycle that IS an enumerated state machine
// and is documented as such at source:
//
//   docs.radixdlt.com/docs/concepts-transactions  — permanent rejection, temporary
//        rejection, committed success, committed failure; an intent commits once
//   docs.radixdlt.com/docs/transaction-tracker    — the native component holding the
//        status by intent hash, IntentHashPreviouslyCommitted, the cancelled status
//        with no public API, and the partition ring-buffer that keeps state finite
//   docs.radixdlt.com/docs/transaction-overview   — intents and subintents
//
// All four docs URLs and the NIST entry were probed 200 on 11 September 2026.

import pg from 'pg';
import { config } from 'dotenv';
import { uid, cuid, AUTHOR_ID, isLockedPage } from './seed-utils.mjs';
config();

const TAG_PATH = 'contents/tech/core-concepts';
const SLUG = 'finite-state-machines';
const SENTINEL = 'Finite state machines in Radix';

const DRY = process.argv.includes('--dry-run');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const INFOBOX_TABLE = [
  '<table>',
  '<tr><td><strong>Type</strong></td><td>Model of computation</td></tr>',
  '<tr><td><strong>Formal definition</strong></td><td>A set of states, a start state, an input alphabet, and a transition function mapping an input symbol and the current state to a next state</td></tr>',
  '<tr><td><strong>Common variants</strong></td><td>Mealy machine (outputs on transitions), Moore machine (outputs on states), deterministic and nondeterministic</td></tr>',
  '<tr><td><strong>Where it appears in Radix</strong></td><td>The transaction intent lifecycle, enforced on-ledger by the <a href="/contents/tech/core-concepts/transaction-tracker">Transaction Tracker</a></td></tr>',
  '<tr><td><strong>Related</strong></td><td><a href="/contents/tech/core-protocols/radix-engine">Radix Engine</a>, <a href="/contents/tech/core-concepts/transaction-processor">Transaction Processor</a>, <a href="/contents/tech/core-concepts/subintents-and-pre-authorizations">Subintents and pre-authorizations</a>, <a href="/contents/tech/core-concepts/asset-oriented-programming">Asset-oriented programming</a></td></tr>',
  '</table>',
].join('');

const INTRO = [
  '<p><strong>Finite state machines</strong> (<strong>FSMs</strong>) are a model of computation in which a system occupies exactly one of a finite set of states at a time and moves between them only through defined transitions. The <a href="https://xlinux.nist.gov/dads/HTML/finiteStateMachine.html" target="_blank" rel="noopener">NIST Dictionary of Algorithms and Data Structures defines one</a> as a set of states, a start state, an input alphabet and a transition function that maps an input symbol and the current state to a next state. Variants attach outputs to transitions (a Mealy machine) or to states (a Moore machine), and a nondeterministic machine allows more than one transition for a given symbol and state.</p>',
  '<p>The property that makes the model useful where failure is expensive is that the reachable states can be enumerated in advance. Behaviour that is not a defined transition cannot occur, so questions about what a system might do become questions about a finite table rather than about arbitrary code. This is why the model is standard in embedded and safety-critical control software, and it is the reason it is worth asking, of any ledger, which parts of it are a state machine and which parts only look like one.</p>',
].join('');

// The infobox video, preserved verbatim from the block it is being moved out of.
const INFOBOX_VIDEO = '<div data-youtube-video=""><iframe width="640" height="480" allowfullscreen="true" autoplay="false" disablekbcontrols="false" enableiframeapi="false" endtime="0" ivloadpolicy="0" loop="false" modestbranding="true" origin="" playlist="" rel="1" src="https://www.youtube-nocookie.com/embed/4rNYAvsSkwk?modestbranding=1&amp;rel=1" start="0"></iframe></div>';
const BODY_VIDEO = '<div data-iframe-embed="" class="iframe-embed"><iframe src="https://www.youtube.com/embed/Z5jLiR11gtY?rel=0" width="100%" height="400" frameborder="0" allowfullscreen="true"></iframe></div>';

const BODY = [
  '<h2>Overview</h2>',
  '<p>An FSM processes inputs and transitions between states according to a fixed set of rules. Each state represents one condition or phase of the system, and the machine is in exactly one of them at any moment. The constraint is the point: by refusing to represent anything outside the declared states, the model trades expressive power for the ability to reason exhaustively about outcomes.</p>',
  INFOBOX_VIDEO,
  BODY_VIDEO,
  '<h2>Contract state versus machine state</h2>',
  '<p>A conventional smart contract platform does not present a finite state machine to the people using it. An Ethereum contract keeps its own internal variables and exposes methods that may change them, so an <a href="https://eips.ethereum.org/EIPS/eip-20" target="_blank" rel="noopener">ERC-20</a> balance is a number in a mapping inside the token contract rather than a state of the system, and the contract’s own code decides who may change it and when. A transaction touching several contracts produces a sequence of internal changes in each of them, and the set of end states the interaction can reach is whatever that code permits rather than an enumerated list. This is a deliberate trade in service of <a href="https://ethereum.org" target="_blank" rel="noopener">Ethereum</a>’s general-computation model, and it is the trade that makes the reachable-state question hard to answer for a composed system.</p>',
  '<h2>' + SENTINEL + '</h2>',
  '<p>Radix’s documentation does not describe the <a href="/contents/tech/core-protocols/radix-engine">Radix Engine</a> as a finite state machine and this page does not claim that it is one. What the documentation does define, in a small enumerated set with transitions enforced on-ledger, is the lifecycle of a transaction intent.</p>',
  '<p>A user transaction is built around a core transaction <a href="/contents/tech/core-concepts/subintents-and-pre-authorizations">intent</a>, identified by its intent hash. Once a payload is submitted, the documented outcomes are <a href="https://docs.radixdlt.com/docs/concepts-transactions" target="_blank" rel="noopener">permanent rejection, temporary rejection, committed success or committed failure</a>. A payload is permanently rejected when it is never possible for it to be committed, for example because it is statically invalid or its epoch window has passed; it is temporarily rejected when commitment may still be possible. Committed failure pays fees up to the failure point and discards every other event and state change; committed success commits all changes and pays fees. Only committed transactions appear in the transaction stream, so a rejected one never enters the ledger’s history. The documentation advises waiting or resubmitting on a temporary rejection, which makes it the lifecycle’s only non-final state.</p>',
  '<p>The uniqueness of the transition is enforced by a component on the ledger rather than by convention. The <a href="/contents/tech/core-concepts/transaction-tracker">Transaction Tracker</a> is a native component that <a href="https://docs.radixdlt.com/docs/transaction-tracker" target="_blank" rel="noopener">stores the success or failure of each recently executed transaction keyed by its intent hash</a>, which lets the executor validate a newly submitted intent hash before executing it and reject a duplicate with <code>IntentHashPreviouslyCommitted</code>. The engine therefore guarantees that a given intent is committed no more than once even though a notary may notarise and submit several different payloads for the same intent. The tracker already carries a cancelled status and the executor is ready to interpret it as <code>IntentHashPreviouslyCancelled</code>, but no public API for cancelling a transaction exists yet.</p>',
  '<p>The tracker keeps that state finite by expiring it. A transaction is valid only within its configured epoch range and that range is hard-capped, so records are only needed for transactions whose range ends after the current epoch. They are held in a ring buffer over partitions 65 to 255, each partition covering 100 epochs, giving 19,100 epochs of capacity against a maximum transaction epoch range of 8,640; the over-allocation means more than half the buffer is empty at any moment by design.</p>',
  '<p>The asset model is the second place the analogy holds. On Radix a token is a <a href="/contents/tech/core-concepts/resources">resource</a> held in a <a href="/contents/tech/core-concepts/buckets-proofs-and-vaults">vault</a>, and moving it means moving it between vaults rather than rewriting a balance variable that a contract owns. Where a resource sits is the state, and no code path can leave it in two places or in neither. That is enforced by the engine for every application on the network, which is the difference between a state machine a developer chooses to implement and one the platform imposes. See <a href="/contents/tech/core-concepts/asset-oriented-programming">asset-oriented programming</a> and <a href="/contents/tech/core-concepts/native-assets-vs-token-approvals">native assets versus token approvals</a>.</p>',
  '<h2>References</h2>',
  '<ol>',
  '<li>National Institute of Standards and Technology. <a href="https://xlinux.nist.gov/dads/HTML/finiteStateMachine.html" target="_blank" rel="noopener">finite state machine</a>. Dictionary of Algorithms and Data Structures. Read 11 September 2026.</li>',
  '<li>RDX Works. <a href="https://docs.radixdlt.com/docs/concepts-transactions" target="_blank" rel="noopener">Transactions</a>. Radix Technical Documentation. Read 11 September 2026.</li>',
  '<li>RDX Works. <a href="https://docs.radixdlt.com/docs/transaction-tracker" target="_blank" rel="noopener">Transaction Tracker</a>. Radix Technical Documentation. Read 11 September 2026.</li>',
  '<li>RDX Works. <a href="https://docs.radixdlt.com/docs/transaction-overview" target="_blank" rel="noopener">Transaction Overview</a>. Radix Technical Documentation. Read 11 September 2026.</li>',
  '<li>Ethereum. <a href="https://eips.ethereum.org/EIPS/eip-20" target="_blank" rel="noopener">EIP-20: Token Standard</a>. Ethereum Improvement Proposals.</li>',
  '</ol>',
].join('');

try {
  if (isLockedPage(TAG_PATH, SLUG)) throw new Error(`${SLUG} is LOCKED`);
  const { rows } = await client.query(
    'SELECT id, title, version, content FROM pages WHERE tag_path = $1 AND slug = $2', [TAG_PATH, SLUG]);
  if (!rows.length) throw new Error('page not found');
  const page = rows[0];

  const blocks = JSON.parse(JSON.stringify(page.content));
  if (JSON.stringify(blocks).includes(SENTINEL)) {
    console.log('  already applied — no write');
    process.exit(0);
  }
  if (blocks.length !== 3 || blocks[0]?.type !== 'infobox') {
    throw new Error(`unexpected shape: ${blocks.length} blocks, first is ${blocks[0]?.type}`);
  }
  // The infobox video must be carried over verbatim, so confirm it is where we think.
  if (!blocks[0].blocks[0].text.includes('4rNYAvsSkwk')) throw new Error('infobox video not found');
  if (!blocks[2].text.includes('Z5jLiR11gtY')) throw new Error('body video not found');

  const next = [
    { id: blocks[0].id, type: 'infobox', blocks: [{ id: blocks[0].blocks[0].id, type: 'content', text: INFOBOX_TABLE }] },
    { id: blocks[1].id, type: 'content', text: INTRO },
    { id: blocks[2].id, type: 'content', text: BODY },
  ];

  const version = '2.0.0';
  const beforeChars = JSON.stringify(blocks).length;
  const afterChars = JSON.stringify(next).length;
  console.log(`  ${DRY ? '[dry] ' : ''}${page.title}  v${page.version} -> v${version}  ${beforeChars} -> ${afterChars} chars`);
  if (DRY) {
    console.log('  infobox :', INFOBOX_TABLE.slice(0, 120));
    console.log('  intro   :', INTRO.slice(0, 120));
    console.log('  body    :', BODY.slice(0, 120));
    console.log('  videos kept:', ['4rNYAvsSkwk', 'Z5jLiR11gtY'].filter((v) => JSON.stringify(next).includes(v)).join(', '));
  } else {
    const now = new Date().toISOString();
    const json = JSON.stringify(next);
    await client.query('BEGIN');
    await client.query('UPDATE pages SET content=$1, version=$2, updated_at=$3, last_verified_at=$3 WHERE id=$4',
      [json, version, now, page.id]);
    await client.query(
      `INSERT INTO revisions (id, page_id, content, title, version, change_type, author_id, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [cuid(), page.id, json, page.title, version, 'major', AUTHOR_ID,
        'Rewrite. The infobox held a YouTube iframe and no facts table, breaking the infobox-first rule; it now carries one and both videos move into the body. The formal definition is sourced to the NIST Dictionary of Algorithms and Data Structures. The unsourced claim that most DeFi breaches arise from smart contract complexity is removed, and the unsourced "Radix has strategically incorporated FSMs into its architecture" section, whose worked example was written in the conditional and described nothing that exists, is replaced by the transaction intent lifecycle as documented at source: the four outcomes in docs.radixdlt.com/docs/concepts-transactions, the Transaction Tracker enforcing commit-once by intent hash, its cancelled status with no public API, and the partition ring buffer that bounds the state. Adds a reference list and internal links to Transaction Tracker, subintents, resources, vaults and asset-oriented programming.',
        now]);
    await client.query('COMMIT');
    console.log('  written.');
  }
} finally {
  client.release();
  await pool.end();
}
