---
name: release
description: Use when cutting an Ultra RSS Reader release from `main`, choosing a semver bump, syncing versions across `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`, generating `CHANGELOG.md` and GitHub Release notes from commit history, tagging `v*`, and pushing the release safely.
---

# Release

## Overview

Cut releases in three phases with explicit approval carry-forward. Complete every step inside a phase, stop on the first failure, and ask only for missing decisions so the workflow cannot silently skip versioning, notes, or tag publication.

## Preconditions

- Work only from `main`.
- Require a clean working tree.
- Require local `HEAD` to match `origin/main`.
- If the user explicitly says to push first, treat that as synchronizing the current clean `main`: push only if local `main` is ahead, then fetch and re-check that `HEAD` exactly matches `origin/main` before editing release files.
- Run `mise run check` before editing release files.
- Read the current version from `package.json`.
- If the user already provided a valid bump type (`patch`, `minor`, or `major`), treat it as approved after pre-checks pass. Ask for a bump only when it is absent or invalid.
- Write release notes and `CHANGELOG.md` entries in concise Japanese by default, grounded in the actual commit history, unless the user explicitly asks for another language.
- When asking for a fixed choice or confirmation in the Codex app, prefer the app's button or wizard UI if available. If that UI is unavailable, ask a concise plain-text confirmation such as `OK`.

## Approval Model

Minimize repeat confirmations by carrying forward explicit user intent.

- Treat a user request that includes a valid bump and publication intent (`push`, `publish`, `tag`, `release`, `最後まで`, `リリースして`) as approval to run Phases 1-3 after required checks pass.
- Treat a later reply such as `OK`, `push`, `進めて`, or `そのまま` as approval for the next blocked step and every remaining step that matches the reply's intent.
- Ask for the bump type only when it is absent or invalid.
- Ask for release-note edits only when the user has not already approved publication, or when the generated notes are ambiguous enough that publishing them would be risky.
- Ask for push approval only when publication intent has not already been given.
- Even when approval carries forward, show a concise progress report after Phase 2 with `current_version -> new_version`, changed files, and generated release notes, then continue without waiting.
- Never carry approval across a failed check, dirty working tree, branch mismatch, version mismatch, unexpected generated file, or user correction request. Stop and report the blocker instead.

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

If the user explicitly asked to push first, run this synchronization check before the `HEAD == origin/main` gate:

```bash
git branch --show-current
git status --porcelain
git fetch origin main
git rev-list --left-right --count HEAD...origin/main
```

- Continue immediately when the ahead/behind count is `0 0`.
- If the count is `<ahead> 0`, push current `main` with `git push origin main`, then fetch and re-check until the count is `0 0`.
- If the count is `0 <behind>` or both sides are non-zero, stop before editing release files and report that `main` is not synchronized safely.

- Abort if the current branch is not `main`.
- Abort if `HEAD` does not exactly match `origin/main`.
- Abort if `git status --porcelain` is not empty.
- Abort if `mise run check` fails.
- Capture `current_version` from `package.json`.
- Use the already supplied valid bump type only after every pre-check succeeds. Ask the user for the bump type only when it was not supplied or was invalid.

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

- Include `src-tauri/Cargo.lock` in the release changes if `cargo check` updates the package version there.

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
- Keep the body text Japanese by default. Summarize user-visible impact rather than mechanically translating commit subjects; do not invent changes that are not present in the commits.

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

### Release Notes Review

Show the generated release notes. If publication intent has already been approved and the notes are grounded in the inspected commits, continue to Phase 3 without waiting. Otherwise ask the user to confirm or request edits before moving on.

## Phase 3: Commit, Tag, And Publish

Start this phase after the user approves the notes, or immediately when the approval model already covers publication.

### Create Commit And Tag

Stage the release changes and create:

```text
release: v{new_version}
```

Capture the release commit hash from `HEAD`, then create an annotated tag from that exact commit:

```bash
git rev-parse HEAD
git tag -a v{new_version} -m "v{new_version}"
```

Before any push, verify all of these:

- `git rev-list -n 1 v{new_version}` exactly matches the release commit hash from `git rev-parse HEAD`
- `git show v{new_version}:package.json` contains `"version": "{new_version}"`
- `git show v{new_version}:src-tauri/Cargo.toml` contains `version = "{new_version}"`
- `git show v{new_version}:src-tauri/tauri.conf.json` contains `"version": "{new_version}"`

Abort if the tag points at any earlier commit or if any tagged file still shows the previous version.

Before any push, show:

- `current_version -> new_version`
- the categorized release notes
- the release commit hash
- the tag name

Ask explicitly whether pushing is okay only when publication intent has not already been approved. If approval already carries forward, report the same details and continue to the push.

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

- For annotated tags, `refs/tags/v{new_version}` is the tag object and `refs/tags/v{new_version}^{}` is the peeled release commit. Verify both refs exist when possible, and compare the peeled `^{}` ref to the release commit hash.
- Use a command shaped like `git ls-remote --tags origin "v{new_version}" "v{new_version}^{}"` so the tag object and peeled commit are visible in one check.
- The release workflow concurrency group is keyed by the release tag for both tag push and manual dispatch, with `cancel-in-progress: false`. Do not manually dispatch the same tag while a tag-push run is still active unless you intentionally want it queued behind the active run.
- The release workflow preflight requires the release tag target to match the checkout commit and be reachable from `origin/main`.
- The release workflow keeps Releases as drafts. Stable tags use `prerelease=false`; semver prerelease tags such as `v1.2.3-alpha.1` use `prerelease=true`; build metadata alone such as `v1.2.3+build.1` does not make the Release a prerelease.
- If rerunning the same tag after a cancellation or failed artifact upload, first inspect the draft Release assets and delete any partial assets for that tag before rerunning. The workflow preflight will stop before artifact creation if the checkout commit, tag target commit, main ancestry, or version files do not match.

### Update GitHub Release Notes

- Try `gh release edit v{new_version} --notes "..."` first.
- If the Release does not exist yet because the workflow is still running, create it with `gh release create v{new_version} --draft --notes "..."`.
- Treat the CLI as the source of truth for release note body text. The GitHub workflow only builds artifacts and attaches them.
- After create/edit, verify with `gh release view v{new_version} --json tagName,isDraft,url,body`. Confirm `tagName` is `v{new_version}`, the body matches the intended notes, and the draft state is expected.
- A draft Release URL containing `untagged-...` is not automatically a failure. Classify it by the structured `gh release view` fields; if `tagName` is `v{new_version}` and `isDraft` is expected, report the URL normally.

### Final Report

Report:

- the pushed commit hash
- the pushed tag
- the remote annotated tag verification, including the peeled `refs/tags/v{new_version}^{}` commit when available
- the latest `release.yml` workflow URL from `gh run list --workflow=release.yml --limit=1`
- the GitHub Release URL, `tagName`, and draft status from `gh release view`
- if the Release URL contains `untagged-...`, explicitly state whether it is acceptable based on `tagName == v{new_version}` and the expected draft status; do not classify it by URL text alone
- a reminder to review the draft Release and publish it manually when the artifacts look correct

## Guardrails

- Do not skip a failed pre-check.
- Do not generate release notes after the release commit has been created.
- Do not use lightweight tags.
- Do not push branch and tag separately unless the atomic push path is unavailable and the fallback is required.
- If the repo workflow changes, reconcile this skill with `.claude/commands/release.md` and `.claude/rules/release-workflow.md`.
