# Tx Tool Guide

## Source Paths

Primary source root: `./.repos/radix-web3.js/packages/tx-tool/src`

Key paths:

- `transactionHelper.ts`
- `createTransactionIntent.ts`
- `createTransactionIntentV2.ts`
- `compileTransaction.ts`
- `submitTransaction.ts`
- `transactionStatus.ts`
- `transactionHeader.ts`
- `transactionHeaderV2.ts`
- `intentHash.ts`
- `epoch.ts`
- `previewTransaction.ts`
- `staticallyAnalyzeManifest.ts`
- `staticallyAnalyzeManifestV2.ts`
- `staticallyValidateManifest.ts`
- `inspectSignedPartialTransaction.ts`
- `notaryKeyPair.ts`
- `schemas.ts`
- `signer/signer.ts`
- `manifests/`
- `test-helpers/`

## Mental Model

`packages/tx-tool` is the Effect service layer for Radix transaction execution. It composes manifest helpers, intent builders, signer implementations, Gateway submission, status polling, and optional lifecycle hooks.

The package has two important dependency styles:

- Effect services such as `TransactionHelper`, `CreateTransactionIntent`, `CompileTransaction`, `SubmitTransaction`, and `TransactionStatus` are wired through layers.
- Injectable extension points such as `Signer` and `TransactionLifeCycleHook` are supplied through context so production, test, and agent workflows can swap signing and observation behavior.

`TransactionHelper` is the main orchestrator. Lower services should remain individually testable.

## Examples

Use these examples to keep `packages/tx-tool` changes service-oriented and layer-compatible.

### Submit a manifest with a custom signer

Use this when the caller wants tx-tool to own the transaction lifecycle but wants signing swapped for a test, agent, or Vault signer.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.spec.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/signer/signer.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/compileTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionStatus.ts`
- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`

Pattern: provide `TransactionHelper` with an explicit signer layer and the Gateway config layer required by the target network.

Workflow skeleton:

```ts
import { GatewayApiClient } from "@radix-effects/gateway"
import { HexString } from "@radix-effects/shared"
import { TransactionHelper, Signer } from "@radix-effects/tx-tool"
import { ConfigProvider, Effect, Layer, Redacted } from "effect"

const program = Effect.gen(function*() {
  const tx = yield* TransactionHelper
  const { id, statusResponse } = yield* tx.submitTransaction({ manifest })
  return { id, statusResponse }
})

const signer = Signer.makePrivateKeySigner(
  Redacted.make(HexString.make(privateKeyHex))
)

const GatewayApiClientLayer = GatewayApiClient.Default.pipe(
  Layer.provide(
    ConfigProvider.layer(ConfigProvider.fromUnknown({ NETWORK_ID: 2 }))
  )
)

const TestLayer = TransactionHelper.Default.pipe(
  Layer.provide(GatewayApiClientLayer),
  Layer.provide(signer)
)

const runnable = program.pipe(Effect.provide(TestLayer))
```

Adapt imports and layer names to the actual package exports in the target repo. The private key input to `Signer.makePrivateKeySigner` is a `Redacted<HexString>`, and `TransactionHelper.Default` still needs the Gateway API client layer with the intended `NETWORK_ID`. `GatewayApiClient` reads `NETWORK_ID`, `GATEWAY_URL`, `APPLICATION_NAME`, and optional `GATEWAY_BASIC_AUTH`; `TransactionStatus` reads `TRANSACTION_STATUS_POLL_TIMEOUT`, `TRANSACTION_STATUS_MAX_POLL_ATTEMPTS_COUNT`, and `TRANSACTION_STATUS_POLL_DELAY`.

Done when: callers expect `submitTransaction` and `submitTransactionV2` to resolve to `{ id, statusResponse }` after polling. Polling returns only `CommittedSuccess`; `CommittedFailure` and `PermanentlyRejected` fail with `TransactionFailedError`, unresolved statuses retry as `TransactionNotResolvedError`, and exhausted polling fails with `TimeoutError`.

### Add or change `TransactionHelper` orchestration

Use this when the requested behavior spans manifest preparation, signing, compilation, submission, polling, or lifecycle hooks.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.spec.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/submitTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/manifestHelper.ts`

Pattern: keep `TransactionHelper` as an orchestrator. Put reusable behavior into lower services when it can be tested independently.

Done when: orchestration tests prove service call order, lower services still have focused tests, and the helper result/error shape matches existing callers.

### Provide a transaction lifecycle hook layer

Use this when a caller needs to observe submit, submit success, status failure, or final success without changing transaction execution.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.spec.ts`

Pattern:

```ts
const HookLayer = Layer.succeed(TransactionLifeCycleHook)({
  onSubmit: ({ id }) => Effect.log(`submitting ${id}`),
  onSubmitSuccess: ({ id }) => Effect.log(`submitted ${id}`),
  onStatusFailure: ({ id, permanent }) =>
    Effect.log(`status failure ${id} permanent=${permanent}`),
  onSuccess: ({ id }) => Effect.log(`committed ${id}`)
})

const LayerWithHooks = TransactionHelper.Default.pipe(
  Layer.provide(GatewayApiClientLayer),
  Layer.provide(signer),
  Layer.provide(HookLayer)
)
```

Done when: hook tests prove observer failure behavior is intentional, hook order matches `onSubmit`, Gateway submit, `onSubmitSuccess`, poll failure or success, and hooks do not become required dependencies for callers that do not provide them.

### Use tx-tool test helpers for account setup

Use this when a transaction test needs a real-looking account address, public key, or signature without depending on a wallet.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/test-helpers/createAccount.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/test-helpers/index.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.spec.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/compileTransaction.spec.ts`

Pattern: derive virtual account addresses from generated Ed25519 keys using the same network ID as the Gateway/test layer. Do not hard-code account addresses when the test is about signing, intent hashes, or transaction compilation.

Done when: generated account, public key, signer, and Gateway network ID all agree, and the test would fail if any hard-coded address used the wrong network.

### Add V1 or V2 intent construction behavior

Use this when changing headers, messages, blobs, transaction versioning, or subintent support.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/createTransactionIntent.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/createTransactionIntentV2.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHeader.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHeaderV2.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/schemas.ts`

Pattern: keep version-specific header and intent differences explicit. Do not hide V2 subintent semantics behind V1 helpers.

Done when: V1 and V2 tests cover separate header services, manifest decoding paths, static validation, and the absence or presence of subintent-specific fields.

### Compile, notarize, and hash transactions

Use this when the task touches compiled transaction bytes, intent hashes, notary signatures, or signature encodings.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/compileTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/notaryKeyPair.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/intentHash.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/schemas.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/compileTransaction.spec.ts`

Pattern: keep schema transformations for public keys, signatures, and hex/base64 in `schemas.ts`. Keep transaction assembly in `compileTransaction.ts`.

Done when: schema tests cover malformed key/signature encodings and compile tests prove the notarized transaction uses the same signatures that were collected for the intent hash.

### Add static manifest analysis or validation

Use this when a feature needs to inspect the entities, classification, or validity of a manifest before signing or submission.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifestV2.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyValidateManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifest.spec.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyAnalyzeManifestV2.spec.ts`

Pattern: keep analysis results close to Toolkit output unless the package already has a domain-shaped result. Do not silently skip validation because a manifest is generated internally.

Done when: invalid manifests fail before signing, analysis output is asserted against Toolkit-shaped fields, and V1/V2 analysis paths stay separate where the Toolkit output differs.

### Add or update manifest helpers

Use this when creating package-level helpers for common transaction manifests.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/manifestHelper.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/faucet.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/createBadge.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/createFungibleToken.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/addFeePayer.ts`

Pattern: keep manifest helpers small and composable. If a helper also submits or polls, it belongs in `TransactionHelper`, not `manifests/`.

Done when: helper tests assert emitted RTM only, and submission, polling, fee-payer checks, and lifecycle hooks remain covered by `TransactionHelper` tests.

## Reference Routes

- Private-key test helpers or account creation helpers: inspect `test-helpers/createAccount.ts` and `test-helpers/index.ts`.
- Submit compiled transaction bytes: inspect `submitTransaction.ts`, Gateway API client usage, and transaction helper tests.
- Poll transaction status with retries: inspect `transactionStatus.ts`, retry schedules, and failure tests.
- Preview transaction payloads: inspect `previewTransaction.ts` and Gateway preview types.
- Inspect signed partial transactions: inspect `inspectSignedPartialTransaction.ts` and `inspectSignedPartialTransaction.spec.ts`.
- Debug fee payer XRD balance checks: inspect `transactionHelper.ts`, `GetFungibleBalance` usage, and known address lookup.
- Debug lifecycle hook execution: inspect `TransactionLifeCycleHook` in `transactionHelper.ts` and hook call ordering.

Routing check: adjacent routing chooses either a lower service file, `TransactionHelper`, or a manifest helper based on the behavior being changed.

## Usage Notes

- Keep manifest construction separate from transaction lifecycle orchestration.
- Use `submitTransactionV2` and V2 intent files for subintent or pre-authorization workflows.
- Do not hide signing behind globals. Provide `Signer` explicitly through Effect context or package-supported layers.
- Preserve lifecycle hook optionality. Hooks should observe transaction events without becoming required dependencies.
- Check XRD fee payer balance logic, epoch bounds, notary key, signer public key, and network ID before changing submission behavior.
- Use `schemas.ts` for boundary transformations between branded strings, Radix Engine Toolkit objects, messages, headers, and signatures.
- When adding service behavior, update focused tests near the service, such as `transactionHelper.spec.ts`, `compileTransaction.spec.ts`, or static analysis specs.
