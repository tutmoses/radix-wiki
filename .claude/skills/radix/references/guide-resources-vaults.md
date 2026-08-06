# Resources And Vaults Guide

## Source Paths

Scrypto and engine source paths:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/resource_manager.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/bucket.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/vault.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/worktop.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/proof.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/resource/fungible/fungible_bucket.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/resource/non_fungible/non_fungible_bucket.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/assert_worktop_resources.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/bucket.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/vault.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/fungible_resource.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/non_fungible_resource.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/transfer_xrd/manifests/002--transfer--try_deposit_or_abort.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/fungible_resource/manifests/001--fungible-max-div-create.rtm`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/non_fungible_resource/manifests/001--non-fungible-resource-create.rtm`

TypeScript source paths:

- `./.repos/radix-web3.js/packages/core/src/manifests/sendResourceManifest.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/createFungibleToken.ts`
- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./.repos/radix-web3.js/packages/sbor/src/native.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getFungibleBalance.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getNonFungibleBalance.ts`
- `./.repos/radix-web3.js/packages/cli/src/accountReads.ts`

## Mental Model

Resources are ledger assets; resource managers define the asset type, supply behavior, metadata, and resource roles. Buckets, vaults, proofs, and the worktop are resource containers or evidence with different lifetimes:

- Resource managers own mint, burn, recall, freeze, withdraw, deposit, and non-fungible data update policy.
- Buckets are transient owned containers created by withdrawal, minting, worktop take operations, or resource manager methods.
- Vaults are owned persistent containers under accounts or components.
- Proofs are transient evidence for authorization; proof creation can lock amounts or IDs.
- The worktop is the transaction manifest staging area for buckets between instructions.

Do not use Gateway balance reads as the authority for resource semantics. Gateway tells what ledger state currently contains. Scrypto and Radix Engine source define what movements, locks, proofs, vault ownership, and worktop assertions mean.

## Examples

Use these examples when changing resource manifests, resource creation helpers, account balance reads, SBOR resource values, Scrypto resource behavior, or tests involving buckets, vaults, proofs, and the worktop.

### Build a resource transfer manifest

Use this when sending XRD or another resource between accounts through a TypeScript helper or CLI manifest.

Start with:

- `./.repos/radix-web3.js/packages/core/src/manifests/sendResourceManifest.ts`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/transfer_xrd/manifests/002--transfer--try_deposit_or_abort.rtm`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/worktop.rs`
- `./references/guide-transaction-manifest.md`
- `./references/guide-account.md`

Pattern:

```text
lock fee
withdraw resource from source account
take the withdrawn amount from the worktop into a named bucket
call destination account deposit method with that bucket
```

Rule: a transfer manifest must account for bucket lifetime. A bucket created by `withdraw` or worktop take must be consumed by deposit, burn, or another method before the manifest finishes.

Done when: the manifest creates the expected bucket, consumes it exactly once, leaves no unintended resources on the worktop, and uses the account deposit method intended by the product flow.

### Create a fungible resource

Use this when adding or reviewing a helper that creates a fungible token, mints initial supply, sets metadata, or wires resource roles.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/createFungibleToken.ts`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/resource_manager.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/fungible_resource.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/fungible_resource/manifests/001--fungible-max-div-create.rtm`
- `./references/guide-access-rules.md`

Pattern:

```text
resource creation chooses owner role, divisibility, resource roles, metadata, and optional initial supply
initial supply appears on the worktop
the manifest deposits the worktop into an account or component
```

Rule: resource roles are part of the asset contract, not UI metadata. Verify mint, burn, recall, freeze, withdraw, deposit, and updater roles against engine source or generated scenarios before changing helper defaults.

Done when: role defaults, divisibility, metadata, initial supply, and final deposit behavior are all explicit and covered by a generated manifest or package test.

### Create a non-fungible resource

Use this when working with NFT resources, local IDs, non-fungible data, remote types, minting, burning, or transfers.

Start with:

- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/src/scenarios/non_fungible_resource.rs`
- `./.repos/radixdlt-scrypto/radix-transaction-scenarios/generated-examples/babylon/non_fungible_resource/manifests/001--non-fungible-resource-create.rtm`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/non_fungible/non_fungible_resource_manager.rs`
- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./references/guide-sbor.md`

Pattern:

```text
choose the non-fungible local ID type
provide non-fungible data entries when creating or minting supply
deposit created or minted NFTs from the worktop
keep resource address and local ID as different values
```

Rule: a non-fungible resource address is not a non-fungible local ID. Keep resource address, local ID, and non-fungible data separate in schemas, manifests, and Gateway calls.

Done when: the helper or guide text identifies ID type, data schema, mint or create path, deposit behavior, and the source of local IDs.

### Handle worktop assertions

Use this when adding V2 manifest assertions, checking exact returned resources, or preventing extra resources from silently continuing through a manifest.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/worktop.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/assert_worktop_resources.rs`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyValidateManifest.ts`
- `./references/guide-transaction-manifest.md`
- `./references/guide-testing.md`

Pattern:

```text
assert resources include -> require at least the named constraints
assert resources only -> reject unspecified non-zero resources
take amount -> creates one bucket for a resource and amount
take all -> drains that resource into one bucket
```

Rule: use worktop assertions when a manifest must prove returned resources before the next call. `only` is stricter than `include` because unspecified non-zero resources fail.

Done when: the manifest assertion matches the product invariant and tests cover extra, missing, and exact worktop resource cases.

### Create and consume proofs

Use this when a manifest or Scrypto method creates bucket proofs, account proofs, auth-zone proofs, or proof-based authorization checks.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/proof.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/bucket.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/resource/fungible/fungible_bucket.rs`
- `./.repos/radixdlt-scrypto/radix-engine/src/blueprints/resource/non_fungible/non_fungible_bucket.rs`
- `./references/guide-access-rules.md`

Pattern:

```text
proof carries amount or non-fungible IDs for one resource
proof can be cloned or dropped
bucket proof creation can lock the source bucket while proof evidence exists
auth rules check proofs, not balances directly
```

Rule: route authorization behavior through access-rule and auth-zone sources. Resource proofs demonstrate ownership or control of resources; they are not deposits and should not be modeled as balance movement.

Done when: proof lifetime, locked source behavior, resource address, amount or IDs, and auth-zone use are all explicit in the manifest or Scrypto code.

### Diagnose bucket and vault failures

Use this when a manifest or Scrypto call fails because a bucket is non-empty, a bucket is locked, a vault does not exist, a vault is frozen, or a resource movement has bad granularity.

Start with:

- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/bucket.rs`
- `./.repos/radixdlt-scrypto/radix-engine-tests/tests/system/vault.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/bucket.rs`
- `./.repos/radixdlt-scrypto/radix-engine-interface/src/blueprints/resource/vault.rs`
- `./references/guide-error-diagnostics.md`

Pattern:

```text
bucket must be empty before drop
vault ownership is checked by the engine type system
vault freeze flags can affect withdraw, deposit, and burn
fungible divisibility affects valid amounts
```

Rule: diagnose resource failures at the engine boundary before changing TypeScript wrappers. Many errors come from container lifetime, ownership, freeze state, or divisibility rather than from Gateway or RET invocation.

Done when: the diagnostic names the failing container, resource address, amount or ID set, freeze or lock state, and the engine error source.

### Read resource balances through Gateway

Use this when reading fungible balances, NFT balances, non-fungible data, non-fungible location, or account resource pages.

Start with:

- `./.repos/radix-web3.js/packages/gateway/src/getFungibleBalance.ts`
- `./.repos/radix-web3.js/packages/gateway/src/getNonFungibleBalance.ts`
- `./.repos/radix-web3.js/packages/cli/src/accountReads.ts`
- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./references/guide-gateway.md`
- `./references/guide-account.md`

Pattern:

```text
account details -> aggregated vault data
fungibles page -> paged fungible resources
non-fungibles page -> resource managers and vaults
non-fungible data -> data for specific local IDs
```

Rule: Gateway reads should preserve account address, resource address, local ID, and vault aggregation boundaries. Do not infer transfer semantics from a balance page.

Done when: request shape, pagination, aggregation level, typed resource identifiers, and empty balance behavior are tested or traced to Gateway source.

### Encode resource values in SBOR helpers

Use this when adding resource, vault, non-fungible ID, bucket, proof, or manifest value helpers.

Start with:

- `./.repos/radix-web3.js/packages/sbor/src/native.ts`
- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./.repos/radixdlt-scrypto/radix-common/src/data/manifest/model/manifest_bucket.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/data/manifest/model/manifest_proof.rs`
- `./.repos/radixdlt-scrypto/radix-common/src/types/addresses/resource_address.rs`
- `./references/guide-sbor.md`

Pattern:

```text
resource address -> reference value
vault address -> own value
manifest bucket -> manifest-only object reference
manifest proof -> manifest-only proof reference
non-fungible local ID -> typed custom value
```

Rule: use the native SBOR kind that matches the value's Radix lifetime. Do not encode a manifest bucket or proof as a ledger address, and do not treat a vault address like a resource address.

Done when: SBOR helpers preserve value kind, address or manifest object lifetime, and decode or encode tests cover the new resource value.

## Reference Routes

- Manifest instructions, worktop, buckets, and proof IDs: use `guide-transaction-manifest.md`.
- Account deposits, withdrawals, owner badge, and authorized depositors: use `guide-account.md`.
- Access rules, auth zone, and proof-based authorization: use `guide-access-rules.md`.
- Gateway balance, NFT data, and pagination reads: use `guide-gateway.md`.
- SBOR native values and Manifest/Scrypto encoding: use `guide-sbor.md`.
- Scrypto source lookup and engine tests: use `guide-scrypto.md`.

Routing check: start here for resource managers, buckets, vaults, proofs, worktop assertions, and resource balance semantics, then route to manifest, account, Gateway, access-rule, SBOR, or Scrypto guides for the owning boundary.

## Usage Notes

- Keep resource manager policy separate from metadata.
- Keep bucket, vault, proof, and worktop lifetimes distinct.
- Treat Gateway balances as state reads, not protocol semantics.
- Use generated scenario manifests before copying resource instructions into TypeScript docs.
- Verify fungible divisibility and non-fungible local ID type before constructing amounts or IDs.
- When in doubt, trace resource behavior from engine interface source to engine tests to generated transaction scenarios.
