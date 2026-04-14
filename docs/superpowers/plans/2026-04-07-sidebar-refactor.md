# Sidebar Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: `sidebar.tsx` と `feed-tree-view.tsx` を責務ごとに分割し、薄い `shared` section shell を追加しつつ、drag/drop と sidebar UI の既存挙動を維持する

Architecture: `src/components/reader/sidebar.tsx` は store / query / mutation / event listener を束ねる coordinator に寄せ、section ごとの JSX は専用コンポーネントへ抽出する。`src/components/reader/feed-tree-view.tsx` は tree composition に絞り、feed row / folder section / drag overlay / pointer drag state を別ファイルへ分離する。

Tech Stack: React 19, TypeScript, Zustand, TanStack Query, Vitest, Testing Library, Tauri command mocks, class-variance-authority

Spec: `docs/superpowers/specs/2026-04-07-sidebar-refactor-design.md`

---

## File Structure

| Action | Path | Responsibility |
| --- | --- | --- |
| Create | `src/components/shared/sidebar-section-shell.tsx` | sidebar 風 section の spacing / header / optional toggle を揃える薄い shell |
| Create | `src/components/reader/sidebar-account-section.tsx` | account switcher 周辺の markup を分離する |
| Create | `src/components/reader/sidebar-feed-section.tsx` | feed section shell, empty state, `FeedTreeView` 呼び出しを担当する |
| Create | `src/components/reader/sidebar-tag-section.tsx` | tag section shell と `TagListView` 接続を担当する |
| Create | `src/components/reader/sidebar-footer-actions.tsx` | feed cleanup / settings の footer action row を担当する |
| Create | `src/components/reader/feed-tree-row.tsx` | feed row 表示と drag handle を分離する |
| Create | `src/components/reader/feed-tree-folder-section.tsx` | folder row + nested feeds 描画を分離する |
| Create | `src/components/reader/feed-tree-drag-overlay.tsx` | pointer drag preview card を分離する |
| Create | `src/components/reader/use-feed-tree-drag.ts` | pointer drag session / hover target / listeners を管理する |
| Modify | `src/components/reader/feed-tree-view.tsx` | composition component に縮小し、drag hook と subcomponents を使う |
| Modify | `src/components/reader/sidebar.tsx` | section orchestration だけに寄せる |
| Modify | `src/components/shared/sidebar-section-toggle.tsx` | shell との組み合わせで必要な props 調整を行う |
| Modify | `src/__tests__/components/feed-tree-view.test.tsx` | drag/drop と empty state の回帰を分割後も固定する |
| Modify | `src/__tests__/components/sidebar.test.tsx` | sidebar section / footer / selection / drag integration の回帰を維持する |
| Create if Needed | `src/__tests__/hooks/use-feed-tree-drag.test.tsx` | pointer drag state 遷移を hook 単位で固定する |
| Create if Needed | `src/__tests__/components/sidebar-footer-actions.test.tsx` | footer action row の clickability と labels を固定する |

## Notes Before Editing

- `src/components/reader/folder-section.tsx` は別文脈の既存実装なので、今回の分割は `feed-tree-*` 命名で衝突を避けること。
- `sidebar.tsx` に残すのは state connection, derived view model assembly, mutation execution, toast / sync event handling まで。section 内の細かい JSX は持たせないこと。
- `shared/sidebar-section-shell.tsx` は layout-only に限定し、account / feed / tag などのドメイン語彙を props に持ち込まないこと。
- drag/drop mutation error と sync warning/error toast は `sidebar.tsx` に残し、`use-feed-tree-drag.ts` には API knowledge を持たせないこと。
- visual polish は spacing と grouping の微調整に限定し、sidebar の情報設計や interaction model は変えないこと。

---

## Task 1: `shared` に sidebar section shell を導入する

### Files:

- Create: `src/components/shared/sidebar-section-shell.tsx`
- Modify: `src/components/shared/sidebar-section-toggle.tsx`
- Test: `src/__tests__/components/sidebar.test.tsx`

- [ ] **Step 1: shell の失敗テストを追加する**

`src/__tests__/components/sidebar.test.tsx` に、section header と body grouping が維持されることを確認する assertion を追加する。

```tsx
it("renders feeds and tags inside distinct sidebar sections", async () => {
  render(<Sidebar />, { wrapper: createWrapper() });

  expect(await screen.findByRole("button", { name: /feeds/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /tags/i })).toBeInTheDocument();
  expect(screen.getByTestId("sidebar-feed-scroll-area")).toBeInTheDocument();
});
```

- [ ] **Step 2: テストを実行して現状を固定する**

Run: `pnpm vitest run src/__tests__/components/sidebar.test.tsx`

Expected: PASS or FAIL. どちらでもよいが、現在の section markup が何に依存しているかを確認する。

- [ ] **Step 3: `sidebar-section-shell.tsx` を最小実装する**

`src/components/shared/sidebar-section-shell.tsx` を作成する。

```tsx
type SidebarSectionShellProps = {
  title?: string;
  isOpen?: boolean;
  onToggle?: () => void;
  headerClassName?: string;
  bodyClassName?: string;
  children: ReactNode;
};

export function SidebarSectionShell({
  title,
  isOpen = true,
  onToggle,
  headerClassName,
  bodyClassName,
  children,
}: SidebarSectionShellProps) {
  return (
    <section className="space-y-2">
      {title ? (
        <div className={cn("px-2", headerClassName)}>
          {onToggle ? <SidebarSectionToggle label={title} isOpen={isOpen} onToggle={onToggle} /> : <div>{title}</div>}
        </div>
      ) : null}
      {isOpen ? <div className={cn("space-y-1 px-2", bodyClassName)}>{children}</div> : null}
    </section>
  );
}
```

必要なら `src/components/shared/sidebar-section-toggle.tsx` に `className` の受け口を維持したまま shell で使いやすい spacing を追加する。

- [ ] **Step 4: sidebar テストを再実行する**

Run: `pnpm vitest run src/__tests__/components/sidebar.test.tsx`

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/shared/sidebar-section-shell.tsx src/components/shared/sidebar-section-toggle.tsx src/__tests__/components/sidebar.test.tsx
git commit -m "refactor: add sidebar section shell"
```

---

## Task 2: sidebar の section markup を専用コンポーネントへ抽出する

### Files:

- Create: `src/components/reader/sidebar-account-section.tsx`
- Create: `src/components/reader/sidebar-feed-section.tsx`
- Create: `src/components/reader/sidebar-tag-section.tsx`
- Create: `src/components/reader/sidebar-footer-actions.tsx`
- Modify: `src/components/reader/sidebar.tsx`
- Test: `src/__tests__/components/sidebar.test.tsx`
- Create if Needed: `src/__tests__/components/sidebar-footer-actions.test.tsx`

- [ ] **Step 1: sidebar section 分離の失敗テストを追加する**

`src/__tests__/components/sidebar.test.tsx` に footer action と empty state の回帰テストを追加する。

```tsx
it("shows the add-account action when no account is selected", async () => {
  useUiStore.setState({ ...useUiStore.getInitialState(), selectedAccountId: null });

  render(<Sidebar />, { wrapper: createWrapper() });

  expect(await screen.findByRole("button", { name: /add account to start/i })).toBeInTheDocument();
});

it("renders footer actions for feed cleanup and settings", async () => {
  render(<Sidebar />, { wrapper: createWrapper() });

  expect(await screen.findByRole("button", { name: /feed cleanup/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: テストを実行して現状の振る舞いを確認する**

Run: `pnpm vitest run src/__tests__/components/sidebar.test.tsx`

Expected: PASS or targeted FAIL. current labels / buttons / empty state wiring を確認する。

- [ ] **Step 3: section component を作成して `sidebar.tsx` を縮小する**

それぞれの新規ファイルを作成する。

`src/components/reader/sidebar-account-section.tsx`

```tsx
type SidebarAccountSectionProps = {
  selectedAccountName: string;
  lastSyncedLabel: string;
  accounts: AccountDto[];
  selectedAccountId: string | null;
  isExpanded: boolean;
  menuId: string;
  menuLabel: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  itemRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  onToggle: () => void;
  onSelectAccount: (id: string) => void;
  onClose: (restoreFocus?: boolean) => void;
};
```

`src/components/reader/sidebar-feed-section.tsx`

```tsx
type SidebarFeedSectionProps = {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  tree: ReactNode;
};

export function SidebarFeedSection(props: SidebarFeedSectionProps) {
  return (
    <SidebarSectionShell title={props.title} isOpen={props.isOpen} onToggle={props.onToggle}>
      {props.tree}
    </SidebarSectionShell>
  );
}
```

`src/components/reader/sidebar-tag-section.tsx`

```tsx
type SidebarTagSectionProps = {
  content: ReactNode;
};

export function SidebarTagSection({ content }: SidebarTagSectionProps) {
  return content;
}
```

`src/components/reader/sidebar-footer-actions.tsx`

```tsx
type SidebarFooterActionsProps = {
  feedCleanupLabel: string;
  settingsLabel: string;
  onOpenFeedCleanup: () => void;
  onOpenSettings: () => void;
};
```

`src/components/reader/sidebar.tsx` は次の shape に寄せる。

```tsx
return (
  <div className={cn("flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground", opaqueSidebars && "bg-opacity-100")}>
    <SidebarHeaderView ... />
    <SidebarAccountSection ... />
    <SmartViewsView ... />
    <ScrollArea data-testid="sidebar-feed-scroll-area" className="flex-1">
      <div className="space-y-3 pb-4">
        <SidebarFeedSection ... />
        {showSidebarTags ? <SidebarTagSection content={<TagListView ... />} /> : null}
      </div>
    </ScrollArea>
    <SidebarFooterActions ... />
    {selectedAccountId ? <AddFeedDialog ... /> : null}
  </div>
);
```

ポイント:

- `sidebar.tsx` に残るのは state derivation と callbacks のみ
- tag section は `TagListView` 自体が toggle を持つので、wrapper は over-abstract しない
- footer action の className は既存 `control-chip` を使い続ける

- [ ] **Step 4: sidebar テストを再実行する**

Run: `pnpm vitest run src/__tests__/components/sidebar.test.tsx`

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/reader/sidebar-account-section.tsx src/components/reader/sidebar-feed-section.tsx src/components/reader/sidebar-tag-section.tsx src/components/reader/sidebar-footer-actions.tsx src/components/reader/sidebar.tsx src/__tests__/components/sidebar.test.tsx
git commit -m "refactor: split sidebar sections"
```

---

## Task 3: feed tree の row / folder / overlay を抽出する

### Files:

- Create: `src/components/reader/feed-tree-row.tsx`
- Create: `src/components/reader/feed-tree-folder-section.tsx`
- Create: `src/components/reader/feed-tree-drag-overlay.tsx`
- Modify: `src/components/reader/feed-tree-view.tsx`
- Test: `src/__tests__/components/feed-tree-view.test.tsx`

- [ ] **Step 1: feed tree subcomponent 抽出の失敗テストを追加する**

`src/__tests__/components/feed-tree-view.test.tsx` に folder nested feeds と drag overlay の回帰 assertion を追加する。

```tsx
it("renders nested feeds when the folder is expanded", () => {
  render(
    <FeedTreeView
      isOpen={true}
      folders={[makeFolder({ isExpanded: true, feeds: [makeFeed({ title: "Nested Feed" })] })]}
      unfolderedFeeds={[]}
      onToggleFolder={vi.fn()}
      onSelectFeed={vi.fn()}
      displayFavicons={false}
      emptyState={{ kind: "message", message: "No feeds" }}
    />,
  );

  expect(screen.getByText("Nested Feed")).toBeInTheDocument();
});
```

- [ ] **Step 2: テストを実行して現状を固定する**

Run: `pnpm vitest run src/__tests__/components/feed-tree-view.test.tsx`

Expected: PASS

- [ ] **Step 3: row / folder / overlay を別ファイルへ移す**

`src/components/reader/feed-tree-row.tsx`

```tsx
export type FeedTreeRowProps = {
  feed: FeedTreeFeedViewModel;
  displayFavicons: boolean;
  onSelectFeed: (feedId: string) => void;
  renderFeedContextMenu?: (feed: FeedTreeFeedViewModel) => ReactNode;
  canDragFeeds?: boolean;
  isDragged?: boolean;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onPointerDownFeed?: (feed: FeedTreeFeedViewModel, event: ReactPointerEvent<HTMLButtonElement>) => void;
  consumeSuppressedHandleClick?: () => boolean;
};
```

`src/components/reader/feed-tree-folder-section.tsx`

```tsx
export type FeedTreeFolderSectionProps = {
  folder: FeedTreeFolderViewModel;
  activeDropTarget: ActiveDropTarget;
  draggedFeedId?: string | null;
  onToggleFolder: (folderId: string) => void;
  onSelectFolder?: (folderId: string) => void;
  onSelectFeed: (feedId: string) => void;
  displayFavicons: boolean;
  renderFolderContextMenu?: (folder: FeedTreeFolderViewModel) => ReactNode;
  renderFeedContextMenu?: (feed: FeedTreeFeedViewModel) => ReactNode;
  canDragFeeds?: boolean;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onDropToFolder?: (folderId: string) => void;
  onPointerDownFeed?: (feed: FeedTreeFeedViewModel, event: ReactPointerEvent<HTMLButtonElement>) => void;
  consumeSuppressedHandleClick?: () => boolean;
};
```

`src/components/reader/feed-tree-drag-overlay.tsx`

```tsx
export function FeedTreeDragOverlay({
  preview,
  displayFavicons,
}: {
  preview: PointerDragPreview | null;
  displayFavicons: boolean;
}) {
  if (!preview) return null;

  return (
    <div className="pointer-events-none fixed left-0 top-0 z-50" style={{ transform: `translate3d(${preview.x + 12}px, ${preview.y + 12}px, 0)` }}>
      <FeedDragOverlayCard feed={preview.feed} displayFavicons={displayFavicons} />
    </div>
  );
}
```

`src/components/reader/feed-tree-view.tsx` は subcomponents を import して compose する形にする。

- [ ] **Step 4: feed tree テストを再実行する**

Run: `pnpm vitest run src/__tests__/components/feed-tree-view.test.tsx`

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/reader/feed-tree-row.tsx src/components/reader/feed-tree-folder-section.tsx src/components/reader/feed-tree-drag-overlay.tsx src/components/reader/feed-tree-view.tsx src/__tests__/components/feed-tree-view.test.tsx
git commit -m "refactor: extract feed tree display parts"
```

---

## Task 4: pointer drag state を `use-feed-tree-drag.ts` へ抽出する

### Files:

- Create: `src/components/reader/use-feed-tree-drag.ts`
- Modify: `src/components/reader/feed-tree-view.tsx`
- Test: `src/__tests__/components/feed-tree-view.test.tsx`
- Create if Needed: `src/__tests__/hooks/use-feed-tree-drag.test.tsx`

- [ ] **Step 1: drag state 抽出の失敗テストを書く**

`src/__tests__/components/feed-tree-view.test.tsx` または `src/__tests__/hooks/use-feed-tree-drag.test.tsx` に、drag hover target が folder / unfoldered で切り替わることを固定する。

```tsx
it("shows the unfoldered drop zone while dragging", async () => {
  render(<FeedTreeView {...makeDragEnabledProps()} />);

  const handle = screen.getByRole("button", { name: /drag .* feed/i });
  await user.pointer([
    { target: handle, keys: "[MouseLeft>]" },
    { coords: { clientX: 240, clientY: 180 } },
  ]);

  expect(screen.getByTestId("unfoldered-drop-zone")).toBeInTheDocument();
});
```

- [ ] **Step 2: テストを実行して現状を固定する**

Run: `pnpm vitest run src/__tests__/components/feed-tree-view.test.tsx`

Expected: PASS or targeted FAIL. 現在の drag coverage を確認する。

- [ ] **Step 3: `use-feed-tree-drag.ts` を作成する**

`src/components/reader/use-feed-tree-drag.ts` を作る。

```tsx
export type UseFeedTreeDragParams = {
  isOpen: boolean;
  hasFeeds: boolean;
  canDragFeeds: boolean;
  activeDropTarget: ActiveDropTarget;
  draggedFeedId?: string | null;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onDragEnterFolder?: (folderId: string) => void;
  onDragEnterUnfoldered?: () => void;
  onDropToFolder?: (folderId: string) => void;
  onDropToUnfoldered?: () => void;
  onDragEnd?: () => void;
};
```

hook の return shape:

```tsx
return {
  isPointerTracking,
  pointerDragPreview,
  activeVisualDropTarget,
  activeUnfoldered,
  showUnfolderedDropZone,
  handlePointerDownFeed,
  consumeSuppressedHandleClick,
};
```

`feed-tree-view.tsx` では existing drag logic block を削除し、hook を呼ぶだけにする。

ポイント:

- `getDropTargetAtPoint` 相当の DOM hit test は hook に閉じ込める
- `onDropToFolder`, `onDropToUnfoldered`, `onDragEnd` の sequencing は既存通りに保つ
- mutation 実行や toast は追加しない

- [ ] **Step 4: drag 関連テストを再実行する**

Run: `pnpm vitest run src/__tests__/components/feed-tree-view.test.tsx src/__tests__/hooks/use-feed-tree-drag.test.tsx`

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/reader/use-feed-tree-drag.ts src/components/reader/feed-tree-view.tsx src/__tests__/components/feed-tree-view.test.tsx src/__tests__/hooks/use-feed-tree-drag.test.tsx
git commit -m "refactor: extract feed tree drag state"
```

---

## Task 5: `sidebar.tsx` の coordinator 化を仕上げて regression を確認する

### Files:

- Modify: `src/components/reader/sidebar.tsx`
- Modify: `src/components/reader/sidebar-feed-section.tsx`
- Modify: `src/components/reader/sidebar-footer-actions.tsx`
- Modify: `src/__tests__/components/sidebar.test.tsx`

- [ ] **Step 1: coordinator 化の失敗テストを追加する**

`src/__tests__/components/sidebar.test.tsx` に drag mutation と section open state が維持されることを確認する。

```tsx
it("keeps feed cleanup and settings actions clickable after the refactor", async () => {
  const user = userEvent.setup();
  render(<Sidebar />, { wrapper: createWrapper() });

  await user.click(await screen.findByRole("button", { name: /settings/i }));
  expect(useUiStore.getState().isSettingsOpen).toBe(true);
});
```

- [ ] **Step 2: テストを実行して壊れている箇所を確認する**

Run: `pnpm vitest run src/__tests__/components/sidebar.test.tsx`

Expected: PASS or targeted FAIL. coordinator 化後の regression を明確にする。

- [ ] **Step 3: `sidebar.tsx` を 1 画面分の wiring に整える**

最終的な shape は次のイメージに寄せる。

```tsx
const feedTree = (
  <FeedTreeView
    isOpen={isFeedsSectionOpen}
    folders={feedTreeFolders}
    unfolderedFeeds={unfolderedFeedViews}
    onToggleFolder={toggleFolder}
    onSelectFolder={selectFolder}
    onSelectFeed={selectFeed}
    displayFavicons={displayFavicons}
    canDragFeeds={canDragFeeds}
    draggedFeedId={draggedFeedId}
    activeDropTarget={activeDropTarget}
    onDragStartFeed={handleDragStartFeed}
    onDragEnterFolder={handleDragEnterFolder}
    onDragEnterUnfoldered={handleDragEnterUnfoldered}
    onDropToFolder={(folderId) => void handleDropToFolder(folderId)}
    onDropToUnfoldered={() => void handleDropToUnfoldered()}
    onDragEnd={clearDragState}
    emptyState={feedEmptyState}
    renderFolderContextMenu={renderFolderContextMenu}
    renderFeedContextMenu={renderFeedContextMenu}
  />
);
```

並行して以下を確認する:

- sync listener cleanup が従来通りであること
- `handleAddFeed`, `closeAccountList`, `navigateFeed` の callback identity が破綻していないこと
- `opaqueSidebars` や footer action の className が失われていないこと

- [ ] **Step 4: sidebar / feed tree の主要テストをまとめて実行する**

Run:

```bash
pnpm vitest run src/__tests__/components/sidebar.test.tsx src/__tests__/components/feed-tree-view.test.tsx
```

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/reader/sidebar.tsx src/components/reader/sidebar-feed-section.tsx src/components/reader/sidebar-footer-actions.tsx src/__tests__/components/sidebar.test.tsx
git commit -m "refactor: slim sidebar coordinator"
```

---

## Task 6: repo 標準チェックと手動確認を完了する

### Files:

- Modify: なし

- [ ] **Step 1: 関連コンポーネントテストをまとめて実行する**

Run:

```bash
pnpm vitest run src/__tests__/components/sidebar.test.tsx src/__tests__/components/feed-tree-view.test.tsx src/__tests__/components/sidebar-footer-actions.test.tsx src/__tests__/hooks/use-feed-tree-drag.test.tsx
```

Expected: PASS

- [ ] **Step 2: 型チェックを実行する**

Run: `pnpm exec tsc --noEmit`

Expected: PASS

- [ ] **Step 3: リポジトリ標準チェックを実行する**

Run: `mise run check`

Expected: PASS

- [ ] **Step 4: ブラウザ開発モードで手動確認する**

Run: `mise run app:dev:browser`

確認項目:

- account switcher の開閉と account 選択が維持される
- smart views / feeds / tags の section 表示が崩れない
- folder 展開、feed 選択、context menu、drag/drop が従来通り動く
- unfoldered drop zone の表示と drop 完了が従来通り動く
- footer action の hover / click target が崩れていない
- spacing の微調整で横スクロールや詰まりが発生していない

- [ ] **Step 5: 最終報告をまとめる**

報告に含める:

- 分割したコンポーネント境界の要約
- `shared` に昇格したもの / `reader` に残したものの整理
- 実行したテスト / チェックコマンドと結果
- 手動確認の結果
- 残件があれば再現条件付きで記載
