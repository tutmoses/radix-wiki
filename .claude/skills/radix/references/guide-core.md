# Core Guide

## Source Paths

Primary source root: `./.repos/radix-web3.js/packages/core/src`

Key paths:

- `client/index.ts`
- `client/createHookahFungibleToken.ts`
- `keypairs/ed25519.ts`
- `account/index.ts`
- `persona/index.ts`
- `manifests/sendResourceManifest.ts`
- `manifests/getXrdFromFaucet.ts`
- `transaction/helpers/compileTransaction.ts`
- `transaction/helpers/decompileTransaction.ts`
- `transaction/helpers/transformTransactionManifest.ts`
- `transaction/helpers/getIntentHash.ts`
- `transaction/helpers/getKnownAddresses.ts`
- `transaction/transactionHeader.ts`
- `transaction/transactionMessage.ts`
- `transaction/transformStringManifest.ts`
- `network/getRadixGatewayBaseUrl.ts`
- `network/previewTransaction.ts`
- `network/submitTransaction.ts`
- `network/pollTransactionStatus.ts`
- `network/sborHelper.ts`

Related paths:

- `./.repos/radix-web3.js/packages/tx-tool/src`
- `./.repos/radix-web3.js/packages/gateway/src`
- `./.repos/radix-web3.js/packages/agent-toolkit/src/wallet/RadixWalletClient.ts`
- `./references/guide-transaction-manifest.md`
- `./references/guide-transactions.md`

## Mental Model

`radix-web3.js` core is the low-level TypeScript facade over Radix Engine Toolkit and Gateway primitives. It is promise-based, not the Effect service layer. Use it when the task needs a public client, keypair helpers, simple manifest builders, address derivation, transaction compile/decompile helpers, or network submission/polling.

Keep these boundaries:

- Core builds public helpers and client ergonomics.
- `tx-tool` owns Effect-based transaction lifecycle services.
- `gateway` owns typed Gateway query services.
- `connect` owns wallet interaction transport.
- `agent-toolkit` adapts public APIs to agent tools.

## Examples

Use these examples when a task touches the public `radix-web3.js` client or low-level toolkit helpers.

### Create or extend the public web3 client

Use this when adding a public method to `createRadixWeb3Client` or debugging client orchestration.

Start with:

- `./.repos/radix-web3.js/packages/core/src/client/index.ts`
- `./.repos/radix-web3.js/packages/core/src/client/index.spec.ts`
- `./.repos/radix-web3.js/packages/core/src/network/index.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/index.ts`

Pattern: resolve public options at the client edge, then delegate to manifest, transaction, and network helpers. Preserve default signer/notarizer error behavior so missing private-key material fails before submission.

Done when: public client tests cover default options, explicit overrides, missing signer/notary material, and delegation to the intended lower helper.

### Add a manifest helper

Use this when a reusable manifest should be consumed by the public client or agent-toolkit.

Start with:

- `./.repos/radix-web3.js/packages/core/src/manifests/sendResourceManifest.ts`
- `./.repos/radix-web3.js/packages/core/src/manifests/getXrdFromFaucet.ts`
- `./.repos/radix-web3.js/packages/core/src/manifests/types.ts`
- `./references/guide-transaction-manifest.md`

Pattern:

```ts
export const helper =
  (accountAddress: string) =>
  ({ getKnownAddresses }: ManifestHelper) =>
    getKnownAddresses().then((known) =>
      new ManifestBuilder()
        .callMethod(known.componentAddresses.faucet, "free", [])
        .build()
    )
```

Rule: use `ManifestHelper` when the helper needs network-specific known addresses. Use direct parameters when all addresses are explicit.

Done when: helper tests prove known-address lookup is used only when needed and generated RTM is validated or compared against manifest examples.

### Add or review a public token-creation helper

Use this when a public client helper emits RTM for creating a fungible resource and depositing the initial supply.

Start with:

- `./.repos/radix-web3.js/packages/core/src/client/createHookahFungibleToken.ts`
- `./.repos/radixdlt-scrypto/radix-transactions/examples/resources/worktop.rtm`
- `./.repos/radixdlt-scrypto/radix-transactions/src/builder/manifest_builder.rs`
- `./references/guide-transaction-manifest.md`
- `./references/guide-access-rules.md`

Pattern: verify every hard-coded manifest enum against Rust examples or builder source: owner role, resource divisibility, metadata entries, metadata role table, initial supply, and final account deposit. Keep token-specific defaults such as name, symbol, and supply explicit in the helper or expose them as parameters.

Rule: do not copy opaque `Enum<...>` payloads into a new helper without tracing their type through `guide-transaction-manifest.md` and `guide-access-rules.md`.

Done when: every hard-coded enum or role payload is traced to Rust source and the helper test covers invalid manifest or static-validation failure.

### Convert manifest strings through Radix Engine Toolkit

Use this when a public API accepts either RTM text or a parsed toolkit manifest.

Start with:

- `./.repos/radix-web3.js/packages/core/src/transaction/helpers/transformTransactionManifest.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/transformStringManifest.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/helpers/compileTransaction.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/helpers/decompileTransaction.ts`
- `./references/guide-transaction-manifest.md`

Pattern: if the manifest is a string, convert it with the target network ID before intent creation. Preserve blob handling when callers provide compiled manifests with blobs.

Done when: string and parsed manifest inputs both produce expected toolkit output, and blob handling is covered by tests.

### Add keypair or virtual address behavior

Use this when a task involves local Ed25519 keys, virtual account derivation, or virtual identity derivation.

Start with:

- `./.repos/radix-web3.js/packages/core/src/keypairs/ed25519.ts`
- `./.repos/radix-web3.js/packages/core/src/keypairs/helpers/randomBytes.ts`
- `./.repos/radix-web3.js/packages/core/src/account/index.ts`
- `./.repos/radix-web3.js/packages/core/src/persona/index.ts`
- `./references/guide-wallet-rola.md`

Pattern: create keys through toolkit `PrivateKey.Ed25519`; derive account or identity addresses through toolkit derivation helpers with explicit network ID. Do not derive addresses from Gateway responses.

Done when: key, account, and identity derivation tests cover network ID and fail if account and persona helpers are swapped.

### Submit and poll through network helpers

Use this when changing transaction submission, status polling, retry, timeout, or abort behavior in the public client.

Start with:

- `./.repos/radix-web3.js/packages/core/src/network/submitTransaction.ts`
- `./.repos/radix-web3.js/packages/core/src/network/pollTransactionStatus.ts`
- `./.repos/radix-web3.js/packages/core/src/network/pollTransactionStatus.spec.ts`
- `./.repos/radix-web3.js/packages/core/src/client/index.ts`

Pattern: submit compiled transaction bytes first, then poll by transaction ID until Gateway status is not `Pending`. Keep abort handling and retry delay options in the polling helper rather than in every caller.

Done when: tests cover submit success, pending retry, committed failure/rejection, timeout or abort, and retry delay configuration.

### Work with transaction headers and messages

Use this when the transaction needs custom epoch windows, nonce, notary settings, or a string message.

Start with:

- `./.repos/radix-web3.js/packages/core/src/transaction/transactionHeader.ts`
- `./.repos/radix-web3.js/packages/core/src/transaction/transactionMessage.ts`
- `./.repos/radix-web3.js/packages/core/src/client/index.ts`
- `./references/guide-transactions.md`

Pattern: keep defaults in header/message helpers and pass explicit overrides through client options. Do not hide network ID or notary public key assumptions inside manifest helpers.

Done when: header/message tests cover defaults, explicit overrides, epoch window, nonce, notary public key, and message encoding.

## Reference Routes

- Compile/decompile transaction bytes: inspect `compileTransaction.ts`, `decompileTransaction.ts`, and toolkit transaction models.
- Get known addresses: inspect `getKnownAddresses.ts` and network-specific manifest helpers.
- Preview from core: inspect `network/previewTransaction.ts` and compare with Gateway/tx-tool preview wrappers.
- SBOR conversion at network boundary: inspect `network/sborHelper.ts` and `guide-sbor.md`.
- Public package exports: inspect `index.ts`, package `exports`, and README before changing import surface.
- Agent-toolkit client use: inspect `packages/agent-toolkit/src/wallet/RadixWalletClient.ts`.

Routing check: adjacent routing keeps promise-based public API changes in core and Effect service changes in tx-tool.

## Usage Notes

- Use core for promise-based public APIs; use `tx-tool` for Effect services.
- Keep network ID explicit when converting manifests or deriving addresses.
- Do not put wallet transport behavior in core.
- Add focused tests for public client behavior and transaction polling changes.
