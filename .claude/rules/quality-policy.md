# Quality Policy

React Doctor / Knip / similarity / task priority rules that are too durable for `todo.txt` or a GitHub Issue live here.

## Dependency Advisory Policy

CI runs `mise run audit:deps` (pnpm, prod paths) and `mise run audit:deps:rust` (cargo audit) in the `audit` job.

- Fail: CI fails when a high-or-above advisory hits a reachable path — any Rust dependency, or an npm dependency reachable from `--prod` scope.
- Ignore: dev/test/CLI-only-path advisories must be registered explicitly in the ignore list (`auditConfig.ignoreGhsas` in `pnpm-workspace.yaml` for npm; `.cargo/audit.toml` for Rust) with advisory ID, reason, and date recorded here. Anonymous ignores are forbidden.
- Review: ignore entries are re-triaged during release preflight.

Ignore entries:

- `RUSTSEC-2026-0235` — rkyv <0.8.17 (out-of-bounds reads in archives containing Rc/Arc) via `tauri-plugin-log -> byte-unit -> rust_decimal` as a disabled optional feature; `cargo tree -i rkyv --target all` prints nothing, so rkyv is never compiled. Remove once rust_decimal adopts rkyv >=0.8.17 or drops the feature; reviewed 2026-08-07.

Known dev-path advisories (13 findings: 4 high / 6 moderate / 3 low via jsdom→vitest, shadcn→hono, storybook→esbuild) were vetted as unreachable from the shipping Tauri app and production Vite bundle on 2026-07-14.

## Knip Ignore Policy

`package.json#knip.ignoreDependencies` entries must document why Knip cannot see a real consumer:

- `wrangler` — invoked by the `mise` `deploy:site` task from `.github/workflows/deploy-site.yml`; Knip does not trace `mise` or workflow command consumers; reviewed 2026-08-23.

`package.json#knip.ignoreBinaries` entries must document why Knip cannot trace a binary consumer:

- `mise` — launched via `spawnSync` by `scripts/similarity-report.ts` to run the Rust scan; `mise` is a toolchain runner rather than a package.json dependency and therefore cannot be declared as an npm dependency; reviewed 2026-08-29.

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

## React Compiler Adoption

React Compiler is not enabled in this repository. Do not add `babel-plugin-react-compiler`, Vite compiler wiring, or compiler-driven memoization changes as incidental cleanup.

Before enabling it, create an adoption preflight that records:

- the exact React / compiler package versions and the Vite integration point;
- the focused React Doctor diff/full results before and after enabling it;
- affected memoization, effect cleanup, and hook-dependency patterns;
- the rollback path if compiler warnings or runtime behavior drift.

Compiler adoption is opt-in only. Until that preflight is accepted, keep manual memoization and effect cleanup decisions based on current React runtime behavior, not on future compiler assumptions.

## ES2023 Array Copy Methods

`Array.prototype.toSorted()` and related ES2023 copy methods may be used only after confirming the touched code runs in one of these targets:

- Node-side tests and scripts: Node 26 from `mise.toml` / `package.json` engines.
- Frontend build output: Vite build target is explicitly `es2023`.
- Tauri app WebView: current Tauri 2 platform WebViews for the supported desktop OS set; do not use ES2023 copy methods in compatibility-sensitive runtime boundaries without a focused check on the affected OS.

Prefer applying `.toSorted()` first in test-only or dev-script code. Production code changes should stay scoped to readability or mutation-safety wins, and hot-path rewrites need a focused test or profiling note. Do not add polyfills just to satisfy a React Doctor suggestion.

## React Doctor Warning Categories

Classify every React Doctor warning before suppressing or fixing it:

- `must-fix`: likely bug, regression, performance hot path, or warning introduced by the current change.
- `accepted-risk`: intentional tradeoff that remains in production code; record the reason in the nearest rule, TODO, or baseline update note.
- `false-positive`: tool cannot model the local contract; record the proof near the code only when a local comment prevents future churn.
- `suppress`: last resort for unavoidable tool noise; include the warning id, scope, reason, owner, and review trigger in the suppression location.

Suppression records belong in the narrowest durable place: local code comment for one-line false positives, `.claude/rules/` for repeated project policy, or `scripts/quality-baseline.ts` only for pinned baseline count changes. Re-run the matching pinned React Doctor task after changing suppressions or baseline counts.

## Accepted Rust File-Length Exceptions

- `src-tauri/src/service/sync_scheduler/mod.rs` remains at 551 production lines after the responsibility split. This is an accepted exception decided on 2026-08-29: it is less than 10% above the 500-line guideline, and further splitting would make startup wiring less readable.

## Similarity Report Baseline

Use `mise run report:similarity` for the regular duplicate-code report. It wraps `similarity-ts --threshold 0.9 src/`, records TODO-backed false positives in `scripts/similarity-report.ts`, and treats drift as report output until it is triaged into TODO updates or refactoring work.

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

## Similarity False Positives

Similarity reports are triage input, not an automatic refactoring queue. Before extracting shared code, classify the repeated unit by responsibility:

- UI lifecycle hooks may share async guard shape, but keep them separate when one hook owns native browser overlay close/focus ordering and another module only builds static sidebar view models.
- Small React Query cache helpers are standalone account cache policy. Do not merge them with large hook lifecycle effects just because both contain guarded updates or array replacement.
- Cache helpers may share local helper functions within the same cache module, but do not extract app-wide cache abstractions unless multiple cache modules share the same key contract and invalidation semantics.
- For low-token or short functions, treat 90-95% similarity as a false-positive candidate until a focused rerun with a higher minimum size still reports the pair.

When reading `similarity-ts` output, use the default scan to find candidates, then rerun suspicious small pairs with focused paths and size guards such as `--min-lines 8` and `--min-tokens 60`. Prefer investigating large hooks, repeated domain transformations, and repeated runtime-boundary logic; skip structural matches between different layers unless the shared responsibility is explicit.

Repository-specific heuristics:

- `0.95+` should currently be close to empty; a new hit there is worth reading immediately.
- Pairs involving `useUpdater`, browser lifecycle hooks, sidebar controller hooks, or article auto-mark hooks are structural noise unless a small pure helper inside them is identical.
- Browser surface `AppError` detection is a valid shared helper only for `UserVisible | Retryable` non-empty messages. Broader article action error coercion is intentionally separate.
