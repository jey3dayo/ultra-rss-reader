# Quality Policy

React Doctor / Knip / similarity / TODO priority rules that are too durable for `TODO.md` live here.

## TODO Priority Taxonomy

- `P0`: release-blocking regression, data loss, security issue, or broken app start/build.
- `P1`: user-visible defect or workflow break that should be fixed before the next planned release.
- `P2`: quality debt with clear implementation work, test gap, or warning cleanup that can be batched safely.
- `P3`: policy, taxonomy, adoption preflight, documentation, or low-risk cleanup that should prevent future drift but does not change runtime behavior by itself.

When a TODO item becomes a durable rule, move the rule into `CLAUDE.md` or `.claude/rules/` and let the main session remove the corresponding `TODO.md` item after verifying the rule is discoverable.

## TODO Priority Aging

TODO aging is review pressure, not automatic priority mutation. Use `node scripts/todo-triage.ts aging TODO.md` when triaging backlog age or preparing worker batches.

- Add `created batch: YYYY-MM-DD ...` when introducing a new risk TODO batch, and `last reviewed: YYYY-MM-DD ...` when intentionally keeping an older item.
- Treat a `P1` with no review for 30 days as escalation input: either start it, split it into a ready tranche, or explicitly downgrade with a reason.
- Treat a `P2` with no review for 60 days as stale triage input: refresh owner/domain/verification, merge it into an existing tranche, or defer it with a concrete blocker.
- Treat a `P3` with no review for 90 days as an archive candidate unless it still prevents concrete drift through tooling, policy, or contract-test planning.
- Move completed user-visible work to `CHANGELOG.md` only after the implementation lands; keep `completed by` only as a short transition marker until that move is done.
- Missing `created batch` / `last reviewed` markers should trigger review, not deletion.

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

## Similarity Report Baseline

Use `mise run report:similarity` for the regular duplicate-code report. It wraps `similarity-ts --threshold 0.9 src/`, records TODO-backed false positives in `scripts/similarity-report.ts`, and treats drift as report output until it is triaged into TODO updates or refactoring work.

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
