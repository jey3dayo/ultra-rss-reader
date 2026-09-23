---
paths:
  - "scripts/quality-baseline.ts"
  - "scripts/similarity-report.ts"
  - "scripts/check-react-doctor-pin-consistency.ts"
  - "todo.txt"
  - "docs/knip-export-classification.md"
  - "src-tauri/src/service/sync_scheduler/mod.rs"
  - "src-tauri/src/domain/provider.rs"
---

# Quality Policy

React Doctor / Knip / similarity / task priority rules that are too durable for `todo.txt` or a GitHub Issue live here.

## Knip Ignore Policy

Knip is a report-only review tool in this repository, not a continuously enforced gate. Its unused-file detector cannot statically trace consumers routed through `mise` tasks or Vite aliases. As of 2026-09-08, all seven reported unused files were verified as false positives by locating the actual consumer of each:

| File | Consumer |
| --- | --- |
| `scripts/check-toolchain-contract.ts` | `mise/quality.toml` |
| `scripts/report-dependency-licenses.ts` | `mise/quality.toml` |
| `scripts/verify-action-pins.ts` | `mise/setup.toml` `deps:update` |
| `scripts/install-windows-app.ts` | `mise.toml` `run_windows` |
| `src/dev/prod-stubs/scenario-ids.ts` | `vite.config.ts` production alias |
| `src/dev/prod-stubs/use-dev-intent.ts` | `vite.config.ts` production alias |
| `src/dev/prod-stubs/use-resolved-dev-intent.ts` | `vite.config.ts` production alias |

The three alias targets are covered by `production-dev-aliases.node.test.ts`.

`scripts/run-guarded-pnpm-update.ts` has the same shape — invoked only from `mise/setup.toml` — but Knip does not report it, because `release-age-gate-contract.node.test.ts` imports it with `?raw` to pin its contract. That import is what makes it traceable, so do not treat its absence from the report as evidence that Knip can follow `mise` consumers.

Keeping a hard count gate in that situation encourages number-matching instead of triage and degrades the signal. Reconsider this policy if Knip can trace these `mise` and Vite alias consumers.

`package.json#knip.ignoreDependencies` entries must document why Knip cannot see a real consumer:

- `wrangler` — invoked by the `mise` `deploy:site` task from `.github/workflows/deploy-site.yml`; Knip does not trace `mise` or workflow command consumers; reviewed 2026-08-23.

`package.json#knip.ignoreBinaries` entries must document why Knip cannot trace a binary consumer:

- `mise` — launched via `spawnSync` by `scripts/similarity-report.ts` to run the Rust scan; `mise` is a toolchain runner rather than a package.json dependency and therefore cannot be declared as an npm dependency; reviewed 2026-08-29.

### Unused Export And Type Findings

Classify each `exports` / `types` finding as false-positive, accepted-risk, narrow, or remove. Decide from three checks, in this order, and record the evidence:

1. Resolve the `from "…"` specifier of every import that mentions the name. A name appearing in many files is not proof a re-export is live; those files usually import it from the owner module, which makes the re-exporting entry dead.
2. Search the tests that import source files with `?raw` for the name. Those contracts can pin the literal `export` keyword, and Knip cannot model them.
3. Check whether the name is used inside its own file. If it is, narrowing to a module-local binding is the first candidate. If its only occurrence is the definition, narrowing is impossible — `tsc --noUnusedLocals` rejects the unused local — so the choice is remove or keep, never "drop the modifier".

A mirrored Rust constant, DTO, command, or capability entry is a Rust-side contract and is not a reason to keep a TypeScript export; only a TypeScript consumer counts. Two shapes of TypeScript consumer are invisible to both Knip and an import-graph search, and both were found the hard way: a test that reads the `.rs` file as text and compares, and a test that extracts symbols from the *TypeScript* source text. `tests/helpers/tauri-mocks.node.test.ts` is the second kind — it scrapes `safeInvoke("…")` command strings out of `src/api/tauri-commands/*.ts` and pins them against the default mock set, so deleting a wrapper with no caller breaks it. Check both before deleting anything at a command or DTO boundary. "We might need it later" is not a reason either. Do not generalise the design-system barrel completeness precedent below to other barrels; check each owner for an actual pinned public surface instead.

Standing accepted risk:

- `getPlatformPermissionDeniedRecovery` (`src/api/tauri-commands/system.ts`) — no production caller, but the mock-parity test above pins it, and `src/dev/mocks.ts` plus the `debug-log-commands` capability allowlist agree with it. Retiring `get_platform_permission_denied_recovery` means retiring all five surfaces together; wiring a caller or retiring it end to end is the open decision. Reviewed 2026-09-08.

Standing false positive:

- `corePreferenceDefaults` (`src/schemas/preference-values.ts`) — `src/__tests__/schemas/preferences-schema-contract.test.ts` imports the module with `?raw` and matches `/export const corePreferenceDefaults = \{([\s\S]*?)\} as const/`. The `export` keyword is part of that contract, so the modifier must stay; reviewed 2026-09-08.
- `showRestartToast` (`src/hooks/use-updater.ts`) — no static import-graph caller, but `src/__tests__/hooks/use-updater.node.test.ts` dynamically imports the module (`await import("@/hooks/use-updater")`) and calls `updaterModule.showRestartToast(...)` directly. Knip does not trace named-export calls reached through a dynamic `import()` namespace object, so this is a real consumer it cannot model; reviewed 2026-09-23.

Findings already classified once are recorded per-finding in [../../docs/knip-export-classification.md](../../docs/knip-export-classification.md); check there before re-classifying a repeat hit.

Intentional public barrel completeness is pinned by public API tests rather than a file-level Knip ignore. The design-system barrel re-exports each primitive in a component family as a complete public surface, and `src/__tests__/components/ui-wrapper-public-api.node.test.ts` consumes the full Command family so an unused member such as `CommandDialog` is not removed while the other primitives remain available. The existing `src/components/ui/*` export ignores remain limited to their small wrapper files; reviewed 2026-08-29.

## Provider Policy Family

The `clock_policy`, `deletion_retention_policy`, and `optimistic_mutation_conflict_policy` methods in `src-tauri/src/domain/provider.rs` have zero production callers; tests alone pin their contracts. They are not dead code: together they form an executable specification of provider-specific behavior. Do not remove one merely because it has no production caller, since removing a single member would break the consistency of the policy family. If a future audit flags these methods as dead code, reject that finding using this documented contract.

## Task Priority Taxonomy

Tasks live in `todo.txt` (tuxedo format) with rich context in linked GitHub Issues. Priority mapping: `(A)`=P0, `(B)`=P1, `(C)`=P2, `(D)`=P3.

- `(A)` P0: release-blocking regression, data loss, security issue, or broken app start/build.
- `(B)` P1: user-visible defect or workflow break that should be fixed before the next planned release.
- `(C)` P2: quality debt with clear implementation work, test gap, or warning cleanup that can be batched safely.
- `(D)` P3: policy, taxonomy, adoption preflight, documentation, or low-risk cleanup that should prevent future drift but does not change runtime behavior by itself.

When a task becomes a durable rule, move the rule into `CLAUDE.md` or `.claude/rules/`, then close the issue and remove the `todo.txt` line after verifying the rule is discoverable.

## Task Aging

Aging is review pressure, not automatic priority mutation. The todo.txt creation date (second field) is the age reference.

- Treat a `(B)` with no review for 30 days as escalation input: either start it, split it, or explicitly downgrade with a reason recorded in the linked issue.
- Treat a `(C)` with no review for 60 days as stale triage input: refresh owner/scope/verification in the issue, merge into related work, or defer with a concrete blocker.
- Treat a `(D)` with no review for 90 days as an archive candidate unless it still prevents concrete drift through tooling, policy, or contract-test planning.
- Move completed user-visible work to `CHANGELOG.md` only after the implementation lands; archive the todo.txt line with `tuxedo done` + `archive` and close the linked issue.

## React Doctor Scan Scope

The React Doctor tasks pass `--project .` so the scan covers only this repository's own
project. Do not remove it to "scan more".

`react-doctor .` discovers every project root beneath the working directory. `apm_modules/`
holds vendored packages and is gitignored, so it exists in an ordinary checkout and is absent
from a fresh worktree. Without `--project .` the same command therefore reported different
totals depending on which tree it ran in, which repeatedly produced set comparisons between
two different trees presented as before/after of one change.

The distortion is not limited to extra files. Project-level rules fire once per discovered
project even when they point at the same file: with the vendored projects included,
`require-pnpm-hardening` was reported three times against the single root
`pnpm-workspace.yaml`, and `require-reduced-motion` was reported against a vendored
`package.json`.

Before comparing two React Doctor runs, confirm `projects[]` in the JSON report holds exactly
the repository root. A count difference between two runs is not evidence about the code until
that matches.

## React Doctor Triage

Read [react-doctor-triage.md](./react-doctor-triage.md) before running or interpreting a React
Doctor task, classifying or fixing a finding, adding or editing a `react-doctor-disable` record, or
re-pinning a React Doctor baseline. It holds the warning categories, inline suppression records,
gate mechanics, and per-rule finding classifications, and it loads on its own only when one of its
`paths:` files is read.

## Accepted Rust File-Length Exceptions

- `src-tauri/src/service/sync_scheduler/mod.rs` remains at 551 production lines after the responsibility split. This is an accepted exception decided on 2026-08-29: it is less than 10% above the 500-line guideline, and further splitting would make startup wiring less readable.

## Similarity Report Baseline

Use `mise run report:similarity` for the regular duplicate-code report. It wraps `similarity-ts --threshold 0.9 src/`, records TODO-backed false positives in `scripts/similarity-report.ts`, and treats drift as report output until it is triaged into TODO updates or refactoring work. Pair-level classifications and the inventory that explains the display baselines live in [../../docs/similarity-pair-classification.md](../../docs/similarity-pair-classification.md).

### Rust Similarity Scan

`mise run report:similarity` runs `similarity-rs` against `src-tauri/src/` after the TypeScript/CSS scan. The Rust scan is report-only: its gate is disabled, it is skipped when a custom target path is supplied or on platforms other than Linux and macOS, and its output currently reports duplicate-pair counts rather than pair details.

Do not register Rust false positives in `similarityFalsePositiveBaseline` in `scripts/similarity-report.ts`. `findFalsePositiveMatch` consumes the output of `parseSimilarityPairs`, which is the TypeScript scan's pair data, while the Rust path only reports counts through `buildSimilarityRustSummary`; such entries would never match and would be dead data. Record the 2026-08-29 Rust triage result in prose instead: there are no immediate extraction candidates, and the 76 pairs at 0.95+ among 256 pairs come from tests, newtypes, or platform branches, or require a deliberate contract-preserving design decision. Reconsider this policy if Rust pair analysis is added in the future.

Future-wave triage candidates are: local import/export preamble sharing; pending-mutation query-and-save helpers (only with the transaction contract preserved); a lock-poisoned-error mapper; a browser back/forward direction helper; an article query-builder seam; parameterizing tag-mutation operations; a mute-keyword transaction helper; shared `trigger_sync` account/feed orchestration; a GReader subscriptions/folders endpoint flow; and a unified Result-versus-fallback contract for the local provider.

Treat the following families as false positives: escape-accelerator platform branches, typed-ID newtypes, updater `Drop` implementations, fixture and test families, the browser security classifier, provider policy boundaries, and success/failure scheduling branches.

Threshold usage:

- `0.95`: near-copy candidates that should usually become immediate extraction or deletion work.
- `0.9`: regular baseline for TODO triage and recurring report updates.
- `0.87`: exploratory scan matching the tool default; use it only when looking for broader patterns after the `0.9` baseline is understood.

Record false positives only when the pair is structurally similar but intentionally has different ownership, lifecycle, or domain boundaries. TODO-backed pairs should keep the TODO label in the report baseline until the main TODO entry is removed.
