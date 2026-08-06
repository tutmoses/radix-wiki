# Shared Types Guide

## Source Paths

Primary source root: `./.repos/radix-web3.js/packages/shared/src`

Key paths:

- `index.ts`
- `brandedTypes.ts`
- `schemas/index.ts`
- `schemas/account.ts`
- `schemas/accountProof.ts`
- `schemas/proof.ts`
- `schemas/walletAccount.ts`
- `schemas/bigNumber.ts`
- `schemas.test.ts`

Related paths:

- `./.repos/radix-web3.js/packages/gateway/src/schemas.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/schemas.ts`
- `./.repos/radix-web3.js/packages/cli/src/schemas.ts`

## Mental Model

`@radix-effects/shared` owns small reusable Effect schemas and branded types. It should prevent stringly-typed Radix values from spreading through higher packages, without becoming a domain service package.

Use shared when a type is:

- reused by more than one package
- a stable Radix primitive such as account address, resource address, transaction ID, network ID, hex, or amount
- a schema-level transform such as finite decimal string or account variant normalization

Keep package-specific response shapes in their owning package.

## Examples

Use these examples when adding or consuming shared schemas.

### Add a branded Radix primitive

Use this when several packages pass the same address, ID, manifest string, or encoded value.

Start with:

- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./.repos/radix-web3.js/packages/shared/src/index.ts`
- `./.repos/radix-web3.js/packages/gateway/src/schemas.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/schemas.ts`
- `./.repos/radix-web3.js/packages/cli/src/schemas.ts`

Pattern:

```ts
export const ResourceAddress = Schema.String.pipe(
  Schema.brand("@radix/types/ResourceAddress")
)
export type ResourceAddress = typeof ResourceAddress.Type
```

Rule: brand strings at boundaries, then preserve branded types through internal services. Do not use brands as runtime validation for address syntax unless the schema explicitly checks syntax.

Done when: the brand is exported, nearest consumers compile against it, and tests prove no runtime syntax validation is implied unless explicitly added.

### Add address syntax validation when a brand is not enough

Use this when user input must reject malformed Radix addresses rather than merely label strings as account, resource, component, or transaction IDs.

Start with:

- `./.repos/radix-web3.js/packages/shared/src/brandedTypes.ts`
- `./.repos/radix-web3.js/packages/shared/src/schemas.test.ts`
- `./.repos/radix-web3.js/packages/connect/src/schemas/walletInteraction.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/staticallyValidateManifest.ts`

Pattern: keep the brand as the public type marker, then add an explicit decode/refinement step for syntax or entity kind. Test malformed bech32 text, wrong entity prefix, wrong network, and valid address round trips separately.

Rule: do not add heavyweight toolkit dependencies to `shared` unless the repo already accepts that dependency boundary. If syntax validation needs RET, prefer package-local validation in the caller and keep `shared` as lightweight branded primitives.

Done when: malformed, wrong-prefix, wrong-network, and valid address cases are tested at the package boundary that owns validation.

### Add an account-shaped schema

Use this when an input may be an unsecurified or securified account and consumers need a canonical `type` discriminator.

Start with:

- `./.repos/radix-web3.js/packages/shared/src/schemas/account.ts`
- `./.repos/radix-web3.js/packages/shared/src/schemas.test.ts`
- `./references/guide-account.md`

Pattern: decode loose input into a canonical discriminated shape, then encode back to the same canonical shape. Add a test for both decode and encode.

Done when: account schema tests cover unsecurified, securified, invalid discriminator, decode, and encode behavior.

### Add proof or wallet account schemas

Use this when wallet, ROLA, CLI, or Gateway code needs common proof or wallet account shape.

Start with:

- `./.repos/radix-web3.js/packages/shared/src/schemas/proof.ts`
- `./.repos/radix-web3.js/packages/shared/src/schemas/accountProof.ts`
- `./.repos/radix-web3.js/packages/shared/src/schemas/walletAccount.ts`
- `./.repos/radix-web3.js/packages/connect/src/schemas/walletInteraction.ts`
- `./references/guide-wallet-rola.md`

Pattern: keep proof fields minimal: public key, signature, curve, address, and challenge. Let ROLA/Gateway code perform cryptographic and ledger checks.

Done when: shared proof schemas validate shape only and ROLA/Gateway tests own signature, owner-key, challenge, and ledger verification.

### Normalize decimal inputs with BigNumber

Use this when higher packages accept decimal strings or numbers but need finite numeric behavior.

Start with:

- `./.repos/radix-web3.js/packages/shared/src/schemas/bigNumber.ts`
- `./.repos/radix-web3.js/packages/shared/src/schemas.test.ts`
- `./.repos/radix-web3.js/packages/tx-tool/src/manifests/manifestHelper.ts`
- `./.repos/radix-web3.js/packages/gateway/src/schemas.ts`
- `./.repos/radix-web3.js/packages/cli/src/schemas.ts`

Pattern: decode strings or numbers into `BigNumber`, reject non-finite values, and encode back to a string. Do not pass JavaScript floating-point numbers into manifest generation when exact decimal text is required.

Done when: decimal schema tests cover string, number, non-finite, malformed, and encode-to-string cases, and manifest helpers receive exact decimal text.

### Export schema additions

Use this when a schema file exists but consumers cannot import it through the package root.

Start with:

- `./.repos/radix-web3.js/packages/shared/src/schemas/index.ts`
- `./.repos/radix-web3.js/packages/shared/src/index.ts`
- `./.repos/radix-web3.js/packages/shared/package.json`

Pattern: export from the local schema barrel first, then from the package root if it is public API. Verify consumers import from `@radix-effects/shared`, not deep source paths.

Done when: package root exports are updated, consumers import from the public package path, and package export metadata still exposes the intended entrypoint.

## Reference Routes

- Address typing: inspect every branded address in `brandedTypes.ts` before adding a duplicate.
- Transaction identifiers: inspect `TransactionId`, `TransactionManifestString`, `TransactionMessageString`, `Epoch`, `Nonce`, and `NetworkId`.
- Account proof flow: inspect shared proof schemas, connect wallet proof schemas, and Gateway ROLA code together.
- Schema test style: inspect `schemas.test.ts` for `Schema.decodeUnknownEffect`, encode checks, and failure checks.
- Cross-package consumers: search imports from `@radix-effects/shared` before changing exported names.

Routing check: adjacent routing keeps shared dependency-light and sends package-specific response models back to their owning package.

## Usage Notes

- Keep shared schemas small and dependency-light.
- Do not move package-specific Gateway, CLI, or tx-tool response models into shared unless multiple packages already need them.
- Add tests for both decode and encode when a schema transforms values.
- Branded string types document intent; they do not automatically validate Radix address syntax.
