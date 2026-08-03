# Passive Article Preview Read Intent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep automatically displayed articles unread until the user explicitly selects or navigates to an article, then apply the existing `after_reading` preference.

**Architecture:** Add an article engagement value to the Zustand UI store and make `selectArticle` default to explicit `reading` engagement. Automatic landing paths opt into `preview`, while `useArticleAutoMark` starts its existing mutation/timer flow only for `reading`.

**Tech Stack:** React 19, TypeScript 6, Zustand, TanStack React Query, Vitest, Testing Library

## Global Constraints

- Preserve full article rendering, selected-row styling, browser preview, manual read/unread toggles, and recently-read behavior.
- Do not add settings, visible UI, dependencies, storage keys, backend changes, or persistence for engagement state.
- Automatic landing from startup, smart views, feeds, folders, tags, and feed landing must use `preview`.
- Article-row click, keyboard content entry, previous/next navigation, and direct article command-palette selection must use `reading`.
- Body click and body scroll must not promote `preview` to `reading`.
- Existing `after_reading` values and timing remain exact: `never`, `immediately`, `after_0_3s`, `after_0_5s`, and `after_1s`.
- Do not introduce `any`, type assertions, inline lint disables, unrelated refactors, or new files outside this plan.
- The agmsg implement Worker must not commit; commit steps are orchestrator checkpoints after diff review.

---

## File Structure

- `src/stores/ui-store.types.ts`: owns the `ArticleEngagement` union, state field, and `selectArticle` option contract.
- `src/stores/ui-store.ts`: initializes engagement and updates it on every article selection.
- `src/components/reader/article-view.tsx`: marks selection-derived first-article landing as `preview`.
- `src/hooks/use-feed-landing.ts`: marks fetched feed landing articles as `preview`.
- `src/components/reader/hooks/article/use-article-view-ui-state.ts`: exposes engagement to the article pane controller.
- `src/components/reader/hooks/article/use-article-pane-controller.tsx`: passes engagement into automatic read handling.
- `src/components/reader/hooks/article/use-article-auto-mark.ts`: suppresses the timer and mutation while engagement is `preview`.
- `src/__tests__/stores/ui-store.node.test.ts`: proves default `reading`, explicit `preview`, and same-article promotion.
- `src/__tests__/hooks/use-feed-landing.node.test.tsx`: proves feed landing is passive.
- `src/__tests__/components/article-view.test.tsx`: proves automatic view landing is passive and the existing timer starts only after promotion.

### Task 1: Add the article engagement state contract

**Files:**

- Modify: `src/stores/ui-store.types.ts`
- Modify: `src/stores/ui-store.ts`
- Test: `src/__tests__/stores/ui-store.node.test.ts`

**Interfaces:**

- Consumes: existing `UiState`, `UiActions`, and `selectArticle` Zustand contracts.
- Produces: `export type ArticleEngagement = "preview" | "reading"`, `UiState.articleEngagement`, and `selectArticle(id, { engagement?, navigationDirection? })`.
- Default: omitted `engagement` means `reading`, so existing direct-selection call sites remain explicit reading actions.

- [ ] **Step 1: Write failing store tests for preview and promotion**

Add these cases next to `selectArticle sets reader mode` in `src/__tests__/stores/ui-store.node.test.ts`:

```ts
it("tracks automatic article landing as preview", () => {
  useUiStore.getState().selectArticle("a1", { engagement: "preview" });

  expect(useUiStore.getState().selectedArticleId).toBe("a1");
  expect(useUiStore.getState().articleEngagement).toBe("preview");
});

it("defaults direct selection to reading and promotes the same previewed article", () => {
  useUiStore.getState().selectArticle("a1", { engagement: "preview" });
  useUiStore.getState().selectArticle("a1");

  expect(useUiStore.getState().selectedArticleId).toBe("a1");
  expect(useUiStore.getState().articleEngagement).toBe("reading");
});
```

- [ ] **Step 2: Run the focused store test and verify failure**

Run:

```bash
pnpm exec vitest run --project node src/__tests__/stores/ui-store.node.test.ts
```

Expected: FAIL because `selectArticle` does not accept `engagement` and `articleEngagement` does not exist.

- [ ] **Step 3: Define the engagement type and extend the selection action**

In `src/stores/ui-store.types.ts`, add the exported type near `UiStoreReaderSelection`:

```ts
export type ArticleEngagement = "preview" | "reading";
```

Add the state field next to `selectedArticleId`:

```ts
selectedArticleId: string | null;
articleEngagement: ArticleEngagement;
```

Add it to `UiStoreReaderState`, then extend the action contract without changing the existing navigation option:

```ts
selectArticle: (
  id: string,
  options?: {
    engagement?: ArticleEngagement;
    navigationDirection?: ArticleNavigationDirection | null;
  },
) => void;
```

- [ ] **Step 4: Initialize and update engagement in the store**

In `src/stores/ui-store.ts`, re-export `ArticleEngagement` with the other type exports.

Initialize the field to `reading`; it is inert while `selectedArticleId` is `null` and preserves direct `ArticlePane` test semantics:

```ts
selectedArticleId: null,
articleEngagement: "reading",
```

Update the existing `selectArticle` state result:

```ts
return {
  accountPaneOpen: false,
  selectedArticleId: id,
  articleEngagement: options?.engagement ?? "reading",
  contentMode: nextContentMode,
  focusedPane: "content",
  articleNavigationDirection: options?.navigationDirection ?? null,
  retainedArticleIds: getRetainedArticleIdsAfterSelectingArticle({
    articleId: id,
    viewMode: state.viewMode,
    currentRetainedArticleIds: state.retainedArticleIds,
  }),
};
```

Do not change `clearArticle` or the scope-reset helpers: engagement has no meaning while no article is selected, and every subsequent `selectArticle` call overwrites it.

- [ ] **Step 5: Run the focused store test and verify success**

Run:

```bash
pnpm exec vitest run --project node src/__tests__/stores/ui-store.node.test.ts
```

Expected: PASS with both new engagement tests and all existing store tests green.

- [ ] **Step 6: Orchestrator commit checkpoint**

The agmsg Worker reports completion without committing. After orchestrator review, the intended checkpoint command is:

```bash
git add src/stores/ui-store.types.ts src/stores/ui-store.ts src/__tests__/stores/ui-store.node.test.ts
git commit -m "feat(reader): track article reading engagement"
```

### Task 2: Make automatic landing passive and gate automatic read handling

**Files:**

- Modify: `src/components/reader/article-view.tsx`
- Modify: `src/hooks/use-feed-landing.ts`
- Modify: `src/components/reader/hooks/article/use-article-view-ui-state.ts`
- Modify: `src/components/reader/hooks/article/use-article-pane-controller.tsx`
- Modify: `src/components/reader/hooks/article/use-article-auto-mark.ts`
- Test: `src/__tests__/hooks/use-feed-landing.node.test.tsx`
- Test: `src/__tests__/components/article-view.test.tsx`

**Interfaces:**

- Consumes: `ArticleEngagement` and the extended `selectArticle` contract from Task 1.
- Produces: automatic landing calls with `{ engagement: "preview" }` and `useArticleAutoMark({ articleEngagement })` behavior that schedules only for `reading`.
- Preserves: existing timer generation guards, mutation callbacks, retained-article rollback, toast errors, manual-unread suppression, and direct article selection call sites.

- [ ] **Step 1: Add a failing assertion for passive feed landing**

In `src/__tests__/hooks/use-feed-landing.node.test.tsx`, extend `opens browser mode for preview-enabled feeds with a landing URL`:

```ts
await waitFor(() => {
  expect(useUiStore.getState().selectedArticleId).toBe("art-1");
  expect(useUiStore.getState().articleEngagement).toBe("preview");
  expect(useUiStore.getState().contentMode).toBe("browser");
  expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
});
```

- [ ] **Step 2: Add failing component coverage for automatic landing and delayed promotion**

Add `act` to the Testing Library import in `src/__tests__/components/article-view.test.tsx`:

```ts
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
```

Extend the existing `lands on the first unread smart-view article when unread is selected without an article` case with:

```ts
expect(useUiStore.getState().articleEngagement).toBe("preview");
```

Add this test next to the current delayed auto-mark cases:

```ts
it("starts the delayed auto-mark timer only after a previewed article is explicitly selected", async () => {
  vi.useFakeTimers();

  try {
    const calls: MockTauriCommandCall[] = [];
    setupAutoMarkMocks(calls);
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selectedArticleId: "art-1",
      articleEngagement: "preview",
      contentMode: "reader",
    });
    usePreferencesStore.setState({
      prefs: { after_reading: "after_0_3s" },
      loaded: true,
    });

    render(<ArticlePane {...requirePrimaryArticlePaneProps()} />, {
      wrapper: createWrapper(),
    });

    await vi.advanceTimersByTimeAsync(300);
    expect(calls).not.toContainEqual(autoMarkArticleReadCall);

    act(() => {
      useUiStore.getState().selectArticle("art-1");
    });
    expect(useUiStore.getState().articleEngagement).toBe("reading");

    await vi.advanceTimersByTimeAsync(299);
    expect(calls).not.toContainEqual(autoMarkArticleReadCall);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();
    await Promise.resolve();

    expect(calls.filter((call) => call.cmd === "mark_article_read")).toHaveLength(1);
  } finally {
    vi.useRealTimers();
  }
});
```

- [ ] **Step 3: Run focused tests and verify the new assertions fail**

Run:

```bash
pnpm exec vitest run --project node src/__tests__/hooks/use-feed-landing.node.test.tsx
pnpm exec vitest run --project jsdom src/__tests__/components/article-view.test.tsx
```

Expected: feed landing and smart-view landing report `reading`, and the previewed `ArticlePane` still emits `mark_article_read` after 300 ms.

- [ ] **Step 4: Mark automatic selection paths as preview**

In `src/components/reader/article-view.tsx`, change only the automatic landing effect:

```ts
selectArticle(landingArticleId, { engagement: "preview" });
```

In `src/hooks/use-feed-landing.ts`, change only the fetched first-article landing call:

```ts
store.selectArticle(landingArticle.id, { engagement: "preview" });
```

Do not change these direct reading paths; their omitted option must continue to resolve to `reading`:

- article list row selection
- article list keyboard content entry
- previous/next navigation
- direct article command-palette selection
- development scenarios that directly choose an article

- [ ] **Step 5: Expose engagement to the automatic read hook**

In `src/components/reader/hooks/article/use-article-view-ui-state.ts`, include the store field in the existing slice:

```ts
articleEngagement: s.articleEngagement,
```

In `src/components/reader/hooks/article/use-article-pane-controller.tsx`, destructure it from `useArticleViewUiState()` and pass it to `useArticleAutoMark`:

```ts
useArticleAutoMark({
  articleId: article.id,
  isRead: article.is_read,
  articleEngagement,
  afterReading,
  viewMode,
  retainArticle,
  addRecentlyRead,
  setRead,
  showToast,
});
```

- [ ] **Step 6: Gate automatic read scheduling on reading engagement**

In `src/components/reader/hooks/article/use-article-auto-mark.ts`, import the type:

```ts
import type { ArticleEngagement } from "@/stores/ui-store.types";
```

Extend `UseArticleAutoMarkParams`:

```ts
articleEngagement: ArticleEngagement;
```

Destructure it in `useArticleAutoMark`, then add it to the unread scheduling condition:

```ts
} else if (
  articleEngagement === "reading" &&
  afterReading !== "never" &&
  manualUnreadAutoMarkSuppressionKey !== autoMarkOwnerKey &&
  autoMarkedOwnerKeyRef.current !== autoMarkOwnerKey
) {
```

Add `articleEngagement` to the effect dependency list. Do not alter timeout durations, generation checks, mutation callbacks, or cleanup.

- [ ] **Step 7: Run focused tests and verify success**

Run:

```bash
pnpm exec vitest run --project node src/__tests__/stores/ui-store.node.test.ts src/__tests__/hooks/use-feed-landing.node.test.tsx
pnpm exec vitest run --project jsdom src/__tests__/components/article-view.test.tsx
```

Expected: PASS. The new preview assertions are green, the promotion test emits exactly one read mutation after a fresh 300 ms delay, and existing auto-mark/manual-unread cases remain green.

- [ ] **Step 8: Run repository verification**

Run:

```bash
mise run test:unit:dom
mise run check
git diff --check
```

Expected: all commands exit 0. `mise run check` may format touched TypeScript files; inspect any resulting diff before reporting.

- [ ] **Step 9: Review the complete diff against the design**

Confirm all of the following from the actual diff:

- Only the files listed in this plan changed.
- Exactly two automatic `selectArticle` paths specify `preview`.
- Existing direct article-selection paths still default to `reading`.
- No timer duration, backend mutation, cache invalidation, visible copy, or persistence contract changed.
- No `any`, type assertion, inline lint disable, unrelated refactor, or bonus test was added.

- [ ] **Step 10: Orchestrator commit checkpoint**

The agmsg Worker reports completion without committing. After orchestrator review and verification, the intended checkpoint command is:

```bash
git add src/stores/ui-store.types.ts src/stores/ui-store.ts \
  src/components/reader/article-view.tsx \
  src/hooks/use-feed-landing.ts \
  src/components/reader/hooks/article/use-article-view-ui-state.ts \
  src/components/reader/hooks/article/use-article-pane-controller.tsx \
  src/components/reader/hooks/article/use-article-auto-mark.ts \
  src/__tests__/stores/ui-store.node.test.ts \
  src/__tests__/hooks/use-feed-landing.node.test.tsx \
  src/__tests__/components/article-view.test.tsx
git add -f docs/superpowers/plans/2026-08-03-passive-article-preview-read-intent.md
git commit -m "fix(reader): keep automatic article previews unread"
```
