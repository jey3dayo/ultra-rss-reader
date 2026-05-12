# Similarity Refactor Guidance

Use `similarity-ts` as a queue for investigation, not as an automatic refactor mandate.

## Workflow

1. Start with the default scan.

   ```bash
   similarity-ts src/ > /tmp/similarity-report.md
   ```

2. Confirm near-duplicates first.

   ```bash
   similarity-ts --threshold 0.95 --min-lines 10 src/
   ```

3. Broaden only after the high-confidence pass is understood.

   ```bash
   similarity-ts --threshold 0.90 --min-lines 10 src/
   similarity-ts --threshold 0.80 --min-lines 20 <focused paths>
   ```

4. Refactor only when the pair has the same responsibility, same data boundary, and small behavioral differences.

## High-Value Candidates

- Copy-like functions at `0.95+`.
- Local helper duplication inside the same feature boundary.
- Repeated schema parsing or Result conversion with the same error semantics.
- Small pure helpers under `components/` that import no React, store, Tauri command, DOM event, or view-label behavior.
- Type literals that duplicate a local call contract in the same file.

## Default Ignore Patterns

- Large hooks whose only overlap is `useEffect`, cleanup, callback, or stale-request structure.
- Pairs involving `useUpdater`, browser lifecycle hooks, sidebar controller hooks, or article auto-mark hooks unless a small pure helper inside them is identical.
- Type similarity for `{ id: string }`, `{ message: string }`, test-only props, or feature-local identity objects.
- UI event handlers where `preventDefault`, propagation, focus restoration, or listener lifecycle differs.
- Query cache patch helpers when optimistic update and server refetch semantics differ.
- Result wrappers where the success/failure shape is custom. Prefer byethrow `Result`; do not add new `{ ok: ... }` or `{ success: ... }` production result types.

## Refactor Boundaries

- Move React-free, UI-copy-free, store-free, Tauri-command-free logic to `src/lib/`.
- Keep hooks, toast execution, optimistic updates, listener lifecycles, DOM focus behavior, and component props in the owning feature.
- Keep old feature modules as compatibility re-exports when nearby tests or components still import that public surface.
- Add a focused test when moving logic across feature or lib boundaries.

## Current Ultra RSS Reader Heuristics

- `0.95+` currently should be close to empty; a new hit is likely worth reading immediately.
- `0.90-0.95` is mostly structural hook similarity. Treat it as a prompt to inspect, not a refactor target.
- `0.80-0.90` is useful only on focused paths after a concrete suspicion exists.
- Browser surface `AppError` detection is a valid shared helper only for `UserVisible | Retryable` non-empty messages. Broader article action error coercion is intentionally separate.
