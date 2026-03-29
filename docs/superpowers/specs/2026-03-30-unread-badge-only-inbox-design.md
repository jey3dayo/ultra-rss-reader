# Unread Badge Only Inbox Design

## Summary

Settings > General > 未読バッジの `only_inbox` を、`feeds.unread_count` 合算ではなく、Rust 側のアカウント単位未読件数クエリで解決する。

## Goals

- `only_inbox` 選択時に、バッジ件数の真実源を feed 一覧合算から分離する
- 集計責務をフロントエンドではなく Rust + SQLite 側に置く
- サイドバーや feed/folder の未読表示は変えず、アプリアイコンの未読バッジだけを対象にする
- 既読化 mutation 後に新しい件数 query も再取得されるようにする

## Non-Goals

- サイドバーの `Unread` 件数や smart view の定義変更
- `feeds.unread_count` の廃止や feed/folder 集計ロジックの刷新
- FreshRSS / GReader の reading list のような別概念の inbox 導入
- DB スキーマ追加やアカウント未読件数の永続キャッシュ

## Current State

- [src/hooks/use-badge.ts](/Users/t00114/src/github.com/jey3dayo/ultra-rss-reader/src/hooks/use-badge.ts) は `badgePref !== "dont_display"` の場合、常に `feeds.unread_count` の総和をバッジに設定している
- [src/stores/preferences-store.ts](/Users/t00114/src/github.com/jey3dayo/ultra-rss-reader/src/stores/preferences-store.ts) には `unread_badge = "dont_display" | "all_unread" | "only_inbox"` が既に存在する
- [src-tauri/src/infra/db/sqlite_feed.rs](/Users/t00114/src/github.com/jey3dayo/ultra-rss-reader/src-tauri/src/infra/db/sqlite_feed.rs) の `recalculate_unread_count` は feed 単位の `is_read = 0` 件数だけを保持している
- 現行データモデルには「inbox 専用状態」はないため、当面の `only_inbox` は「feed 集計に依存しないアカウント単位未読件数」を意味する

## Recommended Approach

Rust 側にアカウント単位未読件数を返す read-only query を追加し、フロント側のバッジ表示だけがその query を条件付きで利用する。

この方法を選ぶ理由:

- 件数集計の責務が UI から漏れない
- `list_account_articles` のページング結果に依存せず、総件数を正しく扱える
- 将来 `only_inbox` の意味が本当に別概念になっても、分岐先の query を差し替えやすい
- 今回の変更範囲を `useBadge` と read path に限定できる

## Architecture

### Rust Side

- `ArticleRepository` に `count_unread_by_account(&AccountId) -> DomainResult<i32>` を追加する
- `SqliteArticleRepository` で `articles` と `feeds` を join し、`f.account_id = ?1 AND a.is_read = 0` を `COUNT(*)` する
- `article_commands.rs` か同等の read command 群に、件数をそのまま返す Tauri command を追加する

命名は `count_account_unread_articles` のような事実ベースを優先する。`count_inbox_unread` のような名前は、現状のデータモデルに inbox 専用概念がないため避ける。

### TypeScript Side

- `src/api/tauri-commands.ts` に新 command の wrapper を追加する
- `src/hooks/` に account unread badge count 用 query hook を追加するか、`useBadge` 内で既存の query helper を使って取得する
- [src/hooks/use-badge.ts](/Users/t00114/src/github.com/jey3dayo/ultra-rss-reader/src/hooks/use-badge.ts) は設定値ごとに件数ソースを切り替える

## Data Flow

### `all_unread`

1. `useFeeds(selectedAccountId)` で feed 一覧を取得する
2. `feeds.unread_count` を合算する
3. 合計が 0 より大きい場合だけ `setBadgeCount` を呼ぶ

### `only_inbox`

1. `selectedAccountId` を使って新しい account unread count query を実行する
2. Rust command が SQLite からアカウント単位未読件数を返す
3. 件数が 0 より大きい場合だけ `setBadgeCount` を呼ぶ

### `dont_display`

1. query 結果に関係なく `setBadgeCount(undefined)` を呼ぶ

## Detailed Design

### 1. Repository Contract

`ArticleRepository` に未読件数取得 API を追加する。

```rust
fn count_unread_by_account(&self, account_id: &AccountId) -> DomainResult<i32>;
```

実装 SQL のイメージ:

```sql
SELECT COUNT(*)
FROM articles a
JOIN feeds f ON a.feed_id = f.id
WHERE f.account_id = ?1
  AND a.is_read = 0
```

これは一覧取得用の `find_by_account` と役割を分離した read model として扱う。

### 2. Tauri Command

read-only command を追加し、引数は `account_id`、戻り値は `i32` とする。

```rust
#[tauri::command]
pub fn count_account_unread_articles(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<i32, AppError>
```

command 層では lock を取得し、repository を呼び出して値を返すだけに留める。

### 3. Client Wrapper and Query

`src/api/tauri-commands.ts` に wrapper を追加し、`src/api/schemas/commands.ts` に引数スキーマを追加する。戻り値は `z.number().int()` で受ける。

hook の形は次のどちらでもよいが、既存パターンとの整合を優先して query hook を追加する。

- `useAccountUnreadCount(accountId)`
- `useBadge` 内で `useQuery` を直接定義する

推奨は専用 hook。バッジ用途以外に再利用しないとしても、`useBadge` の責務を「設定に応じて count source を選ぶこと」に保ちやすい。

### 4. Badge Selection Logic

[src/hooks/use-badge.ts](/Users/t00114/src/github.com/jey3dayo/ultra-rss-reader/src/hooks/use-badge.ts) の分岐は次の形にする。

- `dont_display`: バッジ非表示
- `all_unread`: feed 合算を利用
- `only_inbox`: account unread count query を利用

`selectedAccountId` が未選択のときは、どのモードでもバッジ非表示にする。

### 5. Query Invalidation

既存の [src/hooks/use-articles.ts](/Users/t00114/src/github.com/jey3dayo/ultra-rss-reader/src/hooks/use-articles.ts) では既読化後に `articles` / `accountArticles` / `feeds` などを invalidate している。

ここに新しい unread count query key も追加する。これにより以下の操作後にバッジ値が再評価される。

- 単一記事の既読/未読切替
- 複数記事一括既読
- feed 単位の既読化
- folder 単位の既読化
- 同じ invalidation を使う将来の既読関連 mutation

## Error Handling

- Rust command は既存 read command と同じ `AppError` 変換方針に従う
- `useBadge` は新 query の失敗時でも UI 全体を壊さず、バッジ更新をスキップする
- Tauri 以外の実行環境で `setBadgeCount` が失敗しても、現行どおり no-op とする

## Testing

### Rust

`SqliteArticleRepository` に対して次を検証する。

- 同一アカウント内の複数 feed の未読が合算される
- 既読記事は件数に含まれない
- 別アカウントの未読は件数に含まれない

必要であれば command の薄い確認テストを追加するが、主対象は repository テストとする。

### TypeScript

バッジ分岐のテストで次を検証する。

- `dont_display` でバッジが消える
- `all_unread` で feed 合算が使われる
- `only_inbox` で新 query の値が使われる
- unread count query が失敗しても hook がクラッシュしない

## Trade-offs

- 現行データモデルでは `all_unread` と `only_inbox` が同数になる可能性が高い
- それでも専用 query を追加する価値は、責務分離と将来の inbox 概念拡張余地にある
- 永続キャッシュを持たないため都度 `COUNT(*)` は発生するが、今回の用途では実装コストと整合性のバランスが良い

## Open Questions

- なし。この spec では `only_inbox` を「アカウント単位未読件数専用 query」として固定する
