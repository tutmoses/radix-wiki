# Radix Source Setup

This setup task is required when either source checkout is missing from the root of the repository where this skill is used:

- `./.repos/radix-web3.js`
- `./.repos/radixdlt-scrypto`

## When Not To Run Setup

Do not run the setup script when the target repository already has usable Radix source checkouts at project-specific paths, when the user asked for a read-only audit, or when global npm installs are not acceptable for the current environment.

The script may edit `.gitignore` and may install `rdx-cli` globally if the `rdx` binary is missing. If that is too invasive, use existing local clones and note the alternate paths in your work summary. If `git` is unavailable when a clone is needed or when an existing checkout must be verified, if an existing checkout points at the wrong `remote.origin.url`, if `npm` is unavailable, or if `rdx-cli` installs but `rdx` is not on `PATH`, the script fails instead of claiming setup succeeded.

## Preferred Setup

Use local clones ignored by Git. This mirrors the Effect skill's local source checkout pattern while keeping the application repository clean.

Run from the target repository root:

```sh
<path-to-this-skill>/scripts/prepare-radix-sources.sh
```

The script clones:

- `https://github.com/xstelea/radix-web3.js` into `./.repos/radix-web3.js`
- `https://github.com/radixdlt/radixdlt-scrypto` into `./.repos/radixdlt-scrypto`

It also adds both paths to `.gitignore` and installs the `rdx-cli` npm package globally when the `rdx` binary is missing. Existing git checkouts are reused only when `remote.origin.url` matches the expected GitHub repository in HTTPS or SSH form; an existing non-git directory or wrong-repo checkout at either target path is treated as an error so the script does not hide a broken source checkout.

## CLI Install

Install the agent-first CLI globally:

```sh
npm install -g rdx-cli
```

Verify the binary:

```sh
rdx --help
rdx config show
rdx llm
```

`rdx-cli` publishes the `rdx` executable. Use it for file-backed Radix transaction workflows, not as a consumer wallet or key store.

## Manual Shape

If the script cannot be used, apply this shape manually:

```sh
mkdir -p .repos
git clone https://github.com/xstelea/radix-web3.js .repos/radix-web3.js
git clone https://github.com/radixdlt/radixdlt-scrypto .repos/radixdlt-scrypto
npm install -g rdx-cli
```

`.gitignore`:

```gitignore
.repos/radix-web3.js
.repos/radixdlt-scrypto
```

## Guidance

- Do not edit files under `./.repos` unless the user explicitly asks.
- Do not import application code from `./.repos`; import from normal package dependencies.
- Existing clones are not updated, reset, or cleaned by the setup script.
- A failed setup script means Radix-specific work is not source-backed yet; fix the missing clone, wrong remote, broken directory, missing `git`, npm install, or `PATH` issue before relying on the guides.
- Prefer the current repository's own vendored source paths if they already exist.
