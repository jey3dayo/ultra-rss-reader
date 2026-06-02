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
    return json.loads(path.read_text(encoding="utf-8"))


def parse_version(version: str) -> tuple[int, int, int]:
    match = VERSION_RE.match(version)
    if not match:
        raise ValueError(f"unsupported semver version: {version}")
    return tuple(int(part) for part in match.groups())


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
    print(f"{major}.{minor}.{patch}")
    return 0


def command_verify_version(args: argparse.Namespace) -> int:
    expected = args.version
    failures: list[str] = []

    package_json = load_json(ROOT / "package.json")
    if not isinstance(package_json, dict) or package_json.get("version") != expected:
        actual = package_json.get("version") if isinstance(package_json, dict) else None
        failures.append(f"package.json version is {actual!r}")

    cargo_toml = (ROOT / "src-tauri" / "Cargo.toml").read_text(encoding="utf-8")
    cargo_version = cargo_package_version(cargo_toml)
    if cargo_version != expected:
        failures.append(f"src-tauri/Cargo.toml package version is {cargo_version!r}")

    tauri_conf = load_json(ROOT / "src-tauri" / "tauri.conf.json")
    if not isinstance(tauri_conf, dict) or tauri_conf.get("version") != expected:
        actual = tauri_conf.get("version") if isinstance(tauri_conf, dict) else None
        failures.append(f"src-tauri/tauri.conf.json version is {actual!r}")

    if failures:
        for failure in failures:
            print(failure, file=sys.stderr)
        return 1

    print(f"version files match {expected}")
    return 0


def cargo_package_version(cargo_toml: str) -> str | None:
    in_package = False
    for line in cargo_toml.splitlines():
        stripped = line.strip()
        if stripped == "[package]":
            in_package = True
            continue
        if in_package and stripped.startswith("["):
            return None
        if in_package:
            match = re.match(r'^version\s*=\s*"([^"]+)"\s*$', stripped)
            if match:
                return match.group(1)
    return None


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
    tag_type = run_git(["cat-file", "-t", args.tag])
    if tag_type != "tag":
        print(f"{args.tag} is {tag_type}, expected annotated tag object", file=sys.stderr)
        return 1

    tag_commit = run_git(["rev-list", "-n", "1", args.tag])
    if tag_commit != args.commit:
        print(f"{args.tag} points to {tag_commit}, expected {args.commit}", file=sys.stderr)
        return 1

    checks = {
        "package.json": f'"version": "{args.version}"',
        "src-tauri/Cargo.toml": f'version = "{args.version}"',
        "src-tauri/tauri.conf.json": f'"version": "{args.version}"',
    }
    for path, expected in checks.items():
        content = run_git(["show", f"{args.tag}:{path}"])
        if expected not in content:
            print(f"{args.tag}:{path} does not contain {expected}", file=sys.stderr)
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
