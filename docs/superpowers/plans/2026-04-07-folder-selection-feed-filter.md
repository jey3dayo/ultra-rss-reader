# Folder Selection Feed Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: フォルダクリック時に、そのフォルダ配下の記事へ記事リストを切り替えつつ、サイドバーの配下フィード一覧も `unread` / `all` に応じて動的に絞り込めるようにする

Architecture: 既存の `selection.type = "folder"` と `viewMode` をそのまま使い、状態の追加は避ける。`FeedTreeView` で folder row を「展開」と「選択」に分離し、`Sidebar` で folder selection を踏まえた feed view model を組み立て、`ArticleList` と `src/lib/article-list.ts` 側で folder 配下の feed 集合による前段フィルタを適用する。

Tech Stack: React 19, TypeScript, Zustand, TanStack Query, Vitest, Testing Library, Tauri command mocks

Spec: `docs/superpowers/specs/2026-04-07-folder-selection-feed-filter-design.md`

---

## File Structure

| Action | Path | Responsibility |
| --- | --- | --- |
| Modify | `src/components/reader/feed-tree-view.tsx` | folder row の選択 UI と callback を追加し、chevron と row body の役割を分離する |
| Modify | `src/__tests__/components/feed-tree-view.test.tsx` | folder selection UI と callback の回帰を固定する |
| Modify | `src/components/reader/sidebar.tsx` | folder selection 時の feed view model 組み立てと selected folder state 受け渡しを実装する |
| Modify | `src/__tests__/components/sidebar.test.tsx` | folder selection + `viewMode` による feed list 絞り込みを検証する |
| Modify | `src/lib/article-list.ts` | feed 集合による前段フィルタ helper を追加し、既存 visible filter と合流させる |
| Modify | `src/__tests__/lib/article-list.test.ts` | folder scope + `viewMode` + search の filtering ルールを固定する |
| Modify | `src/components/reader/article-list.tsx` | folder selection 時に folder 配下の `feedId` 集合を算出し、通常一覧と検索結果の両方へ適用する |
| Modify | `src/__tests__/components/article-list.test.tsx` | folder selection で記事一覧が正しく絞られることを検証する |

## Notes Before Editing

- `src/stores/ui-store.ts` に `selectFolder(folderId)` はすでにあるので、新しい selection type は増やさないこと。
- `FeedTreeView` は現在 folder row click を `onToggleFolder` へ直結している。今回は chevron button だけが展開トグル、row 本体は folder selection に切り替えること。
- `viewMode === "starred"` の sidebar feed 表示は spec に合わせて「選択フォルダ配下の全フィード表示」のままにする。未読件数だけで starred 対象 feed を判定しようとしないこと。
- 検索中も folder scope を外さないこと。`search_articles` の結果をそのまま見せず、選択フォルダ配下の `feedId` 集合で再フィルタすること。

---

## Task 1: FeedTreeView に folder selection UI を追加する

### Files:

- Modify: `src/components/reader/feed-tree-view.tsx`
- Test: `src/__tests__/components/feed-tree-view.test.tsx`

- [ ] **Step 1: folder row 選択の失敗テストを書く**

`src/__tests__/components/feed-tree-view.test.tsx` に追加:

```tsx
it("separates folder selection from folder expansion", async () => {
  const user = userEvent.setup();
  const onToggleFolder = vi.fn();
  const onSelectFolder = vi.fn();

  render(
    <FeedTreeView
      isOpen={true}
      folders={[
        {
          id: "folder-1",
          name: "Work",
          accountId: "acc-1",
          sortOrder: 0,
          unreadCount: 2,
          isExpanded: false,
          isSelected: false,
          feeds: [],
        },
      ]}
      unfolderedFeeds={[]}
      onToggleFolder={onToggleFolder}
      onSelectFolder={onSelectFolder}
      onSelectFeed={vi.fn()}
      displayFavicons={false}
      emptyState={{ kind: "message", message: "No feeds yet" }}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Select folder Work" }));
  await user.click(screen.getByRole("button", { name: "Toggle folder Work" }));

  expect(onSelectFolder).toHaveBeenCalledWith("folder-1");
  expect(onToggleFolder).toHaveBeenCalledWith("folder-1");
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm vitest run src/__tests__/components/feed-tree-view.test.tsx`

Expected: FAIL because `FeedTreeView` does not expose `onSelectFolder` or separate folder buttons yet.

- [ ] **Step 3: FeedTreeView の folder row API を最小実装する**

`src/components/reader/feed-tree-view.tsx` を更新:

```tsx
export type FeedTreeFolderViewModel = {
  id: string;
  name: string;
  accountId: string;
  sortOrder: number;
  unreadCount: number;
  isExpanded: boolean;
  isSelected: boolean;
  feeds: FeedTreeFeedViewModel[];
};

export type FeedTreeViewProps = {
  // existing props...
  onSelectFolder?: (folderId: string) => void;
};
```

folder row は 2 つの操作に分ける:

```tsx
<div className="flex items-center gap-1">
  <button
    type="button"
    aria-label={`Toggle folder ${folder.name}`}
    onClick={() => onToggleFolder(folder.id)}
  >
    {folder.isExpanded ? <ChevronDown ... /> : <ChevronRight ... />}
  </button>
  <ContextMenu.Trigger
    render={
      <SidebarNavButton
        aria-label={`Select folder ${folder.name}`}
        selected={folder.isSelected}
        trailing={folder.unreadCount > 0 ? folder.unreadCount.toLocaleString() : undefined}
      />
    }
    onClick={() => onSelectFolder?.(folder.id)}
  >
    <span className="font-medium">{folder.name}</span>
  </ContextMenu.Trigger>
</div>
```

ポイント:

- chevron button は folder selection を起こさない
- row 本体は `selected={folder.isSelected}` を受け取れるようにする
- 既存の folder context menu は row 本体にぶら下げたまま維持する

- [ ] **Step 4: FeedTreeView テストを再実行する**

Run: `pnpm vitest run src/__tests__/components/feed-tree-view.test.tsx`

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/reader/feed-tree-view.tsx src/__tests__/components/feed-tree-view.test.tsx
git commit -m "feat: add folder selection controls to feed tree"
```

---

## Task 2: Sidebar で folder selection に応じた feed list を組み立てる

### Files:

- Modify: `src/components/reader/sidebar.tsx`
- Test: `src/__tests__/components/sidebar.test.tsx`

- [ ] **Step 1: Sidebar の失敗テストを書く**

`src/__tests__/components/sidebar.test.tsx` に追加:

```tsx
it("shows only unread feeds from the selected folder when viewMode is unread", async () => {
  setupTauriMocks((cmd, args) => {
    switch (cmd) {
      case "list_accounts":
        return sampleAccounts;
      case "list_folders":
        return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
      case "list_feeds":
        return [
          { ...sampleFeeds[0], id: "feed-unread", title: "Unread Feed", folder_id: "folder-1", unread_count: 3 },
          { ...sampleFeeds[1], id: "feed-read", title: "Read Feed", folder_id: "folder-1", unread_count: 0 },
        ];
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

  useUiStore.setState({
    ...useUiStore.getInitialState(),
    selectedAccountId: "acc-1",
    selection: { type: "folder", folderId: "folder-1" },
    viewMode: "unread",
    expandedFolderIds: new Set(["folder-1"]),
  });

  render(<Sidebar />, { wrapper: createWrapper() });

  expect(await screen.findByText("Unread Feed")).toBeInTheDocument();
  expect(screen.queryByText("Read Feed")).not.toBeInTheDocument();
});

it("shows all feeds from the selected folder when viewMode is all", async () => {
  setupTauriMocks((cmd, args) => {
    switch (cmd) {
      case "list_accounts":
        return sampleAccounts;
      case "list_folders":
        return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
      case "list_feeds":
        return [
          { ...sampleFeeds[0], id: "feed-unread", title: "Unread Feed", folder_id: "folder-1", unread_count: 3 },
          { ...sampleFeeds[1], id: "feed-read", title: "Read Feed", folder_id: "folder-1", unread_count: 0 },
        ];
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

  useUiStore.setState({
    ...useUiStore.getInitialState(),
    selectedAccountId: "acc-1",
    selection: { type: "folder", folderId: "folder-1" },
    viewMode: "all",
    expandedFolderIds: new Set(["folder-1"]),
  });

  render(<Sidebar />, { wrapper: createWrapper() });

  expect(await screen.findByText("Unread Feed")).toBeInTheDocument();
  expect(screen.getByText("Read Feed")).toBeInTheDocument();
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm vitest run src/__tests__/components/sidebar.test.tsx`

Expected: FAIL because `Sidebar` does not mark folder selection or filter folder feeds by `viewMode`.

- [ ] **Step 3: Sidebar の folder view model 組み立てを実装する**

`src/components/reader/sidebar.tsx` を更新:

```tsx
const selectedFolderId = selection.type === "folder" ? selection.folderId : null;

const filterFolderFeedsForSidebar = useCallback(
  (feeds: FeedDto[]) => {
    if (selectedFolderId === null) return sortFeeds(feeds);
    if (viewMode === "unread") return sortFeeds(feeds.filter((feed) => feed.unread_count > 0));
    return sortFeeds(feeds);
  },
  [selectedFolderId, sortFeeds, viewMode],
);
```

folder view model 生成を更新:

```tsx
const feedTreeFolders = useMemo<FeedTreeFolderViewModel[]>(
  () =>
    sortedFolderList.map((folder) => {
      const rawFolderFeeds = feedsByFolder.get(folder.id) ?? [];
      const folderFeeds =
        selectedFolderId !== null && folder.id !== selectedFolderId
          ? []
          : filterFolderFeedsForSidebar(rawFolderFeeds);

      return {
        id: folder.id,
        name: folder.name,
        accountId: folder.account_id,
        sortOrder: folder.sort_order,
        unreadCount: rawFolderFeeds.reduce((sum, feed) => sum + feed.unread_count, 0),
        isExpanded: expandedFolderIds.has(folder.id),
        isSelected: selectedFolderId === folder.id,
        feeds: folderFeeds.map(/* existing feed mapping */),
      };
    }),
  [expandedFolderIds, feedsByFolder, filterFolderFeedsForSidebar, selectedFeedId, selectedFolderId, sortedFolderList],
);
```

`FeedTreeView` 呼び出しに folder selection を渡す:

```tsx
<FeedTreeView
  ...
  onSelectFolder={selectFolder}
/>
```

ポイント:

- folder selection 中でもフォルダ行自体は全件表示し、配下 feed だけを対象フォルダに限定する
- `unfolderedFeeds` は folder selection 中は空にする
- folder row の unread badge は `rawFolderFeeds` を元に維持し、表示フィード数とバッジを混同しない

- [ ] **Step 4: Sidebar テストを再実行する**

Run: `pnpm vitest run src/__tests__/components/sidebar.test.tsx`

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/reader/sidebar.tsx src/__tests__/components/sidebar.test.tsx
git commit -m "feat: filter sidebar feeds by selected folder"
```

---

## Task 3: article-list helper に folder scope filtering を追加する

### Files:

- Modify: `src/lib/article-list.ts`
- Test: `src/__tests__/lib/article-list.test.ts`

- [ ] **Step 1: helper の失敗テストを書く**

`src/__tests__/lib/article-list.test.ts` に追加:

```ts
it("filters account articles to the selected folder feed ids before unread filtering", () => {
  const result = selectVisibleArticles({
    articles: undefined,
    accountArticles: [
      { ...sampleArticles[0], id: "art-folder", feed_id: "feed-1", is_read: false },
      { ...sampleArticles[1], id: "art-other", feed_id: "feed-2", is_read: false },
      { ...sampleArticles[2], id: "art-read", feed_id: "feed-1", is_read: true },
    ],
    tagArticles: undefined,
    searchResults: undefined,
    feedId: null,
    tagId: null,
    folderFeedIds: new Set(["feed-1"]),
    viewMode: "unread",
    showSearch: false,
    searchQuery: "",
    sortUnread: "newest_first",
    retainedArticleIds: new Set(),
  });

  expect(result.map((article) => article.id)).toEqual(["art-folder"]);
});

it("filters search results to the selected folder feed ids", () => {
  const result = selectVisibleArticles({
    articles: undefined,
    accountArticles: undefined,
    tagArticles: undefined,
    searchResults: [
      { ...sampleArticles[0], id: "art-folder", feed_id: "feed-1" },
      { ...sampleArticles[1], id: "art-other", feed_id: "feed-2" },
    ],
    feedId: null,
    tagId: null,
    folderFeedIds: new Set(["feed-1"]),
    viewMode: "all",
    showSearch: true,
    searchQuery: "article",
    sortUnread: "newest_first",
    retainedArticleIds: new Set(),
  });

  expect(result.map((article) => article.id)).toEqual(["art-folder"]);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm vitest run src/__tests__/lib/article-list.test.ts`

Expected: FAIL because `folderFeedIds` is not part of `selectVisibleArticles(...)`.

- [ ] **Step 3: helper を最小実装する**

`src/lib/article-list.ts` を更新:

```ts
type SelectVisibleArticlesParams = {
  // existing fields...
  folderFeedIds?: ReadonlySet<string> | null;
};

function filterByFolderFeedIds(
  articles: ArticleDto[],
  folderFeedIds: ReadonlySet<string> | null | undefined,
): ArticleDto[] {
  if (!folderFeedIds) {
    return articles;
  }

  if (folderFeedIds.size === 0) {
    return [];
  }

  return articles.filter((article) => folderFeedIds.has(article.feed_id));
}
```

`selectVisibleArticles(...)` の先頭で各ソースへ適用:

```ts
if (showSearch && searchQuery.length > 0) {
  list = filterByFolderFeedIds([...(searchResults ?? [])], folderFeedIds);
} else if (tagId) {
  list = [...(tagArticles ?? [])];
} else {
  const all = filterByFolderFeedIds(feedId ? (articles ?? []) : (accountArticles ?? []), folderFeedIds);
  // existing viewMode filtering...
}
```

ポイント:

- `tag` 選択には folder scope を混ぜない
- `feedId` があるケースでは folder scope は事実上不要だが、渡されても harmless にしてよい
- `folderFeedIds.size === 0` は「その folder に該当 feed がない」ので結果は空になる

- [ ] **Step 4: helper テストを再実行する**

Run: `pnpm vitest run src/__tests__/lib/article-list.test.ts`

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/lib/article-list.ts src/__tests__/lib/article-list.test.ts
git commit -m "feat: add folder feed scope to article filtering"
```

---

## Task 4: ArticleList で folder selection の記事表示と検索スコープを接続する

### Files:

- Modify: `src/components/reader/article-list.tsx`
- Test: `src/__tests__/components/article-list.test.tsx`

- [ ] **Step 1: ArticleList の失敗テストを書く**

`src/__tests__/components/article-list.test.tsx` に追加:

```tsx
it("renders only articles from the selected folder", async () => {
  useUiStore.setState({
    ...useUiStore.getInitialState(),
    selectedAccountId: "acc-1",
    selection: { type: "folder", folderId: "folder-tech" },
    viewMode: "all",
  });

  setupTauriMocks((cmd, args) => {
    switch (cmd) {
      case "list_feeds":
        return [
          { ...sampleFeeds[0], id: "feed-tech", folder_id: "folder-tech", account_id: args.accountId },
          { ...sampleFeeds[1], id: "feed-news", folder_id: "folder-news", account_id: args.accountId },
        ];
      case "list_account_articles":
        return [
          { ...sampleArticles[0], id: "art-tech", title: "Tech Article", feed_id: "feed-tech" },
          { ...sampleArticles[1], id: "art-news", title: "News Article", feed_id: "feed-news" },
        ];
      case "list_articles":
        return [];
      case "list_articles_by_tag":
        return [];
      case "search_articles":
        return [];
      default:
        return null;
    }
  });

  render(<ArticleList />, { wrapper: createWrapper() });

  await waitFor(() => {
    expect(screen.getByText("Tech Article")).toBeInTheDocument();
    expect(screen.queryByText("News Article")).not.toBeInTheDocument();
  });
});

it("keeps folder scope when showing search results", async () => {
  useUiStore.setState({
    ...useUiStore.getInitialState(),
    selectedAccountId: "acc-1",
    selection: { type: "folder", folderId: "folder-tech" },
    viewMode: "all",
  });

  setupTauriMocks((cmd, args) => {
    switch (cmd) {
      case "list_feeds":
        return [
          { ...sampleFeeds[0], id: "feed-tech", folder_id: "folder-tech", account_id: args.accountId },
          { ...sampleFeeds[1], id: "feed-news", folder_id: "folder-news", account_id: args.accountId },
        ];
      case "list_account_articles":
        return [];
      case "list_articles":
        return [];
      case "list_articles_by_tag":
        return [];
      case "search_articles":
        return [
          { ...sampleArticles[0], id: "art-tech", title: "Tech Article", feed_id: "feed-tech" },
          { ...sampleArticles[1], id: "art-news", title: "News Article", feed_id: "feed-news" },
        ];
      default:
        return null;
    }
  });

  const user = userEvent.setup();
  render(<ArticleList />, { wrapper: createWrapper() });

  await user.click(await screen.findByRole("button", { name: "Search" }));
  await user.type(screen.getByRole("searchbox"), "Article");

  await waitFor(() => {
    expect(screen.getByText("Tech Article")).toBeInTheDocument();
    expect(screen.queryByText("News Article")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm vitest run src/__tests__/components/article-list.test.tsx`

Expected: FAIL because folder selection is currently treated like account-wide selection.

- [ ] **Step 3: ArticleList で folder scope を計算して helper に渡す**

`src/components/reader/article-list.tsx` を更新:

```tsx
const folderId = selection.type === "folder" ? selection.folderId : null;
const folderFeedIds = useMemo(() => {
  if (!folderId) return null;
  return new Set((feeds ?? []).filter((feed) => feed.folder_id === folderId).map((feed) => feed.id));
}, [feeds, folderId]);

const accountListScopeId = feedId || tagId ? null : selectedAccountId;
```

`selectVisibleArticles(...)` 呼び出しを更新:

```tsx
const filteredArticles = useMemo(() => {
  return selectVisibleArticles({
    articles,
    accountArticles,
    tagArticles,
    searchResults,
    feedId,
    tagId,
    folderFeedIds,
    viewMode,
    showSearch,
    searchQuery,
    sortUnread,
    retainedArticleIds,
  });
}, [
  accountArticles,
  articles,
  feedId,
  folderFeedIds,
  retainedArticleIds,
  searchQuery,
  searchResults,
  showSearch,
  sortUnread,
  tagArticles,
  tagId,
  viewMode,
]);
```

ポイント:

- `list_account_articles` をそのまま使い、folder selection のために新しい IPC は増やさない
- feed selection 時の `articles` query と folder selection 時の `accountArticles` query を混同しない
- `selectedFeed` や display preset select は `feedId` がある時だけ従来どおり表示する

- [ ] **Step 4: ArticleList テストを再実行する**

Run: `pnpm vitest run src/__tests__/components/article-list.test.tsx`

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/reader/article-list.tsx src/__tests__/components/article-list.test.tsx
git commit -m "feat: scope article list to selected folder"
```

---

## Task 5: 回帰確認と手動検証を完了する

### Files:

- Modify: なし

- [ ] **Step 1: 関連ユニット/コンポーネントテストをまとめて実行する**

Run:

```bash
pnpm vitest run src/__tests__/components/feed-tree-view.test.tsx src/__tests__/components/sidebar.test.tsx src/__tests__/lib/article-list.test.ts src/__tests__/components/article-list.test.tsx
```

Expected: PASS

- [ ] **Step 2: 型チェックを実行する**

Run: `pnpm exec tsc --noEmit`

Expected: PASS

- [ ] **Step 3: リポジトリ標準のチェックを実行する**

Run: `mise run check`

Expected: PASS

- [ ] **Step 4: ブラウザ開発モードで手動確認する**

Run: `mise run app:dev:browser`

確認項目:

- フォルダ row クリックで記事リストがそのフォルダ配下へ切り替わる
- chevron click では展開だけが切り替わり、folder selection は壊れない
- folder selection + `UNREAD` で未読フィードだけが sidebar に残る
- folder selection + `ALL` で同じフォルダ配下の全フィードが sidebar に戻る
- folder selection 中の検索でもフォルダ外記事が混ざらない
- folder selection 中に feed row をクリックすると、その feed selection へ遷移する
- 対象フィード 0 件でも empty state と selection が破綻しない

- [ ] **Step 5: 最終報告をまとめる**

報告に含める:

- 実装した folder selection ルールの要約
- 実行したテスト/検証コマンドと結果
- 手動確認の結果
- 未解決事項があれば再現条件付きで記載
