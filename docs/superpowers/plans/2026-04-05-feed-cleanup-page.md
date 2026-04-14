# Feed Cleanup Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: Add a dedicated Feed Cleanup management surface that helps users find stale subscriptions, review why they are candidates, and keep, defer, or delete them safely.

Architecture: Implement the first release as a dedicated full-size dialog surface opened from the sidebar, not as a settings tab. Derive cleanup candidates on the frontend from existing `feeds + accountArticles + folders` data so the first version ships without new persistence or database migrations, then reuse the existing delete-feed command behind a shared hook and a richer confirmation dialog.

Tech Stack: React 19, TypeScript, Zustand, TanStack React Query, i18next, Vitest, Testing Library, Tauri commands

Spec: `docs/superpowers/specs/2026-04-05-feed-cleanup-page-design.md`

---

## Assumptions Locked For This Plan

- Phase 1 does **not** depend on a persisted `last opened at` signal because the current codebase does not expose one.
- Phase 1 does **not** ship a durable `mute` model; the actionable loop is `keep / later / delete`.
- The entry point is a sidebar management button so the feature is discoverable without adding route infrastructure.
- The cleanup surface is implemented as a large dialog-like page in `AppShell`, which keeps the main three-pane reader layout untouched.
- Candidate heuristics in Phase 1 are derived from:
  - latest article date per feed
  - unread count
  - starred count
  - optional account-level sync failure signal only if it can be added cheaply from existing Rust state

## File Map

### New Files

| File | Responsibility |
| --- | --- |
| `src/lib/feed-cleanup.ts` | Pure candidate-derivation helpers, queue sorting, and review-panel reason formatting |
| `src/hooks/use-delete-feed.ts` | Shared delete-feed mutation/toast/query invalidation hook reusable by cleanup page and existing feed menu |
| `src/components/feed-cleanup/feed-cleanup-page.tsx` | Container component that wires data, local keep/later state, and delete flow |
| `src/components/feed-cleanup/feed-cleanup-page-view.tsx` | Presentational 3-column cleanup surface |
| `src/components/feed-cleanup/feed-cleanup-delete-dialog.tsx` | Candidate-aware delete confirmation wrapper |
| `src/locales/en/cleanup.json` | English cleanup page copy |
| `src/locales/ja/cleanup.json` | Japanese cleanup page copy |
| `src/__tests__/lib/feed-cleanup.test.ts` | Unit tests for candidate derivation and queue ordering |
| `src/__tests__/components/app-shell.test.tsx` | AppShell tests for mounting and toggling the cleanup surface |
| `src/__tests__/components/feed-cleanup-page.test.tsx` | Interaction tests for the cleanup surface |

### Modified Files

| File | Change |
| --- | --- |
| `src/lib/i18n.ts` | Register the new `cleanup` namespace |
| `src/types/i18next.d.ts` | Add type support for `cleanup.json` resources |
| `src/stores/ui-store.ts` | Add `feedCleanupOpen` state and open/close actions |
| `src/components/app-shell.tsx` | Mount the cleanup surface alongside the existing shell overlays |
| `src/components/reader/sidebar.tsx` | Add the sidebar entry button for Feed Cleanup |
| `src/components/reader/feed-context-menu.tsx` | Reuse the shared delete hook instead of duplicating delete/toast logic |
| `src/locales/en/sidebar.json` | Add sidebar entry label |
| `src/locales/ja/sidebar.json` | Add sidebar entry label |
| `README.md` | Add short user-facing documentation for Feed Cleanup |

### Optional Rust Follow-Up Files

Only touch these if account-level sync failure can be exposed cheaply enough to include in Phase 1:

| File | Change |
| --- | --- |
| `src-tauri/src/commands/dto.rs` | Extend IPC DTOs if cleanup metadata needs a small new field |
| `src-tauri/src/commands/feed_commands.rs` | Add a thin command only if frontend derivation cannot cover required metadata |
| `src/api/schemas/feed.ts` | Mirror any DTO extension on the frontend |
| `src/api/tauri-commands.ts` | Wire new command or shape only if needed |

If this optional branch starts to sprawl, stop and defer sync-failure filtering to Phase 2.

## Implementation Notes

- Use `useAccountArticles(selectedAccountId)` as the primary source for per-feed latest-article date, starred count, and unread count cross-checks.
- Build candidate derivation as a pure helper first so UI tests stay narrow.
- Keep `keep` and `later` as local in-memory sets inside `FeedCleanupPage`; do not persist them in Phase 1.
- Keep the selected review candidate stable when filters change:
  - stay on the selected candidate if it still exists
  - otherwise fall back to the queue head
- Reuse the existing unsubscribe/delete command, but improve the confirmation copy in the cleanup page with candidate reasons.
- Avoid route work, app-shell route guards, or settings-tab overloading in the first implementation.

## Task 1: Add Pure Cleanup Candidate Derivation

## Task 1 Files

- Create: `src/lib/feed-cleanup.ts`
- Test: `src/__tests__/lib/feed-cleanup.test.ts`

- [ ] **Step 1: Write the failing candidate-derivation tests**

Cover these cases in `src/__tests__/lib/feed-cleanup.test.ts`:

- derives one candidate per feed using the latest article date for that feed
- marks feeds with old latest-article dates as stale
- includes unread/starred counts in the candidate summary
- sorts candidates so the stalest low-signal feeds appear first
- excludes feeds dismissed by local `keep` / `later` sets

- [ ] **Step 2: Run the helper test to verify it fails**

Run: `pnpm vitest run src/__tests__/lib/feed-cleanup.test.ts`

Expected: FAIL because `@/lib/feed-cleanup` does not exist yet.

- [ ] **Step 3: Implement the minimal pure helper**

Create `src/lib/feed-cleanup.ts` with:

- a candidate type such as:

```ts
export type FeedCleanupCandidate = {
  feedId: string;
  title: string;
  folderId: string | null;
  folderName: string | null;
  latestArticleAt: string | null;
  staleDays: number | null;
  unreadCount: number;
  starredCount: number;
  reasonKeys: Array<"stale_90d" | "no_unread" | "no_stars">;
};
```

- pure helpers to:
  - group account articles by `feed_id`
  - find each feed’s latest article timestamp
  - count starred articles per feed
  - derive fixed Phase 1 filters
  - sort candidates by strongest cleanup signal first

- [ ] **Step 4: Run the helper test to verify it passes**

Run: `pnpm vitest run src/__tests__/lib/feed-cleanup.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the pure-helper slice**

```bash
git add src/lib/feed-cleanup.ts src/__tests__/lib/feed-cleanup.test.ts
git commit -m "feat: add feed cleanup candidate helpers"
```

## Task 2: Add Shared Delete Feed Behavior

## Task 2 Files

- Create: `src/hooks/use-delete-feed.ts`
- Modify: `src/components/reader/feed-context-menu.tsx`
- Create or Modify: `src/__tests__/components/feed-context-menu.test.tsx`

- [ ] **Step 1: Add a focused failing test or extend an existing component test**

Use the existing feed-context-menu coverage to assert the shared delete path still:

- invalidates `["feeds"]` and `["accountUnreadCount"]`
- shows the translated success toast
- shows the translated failure toast

If extending an existing test file is faster than creating a new one, do that.

- [ ] **Step 2: Run the focused delete-flow test and verify it fails**

Run: `pnpm vitest run src/__tests__/components/feed-context-menu.test.tsx`

Expected: either current coverage is insufficient or the new shared hook is missing.

- [ ] **Step 3: Extract the shared delete hook**

Create `src/hooks/use-delete-feed.ts` that:

- wraps `deleteFeed(feedId)`
- invalidates:
  - `["feeds"]`
  - `["accountUnreadCount"]`
  - any cleanup-specific queries added later
- accepts `title` so the caller can reuse translated success/error toasts

Then update `src/components/reader/feed-context-menu.tsx` to use that hook instead of inline deletion logic.

- [ ] **Step 4: Re-run the focused delete-flow test**

Run: `pnpm vitest run src/__tests__/components/feed-context-menu.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the shared delete behavior**

```bash
git add src/hooks/use-delete-feed.ts src/components/reader/feed-context-menu.tsx
git commit -m "refactor: share feed deletion behavior"
```

## Task 3: Add Cleanup Surface State and Sidebar Entry

## Task 3 Files

- Modify: `src/stores/ui-store.ts`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/components/reader/sidebar.tsx`
- Modify: `src/locales/en/sidebar.json`
- Modify: `src/locales/ja/sidebar.json`
- Create: `src/__tests__/components/app-shell.test.tsx`
- Modify: `src/__tests__/components/sidebar.test.tsx`

- [ ] **Step 1: Write the failing UI-state and entry tests**

Add tests that expect:

- `useUiStore` to expose `feedCleanupOpen`, `openFeedCleanup()`, and `closeFeedCleanup()`
- the sidebar to render a cleanup entry button
- clicking that button opens the cleanup surface from `AppShell`

- [ ] **Step 2: Run the sidebar/app-shell tests to verify they fail**

Run: `pnpm vitest run src/__tests__/components/app-shell.test.tsx src/__tests__/components/sidebar.test.tsx`

Expected: FAIL because the state and button do not exist yet.

- [ ] **Step 3: Implement the entry state and button**

Update `src/stores/ui-store.ts` to add:

- `feedCleanupOpen: boolean`
- `openFeedCleanup()`
- `closeFeedCleanup()`

Update `src/components/reader/sidebar.tsx` to add a new management button near the existing Settings button.

Suggested behavior:

- visible in the same bottom action area as Settings
- uses sidebar-local copy from `sidebar.json`
- calls `openFeedCleanup()`

Update `src/components/app-shell.tsx` to mount `<FeedCleanupPage />` so the open flag actually renders a surface.

- [ ] **Step 4: Re-run the sidebar/app-shell tests**

Run: `pnpm vitest run src/__tests__/components/app-shell.test.tsx src/__tests__/components/sidebar.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the entry slice**

```bash
git add src/stores/ui-store.ts src/components/app-shell.tsx src/components/reader/sidebar.tsx src/locales/en/sidebar.json src/locales/ja/sidebar.json src/__tests__/components/app-shell.test.tsx src/__tests__/components/sidebar.test.tsx
git commit -m "feat: add feed cleanup entry point"
```

## Task 4: Build the Cleanup Surface and Phase 1 Interaction Loop

## Task 4 Files

- Create: `src/components/feed-cleanup/feed-cleanup-page.tsx`
- Create: `src/components/feed-cleanup/feed-cleanup-page-view.tsx`
- Create: `src/components/feed-cleanup/feed-cleanup-delete-dialog.tsx`
- Create: `src/locales/en/cleanup.json`
- Create: `src/locales/ja/cleanup.json`
- Modify: `src/lib/i18n.ts`
- Modify: `src/types/i18next.d.ts`
- Test: `src/__tests__/components/feed-cleanup-page.test.tsx`

- [ ] **Step 1: Write the failing cleanup-page interaction test**

Cover these interactions:

- the dialog opens when `feedCleanupOpen` is true
- filter chips narrow the queue
- selecting a queue row updates the review panel
- `keep` removes the current candidate from the visible queue
- `later` removes the current candidate from the visible queue without deleting it
- `delete` opens the candidate-aware confirmation dialog

- [ ] **Step 2: Run the cleanup-page test to verify it fails**

Run: `pnpm vitest run src/__tests__/components/feed-cleanup-page.test.tsx`

Expected: FAIL because the cleanup components and namespace do not exist yet.

- [ ] **Step 3: Implement the page container**

Create `src/components/feed-cleanup/feed-cleanup-page.tsx` to:

- read `feedCleanupOpen` / `closeFeedCleanup()` from `useUiStore`
- load:
  - `selectedAccountId`
  - `useFeeds(selectedAccountId)`
  - `useFolders(selectedAccountId)`
  - `useAccountArticles(selectedAccountId)`
- derive candidates with `buildFeedCleanupCandidates(...)`
- manage local state for:
  - active filter chips
  - dismissed feed IDs (`keep`)
  - deferred feed IDs (`later`)
  - selected candidate ID
  - delete-dialog target

- [ ] **Step 4: Implement the presentational view**

Create `src/components/feed-cleanup/feed-cleanup-page-view.tsx` as a large dialog-like 3-column layout with:

- left: fixed filters
- center: queue rows
- right: review panel

Use the existing visual language:

- dark background tokens from global theme
- clear teal highlight for active filters/selection
- orange destructive emphasis only for delete action

- [ ] **Step 5: Implement the delete confirmation dialog**

Create `src/components/feed-cleanup/feed-cleanup-delete-dialog.tsx` to show:

- feed title
- last article date
- unread count
- starred count
- candidate reasons

Reuse the existing dialog primitives, not the generic app confirm dialog, because the content is richer than a one-line message.

- [ ] **Step 6: Re-run the cleanup-page test**

Run: `pnpm vitest run src/__tests__/components/feed-cleanup-page.test.tsx`

Expected: PASS

- [ ] **Step 7: Commit the cleanup surface**

```bash
git add src/components/feed-cleanup/feed-cleanup-page.tsx src/components/feed-cleanup/feed-cleanup-page-view.tsx src/components/feed-cleanup/feed-cleanup-delete-dialog.tsx src/locales/en/cleanup.json src/locales/ja/cleanup.json src/lib/i18n.ts src/types/i18next.d.ts src/__tests__/components/feed-cleanup-page.test.tsx
git commit -m "feat: add feed cleanup management surface"
```

## Task 5: Wire Real Delete Actions and Candidate Refresh

## Task 5 Files

- Modify: `src/components/feed-cleanup/feed-cleanup-page.tsx`
- Modify: `src/hooks/use-delete-feed.ts`
- Modify: `src/__tests__/components/feed-cleanup-page.test.tsx`

- [ ] **Step 1: Extend the failing page test to cover real deletion**

Add assertions that:

- confirming delete calls the shared delete hook
- the deleted feed disappears from the queue after invalidation/recompute
- a failed delete keeps the candidate visible and leaves the dialog closable

- [ ] **Step 2: Run the cleanup-page test again to verify the delete path fails**

Run: `pnpm vitest run src/__tests__/components/feed-cleanup-page.test.tsx`

Expected: FAIL because the current page only opens the dialog, or does not yet refresh after deletion.

- [ ] **Step 3: Implement the real delete flow**

In `src/components/feed-cleanup/feed-cleanup-page.tsx`:

- call `useDeleteFeed()` for the selected candidate
- close the dialog only on success
- reset selection to the next queue row after deletion
- keep selection stable on failure

In `src/hooks/use-delete-feed.ts`:

- add cleanup-query invalidation if the page introduces a dedicated query key
- keep the hook generic enough for both cleanup page and feed context menu

- [ ] **Step 4: Re-run the cleanup-page test**

Run: `pnpm vitest run src/__tests__/components/feed-cleanup-page.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the delete integration**

```bash
git add src/components/feed-cleanup/feed-cleanup-page.tsx src/hooks/use-delete-feed.ts src/__tests__/components/feed-cleanup-page.test.tsx
git commit -m "feat: connect feed cleanup deletion flow"
```

## Task 6: Document and Verify

## Task 6 Files

- Modify: `README.md`

- [ ] **Step 1: Add a short README section**

Add a concise section near the existing feature/usage docs:

```md
## Feed Cleanup

- Open `Feed Cleanup` from the sidebar management area
- Review subscriptions that have not updated for a long time
- Inspect why a feed is a candidate before deleting it
- Use `Keep` or `Later` to clear the queue without unsubscribing immediately
```

- [ ] **Step 2: Run focused tests**

Run: `pnpm vitest run src/__tests__/lib/feed-cleanup.test.ts src/__tests__/components/app-shell.test.tsx src/__tests__/components/feed-cleanup-page.test.tsx src/__tests__/components/sidebar.test.tsx src/__tests__/components/feed-context-menu.test.tsx`

Expected: PASS

- [ ] **Step 3: Run the full local gate**

Run: `mise run check`

Expected: format, lint, and tests pass.

- [ ] **Step 4: Commit the docs + verification-ready state**

```bash
git add README.md
git commit -m "docs: add feed cleanup usage notes"
```

## Deferred Work

- Persisted `last opened at` tracking
- Durable `mute` semantics
- Sync-failure-based filtering if it requires new DTO/query surface
- Batch cleanup actions
- Duplicate-feed detection
