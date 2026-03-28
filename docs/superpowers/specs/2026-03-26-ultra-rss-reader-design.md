# Ultra RSS Reader — Design Specification

## Overview

Reederクローンのクロスプラットフォーム（Win/Mac）RSSリーダー。
複数アカウント（ローカルフィード、FreshRSS、Inoreader等）を統一インターフェースで管理する。

## Tech Stack

- Desktop Framework: Tauri v2
- Frontend: React (Vite) + TypeScript
- State Management: Zustand (UI state) + TanStack Query (server state cache)
- Backend: Rust (全ビジネスロジック)
- Database: SQLite (rusqlite, WALモード)

---

## 1. Architecture

### Layer Structure

```text
React (Vite)
├── UI Components (3-pane responsive layout)
├── Zustand: UI state only (選択状態, pane開閉, keyboard nav)
└── TanStack Query: command/query result cache (optimistic update, loading/error)
        │ invoke()
Tauri Commands (App Facade)
├── validate input
├── invoke application services
├── map domain errors → UI errors
└── DTO変換 (domain ↔ UI)
        │
Rust Application Layer
├── FeedService
├── SyncService (event-driven)
├── AccountService
├── ArticleService
└── HousekeepingService (retention purge, orphan cleanup)
    ※ Repository trait に依存（impl には依存しない）
        │
Rust Infrastructure Layer
├── Repository Impl (SqliteXxxRepository)
├── Feed Normalizer (feed-rs → NormalizedEntry → Domain Entity)
├── Event Bus (SyncCommand queue + AppEvent notifications)
├── HTTP client (reqwest)
└── Scheduler (tokio::time::interval)
        │
SQLite
├── Writer task (専用) + Read connection pool
├── WALモード (読み書き並行)
└── 書き込みはシリアル
```

### Design Principles

- React層: ドメインロジックは持たない。UIロジックと表示状態は持つ
- Tauri Commands: App Service / Facade。入力検証・DTO変換・エラーマッピング・非同期ジョブ起動
- Application Layer: ドメインのユースケース（純粋なビジネスロジック）
- Infrastructure Layer: 外部依存（HTTP, DB, Parser）の実装詳細

### Rust Crates

| 用途             | crate                  |
| ---------------- | ---------------------- |
| フィード解析     | `feed-rs`              |
| HTTP             | `reqwest`              |
| SQLite           | `rusqlite`             |
| 非同期ランタイム | `tokio` (Tauri v2標準) |
| シリアライズ     | `serde` / `serde_json` |
| HTMLサニタイズ   | `ammonia`              |
| ログ             | `tracing`              |
| OS Keychain      | `keyring`              |

### Credential Storage

認証情報（パスワード、OAuthトークン等）はOS keychainのみに保存する。
**DBには秘密情報を保存しない。** DBにはkeychain参照キーと非秘密設定のみ保存。

- macOS: Keychain Services (via `keyring` crate)
- Windows: Windows Credential Manager (via `keyring` crate)
- keychainキー: `ultra-rss-reader/{account_id}` 形式

### SQLite Concurrency Model

- Writer: 専用のwriter taskが`mpsc`チャンネルでDB書き込みリクエストを受信し、シリアルに処理。`Arc<Mutex<Connection>>`ではなく、単一所有者taskに閉じ込める
- Reader: 読み取り専用コネクション（将来的にプール化可能、MVPでは1-2本）
- spawn_blocking: 全DB操作は `tokio::task::spawn_blocking` でオフロード
- PRAGMA設定: `busy_timeout=5000`, `foreign_keys=ON`, `journal_mode=WAL`, `synchronous=NORMAL`
- Writer/Reader分離により、同期中の書き込みがUI読み取りをブロックしない

### Migration Strategy

- `schema_version` テーブルでバージョン管理
- アプリ起動時に自動マイグレーション実行
- マイグレーションファイルは `src-tauri/migrations/` に `V{n}__{description}.sql` 形式で管理
- ロールバックは手動（前バージョンのバックアップをユーザーに促す）

---

## 2. Provider Abstraction

### FeedProvider trait

```rust
#[async_trait]
trait FeedProvider: Send + Sync {
    fn kind(&self) -> ProviderKind;

    /// プロバイダが対応する機能を返す
    fn capabilities(&self) -> ProviderCapabilities;

    /// 認証（必要な場合）
    async fn authenticate(&mut self, credentials: &Credentials) -> Result<()>;

    /// 購読フィード一覧を取得（リモートDTO → ドメイン変換はApplication層）
    async fn get_subscriptions(&self) -> Result<Vec<RemoteSubscription>>;

    /// フォルダ/カテゴリ一覧を取得
    async fn get_folders(&self) -> Result<Vec<RemoteFolder>>;

    /// 差分取得（cursor/since/ページネーション差異を吸収）
    /// scope は FeedIdentifier で統一（ローカル/リモート両対応）
    async fn pull_entries(&self, scope: PullScope, cursor: Option<SyncCursor>)
        -> Result<PullResult>;

    /// 既読/未読/スター状態のpull同期
    /// 返す RemoteState は authoritative snapshot:
    ///   - read_ids に含まれる remote_id → is_read=true
    ///   - read_ids に含まれない remote_id → is_read=false
    ///   - starred_ids も同様
    /// ローカルプロバイダではno-op（空Vecを返す）
    async fn pull_state(&self) -> Result<RemoteState>;

    /// ローカル変更をリモートに反映
    /// ローカルプロバイダではno-op
    async fn push_mutations(&self, mutations: &[Mutation]) -> Result<()>;

    /// 購読追加
    async fn create_subscription(&self, url: &str, folder: Option<&str>) -> Result<RemoteSubscription>;

    /// 購読削除
    async fn delete_subscription(&self, id: &FeedIdentifier) -> Result<()>;
}

struct ProviderCapabilities {
    supports_folders: bool,
    supports_starring: bool,
    supports_search: bool,
    supports_delta_sync: bool,    // continuation token対応
    supports_remote_state: bool,  // pull_state / push_mutations 対応
}

/// ローカルfeed_idとリモートIDの両方を扱える識別子
/// LocalProviderはfeed_url、リモートプロバイダはremote_idを使用
enum FeedIdentifier {
    Local { feed_url: String },
    Remote { remote_id: String },
}

/// プロバイダ間の差分取得方式を吸収
enum PullScope {
    Feed(FeedIdentifier),
    All,
    Unread,
    Starred,
}

struct SyncCursor {
    continuation: Option<String>,   // Google Reader API continuation token
    since: Option<DateTime<Utc>>,
    etag: Option<String>,           // HTTP ETag
    last_modified: Option<String>,  // HTTP Last-Modified
}

struct PullResult {
    entries: Vec<RemoteEntry>,
    next_cursor: Option<SyncCursor>,  // 次ページがある場合
    has_more: bool,
}

/// プロバイダから返される記事データ
/// source_feed_id で帰属先フィードを特定（All/Unread/Starred取得時に必須）
struct RemoteEntry {
    id: Option<String>,              // プロバイダ側のID（remote_id用）
    source_feed_id: FeedIdentifier,  // この記事が属するフィード
    title: String,
    content: String,
    summary: Option<String>,
    url: Option<String>,
    published_at: Option<DateTime<Utc>>,
    updated_at: Option<DateTime<Utc>>,
    thumbnail: Option<String>,
    author: Option<String>,
    is_read: Option<bool>,           // プロバイダが既読状態を返す場合
    is_starred: Option<bool>,        // プロバイダがスター状態を返す場合
}

/// リモートからの生データ（ドメインモデルとは別）
struct RemoteSubscription {
    remote_id: String,           // プロバイダ側のID（stream ID等）
    title: String,
    url: String,
    site_url: String,
    folder_remote_id: Option<String>,
    icon_url: Option<String>,
}

struct RemoteFolder {
    remote_id: String,
    name: String,
    sort_order: Option<i32>,
}

struct RemoteState {
    read_ids: Vec<String>,       // 既読の記事remote_id一覧
    starred_ids: Vec<String>,    // スター付き記事remote_id一覧
}

/// ローカルで行った変更をリモートに反映するための型
/// remote_id を持つ記事のみが対象（ローカルフィードの記事は対象外）
enum Mutation {
    MarkRead { remote_entry_id: String },
    MarkUnread { remote_entry_id: String },
    SetStarred { remote_entry_id: String, starred: bool },
}

enum ProviderKind {
    Local,       // ローカルフィード（アプリ自身がRSSフェッチ）
    FreshRss,    // Google Reader API互換
    Inoreader,   // Inoreader API
}
```

### Provider Implementations

- LocalProvider: 直接RSSフェッチ (reqwest + feed-rs)。authenticate() は no-op。`PullScope::Feed(Local { feed_url })` でフィード単位取得。pull_state/push_mutations は空実装。capabilities: folders=false, delta_sync=false, remote_state=false
- GoogleReaderProvider (FreshRSS): Google Reader API (`/reader/api/0/...`)。ServerURL + ユーザー名 + パスワード認証。capabilities: all true
- InoreaderProvider: Inoreader API (OAuth2)。capabilities: all true

---

## 3. Data Model

### Domain Entities

```rust
struct Account {
    id: AccountId,
    kind: ProviderKind,
    name: String,
    server_url: Option<String>,
    username: Option<String>,
    // credentials は OS keychain のみ。DBに含まない。
    sync_interval: Duration,
    sync_on_wake: bool,
    keep_read_items: Duration,
}

struct Folder {
    id: FolderId,
    account_id: AccountId,
    remote_id: Option<String>,    // プロバイダ側のID
    name: String,
    sort_order: i32,
}

struct Feed {
    id: FeedId,
    account_id: AccountId,
    folder_id: Option<FolderId>,
    remote_id: Option<String>,    // プロバイダ側のID（stream ID等）
    title: String,
    url: String,
    site_url: String,
    icon: Option<Vec<u8>>,
    unread_count: i32,
}

struct Article {
    id: ArticleId,                  // ID戦略で生成（account_id含む）
    feed_id: FeedId,
    remote_id: Option<String>,      // プロバイダ側のID（同期用）
    title: String,
    content_raw: String,            // フィードから取得した生HTML
    content_sanitized: String,      // sanitize済み（XSS除去、表示用）
    sanitizer_version: u32,         // ammonia設定のバージョン。変更時に再sanitize可能
    summary: Option<String>,
    url: Option<String>,            // URLがないエントリもある
    author: Option<String>,
    published_at: DateTime<Utc>,
    thumbnail: Option<String>,
    is_read: bool,
    is_starred: bool,
    fetched_at: DateTime<Utc>,
}
```

### ID Strategy

優先順位ベースで安定IDを生成。**account_idをプレフィックスに含め**、別アカウントで同一フィードを購読した場合の衝突を防止。

1. `account_id + entry.id` (GUID) — あればそのまま使う
2. Fallback hash: `sha256(account_id + feed_url + entry_url + title_if_no_url)`
   - URL優先。URLがない場合のみtitleを含める
   - publishedはハッシュに含めない（後から修正されうるため）

```rust
fn generate_entry_id(account_id: &str, entry: &Entry, feed_url: &str) -> String {
    // 1. GUID（アカウントスコープ）
    if let Some(id) = &entry.id {
        if !id.is_empty() {
            return format!("{}:{}", account_id, id);
        }
    }

    let url = entry.links.first().map(|l| l.href.as_str()).unwrap_or("");

    // 2. URL がある場合は URL ベース
    if !url.is_empty() {
        return sha256_hex(&format!("{}|{}|{}", account_id, feed_url, url));
    }

    // 3. URL がない場合は title を含める（まとめ系フィード対策）
    let title = entry.title.as_ref().map(|t| t.content.as_str()).unwrap_or("");
    sha256_hex(&format!("{}|{}|{}", account_id, feed_url, title))
}
```

### SQLite Schema

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    server_url TEXT,
    username TEXT,
    -- credentials は OS keychain のみ。DB には保存しない。
    sync_interval_secs INTEGER NOT NULL DEFAULT 3600,
    sync_on_wake INTEGER NOT NULL DEFAULT 0,
    keep_read_items_days INTEGER NOT NULL DEFAULT 30
);

CREATE TABLE folders (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    remote_id TEXT,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE(account_id, remote_id)
);

CREATE TABLE feeds (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
    remote_id TEXT,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    site_url TEXT NOT NULL DEFAULT '',
    icon BLOB,
    unread_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(account_id, remote_id),
    UNIQUE(account_id, url)
);

CREATE TABLE articles (
    id TEXT PRIMARY KEY,  -- generate_entry_id() で生成（account_idプレフィックス付き）
    feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    remote_id TEXT,
    title TEXT NOT NULL,
    content_raw TEXT NOT NULL DEFAULT '',
    content_sanitized TEXT NOT NULL DEFAULT '',
    sanitizer_version INTEGER NOT NULL DEFAULT 1,
    summary TEXT,
    url TEXT,  -- NULL許可（URLなしエントリ対応）
    author TEXT,
    published_at TEXT NOT NULL,
    thumbnail TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    is_starred INTEGER NOT NULL DEFAULT 0,
    fetched_at TEXT NOT NULL
);

-- 記事保存: INSERT ... ON CONFLICT(id) DO UPDATE
-- 更新時: title, content_raw, content_sanitized, summary, url, author,
--         published_at, thumbnail, fetched_at を上書き
-- 保持: is_read, is_starred は既存値を維持（ユーザー操作の状態を尊重）

-- 同期メタデータ
CREATE TABLE sync_state (
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    scope_key TEXT NOT NULL DEFAULT '',
    -- scope_key: '' = アカウント全体, 'feed:{remote_id}' = フィード単位,
    --            'unread' = 未読全体, 'starred' = スター全体
    continuation TEXT,
    etag TEXT,
    last_modified TEXT,
    last_success_at TEXT,
    last_error TEXT,
    error_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at TEXT,
    PRIMARY KEY (account_id, scope_key)
);

-- オフラインで行った変更（リモートに未反映）
-- remote_id を持つ記事のみが対象。ローカルフィードの記事は pending_mutations に入らない。
CREATE TABLE pending_mutations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    mutation_type TEXT NOT NULL,  -- 'mark_read', 'mark_unread', 'set_starred', 'unset_starred'
    remote_entry_id TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- HTTPキャッシュ（ローカルフィード用）
CREATE TABLE feed_http_cache (
    feed_id TEXT PRIMARY KEY REFERENCES feeds(id) ON DELETE CASCADE,
    etag TEXT,
    last_modified TEXT,
    last_fetched_at TEXT NOT NULL
);

-- Performance indexes
CREATE INDEX idx_articles_feed_id ON articles(feed_id);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_is_read ON articles(feed_id, is_read);
CREATE INDEX idx_articles_is_starred ON articles(is_starred) WHERE is_starred = 1;
CREATE INDEX idx_articles_remote_id ON articles(remote_id);
CREATE INDEX idx_feeds_remote_id ON feeds(account_id, remote_id);
CREATE INDEX idx_folders_remote_id ON folders(account_id, remote_id);

-- Schema version
CREATE TABLE schema_version (version INTEGER NOT NULL);
INSERT INTO schema_version VALUES (1);
```

### DTO Versioning

```rust
#[derive(Serialize, Deserialize)]
struct ArticleListDto {
    version: u32,  // v1 = 1
    items: Vec<ArticleDto>,
}
```

### Feed Normalizer

```rust
// feed-rs → RemoteEntry (Provider層) → Domain Article (Application層)
// NormalizedEntry は廃止。RemoteEntry が Provider→Application の統一DTOとなる。
// Application層が RemoteEntry.source_feed_id を使ってローカルfeed_idを解決し、
// generate_entry_id() で Article.id を生成する。
```

---

## 4. Repository Pattern

```rust
// Application Layer で定義（trait）
trait ArticleRepository {
    fn find_by_feed(&self, feed_id: &FeedId, pagination: &Pagination) -> Result<Vec<Article>>;
    /// UPSERT: ON CONFLICT(id) DO UPDATE で content等を更新、is_read/is_starred は保持
    fn upsert(&self, articles: &[Article]) -> Result<()>;
    fn mark_as_read(&self, id: &ArticleId) -> Result<()>;
    fn mark_as_starred(&self, id: &ArticleId, starred: bool) -> Result<()>;
    fn purge_old_read(&self, before: DateTime<Utc>) -> Result<u64>;
    /// sanitizer_version が古い記事を再sanitize するためのバッチ更新
    fn update_sanitized(&self, id: &ArticleId, sanitized: &str, version: u32) -> Result<()>;
    fn find_by_sanitizer_version_below(&self, version: u32, limit: usize) -> Result<Vec<Article>>;
    /// リモート状態の一括適用（pull_state結果の反映）
    /// read_remote_ids / starred_remote_ids は authoritative snapshot。
    /// リストに含まれる → true、含まれない → false。
    /// ただし pending_mutations に未push変更がある記事はスキップ（ローカル変更優先）。
    fn apply_remote_state(
        &self,
        account_id: &AccountId,
        read_remote_ids: &[String],
        starred_remote_ids: &[String],
        pending_remote_ids: &[String],  // skip these
    ) -> Result<()>;
}

struct Pagination {
    offset: usize,
    limit: usize,  // デフォルト 50
}

trait FeedRepository {
    fn find_by_account(&self, account_id: &AccountId) -> Result<Vec<Feed>>;
    fn save(&self, feed: &Feed) -> Result<()>;
    fn update_unread_count(&self, feed_id: &FeedId, count: i32) -> Result<()>;
    fn recalculate_unread_count(&self, feed_id: &FeedId) -> Result<i32>;
    /// remote_id または url からフィードを検索（RemoteEntry → Article変換時に使用）
    fn find_by_remote_id(&self, account_id: &AccountId, remote_id: &str) -> Result<Option<Feed>>;
    fn find_by_url(&self, account_id: &AccountId, url: &str) -> Result<Option<Feed>>;
}

trait FolderRepository {
    fn find_by_account(&self, account_id: &AccountId) -> Result<Vec<Folder>>;
    fn save(&self, folder: &Folder) -> Result<()>;
    fn delete(&self, id: &FolderId) -> Result<()>;
    // フォルダ削除時、配下のfeedはfolder_id=NULLに（ON DELETE SET NULLで自動）
}

trait AccountRepository {
    fn find_all(&self) -> Result<Vec<Account>>;
    fn save(&self, account: &Account) -> Result<()>;
    fn delete(&self, id: &AccountId) -> Result<()>;
    // アカウント削除時、配下の全データはCASCADEで自動削除
}

trait SyncStateRepository {
    fn get(&self, account_id: &AccountId, scope_key: &str) -> Result<Option<SyncState>>;
    fn save(&self, state: &SyncState) -> Result<()>;
}

trait PendingMutationRepository {
    fn find_by_account(&self, account_id: &AccountId) -> Result<Vec<PendingMutation>>;
    fn save(&self, mutation: &PendingMutation) -> Result<()>;
    fn delete(&self, ids: &[i64]) -> Result<()>;
}

// Infrastructure Layer で実装
struct SqliteArticleRepository { /* ... */ }
impl ArticleRepository for SqliteArticleRepository { /* ... */ }

// テスト時
struct InMemoryArticleRepository { /* ... */ }
impl ArticleRepository for InMemoryArticleRepository { /* ... */ }
```

### Sync Flow: アカウント同期の実行順序

**順序は厳密に守る**（後段が前段のデータに依存するため）。

```text
1. push_mutations()     — ローカル変更を先にリモートへ反映（競合回避）
2. get_folders()        — フォルダ upsert（フィードの親が必要）
3. get_subscriptions()  — フィード upsert（記事の親が必要）
4. pull_entries(scope, cursor) → PullResult { entries: Vec<RemoteEntry> }
   各 RemoteEntry について:
     a. source_feed_id → FeedRepository.find_by_remote_id() or find_by_url()
     b. generate_entry_id(account_id, entry, feed_url) で Article.id 生成
     c. Article ドメインモデルに変換
   ArticleRepository.upsert(articles)
     - 新規: INSERT
     - 既存: content等を更新、is_read/is_starred は保持
5. pull_state()         — 既読/スター状態を authoritative snapshot として取得
   ArticleRepository.apply_remote_state()
     - pending_mutations に未push変更がある記事はスキップ
6. FeedRepository.recalculate_unread_count() — 未読数を再計算
```

LocalProvider の場合: Step 1, 2, 3, 5 はスキップ。Step 4 のみ実行（直接RSSフェッチ）。
LocalProvider の RemoteSubscription.remote_id 規約: `feed_url` を `remote_id` として使用する。

---

## 5. Event Bus & Sync Engine

### Event Architecture

コマンド（ジョブ投入）と通知（UI更新）を明確に分離する。

```rust
// === コマンド（ジョブ投入） ===
// mpsc channel: 1つのreceiverがSyncServiceで処理
enum SyncCommand {
    SyncAll,
    SyncAccount { account_id: AccountId },
    SyncFeed { account_id: AccountId, feed_id: FeedIdentifier },
    ManualRefresh,
    PushPendingMutations { account_id: AccountId },
    PurgeOldArticles,
}

// === 通知（UI更新等） ===
// broadcast channel: 複数のsubscriberが受信可能
enum AppEvent {
    SyncStarted { account_id: AccountId },
    SyncCompleted { account_id: AccountId },
    FeedUpdated { feed_id: FeedId },
    ErrorOccurred { error: AppError },
}
```

### System Wake Detection

スリープ復帰はOS APIで検出し、SyncCommand::SyncAllを直接送信する。
AppEventに混ぜない（制御フローと通知の分離原則）。

```rust
// macOS: NSWorkspace.willSleepNotification / didWakeNotification
// Windows: WM_POWERBROADCAST / PBT_APMRESUMEAUTOMATIC
// → 検出したら sync_command_tx.send(SyncCommand::SyncAll)
```

### Startup Sequence（race condition対策）

```text
1. DB初期化 + マイグレーション
2. SyncService 初期化（mpsc receiver ready）
3. Scheduler 初期化
4. ★ SyncCommand::SyncAll を明示送信（SyncService は既に receiver ready）
5. Tauri window 表示
```

起動時同期は broadcast に依存せず、`SyncCommand` の明示送信で保証する。

### Sync Triggers

| トリガー元          | 送信先                     | ハンドラ    |
| ------------------- | -------------------------- | ----------- |
| App setup (ready後) | SyncCommand::SyncAll       | SyncService |
| Window focus        | SyncCommand::SyncAll       | SyncService |
| User clicks refresh | SyncCommand::ManualRefresh | SyncService |
| tokio::interval     | SyncCommand::SyncAccount   | SyncService |
| System wake (OS)    | SyncCommand::SyncAll       | SyncService |
| SyncService完了     | AppEvent::SyncCompleted    | UI (emit)   |
| SyncService完了     | AppEvent::FeedUpdated      | UI (emit)   |

### Sync Design

- 起動時同期: SyncService ready後にSyncCommand::SyncAllを明示送信
- イベント同期: WindowFocused, ManualRefresh, System Wake
- 定期同期: tokio::time::interval、アカウントごとに間隔設定可能
- エラー時: exponential backoff (初期5秒, 最大30分, 最大リトライ10回)
- In-flight dedupe: 同一アカウントの同期リクエストが既に実行中なら新規リクエストをスキップ
- Offline outbox: ローカル変更はpending_mutationsに保存し、オンライン復帰時にpush
- pending_mutationsはremote_idを持つ記事のみ: ローカルフィードの記事はoutbox対象外（同期先がない）

### Housekeeping

- `RetentionPurge`: keep_read_items 期間を過ぎた既読記事を削除（起動時 + 24時間間隔）
- `OrphanCleanup`: 削除されたフィード/アカウントの残留データを清掃
- `ReSanitize`: sanitizer_version が古い記事を最新のammoniaルールで再処理

---

## 6. Error Model

```text
DomainError (Rust Core)
├── NetworkError      - 接続失敗, タイムアウト, HTTP 4xx/5xx
├── ParseError        - フィード解析失敗, 不正なXML/JSON
├── PersistenceError  - DB読み書き失敗
├── AuthError         - 認証失敗, トークン期限切れ
├── ValidationError   - 不正な入力値
└── KeychainError     - OS keychain アクセスエラー

         │ From<DomainError> for AppError

AppError (Tauri Commands / Facade層)
├── UserVisibleError  - ユーザーに表示するメッセージ付き
└── RetryableError    - リトライ可能（backoff対象）
```

---

## 7. UI Design

### Responsive Layout (3 stages)

| Mode    | Breakpoint | Pane構成                                              |
| ------- | ---------- | ----------------------------------------------------- |
| Wide    | ≥1100px    | 3ペイン: sidebar + list + content                     |
| Compact | 500-1099px | 2ペイン: [sidebar+list] ⇄ [list+content] スタックナビ |
| Mobile  | <500px     | 1ペイン: スタック式                                   |

Wide + BrowserView時: sidebarが隠れて [list + browser] の2ペインに変化。

### Component Tree

```text
App
└── AppShell
    ├── AppLayout
    │   ├── SidebarPane
    │   │   ├── AccountHeader
    │   │   ├── UnreadCounter
    │   │   ├── SubscriptionTree
    │   │   │   ├── SmartViewItem (Unread / Starred)
    │   │   │   ├── FolderItem
    │   │   │   │   └── FeedItem
    │   │   │   └── FeedItem (standalone)
    │   │   └── FilterBar
    │   ├── ListPane
    │   │   ├── ListHeader
    │   │   ├── ArticleList
    │   │   │   ├── DateGroup
    │   │   │   └── ArticleRow
    │   │   └── BottomNav
    │   └── ContentPane (contentMode で reader/browser を切替)
    │       ├── ArticleView (contentMode === 'reader')
    │       │   ├── ArticleToolbar
    │       │   ├── ArticleHeader
    │       │   ├── ArticleContent
    │       │   └── EmptyState (selectedArticleId === null)
    │       └── BrowserView (contentMode === 'browser')
    │           ├── BrowserNavBar
    │           └── WebViewFrame
    ├── SearchOverlay
    ├── AddAccountDialog
    └── AccountSettingsModal
```

### Component Responsibilities

- App: Provider初期化、ルート状態接続、グローバルオーバーレイ管理
- AppLayout: レスポンシブ判定、pane配置、split view制御
- SidebarPane: アカウント・フィード系表示
- ListPane: 記事一覧・フィルタ・検索導線
- ContentPane: Reader/Browser切替、記事本文表示

### UI State (Zustand)

```typescript
// Selection は排他的（folder/feed/smart/all のいずれか1つ）
type Selection =
  | { type: "feed"; feedId: string }
  | { type: "folder"; folderId: string }
  | { type: "smart"; kind: "unread" | "starred" }
  | { type: "all" };

type AppUiState = {
  // A. Layout
  layoutMode: "wide" | "compact" | "mobile";

  // B. Navigation
  focusedPane: "sidebar" | "list" | "content"; // mobile/compact でのペイン切替
  contentMode: "empty" | "reader" | "browser" | "loading";

  // C. Selection (排他的)
  selectedAccountId: string | null;
  selection: Selection;
  selectedArticleId: string | null;

  // D. Filter
  viewMode: "all" | "unread" | "starred";
  searchQuery: string;

  // E. Browser
  browserUrl: string | null;

  // F. Sidebar presentation
  expandedFolderIds: Set<string>;
};

// visiblePanes は保存しない（導出値）
function resolveLayout(state: AppUiState): Pane[] {
  if (state.layoutMode === "wide") {
    if (state.contentMode === "browser") {
      return ["list", "content"];
    }
    return ["sidebar", "list", "content"];
  }

  if (state.layoutMode === "compact") {
    return state.focusedPane === "content"
      ? ["list", "content"]
      : ["sidebar", "list"];
  }

  return [state.focusedPane]; // mobile
}
```

### Article Display Modes

- Reader View: フィードから取得したcontent_sanitizedを表示
- Browser View (BR): Tauri WebViewで元サイトを表示
- Reader Mode (≡): Phase 2。readabilityライブラリで全文抽出表示

### Search (MVP)

- MVPでは `LIKE '%query%'` によるシンプル検索（title + content_sanitized）
- Phase 2 で FTS5 への移行を検討

### Security: WebView

- WebViewからTauri IPC (invoke) へのアクセスは許可しない
- URLスキーム制限: `http://` / `https://` のみ許可
- remote画像は許可するが、trackingピクセル（1x1画像）はフィルタ検討

### Toolbar Actions (MVP)

| アイコン | 機能            | キー |
| -------- | --------------- | ---- |
| ○        | 既読/未読トグル | M    |
| ☆        | スター          | S    |
| BR       | Browser View    | V    |
| ✓        | 全既読          | A    |
| 🔍       | 検索            | /    |

---

## 8. Keyboard Shortcuts (Reeder-compatible)

### Accounts

| Key | Action        |
| --- | ------------- |
| R   | Sync All      |
| U   | Show Accounts |

### Subscriptions

| Key | Action                |
| --- | --------------------- |
| ⇧R  | Sync (current)        |
| P   | Previous Subscription |
| N   | Next Subscription     |
| X   | Toggle Folder         |
| ⌘N  | Add Subscription…     |

### Items

| Key | Action                    |
| --- | ------------------------- |
| J   | Next Item                 |
| K   | Previous Item             |
| ⇧J  | Next Feed (追加)          |
| ⇧K  | Previous Feed (追加)      |
| M   | Toggle Read               |
| S   | Toggle Starred            |
| I   | Show Article              |
| V   | View in Browser (WebView) |
| B   | Open in External Browser  |
| F   | Filter                    |
| C   | Clear (mark read & next)  |
| A   | Mark All as Read…         |
| G G | Jump to top (追加)        |
| ⇧G  | Jump to bottom (追加)     |
| /   | Search                    |
| Esc | Back / Close              |

### Phase 2

| Key | Action                         | 備考                                               |
| --- | ------------------------------ | -------------------------------------------------- |
| T   | Tags…                          |                                                    |
| G   | Toggle Reader View (full-text) | リスト⇧G(末尾)とはコンテキスト違い                 |
| ⇧G  | Toggle Bionic Reader View      | ContentPane フォーカス時のみ。ListPaneでは末尾移動 |

---

## 9. MVP Scope

### MVP (Phase 1)

- ローカルフィード購読 (RSS/Atom)
- FreshRSS連携 (Google Reader API)
- 3-pane responsive layout (wide/compact/mobile)
- Reader View + Browser View
- 既読/未読、スター管理
- オフラインキャッシュ (SQLite) + pending mutations
- 同期 (起動時 + イベント + 定期) + offline outbox
- キーボードショートカット (Reeder準拠)
- フィルター (All / Unread / Starred)
- 検索 (LIKE ベース)
- ダークテーマのみ (Reeder準拠。ライトモードはPhase 2)
- OPMLインポート (既存リーダーからの移行導線)

### Phase 2

- Inoreader連携
- OPML エクスポート
- 共有 (OS共有シート)
- Reader Mode (full-text抽出, readability)
- Bionic Reader View
- Tags
- FTS5 検索
- カスタムテーマ / ライトモード
