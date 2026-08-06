# Radix CLIs Guide

## Source Paths

Primary source root: `./.repos/radixdlt-scrypto`

Key paths:

- `radix-clis/src/bin/scrypto.rs`
- `radix-clis/src/bin/resim.rs`
- `radix-clis/src/bin/rtmc.rs`
- `radix-clis/src/bin/rtmd.rs`
- `radix-clis/src/scrypto/mod.rs`
- `radix-clis/src/scrypto/cmd_build.rs`
- `radix-clis/src/scrypto/cmd_new_package.rs`
- `radix-clis/src/scrypto/cmd_test.rs`
- `radix-clis/src/scrypto/cmd_fmt.rs`
- `radix-clis/src/scrypto/cmd_coverage.rs`
- `radix-clis/src/resim/mod.rs`
- `radix-clis/src/resim/config.rs`
- `radix-clis/src/resim/cmd_new_account.rs`
- `radix-clis/src/resim/cmd_publish.rs`
- `radix-clis/src/resim/cmd_call_function.rs`
- `radix-clis/src/resim/cmd_call_method.rs`
- `radix-clis/src/resim/cmd_run.rs`
- `radix-clis/src/rtmc/mod.rs`
- `radix-clis/src/rtmd/mod.rs`
- `radix-clis/tests/scrypto.sh`
- `radix-clis/tests/resim.sh`
- `radix-clis/tests/rtmc_rtmd.sh`
- `scrypto-compiler/src/lib.rs`

## Mental Model

`radix-clis` is the Rust developer CLI suite for Scrypto and the Radix simulator. It is separate from the TypeScript `rdx` CLI in `radix-web3.js/packages/cli`.

The binaries are thin wrappers. The behavior lives in modules:

- `scrypto` creates, builds, formats, tests, and measures Scrypto packages.
- `resim` manages a local simulator ledger, accounts, packages, manifest execution, and transaction receipts.
- `rtmc` compiles RTM text into binary manifest payloads.
- `rtmd` decompiles binary manifest payloads back into RTM text and optional blobs.

The main boundary is execution target. `scrypto` compiles packages and runs Rust tests. `resim` executes manifests against a local RocksDB-backed simulator under `DATA_DIR` or `~/.scrypto`. `rtmc` and `rtmd` convert manifest artifacts without committing them to the simulator ledger.

For package compilation facts, use `scrypto-compiler` as the source of truth. The CLI flags mostly map into `ScryptoCompiler::builder()`, whose defaults include the `wasm32-unknown-unknown` target, release profile, Scrypto compilation flags, default log-level features, and wasm optimization unless disabled.

## Examples

Use these examples when work touches Rust Scrypto CLI behavior, local simulator workflows, RTM binary conversion, or tests that shell out to the official Radix CLI binaries.

### Change `scrypto build` behavior

Use this when a task changes package compilation flags, workspace package selection, log levels, environment variables, wasm optimization, or lockfile handling.

Start with:

- `./.repos/radixdlt-scrypto/radix-clis/src/scrypto/cmd_build.rs`
- `./.repos/radixdlt-scrypto/scrypto-compiler/src/lib.rs`
- `./.repos/radixdlt-scrypto/radix-clis/tests/scrypto.sh`

Pattern:

```sh
scrypto build --path ./examples/everything --locked --log-level INFO
scrypto build --path ./examples/everything --env ENV_NAME=foo=bar
scrypto build --path ./workspace --package my_scrypto_package --locked
```

`cmd_build.rs` should remain a thin adapter into `ScryptoCompiler::builder()`. Check whether the requested flag already has a builder method before adding CLI-only logic.

Map options deliberately:

- `--path` becomes `manifest_path`.
- `--target-dir` becomes `target_directory`.
- `--log-level` becomes log-level feature selection through the compiler.
- `--disable-wasm-opt` turns off optimization.
- `--locked` becomes Cargo lockfile enforcement.
- `--env` splits only on the first `=`, so `ENV_NAME=foo=bar` is valid.
- `--unset-env` removes a default compiler environment variable.
- `--package` constrains workspace compilation.

Rule: workspace compilation only auto-selects packages with `[package.metadata.scrypto]` when explicit `--package` values are absent. If a package is passed explicitly, verify it belongs to the workspace.

Done when: the command behavior is covered by a CLI test or compiler test, the builder mapping is source-backed, and lockfile behavior is verified through either `--locked` or `SCRYPTO_CARGO_LOCKED`.

### Update Scrypto package scaffolding

Use this when adding files to `scrypto new-package`, changing template dependencies, or adjusting generated `Cargo.lock` behavior.

Start with:

- `./.repos/radixdlt-scrypto/radix-clis/src/scrypto/cmd_new_package.rs`
- `./.repos/radixdlt-scrypto/radix-clis/assets/template/Cargo.toml_template`
- `./.repos/radixdlt-scrypto/radix-clis/assets/template/Cargo.lock_template`
- `./.repos/radixdlt-scrypto/radix-clis/assets/template/rust-toolchain.toml_template`
- `./.repos/radixdlt-scrypto/radix-clis/tests/scrypto.sh`

Pattern:

```sh
scrypto new-package hello-world --path ./target/temp/hello-world --local
scrypto build --path ./target/temp/hello-world --locked
scrypto test --path ./target/temp/hello-world --locked
```

`new-package` writes `Cargo.toml`, `Cargo.lock`, `.gitignore`, `src/lib.rs`, `tests/lib.rs`, and `rust-toolchain.toml`. The `--local` flag switches `sbor`, `scrypto`, and `scrypto-test` dependencies to local path dependencies rooted at the Scrypto repo.

Rule: the generated lockfile is not cosmetic. `tests/scrypto.sh` builds the freshly generated package with `--locked` to prove the template lockfile is complete.

Rule: package names with hyphens produce a WASM/test crate name with underscores through `package_name.replace("-", "_")`.

Done when: a generated package can build and test with `--locked`, local and version dependency modes are still correct, and the generated lockfile includes the new package entry in sorted position.

### Route `scrypto test`, `fmt`, and `coverage`

Use this when a task changes how tests, formatting, or coverage are invoked from the Scrypto CLI.

Start with:

- `./.repos/radixdlt-scrypto/radix-clis/src/scrypto/mod.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/scrypto/cmd_test.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/scrypto/cmd_fmt.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/scrypto/cmd_coverage.rs`
- `./.repos/radixdlt-scrypto/radix-clis/tests/scrypto.sh`
- `./.repos/radixdlt-scrypto/radix-clis/tests/scrypto_coverage.sh`

Pattern:

```sh
scrypto test --path ./target/temp/hello-world --locked
scrypto test --path ./target/temp/hello-world --locked -- test_hello --nocapture
scrypto fmt --path ./target/temp/hello-world --check
scrypto coverage --path ./target/temp/hello-world --locked
```

`scrypto test` passes positional arguments to the test executable and combines `--locked` with `SCRYPTO_CARGO_LOCKED`. `scrypto fmt` defaults to the current directory and exposes check and quiet modes. `scrypto coverage` is a larger pipeline: build with instrumentation, run tests to produce profile data, patch LLVM IR, convert it with clang, merge profile data with `llvm-profdata`, and generate an HTML report with `llvm-cov`.

Rule: coverage assumes the package is built for `wasm32-unknown-unknown` in release mode and that `clang`, `llvm-cov`, and `llvm-profdata` are available on PATH. Do not present it as a pure Cargo command.

Done when: test argument passthrough, format check mode, and coverage prerequisites are represented in tests or docs without changing their command ownership.

### Debug simulator account and ledger state

Use this when a `resim` issue involves missing defaults, account setup, simulator state, nonce behavior, current epoch/time, or where ledger data is stored.

Start with:

- `./.repos/radixdlt-scrypto/radix-clis/src/resim/mod.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/resim/config.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/resim/cmd_new_account.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/resim/cmd_set_default_account.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/resim/cmd_show.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/resim/cmd_show_ledger.rs`
- `./.repos/radixdlt-scrypto/radix-clis/tests/resim.sh`

Pattern:

```sh
resim reset
resim new-account
resim show-configs
resim show-ledger
resim show <component-or-package-or-resource-address>
resim set-current-epoch 858585
resim set-current-time 2023-01-27T13:01:16Z
```

`SimulatorEnvironment::new()` opens the RocksDB store from `DATA_DIR` or `~/.scrypto`, creates VM modules, uses the simulator network definition, and bootstraps protocol updates from the current database state to latest. Config is SBOR-encoded in `config.sbor` and contains default account, default private key, default owner badge, and nonce.

Rule: `resim new-account` creates a Secp256k1 keypair, creates an account with an owner proof rule, mints an owner badge, and initializes defaults only when any default account/private key/owner badge is missing. With `--manifest`, it writes the manifest path and prints the generated keypair for later completion instead of committing the full setup.

Done when: the diagnosis names the exact config source, whether `DATA_DIR` was involved, whether a default account exists, and whether the observed state came from simulator DB contents or command output formatting.

### Publish packages and call blueprints in `resim`

Use this when package publishing, package overwrite, function calls, method calls, schema-based argument construction, or proof injection behaves unexpectedly.

Start with:

- `./.repos/radixdlt-scrypto/radix-clis/src/resim/cmd_publish.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/resim/cmd_call_function.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/resim/cmd_call_method.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/resim/cmd_new_simple_badge.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/utils/resource_specifier.rs`
- `./.repos/radixdlt-scrypto/radix-clis/tests/resim.sh`

Pattern:

```sh
owner_badge=$(resim new-simple-badge --name OwnerBadge | awk '/NonFungibleGlobalId:/ {print $NF}')
package=$(resim publish ./examples/hello-world --owner-badge "$owner_badge" | awk '/Package:/ {print $NF}')
component=$(resim call-function "$package" Hello instantiate_hello | awk '/Component:/ {print $NF}')
resim call-method "$component" free_token
```

`resim publish` either builds a Scrypto package or reads a `.wasm` plus sibling `.rpd` file. A package path goes through `build_package`; a `.wasm` path expects the package definition at the same path with `.rpd`. If `--package-address` is set, the command overwrites package substates directly; otherwise it builds and executes a manifest with `publish_package_with_owner`.

`call-function` and `call-method` load blueprint schema from the simulator database, build call arguments from CLI strings, optionally create proofs from the default account, lock fee from faucet, call the function or method, and deposit the full worktop back to the default account.

Rule: resource arguments and proof arguments are not just strings. They are parsed through schema-aware call argument construction and resource specifier helpers.

Done when: the package path or `.wasm`/`.rpd` path is verified, the owner badge source is explicit, call arguments are checked against blueprint schema, and proof creation is traced to the default account.

### Generate manifests before simulator execution

Use this when a `resim` command should output RTM and blobs instead of executing immediately, or when generated RTM must later be run with blobs.

Start with:

- `./.repos/radixdlt-scrypto/radix-clis/src/resim/mod.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/resim/cmd_publish.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/resim/cmd_call_function.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/resim/cmd_call_method.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/resim/cmd_new_account.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/resim/cmd_run.rs`
- `./.repos/radixdlt-scrypto/radix-clis/tests/resim.sh`

Pattern:

```sh
resim publish ./examples/hello-world --owner-badge "$owner_badge" --manifest ./target/publish.rtm
resim new-account --manifest ./target/new-account.rtm
resim run ./target/publish.rtm --blobs ./target/<blob-hash>.blob
```

The manifest-writing branch lives in `handle_manifest`. If a command passes `--manifest`, `handle_manifest` decompiles the compiled manifest back to RTM and writes blobs next to it unless `DISABLE_MANIFEST_OUTPUT` is set. No simulator transaction is executed in that branch.

`resim run` reads an RTM file, substitutes `${ENV_NAME}` placeholders from the process environment, compiles using a manifest kind that defaults to the latest kind, validates native call arguments, and executes the manifest against the simulator.

Rule: `--network` affects address encoding and manifest compilation, but simulator execution still uses the simulator database and simulator transaction handling.

Done when: generated RTM and blob files are accounted for, `DISABLE_MANIFEST_OUTPUT` behavior is considered, and the later `resim run` command supplies the same blobs that the manifest references.

### Compile and decompile manifest payloads with `rtmc` and `rtmd`

Use this when binary manifest artifacts, subintent manifests, blob export, network-specific decompilation, or manifest validation behavior is under discussion.

Start with:

- `./.repos/radixdlt-scrypto/radix-clis/src/rtmc/mod.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/rtmd/mod.rs`
- `./.repos/radixdlt-scrypto/radix-clis/tests/rtmc_rtmd.sh`
- `./.repos/radixdlt-scrypto/radix-clis/tests/subintent.rtm`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/compiler.rs`
- `./.repos/radixdlt-scrypto/radix-transactions/src/manifest/decompiler.rs`

Pattern:

```sh
rtmc --output ./tests/out/subintent.bin --kind subintentv2 ./tests/subintent.rtm
rtmd --output ./tests/out/subintent.rtm ./tests/out/subintent.bin
rtmd --output ./tests/out/root.rtm --export-blobs ./tests/out/root.bin
```

`rtmc` reads RTM text, resolves network with simulator as default, loads optional blob files, parses the requested manifest kind with latest as default, compiles with pretty diagnostics, validates the manifest, validates native component call arguments, and writes manifest-SBOR bytes.

`rtmd` reads binary bytes, decodes any manifest payload, validates it, validates native component call arguments, decompiles with the selected network, writes RTM, and optionally exports embedded blobs beside the output file.

Rule: use `--kind subintentv2` for subintent fixtures. Do not assume RTM text alone identifies the intended manifest kind.

Done when: the binary/text conversion round trip is tested for the intended manifest kind, validation failures are attributed to compiler/decompiler/native argument validation, and blob paths are preserved.

### Add or debug a `resim` subcommand

Use this when a new simulator command is needed or an existing command is not wired through the CLI enum correctly.

Start with:

- `./.repos/radixdlt-scrypto/radix-clis/src/resim/mod.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/resim/error.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/resim/cmd_run.rs`
- `./.repos/radixdlt-scrypto/radix-clis/src/resim/cmd_transfer.rs`
- `./.repos/radixdlt-scrypto/radix-clis/tests/resim.sh`

Pattern:

1. Add a `cmd_<name>.rs` module.
2. Export the command type from `resim/mod.rs`.
3. Add it to the `Command` enum.
4. Route it in `run()` with the shared `out: &mut Write`.
5. Use `handle_manifest` if the command commits or writes a transaction manifest.
6. Add shell coverage to `tests/resim.sh` or a focused Rust test if stdout parsing would be brittle.

Rule: commands should return `Result<(), String>` through the existing error conversion path and write user-visible output through the provided writer, not direct stdout calls from business logic.

Done when: the new command is reachable through Clap, has deterministic output in tests, shares manifest execution where applicable, and reports simulator failures through existing `Error` variants.

## Reference Routes

- TypeScript `rdx` CLI workflows: use `guide-cli.md`, not this guide.
- Scrypto package compilation: start with `scrypto/cmd_build.rs`, then `scrypto-compiler/src/lib.rs`.
- Scrypto package tests and formatting: start with `scrypto/cmd_test.rs`, `scrypto/cmd_fmt.rs`, and `radix-clis/tests/scrypto.sh`.
- Scrypto coverage: start with `scrypto/cmd_coverage.rs`; verify LLVM tool prerequisites before presenting command examples.
- Simulator account and default config: start with `resim/config.rs`, `cmd_new_account.rs`, and `cmd_set_default_account.rs`.
- Simulator publishing and blueprint calls: start with `cmd_publish.rs`, `cmd_call_function.rs`, `cmd_call_method.rs`, and `tests/resim.sh`.
- Manifest-only simulator output: start with `resim/mod.rs` `handle_manifest`, then the command that accepts `--manifest`.
- RTM binary conversion: start with `rtmc/mod.rs`, `rtmd/mod.rs`, and `tests/rtmc_rtmd.sh`.
- Manifest instruction semantics after CLI routing: use `guide-transaction-manifest.md`.
- Engine receipt or authorization failures after simulator execution: use `guide-receipts-events.md` or `guide-access-rules.md`.

Routing check: choose this guide for Rust binaries named `scrypto`, `resim`, `rtmc`, or `rtmd`. Choose `guide-cli.md` for the TypeScript `rdx` command.

## Usage Notes

- Treat `radix-clis/src/bin/*.rs` as entry points only; inspect the module implementation before changing behavior.
- Prefer existing shell tests under `radix-clis/tests/` for end-to-end CLI behavior.
- Do not describe `resim` as a Gateway or wallet replacement; it is a local simulator against a local database.
- When a command compiles manifests, verify both manifest kind and network before debugging address or validation output.
- Keep package build guidance aligned with `scrypto-compiler`, not ad hoc Cargo commands.
