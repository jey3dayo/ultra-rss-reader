# Ultra RSS Reader — Plan 1: Rust Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: ローカルフィード取得・保存・同期がテストで確認できるRustバックエンドを構築する

Architecture: Tauri v2プロジェクトのRust側に、ドメインモデル → リポジトリ(SQLite) → LocalProvider → SyncEngine を積み上げる。各層はtrait境界で分離し、in-memoryモックでテスト可能。

Tech Stack: Rust, Tauri v2, rusqlite, feed-rs, reqwest, ammonia, tokio, tracing, keyring

Spec: `docs/superpowers/specs/2026-03-26-ultra-rss-reader-design.md`

---

## File Structure

```text
src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── build.rs
├── migrations/
│   └── V1__initial.sql
└── src/
    ├── main.rs                          # Tauri entrypoint
    ├── lib.rs                           # crate root, module declarations
    ├── domain/
    │   ├── mod.rs
    │   ├── types.rs                     # AccountId, FeedId, ArticleId newtypes
    │   ├── account.rs                   # Account entity
    │   ├── folder.rs                    # Folder entity
    │   ├── feed.rs                      # Feed entity
    │   ├── article.rs                   # Article entity + generate_entry_id()
    │   ├── provider.rs                  # ProviderKind, FeedIdentifier, PullScope, etc.
    │   └── error.rs                     # DomainError
    ├── repository/
    │   ├── mod.rs
    │   ├── account.rs                   # AccountRepository trait
    │   ├── folder.rs                    # FolderRepository trait
    │   ├── feed.rs                      # FeedRepository trait
    │   ├── article.rs                   # ArticleRepository trait
    │   ├── sync_state.rs               # SyncStateRepository trait
    │   └── pending_mutation.rs          # PendingMutationRepository trait
    ├── infra/
    │   ├── mod.rs
    │   ├── db/
    │   │   ├── mod.rs
    │   │   ├── connection.rs            # DB connection manager (writer task + reader)
    │   │   ├── migration.rs             # Schema migration runner
    │   │   ├── sqlite_account.rs        # SqliteAccountRepository
    │   │   ├── sqlite_folder.rs         # SqliteFolderRepository
    │   │   ├── sqlite_feed.rs           # SqliteFeedRepository
    │   │   ├── sqlite_article.rs        # SqliteArticleRepository
    │   │   ├── sqlite_sync_state.rs     # SqliteSyncStateRepository
    │   │   └── sqlite_pending_mutation.rs
    │   ├── provider/
    │   │   ├── mod.rs
    │   │   ├── traits.rs                # FeedProvider trait
    │   │   ├── local.rs                 # LocalProvider (RSS fetch + feed-rs)
    │   │   └── normalizer.rs            # feed-rs Entry → RemoteEntry conversion
    │   └── sanitizer.rs                 # ammonia HTML sanitizer
    ├── service/
    │   ├── mod.rs
    │   ├── sync_service.rs              # SyncService (mpsc command receiver)
    │   ├── sync_flow.rs                 # Account sync flow (the 6-step sequence)
    │   ├── event_bus.rs                 # SyncCommand + AppEvent channels
    │   └── housekeeping.rs              # RetentionPurge, OrphanCleanup
    └── commands/
        ├── mod.rs                       # Tauri command registrations
        ├── dto.rs                       # UI ↔ Domain DTOs
        ├── account_commands.rs          # add/remove/list accounts
        ├── feed_commands.rs             # list feeds, add subscription
        └── article_commands.rs          # list/read/star articles

src/                                     # React frontend (Plan 2)
├── ...

tests/                                   # Integration tests
└── rust/
    └── ...
```

---

## Task 1: Tauri v2 Project Scaffold

### Files

- Create: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/build.rs`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`
- Create: `src/main.tsx` (minimal React entrypoint)
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`

- [ ] **Step 1: Initialize Tauri v2 project**

```bash
pnpm create tauri-app ultra-rss-reader --template react-ts --manager pnpm
```

Alternatively if `create tauri-app` isn't available:

```bash
pnpm create vite . --template react-ts
pnpm add -D @tauri-apps/cli@^2
pnpm tauri init
```

- [ ] **Step 2: Add Rust dependencies to Cargo.toml**

Add to `src-tauri/Cargo.toml` `[dependencies]`:

```toml
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json"] }
feed-rs = "2"
ammonia = "4"
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4"] }
sha2 = "0.10"
hex = "0.4"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
keyring = "3"
async-trait = "0.1"
thiserror = "2"
```

- [ ] **Step 3: Verify build**

```bash
cd src-tauri && cargo check
```

Expected: compiles without errors

- [ ] **Step 4: Verify Tauri dev**

```bash
pnpm tauri dev
```

Expected: window opens with Vite React app

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: scaffold Tauri v2 + React + TypeScript project"
```

---

## Task 2: Domain Types & Error Model

### Files

- Create: `src-tauri/src/domain/mod.rs`, `types.rs`, `error.rs`

- [ ] **Step 1: Write test for newtype IDs**

Create `src-tauri/src/domain/types.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AccountId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct FeedId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct FolderId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ArticleId(pub String);

impl AccountId {
    pub fn new() -> Self { Self(uuid::Uuid::new_v4().to_string()) }
}
impl FeedId {
    pub fn new() -> Self { Self(uuid::Uuid::new_v4().to_string()) }
}
impl FolderId {
    pub fn new() -> Self { Self(uuid::Uuid::new_v4().to_string()) }
}

// Display impls for all ID types
impl std::fmt::Display for AccountId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "{}", self.0) }
}
impl std::fmt::Display for FeedId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "{}", self.0) }
}
impl std::fmt::Display for FolderId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "{}", self.0) }
}
impl std::fmt::Display for ArticleId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "{}", self.0) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn new_ids_are_unique() {
        let a = AccountId::new();
        let b = AccountId::new();
        assert_ne!(a, b);
    }
}
```

- [ ] **Step 2: Create DomainError**

Create `src-tauri/src/domain/error.rs`:

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DomainError {
    #[error("Network error: {0}")]
    Network(String),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Persistence error: {0}")]
    Persistence(String),
    #[error("Auth error: {0}")]
    Auth(String),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Keychain error: {0}")]
    Keychain(String),
}

pub type DomainResult<T> = Result<T, DomainError>;

// From impls for common error types
impl From<rusqlite::Error> for DomainError {
    fn from(e: rusqlite::Error) -> Self { Self::Persistence(e.to_string()) }
}
impl From<reqwest::Error> for DomainError {
    fn from(e: reqwest::Error) -> Self { Self::Network(e.to_string()) }
}
```

- [ ] **Step 3: Create domain module root**

Create `src-tauri/src/domain/mod.rs`:

```rust
pub mod types;
pub mod error;
```

Wire up in `src-tauri/src/lib.rs`:

```rust
pub mod domain;
```

- [ ] **Step 4: Run tests**

```bash
cd src-tauri && cargo test domain::
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/domain/ src-tauri/src/lib.rs && git commit -m "feat: add domain types and error model"
```

---

## Task 3: Domain Entities (Account, Folder, Feed, Article)

### Files

- Create: `src-tauri/src/domain/account.rs`, `folder.rs`, `feed.rs`, `article.rs`, `provider.rs`

- [ ] **Step 1: Create provider types**

Create `src-tauri/src/domain/provider.rs` with `ProviderKind`, `FeedIdentifier`, `PullScope`, `SyncCursor`, `PullResult`, `RemoteEntry`, `RemoteSubscription`, `RemoteFolder`, `RemoteState`, `Mutation`, `ProviderCapabilities` — all as defined in spec Section 2.

- [ ] **Step 2: Create Account entity**

Create `src-tauri/src/domain/account.rs` with `Account` struct as defined in spec Section 3.

- [ ] **Step 3: Create Folder, Feed entities**

Create `folder.rs` and `feed.rs` with structs as defined in spec Section 3.

- [ ] **Step 4: Create Article entity with generate_entry_id()**

Create `src-tauri/src/domain/article.rs`:

```rust
use sha2::{Sha256, Digest};
use hex;

pub fn generate_entry_id(account_id: &str, guid: Option<&str>, feed_url: &str, entry_url: Option<&str>, title: Option<&str>) -> String {
    // 1. GUID (account-scoped)
    if let Some(id) = guid {
        if !id.is_empty() {
            return format!("{}:{}", account_id, id);
        }
    }
    let url = entry_url.unwrap_or("");
    // 2. URL-based
    if !url.is_empty() {
        return sha256_hex(&format!("{}|{}|{}", account_id, feed_url, url));
    }
    // 3. Title-based fallback
    let t = title.unwrap_or("");
    sha256_hex(&format!("{}|{}|{}", account_id, feed_url, t))
}

fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guid_takes_precedence() {
        let id = generate_entry_id("acc1", Some("guid-123"), "http://feed.com", None, None);
        assert_eq!(id, "acc1:guid-123");
    }

    #[test]
    fn url_based_when_no_guid() {
        let id = generate_entry_id("acc1", None, "http://feed.com", Some("http://article.com/1"), None);
        assert!(!id.contains("acc1:"));
        assert_eq!(id.len(), 64); // sha256 hex
    }

    #[test]
    fn title_fallback_when_no_url() {
        let id = generate_entry_id("acc1", None, "http://feed.com", None, Some("My Title"));
        assert_eq!(id.len(), 64);
    }

    #[test]
    fn different_accounts_different_ids() {
        let id1 = generate_entry_id("acc1", Some("guid-1"), "http://feed.com", None, None);
        let id2 = generate_entry_id("acc2", Some("guid-1"), "http://feed.com", None, None);
        assert_ne!(id1, id2);
    }
}
```

- [ ] **Step 5: Update domain/mod.rs, run tests**

```bash
cd src-tauri && cargo test domain::
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/domain/ && git commit -m "feat: add domain entities and ID generation"
```

---

## Task 4: SQLite Schema & Migration Runner

### Files

- Create: `src-tauri/migrations/V1__initial.sql`
- Create: `src-tauri/src/infra/mod.rs`, `src-tauri/src/infra/db/mod.rs`, `connection.rs`, `migration.rs`

- [ ] **Step 1: Create migration SQL**

Create `src-tauri/migrations/V1__initial.sql` — copy exact SQL from spec Section 3 "SQLite Schema" (all CREATE TABLE + indexes + schema_version).

- [ ] **Step 2: Create DB connection manager**

Create `src-tauri/src/infra/db/connection.rs`:

- `DbManager` struct: owns writer `Connection` + reader `Connection`
- `DbManager::new(path)`: opens both connections, runs PRAGMAs, runs migrations
- `DbManager::writer(&self) -> &Connection`
- `DbManager::reader(&self) -> &Connection`
- MVP: synchronous access via references. Writer task (mpsc) は Task 11 で追加。

- [ ] **Step 3: Create migration runner**

Create `src-tauri/src/infra/db/migration.rs`:

- Read `schema_version` table (create if not exists)
- Compare with migration files
- Apply pending migrations in order
- Update `schema_version`

- [ ] **Step 4: Write integration test**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn migration_creates_all_tables() {
        let conn = Connection::open_in_memory().unwrap();
        // Apply PRAGMAs and migration
        run_migration(&conn, include_str!("../../../migrations/V1__initial.sql")).unwrap();

        // Verify tables exist
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();

        assert!(tables.contains(&"accounts".to_string()));
        assert!(tables.contains(&"feeds".to_string()));
        assert!(tables.contains(&"articles".to_string()));
        assert!(tables.contains(&"sync_state".to_string()));
        assert!(tables.contains(&"pending_mutations".to_string()));
    }
}
```

- [ ] **Step 5: Run test**

```bash
cd src-tauri && cargo test infra::db::
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src-tauri/migrations/ src-tauri/src/infra/ && git commit -m "feat: add SQLite schema and migration runner"
```

---

## Task 5: Repository Traits

### Files

- Create: `src-tauri/src/repository/mod.rs`, `account.rs`, `folder.rs`, `feed.rs`, `article.rs`, `sync_state.rs`, `pending_mutation.rs`

- [ ] **Step 1: Define all repository traits**

Copy trait definitions from spec Section 4 into individual files. Each trait in its own file. Include `Pagination` struct in `article.rs`.

- [ ] **Step 2: Wire up module**

```rust
// src-tauri/src/repository/mod.rs
pub mod account;
pub mod folder;
pub mod feed;
pub mod article;
pub mod sync_state;
pub mod pending_mutation;
```

Update `lib.rs`: `pub mod repository;`

- [ ] **Step 3: Verify compiles**

```bash
cd src-tauri && cargo check
```

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/repository/ && git commit -m "feat: add repository trait definitions"
```

---

## Task 6: SQLite Repository Implementations

### Files

- Create: `src-tauri/src/infra/db/sqlite_account.rs`, `sqlite_folder.rs`, `sqlite_feed.rs`, `sqlite_article.rs`, `sqlite_sync_state.rs`, `sqlite_pending_mutation.rs`

This is the largest task. Implement each repository against SQLite.

- [ ] **Step 1: Implement SqliteAccountRepository**

CRUD operations. Test with in-memory SQLite:

```rust
#[test]
fn save_and_find_all() {
    let db = test_db();
    let repo = SqliteAccountRepository::new(db.writer());
    let account = Account { id: AccountId::new(), kind: ProviderKind::Local, name: "Test".into(), /* ... */ };
    repo.save(&account).unwrap();
    let all = repo.find_all().unwrap();
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].name, "Test");
}
```

- [ ] **Step 2: Run account tests**

```bash
cd src-tauri && cargo test infra::db::sqlite_account
```

- [ ] **Step 3: Commit account repo**

- [ ] **Step 4: Implement SqliteFolderRepository + tests**

- [ ] **Step 5: Commit folder repo**

- [ ] **Step 6: Implement SqliteFeedRepository + tests**

Include `find_by_remote_id`, `find_by_url`, `recalculate_unread_count`.

- [ ] **Step 7: Commit feed repo**

- [ ] **Step 8: Implement SqliteArticleRepository + tests**

Key: UPSERT logic — `INSERT ... ON CONFLICT(id) DO UPDATE SET title=excluded.title, content_raw=excluded.content_raw, ... WHERE ...` preserving `is_read`, `is_starred`.

Test cases:

- Insert new article
- Upsert existing article preserves is_read/is_starred
- purge_old_read deletes old read articles
- apply_remote_state sets correct read/starred states
- apply_remote_state skips pending mutation articles
- find_by_feed with pagination

- [ ] **Step 9: Commit article repo**

- [ ] **Step 10: Implement SqliteSyncStateRepository + SqlitePendingMutationRepository + tests**

- [ ] **Step 11: Commit remaining repos**

---

## Task 7: HTML Sanitizer

### Files

- Create: `src-tauri/src/infra/sanitizer.rs`

- [ ] **Step 1: Create sanitizer with version tracking**

```rust
pub const SANITIZER_VERSION: u32 = 1;

pub fn sanitize_html(raw: &str) -> String {
    ammonia::Builder::default()
        .add_tags(&["img", "figure", "figcaption", "video", "source", "blockquote", "pre", "code"])
        .add_tag_attributes("img", &["src", "alt", "width", "height"])
        .add_tag_attributes("video", &["src", "controls", "width", "height"])
        .add_tag_attributes("source", &["src", "type"])
        .url_schemes(["http", "https"].iter().cloned().collect())
        .clean(raw)
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_script_tags() {
        let input = "<p>Hello</p><script>alert('xss')</script>";
        let output = sanitize_html(input);
        assert!(!output.contains("script"));
        assert!(output.contains("Hello"));
    }

    #[test]
    fn preserves_images() {
        let input = r#"<img src="https://example.com/img.jpg" alt="test">"#;
        let output = sanitize_html(input);
        assert!(output.contains("img"));
        assert!(output.contains("https://example.com/img.jpg"));
    }
}
```

- [ ] **Step 2: Run tests, commit**

```bash
cd src-tauri && cargo test infra::sanitizer
git add src-tauri/src/infra/sanitizer.rs && git commit -m "feat: add HTML sanitizer with ammonia"
```

---

## Task 8: Feed Normalizer (feed-rs → RemoteEntry)

### Files

- Create: `src-tauri/src/infra/provider/normalizer.rs`

- [ ] **Step 1: Implement feed-rs Entry → RemoteEntry conversion**

```rust
pub fn normalize_feed(feed_data: &[u8], feed_url: &str) -> DomainResult<Vec<RemoteEntry>> {
    let feed = feed_rs::parser::parse(feed_data)
        .map_err(|e| DomainError::Parse(e.to_string()))?;

    Ok(feed.entries.into_iter().map(|entry| {
        let url = entry.links.first().map(|l| l.href.clone());
        let published_at = entry.published.or(entry.updated);
        let thumbnail = extract_thumbnail(&entry);
        let content = entry.content
            .and_then(|c| c.body)
            .or_else(|| entry.summary.as_ref().map(|s| s.content.clone()))
            .unwrap_or_default();

        RemoteEntry {
            id: entry.id.filter(|id| !id.is_empty()),
            source_feed_id: FeedIdentifier::Local { feed_url: feed_url.to_string() },
            title: entry.title.map(|t| t.content).unwrap_or_default(),
            content,
            summary: entry.summary.map(|s| s.content),
            url,
            published_at,
            updated_at: entry.updated,
            thumbnail,
            author: entry.authors.first().map(|a| a.name.clone()),
            is_read: None,
            is_starred: None,
        }
    }).collect())
}
```

- [ ] **Step 2: Test with sample RSS/Atom XML**

Include a small test RSS fixture in test. Parse and verify fields.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/infra/provider/ && git commit -m "feat: add feed normalizer (feed-rs → RemoteEntry)"
```

---

## Task 9: LocalProvider

### Files

- Create: `src-tauri/src/infra/provider/traits.rs`, `src-tauri/src/infra/provider/local.rs`

- [ ] **Step 1: Define FeedProvider trait**

Create `traits.rs` with the `FeedProvider` async trait from spec Section 2.

- [ ] **Step 2: Implement LocalProvider**

```rust
pub struct LocalProvider {
    http_client: reqwest::Client,
}

impl LocalProvider {
    pub fn new() -> Self {
        Self { http_client: reqwest::Client::new() }
    }
}

#[async_trait]
impl FeedProvider for LocalProvider {
    fn kind(&self) -> ProviderKind { ProviderKind::Local }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            supports_folders: false,
            supports_starring: false,
            supports_search: false,
            supports_delta_sync: false,
            supports_remote_state: false,
        }
    }

    async fn authenticate(&mut self, _: &Credentials) -> DomainResult<()> { Ok(()) }

    async fn pull_entries(&self, scope: PullScope, _cursor: Option<SyncCursor>) -> DomainResult<PullResult> {
        let feed_url = match &scope {
            PullScope::Feed(FeedIdentifier::Local { feed_url }) => feed_url.clone(),
            _ => return Err(DomainError::Validation("LocalProvider only supports Feed scope".into())),
        };

        let bytes = self.http_client.get(&feed_url).send().await?.bytes().await?;
        let entries = normalizer::normalize_feed(&bytes, &feed_url)?;

        Ok(PullResult { entries, next_cursor: None, has_more: false })
    }

    // ... remaining methods as no-op or not-supported
}
```

- [ ] **Step 3: Test LocalProvider with mockito HTTP server**

Add `mockito` to dev-dependencies. Serve sample RSS, verify `pull_entries` returns correct `RemoteEntry` vec.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/infra/provider/ && git commit -m "feat: add LocalProvider for direct RSS fetching"
```

---

## Task 10: Event Bus (SyncCommand + AppEvent)

### Files

- Create: `src-tauri/src/service/event_bus.rs`

- [ ] **Step 1: Implement channels**

```rust
use tokio::sync::{mpsc, broadcast};

pub struct EventBus {
    pub command_tx: mpsc::Sender<SyncCommand>,
    pub command_rx: mpsc::Receiver<SyncCommand>,  // owned by SyncService
    pub event_tx: broadcast::Sender<AppEvent>,
}

impl EventBus {
    pub fn new() -> (mpsc::Sender<SyncCommand>, mpsc::Receiver<SyncCommand>, broadcast::Sender<AppEvent>) {
        let (cmd_tx, cmd_rx) = mpsc::channel(64);
        let (evt_tx, _) = broadcast::channel(64);
        (cmd_tx, cmd_rx, evt_tx)
    }
}
```

- [ ] **Step 2: Define SyncCommand and AppEvent enums**

From spec Section 5.

- [ ] **Step 3: Test send/receive**

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/service/ && git commit -m "feat: add event bus (SyncCommand + AppEvent channels)"
```

---

## Task 11: SyncService & Sync Flow

### Files

- Create: `src-tauri/src/service/sync_service.rs`, `sync_flow.rs`

- [ ] **Step 1: Implement sync_flow (6-step sequence)**

Create `sync_flow.rs` implementing the account sync sequence from spec Section 4:

1. push_mutations → 2. get_folders → 3. get_subscriptions → 4. pull_entries → 5. pull_state → 6. recalculate_unread_count

The function takes repository traits + provider trait as parameters (injectable for testing).

- [ ] **Step 2: Implement SyncService (command loop)**

```rust
pub struct SyncService { /* ... */ }

impl SyncService {
    pub async fn run(
        mut cmd_rx: mpsc::Receiver<SyncCommand>,
        event_tx: broadcast::Sender<AppEvent>,
        // ... repositories, providers
    ) {
        while let Some(cmd) = cmd_rx.recv().await {
            match cmd {
                SyncCommand::SyncAll => { /* iterate accounts, call sync_flow */ }
                SyncCommand::SyncAccount { account_id } => { /* ... */ }
                // ...
            }
        }
    }
}
```

- [ ] **Step 3: Test sync_flow with in-memory repos + mock provider**

Create a mock `FeedProvider` that returns canned data. Verify the full flow:

- Folders created
- Feeds created
- Articles upserted
- Unread counts correct

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/service/ && git commit -m "feat: add SyncService and 6-step sync flow"
```

---

## Task 12: Housekeeping Service

### Files

- Create: `src-tauri/src/service/housekeeping.rs`

- [ ] **Step 1: Implement RetentionPurge**

Uses `ArticleRepository::purge_old_read()`.

- [ ] **Step 2: Test purge deletes old read articles but keeps unread/starred**

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/service/housekeeping.rs && git commit -m "feat: add housekeeping service (retention purge)"
```

---

## Task 13: Minimal Tauri Commands (smoke test)

### Files

- Create: `src-tauri/src/commands/mod.rs`, `dto.rs`, `account_commands.rs`, `feed_commands.rs`, `article_commands.rs`

- [ ] **Step 1: Create AppError for Tauri**

```rust
#[derive(Debug, Serialize)]
pub enum AppError {
    UserVisible { message: String },
    Retryable { message: String },
}

impl From<DomainError> for AppError {
    fn from(e: DomainError) -> Self {
        AppError::UserVisible { message: e.to_string() }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::UserVisible { message } => write!(f, "{}", message),
            AppError::Retryable { message } => write!(f, "{}", message),
        }
    }
}
```

- [ ] **Step 2: Create minimal commands**

```rust
#[tauri::command]
async fn list_accounts(state: tauri::State<'_, AppState>) -> Result<Vec<AccountDto>, AppError> {
    let accounts = state.account_repo.find_all()?;
    Ok(accounts.into_iter().map(AccountDto::from).collect())
}

#[tauri::command]
async fn add_local_feed(state: tauri::State<'_, AppState>, url: String) -> Result<FeedDto, AppError> {
    // Validate URL, create feed, trigger initial sync
    // ...
}
```

- [ ] **Step 3: Register commands in main.rs**

```rust
fn main() {
    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            list_accounts, add_local_feed, list_feeds, list_articles
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Verify compiles and app starts**

```bash
pnpm tauri dev
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/ src-tauri/src/main.rs && git commit -m "feat: add minimal Tauri commands for account/feed/article"
```

---

## Task 14: End-to-End Integration Test

### Files

- Create: `src-tauri/tests/integration_test.rs`

- [ ] **Step 1: Write E2E test: add local feed → sync → read articles**

```rust
#[tokio::test]
async fn local_feed_e2e() {
    // 1. Setup: in-memory DB, LocalProvider with mockito
    // 2. Create account (Local)
    // 3. Add feed subscription
    // 4. Run sync_flow
    // 5. Verify articles saved to DB
    // 6. Mark article as read
    // 7. Verify unread count updated
    // 8. Run purge (articles should survive since they're recent)
}
```

- [ ] **Step 2: Run integration test**

```bash
cd src-tauri && cargo test --test integration_test
```

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tests/ && git commit -m "test: add end-to-end integration test for local feed flow"
```

---

## Summary

After completing all 14 tasks, the Rust core provides:

| Capability                                                  | Status |
| ----------------------------------------------------------- | ------ |
| Domain models (Account, Folder, Feed, Article)              | ✅     |
| ID generation (account-scoped, GUID/URL/title fallback)     | ✅     |
| SQLite schema + migration                                   | ✅     |
| All repository implementations (UPSERT, apply_remote_state) | ✅     |
| HTML sanitizer (ammonia)                                    | ✅     |
| Feed normalizer (feed-rs → RemoteEntry)                     | ✅     |
| LocalProvider (RSS fetch)                                   | ✅     |
| FeedProvider trait (extensible)                             | ✅     |
| Event bus (SyncCommand + AppEvent)                          | ✅     |
| SyncService (6-step sync flow)                              | ✅     |
| Housekeeping (retention purge)                              | ✅     |
| Minimal Tauri commands                                      | ✅     |
| Error model (DomainError → AppError)                        | ✅     |
| Integration test                                            | ✅     |

Next: Plan 2 (Frontend) — React UI + 3-pane layout + Zustand state + TanStack Query
