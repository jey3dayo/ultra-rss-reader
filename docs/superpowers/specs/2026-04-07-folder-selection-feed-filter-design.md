# Folder Selection Feed Filter Design

## Summary

サイドバーでフォルダをクリックしたとき、記事リストをそのフォルダ配下の記事に切り替えつつ、
同じフォルダ配下のフィード一覧も現在の表示モードに応じて絞り込む。

`unread` では未読を持つフィードのみを表示し、`all` では配下の全フィードを表示する。
フォルダ選択は新しい独自モードとして増やさず、既存の `selection.type = "folder"` と
`viewMode = "all" | "unread" | "starred"` の組み合わせで表現する。

## Current State

- `src/stores/ui-store.ts`
  - `selection` に `type: "folder"` はすでに存在し、`selectFolder(folderId)` も定義されている
  - ただし現在の UI からは実質使われていない

- `src/components/reader/sidebar.tsx`
  - フォルダとフィードの view model を組み立てて `FeedTreeView` に渡している
  - フォルダ行は展開・折りたたみのみを担当し、フォルダ選択は行っていない

- `src/components/reader/feed-tree-view.tsx`
  - フィード選択の click は扱うが、フォルダ選択の click state は持たない
  - フォルダ行は「展開トグル」の UI として描画されている

- `src/components/reader/article-list.tsx`
  - 記事一覧は `feed` / `tag` / `all(account)` を前提にデータを選んでいる
  - `selection.type === "folder"` の場合に記事を絞る処理は未実装

- `src/lib/article-list.ts`
  - `selectVisibleArticles(...)` は view mode に応じた未読/スターの絞り込みを担当している
  - フォルダ単位の feed 集合フィルタは持っていない

## Goals

- フォルダクリックで `selection.type = "folder"` に切り替えられる
- フォルダ選択中、記事リストは配下フィードの記事だけを対象にする
- フォルダ選択中、サイドバーの配下フィード一覧も現在の `viewMode` に応じて絞り込まれる
- `unread` では未読件数が 1 件以上あるフィードのみ表示する
- `all` ではフォルダ配下の全フィードを表示する
- 個別フィードをクリックしたら従来どおり `selection.type = "feed"` に切り替わる

## Non-Goals

- 新しい永続設定や専用の表示モードを追加すること
- フォルダごとの独立したフィルタ状態を保存すること
- フォルダ選択時にサイドバー全体の構造を別 UI に作り替えること
- バックエンド IPC や SQLite schema を変更すること

## Design

### 1. フォルダ選択を既存の selection モデルに接続する

フォルダ行クリック時は `selectFolder(folder.id)` を呼び、
サイドバーのフォルダ行に選択状態を持たせる。

展開・折りたたみ操作は維持するが、フォルダ行全体を「選択可能な項目」として扱う。
実装上は、フォルダトグル操作とフォルダ選択操作が競合しないように、
chevron icon は展開・折りたたみ専用、行本体は選択専用に分ける。
`FeedTreeView` の folder row API を整理し、親の `Sidebar` から
`selectedFolderId` と `onSelectFolder(folderId)` を渡せるようにする。

### 2. サイドバーのフィード一覧は folder selection と viewMode の両方で決まる

`Sidebar` はすでに `feedsByFolder` を持っているため、
folder ごとの feed 配列を組み立てる段階で `viewMode` を適用する。

ルールは以下のとおり。

- `selection.type !== "folder"`
  - 現在どおり全フォルダ配下のフィードを表示する
- `selection.type === "folder"` かつ `viewMode === "unread"`
  - 選択中フォルダの配下から `unread_count > 0` のフィードのみ表示する
- `selection.type === "folder"` かつ `viewMode === "all"`
  - 選択中フォルダの配下の全フィードを表示する
- `selection.type === "folder"` かつ `viewMode === "starred"`
  - 記事リストは starred 記事に絞るが、サイドバーのフィード表示は `all` と同じく配下全フィードを表示する

`starred` でフィード単位の件数を sidebar 側から正しく導く材料は現状ないため、
ここでは「フォルダ配下の対象 feed 群を保持し、記事側の starred フィルタで絞る」を優先する。
これにより追加集計を避けつつ、表示ルールを単純に保てる。

### 3. 記事リストは folder 配下の feed 集合で前段フィルタする

`article-list.tsx` では `selection.type === "folder"` のとき、
`feeds` から `folder_id === selectedFolderId` の `feed.id` 集合を作る。

データ取得は既存の account 単位記事取得を使い、
`selectVisibleArticles(...)` の前または内部で
「この feed 集合に含まれる記事だけ残す」という前段フィルタを追加する。

その後の `viewMode`、検索、並び順、retained article の扱いは既存ロジックをそのまま使う。
これにより feed 選択・folder 選択・tag 選択で処理の意味が揃う。

この folder scope は通常一覧だけでなく検索結果にも適用する。
つまりフォルダ選択中に検索した場合も、account 全体ではなく
選択フォルダ配下 feed の記事だけを検索結果表示の対象にする。

### 4. 空状態は「選択結果として 0 件」を自然に表現する

フォルダ選択中に `unread` で対象フィードが 0 件なら、
サイドバーの配下フィード一覧は空でよい。
同時に記事リストも 0 件表示となる。

これはエラーではなく、現在の filter 条件に一致する項目がないだけなので、
特別な復旧処理や自動 selection 変更は行わない。

### 5. フィードクリックで通常の feed selection へ戻る

フォルダ選択中でも配下フィード行は通常どおりクリック可能にする。
ユーザーが feed row をクリックした時点で `selectFeed(feed.id)` が走り、
フォルダ selection から feed selection へ遷移する。

これにより「フォルダでざっくり絞ってから特定フィードに入る」流れを
既存 UI のまま実現できる。

## Data Flow

### Folder Click

1. user がサイドバーのフォルダ行をクリックする
2. `FeedTreeView` が `onSelectFolder(folder.id)` を呼ぶ
3. `ui-store` が `selection = { type: "folder", folderId }` に更新される
4. `Sidebar` が selection と viewMode を見て、選択中フォルダの feed list を再構成する
5. `ArticleList` が account article list を取得し、選択フォルダ配下の `feedId` 集合で前段フィルタする
6. `selectVisibleArticles(...)` が `viewMode` に応じて未読/スター/全件を決定する

### View Mode Change While Folder Selected

1. user が footer で `all` または `unread` を切り替える
2. `viewMode` が更新される
3. `Sidebar` が同じフォルダ配下の feed list を再計算する
4. `ArticleList` が同じフォルダ配下の記事に対して新しい `viewMode` を適用する
5. `unread` では未読フィードのみ、`all` では全フィードが再表示される

### Search While Folder Selected

1. user が folder selection のまま検索を開く
2. `searchArticles(accountId, query)` の結果を受ける
3. `ArticleList` がその検索結果を選択フォルダ配下の `feedId` 集合で再フィルタする
4. フォルダ外の記事は検索一致していても表示しない

## Error Handling / Edge Cases

- 選択フォルダにフィードがない
  - サイドバー配下一覧は空
  - 記事リストも空

- 選択フォルダに未読フィードがない状態で `unread`
  - サイドバー配下一覧は空
  - 記事リストも空

- フォルダ選択中に feed をクリックした
  - `selection.type = "feed"` に切り替える
  - 従来どおりその feed 単位の記事表示へ移行する

- フォルダ選択中に `starred`
  - 記事は配下 feed の starred 記事に絞る
  - サイドバー feed list は配下全フィード表示のままにする

- フォルダ選択中に検索した
  - 検索結果も配下 feed の記事だけに制限する
  - フォルダ外の記事は表示しない

- 別アカウントへ切り替えた
  - 既存の `selectAccount(...)` により `selection.type = "all"` に戻る
  - 追加処理は不要

## Testing

### Unit / Component Tests

- `src/__tests__/components/sidebar.test.tsx`
  - フォルダクリックで `selectFolder` 相当の selection 更新が起きる
  - folder selection + `viewMode = "unread"` で未読フィードのみ描画される
  - folder selection + `viewMode = "all"` で配下全フィードが描画される

- `src/__tests__/components/article-list.test.tsx`
  - folder selection 時に配下 feed の記事だけが表示される
  - folder selection + `viewMode = "unread"` で未読記事だけが残る
  - folder selection + `viewMode = "starred"` で配下 feed の starred 記事だけが残る
  - folder selection + search query で配下 feed の検索結果だけが残る

- `src/lib/article-list.ts` の unit test を追加する場合
  - folder feed 集合フィルタが先に適用され、その後 view mode filter が働くことを確認する

### Manual Verification

- フォルダクリックで記事リストがそのフォルダ配下に切り替わる
- `unread` で未読フィードのみ sidebar に残る
- `all` で同じフォルダ配下の全フィードが sidebar に戻る
- フォルダ選択中に特定 feed をクリックすると、その feed selection に移れる
- フォルダに該当記事が 0 件でも UI が破綻しない

## Scope

### 変更対象

- `src/components/reader/feed-tree-view.tsx`
  - folder row の選択 UI と callback 追加

- `src/components/reader/sidebar.tsx`
  - folder selection を踏まえた feed view model の再構成

- `src/components/reader/article-list.tsx`
  - folder selection 時の article filtering 追加

- `src/lib/article-list.ts`
  - 必要に応じて feed 集合フィルタ helper を追加

- テスト
  - sidebar / article-list / helper の該当テスト

### 変更しないもの

- Rust backend commands
- SQLite schema
- フォルダ作成や編集フロー
- 表示モード自体の定義
