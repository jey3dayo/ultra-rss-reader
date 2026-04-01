# Sidebar Feed Drag-to-Folder Design

## Summary

サイドバーの購読一覧で、フィード行にホバーしたときだけドラッグハンドルを表示し、
そのハンドルから既存フォルダまたは「フォルダなし」領域へドロップして
購読の所属フォルダを変更できるようにする。

今回の目的は「マウス操作で素早くフォルダ移動できるようにする」ことであり、
並び順のドラッグ変更や永続化までは含めない。

## Current State

- `src/components/reader/sidebar.tsx`
  - feeds / folders の取得、表示用 view model 生成、selection 管理を担当している
  - `FeedTreeView` には描画に必要な props と context menu renderer を渡している

- `src/components/reader/feed-tree-view.tsx`
  - フォルダ行とフィード行を描画するプレゼンテーション寄りのコンポーネント
  - 現状は click による選択のみを扱い、drag-and-drop の状態やイベントは持たない

- `src/components/reader/rename-feed-dialog.tsx`
  - 既存のフィード編集導線として、タイトル変更、フォルダ変更、表示モード変更を扱っている
  - `updateFeedFolder(feed.id, selectedFolderId)` を直接呼び、成功後に `["feeds"]` query を invalidate している

- `src/api/tauri-commands.ts`
  - `updateFeedFolder(feedId, folderId)` があり、フロントから feed の `folder_id` を更新できる

- `src-tauri/src/commands/feed_commands.rs`
  - `update_feed_folder` command が `SqliteFeedRepository::update_folder(...)` を呼んでいる
  - フィードの所属フォルダ変更自体は既存バックエンドで対応済み

## Goals

- サイドバーからフィードを既存フォルダへドラッグ移動できる
- サイドバーからフィードを「フォルダなし」へ戻せる
- フィードを空の既存フォルダへも移動できる
- 通常の click 選択操作は壊さない
- 誤ドラッグを抑えるため、ドラッグ開始は専用ハンドルからのみ許可する
- 更新成功後は既存の再取得フローで UI が自然に最新状態へ追従する

## Non-Goals

- フィードの並び順をドラッグで変更すること
- フォルダ自体の並び替え
- 新規フォルダをドロップ操作中に作成すること
- キーボードだけで完結する drag-and-drop UI の新設
- バックエンド側の schema 変更や新しい永続化フィールドの追加

## Design

### 1. Drag handle only の操作モデルを採用する

フィード行の左端に小さなドラッグハンドル領域を追加し、
通常時は非表示、フィード行 hover 時のみ見せる。

ドラッグ開始はそのハンドルからのみ許可し、行全体は draggable にしない。
これにより、既存の「行をクリックしてフィード選択する」操作との競合を最小化する。

フィード行の本体は従来どおり button として振る舞い、ドラッグは補助操作として扱う。

### 2. Drop target はフォルダ行と「フォルダなし」領域の 2 種類に絞る

ドロップ先は以下のみに限定する。

- 既存フォルダの行
- `フィード` 見出し直下に追加する「フォルダなし」drop zone

既存フォルダは、配下フィードが 0 件でもサイドバー上に行を残し、
drag-and-drop の drop target として扱えるようにする。
現在の `Sidebar` は `folder.feeds.length > 0` のフォルダだけを view model に残しているため、
今回の変更では empty folder を表示対象から落とさないことを明示的に要求する。

`フィード` 見出し直下の drop zone は、アイドル時は薄い高さ固定の補助領域として表示し、
drag over 時は破線 border と sidebar accent 系 background で強調する。
これにより、実装とテストで同じ見た目変化を前提にできる。

フォルダ行に drag over したときは、その行だけ背景色や破線枠で強調表示する。
現在 hover している target が一目で分かることを優先する。

### 3. 更新処理は Sidebar 側で受け、共通 hook に寄せる

`Sidebar` はすでに `feeds`, `folders`, `showToast`, `queryClient` に近い位置にあるため、
drag-and-drop の結果を受けて保存を開始する責務を持つ。

ただし `RenameDialog` と drag-and-drop の両方で同じ更新処理を使いたいため、
以下をまとめた小さな hook を追加する。

- `updateFeedFolder(feedId, folderId)` 呼び出し
- 成功時の `["feeds"]` invalidate
- 必要なら unread count 系 query の invalidate
- 失敗時 toast の表示

この hook を使うことで、手動編集ダイアログとドラッグ移動で
成功/失敗時の挙動が揃う。

### 4. FeedTreeView は UI 状態とイベント通知に集中する

`FeedTreeView` は保存処理を持たず、以下のような状態とコールバックを親から受ける。

- `draggedFeedId`
- `activeDropTarget`
- `canDragFeeds`
- `onDragStartFeed(feed)`
- `onDragEnterFolder(folderId)`
- `onDragEnterUnfoldered()`
- `onDropToFolder(folderId)`
- `onDropToUnfoldered()`
- `onDragEnd()`

この分離により、描画コンポーネントは drag state の見た目と通知だけに集中できる。
保存条件の判定や API 呼び出しは `Sidebar` / 共通 hook 側に閉じ込められる。

### 5. 無意味なドラッグ開始は抑制する

移動先フォルダが 0 件で、かつフィードがすでに `folder_id = null` の場合、
ドラッグしても状態変化が起きない。

今回の方針では、少なくとも 1 つ以上のフォルダが存在しない限り、
ドラッグハンドルを出さない。

これにより、実行できない操作を UI 上に見せ続けることを避ける。

## Data Flow

### Drag to Folder

1. user がフィード行 hover でハンドルを視認する
2. user がハンドルから drag start する
3. `FeedTreeView` が `draggedFeedId` を親へ通知する
4. user がフォルダ行へ drag over する
5. `FeedTreeView` が `activeDropTarget = { kind: "folder", folderId }` を親へ通知する
6. user が drop する
7. `Sidebar` が移動元 `folderId` と移動先 `folderId` を比較する
8. 異なる場合のみ共通 hook 経由で `updateFeedFolder(feedId, folderId)` を呼ぶ
9. 成功時に query invalidate
10. 再取得結果から `groupFeedsByFolder(...)` が更新され、新しい所属位置に再描画される

### Drop to Unfoldered

1. user がハンドルから drag start する
2. user が「フォルダなし」drop zone へ drag over する
3. `FeedTreeView` が `activeDropTarget = { kind: "unfoldered" }` を親へ通知する
4. drop 時に `Sidebar` が `updateFeedFolder(feedId, null)` を呼ぶ
5. 再取得後、フィードは unfoldered list に表示される

## Error Handling / Edge Cases

- 移動元と移動先が同じ
  - no-op として扱い、API は呼ばない

- drop せずに drag をキャンセルした
  - `draggedFeedId` と `activeDropTarget` をクリアして終了する

- API が失敗した
  - 楽観更新は行わず、一覧はそのまま維持する
  - toast で失敗理由を出す

- フォルダが 0 件
  - ドラッグハンドルを表示しない

- 折りたたみ中フォルダへの drop
  - drop target はフォルダ行そのものなので、展開状態に依存せず移動できる

- 空フォルダへの drop
  - フィード件数 0 でも folder row を表示し、既存フォルダと同じ drop target として扱う

- `FeedTreeView` が context menu や click 選択と共存できるか
  - drag start はハンドルに限定し、既存 button 本体の click / context menu を維持する

## Testing

### Unit Tests

- `src/__tests__/components/feed-tree-view.test.tsx`
  - ハンドルが通常時は見えず、drag を許可するケースで描画される
  - drag start / drag over / drop が正しい callback を呼ぶ
  - フォルダ target と unfoldered target の強調状態が props に応じて変わる

- 共通 hook の test を追加する場合
  - 同一 folder への移動は no-op
  - 成功時に `updateFeedFolder` と query invalidate が呼ばれる
  - 失敗時 toast が呼ばれる

### Component/Integration Tests

- `src/__tests__/components/sidebar.test.tsx`
  - drag-and-drop で `update_feed_folder` が期待どおりの引数で呼ばれる
  - 成功後に feeds の再取得フローへつながる
  - 既存の click 選択が壊れていない
  - 空フォルダが drop target として描画され、そこへ移動できる

### Manual Verification

- フォルダ配下のフィードを別フォルダへ移動できる
- フォルダ配下のフィードを「フォルダなし」へ戻せる
- unfoldered のフィードをフォルダへ入れられる
- 空フォルダへフィードを移動できる
- ドラッグしない通常 click で従来どおりフィード選択できる
- 右クリックの context menu が従来どおり開く
- フォルダが存在しないアカウントではドラッグハンドルが出ない

## Scope

### 変更対象

- `src/components/reader/feed-tree-view.tsx`
  - drag handle, drop target, drag state の描画追加

- `src/components/reader/sidebar.tsx`
  - drag state 管理と drop 完了時の更新処理追加

- 新しい共通 hook または helper
  - feed folder 更新処理の共通化

- テスト
  - `src/__tests__/components/feed-tree-view.test.tsx`
  - `src/__tests__/components/sidebar.test.tsx`
  - 必要なら hook test

### 変更しないもの

- Rust backend command / repository の公開インターフェース
- 並び順永続化
- フォルダ作成フロー
- 設定画面の `sort_subscriptions`
