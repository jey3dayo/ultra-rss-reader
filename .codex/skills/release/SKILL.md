---
name: release
description: Use when cutting an Ultra RSS Reader release from `main`, choosing a semver bump, syncing versions across `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`, generating `CHANGELOG.md` and GitHub Release notes from commit history, tagging `v*`, pushing safely, and verifying the draft GitHub Release workflow.
---

# Release

## Operating Model

Cut releases as a parent-controlled workflow. The parent agent owns state, approval, file edits, commit/tag/push, and GitHub Release mutation. Use subagents only for read-only inventory, drafting, review, or post-push observation.

Keep a compact release state after each phase so the workflow can recover from context compaction:

```text
release_state: current=<x.y.z> new=<x.y.z> bump=<patch|minor|major> previous_tag=<v*> release_commit=<sha|pending> tag=<vX.Y.Z|pending> publication_intent=<yes|no>
```

If a required check fails, stop immediately. Do not carry approval across failed checks, dirty working trees, branch mismatch, version mismatch, unexpected generated files, user correction requests, or external publication uncertainty.

## Reference Loading

Load only the reference needed for the current phase:

- `references/phase-1-prechecks.md`: branch, sync, clean tree, preflight check, and bump selection.
- `references/phase-2-generate.md`: version file updates, Cargo metadata refresh, commit-derived Japanese notes, CHANGELOG/TODO update.
- `references/phase-3-publish.md`: release commit, annotated tag, push, remote tag verification, workflow/Release verification.
- `references/subagents.md`: safe delegation prompts and ownership boundaries.

Use `scripts/release_checks.py` for deterministic helper checks when useful. During an actual release, do not patch helper scripts; if a helper is wrong or missing behavior, stop the release and fix the helper in a separate non-release change.

## Parent Responsibilities

- Own approval carry-forward and every stop/continue decision.
- Own `current_version`, `new_version`, `previous_tag`, release commit hash, tag name, and publication intent.
- Run and interpret all release gates.
- Edit release files, create the release commit, create the annotated tag, push, and mutate GitHub Releases.
- Verify any subagent draft against local evidence before using it.
- Report phase checkpoints and final remote state.

## Safe Subagent Work

Subagents may:

- inspect commit history and propose categorized Japanese release notes;
- review CHANGELOG/TODO mapping;
- inspect release workflow/rule consistency;
- observe post-push workflow and draft Release state;
- investigate failures and return options.

Subagents must not:

- edit files;
- run version bump commands;
- create commits or tags;
- push;
- run `gh release create` or `gh release edit`;
- decide that a failed gate can be skipped.

When using subagents, give each one a read-only task and require evidence: command shape, commit range, files inspected, and any uncertainty.

## Approval Model

Minimize repeat confirmations by carrying forward explicit user intent.

- Treat a user request that includes a valid bump and publication intent (`push`, `publish`, `tag`, `release`, `最後まで`, `リリースして`) as approval to run all phases after required checks pass.
- Treat a later reply such as `OK`, `push`, `進めて`, or `そのまま` as approval for the next blocked step and every remaining step that matches the reply's intent.
- Ask for the bump type only when it is absent or invalid.
- Ask for release-note edits only when the user has not already approved publication, or when the generated notes are ambiguous enough that publishing them would be risky.
- Ask for push approval only when publication intent has not already been given.
- Even when approval carries forward, show the Phase 2 checkpoint with `current_version -> new_version`, changed files, release notes, and `release_state`, then continue without waiting.

## Phase 1: Pre-Checks And Version Choice

Read `references/phase-1-prechecks.md`, then complete every check before editing anything.

Required gates:

- current branch is `main`;
- working tree is clean;
- local `HEAD` exactly matches `origin/main`;
- `mise run check` succeeds;
- `current_version` is read from `package.json`;
- bump type is approved after the gates pass.

If the user explicitly asked to push first, synchronize clean local `main` only as described in the phase reference, then re-check `HEAD == origin/main` before continuing.

Checkpoint:

```text
release_state: current=<current_version> new=<pending> bump=<approved_bump> previous_tag=<pending> release_commit=pending tag=pending publication_intent=<yes|no>
```

## Phase 2: Generate Release Changes

Read `references/phase-2-generate.md`, then complete the whole phase before asking for confirmation.

Required outputs:

- `new_version` calculated from the approved bump;
- `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` updated to `new_version`;
- Cargo metadata refreshed with `cd src-tauri && cargo check`;
- `src-tauri/Cargo.lock` included only if Cargo updates it;
- previous `v*` tag and non-merge release commit range identified before the release commit exists;
- Japanese GitHub Release notes and `CHANGELOG.md` entry generated from the filtered commit history;
- `TODO.md` changed only when matching release tasks are clear.

Show the generated release notes and changed files. If publication intent already covers release publication and the notes are grounded in inspected commits, continue to Phase 3 without waiting.

Checkpoint:

```text
release_state: current=<current_version> new=<new_version> bump=<approved_bump> previous_tag=<previous_tag|none> release_commit=pending tag=v<new_version> publication_intent=<yes|no>
```

## Phase 3: Commit, Tag, And Publish

Read `references/phase-3-publish.md`, then execute the publish sequence from the parent agent.

Required sequence:

1. Stage only release changes.
2. Commit as `release: v{new_version}`.
3. Capture the release commit hash from `HEAD`.
4. Create annotated tag `v{new_version}` on that exact commit.
5. Verify the local tag points to the release commit and the tagged version files contain `new_version`.
6. Run `RELEASE_TAG=v{new_version} mise run release:preflight:local` before pushing.
7. Show `current_version -> new_version`, categorized release notes, release commit hash, tag name, and `release_state`.
8. Push with `git push --atomic origin main v{new_version}` unless unsupported; use the documented fallback only when required.
9. Verify the remote annotated tag and peeled commit.
10. Create or update the draft GitHub Release notes through `gh`.
11. Verify the `release.yml` workflow run that matches `v{new_version}` and the release commit, then verify structured GitHub Release fields.

Ask explicitly whether pushing is okay only when publication intent has not already been approved.

Final report must include:

- pushed commit hash;
- pushed tag;
- remote annotated tag verification, including peeled `refs/tags/v{new_version}^{}` when available;
- matching `release.yml` workflow URL and evidence that its tag/ref and head SHA match the release;
- GitHub Release URL, `tagName`, and draft status;
- whether any `untagged-...` Release URL is acceptable based on structured fields;
- reminder to review the draft Release and publish it manually after artifacts look correct.

## Guardrails

- Do not skip a failed pre-check.
- Do not generate release notes after the release commit has been created.
- Do not use lightweight tags.
- Do not let subagents mutate release state.
- Do not push branch and tag separately unless the atomic push path is unavailable and the fallback is required.
- If the repo workflow changes, reconcile this skill with `.claude/commands/release.md` and `.claude/rules/release-workflow.md`.
