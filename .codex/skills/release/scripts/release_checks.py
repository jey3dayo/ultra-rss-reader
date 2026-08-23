#!/usr/bin/env python3
"""Deterministic helpers for the Ultra RSS Reader release skill."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
VERSION_RE = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
MSIX_VERSION_COMPONENT_MAX = 65_535


def run_git(args: list[str]) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout.strip()


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicate_json_keys)


def reject_duplicate_json_keys(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def parse_version(version: str) -> tuple[int, int, int]:
    match = VERSION_RE.match(version)
    if not match:
        raise ValueError(f"unsupported semver version: {version}")
    components = tuple(int(part) for part in match.groups())
    if any(component > MSIX_VERSION_COMPONENT_MAX for component in components):
        raise ValueError(
            f"version components must not exceed {MSIX_VERSION_COMPONENT_MAX} for MSIX: {version}"
        )
    return components


def command_bump(args: argparse.Namespace) -> int:
    major, minor, patch = parse_version(args.version)
    if args.bump == "patch":
        patch += 1
    elif args.bump == "minor":
        minor += 1
        patch = 0
    elif args.bump == "major":
        major += 1
        minor = 0
        patch = 0
    next_version = f"{major}.{minor}.{patch}"
    parse_version(next_version)
    print(next_version)
    return 0


def command_verify_version(args: argparse.Namespace) -> int:
    expected = args.version
    parse_version(expected)
    failures: list[str] = []

    package_json_source = (ROOT / "package.json").read_text(encoding="utf-8")
    package_json = load_json(ROOT / "package.json")
    package_versions = json_version_owners(package_json_source)
    if len(package_versions) != 1:
        failures.append(f"package.json must contain exactly one version owner, found {len(package_versions)}")
    if not isinstance(package_json, dict) or package_json.get("version") != expected:
        actual = package_json.get("version") if isinstance(package_json, dict) else None
        failures.append(f"package.json version is {actual!r}")

    cargo_toml = (ROOT / "src-tauri" / "Cargo.toml").read_text(encoding="utf-8")
    cargo_sections = cargo_package_sections(cargo_toml)
    cargo_versions = cargo_package_versions(cargo_toml)
    if len(cargo_sections) != 1 or len(cargo_versions) != 1:
        failures.append(
            "src-tauri/Cargo.toml must contain exactly one [package] section and version owner, "
            f"found {len(cargo_sections)} sections and {len(cargo_versions)} versions"
        )
    elif cargo_versions[0] != expected:
        failures.append(f"src-tauri/Cargo.toml package version is {cargo_versions[0]!r}")

    cargo_lock = (ROOT / "src-tauri" / "Cargo.lock").read_text(encoding="utf-8")
    cargo_lock_versions = cargo_lock_package_versions(cargo_lock)
    if len(cargo_lock_versions) != 1:
        failures.append(
            "src-tauri/Cargo.lock must contain exactly one ultra-rss-reader package entry, "
            f"found {len(cargo_lock_versions)}"
        )
    elif cargo_lock_versions[0] != expected:
        failures.append(f"src-tauri/Cargo.lock ultra-rss-reader version is {cargo_lock_versions[0]!r}")

    tauri_conf_source = (ROOT / "src-tauri" / "tauri.conf.json").read_text(encoding="utf-8")
    tauri_conf = load_json(ROOT / "src-tauri" / "tauri.conf.json")
    tauri_versions = json_version_owners(tauri_conf_source)
    if len(tauri_versions) != 1:
        failures.append(
            "src-tauri/tauri.conf.json must contain exactly one version owner, "
            f"found {len(tauri_versions)}"
        )
    if not isinstance(tauri_conf, dict) or tauri_conf.get("version") != expected:
        actual = tauri_conf.get("version") if isinstance(tauri_conf, dict) else None
        failures.append(f"src-tauri/tauri.conf.json version is {actual!r}")

    msix_manifest = (ROOT / "msix" / "Package.appxmanifest").read_text(encoding="utf-8")
    msix_version = msix_identity_version(msix_manifest)
    if msix_version != f"{expected}.0":
        failures.append(f"msix/Package.appxmanifest Identity version is {msix_version!r}")

    if failures:
        for failure in failures:
            print(failure, file=sys.stderr)
        return 1

    print(f"version files match {expected}")
    return 0


def json_version_owners(source: str) -> list[str]:
    parsed = json.loads(source, object_pairs_hook=reject_duplicate_json_keys)
    if isinstance(parsed, dict) and isinstance(parsed.get("version"), str):
        return [parsed["version"]]
    return []


def cargo_package_sections(cargo_toml: str) -> list[str]:
    section_matches = list(re.finditer(r"^\[package\]\s*$", cargo_toml, re.MULTILINE))
    sections: list[str] = []
    for match in section_matches:
        section_start = match.end()
        next_section = re.search(r"^\[", cargo_toml[section_start:], re.MULTILINE)
        section_end = section_start + next_section.start() if next_section else len(cargo_toml)
        sections.append(cargo_toml[section_start:section_end])
    return sections


def cargo_package_versions(cargo_toml: str) -> list[str]:
    versions: list[str] = []
    for section in cargo_package_sections(cargo_toml):
        for line in section.splitlines():
            stripped = line.strip()
            match = re.fullmatch(r'version\s*=\s*"([^"]+)"', stripped)
            if match:
                versions.append(match.group(1))
    return versions


def cargo_lock_package_versions(cargo_lock: str) -> list[str]:
    package_sections = re.split(r"(?m)^\[\[package\]\]\s*$", cargo_lock)[1:]
    owners: list[str] = []
    for package_section in package_sections:
        names = re.findall(r'^name\s*=\s*"([^"]+)"\s*$', package_section, re.MULTILINE)
        if "ultra-rss-reader" not in names:
            continue
        versions = re.findall(r'^version\s*=\s*"([^"]+)"\s*$', package_section, re.MULTILINE)
        owners.append(versions[0] if len(names) == 1 and len(versions) == 1 else "")
    return owners


def msix_identity_version(manifest: str) -> str | None:
    identities = re.findall(r"<Identity\b[^>]*\/>", manifest)
    if len(identities) != 1:
        return None
    versions = re.findall(r'\bVersion="([^"]+)"', identities[0])
    return versions[0] if len(versions) == 1 else None


def classify_subject(subject: str) -> str:
    lower = subject.lower()
    if re.match(r"^[a-z]+(?:\([^)]+\))?!:", lower) or "breaking change" in lower:
        return "breaking"
    if lower.startswith("feat:") or lower.startswith("feat("):
        return "features"
    if lower.startswith("fix:") or lower.startswith("fix("):
        return "bug_fixes"
    if lower.startswith("docs:") or lower.startswith("docs("):
        return "documentation"
    if re.match(r"^(chore|refactor|test|ci)(:|\()", lower):
        return "maintenance"
    return "maintenance"


def command_classify_commits(args: argparse.Namespace) -> int:
    output = run_git(["log", "--no-merges", "--pretty=format:%H%x09%s", args.revision_range])
    commits: dict[str, list[dict[str, str]]] = {
        "breaking": [],
        "features": [],
        "bug_fixes": [],
        "documentation": [],
        "maintenance": [],
    }

    for line in output.splitlines():
        if not line:
            continue
        commit_hash, subject = line.split("\t", 1)
        subject_lower = subject.lower()
        if subject_lower.startswith("release:") or subject_lower.startswith("merge:"):
            continue
        commits[classify_subject(subject)].append({"hash": commit_hash, "subject": subject})

    if not any(commits.values()):
        print("no releasable commits after filtering", file=sys.stderr)
        return 1

    print(json.dumps({key: value for key, value in commits.items() if value}, ensure_ascii=False, indent=2))
    return 0


def command_verify_tag(args: argparse.Namespace) -> int:
    parse_version(args.version)
    tag_type = run_git(["cat-file", "-t", args.tag])
    if tag_type != "tag":
        print(f"{args.tag} is {tag_type}, expected annotated tag object", file=sys.stderr)
        return 1

    tag_commit = run_git(["rev-list", "-n", "1", args.tag])
    if tag_commit != args.commit:
        print(f"{args.tag} points to {tag_commit}, expected {args.commit}", file=sys.stderr)
        return 1

    package_content = run_git(["show", f"{args.tag}:package.json"])
    if json_version_owners(package_content) != [args.version]:
        print(f"{args.tag}:package.json version owners are invalid", file=sys.stderr)
        return 1

    cargo_content = run_git(["show", f"{args.tag}:src-tauri/Cargo.toml"])
    if len(cargo_package_sections(cargo_content)) != 1 or cargo_package_versions(cargo_content) != [args.version]:
        print(f"{args.tag}:src-tauri/Cargo.toml package version owners are invalid", file=sys.stderr)
        return 1

    tauri_content = run_git(["show", f"{args.tag}:src-tauri/tauri.conf.json"])
    if json_version_owners(tauri_content) != [args.version]:
        print(f"{args.tag}:src-tauri/tauri.conf.json version owners are invalid", file=sys.stderr)
        return 1

    cargo_lock_versions = cargo_lock_package_versions(run_git(["show", f"{args.tag}:src-tauri/Cargo.lock"]))
    if cargo_lock_versions != [args.version]:
        print(
            f"{args.tag}:src-tauri/Cargo.lock ultra-rss-reader versions are {cargo_lock_versions!r}, "
            f"expected [{args.version!r}]",
            file=sys.stderr,
        )
        return 1

    msix_version = msix_identity_version(run_git(["show", f"{args.tag}:msix/Package.appxmanifest"]))
    if msix_version != f"{args.version}.0":
        print(
            f"{args.tag}:msix/Package.appxmanifest Identity version is {msix_version!r}, "
            f"expected {args.version}.0",
            file=sys.stderr,
        )
        return 1

    print(f"{args.tag} matches {args.commit} and version {args.version}")
    return 0


def command_verify_remote_tag(args: argparse.Namespace) -> int:
    output = run_git(["ls-remote", "--tags", "origin", args.tag, f"{args.tag}^{{}}"])
    refs: dict[str, str] = {}
    for line in output.splitlines():
        if not line:
            continue
        commit_hash, ref = line.split("\t", 1)
        refs[ref] = commit_hash

    tag_ref = f"refs/tags/{args.tag}"
    peeled_ref = f"refs/tags/{args.tag}^{{}}"
    if tag_ref not in refs:
        print(f"missing remote tag ref {tag_ref}", file=sys.stderr)
        return 1
    if peeled_ref not in refs:
        print(f"missing remote peeled ref {peeled_ref}", file=sys.stderr)
        return 1
    if refs[tag_ref] == refs[peeled_ref]:
        print(f"{tag_ref} is not an annotated tag object", file=sys.stderr)
        return 1
    if refs[peeled_ref] != args.commit:
        print(f"{peeled_ref} is {refs[peeled_ref]}, expected {args.commit}", file=sys.stderr)
        return 1

    print(json.dumps({"tag_ref": refs[tag_ref], "peeled_ref": refs[peeled_ref]}, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    bump = subparsers.add_parser("bump", help="calculate the next semver version")
    bump.add_argument("version")
    bump.add_argument("bump", choices=("patch", "minor", "major"))
    bump.set_defaults(func=command_bump)

    verify_version = subparsers.add_parser("verify-version", help="verify version files")
    verify_version.add_argument("version")
    verify_version.set_defaults(func=command_verify_version)

    classify = subparsers.add_parser("classify-commits", help="classify release commits")
    classify.add_argument("revision_range")
    classify.set_defaults(func=command_classify_commits)

    verify_tag = subparsers.add_parser("verify-tag", help="verify a local annotated tag target and version files")
    verify_tag.add_argument("tag")
    verify_tag.add_argument("commit")
    verify_tag.add_argument("version")
    verify_tag.set_defaults(func=command_verify_tag)

    remote_tag = subparsers.add_parser("verify-remote-tag", help="verify remote annotated tag refs")
    remote_tag.add_argument("tag")
    remote_tag.add_argument("commit")
    remote_tag.set_defaults(func=command_verify_remote_tag)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return args.func(args)
    except (subprocess.CalledProcessError, OSError, ValueError, json.JSONDecodeError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
