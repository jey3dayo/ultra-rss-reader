# Sidebar Feed Drag-to-Folder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: サイドバーの購読行に hover 時だけドラッグハンドルを出し、既存フォルダまたは「フォルダなし」領域へドロップしてフィードの所属フォルダを変更できるようにする

Architecture: フォルダ更新の保存処理は `useMutation` ベースの小さな共通 hook にまとめ、`RenameDialog` と `Sidebar` の両方で再利用する。`FeedTreeView` は drag handle / drop target の見た目とイベント通知に集中させ、`Sidebar` は drag state と保存完了時の query invalidate を担当する。空フォルダも drop target にするため、`Sidebar` の folder view model 生成ではフィード件数 0 の folder も落とさない。

Tech Stack: React 19, TypeScript, TanStack Query, Zustand, Vitest, Testing Library, Tauri IPC mocks, Tailwind CSS

---

## File Structure

| Action | Path | Responsibility |
| --- | --- | --- |
| Create | `src/hooks/use-update-feed-folder.ts` | `update_feed_folder` 呼び出し、`feeds` query invalidate、失敗 toast を共通化する |
| Create | `src/__tests__/hooks/use-update-feed-folder.test.tsx` | 共通 hook の成功/失敗時挙動を固定する |
| Create | `src/__tests__/components/rename-feed-dialog.test.tsx` | folder 更新失敗時も rename/display-mode 更新を続行することを検証する |
| Modify | `src/components/reader/rename-feed-dialog.tsx` | 既存の folder 更新ロジックを共通 hook に寄せる |
| Modify | `src/components/reader/feed-tree-view.tsx` | drag handle、folder/unfoldered drop target、active target の見た目を追加する |
| Modify | `src/components/reader/feed-tree-view.stories.tsx` | drag enabled / empty folder / unfoldered target の story を追加する |
| Modify | `src/__tests__/components/feed-tree-view.test.tsx` | drag start / drag over / drop / empty folder target の UI イベントを検証する |
| Modify | `src/components/reader/sidebar.tsx` | drag state 管理、empty folder を含む view model、drop 完了時の保存を追加する |
| Modify | `src/__tests__/components/sidebar.test.tsx` | sidebar から `update_feed_folder` が正しく呼ばれることと空フォルダ移動を検証する |

## Notes Before Editing

- `src/components/reader/sidebar-nav-button.tsx` は `button` を返す。drag handle を row の sibling として配置し、`button` のネストを作らないこと。
- `src/components/reader/sidebar.tsx` は現在 `folder.feeds.length > 0` の folder だけ描画対象に残している。empty folder を drop target として残す変更は、drag 実装と同じ task で必ず入れること。
- 今回はフォルダ移動だけがスコープ。並び替え順のドラッグ保存や新規依存の追加は入れないこと。

---

## Task 1: フォルダ更新処理を共通 hook に切り出す

### Files:

- Create: `src/hooks/use-update-feed-folder.ts`
- Create: `src/__tests__/hooks/use-update-feed-folder.test.tsx`
- Create: `src/__tests__/components/rename-feed-dialog.test.tsx`
- Modify: `src/components/reader/rename-feed-dialog.tsx`
- Test: `src/__tests__/components/form-fields.test.tsx`

- [ ] **Step 1: 共通 hook の失敗テストを書く**

`src/__tests__/hooks/use-update-feed-folder.test.tsx` を作成:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { Result } from "@praha/byethrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import { useUiStore } from "@/stores/ui-store";

describe("useUpdateFeedFolder", () => {
  beforeEach(() => {
    useUiStore.setState({ ...useUiStore.getInitialState(), showToast: vi.fn() });
  });

  it("invalidates feeds after a successful update", async () => {
    vi.spyOn(tauriCommands, "updateFeedFolder").mockResolvedValue(Result.succeed(null));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateFeedFolder(), { wrapper });

    await result.current.mutateAsync({ feedId: "feed-1", folderId: "folder-1" });

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["feeds"] });
    });
  });

  it("shows a toast when the update fails", async () => {
    vi.spyOn(tauriCommands, "updateFeedFolder").mockResolvedValue(
      Result.fail({ type: "UserVisible", message: "boom" }),
    );
    const showToast = vi.fn();
    useUiStore.setState({ ...useUiStore.getInitialState(), showToast });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateFeedFolder(), { wrapper });

    await expect(result.current.mutateAsync({ feedId: "feed-1", folderId: null })).rejects.toMatchObject({
      message: "boom",
    });
    expect(showToast).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: RenameDialog の継続動作テストを書く**

`src/__tests__/components/rename-feed-dialog.test.tsx` を作成:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import { RenameDialog } from "@/components/reader/rename-feed-dialog";
import { sampleFeeds } from "../../../tests/helpers/tauri-mocks";

const mutateAsync = vi.fn();

vi.mock("@/hooks/use-update-feed-folder", () => ({
  useUpdateFeedFolder: () => ({ mutateAsync }),
}));

describe("RenameDialog", () => {
  it("continues renaming and display-mode updates even when folder update fails", async () => {
    const user = userEvent.setup();
    mutateAsync.mockRejectedValueOnce({ message: "boom" });
    vi.spyOn(tauriCommands, "renameFeed").mockResolvedValue(Result.succeed(null));
    vi.spyOn(tauriCommands, "updateFeedDisplayMode").mockResolvedValue(Result.succeed(null));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <RenameDialog
          feed={{ ...sampleFeeds[0], folder_id: "folder-1", display_mode: "inherit" }}
          open={true}
          onOpenChange={() => {}}
        />
      </QueryClientProvider>,
    );

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Updated Feed");
    await user.click(screen.getByRole("combobox", { name: "Display Mode" }));
    await user.click(await screen.findByRole("option", { name: "3-Pane" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(tauriCommands.renameFeed).toHaveBeenCalledWith("feed-1", "Updated Feed");
    expect(tauriCommands.updateFeedDisplayMode).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: テストを実行して失敗を確認する**

Run: `pnpm vitest run src/__tests__/hooks/use-update-feed-folder.test.tsx`

Expected: FAIL with `Cannot find module '@/hooks/use-update-feed-folder'`

- [ ] **Step 4: 共通 hook を最小実装し、RenameDialog から安全に使う**

`src/hooks/use-update-feed-folder.ts` を作成:

```ts
import { Result } from "@praha/byethrow";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { updateFeedFolder } from "@/api/tauri-commands";
import { useUiStore } from "@/stores/ui-store";

export function useUpdateFeedFolder() {
  const qc = useQueryClient();
  const { t } = useTranslation("reader");
  const showToast = useUiStore((s) => s.showToast);

  return useMutation({
    mutationFn: async ({ feedId, folderId }: { feedId: string; folderId: string | null }) => {
      const result = await updateFeedFolder(feedId, folderId);
      return Result.unwrap(result);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feeds"] });
    },
    onError: (error: { message: string }) => {
      showToast(t("failed_to_update_folder", { message: error.message }));
    },
  });
}
```

`src/components/reader/rename-feed-dialog.tsx` を更新:

```tsx
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";

const updateFeedFolderMutation = useUpdateFeedFolder();

if (selectedFolderId !== feed.folder_id) {
  await updateFeedFolderMutation.mutateAsync({ feedId: feed.id, folderId: selectedFolderId }).catch(() => undefined);
}
```

ポイント:

- `RenameDialog` 側の `qc.invalidateQueries({ queryKey: ["feeds"] })` は folder 更新専用ではなく、rename/display mode の後にも必要なので残す
- folder 更新の失敗 toast は hook に寄せ、dialog/container ごとの重複を消す
- `mutateAsync` の reject はここで握って、rename/display mode 更新まで続行する
- dialog の `loading` と `onOpenChange(false)` は従来どおり submit の最後まで進める

- [ ] **Step 5: hook と RenameDialog 回帰テストを再実行する**

Run:

```bash
pnpm vitest run src/__tests__/hooks/use-update-feed-folder.test.tsx src/__tests__/components/rename-feed-dialog.test.tsx src/__tests__/components/form-fields.test.tsx
```

Expected: PASS

- [ ] **Step 6: コミットする**

```bash
git add src/hooks/use-update-feed-folder.ts src/__tests__/hooks/use-update-feed-folder.test.tsx src/__tests__/components/rename-feed-dialog.test.tsx src/components/reader/rename-feed-dialog.tsx
git commit -m "refactor: share feed folder update mutation"
```

---

## Task 2: FeedTreeView に drag handle と drop target を追加する

### Files:

- Modify: `src/components/reader/feed-tree-view.tsx`
- Modify: `src/components/reader/feed-tree-view.stories.tsx`
- Modify: `src/__tests__/components/feed-tree-view.test.tsx`

- [ ] **Step 1: FeedTreeView の失敗テストを書く**

`src/__tests__/components/feed-tree-view.test.tsx` に追加:

```tsx
it("starts dragging from the handle and drops onto a folder target", () => {
  const onDragStartFeed = vi.fn();
  const onDropToFolder = vi.fn();

  render(
    <FeedTreeView
      isOpen={true}
      canDragFeeds={true}
      draggedFeedId={null}
      activeDropTarget={null}
      folders={[
        {
          id: "folder-empty",
          name: "Empty",
          accountId: "acc-1",
          sortOrder: 1,
          unreadCount: 0,
          isExpanded: false,
          feeds: [],
        },
      ]}
      unfolderedFeeds={[
        {
          id: "feed-2",
          accountId: "acc-1",
          folderId: null,
          title: "Beta",
          url: "https://example.com/beta.xml",
          siteUrl: "https://example.com/beta",
          unreadCount: 1,
          displayMode: "normal",
          isSelected: false,
          grayscaleFavicon: false,
        },
      ]}
      onToggleFolder={vi.fn()}
      onSelectFeed={vi.fn()}
      onDragStartFeed={onDragStartFeed}
      onDragEnterFolder={vi.fn()}
      onDragEnterUnfoldered={vi.fn()}
      onDropToFolder={onDropToFolder}
      onDropToUnfoldered={vi.fn()}
      onDragEnd={vi.fn()}
      displayFavicons={false}
      emptyState={{ kind: "message", message: "No feeds yet" }}
    />,
  );

  const handle = screen.getByRole("button", { name: "Drag Beta" });
  const folderTarget = screen.getByRole("button", { name: /Empty/ });
  const dataTransfer = {
    effectAllowed: "move",
    setData: vi.fn(),
    getData: vi.fn(() => "feed-2"),
  };

  fireEvent.dragStart(handle, { dataTransfer });
  fireEvent.dragOver(folderTarget, { dataTransfer });
  fireEvent.drop(folderTarget, { dataTransfer });

  expect(onDragStartFeed).toHaveBeenCalledWith(expect.objectContaining({ id: "feed-2" }));
  expect(onDropToFolder).toHaveBeenCalledWith("folder-empty");
});

it("renders the unfoldered drop zone highlight when active", () => {
  render(
    <FeedTreeView
      isOpen={true}
      canDragFeeds={true}
      draggedFeedId="feed-1"
      activeDropTarget={{ kind: "unfoldered" }}
      folders={[]}
      unfolderedFeeds={[]}
      onToggleFolder={vi.fn()}
      onSelectFeed={vi.fn()}
      onDragStartFeed={vi.fn()}
      onDragEnterFolder={vi.fn()}
      onDragEnterUnfoldered={vi.fn()}
      onDropToFolder={vi.fn()}
      onDropToUnfoldered={vi.fn()}
      onDragEnd={vi.fn()}
      displayFavicons={false}
      emptyState={{ kind: "message", message: "No feeds yet" }}
    />,
  );

  expect(screen.getByTestId("unfoldered-drop-zone")).toHaveClass("border-dashed");
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm vitest run src/__tests__/components/feed-tree-view.test.tsx`

Expected: FAIL because the new props, handle button, and drop zone do not exist yet

- [ ] **Step 3: FeedTreeView をドラッグ対応に最小実装する**

`src/components/reader/feed-tree-view.tsx` を更新:

```tsx
export type ActiveDropTarget =
  | { kind: "folder"; folderId: string }
  | { kind: "unfoldered" }
  | null;

export type FeedTreeViewProps = {
  // existing props...
  canDragFeeds?: boolean;
  draggedFeedId?: string | null;
  activeDropTarget?: ActiveDropTarget;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onDragEnterFolder?: (folderId: string) => void;
  onDragEnterUnfoldered?: () => void;
  onDropToFolder?: (folderId: string) => void;
  onDropToUnfoldered?: () => void;
  onDragEnd?: () => void;
};
```

`FeedRow` は handle を row button の sibling にする:

```tsx
<div className="group/feed-row flex items-center gap-1">
  {canDragFeeds ? (
    <button
      type="button"
      aria-label={`Drag ${feed.title}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", feed.id);
        onDragStartFeed?.(feed);
      }}
      onDragEnd={() => onDragEnd?.()}
      className="opacity-0 transition-opacity group-hover/feed-row:opacity-100"
    >
      ⋮⋮
    </button>
  ) : null}
  <ContextMenu.Trigger render={<SidebarNavButton ... />} onClick={() => onSelectFeed(feed.id)}>
    ...
  </ContextMenu.Trigger>
</div>
```

folder row / unfoldered zone は `onDragOver={(e) => e.preventDefault()}` を持ち、active target のときだけ highlight class を足す。

ポイント:

- `SidebarNavButton` 自体は `button` のまま使い、handle を外側 wrapper に置いて button ネストを避ける
- empty folder も row を描画し、`folder.feeds.length === 0` でも drop target にする
- `hasFeeds` 判定は `folders.length > 0 || unfolderedFeeds.length > 0` のままでよい

- [ ] **Step 4: Storybook args を更新する**

`src/components/reader/feed-tree-view.stories.tsx` に追加:

```tsx
args: {
  canDragFeeds: true,
  draggedFeedId: null,
  activeDropTarget: null,
  onDragStartFeed: fn(),
  onDragEnterFolder: fn(),
  onDragEnterUnfoldered: fn(),
  onDropToFolder: fn(),
  onDropToUnfoldered: fn(),
  onDragEnd: fn(),
}
```

さらに empty folder story を 1 つ追加:

```tsx
export const EmptyFolderTarget: Story = {
  args: {
    folders: [
      {
        id: "folder-empty",
        name: "Empty",
        accountId: "acc-1",
        sortOrder: 2,
        unreadCount: 0,
        isExpanded: false,
        feeds: [],
      },
    ],
  },
};
```

- [ ] **Step 5: FeedTreeView テストを再実行する**

Run: `pnpm vitest run src/__tests__/components/feed-tree-view.test.tsx`

Expected: PASS

- [ ] **Step 6: コミットする**

```bash
git add src/components/reader/feed-tree-view.tsx src/components/reader/feed-tree-view.stories.tsx src/__tests__/components/feed-tree-view.test.tsx
git commit -m "feat: add feed tree drag-and-drop presentation"
```

---

## Task 3: Sidebar に drag state と drop 保存を接続する

### Files:

- Modify: `src/components/reader/sidebar.tsx`
- Modify: `src/__tests__/components/sidebar.test.tsx`

- [ ] **Step 1: Sidebar の失敗テストを書く**

`src/__tests__/components/sidebar.test.tsx` に追加:

```tsx
it("updates a feed folder when dropping onto an empty folder", async () => {
  const user = userEvent.setup();
  const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];

  setupTauriMocks((cmd, args) => {
    calls.push({ cmd, args });
    switch (cmd) {
      case "list_accounts":
        return sampleAccounts;
      case "list_folders":
        return [
          { id: "folder-empty", account_id: args.accountId, name: "Empty", sort_order: 0 },
        ];
      case "list_feeds":
        return [{ ...sampleFeeds[0], title: "Tech Blog", folder_id: null }];
      case "list_account_articles":
        return [];
      case "update_feed_folder":
        return null;
      default:
        return null;
    }
  });

  render(<Sidebar />, { wrapper: createWrapper() });

  const handle = await screen.findByRole("button", { name: "Drag Tech Blog" });
  const folderTarget = screen.getByRole("button", { name: /Empty/ });
  const dataTransfer = {
    effectAllowed: "move",
    setData: vi.fn(),
    getData: vi.fn(() => "feed-1"),
  };

  fireEvent.dragStart(handle, { dataTransfer });
  fireEvent.dragOver(folderTarget, { dataTransfer });
  fireEvent.drop(folderTarget, { dataTransfer });

  await waitFor(() => {
    expect(calls).toContainEqual({
      cmd: "update_feed_folder",
      args: { feedId: "feed-1", folderId: "folder-empty" },
    });
  });
});

it("does not call update_feed_folder when dropping into the same folder", async () => {
  // same setup with feed.folder_id === "folder-1"
  // expect no update_feed_folder call
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm vitest run src/__tests__/components/sidebar.test.tsx`

Expected: FAIL because `Sidebar` is not passing drag props or handling drop yet

- [ ] **Step 3: Sidebar の drag state と empty folder 表示を実装する**

`src/components/reader/sidebar.tsx` を更新:

```tsx
const [draggedFeedId, setDraggedFeedId] = useState<string | null>(null);
const [activeDropTarget, setActiveDropTarget] = useState<ActiveDropTarget>(null);
const updateFeedFolderMutation = useUpdateFeedFolder();

const feedById = useMemo(() => new Map(feedList.map((feed) => [feed.id, feed])), [feedList]);
const canDragFeeds = folderList.length > 0;
```

folder view model 生成からこの filter を削除:

```tsx
.filter((folder) => folder.feeds.length > 0)
```

drop handler を追加:

```tsx
const handleDropToFolder = async (folderId: string) => {
  if (!draggedFeedId) return;
  const draggedFeed = feedById.get(draggedFeedId);
  if (!draggedFeed || draggedFeed.folder_id === folderId) {
    setDraggedFeedId(null);
    setActiveDropTarget(null);
    return;
  }
  try {
    await updateFeedFolderMutation.mutateAsync({ feedId: draggedFeedId, folderId });
  } finally {
    setDraggedFeedId(null);
    setActiveDropTarget(null);
  }
};

const handleDropToUnfoldered = async () => {
  if (!draggedFeedId) return;
  const draggedFeed = feedById.get(draggedFeedId);
  if (!draggedFeed || draggedFeed.folder_id === null) {
    setDraggedFeedId(null);
    setActiveDropTarget(null);
    return;
  }
  try {
    await updateFeedFolderMutation.mutateAsync({ feedId: draggedFeedId, folderId: null });
  } finally {
    setDraggedFeedId(null);
    setActiveDropTarget(null);
  }
};
```

`FeedTreeView` 呼び出しを更新:

```tsx
<FeedTreeView
  ...
  canDragFeeds={canDragFeeds}
  draggedFeedId={draggedFeedId}
  activeDropTarget={activeDropTarget}
  onDragStartFeed={(feed) => setDraggedFeedId(feed.id)}
  onDragEnterFolder={(folderId) => setActiveDropTarget({ kind: "folder", folderId })}
  onDragEnterUnfoldered={() => setActiveDropTarget({ kind: "unfoldered" })}
  onDropToFolder={(folderId) => void handleDropToFolder(folderId)}
  onDropToUnfoldered={() => void handleDropToUnfoldered()}
  onDragEnd={() => {
    setDraggedFeedId(null);
    setActiveDropTarget(null);
  }}
/>
```

ポイント:

- `feedById` で移動元の `folder_id` を引き、same-target no-op を Sidebar で止める
- `canDragFeeds` は `folderList.length > 0` だけで判定し、フォルダが 0 件のアカウントでは handle を出さない
- drop handler は `try/finally` で drag state を必ずクリアし、失敗時も hover の残骸を残さない

- [ ] **Step 4: Sidebar テストを再実行する**

Run: `pnpm vitest run src/__tests__/components/sidebar.test.tsx`

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/components/reader/sidebar.tsx src/__tests__/components/sidebar.test.tsx
git commit -m "feat: move feeds between folders from sidebar"
```

---

## Task 4: 回帰検証と手動確認を完了する

### Files:

- Modify: なし

- [ ] **Step 1: 変更ユニットのテストをまとめて実行する**

Run:

```bash
pnpm vitest run src/__tests__/hooks/use-update-feed-folder.test.tsx src/__tests__/components/feed-tree-view.test.tsx src/__tests__/components/sidebar.test.tsx src/__tests__/components/form-fields.test.tsx
```

Expected: PASS

- [ ] **Step 2: 型チェックを実行する**

Run: `pnpm exec tsc --noEmit`

Expected: PASS

- [ ] **Step 3: プロジェクト標準のチェックを実行する**

Run: `mise run check`

Expected: PASS

注記:

- unrelated failure が出たら、今回の差分起因か既存起因かを切り分けて記録する
- スコープ外の修正で `mise run check` 全体を通しにいかない

- [ ] **Step 4: サイドバーの手動確認を行う**

Run: `mise run app:dev:browser`

確認項目:

- フォルダ配下のフィードを別フォルダへ移動できる
- unfoldered のフィードを既存フォルダへ移動できる
- フィードを「フォルダなし」drop zone へ戻せる
- empty folder にも drop できる
- hover していないときは drag handle が目立たず、hover 時にだけ見える
- row の通常 click で従来どおりフィード選択できる
- 右クリック context menu が従来どおり開く
- フォルダ 0 件のアカウントでは drag handle が出ない

- [ ] **Step 5: 最終報告をまとめる**

報告に含める:

- 変更したファイル一覧
- 実行した検証コマンドと結果
- 手動確認の結果
- 未解決事項があれば、その条件と再現手順
