# Phase 3: Commit, Tag, And Publish

Start only after Phase 2 is complete and the notes are approved or publication intent already carries forward.

## Create Commit And Tag

Stage only release changes and create:

```text
release: v{new_version}
```

Capture the release commit hash from `HEAD`, then create an annotated tag from that exact commit:

```bash
git rev-parse HEAD
git tag -a v{new_version} -m "v{new_version}"
```

Before any push, verify all of these:

```bash
python3 .codex/skills/release/scripts/release_checks.py verify-tag v{new_version} {release_commit_hash} {new_version}
RELEASE_TAG=v{new_version} mise run release:preflight:local
```

The verification requires:

- `git rev-list -n 1 v{new_version}` exactly matches the release commit hash from `git rev-parse HEAD`;
- `git show v{new_version}:package.json` contains `"version": "{new_version}"`;
- `git show v{new_version}:src-tauri/Cargo.toml` contains `version = "{new_version}"`;
- `git show v{new_version}:src-tauri/tauri.conf.json` contains `"version": "{new_version}"`.
- the local release preflight mirror succeeds before the tag is pushed, including version parity, release build contamination, format, TypeScript, and CI unit tests.

Abort if the tag points at any earlier commit, any tagged file still shows the previous version, or the local release preflight mirror fails.

Before any push, show:

- `current_version -> new_version`;
- categorized release notes;
- release commit hash;
- tag name;
- compact `release_state`.

Ask explicitly whether pushing is okay only when publication intent has not already been approved.

## Push Safely

On approval, prefer:

```bash
git push --atomic origin main v{new_version}
```

If `--atomic` is unsupported, fall back to:

```bash
git push origin main --follow-tags
```

Then verify that the exact remote tag exists:

```bash
python3 .codex/skills/release/scripts/release_checks.py verify-remote-tag v{new_version} {release_commit_hash}
```

If `refs/tags/v{new_version}` is missing after the fallback, push the tag explicitly with `git push origin v{new_version}` and verify again.

For annotated tags, `refs/tags/v{new_version}` is the tag object and `refs/tags/v{new_version}^{}` is the peeled release commit. Verify both refs exist when possible, and compare the peeled `^{}` ref to the release commit hash.

## Workflow Constraints

- Verify the workflow run by matching the release tag/ref and release commit. Do not report an unrelated latest run as the release run.
- Use structured output such as `gh run list --workflow=release.yml --limit=20 --json databaseId,url,status,conclusion,headSha,headBranch,event,displayTitle,createdAt` and select a run whose `headSha` is the release commit and whose tag/ref/title corresponds to `v{new_version}`.
- The release workflow concurrency group is keyed by the release tag for both tag push and manual dispatch, with `cancel-in-progress: false`.
- Do not manually dispatch the same tag while a tag-push run is still active unless you intentionally want it queued behind the active run.
- The release workflow preflight requires the release tag to exist on `origin`, be an annotated tag object, have tag metadata distinct from the peeled commit, match the checkout commit, and be reachable from `origin/main`.
- The release workflow signing preflight stops before `mise run ci`, Tauri artifact creation, updater sidecar upload, or draft Release asset publication when `TAURI_SIGNING_PRIVATE_KEY` or `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is missing.
- Use manual dispatch with `dry_run=true` only to validate release preflight without publishing artifacts.
- The release workflow keeps Releases as drafts.
- Stable tags use `prerelease=false`.
- semver prerelease tags such as `v1.2.3-alpha.1` use `prerelease=true`.
- build metadata alone such as `v1.2.3+build.1` does not make the Release a prerelease.
- `.github/release.yml` only owns Release Drafter PR-label changelog grouping.
- The release workflow and this skill own release notes publication, tag validation, artifact builds, updater sidecars, provenance, and draft Release asset publication.
- If rerunning the same tag after a cancellation or failed artifact upload, first inspect the draft Release assets and delete any partial assets for that tag before rerunning.
- The workflow preflight will stop before artifact creation if the checkout commit, tag target commit, main ancestry, or version files do not match.

## Update GitHub Release Notes

Try this first:

```bash
gh release edit v{new_version} --notes "..."
```

If the Release does not exist yet because the workflow is still running, create it:

```bash
gh release create v{new_version} --draft --notes "..."
```

Treat the CLI as the source of truth for release note body text. The GitHub workflow only builds artifacts and attaches them.

After create/edit, verify with:

```bash
gh release view v{new_version} --json tagName,isDraft,url,body
```

Confirm `tagName` is `v{new_version}`, the body matches the intended notes, and the draft state is expected.

A draft Release URL containing `untagged-...` is not automatically a failure. Classify it by structured `gh release view` fields. If `tagName` is `v{new_version}` and `isDraft` is expected, report the URL normally.

## Optional Read-Only Subagent

Use a read-only subagent after push when workflow observation may take time:

```text
Observe the latest release workflow and draft GitHub Release for tag <tag>.
Do not rerun workflows, edit releases, push, or delete assets.
Return only a workflow URL/status whose tag/ref and head SHA match the expected release tag and commit, plus gh release view structured fields and any mismatch with expected tag/draft state.
```

The parent decides whether to wait, rerun, or stop.
