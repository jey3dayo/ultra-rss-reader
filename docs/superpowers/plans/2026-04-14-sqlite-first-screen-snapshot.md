# SQLite-First Screen Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: SQLite にある最後の成功状態を最初に表示し、再取得中も既存表示を維持したまま、画面単位で整合が取れたタイミングだけ UI を更新できるようにする。

Architecture: React Query の生結果を直接描画するのをやめ、`useScreenSnapshot` と画面別 snapshot hook を挟む。共通 hook は「最後に表示してよい snapshot を保持する」だけに留め、主データと補助データの整合条件は sidebar / article list / settings ごとに決める。

Tech Stack: React 19, TypeScript, Zustand, TanStack Query, Vitest, Tauri IPC (`safeInvoke`)

---

## File Structure

- Create: `src/hooks/use-screen-snapshot.ts`
  - 画面単位 snapshot を保持する薄い共通 hook
- Create: `src/__tests__/hooks/use-screen-snapshot.test.tsx`
  - snapshot 保持・再取得・失敗時維持の共通テスト
- Modify: `src/components/reader/use-sidebar-sources.ts`
  - sidebar 用 snapshot の採用と loading / empty 判定の分離
- Modify: `src/components/reader/sidebar-sources.types.ts`
  - sidebar snapshot に必要な型を追加
- Modify: `src/components/reader/use-sidebar-content-sections-props.ts`
  - loading 表示用 props 追加
- Modify: `src/components/reader/sidebar-content-sections.tsx`
  - feed tree が未確定のときは empty CTA ではなく loading を出す
- Modify: `src/components/reader/feed-tree.types.ts`
  - loading 用 empty state variant を追加
- Modify: `src/components/reader/feed-tree-empty-state.tsx`
  - loading variant を描画できるようにする
- Modify: `src/components/reader/use-article-list-sources.ts`
  - article list 主データを snapshot 経由にする
- Modify: `src/components/reader/article-list.types.ts`
  - article list snapshot 用の型を追加
- Modify: `src/components/settings/settings-modal.tsx`
  - settings / accounts の初期描画を snapshot で安定化する
- Modify: `src/components/settings/use-settings-modal-view-props.tsx`
  - settings の loading / snapshot 表示を扱えるようにする
- Test: `src/__tests__/components/sidebar.test.tsx`
- Test: `src/__tests__/components/article-list.test.tsx`
- Test: `src/__tests__/components/settings-modal.test.tsx`

### Task 1: 共通 `useScreenSnapshot` hook を追加する

### Files:

- Create: `src/hooks/use-screen-snapshot.ts`
- Test: `src/__tests__/hooks/use-screen-snapshot.test.tsx`

- [ ] **Step 1: 共通 hook の failing test を書く**

```tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useScreenSnapshot } from "@/hooks/use-screen-snapshot";

describe("useScreenSnapshot", () => {
  it("keeps the previous snapshot while the next fetch is pending", () => {
    const { result, rerender } = renderHook(
      ({ candidate, canAdopt }) => useScreenSnapshot(candidate, canAdopt),
      {
        initialProps: {
          candidate: null as { value: string } | null,
          canAdopt: false,
        },
      },
    );

    expect(result.current.snapshot).toBeNull();
    expect(result.current.hasResolvedSnapshot).toBe(false);

    rerender({
      candidate: { value: "sqlite" },
      canAdopt: true,
    });

    expect(result.current.snapshot).toEqual({ value: "sqlite" });
    expect(result.current.hasResolvedSnapshot).toBe(true);

    rerender({
      candidate: null,
      canAdopt: false,
    });

    expect(result.current.snapshot).toEqual({ value: "sqlite" });
    expect(result.current.hasResolvedSnapshot).toBe(true);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm exec vitest run src/__tests__/hooks/use-screen-snapshot.test.tsx`
Expected: FAIL with `Cannot find module '@/hooks/use-screen-snapshot'`

- [ ] **Step 3: 最小実装を書く**

```ts
import { useEffect, useRef, useState } from "react";

export function useScreenSnapshot<T>(candidate: T | null, canAdopt: boolean) {
  const [snapshot, setSnapshot] = useState<T | null>(null);
  const hasResolvedSnapshot = snapshot !== null;
  const adoptedOnceRef = useRef(false);

  useEffect(() => {
    if (!canAdopt || candidate === null) {
      return;
    }

    setSnapshot(candidate);
    adoptedOnceRef.current = true;
  }, [candidate, canAdopt]);

  return {
    snapshot,
    hasResolvedSnapshot,
    hasAdoptedSnapshot: adoptedOnceRef.current,
  };
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `pnpm exec vitest run src/__tests__/hooks/use-screen-snapshot.test.tsx`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/hooks/use-screen-snapshot.ts src/__tests__/hooks/use-screen-snapshot.test.tsx
git commit -m "feat(reader): add screen snapshot hook"
```

### Task 2: sidebar を SQLite-first snapshot 表示へ切り替える

### Files:

- Modify: `src/components/reader/use-sidebar-sources.ts`
- Modify: `src/components/reader/sidebar-sources.types.ts`
- Modify: `src/components/reader/use-sidebar-content-sections-props.ts`
- Modify: `src/components/reader/sidebar-content-sections.tsx`
- Modify: `src/components/reader/feed-tree.types.ts`
- Modify: `src/components/reader/feed-tree-empty-state.tsx`
- Test: `src/__tests__/components/sidebar.test.tsx`

- [ ] **Step 1: sidebar の failing test を追加する**

```tsx
it("does not show the add-feed empty state while feeds and folders are still loading", async () => {
  setupTauriMocks((cmd, args) => {
    switch (cmd) {
      case "list_accounts":
        return sampleAccounts;
      case "list_feeds":
      case "list_folders":
        return new Promise(() => {});
      case "list_account_articles":
        return [];
      case "list_tags":
        return [];
      case "get_tag_article_counts":
        return {};
      default:
        return null;
    }
  });

  render(<Sidebar />, { wrapper: createWrapper() });

  expect(screen.queryByText("+ でフィードを追加")).not.toBeInTheDocument();
  expect(screen.getByText(/Loading/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm exec vitest run src/__tests__/components/sidebar.test.tsx -t "does not show the add-feed empty state while feeds and folders are still loading"`
Expected: FAIL because the current implementation renders the empty CTA

- [ ] **Step 3: sidebar snapshot の最小実装を書く**

```ts
// src/components/reader/use-sidebar-sources.ts
const canAdoptSidebarSnapshot = Boolean(selectedAccountId) && feeds !== undefined && folders !== undefined;
const sidebarSnapshotCandidate =
  selectedAccountId && feeds && folders
    ? {
        selectedAccountId,
        feeds,
        folders,
        tags: tags ?? [],
        tagArticleCounts: tagArticleCounts ?? {},
        accountArticles: accountArticles ?? [],
      }
    : null;

const { snapshot, hasResolvedSnapshot } = useScreenSnapshot(sidebarSnapshotCandidate, canAdoptSidebarSnapshot);

const effectiveFeeds = snapshot?.feeds ?? [];
const effectiveFolders = snapshot?.folders ?? [];
const isSidebarLoading = !hasResolvedSnapshot && selectedAccountId !== null;
```

```ts
// src/components/reader/feed-tree.types.ts
export type FeedTreeEmptyState =
  | { kind: "message"; message: string }
  | { kind: "action"; label: string; onAction: () => void }
  | { kind: "loading"; message: string };
```

```tsx
// src/components/reader/feed-tree-empty-state.tsx
if (props.kind === "loading") {
  return <div className="px-2 py-4 text-center text-sm text-muted-foreground">{props.message}</div>;
}
```

```tsx
// src/components/reader/sidebar-content-sections.tsx
const feedEmptyState = isFeedTreeLoading
  ? { kind: "loading" as const, message: loadingSubscriptionsLabel }
  : selectedAccountId
    ? { kind: "message" as const, message: pressPlusToAddFeedLabel }
    : { kind: "action" as const, label: addAccountToStartLabel, onAction: onOpenAccountSettings };
```

- [ ] **Step 4: sidebar テストを実行して成功を確認する**

Run: `pnpm exec vitest run src/__tests__/components/sidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/reader/use-sidebar-sources.ts src/components/reader/sidebar-sources.types.ts src/components/reader/use-sidebar-content-sections-props.ts src/components/reader/sidebar-content-sections.tsx src/components/reader/feed-tree.types.ts src/components/reader/feed-tree-empty-state.tsx src/__tests__/components/sidebar.test.tsx
git commit -m "fix(sidebar): keep sqlite-backed subscriptions visible while revalidating"
```

### Task 3: article list を主データ snapshot で安定化する

### Files:

- Modify: `src/components/reader/use-article-list-sources.ts`
- Modify: `src/components/reader/article-list.types.ts`
- Modify: `src/components/reader/use-article-list-runtime.ts`
- Test: `src/__tests__/components/article-list.test.tsx`

- [ ] **Step 1: article list の failing test を追加する**

```tsx
it("keeps previously rendered account articles visible while the next account refresh is pending", async () => {
  let releaseNextFetch: (() => void) | null = null;

  setupTauriMocks((cmd, args) => {
    switch (cmd) {
      case "list_accounts":
        return sampleAccounts;
      case "list_feeds":
        return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
      case "list_account_articles":
        if (args.accountId === "acc-1") {
          return sampleArticles;
        }
        return new Promise((resolve) => {
          releaseNextFetch = () => resolve([]);
        });
      default:
        return [];
    }
  });

  useUiStore.setState({
    ...useUiStore.getInitialState(),
    selectedAccountId: "acc-1",
    selection: { type: "smart", kind: "unread" },
    viewMode: "unread",
  });

  render(<ArticleList />, { wrapper: createWrapper() });
  expect(await screen.findByText(sampleArticles[0].title)).toBeInTheDocument();

  act(() => {
    useUiStore.getState().selectAccount("acc-2");
  });

  expect(screen.getByText(sampleArticles[0].title)).toBeInTheDocument();
  releaseNextFetch?.();
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm exec vitest run src/__tests__/components/article-list.test.tsx -t "keeps previously rendered account articles visible while the next account refresh is pending"`
Expected: FAIL because the list clears during pending

- [ ] **Step 3: article list snapshot の最小実装を書く**

```ts
// src/components/reader/use-article-list-sources.ts
const primaryArticlesCandidate =
  feedId !== null
    ? articles ?? null
    : tagId !== null
      ? tagArticles ?? null
      : accountArticles ?? null;

const canAdoptArticleSnapshot = primaryArticlesCandidate !== null;
const { snapshot: articleSnapshot, hasResolvedSnapshot } = useScreenSnapshot(
  {
    feeds: feeds ?? [],
    articles: primaryArticlesCandidate ?? [],
  },
  canAdoptArticleSnapshot,
);

const effectiveArticles = articleSnapshot?.articles;
const effectiveFeeds = articleSnapshot?.feeds ?? feeds ?? [];
const isPrimarySourceLoading = !hasResolvedSnapshot;
```

- [ ] **Step 4: article list テストを実行して成功を確認する**

Run: `pnpm exec vitest run src/__tests__/components/article-list.test.tsx`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/reader/use-article-list-sources.ts src/components/reader/article-list.types.ts src/components/reader/use-article-list-runtime.ts src/__tests__/components/article-list.test.tsx
git commit -m "fix(reader): retain article snapshots during refresh"
```

### Task 4: settings / accounts を snapshot ベースで安定化する

### Files:

- Modify: `src/components/settings/settings-modal.tsx`
- Modify: `src/components/settings/use-settings-modal-view-props.tsx`
- Modify: `src/hooks/use-accounts.ts`
- Modify: `src/hooks/use-account-sync-statuses.ts`
- Test: `src/__tests__/components/settings-modal.test.tsx`

- [ ] **Step 1: settings の failing test を追加する**

```tsx
it("keeps the account list visible while sync statuses are still refreshing", async () => {
  setupTauriMocks((cmd, args) => {
    switch (cmd) {
      case "list_accounts":
        return sampleAccounts;
      case "get_account_sync_status":
        return new Promise(() => {});
      default:
        return null;
    }
  });

  useUiStore.setState({
    ...useUiStore.getInitialState(),
    settingsOpen: true,
    settingsCategory: "accounts",
  });

  render(<SettingsModal />, { wrapper: createWrapper() });

  expect(await screen.findByText(sampleAccounts[0].name)).toBeInTheDocument();
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm exec vitest run src/__tests__/components/settings-modal.test.tsx -t "keeps the account list visible while sync statuses are still refreshing"`
Expected: FAIL because settings loading currently blocks the whole section

- [ ] **Step 3: settings snapshot の最小実装を書く**

```tsx
// src/components/settings/settings-modal.tsx
const accountsQuery = useAccounts();
const settingsSnapshotCandidate = accountsQuery.data
  ? {
      accounts: accountsQuery.data,
      savedAccountId,
    }
  : null;

const { snapshot: settingsSnapshot, hasResolvedSnapshot } = useScreenSnapshot(
  settingsSnapshotCandidate,
  settingsSnapshotCandidate !== null,
);

const effectiveAccounts = settingsSnapshot?.accounts;
const isSettingsSnapshotLoading = !hasResolvedSnapshot;
```

```tsx
// src/components/settings/use-settings-modal-view-props.tsx
const accountItems: AccountNavItem[] = (effectiveAccounts ?? []).map((account) => ({
  id: account.id,
  name: account.name,
  kind: account.kind,
  isActive: settingsAccountId === account.id,
}));
```

- [ ] **Step 4: settings テストを実行して成功を確認する**

Run: `pnpm exec vitest run src/__tests__/components/settings-modal.test.tsx`
Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/settings/settings-modal.tsx src/components/settings/use-settings-modal-view-props.tsx src/hooks/use-accounts.ts src/hooks/use-account-sync-statuses.ts src/__tests__/components/settings-modal.test.tsx
git commit -m "fix(settings): preserve account snapshots during refresh"
```

### Task 5: 横断チェックと empty / loading の棚卸しを行う

### Files:

- Modify: `src/hooks/create-query.ts`
- Modify: `src/components/reader/use-sidebar-sources.ts`
- Modify: `src/components/reader/use-article-list-sources.ts`
- Modify: `src/components/settings/settings-modal.tsx`
- Test: `src/__tests__/components/sidebar.test.tsx`
- Test: `src/__tests__/components/article-list.test.tsx`
- Test: `src/__tests__/components/settings-modal.test.tsx`

- [ ] **Step 1: `pending === empty` を起こす箇所の回帰テストを揃える**

```tsx
// Sidebar, ArticleList, SettingsModal の各テストで
// "pending だが previous snapshot がある" ケースを 1 つずつ明示する
expect(screen.queryByText("+ でフィードを追加")).not.toBeInTheDocument();
expect(screen.getByText(previousArticleTitle)).toBeInTheDocument();
expect(screen.getByText(previousAccountName)).toBeInTheDocument();
```

- [ ] **Step 2: 共通 query ラッパの責務を最小限に調整する**

```ts
// src/hooks/create-query.ts
export function createQuery<TData, TId extends string | null>(
  queryKey: string,
  fetcher: (id: string) => Result.ResultAsync<TData, { message: string }>,
) {
  return function useGeneratedQuery(id: TId) {
    return useQuery({
      queryKey: [queryKey, id],
      queryFn: () => fetcher(id as string).then(Result.unwrap()),
      enabled: !!id,
      staleTime: 0,
    });
  };
}
```

- [ ] **Step 3: フルチェックを実行する**

Run: `mise run check`
Expected: format / typecheck / rust tests / unit tests がすべて PASS

- [ ] **Step 4: 変更内容を確認する**

Run: `rtk git diff --stat`
Expected: snapshot 基盤、3 画面、関連テストだけが差分に含まれている

- [ ] **Step 5: コミットする**

```bash
git add src/hooks/create-query.ts src/components/reader/use-sidebar-sources.ts src/components/reader/use-article-list-sources.ts src/components/settings/settings-modal.tsx src/__tests__/components/sidebar.test.tsx src/__tests__/components/article-list.test.tsx src/__tests__/components/settings-modal.test.tsx
git commit -m "refactor(ui): unify sqlite-first screen refresh behavior"
```

## Self-Review

- Spec coverage
  - sidebar / article list / settings の 3 画面をすべて task に割り当てた
  - 共通基盤 `useScreenSnapshot` も独立 task にした
  - loading / empty / revalidating の分離を sidebar task と横断 task に含めた

- Placeholder scan
  - `TODO`, `TBD`, `later` は未使用
  - 各 task に対象ファイル、テスト、実行コマンド、コミット例を記載済み
- Type consistency
  - `useScreenSnapshot` を共通 hook 名として統一
  - sidebar / article list / settings の snapshot という命名を統一
  - 主データ / 補助データの考え方を全 task で一貫させた
