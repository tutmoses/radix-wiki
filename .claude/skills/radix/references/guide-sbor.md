# SBOR Guide

## Source Paths

TypeScript source paths:

- `./.repos/radix-web3.js/packages/sbor/src`
- `./.repos/radix-web3.js/packages/gateway/src/sbor.ts`
- `./.repos/radix-web3.js/packages/core/src/network/sborHelper.ts`

Rust source paths:

- `./.repos/radixdlt-scrypto/sbor/src`
- `./.repos/radixdlt-scrypto/sbor/src/value_kind.rs`
- `./.repos/radixdlt-scrypto/sbor-derive/src`
- `./.repos/radixdlt-scrypto/radix-sbor-derive/src`
- `./.repos/radixdlt-scrypto/radix-common/src/data`
- `./.repos/radixdlt-scrypto/radix-common/src/data/manifest/custom_value_kind.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/data/scrypto/custom_value_kind.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/data/scrypto/custom_well_known_types.rs`

## Mental Model

SBOR is the Radix binary value format. It is not plain JSON:

- every payload starts with a context prefix
- every value carries a value kind
- Scrypto and Manifest contexts add custom value kinds
- schemas describe typed payloads and support validation/evolution

Use SBOR helpers at external boundaries where ledger state, component state, manifest values, or Gateway data need decoding.

## Examples

Use these examples to choose the correct SBOR context before adding decoders.

### Decode component state returned by Gateway

Use this when Gateway returns state that should become a typed application value.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/getComponentState.ts`
- `./.repos/radix-web3.js/packages/gateway/src/sbor.ts`
- `./.repos/radix-web3.js/packages/sbor/src/index.ts`
- `./.repos/radixdlt-scrypto/radix-common/src/data/scrypto/custom_value.rs`

Pattern:

```ts
// Pseudocode only; adapt to actual package exports.
const state = yield* getComponentState({
  addresses: [componentAddress],
  schema: componentStateSchema,
  at_ledger_state
})
```

Rule: current Gateway component-state code decodes `componentDetails.state` with the caller-provided Effect schema. Use package SBOR helpers only when the input is programmatic SBOR JSON or encoded SBOR data that the schema does not already decode.

Done when: valid component state decodes through the caller schema, invalid state fails at the schema boundary, and extra SBOR helper use is justified by programmatic JSON or encoded payload input.

### Add native TypeScript SBOR helpers

Use this when a TypeScript package needs a reusable decoder/encoder rather than a one-off Gateway transform.

Start with:

- `./.repos/radix-web3.js/packages/sbor/src/native.ts`
- `./.repos/radix-web3.js/packages/sbor/src/native.test.ts`
- `./.repos/radix-web3.js/packages/sbor/src/index.ts`
- `./.repos/radixdlt-scrypto/sbor/src/lib.rs`

Pattern: keep TypeScript helper behavior aligned with Rust codec tests. Export only stable helpers from `index.ts`.

Pattern details:

- Curried encode/decode helpers: inspect `native.test.ts` around basic encode/decode cases.
- Numeric kind preservation: inspect numeric tests before converting values through JavaScript `number`.
- Branded semantic scalars: inspect address, decimal, and ID brand tests before adding a new scalar.
- Struct, map, option, and enum composition: inspect composition tests before hand-building programmatic JSON.

Rule: use the public schema DSL in `native.ts` before adding one-off decoder functions. Add failure tests for wrong value kind, wrong prefix, and schema mismatch.

Done when: helper tests cover decode, encode, malformed input, and export shape from `packages/sbor/src/index.ts`.

### Decode a Gateway key-value store entry into a typed value

Use this when Gateway returns key-value store keys or values that need application types.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/getKeyValueStore.ts`
- `./.repos/radix-web3.js/packages/gateway/src/keyValueStoreKeys.ts`
- `./.repos/radix-web3.js/packages/gateway/src/keyValueStoreData.ts`
- `./.repos/radix-web3.js/packages/gateway/src/sbor.ts`
- `./.repos/radix-web3.js/packages/sbor/src/native.ts`

Pattern:

1. Validate the Gateway response shape.
2. Decide whether the payload is Scrypto SBOR or Manifest SBOR.
3. Decode through the Gateway/SBOR package helper.
4. Compare the TypeScript schema to the Rust type and schema metadata.
5. Test prefix failure, custom value-kind failure, and domain schema failure separately.

Rule: find the owning Rust type with `rg "struct <TypeName>|enum <TypeName>|ScryptoSbor|ManifestSbor" ./.repos/radixdlt-scrypto`, then compare that type to the TypeScript schema.

Done when: the decoder rejects the wrong `kind`, wrong `type_name`, malformed numeric string, and mismatched domain shape, and a round-trip encode preserves the original SBOR kind for numeric, enum, option, map, and struct fields used by the target value.

### Work with Manifest SBOR values

Use this when transaction manifests, manifest values, buckets, proofs, blobs, or address reservations are involved.

Start with:

- `./.repos/radixdlt-scrypto/sbor/src/value_kind.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/data/manifest/custom_value.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/data/manifest/custom_value_kind.rs`
- `./.repos/radixdlt-scrypto/radix-sbor-derive/src/manifest_encode.rs`
- `./.repos/radixdlt-scrypto/radix-sbor-derive/src/manifest_decode.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/manifest_instructions.rs`

Pattern: distinguish Manifest SBOR custom value kinds from Scrypto SBOR custom value kinds before choosing decode helpers.

Done when: the payload family is named as Manifest SBOR, the custom value kinds match Rust source, and manifest-specific handles such as buckets, proofs, blobs, and reservations are not decoded as Scrypto state.

### Work with Scrypto SBOR values

Use this when decoding component state, non-fungible data, resource metadata, or blueprint schema data.

Start with:

- `./.repos/radixdlt-scrypto/sbor/src/value_kind.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/data/scrypto/custom_value.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/data/scrypto/custom_value_kind.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/data/scrypto/custom_well_known_types.rs`
- `./.repos/radixdlt-scrypto/radix-sbor-derive/src/scrypto_encode.rs`
- `./.repos/radixdlt-scrypto/radix-sbor-derive/src/scrypto_decode.rs`
- `./.repos/radix-web3.js/packages/gateway/src/sbor.ts`

Pattern: compare the Rust type definition and derive attributes against the TypeScript schema. Schema drift is more likely than codec failure.

Done when: the TypeScript schema is checked against the Rust `ScryptoSbor` type and tests cover missing fields, wrong custom type, and successful decode.

### Debug raw payload, prefix, or depth failures

Use this when decoding fails before reaching the domain schema.

Start with:

- `./.repos/radixdlt-scrypto/sbor/src/encoded_wrappers.rs`
- `./.repos/radixdlt-scrypto/sbor/src/basic.rs`
- `./.repos/radixdlt-scrypto/sbor-tests/tests/decode.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/data/manifest/custom_payload_wrappers.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/data/scrypto/custom_payload_wrappers.rs`

Pattern: verify payload prefix first, then custom value kind, then traversal/depth behavior, then domain schema.

Done when: the failure is classified as prefix, custom value kind, traversal/depth, or domain schema, and the report includes the smallest payload needed to reproduce it.

## Reference Routes

- Decode key-value store data: inspect Gateway `getKeyValueStore.ts`, `keyValueStoreData.ts`, `sbor.ts`, and Rust data type definitions.
- Decode non-fungible data payloads: inspect Gateway `state/nonFungibleData.ts`, NFT schema definitions, and Rust Scrypto data models.
- Basic SBOR work: inspect Rust `sbor/src` and `sbor-tests/tests/`.
- Schema derivation behavior: inspect `sbor-derive/src`, `radix-sbor-derive/src`, and Rust tests for derive macros.
- Blueprint schema or bindgen behavior: inspect `radix-blueprint-schema-init/`, `scrypto-bindgen/`, and schema tests.
- Hex/base64 conversions for transaction or Gateway data: inspect tx-tool `schemas.ts`, Gateway `sbor.ts`, and shared branded string types.

Routing check: adjacent routing sends transaction encodings to tx-tool, Gateway boundary decoding to Gateway, and primitive brands to shared schemas.

## Usage Notes

- Do not decode SBOR with ad hoc byte slicing unless you are implementing the codec itself.
- Distinguish Basic SBOR, Scrypto SBOR, and Manifest SBOR before choosing helpers.
- Check Rust derive macros when TypeScript behavior must match on-ledger encoding.
- For schema mismatches, inspect the Rust type definition and the TypeScript schema side by side.
