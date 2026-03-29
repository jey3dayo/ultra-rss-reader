# Storybook-Testable Component Isolation Design

## Overview

Ultra RSS Reader の React UI を、Storybook 上で単体確認できる粒度へ切り出す。対象は `reader` と `settings` を中心とした表示コンポーネントで、Tauri command、永続ストア、React Query、グローバル store、イベント購読を直接必要としない単位を増やす。

狙いは 3 つ:

- Storybook で UI 状態を fixture だけで再現できること
- Vitest で描画と UI イベントを軽量に検証できること
- 巨大コンポーネントを `Container / View` に近づけ、責務を明確にすること

## Goals

- `props` とローカル state だけで描画できる `View` コンポーネントを増やす
- 既存の公開 API はなるべく維持し、導入コストを抑える
- Storybook、Vitest、`dev-browser` を併用した検証フローを標準化する
- `reader` / `settings` で巨大化したファイルの責務を分離する

## Non-Goals

- Tauri/Rust 側の機能追加
- デザイン刷新
- 既存 UI プリミティブ (`components/ui/*`) の全面再構成
- すべての hook を汎用化すること

## Classification Rules

### Storybook Target (`View`)

次の条件を満たすものを Storybook 対象にする。

- `props` とローカル state のみで描画できる
- `useUiStore`、`usePreferencesStore`、React Query、Tauri API、`listen()` を直接呼ばない
- `loading` / `empty` / `selected` / `error` / `disabled` の状態を fixture だけで再現できる
- callback は `onXxx` に正規化され、外部依存を持ち込まない

### Container

次の責務は `Container` に残す。

- store 購読 (`useUiStore`, `usePreferencesStore`)
- React Query / mutation / cache invalidation
- Tauri command 呼び出し
- `window` / `document` / Tauri event の購読
- 表示に必要な props への正規化

### Headless UI Logic

UI の見た目ではないが、Storybook 対象にもしたくないロジックは小さな hook に分ける。

- outside click
- roving focus
- popup open/close
- keyboard navigation

## Recommended Strategy

採用する戦略は「入口は断片先行、到達点は Container / View」。

1. Storybook 化しやすい断片を先に切り出す
2. 切り出した断片へ story と View 向け Vitest を追加する
3. その後、親ファイルを `Container` として整理する

最初から全面的に `Container / View` 化すると差分が大きい。逆に断片だけで止まると巨大親ファイルが残る。このため、差分の安全性を確保しつつ最終形へ収束できる段階的移行を採る。

## File Boundary Rules

- 既存の公開ファイル名は当面維持する
- 既存公開ファイルは `Container` 的役割を持ってよい
- 表示専用コンポーネントは sibling file に切り出す
- story と軽量テストは `View` に対して書く
- `Container` の story は原則作らない

### Naming

- 親: `sidebar.tsx`, `article-view.tsx`, `settings-modal.tsx`
- 表示専用: `sidebar-view.tsx`, `article-toolbar-view.tsx`
- 部分表示: `feed-tree-view.tsx`, `settings-nav-view.tsx`
- headless hook: `use-account-switcher.ts`, `use-tag-picker.ts`
- story: `*-view.stories.tsx`
- test: `*-view.test.tsx`

## Target Inventory

### Priority A

#### `src/components/reader/sidebar.tsx`

- `SidebarHeaderView`
- `AccountSwitcherView`
- `SmartViewsView`
- `FeedTreeView`
- `TagListView`

#### `src/components/reader/article-view.tsx`

- `ArticleToolbarView`
- `ArticleMetaView`
- `ArticleTagPickerView`
- `ArticleContentView`
- `ArticleEmptyStateView`

#### `src/components/reader/article-list.tsx`

- `ArticleListScreenView`
- `ArticleGroupsView`
- 既存 `ArticleListHeader` / `ArticleListFooter` / `ArticleListItem` は再利用

### Priority B

#### `src/components/reader/add-feed-dialog.tsx`

- `AddFeedDialogView`
- `DiscoveredFeedOptionsView`
- `FolderSelectView`

#### `src/components/reader/tag-context-menu.tsx`

- `TagContextMenuView`
- `RenameTagDialogView`
- `DeleteTagDialogView`

### Priority C

#### `src/components/settings/settings-modal.tsx`

- `SettingsModalView`
- `SettingsNavView`
- `AccountsNavView`

#### `src/components/settings/account-detail.tsx`

- `AccountDetailView`
- `AccountGeneralSectionView`
- `AccountSyncSectionView`
- `AccountDangerZoneView`

## Testing Model

### Storybook

各 `View` に対して最低限の story を用意する。

- `Default`
- `Empty`
- `Loading`
- `Selected`
- `Disabled` または `Error`

Story は外部データ取得に依存しない fixture で構成する。`createWrapper` や `setupTauriMocks` が必要なものは `View` としての切り出しが不足しているサインとみなす。

### Vitest

役割を 2 つに分ける。

- `View` テスト: props ベースの描画、コールバック発火、アクセシビリティ属性
- `Container` テスト: store/query/Tauri を伴う統合寄り確認

これにより、既存の `components` テストは薄い `Container` の統合テストへ寄せ、詳細な UI 条件分岐は `View` テストへ移す。

### dev-browser

`storybook` 起動後、`dev-browser` で story を開いて smoke test を行う。

- story が表示できること
- 基本操作ができること
- 必要な状態差分が視覚的に確認できること
- 必要に応じてスクリーンショットを保存すること

`dev-browser` は Storybook 上の実 UI 確認に使い、状態ロジックの厳密検証は Vitest に任せる。

## Rollout Order

### Phase 1: Reader Top-Level Views

- `sidebar.tsx`
- `article-view.tsx`
- `article-list.tsx`

もっとも巨大で、Storybook 分離の効果が高い領域から着手する。

### Phase 2: Reader Dialogs and Menus

- `add-feed-dialog.tsx`
- `tag-context-menu.tsx`

フォーム・ダイアログ・コンテキストメニューを Storybook 管理可能にする。

### Phase 3: Settings

- `settings-modal.tsx`
- `account-detail.tsx`

ナビゲーションと詳細フォームを `View` 群へ分解する。

## Acceptance Criteria

- 新設した `View` は Storybook 上で fixture のみで描画できる
- `View` の Vitest は `createWrapper` / `setupTauriMocks` なしで通る
- 既存公開コンポーネントは引き続きアプリから利用できる
- `Container` は外部依存を持ってよいが、JSX 条件分岐と表示責務を必要以上に抱えない
- 実装後の確認は Storybook + Vitest + 既存アプリ画面確認で行う

## Risks and Mitigations

### Risk: 切り出し後も props が store shape に引きずられる

Mitigation:

- `View` に store slice を直接渡さず、表示用の値へ正規化してから渡す

### Risk: キーボードやフォーカス制御が中途半端に分散する

Mitigation:

- 表示ロジックと独立できるものは headless hook にまとめる
- 1 つの popup / picker につき 1 つの制御 hook を原則にする

### Risk: Storybook は増えたが親の巨大化が残る

Mitigation:

- 断片切り出しだけで止めず、各フェーズの最後に親ファイルを `Container` として整理する

## Verification Flow

各バッチで次を実行する。

1. `View` を切り出す
2. Story を追加する
3. `View` 向け Vitest を追加・更新する
4. `Container` テストを必要に応じて維持・更新する
5. Storybook を起動し `dev-browser` で smoke test する
6. 既存アプリ (`vite` / `tauri dev`) 上でも最低限の動作を確認する

このフローを通らない UI 切り出しは完了扱いにしない。
