#!/usr/bin/env python3
"""Validate the Radix skill without external Python dependencies."""

from __future__ import annotations

import argparse
import os
import posixpath
import re
import subprocess
import sys
from pathlib import Path


STALE_PATTERNS = [
    r"^## Example$",
    r"^### Additional example routes",
    "TO" "DO",
    "[" + "\u2192" + "\u2190" + "\u2022" + "\u2014" + "]",
    r"packages/\*/src",
    "adjacent schema " "tests",
    "exported prelude " "patterns",
    r"`\./\.repos/radixdlt-scrypto/radix-common/src/address`",
    "missing `owner_keys` metadata as an " "implicit",
    "derive the virtual account address from the " "proof",
    "expired payment, and insufficient " "amount",
    "store in-flight or completed settlement " "state",
    "valid payment, and downstream handler " "invocation",
    "RejectedDepositEvent = " "struct",
    "Done when: adjacent " "routing",
    r"^Example routes:",
    r"^Test route:",
    "the tool's " "Zod schema",
    "the tool implementation " "file",
    "lower-package tests " "only",
]

SETUP_REPOS = [
    (
        "radix-web3.js",
        "https://github.com/xstelea/radix-web3.js",
        "xstelea/radix-web3.js",
        ".repos/radix-web3.js",
    ),
    (
        "radixdlt-scrypto",
        "https://github.com/radixdlt/radixdlt-scrypto",
        "radixdlt/radixdlt-scrypto",
        ".repos/radixdlt-scrypto",
    ),
]

SOURCE_ROOT_IDENTITY_MARKERS = {
    "./.repos/radix-web3.js": [
        ("package.json", '"name": "radix-web3.js"'),
        ("packages/cli/package.json", '"name": "rdx-cli"'),
    ],
    "./.repos/radixdlt-scrypto": [
        ("Cargo.toml", 'radix-engine-interface'),
        ("Cargo.toml", 'radix-transactions'),
        ("radix-engine-interface/Cargo.toml", 'name = "radix-engine-interface"'),
        ("radix-transactions/Cargo.toml", 'name = "radix-transactions"'),
    ],
}

EXPECTED_TOP_LEVEL_ENTRIES = [
    "SKILL.md",
    "agents",
    "references",
    "scripts",
]

EXPECTED_AGENT_FILES = [
    "openai.yaml",
]

EXPECTED_SCRIPT_FILES = [
    "prepare-radix-sources.sh",
    "validate-radix-skill.py",
]

CLI_COMMAND_HEADINGS = [
    "rdx llm",
    "rdx config show",
    "rdx account derive --public-key <hex>",
    "rdx account show <accountAddress>",
    "rdx account fungibles <accountAddress>",
    "rdx account nfts <accountAddress>",
    "rdx template print subintents",
    "rdx template print signing-request",
    "rdx template print signature-template",
    "rdx template print signature-file",
    "rdx tx prepare --manifest <file> [--notary-file <file>] [--subintents <file>]",
    "rdx tx add-signatures <transactionId> --file <file> [--file <file> ...]",
    "rdx tx notarize <transactionId>",
    "rdx tx submit <transactionId>",
    "rdx tx status <transactionId> [--read-only]",
    "rdx tx path <transactionId>",
    "rdx tx list [filters]",
    "rdx tx history <accountAddress> [--limit <n>]",
    "rdx subintent prepare --manifest <file> --header <file> [--root-manifest <file>] [--no-preview]",
    "rdx subintent build --prepared <file> --signature <file>",
]

CLI_REQUIRED_SNIPPETS = [
    "npm install -g rdx-cli",
    "rdx --help",
    "rdx config show",
    "rdx llm",
    "rdx --format json <command>",
    "rdx --format text <command>",
    "`rdx-cli` publishes the `rdx` binary",
]

CLI_SOURCE_COMMANDS = [
    ("llmCommand", "llm"),
    ("configShowCommand", "show"),
    ("accountDeriveCommand", "derive"),
    ("accountShowCommand", "show"),
    ("accountFungiblesCommand", "fungibles"),
    ("accountNftsCommand", "nfts"),
    ("templatePrintCommand", "print"),
    ("txPrepareCommand", "prepare"),
    ("txAddSignaturesCommand", "add-signatures"),
    ("txNotarizeCommand", "notarize"),
    ("txSubmitCommand", "submit"),
    ("txStatusCommand", "status"),
    ("txPathCommand", "path"),
    ("txListCommand", "list"),
    ("txHistoryCommand", "history"),
    ("subintentPrepareCommand", "prepare"),
    ("subintentBuildCommand", "build"),
]

CLI_SOURCE_SNIPPETS = [
    "Command.withSharedFlags({ format: formatOption })",
    "Options.choice('format', ['json', 'text'] as const)",
    "Command.withSubcommands([",
    "accountCommand.pipe(",
    "configCommand.pipe(",
    "templateCommand.pipe(",
    "subintentCommand.pipe(",
    "txCommand.pipe(",
]

OPENAI_DEFAULT_PROMPT_TERMS = [
    "$radix",
    "radix-web3.js",
    "Effect services",
    "testing",
    "error diagnostics",
    "dependencies/supply chain",
    "TypeScript tooling",
    "configuration",
    "network/address handling",
    "rdx CLI",
    "Radix CLIs",
    "tx-tool",
    "Rust transaction crate",
    "Radix Engine Toolkit",
    "x402",
    "Gateway",
    "staking/validators",
    "wallet/ROLA",
    "accounts",
    "account lockers",
    "access controllers",
    "access rules",
    "role assignment",
    "transaction manifests",
    "receipts/events",
    "costing/fees",
    "royalties",
    "resources/vaults",
    "metadata",
    "pools/pool units",
    "components/packages",
    "subintents",
    "SBOR",
    "Scrypto",
]

MAX_SKILL_DESCRIPTION_CHARS = 650

SKILL_DESCRIPTION_TERMS = [
    "Radix expertise",
    "Use when",
    "radix-web3.js",
    "radixdlt-scrypto",
    "costing/fees",
    "royalties",
    "metadata",
    "role assignment",
    "Radix CLIs",
    "Scrypto",
]

EXPECTED_SKILL_TITLE = "Radix"

EXPECTED_SKILL_SECTIONS = [
    "Overview",
    "Prerequisite",
    "Research Strategy",
    "Guide Selection",
    "Radix Principles",
    "Source Paths",
    "Answering Questions",
]

GUIDE_SELECTION_ROUTES = [
    "./references/guide-radix-web3-js.md",
    "./references/guide-effect-services.md",
    "./references/guide-configuration.md",
    "./references/guide-dependencies-supply-chain.md",
    "./references/guide-typescript-tooling.md",
    "./references/guide-testing.md",
    "./references/guide-error-diagnostics.md",
    "./references/guide-x402.md",
    "./references/guide-core.md",
    "./references/guide-network-addresses.md",
    "./references/guide-connect.md",
    "./references/guide-cli.md",
    "./references/guide-radix-clis.md",
    "./references/guide-tx-tool.md",
    "./references/guide-gateway.md",
    "./references/guide-staking-validators.md",
    "./references/guide-transaction-stream.md",
    "./references/guide-receipts-events.md",
    "./references/guide-costing-fees.md",
    "./references/guide-royalties.md",
    "./references/guide-transaction-manifest.md",
    "./references/guide-resources-vaults.md",
    "./references/guide-metadata.md",
    "./references/guide-pools.md",
    "./references/guide-components-packages.md",
    "./references/guide-radix-engine-toolkit.md",
    "./references/guide-subintents.md",
    "./references/guide-transactions.md",
    "./references/guide-rust-transactions.md",
    "./references/guide-wallet-rola.md",
    "./references/guide-account.md",
    "./references/guide-account-lockers.md",
    "./references/guide-access-controllers.md",
    "./references/guide-sbor.md",
    "./references/guide-shared.md",
    "./references/guide-role-assignment.md",
    "./references/guide-access-rules.md",
    "./references/guide-scrypto.md",
]

WEB3_PACKAGE_GUIDE_ROUTES = {
    "cli": "./references/guide-cli.md",
    "connect": "./references/guide-connect.md",
    "core": "./references/guide-core.md",
    "gateway": "./references/guide-gateway.md",
    "sbor": "./references/guide-sbor.md",
    "shared": "./references/guide-shared.md",
    "transaction-stream": "./references/guide-transaction-stream.md",
    "tx-tool": "./references/guide-tx-tool.md",
}

EXPECTED_GUIDE_FILES = sorted(Path(route).name for route in GUIDE_SELECTION_ROUTES)

GUIDE_TITLES = {
    "guide-access-controllers.md": "Access Controllers Guide",
    "guide-access-rules.md": "Access Rules Guide",
    "guide-account.md": "Account Guide",
    "guide-account-lockers.md": "Account Lockers Guide",
    "guide-cli.md": "CLI Guide",
    "guide-components-packages.md": "Components And Packages Guide",
    "guide-configuration.md": "Configuration Guide",
    "guide-connect.md": "Connect Guide",
    "guide-costing-fees.md": "Costing And Fees Guide",
    "guide-dependencies-supply-chain.md": "Dependencies And Supply Chain Guide",
    "guide-error-diagnostics.md": "Error Diagnostics Guide",
    "guide-effect-services.md": "Effect Services Guide",
    "guide-core.md": "Core Guide",
    "guide-gateway.md": "Gateway Guide",
    "guide-network-addresses.md": "Network And Addresses Guide",
    "guide-metadata.md": "Metadata Guide",
    "guide-pools.md": "Pools Guide",
    "guide-radix-clis.md": "Radix CLIs Guide",
    "guide-radix-engine-toolkit.md": "Radix Engine Toolkit Guide",
    "guide-radix-web3-js.md": "Radix Web3.js Guide",
    "guide-receipts-events.md": "Receipts And Events Guide",
    "guide-role-assignment.md": "Role Assignment Guide",
    "guide-resources-vaults.md": "Resources And Vaults Guide",
    "guide-royalties.md": "Royalties Guide",
    "guide-rust-transactions.md": "Rust Transactions Guide",
    "guide-sbor.md": "SBOR Guide",
    "guide-scrypto.md": "Scrypto Guide",
    "guide-shared.md": "Shared Types Guide",
    "guide-staking-validators.md": "Staking And Validators Guide",
    "guide-subintents.md": "Subintents Guide",
    "guide-testing.md": "Testing Guide",
    "guide-transaction-manifest.md": "Transaction Manifest Guide",
    "guide-transaction-stream.md": "Transaction Stream Guide",
    "guide-transactions.md": "Transactions Guide",
    "guide-tx-tool.md": "Tx Tool Guide",
    "guide-typescript-tooling.md": "TypeScript Tooling Guide",
    "guide-wallet-rola.md": "Wallet And ROLA Guide",
    "guide-x402.md": "x402 Guide",
}

EXPECTED_REFERENCE_FILES = sorted(
    [
        "cli-command-reference.md",
        "setup.md",
        *EXPECTED_GUIDE_FILES,
    ],
)

GENERATED_ARTIFACT_NAMES = {
    ".DS_Store",
    "__pycache__",
}

GENERATED_ARTIFACT_SUFFIXES = {
    ".pyc",
    ".pyo",
}


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def parse_frontmatter(text: str, path: Path) -> dict[str, str]:
    if not text.startswith("---\n"):
        fail(f"{path}: missing frontmatter")
    end = text.find("\n---\n", 4)
    if end == -1:
        fail(f"{path}: unterminated frontmatter")

    result: dict[str, str] = {}
    for line in text[4:end].splitlines():
        if not line.strip():
            continue
        if ":" not in line:
            fail(f"{path}: invalid frontmatter line: {line}")
        key, value = line.split(":", 1)
        result[key.strip()] = value.strip().strip('"')
    return result


def parse_openai_yaml(text: str, path: Path) -> dict[str, str]:
    expected_keys = ["display_name", "short_description", "default_prompt"]
    lines = [line for line in text.splitlines() if line.strip()]
    if not lines or lines[0] != "interface:":
        fail(f"{path}: first non-empty line must be interface:")
    if len(lines) != len(expected_keys) + 1:
        fail(f"{path}: expected only interface fields {expected_keys}")

    result: dict[str, str] = {}
    for line, key in zip(lines[1:], expected_keys, strict=True):
        prefix = f"  {key}: "
        if not line.startswith(prefix):
            fail(f"{path}: expected quoted {key} field")
        value = line[len(prefix) :]
        if len(value) < 2 or not value.startswith('"') or not value.endswith('"'):
            fail(f"{path}: {key} must be a quoted string")
        result[key] = value[1:-1]
    return result


def assert_ascii_markdown(root: Path) -> int:
    count = 0
    for path in sorted(root.rglob("*.md")):
        path.read_text().encode("ascii")
        count += 1
    return count


def assert_skill_tree(root: Path) -> None:
    for path in sorted(root.rglob("*")):
        if path.name in GENERATED_ARTIFACT_NAMES or path.suffix in GENERATED_ARTIFACT_SUFFIXES:
            fail(f"{path}: generated artifact must not be stored in the skill")

    top_level = sorted(path.name for path in root.iterdir())
    if top_level != EXPECTED_TOP_LEVEL_ENTRIES:
        fail(f"{root}: expected top-level entries {EXPECTED_TOP_LEVEL_ENTRIES}, found {top_level}")

    if not (root / "SKILL.md").is_file():
        fail(f"{root / 'SKILL.md'}: missing skill entrypoint")

    expected_dirs = ["agents", "references", "scripts"]
    for dirname in expected_dirs:
        if not (root / dirname).is_dir():
            fail(f"{root / dirname}: expected directory")

    agents_entries = sorted(path.name for path in (root / "agents").iterdir())
    if agents_entries != EXPECTED_AGENT_FILES:
        fail(f"agents/: expected files {EXPECTED_AGENT_FILES}, found {agents_entries}")

    scripts_entries = sorted(path.name for path in (root / "scripts").iterdir())
    if scripts_entries != EXPECTED_SCRIPT_FILES:
        fail(f"scripts/: expected files {EXPECTED_SCRIPT_FILES}, found {scripts_entries}")

    reference_entries = sorted(path.name for path in (root / "references").iterdir())
    if reference_entries != EXPECTED_REFERENCE_FILES:
        fail(f"references/: expected files {EXPECTED_REFERENCE_FILES}, found {reference_entries}")


def assert_skill_frontmatter(root: Path) -> None:
    path = root / "SKILL.md"
    text = path.read_text()
    meta = parse_frontmatter(text, path)
    if set(meta) != {"name", "description"}:
        fail(f"{path}: frontmatter must contain only name and description")
    if meta["name"] != "radix":
        fail(f"{path}: expected name radix")
    description = meta["description"]
    if len(description) > MAX_SKILL_DESCRIPTION_CHARS:
        fail(
            f"{path}: description must be <= {MAX_SKILL_DESCRIPTION_CHARS} chars, "
            f"found {len(description)}"
        )
    for term in SKILL_DESCRIPTION_TERMS:
        if term not in description:
            fail(f"{path}: description missing {term}")

    titles = re.findall(r"^# (.+)$", text, re.MULTILINE)
    if titles != [EXPECTED_SKILL_TITLE]:
        fail(f"{path}: expected title {EXPECTED_SKILL_TITLE}, found {titles}")
    sections = re.findall(r"^## (.+)$", text, re.MULTILINE)
    if sections != EXPECTED_SKILL_SECTIONS:
        fail(f"{path}: expected sections {EXPECTED_SKILL_SECTIONS}, found {sections}")


def assert_openai_yaml(root: Path) -> None:
    path = root / "agents" / "openai.yaml"
    meta = parse_openai_yaml(path.read_text(), path)
    if meta["display_name"] != "Radix":
        fail(f"{path}: display_name must be Radix")
    short = meta["short_description"]
    if not 25 <= len(short) <= 64:
        fail(f"{path}: short_description must be 25-64 chars")
    if "verified local guidance" not in short:
        fail(f"{path}: short_description must mention verified local guidance")
    prompt = meta["default_prompt"]
    if not prompt.startswith("Use $radix "):
        fail(f"{path}: default_prompt must start with Use $radix")
    if not prompt.endswith(".") or ". " in prompt:
        fail(f"{path}: default_prompt must be one sentence")
    for term in OPENAI_DEFAULT_PROMPT_TERMS:
        if term not in prompt:
            fail(f"{path}: default_prompt missing {term}")


def assert_scripts(root: Path) -> None:
    for name in EXPECTED_SCRIPT_FILES:
        path = root / "scripts" / name
        if not path.is_file():
            fail(f"{path}: missing script")
        if not os.access(path, os.X_OK):
            fail(f"{path}: script must be executable")

    skill = (root / "SKILL.md").read_text()
    if "scripts/prepare-radix-sources.sh" not in skill:
        fail("SKILL.md: missing prepare-radix-sources.sh maintenance pointer")
    if "./scripts/validate-radix-skill.py" not in skill:
        fail("SKILL.md: missing validate-radix-skill.py maintenance pointer")

    prepare = (root / "scripts" / "prepare-radix-sources.sh").read_text()
    for needle in [
        "set -eu",
        "ensure_git_available()",
        "remote_matches_expected()",
        "ensure_expected_remote()",
        "command -v git",
        "remote.origin.url",
        'git clone "$repo_url" "$repo_dir"',
        'if [ -e "$repo_dir" ]; then',
        "command -v rdx",
        "command -v npm",
        "npm install -g rdx-cli",
    ]:
        if needle not in prepare:
            fail(f"prepare-radix-sources.sh: missing {needle}")
    for repo_name, repo_url, repo_slug, gitignore_entry in SETUP_REPOS:
        clone_line = f'ensure_clone "{repo_name}" "{repo_url}" "{repo_slug}"'
        ignore_line = f'ensure_gitignore_entry "{gitignore_entry}"'
        if clone_line not in prepare:
            fail(f"prepare-radix-sources.sh: missing {clone_line}")
        if ignore_line not in prepare:
            fail(f"prepare-radix-sources.sh: missing {ignore_line}")

    setup = (root / "references" / "setup.md").read_text()
    setup_needles = [
        "scripts/prepare-radix-sources.sh",
        "If `git` is unavailable when a clone is needed",
        "wrong `remote.origin.url`",
        "wrong-repo checkout",
        "missing `git`",
        "npm install -g rdx-cli",
        "rdx --help",
        "rdx config show",
        "rdx llm",
    ]
    for repo_name, repo_url, repo_slug, gitignore_entry in SETUP_REPOS:
        setup_needles.extend(
            [
                f"`{repo_url}` into `./{gitignore_entry}`",
                f"git clone {repo_url} {gitignore_entry}",
                repo_slug,
                gitignore_entry,
            ],
        )
    for needle in setup_needles:
        if needle not in setup:
            fail(f"setup.md: missing {needle}")


def task_example_blocks(section: str) -> list[tuple[str, str]]:
    blocks: list[tuple[str, str]] = []
    current_title: str | None = None
    current_lines: list[str] = []

    for line in section.splitlines():
        if line.startswith("### "):
            if current_title is not None:
                blocks.append((current_title, "\n".join(current_lines)))
            current_title = line[4:]
            current_lines = []
        elif current_title is not None:
            current_lines.append(line)

    if current_title is not None:
        blocks.append((current_title, "\n".join(current_lines)))

    return blocks


def start_with_section(body: str, path: Path, title: str) -> str:
    if "Start with:" not in body:
        fail(f"{path.name}: example lacks Start with: {title}")
    start = body.split("Start with:", 1)[1]
    if "Pattern:" in start:
        return start.split("Pattern:", 1)[0]
    return start


def assert_example_label_counts(path: Path, title: str, body: str) -> None:
    expected_labels = ["Use this when", "Start with:", "Pattern:", "Done when:"]
    for label in expected_labels:
        count = len(re.findall(rf"^{re.escape(label)}", body, re.MULTILINE))
        if count != 1:
            fail(f"{path.name}: example must have exactly one {label} marker: {title} ({count})")
    label_positions = [body.find(label) for label in expected_labels]
    if label_positions != sorted(label_positions):
        fail(f"{path.name}: example labels must appear as Use this when, Start with, Pattern, Done when: {title}")


def assert_start_with_path_bullets(path: Path, title: str, start: str) -> None:
    for line in start.splitlines():
        if not line:
            continue
        if not re.fullmatch(r"- `[^`]+`", line):
            fail(f"{path.name}: example Start with must contain only backticked path bullets: {title}: {line}")


def assert_start_with_local_refs(path: Path, title: str, refs: list[str]) -> None:
    for ref in refs:
        if not (ref.startswith("./.repos/") or ref.startswith("./references/")):
            fail(f"{path.name}: example Start with ref must be local source or reference path: {title}: {ref}")


def assert_guide_structure(path: Path, text: str) -> None:
    if not text.startswith("# ") or text.count("\n# ") != 0:
        fail(f"{path.name}: expected exactly one top-level # heading")
    expected_title = GUIDE_TITLES.get(path.name)
    if expected_title is None:
        fail(f"{path.name}: missing expected guide title")
    first_line = text.splitlines()[0]
    if first_line != f"# {expected_title}":
        fail(f"{path.name}: expected title '# {expected_title}', found '{first_line}'")

    expected = ["Source Paths", "Mental Model", "Examples", "Reference Routes", "Usage Notes"]
    if path.name == "guide-cli.md":
        expected = ["Source Paths", "Mental Model", "Command Syntax", "Examples", "Reference Routes", "Usage Notes"]

    headings = re.findall(r"^## (.+)$", text, re.MULTILINE)
    if headings != expected:
        fail(f"{path.name}: expected guide sections {expected}, found {headings}")

    for heading in expected:
        if text.count(f"\n## {heading}\n") != 1:
            fail(f"{path.name}: expected exactly one ## {heading} section")


def assert_reference_routes_structure(path: Path, routes: str) -> None:
    nonblank = [line for line in routes.splitlines() if line]
    bullets = [line for line in nonblank if line.startswith("- ")]
    routing = [line for line in nonblank if line.startswith("Routing check:")]
    others = [
        line
        for line in nonblank
        if not line.startswith("- ") and not line.startswith("Routing check:")
    ]

    if len(bullets) < 3:
        fail(f"{path.name}: ## Reference Routes must contain at least three route bullets")
    if others:
        fail(f"{path.name}: ## Reference Routes contains non-route lines: {others}")
    if len(routing) != 1:
        fail(f"{path.name}: ## Reference Routes must contain exactly one Routing check")
    if nonblank[-1] != routing[0]:
        fail(f"{path.name}: Routing check must be the final Reference Routes line")


def source_paths_section(text: str, path: Path) -> str:
    marker = "\n## Source Paths\n"
    start = text.find(marker)
    if start == -1:
        fail(f"{path.name}: missing ## Source Paths section")
    section = text[start + len(marker) :]
    end = section.find("\n## Mental Model\n")
    if end == -1:
        fail(f"{path.name}: ## Source Paths must be followed by ## Mental Model")
    return section[:end]


def assert_source_paths_structure(path: Path, text: str) -> None:
    section = source_paths_section(text, path)
    primary_roots = re.findall(r"^Primary source root: `(\./\.repos/[^`]+)`$", section, re.MULTILINE)
    direct_source_refs = re.findall(r"^- `(\./\.repos/[^`]+)`$", section, re.MULTILINE)

    if len(primary_roots) > 1:
        fail(f"{path.name}: ## Source Paths must contain at most one Primary source root")

    if primary_roots:
        key_refs = primary_key_path_refs(path, text)
        if len(key_refs) < 3:
            fail(f"{path.name}: Primary source root guides must include at least three Key paths")
        return

    if len(direct_source_refs) < 3:
        fail(f"{path.name}: ## Source Paths must include at least three concrete .repos source paths")


def assert_skill_guide_routes(skill: str) -> None:
    start_marker = "\n## Guide Selection\n"
    start = skill.find(start_marker)
    if start == -1:
        fail("SKILL.md: missing ## Guide Selection section")
    section = skill[start + len(start_marker) :]
    next_section = section.find("\n## ")
    if next_section != -1:
        section = section[:next_section]

    routes = re.findall(r"^- `(\./references/guide-[^`]+)`", section, re.MULTILINE)
    if routes != GUIDE_SELECTION_ROUTES:
        fail(f"SKILL.md: Guide Selection routes differ from expected order: {routes}")


def assert_web3_package_guide_coverage(root: Path, args: argparse.Namespace) -> None:
    skill = (root / "SKILL.md").read_text()
    for package_name, route in WEB3_PACKAGE_GUIDE_ROUTES.items():
        expected_route = f"- `{route}` for `packages/{package_name}`"
        if expected_route not in skill:
            fail(f"SKILL.md: package {package_name} must be explicitly routed to {route}")

    source_roots = source_roots_from_args(args, root)
    web3_root = source_roots["./.repos/radix-web3.js"]
    if web3_root is None:
        return

    packages_dir = web3_root / "packages"
    if not packages_dir.exists():
        fail(f"radix-web3.js source root lacks packages directory: {packages_dir}")

    actual_packages = sorted(
        path.name
        for path in packages_dir.iterdir()
        if path.is_dir() and (path / "package.json").is_file()
    )
    expected_packages = sorted(WEB3_PACKAGE_GUIDE_ROUTES)
    missing_packages = [package for package in expected_packages if package not in actual_packages]
    if missing_packages:
        fail(f"radix-web3.js package guide coverage references missing packages: {missing_packages}")


def assert_source_root_identity(root: Path, args: argparse.Namespace) -> None:
    source_roots = source_roots_from_args(args, root)
    for source_ref, markers in SOURCE_ROOT_IDENTITY_MARKERS.items():
        source_root = source_roots[source_ref]
        if source_root is None:
            continue
        if not source_root.exists():
            fail(f"source root does not exist for {source_ref}: {source_root}")
        for relative_path, snippet in markers:
            path = source_root / relative_path
            if not path.is_file():
                fail(f"{source_ref}: missing identity marker file {relative_path} at {path}")
            if snippet not in path.read_text():
                fail(f"{source_ref}: identity marker {relative_path} missing {snippet}")


def assert_guides(root: Path) -> tuple[int, int]:
    skill = (root / "SKILL.md").read_text()
    assert_skill_guide_routes(skill)

    guide_paths = sorted((root / "references").glob("guide-*.md"))
    guide_files = [path.name for path in guide_paths]
    if guide_files != EXPECTED_GUIDE_FILES:
        fail(f"expected guide files {EXPECTED_GUIDE_FILES}, found {guide_files}")
    if sorted(GUIDE_TITLES) != EXPECTED_GUIDE_FILES:
        fail(f"expected guide title keys {EXPECTED_GUIDE_FILES}, found {sorted(GUIDE_TITLES)}")

    guide_count = len(guide_paths)
    example_count = 0

    for path in guide_paths:
        text = path.read_text()
        route = f"./references/{path.name}"
        if GUIDE_SELECTION_ROUTES.count(route) != 1:
            fail(f"{path.name}: missing exact route from Guide Selection")
        assert_guide_structure(path, text)
        assert_source_paths_structure(path, text)
        if text.count("\n## Examples\n") != 1:
            fail(f"{path.name}: expected exactly one ## Examples section")
        if "\n## Example\n" in text:
            fail(f"{path.name}: use ## Examples, not ## Example")
        if "\n### Additional example routes" in text:
            fail(f"{path.name}: use ## Reference Routes, not an example route heading")

        examples_pos = text.index("\n## Examples\n")
        usage_pos = text.find("\n## Usage Notes\n")
        if usage_pos == -1:
            fail(f"{path.name}: missing ## Usage Notes section")
        routes_pos = text.find("\n## Reference Routes\n")
        if routes_pos == -1:
            fail(f"{path.name}: missing ## Reference Routes section")
        if not examples_pos < routes_pos < usage_pos:
            fail(f"{path.name}: ## Reference Routes must sit between examples and usage notes")
        routes = text.split("\n## Reference Routes\n", 1)[1].split("\n## Usage Notes\n", 1)[0]
        if "\n### " in routes:
            fail(f"{path.name}: ## Reference Routes must not contain task example headings")
        if "Done when:" in routes:
            fail(f"{path.name}: ## Reference Routes must use Routing check, not Done when")
        if "Routing check:" not in routes:
            fail(f"{path.name}: ## Reference Routes missing Routing check")
        assert_reference_routes_structure(path, routes)

        examples = text.split("\n## Examples\n", 1)[1]
        examples = examples.split("\n## Reference Routes\n", 1)[0]
        examples = examples.split("\n## Usage Notes\n", 1)[0]
        blocks = task_example_blocks(examples)
        example_count += len(blocks)

        if len(blocks) < 5:
            fail(f"{path.name}: expected at least five task examples")
        for title, body in blocks:
            assert_example_label_counts(path, title, body)
            if "Use this when" not in body:
                fail(f"{path.name}: example lacks Use this when: {title}")
            start = start_with_section(body, path, title)
            assert_start_with_path_bullets(path, title, start)
            refs = re.findall(r"^- `([^`]+)`$", start, re.MULTILINE)
            if not refs:
                fail(f"{path.name}: example Start with has no backticked bullet refs: {title}")
            assert_start_with_local_refs(path, title, refs)
            if "Pattern:" not in body:
                fail(f"{path.name}: example lacks Pattern: {title}")
            if "Done when:" not in body:
                fail(f"{path.name}: example lacks Done when: {title}")

    return guide_count, example_count


def assert_reference_links(root: Path) -> int:
    checked = 0
    for path in sorted(root.rglob("*.md")):
        text = path.read_text()
        for match in re.finditer(r"`(\./references/[^`]+)`", text):
            ref = match.group(1)
            if "*" in ref:
                continue
            actual = root / ref[2:]
            checked += 1
            if not actual.exists():
                fail(f"{path.name}: missing reference link {ref}")
    return checked


def section_after_heading(text: str, heading: str) -> str:
    marker = f"\n### `{heading}`\n"
    start = text.find(marker)
    if start == -1:
        fail(f"cli-command-reference.md: missing command heading {heading}")
    section = text[start + len(marker) :]
    next_heading = len(section)
    for boundary in ["\n### `", "\n## "]:
        index = section.find(boundary)
        if index != -1:
            next_heading = min(next_heading, index)
    return section[:next_heading]


def assert_cli_command_reference(root: Path) -> None:
    path = root / "references" / "cli-command-reference.md"
    text = path.read_text()
    if not text.startswith("# CLI Command Reference\n"):
        fail(f"{path.name}: missing title")

    expected_sections = [
        "Installation",
        "Shared Output Flag",
        "Root And Config Commands",
        "Account Commands",
        "Template Commands",
        "Transaction Artifact Commands",
        "Subintent Commands",
    ]
    headings = re.findall(r"^## (.+)$", text, re.MULTILINE)
    if headings != expected_sections:
        fail(f"{path.name}: expected sections {expected_sections}, found {headings}")

    for snippet in CLI_REQUIRED_SNIPPETS:
        if snippet not in text:
            fail(f"{path.name}: missing {snippet}")

    command_headings = re.findall(r"^### `(.+)`$", text, re.MULTILINE)
    if command_headings != CLI_COMMAND_HEADINGS:
        fail(f"{path.name}: expected command headings {CLI_COMMAND_HEADINGS}, found {command_headings}")

    for heading in CLI_COMMAND_HEADINGS:
        section = section_after_heading(text, heading)
        if "Example:" not in section and "Examples:" not in section:
            fail(f"{path.name}: command lacks examples: {heading}")
        if "```sh\n" not in section:
            fail(f"{path.name}: command lacks shell fence: {heading}")
        if "rdx " not in section:
            fail(f"{path.name}: command example lacks rdx invocation: {heading}")


def assert_cli_source_surface(root: Path, args: argparse.Namespace) -> None:
    source_roots = source_roots_from_args(args, root)
    web3_root = source_roots["./.repos/radix-web3.js"]
    if web3_root is None:
        return

    path = web3_root / "packages" / "cli" / "src" / "cli.ts"
    if not path.exists():
        fail(f"cli source unavailable: {path}")
    text = path.read_text()

    for snippet in CLI_SOURCE_SNIPPETS:
        if snippet not in text:
            fail(f"cli.ts: missing source snippet {snippet}")

    for variable_name, command_name in CLI_SOURCE_COMMANDS:
        pattern = rf"const\s+{re.escape(variable_name)}\s*=\s*Command\.make\(\s*'{re.escape(command_name)}'"
        if not re.search(pattern, text):
            fail(f"cli.ts: missing command definition {variable_name} -> {command_name}")
        if text.count(variable_name) < 2:
            fail(f"cli.ts: command is defined but not wired into subcommands: {variable_name}")


def source_roots_from_args(args: argparse.Namespace, root: Path) -> dict[str, Path | None]:
    web3 = args.radix_web3_root or os.environ.get("RADIX_WEB3_SOURCE_ROOT")
    scrypto = args.scrypto_root or os.environ.get("RADIX_SCRYPTO_SOURCE_ROOT")

    default_web3 = root / ".repos" / "radix-web3.js"
    default_scrypto = root / ".repos" / "radixdlt-scrypto"

    return {
        "./.repos/radix-web3.js": Path(web3) if web3 else (default_web3 if default_web3.exists() else None),
        "./.repos/radixdlt-scrypto": Path(scrypto) if scrypto else (default_scrypto if default_scrypto.exists() else None),
    }


def resolve_source_ref(ref: str, source_roots: dict[str, Path | None]) -> tuple[bool, Path | None]:
    for prefix, source_root in source_roots.items():
        if ref == prefix or ref.startswith(prefix + "/"):
            if source_root is None:
                return True, None
            rel = ref[len(prefix) :].lstrip("/")
            return True, source_root / rel
    return False, None


def join_source_ref(root_ref: str, relative_ref: str) -> str:
    joined = posixpath.normpath(root_ref.rstrip("/") + "/" + relative_ref.lstrip("/"))
    if joined.startswith(".repos/"):
        return "./" + joined
    return joined


def key_path_section(text: str, primary_end: int, path: Path) -> str:
    key_start = text.find("\nKey paths:\n", primary_end)
    if key_start == -1:
        fail(f"{path.name}: Primary source root must be followed by Key paths")
    section = text[key_start + len("\nKey paths:\n") :]
    stop = len(section)
    for marker in ["\nRelated paths:", "\nRelated packages:", "\n## Mental Model\n"]:
        index = section.find(marker)
        if index != -1:
            stop = min(stop, index)
    return section[:stop]


def primary_key_path_refs(path: Path, text: str) -> list[str]:
    refs: list[str] = []
    for match in re.finditer(r"^Primary source root: `(\./\.repos/[^`]+)`$", text, re.MULTILINE):
        primary_ref = match.group(1)
        keys = key_path_section(text, match.end(), path)
        key_refs = re.findall(r"^- `([^`]+)`$", keys, re.MULTILINE)
        if not key_refs:
            fail(f"{path.name}: Key paths must contain backticked bullet paths")
        for key_ref in key_refs:
            if key_ref.startswith("./.repos/") or key_ref.startswith("/"):
                fail(f"{path.name}: Key paths must be relative to the primary source root: {key_ref}")
            refs.append(join_source_ref(primary_ref, key_ref))
    return refs


def assert_source_refs(root: Path, args: argparse.Namespace) -> tuple[int, int]:
    source_roots = source_roots_from_args(args, root)
    if args.require_source_roots:
        for prefix, source_root in source_roots.items():
            if source_root is None or not source_root.exists():
                fail(f"source root required but unavailable for {prefix}")

    checked = 0
    skipped = 0
    for path in sorted(root.rglob("*.md")):
        text = path.read_text()
        for match in re.finditer(r"`(\./\.repos/[^`]+)`", text):
            ref = match.group(1)
            if "*" in ref:
                continue
            matched, actual = resolve_source_ref(ref, source_roots)
            if matched:
                if actual is None:
                    skipped += 1
                else:
                    checked += 1
                    if not actual.exists():
                        fail(f"{path.name}: missing source ref {ref} -> {actual}")

        if path.name.startswith("guide-"):
            if any(source_root is not None for source_root in source_roots.values()):
                examples = text.split("\n## Examples\n", 1)[1]
                examples = examples.split("\n## Reference Routes\n", 1)[0]
                examples = examples.split("\n## Usage Notes\n", 1)[0]
                for title, body in task_example_blocks(examples):
                    start = start_with_section(body, path, title)
                    refs = re.findall(r"^- `([^`]+)`$", start, re.MULTILINE)
                    has_source_file_ref = False
                    for ref in refs:
                        matched, actual = resolve_source_ref(ref, source_roots)
                        if matched and actual is not None:
                            if actual.is_dir():
                                fail(f"{path.name}: example Start with source ref must be a file: {title}: {ref}")
                            if actual.is_file():
                                has_source_file_ref = True
                    if not has_source_file_ref:
                        fail(f"{path.name}: example Start with lacks a source file ref: {title}")

            for ref in primary_key_path_refs(path, text):
                matched, actual = resolve_source_ref(ref, source_roots)
                if not matched:
                    fail(f"{path.name}: unknown source root for key path {ref}")
                if actual is None:
                    skipped += 1
                else:
                    checked += 1
                    if not actual.exists():
                        fail(f"{path.name}: missing key path {ref} -> {actual}")
    return checked, skipped


def assert_stale_patterns(root: Path) -> None:
    regexes = [re.compile(pattern, re.MULTILINE) for pattern in STALE_PATTERNS]
    for path in sorted(list(root.rglob("*.md")) + list(root.rglob("*.sh")) + list(root.rglob("*.yaml"))):
        text = path.read_text()
        for regex in regexes:
            if regex.search(text):
                fail(f"{path}: stale pattern matched {regex.pattern}")


def assert_shell_syntax(root: Path) -> None:
    for path in sorted((root / "scripts").glob("*.sh")):
        result = subprocess.run(["sh", "-n", str(path)], check=False)
        if result.returncode != 0:
            fail(f"{path}: shell syntax check failed")


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate the Radix skill.")
    parser.add_argument(
        "--skill-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Path to the radix skill root.",
    )
    parser.add_argument("--radix-web3-root", type=Path)
    parser.add_argument("--scrypto-root", type=Path)
    parser.add_argument("--require-source-roots", action="store_true")
    args = parser.parse_args()

    root = args.skill_root.resolve()
    if not (root / "SKILL.md").exists():
        fail(f"{root}: not a skill root")

    assert_skill_tree(root)
    markdown_count = assert_ascii_markdown(root)
    assert_skill_frontmatter(root)
    assert_openai_yaml(root)
    assert_scripts(root)
    guide_count, example_count = assert_guides(root)
    assert_source_root_identity(root, args)
    assert_web3_package_guide_coverage(root, args)
    assert_cli_command_reference(root)
    assert_cli_source_surface(root, args)
    reference_count = assert_reference_links(root)
    source_checked, source_skipped = assert_source_refs(root, args)
    assert_stale_patterns(root)
    assert_shell_syntax(root)

    print("radix skill validation passed")
    print(f"markdown files: {markdown_count}")
    print(f"guides: {guide_count}")
    print(f"task examples: {example_count}")
    print(f"reference links checked: {reference_count}")
    print(f"source refs checked: {source_checked}")
    if source_skipped:
        print(f"source refs skipped: {source_skipped}")


if __name__ == "__main__":
    main()
