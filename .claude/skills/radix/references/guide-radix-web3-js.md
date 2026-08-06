# Radix Web3.js Guide

## Source Paths

Primary source root: `./.repos/radix-web3.js`

Key paths:

- `packages/core/src/`
- `packages/gateway/src/`
- `packages/tx-tool/src/`
- `packages/connect/src/`
- `packages/sbor/src/`
- `packages/shared/src/`
- `packages/agent-toolkit/src/`
- `packages/transaction-stream/src/`
- `packages/cli/src/`
- `examples/x402/src/`

## Mental Model

`radix-web3.js` is a TypeScript monorepo of focused Radix packages. Package boundaries matter:

- `core` holds low-level account, keypair, network, manifest, and transaction helpers.
- `gateway` wraps Radix Gateway queries and common ledger read workflows.
- `tx-tool` owns the transaction lifecycle: build intent, sign, compile, submit, and poll.
- `connect` owns wallet interaction, crypto helpers, transports, and ROLA message construction.
- `sbor` owns programmatic SBOR helpers.
- `shared` owns reusable Effect schemas and branded Radix primitive types.
- `agent-toolkit` exposes agent-facing tools built on the lower packages.
- `transaction-stream` owns Effect streams over Gateway transaction pages.
- `cli` contains agent-first transaction workflow artifacts and out-of-band signing flows.
- `examples/x402` contains application-level payment middleware, validation, facilitator, and settlement examples.

Start from the package that owns the user-facing behavior, then follow imports to lower packages.

## Examples

Use these examples to choose the package boundary before opening lower-level files.

### Add an agent tool that sends XRD

Use this when the user asks for an agent-facing transfer tool or a plugin command that should create and submit an XRD transfer.

Start with:

- `./.repos/radix-web3.js/packages/agent-toolkit/src/plugins/core/tools/sendXrd.ts`
- `./.repos/radix-web3.js/packages/core/src/manifests/sendResourceManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./references/guide-core.md`
- `./references/guide-tx-tool.md`

Pattern:

1. Keep tool input parsing in `agent-toolkit`.
2. Keep manifest construction in `core`.
3. Keep signing, submission, and polling in `tx-tool`.
4. Verify with the nearest `agent-toolkit` test before touching shared transaction code.

Done when: the agent tool, core manifest helper, and tx-tool submission path each own only their layer, and the nearest package test proves the integration.

### Add an agent tool that submits arbitrary manifests

Use this when a tool accepts an RTM manifest or transaction payload rather than building a specific transfer.

Start with:

- `./.repos/radix-web3.js/packages/agent-toolkit/src/plugins/core/tools/sendTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyValidateManifest.ts`
- `./references/guide-connect.md`
- `./references/guide-tx-tool.md`

Pattern:

```ts
// Shape only; adapt to current exports.
const manifest = parseToolInput(input)
const result = yield* transactionHelper.submitTransaction({ manifest })
```

Boundary rule: validate user/tool input at the tool edge, but route manifest submission through `TransactionHelper.submitTransaction`. The lower `SubmitTransaction` service accepts compiled transaction bytes, not RTM manifests.

Done when: arbitrary RTM input is validated at the tool edge, submitted through `TransactionHelper`, and tests prove lower compiled-byte services are not called directly with RTM.

### Add an account-read capability

Use this when the user asks for balances, account details, NFTs, or resource ownership through a higher-level package.

Start with:

- `./.repos/radix-web3.js/packages/agent-toolkit/src/plugins/core/tools/getAccount.ts`
- `./.repos/radix-web3.js/packages/gateway/src/state/stateEntityDetails.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getFungibleBalance.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getNonFungibleBalance.ts`
- `./references/guide-account.md`

Pattern: keep response shaping minimal in `agent-toolkit`; prefer Gateway-shaped data plus JSON-safe normalization over inventing a portfolio model.

Done when: account read output can be traced to Gateway fields and richer account semantics route to `guide-account.md`.

### Add a new manifest helper

Use this when the requested behavior is a reusable RTM builder rather than a full transaction submission workflow.

Start with:

- `./.repos/radix-web3.js/packages/core/src/manifests/sendResourceManifest.ts`
- `./.repos/radix-web3.js/packages/core/src/manifests/index.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/manifestHelper.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./references/guide-core.md`
- `./references/guide-transaction-manifest.md`

Pattern:

1. Put pure manifest string construction in `core` or `tx-tool/manifests`.
2. Use Rust manifest builder/source to verify instruction names and argument order.
3. Add a focused test that compares the generated manifest string or compiles it.

Done when: manifest helper ownership is clear, generated RTM is verified, and transaction submission remains outside the helper.

### Add wallet or ROLA behavior

Use this when the task mentions account/persona sharing, wallet transports, challenge signing, or proof verification.

Start with:

- `./.repos/radix-web3.js/packages/connect/src/client.ts`
- `./.repos/radix-web3.js/packages/connect/src/schemas/walletInteraction.ts`
- `./.repos/radix-web3.js/packages/connect/src/rola/createRolaMessage.ts`
- `./.repos/radix-web3.js/packages/gateway/src/rola.ts`
- `./references/guide-connect.md`
- `./references/guide-wallet-rola.md`

Pattern: keep wallet request construction in `connect`; keep server-side ledger verification in `gateway`; keep application session logic outside ROLA.

Done when: wallet, Gateway ROLA, and session concerns are in separate packages or app layers, with proof shape normalization tested at the boundary.

### Add x402 payment behavior

Use this when working on sponsored payment flows, facilitator behavior, resource server middleware, exact Radix payment payloads, or settlement cache behavior.

Start with:

- `./.repos/radix-web3.js/examples/x402/src/paymentMiddleware.ts`
- `./.repos/radix-web3.js/examples/x402/src/paymentValidation.ts`
- `./.repos/radix-web3.js/examples/x402/src/facilitator.ts`
- `./.repos/radix-web3.js/examples/x402/src/settlement.ts`
- `./references/guide-x402.md`

Pattern: load the dedicated x402 guide first. It owns example-app payment validation, middleware, facilitator, settlement, and cache routing.

Done when: x402 changes are made from `guide-x402.md` and do not hide payment middleware behavior inside generic package-boundary notes.

## Reference Routes

- Plugin registration or exports: inspect `packages/agent-toolkit/src/plugins/index.ts`, `packages/agent-toolkit/src/plugins/core/index.ts`, and `packages/agent-toolkit/src/index.ts`.
- Low-level transaction compile/decompile helpers: inspect `packages/core/src/transaction/helpers/compileTransaction.ts`, `decompileTransaction.ts`, `getIntentHash.ts`, and `verifyTransaction.ts`.
- Account or persona helpers: inspect `packages/core/src/account/index.ts` and `packages/core/src/persona/index.ts`.
- Keypair or signing behavior: inspect `packages/core/src/keypairs/ed25519.ts`, `packages/connect/src/crypto/ed25519.ts`, and `packages/tx-tool/src/signer/signer.ts`.
- Network helpers: inspect `packages/core/src/network/getRadixGatewayBaseUrl.ts`, `previewTransaction.ts`, `submitTransaction.ts`, and `pollTransactionStatus.ts`.
- SBOR helpers or native decoding: inspect `packages/sbor/src/index.ts`, `native.ts`, and `packages/gateway/src/sbor.ts`.
- Shared branded types or schemas: inspect `packages/shared/src/brandedTypes.ts`, `packages/shared/src/schemas/`, then use `guide-shared.md`.
- Transaction stream behavior: inspect `packages/transaction-stream/src/streamer.ts`, `config.ts`, and `schemas.ts`, then use `guide-transaction-stream.md`.
- CLI workflow behavior: inspect `packages/cli/src/cli.ts`, then use `guide-cli.md`.

Routing check: adjacent routing identifies the owning package before opening lower-level implementation files.

## Usage Notes

- Prefer package-local patterns over cross-package shortcuts.
- When a package has a `CONTEXT.md`, read it before naming domain concepts.
- Use tests in the same package as the implementation as the first examples.
- Do not assume APIs from older Radix packages; inspect current package exports.
