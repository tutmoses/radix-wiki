# TypeScript Tooling Guide

## Source Paths

Root tooling paths:

- `./.repos/radix-web3.js/package.json`
- `./.repos/radix-web3.js/turbo.json`
- `./.repos/radix-web3.js/.oxfmtrc.json`
- `./.repos/radix-web3.js/.oxlintrc.json`
- `./.repos/radix-web3.js/.github/workflows/ci.yml`

Package config paths:

- `./.repos/radix-web3.js/packages/core/tsconfig.json`
- `./.repos/radix-web3.js/packages/core/tsup.config.ts`
- `./.repos/radix-web3.js/packages/core/vitest.config.ts`
- `./.repos/radix-web3.js/packages/core/package.json`
- `./.repos/radix-web3.js/packages/connect/tsconfig.json`
- `./.repos/radix-web3.js/packages/connect/tsup.config.ts`
- `./.repos/radix-web3.js/packages/agent-toolkit/tsconfig.json`
- `./.repos/radix-web3.js/packages/agent-toolkit/tsup.config.ts`
- `./.repos/radix-web3.js/packages/agent-toolkit/vitest.config.ts`
- `./.repos/radix-web3.js/packages/cli/tsconfig.json`
- `./.repos/radix-web3.js/packages/cli/tsdown.config.ts`
- `./.repos/radix-web3.js/packages/gateway/tsconfig.json`
- `./.repos/radix-web3.js/packages/gateway/tsdown.config.ts`
- `./.repos/radix-web3.js/packages/shared/tsconfig.json`
- `./.repos/radix-web3.js/packages/tx-tool/tsconfig.json`
- `./.repos/radix-web3.js/packages/tx-tool/tsdown.config.ts`
- `./.repos/radix-web3.js/packages/transaction-stream/tsconfig.json`
- `./.repos/radix-web3.js/packages/transaction-stream/tsdown.config.ts`
- `./.repos/radix-web3.js/examples/x402/tsconfig.json`
- `./.repos/radix-web3.js/apps/docs/tsconfig.json`

## Mental Model

TypeScript tooling is package-local in this workspace. There is no single tsconfig pattern that applies everywhere:

- root scripts run formatter, linter, Turbo build, Turbo test, and release commands
- `oxfmt` and `oxlint` operate on `./packages`, not apps or examples
- tsup packages publish dual CJS and ESM outputs in `core` and `connect`
- tsdown packages usually publish ESM `.mjs` and `.d.mts` output
- Effect-heavy packages such as `shared` and `tx-tool` use stricter unused checks and `@effect/language-service`
- docs and examples are private apps with their own TypeScript assumptions

Do not infer TypeScript or package metadata from a neighboring package. Inspect the package's `tsconfig.json`, build config, `package.json`, and test config together before changing imports, aliases, emitted output, or type-check claims.

## Examples

Use these examples when changing TypeScript config, formatter or linter behavior, package entrypoints, path aliases, type-check scripts, or test type globals.

### Change formatter or linter policy

Use this when adjusting formatting, lint rules, ignored paths, import sorting, or CI lint behavior.

Start with:

- `./.repos/radix-web3.js/.oxfmtrc.json`
- `./.repos/radix-web3.js/.oxlintrc.json`
- `./.repos/radix-web3.js/package.json`
- `./.repos/radix-web3.js/.github/workflows/ci.yml`

Pattern:

```text
pnpm format -> oxfmt --write ./packages
pnpm lint -> oxlint ./packages
oxfmt printWidth: 80
oxfmt sortImports: true
oxlint require-yield: off
ignored: node_modules, dist, build, coverage, spec files
```

Rule: formatter and linter config apply to package code by root script. Apps and examples are not included in `pnpm format` or `pnpm lint` unless the root scripts change.

Done when: the root script, formatter config, linter config, and CI command all describe the same target files and rule surface.

### Align a tsdown ESM package

Use this when changing `cli`, `gateway`, `sbor`, `shared`, `tx-tool`, or `transaction-stream` build output or TypeScript settings.

Start with:

- `./.repos/radix-web3.js/packages/tx-tool/tsconfig.json`
- `./.repos/radix-web3.js/packages/tx-tool/tsdown.config.ts`
- `./.repos/radix-web3.js/packages/tx-tool/package.json`
- `./.repos/radix-web3.js/packages/shared/tsconfig.json`
- `./.repos/radix-web3.js/packages/shared/package.json`

Pattern:

```text
tsdown entry: src/index.ts
tsdown format: esm
tsdown dts: true
package main: ./dist/index.mjs
package types: ./dist/index.d.mts
exports import: ./dist/index.mjs
```

Rule: tsdown packages publish ESM output and declaration files through `dist`. Packages with stricter tsconfig settings may include `allowImportingTsExtensions`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, and `@effect/language-service`; do not remove those because another package has a looser config.

Done when: `tsconfig.json`, `tsdown.config.ts`, package `main`, package `types`, and package `exports` point at the same output model.

### Align a tsup dual-output package

Use this when changing `core`, `connect`, or agent-toolkit build config, dual ESM/CJS output, declaration files, or package metadata.

Start with:

- `./.repos/radix-web3.js/packages/core/tsconfig.json`
- `./.repos/radix-web3.js/packages/core/tsup.config.ts`
- `./.repos/radix-web3.js/packages/core/package.json`
- `./.repos/radix-web3.js/packages/connect/tsup.config.ts`
- `./.repos/radix-web3.js/packages/connect/package.json`
- `./.repos/radix-web3.js/packages/agent-toolkit/package.json`

Pattern:

```text
core and connect tsup format: cjs, esm
core and connect dts: true
core and connect package main: ./dist/index.cjs
core and connect package module: ./dist/index.js
core and connect exports include require and import
```

Rule: tsup package metadata is not the same as tsdown package metadata. `core` and `connect` publish CJS plus ESM output, while agent-toolkit currently points package metadata at `src/index.ts`; inspect the exact package before copying build metadata.

Done when: build entries, declaration output, `main`, `module`, `types`, and `exports` match the package's actual build tool and intended consumer runtime.

### Add or change path aliases

Use this when introducing `@/*` imports, moving aliased files, or fixing tests that cannot resolve package-local aliases.

Start with:

- `./.repos/radix-web3.js/packages/core/tsconfig.json`
- `./.repos/radix-web3.js/packages/core/vitest.config.ts`
- `./.repos/radix-web3.js/packages/core/src/client/index.ts`
- `./.repos/radix-web3.js/packages/agent-toolkit/tsconfig.json`
- `./.repos/radix-web3.js/packages/agent-toolkit/vitest.config.ts`
- `./.repos/radix-web3.js/packages/agent-toolkit/src/plugins/core/index.ts`

Pattern:

```json
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

Rule: path aliases need both TypeScript resolution and test runtime resolution. `core` and agent-toolkit configure `@/*`; do not introduce `@/*` imports in packages that lack matching `tsconfig` and Vitest alias support.

Done when: source imports, tsconfig paths, test resolver aliases, and package build tooling all resolve the same alias.

### Verify type-check claims

Use this when adding a `check-types` script, claiming that a change was typechecked, or wiring Turbo type-check tasks.

Start with:

- `./.repos/radix-web3.js/package.json`
- `./.repos/radix-web3.js/turbo.json`
- `./.repos/radix-web3.js/packages/cli/package.json`
- `./.repos/radix-web3.js/packages/shared/package.json`
- `./.repos/radix-web3.js/packages/tx-tool/package.json`
- `./.repos/radix-web3.js/packages/transaction-stream/package.json`

Pattern:

```text
root check-types -> pnpm format && pnpm lint
package check-types -> tsc --noEmit
turbo check-types -> depends on upstream check-types
CI -> lint, test, build
```

Rule: in the current root package, `pnpm check-types` does not run `turbo check-types`; it runs format and lint. Package-local `check-types` scripts run TypeScript. Do not report a root `check-types` run as full workspace TypeScript coverage unless the root script changes.

Done when: the reported command proves exactly the claimed surface, and package-local `tsc --noEmit` is used when the claim is TypeScript type correctness.

### Configure private app TypeScript

Use this when changing Docusaurus docs, the x402 example, or another private app's TypeScript config.

Start with:

- `./.repos/radix-web3.js/apps/docs/tsconfig.json`
- `./.repos/radix-web3.js/apps/docs/package.json`
- `./.repos/radix-web3.js/apps/docs/docusaurus.config.ts`
- `./.repos/radix-web3.js/examples/x402/tsconfig.json`
- `./.repos/radix-web3.js/examples/x402/package.json`
- `./references/guide-x402.md`

Pattern:

```text
docs tsconfig extends @docusaurus/tsconfig and is editor-oriented
x402 tsconfig targets ES2022, uses Bundler resolution, rootDir src, outDir dist
x402 check-types runs tsc --noEmit
```

Rule: private app TypeScript settings should serve the app runtime, not the published package graph. Keep docs config aligned with Docusaurus, and keep x402 config aligned with Node, Worker, and test entrypoints.

Done when: the private app's TypeScript config, package scripts, and runtime guide agree on the app being built or checked.

### Add Vitest types or globals

Use this when tests need `describe`, `it`, `expect`, Vitest globals, node types, or runtime config in TypeScript.

Start with:

- `./.repos/radix-web3.js/packages/gateway/tsconfig.json`
- `./.repos/radix-web3.js/packages/gateway/vitest.config.ts`
- `./.repos/radix-web3.js/packages/tx-tool/tsconfig.json`
- `./.repos/radix-web3.js/packages/tx-tool/vitest.config.ts`
- `./.repos/radix-web3.js/packages/cli/tsconfig.json`
- `./.repos/radix-web3.js/packages/cli/vitest.config.ts`
- `./references/guide-testing.md`

Pattern:

```json
{
  "types": ["node", "vitest/globals"]
}
```

Rule: TypeScript `types` and Vitest runtime globals are separate. Add `vitest/globals` where TypeScript needs global test names, and verify the package's Vitest config actually enables globals when tests rely on them.

Done when: tsconfig types, Vitest `globals`, test imports, and package-local test command all agree on how tests access Vitest APIs.

## Reference Routes

- Package exports, published files, bins, and build output: inspect the package `package.json`, build config, and root scripts listed in this guide.
- Dependency versions, catalog entries, and install trust policy: use `guide-dependencies-supply-chain.md`.
- Test selection and test behavior: use `guide-testing.md`.
- Effect service patterns and Effect language service usage: use `guide-effect-services.md`.
- Docs app TypeScript and Docusaurus config: inspect `apps/docs/tsconfig.json`, `apps/docs/package.json`, and `apps/docs/docusaurus.config.ts`.
- x402 app runtime and Worker config: use `guide-x402.md`.

Routing check: start here for TypeScript, formatter, linter, tsconfig, alias, and type-check surfaces, then route behavior changes to the owning package or workflow guide.

## Usage Notes

- Treat `tsconfig.json` as package-local policy, not a workspace default.
- Do not copy tsup package metadata into tsdown packages or the reverse.
- Do not claim root `pnpm check-types` proves TypeScript type correctness unless the root script changes.
- Keep formatter and linter target scope explicit; current root scripts target `./packages`.
- Add aliases only when the test runtime and build tool can resolve them.
- Keep app TypeScript config local to the app unless published packages also need the same setting.
