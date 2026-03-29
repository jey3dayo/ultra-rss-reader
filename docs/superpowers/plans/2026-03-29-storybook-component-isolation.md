# Storybook Component Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: `reader` / `settings` UI を Storybook と Vitest で独立検証できる `View` 単位へ切り出し、既存の巨大コンポーネントを薄い `Container` に整理する。

Architecture: 既存の公開コンポーネント (`sidebar.tsx`, `article-view.tsx` など) は当面 `Container` として残し、表示責務だけを sibling file の `*-view.tsx` へ抽出する。外部依存は `Container` に閉じ込め、`View` は fixture だけで Storybook 表示できる props 形へ正規化する。各バッチで View test、Container test、Storybook story、`dev-browser` smoke を揃えて進める。

Tech Stack: React 19, TypeScript, Vitest, Testing Library, Storybook 10, dev-browser, Zustand, React Query, react-i18next, Tailwind CSS, Base UI

Spec: `docs/superpowers/specs/2026-03-29-storybook-component-isolation-design.md`

---

## File Map

### Phase 1: Reader Top-Level Views

#### Sidebar

- Create: `src/components/reader/sidebar-header-view.tsx`
- Create: `src/components/reader/account-switcher-view.tsx`
- Create: `src/components/reader/smart-views-view.tsx`
- Create: `src/components/reader/feed-tree-view.tsx`
- Create: `src/components/reader/tag-list-view.tsx`
- Create: `src/components/reader/sidebar-header-view.stories.tsx`
- Create: `src/components/reader/account-switcher-view.stories.tsx`
- Create: `src/components/reader/smart-views-view.stories.tsx`
- Create: `src/components/reader/feed-tree-view.stories.tsx`
- Create: `src/components/reader/tag-list-view.stories.tsx`
- Create: `src/__tests__/components/sidebar-header-view.test.tsx`
- Create: `src/__tests__/components/account-switcher-view.test.tsx`
- Create: `src/__tests__/components/smart-views-view.test.tsx`
- Create: `src/__tests__/components/feed-tree-view.test.tsx`
- Create: `src/__tests__/components/tag-list-view.test.tsx`
- Modify: `src/components/reader/sidebar.tsx`
- Modify: `src/__tests__/components/sidebar.test.tsx`

#### Article View

- Create: `src/components/reader/article-toolbar-view.tsx`
- Create: `src/components/reader/article-meta-view.tsx`
- Create: `src/components/reader/article-content-view.tsx`
- Create: `src/components/reader/article-empty-state-view.tsx`
- Create: `src/components/reader/article-tag-picker-view.tsx`
- Create: `src/components/reader/article-toolbar-view.stories.tsx`
- Create: `src/components/reader/article-meta-view.stories.tsx`
- Create: `src/components/reader/article-content-view.stories.tsx`
- Create: `src/components/reader/article-empty-state-view.stories.tsx`
- Create: `src/components/reader/article-tag-picker-view.stories.tsx`
- Create: `src/__tests__/components/article-toolbar-view.test.tsx`
- Create: `src/__tests__/components/article-meta-view.test.tsx`
- Create: `src/__tests__/components/article-content-view.test.tsx`
- Create: `src/__tests__/components/article-empty-state-view.test.tsx`
- Create: `src/__tests__/components/article-tag-picker-view.test.tsx`
- Modify: `src/components/reader/article-view.tsx`
- Modify: `src/__tests__/components/article-view.test.tsx`

#### Article List

- Create: `src/components/reader/article-list-screen-view.tsx`
- Create: `src/components/reader/article-groups-view.tsx`
- Create: `src/components/reader/article-list-screen-view.stories.tsx`
- Create: `src/components/reader/article-groups-view.stories.tsx`
- Create: `src/__tests__/components/article-list-screen-view.test.tsx`
- Create: `src/__tests__/components/article-groups-view.test.tsx`
- Modify: `src/components/reader/article-list.tsx`
- Modify: `src/__tests__/components/article-list.test.tsx`

### Phase 2: Reader Dialogs and Menus

- Create: `src/components/reader/discovered-feed-options-view.tsx`
- Create: `src/components/reader/folder-select-view.tsx`
- Create: `src/components/reader/add-feed-dialog-view.tsx`
- Create: `src/components/reader/rename-tag-dialog-view.tsx`
- Create: `src/components/reader/delete-tag-dialog-view.tsx`
- Create: `src/components/reader/tag-context-menu-view.tsx`
- Create: matching `*.stories.tsx`
- Create: matching `src/__tests__/components/*.test.tsx`
- Modify: `src/components/reader/add-feed-dialog.tsx`
- Modify: `src/components/reader/tag-context-menu.tsx`

### Phase 3: Settings

- Create: `src/components/settings/settings-nav-view.tsx`
- Create: `src/components/settings/accounts-nav-view.tsx`
- Create: `src/components/settings/settings-modal-view.tsx`
- Create: `src/components/settings/account-general-section-view.tsx`
- Create: `src/components/settings/account-sync-section-view.tsx`
- Create: `src/components/settings/account-danger-zone-view.tsx`
- Create: `src/components/settings/account-detail-view.tsx`
- Create: matching `*.stories.tsx`
- Create: matching `src/__tests__/components/*.test.tsx`
- Modify: `src/components/settings/settings-modal.tsx`
- Modify: `src/components/settings/account-detail.tsx`
- Modify: `src/__tests__/components/settings-modal.test.tsx`

### Phase 4: Remaining Reader and Settings Surfaces

- Modify: `src/components/reader/rename-feed-dialog.tsx`
- Modify: `src/components/reader/unsubscribe-feed-dialog.tsx`
- Modify: `src/components/reader/article-context-menu.tsx`
- Modify: `src/components/reader/feed-context-menu.tsx`
- Modify: `src/components/reader/folder-context-menu.tsx`
- Modify: `src/components/reader/feed-item.tsx`
- Modify: `src/components/reader/folder-section.tsx`
- Modify: `src/components/settings/add-account-form.tsx`
- Modify: `src/components/settings/general-settings.tsx`
- Modify: `src/components/settings/appearance-settings.tsx`
- Modify: `src/components/settings/reading-settings.tsx`
- Modify: `src/components/settings/shortcuts-settings.tsx`
- Modify: `src/components/settings/actions-settings.tsx`
- Create: 必要な `*-view.tsx`, `*.stories.tsx`, `src/__tests__/components/*.test.tsx`

### Shared Verification

- Modify: `package.json` only if Storybook or test scripts truly need追加変更
- Run: `pnpm vitest run ...`
- Run: `pnpm storybook`
- Run: `pnpm exec dev-browser ...`
- Run: `mise run check`

---

## Verification Conventions

### Storybook Server

- [ ] 別ターミナルで Storybook を起動する

```bash
pnpm storybook
```

Expected: `Local: http://localhost:6006`

### dev-browser Smoke Template

- [ ] 影響した story ごとに次の形式で smoke test する

```bash
pnpm exec dev-browser --browser ultra-storybook <<'EOF'
const page = await browser.getPage("storybook");
await page.goto("http://127.0.0.1:6006/?path=/story/REPLACE_ME");
await page.waitForLoadState("networkidle");
console.log(JSON.stringify({
  url: page.url(),
  title: await page.title()
}, null, 2));
EOF
```

Expected: 対象 story URL と Storybook title が表示される

---

## Task 1: Sidebar Header と Account Switcher の View を抽出する

### Files

- Create: `src/components/reader/sidebar-header-view.tsx`
- Create: `src/components/reader/account-switcher-view.tsx`
- Create: `src/components/reader/sidebar-header-view.stories.tsx`
- Create: `src/components/reader/account-switcher-view.stories.tsx`
- Create: `src/__tests__/components/sidebar-header-view.test.tsx`
- Create: `src/__tests__/components/account-switcher-view.test.tsx`
- Modify: `src/components/reader/sidebar.tsx`
- Test: `src/__tests__/components/sidebar.test.tsx`

- [ ] **Step 1: View test と story を先に追加する**

`SidebarHeaderView` は `lastSyncedLabel`, `isSyncing`, `canAddFeed`, `onSync`, `onAddFeed` を props で受ける形にする。`AccountSwitcherView` は `accounts`, `selectedAccountId`, `expanded`, `onToggle`, `onSelectAccount`, `onClose` を props に寄せ、menu の a11y 属性を test で固定する。

- [ ] **Step 2: View test が失敗することを確認する**

```bash
pnpm vitest run src/__tests__/components/sidebar-header-view.test.tsx src/__tests__/components/account-switcher-view.test.tsx
```

Expected: FAIL with module not found or missing export

- [ ] **Step 3: minimal View 実装を作り、`sidebar.tsx` から差し替える**

`sidebar.tsx` 側は store/query/event を維持しつつ、表示用 props だけを new View へ渡す。outside click と roving focus は親か小さな hook に残してよいが、menu の DOM は `AccountSwitcherView` に寄せる。

- [ ] **Step 4: View test と既存 container test を通す**

```bash
pnpm vitest run src/__tests__/components/sidebar-header-view.test.tsx src/__tests__/components/account-switcher-view.test.tsx src/__tests__/components/sidebar.test.tsx
```

Expected: PASS

- [ ] **Step 5: Storybook と dev-browser で smoke test し commit する**

Story: `reader-sidebarheaderview--default`, `reader-accountswitcherview--expanded`

```bash
git add src/components/reader/sidebar.tsx src/components/reader/sidebar-header-view.tsx src/components/reader/account-switcher-view.tsx src/components/reader/*.stories.tsx src/__tests__/components/sidebar-header-view.test.tsx src/__tests__/components/account-switcher-view.test.tsx src/__tests__/components/sidebar.test.tsx
git commit -m "refactor: extract sidebar header views"
```

---

## Task 2: Sidebar の Smart View / FeedTree / TagList を抽出する

### Files

- Create: `src/components/reader/smart-views-view.tsx`
- Create: `src/components/reader/feed-tree-view.tsx`
- Create: `src/components/reader/tag-list-view.tsx`
- Create: matching `*.stories.tsx`
- Create: `src/__tests__/components/smart-views-view.test.tsx`
- Create: `src/__tests__/components/feed-tree-view.test.tsx`
- Create: `src/__tests__/components/tag-list-view.test.tsx`
- Modify: `src/components/reader/sidebar.tsx`
- Test: `src/__tests__/components/sidebar.test.tsx`

- [ ] **Step 1: View test と story を追加する**

`FeedTreeView` は folder/feed/tag の raw DTO を直接受けず、render に必要な `items` props へ正規化する。選択中、unread count 表示、empty state を fixture で再現する。

- [ ] **Step 2: View test の失敗を確認する**

```bash
pnpm vitest run src/__tests__/components/smart-views-view.test.tsx src/__tests__/components/feed-tree-view.test.tsx src/__tests__/components/tag-list-view.test.tsx
```

Expected: FAIL

- [ ] **Step 3: `sidebar.tsx` から lists を View へ差し替える**

`groupFeedsByFolder` と sort 結果を使って props を組み立て、`FolderSection` / `FeedItem` の再利用が必要なら `FeedTreeView` 内で compose する。`TagContextMenuContent` が外部依存を持つので、Tag row の表示部だけを `TagListView` に寄せる。

- [ ] **Step 4: targeted test を通す**

```bash
pnpm vitest run src/__tests__/components/smart-views-view.test.tsx src/__tests__/components/feed-tree-view.test.tsx src/__tests__/components/tag-list-view.test.tsx src/__tests__/components/sidebar.test.tsx
```

Expected: PASS

- [ ] **Step 5: Storybook smoke と commit**

Story: `reader-smartviewsview--default`, `reader-feedtreeview--with-folders`, `reader-taglistview--selected`

```bash
git add src/components/reader/sidebar.tsx src/components/reader/smart-views-view.tsx src/components/reader/feed-tree-view.tsx src/components/reader/tag-list-view.tsx src/components/reader/*.stories.tsx src/__tests__/components/*.test.tsx
git commit -m "refactor: isolate sidebar list views"
```

---

## Task 3: Article Toolbar / Meta / Content / Empty State を抽出する

### Files

- Create: `src/components/reader/article-toolbar-view.tsx`
- Create: `src/components/reader/article-meta-view.tsx`
- Create: `src/components/reader/article-content-view.tsx`
- Create: `src/components/reader/article-empty-state-view.tsx`
- Create: matching `*.stories.tsx`
- Create: matching `src/__tests__/components/*.test.tsx`
- Modify: `src/components/reader/article-view.tsx`
- Test: `src/__tests__/components/article-view.test.tsx`

- [ ] **Step 1: View test と story を追加する**

`ArticleToolbarView` は read/star/link/browser actions を callback で受ける。`ArticleContentView` は sanitized HTML と thumbnail 有無だけを描画する。`ArticleMetaView` は title, author, feedName, publishedLabel を props にまとめる。

- [ ] **Step 2: View test の失敗を確認する**

```bash
pnpm vitest run src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-meta-view.test.tsx src/__tests__/components/article-content-view.test.tsx src/__tests__/components/article-empty-state-view.test.tsx
```

Expected: FAIL

- [ ] **Step 3: `article-view.tsx` から表示責務を移す**

keyboard event listener、store mutation、`handleContentClick` の外部遷移判断は親に残し、DOM は View へ寄せる。`ArticleReader` が担っている layout と view compose だけを最小化する。

- [ ] **Step 4: targeted test を通す**

```bash
pnpm vitest run src/__tests__/components/article-toolbar-view.test.tsx src/__tests__/components/article-meta-view.test.tsx src/__tests__/components/article-content-view.test.tsx src/__tests__/components/article-empty-state-view.test.tsx src/__tests__/components/article-view.test.tsx
```

Expected: PASS

- [ ] **Step 5: Storybook smoke と commit**

Story: `reader-articletoolbarview--default`, `reader-articlecontentview--with-thumbnail`, `reader-articleemptystateview--default`

```bash
git add src/components/reader/article-view.tsx src/components/reader/article-*-view.tsx src/components/reader/*.stories.tsx src/__tests__/components/article-*-view.test.tsx src/__tests__/components/article-view.test.tsx
git commit -m "refactor: extract article reader views"
```

---

## Task 4: Article Tag Picker View を抽出する

### Files

- Create: `src/components/reader/article-tag-picker-view.tsx`
- Create: `src/components/reader/article-tag-picker-view.stories.tsx`
- Create: `src/__tests__/components/article-tag-picker-view.test.tsx`
- Modify: `src/components/reader/article-view.tsx`
- Test: `src/__tests__/components/article-view.test.tsx`

- [ ] **Step 1: View test と story を追加する**

`ArticleTagPickerView` は `assignedTags`, `availableTags`, `newTagName`, `expanded`, `onToggle`, `onAssign`, `onCreate`, `onRemove`, `onDraftChange` を props 化し、open/close や highlighted index のような ephemeral UI state だけをローカルで持つ。

- [ ] **Step 2: test の失敗を確認する**

```bash
pnpm vitest run src/__tests__/components/article-tag-picker-view.test.tsx
```

Expected: FAIL

- [ ] **Step 3: `article-view.tsx` から mutation を親へ寄せて差し替える**

`useArticleTags`, `useTags`, `useCreateTag`, `useTagArticle`, `useUntagArticle` は親に残し、View には async status と callbacks だけを渡す。focus 管理が煩雑なら `use-tag-picker.ts` を追加してよい。

- [ ] **Step 4: targeted test を通す**

```bash
pnpm vitest run src/__tests__/components/article-tag-picker-view.test.tsx src/__tests__/components/article-view.test.tsx
```

Expected: PASS

- [ ] **Step 5: Storybook smoke と commit**

Story: `reader-articletagpickerview--default`, `reader-articletagpickerview--expanded`

```bash
git add src/components/reader/article-view.tsx src/components/reader/article-tag-picker-view.tsx src/components/reader/article-tag-picker-view.stories.tsx src/__tests__/components/article-tag-picker-view.test.tsx src/__tests__/components/article-view.test.tsx
git commit -m "refactor: isolate article tag picker view"
```

---

## Task 5: Article List Screen / Groups View を抽出する

### Files

- Create: `src/components/reader/article-list-screen-view.tsx`
- Create: `src/components/reader/article-groups-view.tsx`
- Create: matching `*.stories.tsx`
- Create: matching `src/__tests__/components/*.test.tsx`
- Modify: `src/components/reader/article-list.tsx`
- Test: `src/__tests__/components/article-list.test.tsx`

- [ ] **Step 1: View test と story を追加する**

`ArticleGroupsView` は `groups`, `groupBy`, `selectedArticleId`, `recentlyReadIds`, `onSelectArticle` を props にし、loading/empty/grouped state を fixture 化する。既存 `ArticleListHeader`, `ArticleListFooter`, `ArticleListItem` は compose 前提で再利用する。

- [ ] **Step 2: test の失敗を確認する**

```bash
pnpm vitest run src/__tests__/components/article-list-screen-view.test.tsx src/__tests__/components/article-groups-view.test.tsx
```

Expected: FAIL

- [ ] **Step 3: `article-list.tsx` を thin container にする**

検索 debounce、React Query、keyboard event、mark-all-read mutation は親に残し、list body 描画だけを `ArticleListScreenView` へ移す。

- [ ] **Step 4: targeted test を通す**

```bash
pnpm vitest run src/__tests__/components/article-list-screen-view.test.tsx src/__tests__/components/article-groups-view.test.tsx src/__tests__/components/article-list.test.tsx
```

Expected: PASS

- [ ] **Step 5: Storybook smoke と commit**

Story: `reader-articlelistscreenview--grouped`, `reader-articlegroupsview--empty`

```bash
git add src/components/reader/article-list.tsx src/components/reader/article-list-screen-view.tsx src/components/reader/article-groups-view.tsx src/components/reader/*.stories.tsx src/__tests__/components/article-list*.test.tsx src/__tests__/components/article-groups-view.test.tsx
git commit -m "refactor: isolate article list views"
```

---

## Task 6: Add Feed Dialog の View を抽出する

### Files

- Create: `src/components/reader/discovered-feed-options-view.tsx`
- Create: `src/components/reader/folder-select-view.tsx`
- Create: `src/components/reader/add-feed-dialog-view.tsx`
- Create: matching `*.stories.tsx`
- Create: matching `src/__tests__/components/*.test.tsx`
- Modify: `src/components/reader/add-feed-dialog.tsx`
- Test: `src/__tests__/components/add-feed-dialog.test.tsx`

- [ ] **Step 1: View test と story を追加する**

`AddFeedDialogView` は `url`, `folderOptions`, `isCreatingFolder`, `discoveredFeeds`, `selectedFeedUrl`, `error`, `successMessage`, `loading`, `discovering` を props にし、input draft だけを View 内ローカル state に残すか、親 state のままでもよいが API 呼び出しは持ち込まない。

- [ ] **Step 2: test の失敗を確認する**

```bash
pnpm vitest run src/__tests__/components/add-feed-dialog-view.test.tsx src/__tests__/components/discovered-feed-options-view.test.tsx src/__tests__/components/folder-select-view.test.tsx
```

Expected: FAIL

- [ ] **Step 3: `add-feed-dialog.tsx` を thin container にする**

`discoverFeeds`, `addLocalFeed`, `createFolder`, `updateFeedFolder`, query invalidation は親に残し、dialog body を `AddFeedDialogView` に委譲する。

- [ ] **Step 4: targeted test を通す**

```bash
pnpm vitest run src/__tests__/components/add-feed-dialog-view.test.tsx src/__tests__/components/discovered-feed-options-view.test.tsx src/__tests__/components/folder-select-view.test.tsx src/__tests__/components/add-feed-dialog.test.tsx
```

Expected: PASS

- [ ] **Step 5: Storybook smoke と commit**

Story: `reader-addfeeddialogview--default`, `reader-addfeeddialogview--multiple-results`, `reader-addfeeddialogview--error`

```bash
git add src/components/reader/add-feed-dialog.tsx src/components/reader/*feed*-view.tsx src/components/reader/*.stories.tsx src/__tests__/components/*feed*-view.test.tsx src/__tests__/components/add-feed-dialog.test.tsx
git commit -m "refactor: isolate add feed dialog views"
```

---

## Task 7: Tag Context Menu の View を抽出する

### Files

- Create: `src/components/reader/rename-tag-dialog-view.tsx`
- Create: `src/components/reader/delete-tag-dialog-view.tsx`
- Create: `src/components/reader/tag-context-menu-view.tsx`
- Create: matching `*.stories.tsx`
- Create: matching `src/__tests__/components/*.test.tsx`
- Modify: `src/components/reader/tag-context-menu.tsx`

- [ ] **Step 1: View test と story を追加する**

rename/delete dialog は `open`, `name`, `loading`, `error`, `onConfirm`, `onCancel`, `onDraftChange` を props に寄せる。削除 confirmation copy と destructive button state を fixture 化する。

- [ ] **Step 2: test の失敗を確認する**

```bash
pnpm vitest run src/__tests__/components/rename-tag-dialog-view.test.tsx src/__tests__/components/delete-tag-dialog-view.test.tsx src/__tests__/components/tag-context-menu-view.test.tsx
```

Expected: FAIL

- [ ] **Step 3: `tag-context-menu.tsx` の mutation を親へ残して差し替える**

`useRenameTag`, `useDeleteTag`, toast 呼び出しは親に残し、Dialog DOM と menu DOM は View 化する。

- [ ] **Step 4: targeted test を通す**

```bash
pnpm vitest run src/__tests__/components/rename-tag-dialog-view.test.tsx src/__tests__/components/delete-tag-dialog-view.test.tsx src/__tests__/components/tag-context-menu-view.test.tsx
```

Expected: PASS

- [ ] **Step 5: Storybook smoke と commit**

Story: `reader-renametagdialogview--default`, `reader-deletetagdialogview--default`

```bash
git add src/components/reader/tag-context-menu.tsx src/components/reader/*tag*-view.tsx src/components/reader/*.stories.tsx src/__tests__/components/*tag*-view.test.tsx
git commit -m "refactor: isolate tag context menu views"
```

---

## Task 8: Settings Modal の View を抽出する

### Files

- Create: `src/components/settings/settings-nav-view.tsx`
- Create: `src/components/settings/accounts-nav-view.tsx`
- Create: `src/components/settings/settings-modal-view.tsx`
- Create: matching `*.stories.tsx`
- Create: matching `src/__tests__/components/*.test.tsx`
- Modify: `src/components/settings/settings-modal.tsx`
- Test: `src/__tests__/components/settings-modal.test.tsx`

- [ ] **Step 1: View test と story を追加する**

`SettingsModalView` は `open`, `navItems`, `accounts`, `activeCategory`, `activeAccountId`, `showAddAccount`, `onClose`, `onSelectCategory`, `onSelectAccount`, `onStartAddAccount` を props に寄せる。

- [ ] **Step 2: test の失敗を確認する**

```bash
pnpm vitest run src/__tests__/components/settings-modal-view.test.tsx src/__tests__/components/settings-nav-view.test.tsx src/__tests__/components/accounts-nav-view.test.tsx
```

Expected: FAIL

- [ ] **Step 3: `settings-modal.tsx` を thin container にする**

auto-select account の effect と store state 管理は親に残し、modal navigation DOM を view に移す。

- [ ] **Step 4: targeted test を通す**

```bash
pnpm vitest run src/__tests__/components/settings-modal-view.test.tsx src/__tests__/components/settings-nav-view.test.tsx src/__tests__/components/accounts-nav-view.test.tsx src/__tests__/components/settings-modal.test.tsx
```

Expected: PASS

- [ ] **Step 5: Storybook smoke と commit**

Story: `settings-settingsmodalview--general`, `settings-settingsmodalview--account-selected`

```bash
git add src/components/settings/settings-modal.tsx src/components/settings/*view.tsx src/components/settings/*.stories.tsx src/__tests__/components/settings-*.test.tsx src/__tests__/components/settings-modal.test.tsx
git commit -m "refactor: isolate settings modal views"
```

---

## Task 9: Account Detail の View を抽出する

### Files

- Create: `src/components/settings/account-general-section-view.tsx`
- Create: `src/components/settings/account-sync-section-view.tsx`
- Create: `src/components/settings/account-danger-zone-view.tsx`
- Create: `src/components/settings/account-detail-view.tsx`
- Create: matching `*.stories.tsx`
- Create: matching `src/__tests__/components/*.test.tsx`
- Modify: `src/components/settings/account-detail.tsx`

- [ ] **Step 1: View test と story を追加する**

`AccountDetailView` は `account`, `editingName`, `nameDraft`, `confirmDelete`, `syncIntervalOptions`, `keepReadItemsOptions`, `onStartEdit`, `onDraftChange`, `onCommitRename`, `onCancelRename`, `onChangeSync`, `onExportOpml`, `onConfirmDelete`, `onDelete` を props で受ける。

- [ ] **Step 2: test の失敗を確認する**

```bash
pnpm vitest run src/__tests__/components/account-detail-view.test.tsx src/__tests__/components/account-general-section-view.test.tsx src/__tests__/components/account-sync-section-view.test.tsx src/__tests__/components/account-danger-zone-view.test.tsx
```

Expected: FAIL

- [ ] **Step 3: `account-detail.tsx` から async 処理を親へ残して差し替える**

`renameAccount`, `updateAccountSync`, `exportOpml`, `deleteAccount`, cache 更新は親に残し、section DOM を View 化する。

- [ ] **Step 4: targeted test を通す**

```bash
pnpm vitest run src/__tests__/components/account-detail-view.test.tsx src/__tests__/components/account-general-section-view.test.tsx src/__tests__/components/account-sync-section-view.test.tsx src/__tests__/components/account-danger-zone-view.test.tsx
```

Expected: PASS

- [ ] **Step 5: Storybook smoke と commit**

Story: `settings-accountdetailview--local-account`, `settings-accountdetailview--confirm-delete`

```bash
git add src/components/settings/account-detail.tsx src/components/settings/account-*-view.tsx src/components/settings/*.stories.tsx src/__tests__/components/account-*.test.tsx
git commit -m "refactor: isolate account detail views"
```

---

## Task 10: Remaining Reader Dialogs と Context Menus を順次 View 化する

### Files

- Modify: `src/components/reader/rename-feed-dialog.tsx`
- Modify: `src/components/reader/unsubscribe-feed-dialog.tsx`
- Modify: `src/components/reader/article-context-menu.tsx`
- Modify: `src/components/reader/feed-context-menu.tsx`
- Modify: `src/components/reader/folder-context-menu.tsx`
- Create: 必要な `*-view.tsx`, `*.stories.tsx`, `src/__tests__/components/*.test.tsx`

- [ ] **Step 1: rename/unsubscribe dialogs から着手する**

dialog body を View 化し、confirm/cancel/loading の state を fixture で story 化する。

- [ ] **Step 2: article/feed/folder context menu を View 化する**

menu item list と destructive item を DOM と callback props に分離する。

- [ ] **Step 3: targeted test を通す**

```bash
pnpm vitest run src/__tests__/components/*feed*.test.tsx src/__tests__/components/*context-menu*.test.tsx
```

Expected: PASS

- [ ] **Step 4: Storybook smoke を回す**

影響 story を `dev-browser` で開き、menu / dialog が表示されることを確認する。

- [ ] **Step 5: commit**

```bash
git add src/components/reader src/__tests__/components
git commit -m "refactor: isolate remaining reader dialogs and menus"
```

---

## Task 11: Remaining Reader List Building Blocks を View 化する

### Files

- Modify: `src/components/reader/feed-item.tsx`
- Modify: `src/components/reader/folder-section.tsx`
- Create: 必要な `*.stories.tsx`
- Create: 必要な `src/__tests__/components/*.test.tsx`

- [ ] **Step 1: `feed-item.tsx` を story-first で整理する**

favicon, selected, unread count, context menu trigger の見た目を fixture 化する。

- [ ] **Step 2: `folder-section.tsx` を story-first で整理する**

expanded / collapsed / empty folder feed list を fixture 化する。

- [ ] **Step 3: targeted test を通す**

```bash
pnpm vitest run src/__tests__/components/feed-item.test.tsx src/__tests__/components/folder-section.test.tsx
```

Expected: PASS

- [ ] **Step 4: Storybook smoke を回す**

feed row と folder section story の見た目・開閉を確認する。

- [ ] **Step 5: commit**

```bash
git add src/components/reader/feed-item.tsx src/components/reader/folder-section.tsx src/components/reader/*.stories.tsx src/__tests__/components/feed-item.test.tsx src/__tests__/components/folder-section.test.tsx
git commit -m "refactor: isolate reader list building blocks"
```

---

## Task 12: Remaining Settings Forms を順次 View 化する

### Files

- Modify: `src/components/settings/add-account-form.tsx`
- Modify: `src/components/settings/general-settings.tsx`
- Modify: `src/components/settings/appearance-settings.tsx`
- Modify: `src/components/settings/reading-settings.tsx`
- Modify: `src/components/settings/shortcuts-settings.tsx`
- Modify: `src/components/settings/actions-settings.tsx`
- Create: 必要な `*-view.tsx`, `*.stories.tsx`, `src/__tests__/components/*.test.tsx`

- [ ] **Step 1: `add-account-form.tsx` を dialog/form view に分ける**

provider 選択、入力欄、submit/disabled/error 表示を fixture 化する。

- [ ] **Step 2: settings row 群を Storybook 対象へ寄せる**

general / appearance / reading / shortcuts / actions で、store 値から独立できる row 群を View 化する。

- [ ] **Step 3: targeted test を通す**

```bash
pnpm vitest run src/__tests__/components/add-account-form.test.tsx src/__tests__/components/form-fields.test.tsx
```

Expected: PASS

- [ ] **Step 4: Storybook smoke を回す**

影響 story を `dev-browser` で開き、switch/select/input の状態差分を確認する。

- [ ] **Step 5: commit**

```bash
git add src/components/settings src/__tests__/components
git commit -m "refactor: isolate remaining settings form views"
```

---

## Task 13: Container test と story naming を整える

### Files

- Modify: `src/__tests__/components/sidebar.test.tsx`
- Modify: `src/__tests__/components/article-view.test.tsx`
- Modify: `src/__tests__/components/article-list.test.tsx`
- Modify: `src/__tests__/components/add-feed-dialog.test.tsx`
- Modify: `src/__tests__/components/settings-modal.test.tsx`
- Modify: 必要な `*.stories.tsx`

- [ ] **Step 1: container test の責務を縮小する**

View に移した描画条件分岐は View test へ移し、container test は store/query/integration behavior のみ確認する。

- [ ] **Step 2: story naming と folder 分類を揃える**

Storybook URL が安定するよう、`reader-*`, `settings-*` の naming を統一する。

- [ ] **Step 3: targeted test を通す**

```bash
pnpm vitest run src/__tests__/components/sidebar.test.tsx src/__tests__/components/article-view.test.tsx src/__tests__/components/article-list.test.tsx src/__tests__/components/add-feed-dialog.test.tsx src/__tests__/components/settings-modal.test.tsx
```

Expected: PASS

- [ ] **Step 4: Storybook smoke を回す**

各 phase で代表 story 1 つずつを `dev-browser` で確認する。

- [ ] **Step 5: commit**

```bash
git add src/__tests__/components src/components/reader/*.stories.tsx src/components/settings/*.stories.tsx
git commit -m "test: align container tests with isolated views"
```

---

## Task 14: Final Verification

### Files

- Verify only

- [ ] **Step 1: 影響した Vitest を全て通す**

```bash
pnpm vitest run src/__tests__/components src/__tests__/lib src/__tests__/hooks
```

Expected: PASS

- [ ] **Step 2: Storybook を起動して代表 story を smoke test する**

Reader と Settings の代表 story を `dev-browser` で開き、URL/title を確認する。

- [ ] **Step 3: リポジトリ標準チェックを通す**

```bash
mise run check
```

Expected: format, lint, test がすべて成功

- [ ] **Step 4: 変更内容を確認する**

```bash
git status --short
git log --oneline -5
```

Expected: 意図した変更だけが staged / committed されている

- [ ] **Step 5: 最終コミット**

```bash
git add .
git commit -m "refactor: isolate storybook-testable component views"
```
