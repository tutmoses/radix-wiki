# Gateway Guide

## Source Paths

Primary source root: `./.repos/radix-web3.js/packages/gateway/src`

Key paths:

- `gatewayApiClient.ts`
- `schemas.ts`
- `getLedgerState.ts`
- `getFungibleBalance.ts`
- `getNonFungibleBalance.ts`
- `getKeyValueStore.ts`
- `previewTransaction.ts`
- `state/`
- `helpers/chunker.ts`

## Mental Model

Gateway code is an Effect-friendly boundary around Radix Gateway API calls. The common shape is:

1. validate or normalize inputs
2. call the Gateway client through an Effect wrapper
3. map SDK failures into typed errors
4. drain pagination or batch requests where needed
5. return domain-shaped data to higher-level packages

Ledger reads often need explicit `at_ledger_state` handling so multiple calls see a consistent ledger point.

## Examples

Use these examples to keep Gateway code as a typed Effect boundary around Gateway SDK calls.

### Query fungible balances at a stable ledger point

Use this when the user asks for balances across one or many accounts and the result should not mix ledger states.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/getLedgerState.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getFungibleBalance.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getFungibleBalance.test.ts`
- `./.repos/radix-web3.js/packages/gateway/src/state/entityFungiblesPage.ts`
- `./.repos/radix-web3.js/packages/gateway/src/state/stateEntityDetails.ts`
- `./.repos/radix-web3.js/packages/gateway/src/helpers/chunker.ts`

Pattern:

```ts
import { Effect } from "effect"

const program = Effect.gen(function*() {
  const ledgerState = yield* getLedgerState({ at_ledger_state: undefined })
  return yield* getFungibleBalance({
    addresses,
    at_ledger_state: { state_version: ledgerState.state_version }
  })
})
```

Adapt names to the actual package exports in the target repo. Preserve chunking and concurrency settings when adding new batch reads.

Rule: route balance reads through `GetFungibleBalance`. The service gets entity details first, then freezes cursor pagination to the returned `ledger_state.state_version`. Use `GetLedgerStateService` only when the caller needs an explicit ledger state before invoking the balance service.

Done when: tests prove chunked account input, cursor pagination, empty balances, and stable ledger-state use across every page.

### Query non-fungible balances or locations

Use this when the request involves NFT resources, local IDs, owner lookup, or vault locations.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/getNonFungibleBalance.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getNftResourceManagers.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getNonFungibleLocation.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getAddressByNonFungible.ts`
- `./.repos/radix-web3.js/packages/gateway/src/state/nonFungibleData.ts`

Pattern: split resource-manager discovery from NFT data/page fetching. Exhaust cursors unless the API is explicitly one-page.

Done when: resource manager discovery, local ID paging, and owner/location lookup are tested separately and preserve missing NFT or empty-page cases.

### Read component state with SBOR decoding

Use this when Gateway returns component state bytes or JSON SBOR payloads that need typed decoding.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/getComponentState.ts`
- `./.repos/radix-web3.js/packages/gateway/src/schemas.ts`
- `./.repos/radixdlt-scrypto/radix-common/src/data/scrypto/custom_value.rs`

Pattern: current `getComponentState.ts` decodes `componentDetails.state` with the schema supplied by the caller. Use `gateway/src/sbor.ts` or `packages/sbor` only when the task requires explicit programmatic SBOR value decoding beyond the state schema.

Done when: the caller-provided schema is tested against valid and invalid component state, and any extra SBOR decoding is isolated to the boundary that needs programmatic JSON handling.

### Add a Gateway service wrapper

Use this when a Gateway SDK endpoint is missing from the package.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/gatewayApiClient.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getKeyValueStore.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getKeyValueStore.test.ts`

Pattern:

1. Wrap SDK promises in `Effect`.
2. Map SDK errors into package error types.
3. Add pagination or chunking only in the higher service, not the raw client wrapper.
4. Add a focused service test.

Done when: the wrapper exposes a typed Effect service, maps SDK/Gateway errors into package errors, and has tests for success plus the most likely Gateway failure tag.

### Drain a cursor-paginated Gateway endpoint

Use this when a Gateway endpoint returns `next_cursor`, especially account resources, key-value store entries, resource holders, or transaction history.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/getKeyValueStore.ts`
- `./.repos/radix-web3.js/packages/gateway/src/keyValueStoreKeys.ts`
- `./.repos/radix-web3.js/packages/gateway/src/keyValueStoreData.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getResourceHolders.ts`
- `./.repos/radix-web3.js/packages/gateway/src/helpers/chunker.ts`

Pattern:

1. Capture a stable `at_ledger_state` before the first page when the result spans multiple calls.
2. Request the first page with no cursor.
3. Repeat while `next_cursor` is present.
4. Pass the same ledger state into every page request.
5. Map Gateway or SDK errors into the package's typed error shape.
6. Test that all pages are exhausted and no page is silently dropped.

Rule: for key-value store reads, fetch all key pages first at a stable ledger state, then fetch all key data values at that same ledger state. For resource holders, de-duplicate by `holder_address` after draining pages.

Rule: `KeyValueStoreDataService` chunks key data requests by `GatewayApi__Endpoint__MaxPageSize`. Current live tests do not cover multi-page keys, chunked reads, or empty stores, and `GetKeyValueStoreService` currently assumes `res[0]` exists. Add those tests before changing aggregation behavior.

Done when: pagination tests prove no page is dropped, all data requests use the same ledger state, and empty result sets are handled intentionally.

### Read validator metadata safely

Use this when exposing validators, pool-unit resources, or claim-NFT resource addresses.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/state/getValidators.ts`
- `./.repos/radix-web3.js/packages/gateway/src/state/stateEntityDetails.ts`
- `./.repos/radix-web3.js/packages/gateway/src/schemas.ts`

Pattern: read validator entity details, then extract metadata keys such as `name`, `pool_unit`, and `claim_nft`. Missing optional metadata should become the package's empty/default shape, not an exception, unless the caller explicitly asks for strict validation.

Done when: validator output distinguishes required identity fields from optional metadata and tests cover missing optional metadata.

### Preview transactions

Use this when the task asks whether a transaction would fail before submission.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/previewTransaction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/previewTransaction.ts`
- `./.repos/radix-web3.js/packages/cli/src/prepare.ts`

Pattern: keep Gateway preview request shape in Gateway code, and let tx-tool or CLI decide when preview belongs in the lifecycle.

Done when: Gateway preview tests assert request shape and error mapping, while lifecycle placement is covered in tx-tool or CLI tests.

## Reference Routes

- Gateway client construction or network config: inspect `gatewayApiClient.ts`.
- SDK/Gateway error mapping: inspect `gatewayApiClient.ts`, service-specific errors, and failed-call tests.
- Current ledger state: inspect `getLedgerState.ts` and services accepting `at_ledger_state`.
- Entity details or vault aggregation: inspect `state/stateEntityDetails.ts` and `state/getEntityDetailsVaultAggregated.ts`.
- Key-value store keys and values: inspect `getKeyValueStore.ts`, `keyValueStoreKeys.ts`, and `keyValueStoreData.ts`.
- Validator metadata: inspect `state/getValidators.ts`.
- Resource holders: inspect `getResourceHolders.ts` and `helpers/chunker.ts`.
- ROLA proof verification: inspect `rola.ts`, `schemas.ts`, and `guide-wallet-rola.md`.

Routing check: adjacent routing sends proof verification to ROLA, transaction execution to tx-tool, and plain ledger reads to the closest Gateway service.

## Usage Notes

- Search for existing Gateway service and error types before adding new ones.
- Preserve pagination behavior; partial page reads are usually bugs unless the API explicitly asks for one page.
- Keep concurrency limits configurable when matching existing package patterns.
- For transaction preview, read `previewTransaction.ts` and transaction schemas before changing request shape.
