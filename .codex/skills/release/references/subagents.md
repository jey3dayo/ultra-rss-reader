# Subagent Delegation

Release subagents are assistants for evidence gathering only. The parent agent remains the single writer and publisher.

## General Contract

Include this boundary in every delegated release task:

```text
This is read-only release support. Do not edit files, run version bump commands, create commits, create tags, push, mutate GitHub Releases, rerun workflows, delete assets, or decide that a failed gate can be skipped. Return evidence and uncertainty only.
```

Ask for concise evidence:

- command shape used;
- commit range or files inspected;
- categorized findings;
- uncertainty or blockers.

## Commit Inventory Worker

```text
Inspect non-merge commits in <range> for an Ultra RSS Reader release.
Apply the release classification rules from references/phase-2-generate.md.
Return Japanese release note bullets grouped by GitHub Release heading, with commit hashes and subjects as evidence.
Do not edit files or run publishing commands.
```

Use when the commit range is long or release note wording is ambiguous.

## CHANGELOG/TODO Review Worker

```text
Review the proposed CHANGELOG.md and TODO.md release diff.
Check that CHANGELOG headings are plain text, Unreleased is cleared correctly, and TODO items are only checked when clearly mapped to released contents.
Return findings with file/line references when possible.
Do not edit files.
```

Use after Phase 2 edits and before the release commit when there is enough time to review in parallel with local checks.

## Workflow Consistency Worker

```text
Inspect .github/workflows/release.yml, .github/release.yml, .claude/commands/release.md, and .claude/rules/release-workflow.md for drift against the release skill.
Return only release-blocking drift or source-of-truth duplication risks.
Do not edit files.
```

Use when the release workflow or release docs have changed recently.

## Post-Push Observer

```text
Observe the latest release workflow and draft GitHub Release for tag <tag>.
Return workflow URL/status and gh release view structured fields.
Only report a workflow as matching when its tag/ref and head SHA match the expected release tag and commit.
Do not rerun workflows, edit releases, push, or delete assets.
```

Use after push when the parent can continue final reporting or prepare next steps while the observer checks remote state.
