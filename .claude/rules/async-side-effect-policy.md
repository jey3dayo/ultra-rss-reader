---
paths:
  - "src/**/*.{ts,tsx}"
---

# Async Side Effect Policy

Async code that changes UI state, native state, storage, cache, or user-visible feedback must define what happens after success, failure, stale completion, and unmount.

## Rules

- Fire-and-forget calls must still handle rejection. At minimum, log the failure; show a toast when the user needs to know their action did not persist.
- If multiple requests can be in flight for the same UI state, define whether the result is latest-only, first-wins, last-wins, or independently additive.
- Optimistic updates must explicitly choose rollback or optimistic-state retention on persist failure.
- Cleanup paths must be clear for component unmount, modal close, route/view change, and repeated trigger.
- Avoid letting stale promise resolution overwrite newer user intent.
- Keep async ordering policy in the hook/store/helper that owns the side effect, not scattered across view components.
- React Query invalidation and mutation wrappers should define whether post-success invalidation failure changes mutation success, logs only, or becomes visible to the user.

## Test Expectations

- For UI state updates, test rapid repeated calls with deferred promises when stale ordering is plausible.
- For hooks, test unmount before promise settle when the hook owns local state or global loading state.
- For fire-and-forget native/storage calls, test rejected promise and `Result.fail` separately when both can occur.
- For optimistic updates, assert both the visible state and the user-visible error surface after failure.

## Examples

- Theme, badge, app icon, and always-on-top side effects should not let an older deferred request overwrite the latest selected state.
- Settings writes may keep optimistic UI state after persist failure, but that choice must be fixed by a focused test.
- Drag/drop or callback-based async flows should cleanup active state even when the async operation rejects.
