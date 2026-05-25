# Phase 2: Generate Release Changes

Calculate `new_version` from the approved semver bump:

- `patch`: increment patch, reset nothing else;
- `minor`: increment minor and reset patch to `0`;
- `major`: increment major and reset minor and patch to `0`.

The helper can calculate this:

```bash
python3 .codex/skills/release/scripts/release_checks.py bump <current_version> <patch|minor|major>
```

## Update Versioned Files

Update these files to `new_version`:

- `package.json`;
- `src-tauri/Cargo.toml` in the `[package]` section;
- `src-tauri/tauri.conf.json`.

Refresh Cargo metadata after the bump:

```bash
cd src-tauri && cargo check
```

Include `src-tauri/Cargo.lock` in the release changes if `cargo check` updates the package version there.

Verify the three version files:

```bash
python3 .codex/skills/release/scripts/release_checks.py verify-version <new_version>
```

## Build Release Notes From Commits

Find the previous release tag:

```bash
git describe --tags --abbrev=0 --match "v*"
```

If no `v*` tag exists, treat the release as the first release and inspect all non-merge commits. Otherwise inspect non-merge commits in `{previous_tag}..HEAD`.

Generate notes before creating the release commit so the version bump commit is intentionally excluded.

Filtering rules:

- Exclude commits whose subject starts with `release:` or `merge:`.
- Preserve PR numbers such as `(#123)` when present.
- Abort if zero commits remain after filtering.

Classification order:

| Match | GitHub Release Heading | CHANGELOG Heading |
| --- | --- | --- |
| `*!:` or breaking-change marker | `💥 Breaking Changes` | `Breaking Changes` |
| `feat:` | `🚀 Features` | `Features` |
| `fix:` | `🐛 Bug Fixes` | `Bug Fixes` |
| `docs:` | `📚 Documentation` | `Documentation` |
| `chore:` `refactor:` `test:` `ci:` | `🔧 Maintenance` | `Maintenance` |
| anything else | `🔧 Maintenance` | `Maintenance` |

The helper can create a classified JSON inventory:

```bash
python3 .codex/skills/release/scripts/release_checks.py classify-commits <previous_tag>..HEAD
```

Omit empty categories. Keep GitHub Release headings emoji-prefixed. Keep `CHANGELOG.md` headings plain text without emoji.

Write release notes and `CHANGELOG.md` entries in concise Japanese by default. Summarize user-visible impact rather than mechanically translating commit subjects. Do not invent changes that are not present in the commits.

## Update CHANGELOG And TODO

Update `CHANGELOG.md` so the top release area looks like this:

```markdown
## [Unreleased]

## [x.y.z] - YYYY-MM-DD

### Features
```

- Insert the new version section immediately after `## [Unreleased]`.
- Clear any existing items that were under `[Unreleased]` because they now belong to the new version.
- If `## [Unreleased]` does not exist, insert both `## [Unreleased]` and the new version section near the top of the file after the header.
- Mark matching release tasks in `TODO.md` as `[x]` only when the mapping is clear from the release contents. Otherwise leave `TODO.md` unchanged.

## Optional Read-Only Subagent

Use a read-only subagent when commit history is long or categories are ambiguous:

```text
Inspect non-merge commits in <range> for an Ultra RSS Reader release.
Do not edit files, create tags, push, or mutate GitHub Releases.
Return categorized Japanese release note bullets with commit hashes/subjects as evidence, plus any uncertainty.
```

The parent must verify the result against the commit range before using it.
