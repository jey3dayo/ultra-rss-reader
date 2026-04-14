# Subscriptions Index Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: Add a new `購読一覧` management surface as the default subscriptions workspace and reposition the existing `購読の整理` surface as a candidate-only decision workspace.

Architecture: Replace the single `feedCleanupOpen` gate with an explicit subscriptions workspace state that can open either `index` or `cleanup`. Build `購読一覧` as a new main-stage surface composed of summary cards, a balanced subscriptions list, and a right-side detail pane, then thread context-aware hand-off into the existing feed-cleanup page so cleanup opens as a subset review flow instead of the primary management entry.

Tech Stack: React 19, TypeScript, Zustand, TanStack React Query, i18next, Vitest, Testing Library, existing feed-cleanup components

---

## File Structure

### New Files

- `src/lib/subscriptions-index.ts`
  - Pure helpers for summary counts, row status chips, and right-pane metrics derived from `feeds + folders + accountArticles + cleanupCandidates`.
- `src/components/subscriptions-index/subscriptions-index-page.tsx`
  - Container that loads data, derives index view state, and wires hand-off actions.
- `src/components/subscriptions-index/subscriptions-index-page-view.tsx`
  - Layout shell for summary, list pane, and detail pane.
- `src/components/subscriptions-index/subscriptions-overview-summary.tsx`
  - Summary cards and “open cleanup with context” action buttons.
- `src/components/subscriptions-index/subscriptions-list-pane.tsx`
  - Balanced list rows with status chips and row selection.
- `src/components/subscriptions-index/subscription-detail-pane.tsx`
  - Right-side detail pane for selected subscription state and actions.
- `src/components/subscriptions-index/subscriptions-index.types.ts`
  - Props and local state types for the new surface.
- `src/components/subscriptions-index/use-subscriptions-index-state.ts`
  - Reducer/hooks for selected row, local filters, and sort state.
- `src/locales/en/subscriptions.json`
  - English copy for `購読一覧`.
- `src/locales/ja/subscriptions.json`
  - Japanese copy for `購読一覧`.
- `src/__tests__/lib/subscriptions-index.test.ts`
  - Unit tests for summary and row-status derivation.
- `src/__tests__/components/subscriptions-index-page.test.tsx`
  - Integration tests for the new index surface.

### Modified Files

- `src/stores/ui-store.ts`
  - Replace boolean cleanup gate with explicit subscriptions workspace state and context payload.
- `src/lib/actions.ts`
  - Add `open-subscriptions-index` and update action routing while keeping direct cleanup opening for debug/admin flows.
- `src/components/reader/use-command-palette-actions.ts`
  - Point the primary subscriptions management entry to `購読一覧`.
- `src/components/reader/article-view.tsx`
  - Lazy-load `SubscriptionsIndexPage` and switch by workspace kind.
- `src/components/reader/use-article-view-selection.ts`
  - Return `subscriptions-index` vs `feed-cleanup` selection states.
- `src/components/app-layout.tsx`
  - Keep main-stage behavior correct when either subscriptions workspace is open.
- `src/components/feed-cleanup/feed-cleanup-page.tsx`
  - Read incoming cleanup context from the workspace state and expose a return path to `購読一覧`.
- `src/components/feed-cleanup/use-feed-cleanup-page-state.ts`
  - Accept initial reason/filter context from the new workspace payload.
- `src/components/feed-cleanup/feed-cleanup-page-view.tsx`
  - Add “back to subscriptions index” affordance and context-aware heading/subtitle handling if needed.
- `src/lib/i18n.ts`
  - Register the new `subscriptions` namespace.
- `src/types/i18next.d.ts`
  - Add type support for `subscriptions.json`.
- `src/locales/en/sidebar.json`
  - Change the main management entry label from cleanup-oriented wording to index-oriented wording.
- `src/locales/ja/sidebar.json`
  - Same as above in Japanese.
- `src/__tests__/stores/ui-store.test.ts`
  - Update workspace state expectations.
- `src/__tests__/lib/actions.test.ts`
  - Cover the new action id and direct cleanup action routing.
- `src/__tests__/components/app-layout.test.tsx`
  - Verify main-stage behavior for both subscriptions workspaces.
- `src/__tests__/components/command-palette.test.tsx`
  - Expect the new primary action label/id.
- `src/__tests__/components/sidebar.test.tsx`
  - Expect the sidebar button to open `購読一覧`.
- `src/__tests__/components/feed-cleanup-page.test.tsx`
  - Cover hand-off from the index context into cleanup.
- `src/__tests__/components/article-view.test.tsx`
  - Update visible heading assertions for the new initial workspace.

### Existing Files To Reuse Without Renaming In Phase 1

- `src/lib/feed-cleanup.ts`
- `src/components/feed-cleanup/feed-cleanup-page.tsx`
- `src/components/feed-cleanup/feed-cleanup-page-view.tsx`
- `src/components/feed-cleanup/use-feed-cleanup-page-state.ts`
- `src/hooks/use-delete-feed.ts`

The plan keeps existing cleanup files in place and layers `購読一覧` beside them. Renaming or moving the cleanup directory is out of scope for this implementation.

## Task 1: Introduce explicit subscriptions workspace state

### Files

- Modify: `src/stores/ui-store.ts`
- Modify: `src/lib/actions.ts`
- Modify: `src/__tests__/stores/ui-store.test.ts`
- Modify: `src/__tests__/lib/actions.test.ts`

- [ ] **Step 1: Write failing store tests for workspace state**

Add tests that expect the UI store to expose a subscriptions workspace object instead of a lone boolean. Cover:

```ts
expect(useUiStore.getState().subscriptionsWorkspace).toBeNull();

useUiStore.getState().openSubscriptionsIndex();
expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
  kind: "index",
  cleanupContext: null,
});

useUiStore.getState().openFeedCleanup({
  reason: "stale_90d",
  returnTo: "index",
});
expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
  kind: "cleanup",
  cleanupContext: { reason: "stale_90d", returnTo: "index" },
});
```

- [ ] **Step 2: Run the focused store/action tests to verify they fail**

Run: `pnpm exec vitest run src/__tests__/stores/ui-store.test.ts src/__tests__/lib/actions.test.ts --reporter=verbose`

Expected: FAIL because `subscriptionsWorkspace`, `openSubscriptionsIndex()`, and the new action routing do not exist yet.

- [ ] **Step 3: Add the workspace state and actions**

Replace the boolean shape with an explicit workspace type in `src/stores/ui-store.ts`:

```ts
export type FeedCleanupContext = {
  reason: "review" | "stale_90d" | "no_unread" | "no_stars" | "broken_references";
  feedId?: string | null;
  returnTo: "index";
};

export type SubscriptionsWorkspace =
  | { kind: "index"; cleanupContext: null }
  | { kind: "cleanup"; cleanupContext: FeedCleanupContext | null };
```

Add actions:

```ts
openSubscriptionsIndex: () => set({ subscriptionsWorkspace: { kind: "index", cleanupContext: null }, focusedPane: "content" }),
openFeedCleanup: (context?: FeedCleanupContext) =>
  set({ subscriptionsWorkspace: { kind: "cleanup", cleanupContext: context ?? null }, focusedPane: "content" }),
closeSubscriptionsWorkspace: () => set({ subscriptionsWorkspace: null, focusedPane: "list" }),
```

Keep a temporary `feedCleanupOpen` derived selector only if a short migration shim is needed inside the implementation slice. Do not preserve it in the final store API.

- [ ] **Step 4: Add the new action id without breaking direct cleanup opens**

Update `src/lib/actions.ts` to include:

```ts
type AppAction =
  | "open-subscriptions-index"
  | "open-feed-cleanup"
  | "open-command-palette"
  | "open-settings";

case "open-subscriptions-index":
  useUiStore.getState().openSubscriptionsIndex();
  return;

case "open-feed-cleanup":
  useUiStore.getState().openFeedCleanup({ reason: "review", returnTo: "index" });
  return;
```

Keep `open-feed-cleanup` valid so debug scenarios and direct cleanup entry points still work.

- [ ] **Step 5: Re-run the store/action tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/stores/ui-store.test.ts src/__tests__/lib/actions.test.ts --reporter=verbose`

Expected: PASS

- [ ] **Step 6: Commit the workspace-state slice**

```bash
git add src/stores/ui-store.ts src/lib/actions.ts src/__tests__/stores/ui-store.test.ts src/__tests__/lib/actions.test.ts
git commit -m "feat(subscriptions): add workspace state"
```

## Task 2: Add pure helpers and i18n support for `購読一覧`

### Files

- Create: `src/lib/subscriptions-index.ts`
- Create: `src/locales/en/subscriptions.json`
- Create: `src/locales/ja/subscriptions.json`
- Modify: `src/lib/i18n.ts`
- Modify: `src/types/i18next.d.ts`
- Create: `src/__tests__/lib/subscriptions-index.test.ts`

- [ ] **Step 1: Write failing helper tests for summary and row status**

Add tests that cover:

```ts
expect(buildSubscriptionsIndexSummary({ feeds, candidates, integrityReport })).toEqual({
  totalCount: 4,
  reviewCount: 2,
  staleCount: 1,
  brokenReferenceCount: 3,
});

expect(resolveSubscriptionRowStatus(feed, candidateMap)).toEqual({
  tone: "medium",
  labelKey: "stale_90d",
});
```

Also cover the “no candidate = normal” case and the “candidate feed selected in right pane” metrics case.

- [ ] **Step 2: Run the helper test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/lib/subscriptions-index.test.ts --reporter=verbose`

Expected: FAIL because `@/lib/subscriptions-index` does not exist yet.

- [ ] **Step 3: Implement the pure helper module**

Create `src/lib/subscriptions-index.ts` with minimal pure functions:

```ts
export type SubscriptionRowStatus =
  | { tone: "neutral"; labelKey: "normal" }
  | { tone: "medium"; labelKey: "review" | "stale_90d" | "no_unread" | "no_stars" }
  | { tone: "high"; labelKey: "broken_references" };

export function buildSubscriptionsIndexSummary({
  feeds,
  candidates,
  integrityReport,
}: {
  feeds: FeedDto[];
  candidates: FeedCleanupCandidate[];
  integrityReport?: FeedIntegrityReportDto | null;
}): {
  totalCount: number;
  reviewCount: number;
  staleCount: number;
  brokenReferenceCount: number;
} {
  return {
    totalCount: feeds.length,
    reviewCount: candidates.filter((candidate) => summarizeCleanupCandidate(candidate).tone !== "low").length,
    staleCount: candidates.filter((candidate) => candidate.reasonKeys.includes("stale_90d")).length,
    brokenReferenceCount: integrityReport?.orphaned_article_count ?? 0,
  };
}

export function buildCleanupCandidateMap(
  candidates: FeedCleanupCandidate[],
): Map<string, FeedCleanupCandidate> {
  return new Map(candidates.map((candidate) => [candidate.feedId, candidate]));
}

export function resolveSubscriptionRowStatus({
  feed,
  candidate,
  integrityReport,
}: {
  feed: FeedDto;
  candidate?: FeedCleanupCandidate;
  integrityReport?: FeedIntegrityReportDto | null;
}): SubscriptionRowStatus {
  const hasBrokenReference =
    integrityReport?.orphaned_feeds?.some((issue) => issue.missing_feed_id === feed.id) ?? false;

  if (hasBrokenReference) {
    return { tone: "high", labelKey: "broken_references" };
  }
  if (!candidate) {
    return { tone: "neutral", labelKey: "normal" };
  }
  if (candidate.reasonKeys.includes("stale_90d")) {
    return { tone: "medium", labelKey: "stale_90d" };
  }
  return { tone: "medium", labelKey: "review" };
}

export function buildSubscriptionDetailMetrics({
  feed,
  articles,
}: {
  feed: FeedDto;
  articles: ArticleDto[];
}): {
  latestArticleAt: string | null;
  starredCount: number;
  previewArticles: ArticleDto[];
} {
  const feedArticles = articles.filter((article) => article.feed_id === feed.id);
  const previewArticles = [...feedArticles]
    .sort((left, right) => new Date(right.published_at).getTime() - new Date(left.published_at).getTime())
    .slice(0, 3);

  return {
    latestArticleAt: previewArticles[0]?.published_at ?? null,
    starredCount: feedArticles.filter((article) => article.is_starred).length,
    previewArticles,
  };
}
```

Reuse `buildFeedCleanupCandidates()` and `summarizeCleanupCandidate()`; do not duplicate cleanup heuristics.

- [ ] **Step 4: Add the new i18n namespace**

Create locale files with keys for:

```json
{
  "title": "購読一覧",
  "subtitle": "購読全体の状態を確認し、必要なものだけ整理します。",
  "summary_total": "総購読数",
  "summary_review": "要確認",
  "summary_stale": "90日停止",
  "summary_broken": "参照エラー",
  "open_cleanup_review": "要確認だけを見る",
  "open_cleanup_stale": "90日以上更新なしを整理する",
  "empty": "一致する購読はありません。",
  "detail_empty": "購読を選ぶと詳細が表示されます。"
}
```

Wire the namespace in `src/lib/i18n.ts` and `src/types/i18next.d.ts`.

- [ ] **Step 5: Re-run the helper test and a fast i18n type-check**

Run: `pnpm exec vitest run src/__tests__/lib/subscriptions-index.test.ts --reporter=verbose && pnpm exec tsc --noEmit`

Expected: PASS

- [ ] **Step 6: Commit the helper/i18n slice**

```bash
git add src/lib/subscriptions-index.ts src/locales/en/subscriptions.json src/locales/ja/subscriptions.json src/lib/i18n.ts src/types/i18next.d.ts src/__tests__/lib/subscriptions-index.test.ts
git commit -m "feat(subscriptions): add index view-model helpers"
```

## Task 3: Render the new `購読一覧` main-stage surface

### Files

- Create: `src/components/subscriptions-index/subscriptions-index-page.tsx`
- Create: `src/components/subscriptions-index/subscriptions-index-page-view.tsx`
- Create: `src/components/subscriptions-index/subscriptions-overview-summary.tsx`
- Create: `src/components/subscriptions-index/subscriptions-list-pane.tsx`
- Create: `src/components/subscriptions-index/subscription-detail-pane.tsx`
- Create: `src/components/subscriptions-index/subscriptions-index.types.ts`
- Create: `src/components/subscriptions-index/use-subscriptions-index-state.ts`
- Create: `src/__tests__/components/subscriptions-index-page.test.tsx`

- [ ] **Step 1: Write failing integration tests for summary, list, and right-pane detail**

Cover:

```tsx
render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

expect(await screen.findByRole("heading", { name: "購読一覧" })).toBeInTheDocument();
expect(screen.getByText("総購読数")).toBeInTheDocument();
expect(screen.getByText("要確認")).toBeInTheDocument();

await user.click(screen.getByRole("button", { name: "Example Feed" }));
expect(screen.getByText("この購読の状態")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "購読の整理で開く" })).toBeInTheDocument();
```

Add one test that verifies the empty detail pane copy appears before a row is selected.

- [ ] **Step 2: Run the focused page test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/components/subscriptions-index-page.test.tsx --reporter=verbose`

Expected: FAIL because the page and its child components do not exist yet.

- [ ] **Step 3: Implement page state and view composition**

Create a minimal reducer in `use-subscriptions-index-state.ts`:

```ts
type SubscriptionsIndexState = {
  selectedFeedId: string | null;
  searchQuery: string;
  showCandidatesOnly: boolean;
  sortKey: "title" | "updated_at" | "unread_count";
};
```

Then build `SubscriptionsIndexPage` to:

- read `selectedAccountId`
- load `feeds`, `folders`, `accountArticles`, and `integrityReport`
- derive cleanup candidates
- build summary and row status via `src/lib/subscriptions-index.ts`
- pass a selected feed into the right pane

- [ ] **Step 4: Implement the balanced list and right pane**

The list should render rows with:

```tsx
<button type="button" onClick={() => onSelectFeed(feed.id)}>
  <span>{feed.title}</span>
  <span>{folderName ?? "—"}</span>
  <span>{feed.unread_count}</span>
  <span>{updatedLabel}</span>
  <StatusChip tone={status.tone}>{t(`subscriptions:status.${status.labelKey}`)}</StatusChip>
</button>
```

The right pane should render:

```tsx
<section>
  <h3>{selectedFeed.title}</h3>
  <dl>
    <DetailRow label={t("folder")} value={folderName ?? "—"} />
    <DetailRow label={t("latest_article")} value={latestArticleLabel} />
    <DetailRow label={t("unread_count")} value={selectedFeed.unread_count} />
    <DetailRow label={t("starred_count")} value={metrics.starredCount} />
  </dl>
  <Button onClick={() => openFeedCleanup({ reason: "review", feedId: selectedFeed.id, returnTo: "index" })}>
    {t("open_cleanup_for_feed")}
  </Button>
</section>
```

- [ ] **Step 5: Re-run the subscriptions index page test**

Run: `pnpm exec vitest run src/__tests__/components/subscriptions-index-page.test.tsx --reporter=verbose`

Expected: PASS

- [ ] **Step 6: Commit the new main-stage surface**

```bash
git add src/components/subscriptions-index src/__tests__/components/subscriptions-index-page.test.tsx
git commit -m "feat(subscriptions): add subscriptions index surface"
```

## Task 4: Wire the new surface into the main stage and primary entry points

### Files

- Modify: `src/components/reader/article-view.tsx`
- Modify: `src/components/reader/use-article-view-selection.ts`
- Modify: `src/components/app-layout.tsx`
- Modify: `src/components/reader/use-command-palette-actions.ts`
- Modify: `src/locales/en/sidebar.json`
- Modify: `src/locales/ja/sidebar.json`
- Modify: `src/__tests__/components/app-layout.test.tsx`
- Modify: `src/__tests__/components/article-view.test.tsx`
- Modify: `src/__tests__/components/command-palette.test.tsx`
- Modify: `src/__tests__/components/sidebar.test.tsx`

- [ ] **Step 1: Write failing routing tests for `subscriptions-index`**

Add assertions that:

```tsx
useUiStore.setState({
  subscriptionsWorkspace: { kind: "index", cleanupContext: null },
});

expect(await screen.findByRole("heading", { name: "購読一覧" })).toBeInTheDocument();
expect(screen.queryByRole("heading", { name: "購読の整理" })).not.toBeInTheDocument();
```

Also update sidebar/command-palette tests to expect the primary entry label to map to `open-subscriptions-index`.

- [ ] **Step 2: Run the focused routing/entry tests to verify they fail**

Run: `pnpm exec vitest run src/__tests__/components/app-layout.test.tsx src/__tests__/components/article-view.test.tsx src/__tests__/components/command-palette.test.tsx src/__tests__/components/sidebar.test.tsx --reporter=verbose`

Expected: FAIL because the article view cannot render the new workspace kind and entry points still open cleanup directly.

- [ ] **Step 3: Add `subscriptions-index` selection handling**

Update `useArticleViewSelection()`:

```ts
export type ArticleViewSelectionState =
  | { kind: "subscriptions-index" }
  | { kind: "feed-cleanup" }
  | { kind: "browser-only"; browserUrl: string }
  | { kind: "empty" }
  | { kind: "not-found" }
  | { kind: "article"; article: ArticleDto; feed?: FeedDto };

if (subscriptionsWorkspace?.kind === "index") {
  return { kind: "subscriptions-index" };
}
if (subscriptionsWorkspace?.kind === "cleanup") {
  return { kind: "feed-cleanup" };
}
```

Update `article-view.tsx` to lazy-load `SubscriptionsIndexPage` beside `FeedCleanupPage`.

- [ ] **Step 4: Point the primary management entries at the new page**

Update the command palette and sidebar label/copy so the primary button opens the index:

```ts
{
  id: "open-subscriptions-index",
  label: tSidebar("subscriptions_index"),
  keywords: ["subscriptions", "feeds", "manage"],
}
```

Add `subscriptions_index` locale keys and keep the existing cleanup wording for the direct cleanup/debug-only paths.

- [ ] **Step 5: Re-run the routing/entry tests**

Run: `pnpm exec vitest run src/__tests__/components/app-layout.test.tsx src/__tests__/components/article-view.test.tsx src/__tests__/components/command-palette.test.tsx src/__tests__/components/sidebar.test.tsx --reporter=verbose`

Expected: PASS

- [ ] **Step 6: Commit the main-stage wiring**

```bash
git add src/components/reader/article-view.tsx src/components/reader/use-article-view-selection.ts src/components/app-layout.tsx src/components/reader/use-command-palette-actions.ts src/locales/en/sidebar.json src/locales/ja/sidebar.json src/__tests__/components/app-layout.test.tsx src/__tests__/components/article-view.test.tsx src/__tests__/components/command-palette.test.tsx src/__tests__/components/sidebar.test.tsx
git commit -m "feat(subscriptions): route primary entry to index"
```

## Task 5: Add context-aware hand-off from `購読一覧` into `購読の整理`

### Files

- Modify: `src/components/feed-cleanup/feed-cleanup-page.tsx`
- Modify: `src/components/feed-cleanup/use-feed-cleanup-page-state.ts`
- Modify: `src/components/feed-cleanup/feed-cleanup-page-view.tsx`
- Modify: `src/components/feed-cleanup/feed-cleanup.types.ts`
- Modify: `src/__tests__/components/feed-cleanup-page.test.tsx`
- Modify: `src/__tests__/components/subscriptions-index-page.test.tsx`

- [ ] **Step 1: Write failing tests for context hand-off and return**

Add one integration test from the index page:

```tsx
await user.click(screen.getByRole("button", { name: "90日以上更新なしを整理する" }));
expect(await screen.findByRole("heading", { name: "購読の整理" })).toBeInTheDocument();
expect(screen.getByText("90日以上更新なし")).toBeInTheDocument();
```

Add one cleanup-page test that expects a back affordance:

```tsx
expect(screen.getByRole("button", { name: "購読一覧に戻る" })).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused hand-off tests to verify they fail**

Run: `pnpm exec vitest run src/__tests__/components/subscriptions-index-page.test.tsx src/__tests__/components/feed-cleanup-page.test.tsx --reporter=verbose --testNamePattern="整理する|戻る|stale|review"`

Expected: FAIL because cleanup cannot consume incoming context yet.

- [ ] **Step 3: Thread cleanup context into page state**

Extend cleanup input types:

```ts
export type FeedCleanupPageInput = {
  subscriptionsWorkspace: SubscriptionsWorkspace | null;
  devIntent: string | null;
  feeds: FeedDto[];
  folders: FolderDto[];
  accountArticles: ArticleDto[];
  integrityReport?: FeedIntegrityReportDto | null;
};
```

When `subscriptionsWorkspace.kind === "cleanup"`, seed:

```ts
if (context?.reason === "stale_90d") {
  dispatch({ type: "toggle-filter", key: "stale_90d" });
}
if (context?.reason === "broken_references") {
  dispatch({ type: "set-queue-mode", mode: "integrity" });
}
```

Use `feedId` to pre-select a single feed when direct hand-off starts from the right detail pane.

- [ ] **Step 4: Add a return affordance without duplicating cleanup actions**

In `feed-cleanup-page-view.tsx`, add a top-level secondary action:

```tsx
<Button variant="ghost" onClick={openSubscriptionsIndex}>
  {tSubscriptions("back_to_index")}
</Button>
```

This should call `openSubscriptionsIndex()` instead of closing to the generic reader empty state.

- [ ] **Step 5: Re-run the focused hand-off tests**

Run: `pnpm exec vitest run src/__tests__/components/subscriptions-index-page.test.tsx src/__tests__/components/feed-cleanup-page.test.tsx --reporter=verbose --testNamePattern="整理する|戻る|stale|review"`

Expected: PASS

- [ ] **Step 6: Commit the hand-off behavior**

```bash
git add src/components/feed-cleanup/feed-cleanup-page.tsx src/components/feed-cleanup/use-feed-cleanup-page-state.ts src/components/feed-cleanup/feed-cleanup-page-view.tsx src/components/feed-cleanup/feed-cleanup.types.ts src/__tests__/components/feed-cleanup-page.test.tsx src/__tests__/components/subscriptions-index-page.test.tsx
git commit -m "feat(subscriptions): hand off from index to cleanup"
```

## Task 6: Final verification and documentation sync

### Files

- Modify: `docs/superpowers/plans/2026-04-14-subscriptions-index-split.md`
- Verify only: `docs/superpowers/specs/2026-04-14-subscriptions-index-split-design.md`

- [ ] **Step 1: Run the targeted subscriptions workspace test set**

Run:

```bash
pnpm exec vitest run \
  src/__tests__/stores/ui-store.test.ts \
  src/__tests__/lib/actions.test.ts \
  src/__tests__/lib/subscriptions-index.test.ts \
  src/__tests__/components/subscriptions-index-page.test.tsx \
  src/__tests__/components/feed-cleanup-page.test.tsx \
  src/__tests__/components/app-layout.test.tsx \
  src/__tests__/components/article-view.test.tsx \
  src/__tests__/components/command-palette.test.tsx \
  src/__tests__/components/sidebar.test.tsx \
  --reporter=verbose
```

Expected: PASS

- [ ] **Step 2: Run TypeScript and formatter/lint validation**

Run:

```bash
pnpm exec tsc --noEmit
pnpm exec biome check \
  src/stores/ui-store.ts \
  src/lib/actions.ts \
  src/lib/subscriptions-index.ts \
  src/components/subscriptions-index \
  src/components/feed-cleanup/feed-cleanup-page.tsx \
  src/components/feed-cleanup/use-feed-cleanup-page-state.ts \
  src/components/feed-cleanup/feed-cleanup-page-view.tsx \
  src/components/feed-cleanup/feed-cleanup.types.ts \
  src/components/reader/article-view.tsx \
  src/components/reader/use-article-view-selection.ts \
  src/components/app-layout.tsx \
  src/components/reader/use-command-palette-actions.ts \
  src/locales/en/subscriptions.json \
  src/locales/ja/subscriptions.json \
  src/locales/en/sidebar.json \
  src/locales/ja/sidebar.json \
  src/lib/i18n.ts \
  src/types/i18next.d.ts \
  src/__tests__/lib/subscriptions-index.test.ts \
  src/__tests__/components/subscriptions-index-page.test.tsx
```

Expected: PASS

- [ ] **Step 3: Run the repository quality gate required by this project**

Run: `mise run check`

Expected: PASS

- [ ] **Step 4: Commit the finished implementation**

```bash
git add src/stores/ui-store.ts src/lib/actions.ts src/lib/subscriptions-index.ts src/components/subscriptions-index src/components/feed-cleanup/feed-cleanup-page.tsx src/components/feed-cleanup/use-feed-cleanup-page-state.ts src/components/feed-cleanup/feed-cleanup-page-view.tsx src/components/feed-cleanup/feed-cleanup.types.ts src/components/reader/article-view.tsx src/components/reader/use-article-view-selection.ts src/components/app-layout.tsx src/components/reader/use-command-palette-actions.ts src/locales/en/subscriptions.json src/locales/ja/subscriptions.json src/locales/en/sidebar.json src/locales/ja/sidebar.json src/lib/i18n.ts src/types/i18next.d.ts src/__tests__/stores/ui-store.test.ts src/__tests__/lib/actions.test.ts src/__tests__/lib/subscriptions-index.test.ts src/__tests__/components/subscriptions-index-page.test.tsx src/__tests__/components/feed-cleanup-page.test.tsx src/__tests__/components/app-layout.test.tsx src/__tests__/components/article-view.test.tsx src/__tests__/components/command-palette.test.tsx src/__tests__/components/sidebar.test.tsx docs/superpowers/specs/2026-04-14-subscriptions-index-split-design.md docs/superpowers/plans/2026-04-14-subscriptions-index-split.md
git commit -m "feat(subscriptions): split index and cleanup workspaces"
```
