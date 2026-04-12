---
name: release
description: Use when cutting an Ultra RSS Reader release from `main`, choosing a semver bump, syncing versions across `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`, generating `CHANGELOG.md` and GitHub Release notes from commit history, tagging `v*`, and pushing the release safely.
---

# Release

## Overview

Cut releases in three gated phases. Complete every step inside a phase, stop on the first failure, and ask for confirmation between phases so the workflow cannot silently skip versioning, notes, or tag publication.

## Preconditions

- Work only from `main`.
- Require a clean working tree.
- Require local `HEAD` to match `origin/main`.
- Run `mise run check` before editing release files.
- Read the current version from `package.json`.
- If the bump type is not provided, ask the user to choose `patch`, `minor`, or `major`.
- When asking for a fixed choice or confirmation in the Codex app, prefer the app's button or wizard UI. Fall back to a short numbered list only if needed.

## Phase 1: Pre-Checks And Version Choice

Run all checks before editing anything:

```bash
git branch --show-current
git fetch origin main
git rev-parse HEAD
git rev-parse origin/main
git status --porcelain
mise run check
```

- Abort if the current branch is not `main`.
- Abort if `HEAD` does not exactly match `origin/main`.
- Abort if `git status --porcelain` is not empty.
- Abort if `mise run check` fails.
- Capture `current_version` from `package.json`.
- Ask the user for the bump type only after every pre-check succeeds.

## Phase 2: Generate Release Changes

Calculate `new_version` from the approved semver bump, then perform the whole phase before asking for confirmation.

### Update Versioned Files

Update these files to `new_version`:

- `package.json`
- `src-tauri/Cargo.toml` in the `[package]` section
- `src-tauri/tauri.conf.json`

Refresh Cargo metadata after the bump:

```bash
cd src-tauri && cargo check
```

### Build Release Notes From Commits

- Find the previous release tag with `git describe --tags --abbrev=0 --match "v*"`.
- If no `v*` tag exists, treat the release as the first release and inspect all non-merge commits.
- Otherwise inspect non-merge commits in `{previous_tag}..HEAD`.
- Generate notes before creating the release commit so the version bump commit is intentionally excluded.
- Exclude commits whose subject starts with `release:` or `merge:`.
- Preserve PR numbers such as `(#123)` when present.
- Abort if zero commits remain after filtering.

Classify commits in this order:

| Match | GitHub Release Heading | CHANGELOG Heading |
| --- | --- | --- |
| `*!:` or breaking-change marker | `💥 Breaking Changes` | `Breaking Changes` |
| `feat:` | `🚀 Features` | `Features` |
| `fix:` | `🐛 Bug Fixes` | `Bug Fixes` |
| `docs:` | `📚 Documentation` | `Documentation` |
| `chore:` `refactor:` `test:` `ci:` | `🔧 Maintenance` | `Maintenance` |
| anything else | `🔧 Maintenance` | `Maintenance` |

- Omit empty categories.
- Keep GitHub Release headings emoji-prefixed.
- Keep `CHANGELOG.md` headings plain text without emoji.

### Update CHANGELOG And TODO

Update `CHANGELOG.md` so it looks like this:

```markdown
## [Unreleased]

## [x.y.z] - YYYY-MM-DD

### Features
```

- Insert the new version section immediately after `## [Unreleased]`.
- Clear any existing items that were under `[Unreleased]` because they now belong to the new version.
- If `## [Unreleased]` does not exist, insert both `## [Unreleased]` and the new version section near the top of the file after the header.
- Mark matching release tasks in `TODO.md` as `[x]` only when the mapping is clear from the release contents. Otherwise leave the file unchanged.

### User Confirmation 2

Show the generated release notes and ask the user to confirm or request edits before moving on.

## Phase 3: Commit, Tag, And Publish

Only start this phase after the user approves the notes.

### Create Commit And Tag

Stage the release changes and create:

```text
release: v{new_version}
```

Then create an annotated tag:

```bash
git tag -a v{new_version} -m "v{new_version}"
```

Before any push, show:

- `current_version -> new_version`
- the categorized release notes
- the release commit hash
- the tag name

Ask explicitly whether pushing is okay.

### Push Safely

On approval, prefer:

```bash
git push --atomic origin main v{new_version}
```

If `--atomic` is unsupported, fall back to:

```bash
git push origin main --follow-tags
```

Then verify that the exact remote tag exists in `git ls-remote --tags origin`. If `refs/tags/v{new_version}` is missing, push the tag explicitly with `git push origin v{new_version}`.

### Update GitHub Release Notes

- Try `gh release edit v{new_version} --notes "..."` first.
- If the Release does not exist yet because the workflow is still running, create it with `gh release create v{new_version} --draft --notes "..."`.
- Treat the CLI as the source of truth for release note body text. The GitHub workflow only builds artifacts and attaches them.

### Final Report

Report:

- the pushed commit hash
- the pushed tag
- the latest `release.yml` workflow URL from `gh run list --workflow=release.yml --limit=1`
- the GitHub Release URL
- a reminder to review the draft Release and publish it manually when the artifacts look correct

## Guardrails

- Do not skip a failed pre-check.
- Do not generate release notes after the release commit has been created.
- Do not use lightweight tags.
- Do not push branch and tag separately unless the atomic push path is unavailable and the fallback is required.
- If the repo workflow changes, reconcile this skill with `.claude/commands/release.md` and `.claude/rules/release-workflow.md`.
