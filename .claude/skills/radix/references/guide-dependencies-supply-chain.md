# Dependencies And Supply Chain Guide

## Source Paths

Workspace dependency paths:

- `./.repos/radix-web3.js/package.json`
- `./.repos/radix-web3.js/pnpm-workspace.yaml`
- `./.repos/radix-web3.js/pnpm-lock.yaml`
- `./.repos/radix-web3.js/packages/cli/package.json`
- `./.repos/radix-web3.js/packages/core/package.json`
- `./.repos/radix-web3.js/packages/gateway/package.json`
- `./.repos/radix-web3.js/packages/sbor/package.json`
- `./.repos/radix-web3.js/packages/shared/package.json`
- `./.repos/radix-web3.js/packages/tx-tool/package.json`
- `./.repos/radix-web3.js/packages/connect/package.json`
- `./.repos/radix-web3.js/packages/agent-toolkit/package.json`
- `./.repos/radix-web3.js/packages/transaction-stream/package.json`
- `./.repos/radix-web3.js/examples/x402/package.json`
- `./.repos/radix-web3.js/apps/docs/package.json`

Automation paths:

- `./.repos/radix-web3.js/.github/workflows/ci.yml`
- `./.repos/radix-web3.js/.github/workflows/changeset-check.yml`
- `./.repos/radix-web3.js/.github/workflows/release.yml`
- `./.repos/radix-web3.js/.github/workflows/deploy.yml`

## Mental Model

Dependency edits are supply-chain edits. The workspace has several owners:

- root `package.json` owns the repo scripts, `packageManager`, Node engine, and root dev tools
- `pnpm-workspace.yaml` owns workspace membership, shared catalog versions, install-build allowances, release-age exceptions, and transitive overrides
- package `package.json` files own package-local runtime dependencies, dev dependencies, exports, binaries, and publish shape
- `pnpm-lock.yaml` proves the resolved graph that CI installs with a frozen lockfile
- GitHub Actions workflows decide Node runtime, pnpm setup, cache behavior, and install strictness

Use `workspace:*` for internal workspace links. Use `catalog:` for shared external package versions in reusable packages. Keep private app or example-only dependencies local when they do not belong to the shared package graph.

Treat `overrides`, `allowBuilds`, and `minimumReleaseAgeExclude` as security-sensitive configuration. They are not convenience lists. Every new entry should have a reason tied to a dependency, a build script, a vulnerability, or a prerelease package policy.

## Examples

Use these examples when adding, upgrading, pinning, auditing, or removing dependencies in the Radix workspace.

### Add a shared external package dependency

Use this when a reusable package such as gateway, tx-tool, cli, sbor, shared, connect, transaction-stream, core, or agent-toolkit needs a new external dependency.

Start with:

- `./.repos/radix-web3.js/pnpm-workspace.yaml`
- `./.repos/radix-web3.js/pnpm-lock.yaml`
- `./.repos/radix-web3.js/packages/gateway/package.json`
- `./.repos/radix-web3.js/packages/tx-tool/package.json`

Pattern:

```json
{
  "dependencies": {
    "effect": "catalog:"
  }
}
```

Rule: add a version to the workspace `catalog` when the dependency is shared package surface, then reference it from package manifests as `catalog:`. Check whether the dependency has an install script that needs `allowBuilds`, and update `pnpm-lock.yaml` through pnpm instead of hand editing resolved versions.

Done when: the catalog, package manifest, lockfile importer, and package-local build or tests all agree on the new dependency.

### Add an internal workspace dependency

Use this when one package starts importing another package from the same workspace.

Start with:

- `./.repos/radix-web3.js/pnpm-workspace.yaml`
- `./.repos/radix-web3.js/packages/cli/package.json`
- `./.repos/radix-web3.js/packages/gateway/package.json`
- `./.repos/radix-web3.js/packages/shared/package.json`
- `./references/guide-radix-web3-js.md`

Pattern:

```json
{
  "dependencies": {
    "@radix-effects/shared": "workspace:*"
  }
}
```

Rule: internal packages link with `workspace:*`. Before adding the link, verify the package boundary: lower packages should not depend upward on higher orchestration packages, and shared primitives should not pull in heavy Radix Engine Toolkit or Gateway behavior unless that dependency boundary has been intentionally accepted.

Done when: the dependency direction matches the package model, the importing code uses the public package export, and Turbo can build the consumer after its internal dependency.

### Keep app-only dependencies out of shared packages

Use this when a dependency is only needed by Docusaurus docs, the x402 example app, or another private workspace app.

Start with:

- `./.repos/radix-web3.js/apps/docs/package.json`
- `./.repos/radix-web3.js/examples/x402/package.json`
- `./.repos/radix-web3.js/pnpm-workspace.yaml`
- `./references/guide-x402.md`

Pattern:

```json
{
  "private": true,
  "dependencies": {
    "hono": "^4.12.23"
  }
}
```

Rule: private apps may carry direct app-local versions when the dependency is not reused by published packages. Do not move an app-only dependency into the catalog just to centralize everything; move it only when more than one package or app actually shares it.

Done when: the dependency stays in the owning private app, package guides do not route agents to it as reusable API surface, and release rules still ignore private apps where configured.

### Upgrade Effect or Radix SDK versions across packages

Use this when changing `effect`, `@effect/*`, Radix SDK packages, ROLA, Gateway SDKs, or Radix Engine Toolkit versions.

Start with:

- `./.repos/radix-web3.js/pnpm-workspace.yaml`
- `./.repos/radix-web3.js/pnpm-lock.yaml`
- `./.repos/radix-web3.js/packages/gateway/package.json`
- `./.repos/radix-web3.js/packages/tx-tool/package.json`
- `./.repos/radix-web3.js/packages/cli/package.json`
- `./references/guide-effect-services.md`
- `./references/guide-radix-engine-toolkit.md`

Pattern:

```yaml
catalog:
  effect: 4.0.0-beta.83
overrides:
  effect: 4.0.0-beta.83
minimumReleaseAgeExclude:
  - effect@4.0.0-beta.83
```

Rule: version families that must stay aligned should be changed in one pass. Effect beta packages currently appear in both `catalog` and `minimumReleaseAgeExclude`, with `effect` also pinned by `overrides`. Radix SDK and Toolkit upgrades need package tests that exercise Gateway schemas, transaction compilation, signing, and manifest analysis.

Done when: every package still consumes `catalog:` where appropriate, the lockfile resolves the intended versions, and tests cover at least one package that exercises the upgraded runtime API.

### Maintain transitive security overrides

Use this when adding, removing, or changing a `pnpm-workspace.yaml` `overrides` entry for a vulnerable transitive dependency.

Start with:

- `./.repos/radix-web3.js/pnpm-workspace.yaml`
- `./.repos/radix-web3.js/pnpm-lock.yaml`
- `./.repos/radix-web3.js/.github/workflows/ci.yml`

Pattern:

```yaml
overrides:
  vite@<=5.4.19: ">=5.4.20"
```

Rule: make overrides as narrow as the advisory or compatibility reason allows. After changing an override, inspect the lockfile to confirm the vulnerable range no longer resolves, and check whether the override can now be removed because no importer or transitive package still pulls that range.

Done when: the override has a scoped reason, the lockfile proves the desired resolution, and CI install plus package tests can run from the updated lockfile.

### Review install-build allowances

Use this when adding a dependency with native code, postinstall behavior, binary downloads, or build scripts.

Start with:

- `./.repos/radix-web3.js/pnpm-workspace.yaml`
- `./.repos/radix-web3.js/pnpm-lock.yaml`
- `./.repos/radix-web3.js/packages/cli/package.json`
- `./.repos/radix-web3.js/apps/docs/package.json`
- `./.repos/radix-web3.js/examples/x402/package.json`

Pattern:

```yaml
allowBuilds:
  esbuild: true
  sharp: true
  workerd: true
```

Rule: `allowBuilds` is a trust boundary for packages that run install-time build steps. Add the smallest package name required by pnpm, keep known native or toolchain packages explicit, and avoid approving a broad dependency family when only one package needs build access.

Done when: install behavior is explained by the dependency graph, `allowBuilds` is minimal, and the package that introduced the build script still has a local validation command.

### Align lockfile changes with CI installs

Use this when a package manifest, catalog, override, pnpm version, or workflow install command changes.

Start with:

- `./.repos/radix-web3.js/package.json`
- `./.repos/radix-web3.js/pnpm-workspace.yaml`
- `./.repos/radix-web3.js/pnpm-lock.yaml`
- `./.repos/radix-web3.js/.github/workflows/ci.yml`
- `./.repos/radix-web3.js/.github/workflows/release.yml`
- `./.repos/radix-web3.js/.github/workflows/deploy.yml`

Pattern:

```text
CI: pnpm install --frozen-lockfile
Release: pnpm install
Deploy: pnpm install
Changeset Check: pnpm install
```

Rule: a manifest or catalog change must update `pnpm-lock.yaml` before CI can pass, because main CI uses `--frozen-lockfile`. Release, deploy, and Changeset check currently allow plain install, so do not use their looser install behavior as proof that the lockfile is correct for pull request CI.

Done when: the lockfile contains the expected importer and catalog changes, frozen CI install would not need to rewrite it, and workflow install strictness remains intentional.

### Keep Node and pnpm runtime policy aligned

Use this when changing `packageManager`, Node engine ranges, workflow Node versions, docs app engines, or setup-node cache behavior.

Start with:

- `./.repos/radix-web3.js/package.json`
- `./.repos/radix-web3.js/apps/docs/package.json`
- `./.repos/radix-web3.js/.github/workflows/ci.yml`
- `./.repos/radix-web3.js/.github/workflows/release.yml`
- `./.repos/radix-web3.js/.github/workflows/deploy.yml`

Pattern:

```text
root packageManager: pnpm@11.5.2
root engines.node: >=20
workflow node-version: 22
docs engines.node: >=18.0
```

Rule: workflows run Node 22, which satisfies the root engine and docs engine. If the root engine, docs engine, or workflow runtime changes, update every workflow that installs dependencies and verify `actions/setup-node` cache behavior still matches pnpm.

Done when: local package manager policy, Node engine constraints, and workflow runtime setup all describe the same supported install environment.

## Reference Routes

- Package boundaries and reusable API ownership: use `guide-radix-web3-js.md`.
- Build outputs, exports, bins, workspace scripts, and Changesets behavior: inspect package manifests, build configs, root scripts, and workflow files directly.
- GitHub Actions install behavior, Node versions, cache setup, and permissions: inspect `.github/workflows/*.yml` directly with this guide.
- Shared schema dependency limits: use `guide-shared.md`.
- Effect package upgrades and layer patterns: use `guide-effect-services.md`.
- Radix Engine Toolkit upgrades and byte or manifest boundary behavior: use `guide-radix-engine-toolkit.md`.

Routing check: start here for dependency graph, catalog, override, lockfile, and install-trust questions, then route to the owning package or automation guide for behavior-level changes.

## Usage Notes

- Treat `pnpm-workspace.yaml` as policy, not as a dumping ground for versions.
- Keep shared dependency versions in the catalog unless the dependency is intentionally app-local.
- Never hand edit resolved package entries in `pnpm-lock.yaml`; regenerate them with pnpm and inspect the diff.
- Keep `allowBuilds` minimal because it grants install-time code execution.
- Keep transitive overrides narrow and remove them when the vulnerable range leaves the graph.
- For publishable package changes, dependency edits may require a Changesets entry even when source code changes are small.
