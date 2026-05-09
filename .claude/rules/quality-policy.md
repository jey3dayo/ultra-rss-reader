# Quality Policy

React Doctor / Knip / TODO priority rules that are too durable for `TODO.md` live here.

## TODO Priority Taxonomy

- `P0`: release-blocking regression, data loss, security issue, or broken app start/build.
- `P1`: user-visible defect or workflow break that should be fixed before the next planned release.
- `P2`: quality debt with clear implementation work, test gap, or warning cleanup that can be batched safely.
- `P3`: policy, taxonomy, adoption preflight, documentation, or low-risk cleanup that should prevent future drift but does not change runtime behavior by itself.

When a TODO item becomes a durable rule, move the rule into `CLAUDE.md` or `.claude/rules/` and let the main session remove the corresponding `TODO.md` item after verifying the rule is discoverable.

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

- Node-side tests and scripts: Node 24 from `mise.toml` / `package.json` engines.
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
