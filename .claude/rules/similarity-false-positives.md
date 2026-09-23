---
paths:
  - "src/**/*.{ts,tsx}"
---

# Similarity False Positives

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

Four facts the heuristics above do not cover. The measurements behind them are in [../../docs/similarity-pair-classification.md](../../docs/similarity-pair-classification.md) (Measurement Notes).

**Hub-shaped noise is not per-pair noise.** A few hook symbols — `useBrowserWebviewBoundsSync` (`use-browser-webview-bounds-sync.ts`) the largest — each pair with many unrelated targets and together fill a large share of the pair slots. Triage should start from how many pairs a symbol appears in, not from any one pair's percentage. Do not add a hub-level suppression: it would hide a genuine duplication later appearing on the same hub, and `similarityScanBaseline` is display-only rather than a gate.

**The false-positive allowlist cannot hold type pairs.** `findFalsePositiveMatch` consumes `parseSimilarityPairs`, and `parseSimilarityOutput` splits on `=== Type Similarity ===` and returns only the first half. A type pair registered in `similarityFalsePositiveBaseline` can never match and becomes dead data — the same structural gap recorded above for the Rust scan.

**`--no-size-penalty` is unusable here.** `--threshold 0.9 --no-size-penalty src/` reports 304,212 pairs against 40 with the penalty on. Raising size filters does not help either: `--min-lines 15 --min-tokens 60` moves 40 to 38, because the noise is 20-70 line hooks rather than tiny functions.

**A green report is not evidence that shared helpers are used.** Short helper bodies such as `createDeferred` (`tests/helpers/deferred.ts`) sink under the size penalty, so local copies of them go unreported, and `tests/` is outside the scan's `src/` root, so a local copy is never compared against the shared original. Check for local redefinitions of a shared helper directly. When counting them, match the definition exactly — `^[[:space:]]*(const|function) <name>[<(]` — because a name-prefix match also counts different helpers (`createDeferredCleanup`) and call sites such as `const createDeferredResult = createDeferred<...>()`. Do not count helpers by name prefix.
