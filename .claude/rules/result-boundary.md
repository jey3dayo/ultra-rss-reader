---
paths:
  - "src/**/*.{ts,tsx}"
---

# Result Boundary

`@praha/byethrow` is the TypeScript Result boundary for fallible runtime, IPC, validation, and action code. Keep the Result API near the boundary that creates, converts, or adapts the error.

## Rules

- Result creation, conversion, and classification should live in `src/api/**` or `src/lib/**`.
- React Query adapters may handle Result directly in `src/hooks/create-query.ts` and `src/hooks/create-mutation.ts`.
- `.tsx` components should not import `@praha/byethrow` directly. Move Result inspection into a feature helper, `src/lib/**`, or an adapter hook.
- `src/components/**/hooks/**` should avoid direct Result handling unless the hook owns a local async lifecycle policy. If the same Result inspection repeats, extract the conversion to helper or lib code.
- Treat `src/hooks/use-*.ts`, `src/stores/**`, and `src/dev/**` case by case. Keep latest-only behavior, toast execution, store access, listener lifecycle, and optimistic update policy with the owning feature.
- Do not introduce production `{ ok: ... }`, `{ success: ... }`, or similar custom result shapes just to avoid byethrow imports. Prefer a named helper that returns a domain value, throws inside an adapter, or invokes success/failure callbacks.

## Placement

- Keep Tauri IPC Result wrappers at the command boundary.
- Keep React-free, UI-copy-free, store-free, and Tauri-command-free pure helpers in `src/lib/**` when they are shared or likely to be reused.
- Keep hook, toast, store, listener, optimistic update, component prop, and view-label behavior in the owning feature unless another feature needs the same behavior.
- Use compatibility re-exports when moving an existing feature helper would otherwise churn nearby tests, mocks, or imports.

## Examples

- A Tauri command wrapper returning `Result.ResultAsync<T, AppError>` belongs in `src/api/**`.
- URL normalization that returns a user-visible article action error belongs in `src/lib/articles/**`.
- A `.tsx` menu component should call `openArticleEmailShare(...)` or `openFeedWebsite(...)`, not inspect `Result.isFailure(...)` inline.
- React Query `queryFn: () => listFeeds(accountId).then(Result.unwrap)` is allowed inside the query adapter layer because React Query owns the error state.
