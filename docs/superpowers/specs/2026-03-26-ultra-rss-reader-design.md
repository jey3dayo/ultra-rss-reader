# Ultra RSS Reader — Design Specification

## Overview

Reederクローンのクロスプラットフォーム（Win/Mac）RSSリーダー。
複数アカウント（ローカルフィード、FreshRSS、Inoreader等）を統一インターフェースで管理する。

## Tech Stack

- **Desktop Framework**: Tauri v2
- **Frontend**: React (Vite) + TypeScript
- **State Management**: Zustand (UI state) + TanStack Query (server state cache)
- **Backend**: Rust (全ビジネスロジック)
- **Database**: SQLite (rusqlite, WALモード)

---

## 1. Architecture

### Layer Structure

```
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
└── ArticleService
    ※ Repository trait に依存（impl には依存しない）
        │
Rust Infrastructure Layer
├── Repository Impl (SqliteXxxRepository)
├── Feed Normalizer (feed-rs → NormalizedEntry → Domain Entity)
├── Event Bus (publish/subscribe)
├── HTTP client (reqwest)
└── Scheduler (tokio::time::interval)
        │
SQLite
├── 単一接続 + spawn_blocking隔離
├── WALモード (読み書き並行)
└── 書き込みはシリアル
```

### Design Principles

- **React層**: ドメインロジックは持たない。UIロジックと表示状態は持つ
- **Tauri Commands**: App Service / Facade。入力検証・DTO変換・エラーマッピング・非同期ジョブ起動
- **Application Layer**: ドメインのユースケース（純粋なビジネスロジック）
- **Infrastructure Layer**: 外部依存（HTTP, DB, Parser）の実装詳細

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

### Credential Storage

OS keychainを利用して認証情報を安全に保存する。

- **macOS**: Keychain Services (via `security-framework` crate)
- **Windows**: Windows Credential Manager (via `keyring` crate)
- Tauri v2の `tauri-plugin-stronghold` も候補だが、OS keychain の方がユーザーの期待に沿う

### SQLite Concurrency Model

- **Writer**: 単一の `Connection` を `Arc<Mutex<Connection>>` で管理。全ての書き込みはこのコネクション経由
- **Reader**: 読み取り専用コネクションを別途1つ保持（WALモードの利点を活用）
- **spawn_blocking**: 全DB操作は `tokio::task::spawn_blocking` でオフロード
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
    async fn authenticate(&mut self, credentials: &Credentials) -> Result<()>;
    async fn get_subscriptions(&self) -> Result<Vec<Feed>>;  // Subscription = Feed (domain)
    async fn get_folders(&self) -> Result<Vec<Folder>>;
    async fn get_entries(&self, feed_id: &str, options: FetchOptions) -> Result<Vec<NormalizedEntry>>;
    async fn mark_as_read(&self, entry_ids: &[String]) -> Result<()>;
    async fn set_starred(&self, entry_id: &str, starred: bool) -> Result<()>;
    async fn sync_state(&self) -> Result<()>;
}

struct FetchOptions {
    since: Option<DateTime<Utc>>,
    limit: Option<usize>,
    unread_only: Option<bool>,
}

enum ProviderKind {
    Local,       // ローカルフィード（アプリ自身がRSSフェッチ）
    FreshRss,    // Google Reader API互換
    Inoreader,   // Inoreader API
}
```

### Provider Implementations

- **LocalProvider**: 直接RSSフェッチ (reqwest + feed-rs)。authenticate() は no-op
- **GoogleReaderProvider** (FreshRSS): Google Reader API (`/reader/api/0/...`)。ServerURL + ユーザー名 + パスワード認証
- **InoreaderProvider**: Inoreader API (OAuth2)

---

## 3. Data Model

### Domain Entities

```rust
struct Account {
    id: AccountId,
    kind: ProviderKind,
    name: String,
    credentials: Credentials,  // 暗号化して保存
    sync_interval: Duration,
    sync_on_wake: bool,
    keep_read_items: Duration,
}

struct Folder {
    id: FolderId,
    account_id: AccountId,
    name: String,
    sort_order: i32,
}

struct Feed {
    id: FeedId,
    account_id: AccountId,
    folder_id: Option<FolderId>,
    title: String,
    url: String,
    site_url: String,
    icon: Option<Vec<u8>>,
    unread_count: i32,
}

struct Article {
    id: ArticleId,              // ID戦略で生成
    feed_id: FeedId,
    provider_id: Option<String>, // プロバイダ側のID（同期用）
    title: String,
    content_raw: String,         // フィードから取得した生HTML
    content_sanitized: String,   // sanitize済み（XSS除去、表示用）
    summary: Option<String>,
    url: String,
    author: Option<String>,
    published_at: DateTime<Utc>,
    thumbnail: Option<String>,
    is_read: bool,
    is_starred: bool,
    fetched_at: DateTime<Utc>,
}
```

### ID Strategy

優先順位ベースで安定IDを生成:

1. `entry.id` (GUID) — あればそのまま使う
2. Fallback hash: `sha256(feed_url + entry_url + published)`
   - 最優先: entry URL（記事の永続的な識別子）
   - 補助: published/updated（同URL別記事の区別用）
   - ベース: feed_url（名前空間分離）
   - **titleは使わない**（変更されうるため）

```rust
fn generate_entry_id(entry: &Entry, feed_url: &str) -> String {
    if let Some(id) = &entry.id {
        if !id.is_empty() { return id.clone(); }
    }
    let url = entry.links.first().map(|l| l.href.as_str()).unwrap_or("");
    let published = entry.published
        .or(entry.updated)
        .map(|dt| dt.timestamp())
        .unwrap_or(0);
    let input = format!("{}|{}|{}", feed_url, url, published);
    sha256_hex(&input)
}
```

### SQLite Schema

```sql
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    credentials_encrypted BLOB,
    sync_interval_secs INTEGER NOT NULL DEFAULT 3600,
    sync_on_wake INTEGER NOT NULL DEFAULT 0,
    keep_read_items_days INTEGER NOT NULL DEFAULT 30
);

CREATE TABLE folders (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE feeds (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    folder_id TEXT REFERENCES folders(id),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    site_url TEXT NOT NULL DEFAULT '',
    icon BLOB,
    unread_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE articles (
    id TEXT PRIMARY KEY,
    feed_id TEXT NOT NULL REFERENCES feeds(id),
    provider_id TEXT,
    title TEXT NOT NULL,
    content_raw TEXT NOT NULL DEFAULT '',
    content_sanitized TEXT NOT NULL DEFAULT '',
    summary TEXT,
    url TEXT NOT NULL,
    author TEXT,
    published_at TEXT NOT NULL,
    thumbnail TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    is_starred INTEGER NOT NULL DEFAULT 0,
    fetched_at TEXT NOT NULL
);

-- Unique constraint (URLベース。ID Strategyのfallback hashと整合)
-- ID生成: sha256(feed_url + entry_url + published) だが、
-- 重複判定はURLが最も安定なため feed_id + url で制約をかける。
-- 同一URLで日時違いのエントリは同一記事の更新として上書き(UPSERT)する。
CREATE UNIQUE INDEX idx_articles_feed_url ON articles(feed_id, url);

-- Performance indexes
CREATE INDEX idx_articles_feed_id ON articles(feed_id);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_is_read ON articles(feed_id, is_read);
CREATE INDEX idx_articles_is_starred ON articles(is_starred) WHERE is_starred = 1;
CREATE INDEX idx_articles_provider_id ON articles(provider_id);

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
// feed-rs → NormalizedEntry → Domain Entity
struct NormalizedEntry {
    id: String,
    title: String,
    content: String,
    summary: Option<String>,
    url: String,
    published_at: DateTime<Utc>,
    thumbnail: Option<String>,
    author: Option<String>,
}
```

---

## 4. Repository Pattern

```rust
// Application Layer で定義（trait）
trait ArticleRepository {
    fn find_by_feed(&self, feed_id: &FeedId) -> Result<Vec<Article>>;
    fn save(&self, articles: &[Article]) -> Result<()>;
    fn mark_as_read(&self, id: &ArticleId) -> Result<()>;
    fn mark_as_starred(&self, id: &ArticleId, starred: bool) -> Result<()>;
}

trait FeedRepository {
    fn find_by_account(&self, account_id: &AccountId) -> Result<Vec<Feed>>;
    fn save(&self, feed: &Feed) -> Result<()>;
    fn update_unread_count(&self, feed_id: &FeedId, count: i32) -> Result<()>;
}

trait FolderRepository {
    fn find_by_account(&self, account_id: &AccountId) -> Result<Vec<Folder>>;
    fn save(&self, folder: &Folder) -> Result<()>;
    fn delete(&self, id: &FolderId) -> Result<()>;
}

trait AccountRepository {
    fn find_all(&self) -> Result<Vec<Account>>;
    fn save(&self, account: &Account) -> Result<()>;
    fn delete(&self, id: &AccountId) -> Result<()>;
}

// Infrastructure Layer で実装
struct SqliteArticleRepository { /* ... */ }
impl ArticleRepository for SqliteArticleRepository { /* ... */ }

// テスト時
struct InMemoryArticleRepository { /* ... */ }
impl ArticleRepository for InMemoryArticleRepository { /* ... */ }
```

---

## 5. Event Bus & Sync Engine

### Event Bus

```rust
// 実装: tokio::broadcast channel ベース
// 型付きイベントのディスパッチ。ハンドラはサービス初期化時にsubscribe。
enum AppEvent {
    AppStarted,
    WindowFocused,
    ManualRefreshRequested,
    FeedUpdated { feed_id: FeedId },
    SyncCompleted { account_id: AccountId },
    ErrorOccurred { error: AppError },
    ScheduleTick { account_id: AccountId },
}
```

### Sync Triggers

| トリガー元          | Event                  | ハンドラ      |
| ------------------- | ---------------------- | ------------- |
| Tauri app setup     | AppStarted             | SyncService   |
| Tauri window event  | WindowFocused          | SyncService   |
| User clicks refresh | ManualRefreshRequested | SyncService   |
| tokio::interval     | ScheduleTick           | SyncService   |
| SyncService完了     | SyncCompleted          | UI通知 (emit) |
| SyncService完了     | FeedUpdated            | UI通知 (emit) |
| エラー発生          | ErrorOccurred          | UI通知 (emit) |

### Sync Design

- 起動時同期: AppStarted → 全アカウント即時同期
- イベント同期: WindowFocused, ManualRefreshRequested, wake from sleep
- 定期同期: tokio::time::interval、アカウントごとに間隔設定可能
- エラー時: exponential backoff

---

## 6. Error Model

```
DomainError (Rust Core)
├── NetworkError      - 接続失敗, タイムアウト, HTTP 4xx/5xx
├── ParseError        - フィード解析失敗, 不正なXML/JSON
├── PersistenceError  - DB読み書き失敗
├── AuthError         - 認証失敗, トークン期限切れ
└── ValidationError   - 不正な入力値

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

```
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
    ├── AccountSettingsModal
    └── ShareSheet
```

### Component Responsibilities

- **App**: Provider初期化、ルート状態接続、グローバルオーバーレイ管理
- **AppLayout**: レスポンシブ判定、pane配置、split view制御
- **SidebarPane**: アカウント・フィード系表示
- **ListPane**: 記事一覧・フィルタ・検索導線
- **ContentPane**: Reader/Browser切替、記事本文表示

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
};

// visiblePanes は保存しない（導出値）
// 状態を丸ごと受け取る方がスパゲッティ化しにくい
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

- **Reader View**: フィードから取得したcontent_sanitizedを表示
- **Browser View (BR)**: Tauri WebViewで元サイトを表示
- **Reader Mode (≡)**: Phase 2。readabilityライブラリで全文抽出表示

### Toolbar Actions (MVP)

| アイコン | 機能            | キー |
| -------- | --------------- | ---- |
| ○        | 既読/未読トグル | M    |
| ☆        | スター          | S    |
| BR       | Browser View    | V    |
| ⬆        | 共有            | -    |
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
- オフラインキャッシュ (SQLite)
- 同期 (起動時 + イベント + 定期)
- キーボードショートカット (Reeder準拠)
- フィルター (All / Unread / Starred)
- 検索
- 共有 (OS共有シート)
- ダークテーマのみ (Reeder準拠。ライトモードはPhase 2)
- OPMLインポート (既存リーダーからの移行導線)

### Phase 2

- Inoreader連携
- OPML エクスポート
- Reader Mode (full-text抽出, readability)
- Bionic Reader View
- Tags
- カスタムテーマ / ライトモード
