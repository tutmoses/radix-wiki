# x402 Guide

## Source Paths

Primary source root: `./.repos/radix-web3.js/examples/x402/src`

Key paths:

- `paymentPayload.ts`
- `paymentPayload.test.ts`
- `paymentRequirements.ts`
- `paymentRequirements.test.ts`
- `paymentValidation.ts`
- `paymentValidation.test.ts`
- `paymentMiddleware.ts`
- `paymentMiddleware.test.ts`
- `facilitator.ts`
- `facilitator.test.ts`
- `settlement.ts`
- `settlement.test.ts`
- `settlementCache.ts`
- `settlementCache.test.ts`
- `exactRadix.ts`
- `exactRadix.test.ts`
- `config.ts`
- `config.test.ts`
- `server.ts`
- `server.test.ts`
- `serverMain.ts`
- `worker.ts`
- `worker-configuration.d.ts`

Related paths:

- `./.repos/radix-web3.js/examples/x402/x402.config.template.json`
- `./.repos/radix-web3.js/examples/x402/wrangler.jsonc`
- `./.repos/radix-web3.js/examples/x402/protected/reference.md`
- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./.repos/radix-web3.js/packages/core/src/manifests/sendResourceManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/inspectSignedPartialTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./references/guide-transactions.md`
- `./references/guide-shared.md`

## Mental Model

x402 support is an example application flow, not a core Radix transaction primitive. Keep these boundaries separate:

- resource server describes payment requirements and protects routes
- payer sends an x402 payment header containing signed partial transaction hex
- settlement path inspects that signed partial transaction before trusting payer details
- exact-payment validation compares the signed Subintent manifest to deterministic requirements
- facilitator builds, previews, submits, and waits for a sponsored root transaction
- middleware serves protected content only after settlement returns `CommittedSuccess`

Do not merge resource-server middleware, signed partial transaction inspection, exact-payment validation, facilitator settlement, and protected content serving into one helper.

## Examples

Use these examples when working on x402 payment flows in the Radix example app.

### Parse and validate a signed payment payload

Use this when the resource server or facilitator receives an `X-PAYMENT` header and must decide whether the signed partial transaction is acceptable before submitting anything on-ledger.

Start with:

- `./.repos/radix-web3.js/examples/x402/src/paymentPayload.ts`
- `./.repos/radix-web3.js/examples/x402/src/paymentRequirements.ts`
- `./.repos/radix-web3.js/examples/x402/src/paymentValidation.ts`
- `./.repos/radix-web3.js/examples/x402/src/settlement.ts`
- `./.repos/radix-web3.js/examples/x402/src/paymentPayload.test.ts`
- `./.repos/radix-web3.js/examples/x402/src/paymentValidation.test.ts`
- `./references/guide-subintents.md`

Pattern: decode JSON as `payload.transaction`, inspect the signed partial transaction, require mainnet network id `1`, require the expected intent discriminator, require at least one root Subintent signature, reject nested Subintents, extract the payer account from `withdraw`, then compare the normalized Subintent manifest to `paymentSubintentManifest`.

Done when: malformed payment headers fail as `InvalidPaymentPayloadError`, wrong network fails as `UNSUPPORTED_NETWORK`, unsigned payloads fail as `MISSING_SIGNATURE`, nested Subintents fail as `NESTED_SUBINTENTS_UNSUPPORTED`, missing payer withdrawal fails as `PAYER_ACCOUNT_NOT_FOUND`, and non-exact manifests fail as `NON_EXACT_PAYMENT_SUBINTENT`.

### Settle an accepted x402 payment

Use this when validation has accepted the payment and the facilitator must submit or coordinate Radix settlement.

Start with:

- `./.repos/radix-web3.js/examples/x402/src/settlement.ts`
- `./.repos/radix-web3.js/examples/x402/src/settlement.test.ts`
- `./.repos/radix-web3.js/examples/x402/src/facilitator.ts`
- `./.repos/radix-web3.js/examples/x402/src/facilitator.test.ts`
- `./.repos/radix-web3.js/packages/core/src/manifests/sendResourceManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/transactionHelper.ts`
- `./references/guide-transactions.md`

Pattern: keep resource-server validation, facilitator settlement, transaction lifecycle, and response shaping in separate functions. Settlement may use manifest helpers and transaction tooling, but it should not redefine payment requirement parsing.

Rule: `createSponsoredSettlement` inspects signed partial transaction hex, validates the exact payment Subintent, then delegates only the validated payer account and Subintent hash to settlement. `createFacilitatorSettlementBackend` builds a sponsored root manifest, previews, submits, and waits for committed success.

Done when: accepted payments are inspected before settlement, sponsored settlement previews before submit, the server waits for `CommittedSuccess`, and tests prove exact validation is not bypassed.

### Add resource-server middleware behavior

Use this when protecting a route, returning payment requirements, or accepting a paid request after x402 verification.

Start with:

- `./.repos/radix-web3.js/examples/x402/src/paymentMiddleware.ts`
- `./.repos/radix-web3.js/examples/x402/src/paymentMiddleware.test.ts`
- `./.repos/radix-web3.js/examples/x402/src/paymentRequirements.ts`
- `./.repos/radix-web3.js/examples/x402/src/server.ts`
- `./.repos/radix-web3.js/examples/x402/src/worker.ts`

Pattern: middleware should return structured payment requirements when `X-PAYMENT` is missing, reject malformed payment headers as `invalid_payment_payload`, call settlement for decoded signed partial transaction hex, reject any non-`CommittedSuccess` settlement as `payment_not_settled`, and pass downstream only after committed settlement.

Rule: the middleware owns in-memory settlement records for the runnable example, but it does not own Radix signing keys. Failed settlement and submitted-but-not-committed states must not unlock the protected route.

Done when: tests cover unpaid request, invalid payment header, settlement failure, submitted-but-not-committed response, committed settlement, and downstream handler invocation.

### Configure exact Radix payment requirements

Use this when changing networks, resource addresses, recipients, amounts, or server configuration.

Start with:

- `./.repos/radix-web3.js/examples/x402/src/config.ts`
- `./.repos/radix-web3.js/examples/x402/src/config.test.ts`
- `./.repos/radix-web3.js/examples/x402/src/exactRadix.ts`
- `./.repos/radix-web3.js/examples/x402/src/exactRadix.test.ts`
- `./.repos/radix-web3.js/examples/x402/src/paymentRequirements.ts`
- `./.repos/radix-web3.js/examples/x402/src/paymentRequirements.test.ts`
- `./.repos/radix-web3.js/examples/x402/x402.config.template.json`
- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`

Pattern: validate configuration at the boundary, reject template placeholders, derive payment requirements from config, keep `networkId: 1` aligned with `radix:mainnet`, and make exact payment manifests deterministic.

Rule: `paymentRequirementsHash` includes canonical payment semantics and excludes advisory manifest templates. Advisory templates may help a payer preview, but they are not payment identity.

Done when: config tests reject malformed JSON and placeholders, exact-Radix tests prove the Subintent and preview root manifest shapes, and hash tests prove advisory template changes do not affect payment identity.

### Prevent duplicate settlement

Use this when a facilitator may receive repeated payment payloads or retry after uncertain settlement status.

Start with:

- `./.repos/radix-web3.js/examples/x402/src/settlementCache.ts`
- `./.repos/radix-web3.js/examples/x402/src/settlementCache.test.ts`
- `./.repos/radix-web3.js/examples/x402/src/facilitator.ts`
- `./.repos/radix-web3.js/examples/x402/src/settlement.ts`

Pattern: compute a stable settlement cache key from Subintent hash, payment requirements hash, and resource URL. The middleware records settlement only after `CommittedSuccess` and a returned `subintentHash`, then maps the exact payment payload to that committed cache key.

Rule: submitted, failed, invalid, or missing-settlement-handler states are not settlement records. Repeated requests only bypass settlement after the same payload has already produced committed success.

Done when: duplicate committed payloads do not call settlement twice, changing Subintent hash or payment requirements or resource URL changes the cache key, and tests prove submitted-but-not-committed responses still return 402.

### Serve protected markdown in Node or Worker runtimes

Use this when changing the protected resource route, local markdown file, Worker environment variables, mock settlement mode, or startup error behavior.

Start with:

- `./.repos/radix-web3.js/examples/x402/src/server.ts`
- `./.repos/radix-web3.js/examples/x402/src/server.test.ts`
- `./.repos/radix-web3.js/examples/x402/src/worker.ts`
- `./.repos/radix-web3.js/examples/x402/wrangler.jsonc`
- `./.repos/radix-web3.js/examples/x402/protected/reference.md`
- `./references/guide-configuration.md`

Pattern: Node server wiring reads a protected markdown file after middleware passes. Worker wiring builds config from environment variables, validates placeholders, redirects `/` to `/protected/reference.md`, and can use `X402_MOCK_SETTLEMENT=true` to return committed mock settlement.

Rule: Worker startup failures return `x402_worker_startup_failed`; local server file read failures use `ProtectedMarkdownReadError`. Do not claim live settlement from the Worker mock path.

Done when: protected markdown is served only after committed settlement, Worker vars match `X402Config`, placeholder validation still runs, and mock settlement is clearly separated from real facilitator settlement.

## Reference Routes

- Payment payload parsing: inspect `./.repos/radix-web3.js/examples/x402/src/paymentPayload.ts`, `paymentPayload.test.ts`, and invalid header handling in `paymentMiddleware.ts`.
- Payment requirement identity: inspect `./.repos/radix-web3.js/examples/x402/src/paymentRequirements.ts`, `paymentRequirements.test.ts`, `config.ts`, and `exactRadix.ts`.
- Exact payment Subintent shape: inspect `./.repos/radix-web3.js/examples/x402/src/exactRadix.ts`, `paymentValidation.ts`, `paymentValidation.test.ts`, then use `./references/guide-transaction-manifest.md`.
- Protected route behavior: inspect `./.repos/radix-web3.js/examples/x402/src/paymentMiddleware.ts`, `server.ts`, `server.test.ts`, `worker.ts`, and their tests.
- Facilitator settlement: inspect `./.repos/radix-web3.js/examples/x402/src/settlement.ts`, `facilitator.ts`, `facilitator.test.ts`, `./.repos/radix-web3.js/packages/tx-tool/src/inspectSignedPartialTransaction.ts`, then use `./references/guide-tx-tool.md`.
- Duplicate settlement behavior: inspect `./.repos/radix-web3.js/examples/x402/src/settlementCache.ts`, `settlementCache.test.ts`, and the `settlementRecords` handling in `paymentMiddleware.ts`.
- Worker configuration: inspect `./.repos/radix-web3.js/examples/x402/src/worker.ts`, `wrangler.jsonc`, and `x402.config.template.json`.
- Payer CLI handoff: inspect `./.repos/radix-web3.js/packages/cli/src/subintent.ts`, `cli.ts`, `subintent.test.ts`, then use `./references/guide-cli.md`.

Routing check: adjacent routing keeps x402 example concerns in `examples/x402`, sends signed partial transaction inspection to tx-tool, and sends payer Subintent preparation to the generic CLI guide.

## Usage Notes

- Keep x402 protocol validation separate from Radix transaction submission.
- Treat signed partial transaction hex as the authoritative payment payload; do not trust payer metadata from HTTP fields.
- Treat `CommittedSuccess` as the protected content release boundary.
- Use `guide-transactions.md` for transaction lifecycle bugs after settlement accepts a payment.
- Use `guide-shared.md` before changing branded Radix address or amount schemas.
- Treat the x402 example as application code; do not move example-specific middleware or cache behavior into core Radix packages without a broader package-boundary decision.
