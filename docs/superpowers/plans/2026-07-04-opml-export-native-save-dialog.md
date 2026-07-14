# OPML Export Native Save Dialog Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: Replace the browser Blob + `<a download>` OPML export with a native save dialog and an atomic temp-file-then-rename write, satisfying the test-declared `filesystem_recovery_contract(OpmlExport)` and promoting the sleep/resume stance from `Unsupported` to `Guarded`.

Architecture: A new Tauri command `export_opml_to_file(account_id, path)` generates the OPML string in the backend (shared with the current generation logic) and writes it atomically next to the destination (`<name>.opml.tmp` → `fs::rename`), mirroring `settings_profile_commands::export_settings_profile_to_file` for the dialog/path flow and `infra/db/backup.rs::copy_backup_file_atomic` for the atomic-write shape. The frontend hook `useAccountDetailDangerZone.handleExportOpml` follows the `handleExportSettingsProfile` pattern: `showSaveDialog` → `null` cancel is a silent no-op → invoke the command → Result toast on failure. The legacy string-returning `export_opml` command is removed after the frontend is migrated (5 tasks, each commit compiles and its test suites pass).

Tech Stack: Tauri 2 (Rust commands, `tauri-plugin-dialog` via existing `src/lib/platform/save-dialog.ts` wrapper with `dialog:allow-save` already granted), React + `@praha/byethrow` Result, zod IPC schemas, vitest (node/jsdom projects), cargo test with `tempfile` (already a dev-dependency).

## Global Constraints

- Contract to satisfy (`src-tauri/src/commands/database_commands.rs:329-339`, `filesystem_recovery_contract(OpmlExport)`): `atomic_write: TempFileThenRename`, `overwrite_confirmation: ConfirmBeforeReplacingExistingFile` (delegated to the OS save dialog), `cancel_policy: NoOpSuccess` (no error, no toast), `auto_appends_extension: true` (code appends `.opml`; do not trust the OS dialog), `dialog_extension: RequireOpmlExtension` (dialog filter `{ name: "OPML", extensions: ["opml"] }`), `filename_suggestion`: `buildOpmlExportFilename(account.name)` as `defaultPath`, `exposes_raw_path_to_webview: true` (dialog returns the raw path to the frontend, which passes it to the command).
- i18n: reuse existing keys `account.export_opml`, `account.exporting_opml`, `account.failed_to_export_opml`. No new copy. No success toast (parity with current behavior). Cancel produces no toast.
- All Tauri invokes go through `safeInvoke` (`.claude/rules/tauri-ipc-error-handling.md`); errors handled with `Result.pipe` + `Result.inspectError`.
- Rust tests follow `.claude/rules/rust-test-unwrap-policy.md`: `unwrap()` only at fixture boundaries; production behavior boundaries use `expect("... should ...")` / `expect_err("... should ...")` / `matches!` with named policy.
- Commits: Conventional Commits, no footers.
- `export_opml_to_file` uses `CommandDbLockPolicy::BlockingLock` (same as `export_settings_profile_to_file`).
- The i18n label key string `account.export_opml` (locales + `use-account-detail-view-props.tsx`) is unrelated to the command name and must NOT be renamed.
- Verification commands: Rust `cd src-tauri && cargo test <filter>`; frontend `pnpm exec vitest run <path>` (project is selected automatically by the `*.node.test.*` glob); full gate `mise run check` at the end of Task 5.

---

### Task 1: Backend command `export_opml_to_file` with atomic write (legacy `export_opml` kept temporarily)

### Files

- Modify: `src-tauri/src/commands/opml_commands.rs` (command + helpers + tests; refactor `export_opml` body into a shared generator)
- Modify: `src-tauri/src/commands/mod.rs:109-112` (lock-policy match arm) and `src-tauri/src/commands/mod.rs:442` area (lock-policy test table)
- Modify: `src-tauri/src/lib.rs:907` (generate_handler registration)
- Modify: `src-tauri/permissions/reader-commands.toml:51` (command allowlist)
- Modify: `src/__tests__/schemas/tauri-window-capability-contract.test.ts:103` (expected reader-commands allowlist)

### Interfaces

- Consumes: existing `crate::commands::lock_db`, `SqliteAccountRepository` / `SqliteFolderRepository` / `SqliteFeedRepository`, `opml::generate_opml`, `crate::infra::db::backup::redacted_path_label` (already `pub(crate)`).
- Produces (later tasks rely on these exact names):
  - `#[tauri::command] pub fn export_opml_to_file(state: State<'_, AppState>, account_id: String, path: String) -> Result<(), AppError>` — frontend invokes it as `"export_opml_to_file"` with args `{ accountId, path }`.
  - `fn generate_export_opml_in_db(db: &DbManager, account_id: String) -> Result<String, AppError>` (shared generator; `export_opml` keeps working through it until Task 4).
  - `fn export_opml_to_file_in_db(db: &DbManager, account_id: String, path: &Path) -> Result<(), AppError>`, `fn validate_opml_export_path(path: String) -> Result<PathBuf, AppError>`, `fn ensure_opml_extension(path: PathBuf) -> PathBuf`, `fn opml_export_temp_path(path: &Path) -> PathBuf`, `fn write_opml_export_atomic(path: &Path, contents: &str) -> Result<(), AppError>`.

- [ ] **Step 1: Write the failing Rust tests**

In `src-tauri/src/commands/opml_commands.rs`, inside the existing `#[cfg(test)] mod tests`, add (note: `PathBuf` is imported inside the test module because production code adds its own import in Step 3):

```rust
    fn export_dir() -> tempfile::TempDir {
        tempfile::tempdir().expect("temp OPML export directory should be created")
    }

    #[test]
    fn export_to_file_appends_opml_extension_only_when_missing() {
        use std::path::PathBuf;

        assert_eq!(
            ensure_opml_extension(PathBuf::from("/tmp/feeds")),
            PathBuf::from("/tmp/feeds.opml")
        );
        assert_eq!(
            ensure_opml_extension(PathBuf::from("/tmp/feeds.opml")),
            PathBuf::from("/tmp/feeds.opml")
        );
        assert_eq!(
            ensure_opml_extension(PathBuf::from("/tmp/FEEDS.OPML")),
            PathBuf::from("/tmp/FEEDS.OPML")
        );
        assert_eq!(
            ensure_opml_extension(PathBuf::from("/tmp/feeds.xml")),
            PathBuf::from("/tmp/feeds.xml.opml")
        );
    }

    #[test]
    fn export_to_file_writes_opml_through_temp_file_without_leaving_temp_artifact() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let folder_id = insert_test_folder(&db, &account_id, "Engineering");
        insert_test_feed(
            &db,
            &account_id,
            Some(&folder_id),
            "Rust Blog",
            "https://blog.rust-lang.org/feed.xml",
        );
        let dir = export_dir();
        let dest = dir.path().join("Primary-feeds.opml");

        export_opml_to_file_in_db(&db, account_id.0.clone(), &dest)
            .expect("OPML export should write the destination file");

        let written =
            std::fs::read_to_string(&dest).expect("exported OPML file should be readable");
        assert!(written.contains("<opml"));
        assert!(written.contains("https://blog.rust-lang.org/feed.xml"));
        assert!(
            !opml_export_temp_path(&dest).exists(),
            "atomic OPML export should not leave a temp file behind"
        );
    }

    #[test]
    fn export_to_file_replaces_stale_temp_artifacts_before_writing() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let dir = export_dir();
        let dest = dir.path().join("feeds.opml");
        std::fs::write(opml_export_temp_path(&dest), "stale partial artifact").unwrap();

        export_opml_to_file_in_db(&db, account_id.0.clone(), &dest)
            .expect("stale temp artifacts should not block a fresh export");

        assert!(std::fs::read_to_string(&dest).unwrap().contains("<opml"));
        assert!(
            !opml_export_temp_path(&dest).exists(),
            "stale temp artifact should be replaced and cleaned up"
        );
    }

    #[test]
    fn export_to_file_cleans_up_temp_file_when_finalize_rename_fails() {
        let db = test_db();
        let account_id = insert_test_account(&db, "Primary");
        let dir = export_dir();
        let dest = dir.path().join("feeds.opml");
        // A directory at the destination makes fs::rename(file -> dir) fail.
        std::fs::create_dir(&dest).unwrap();

        let error = export_opml_to_file_in_db(&db, account_id.0.clone(), &dest)
            .expect_err("finalizing onto a directory should fail the export");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message.contains("Failed to write OPML export")
        ));
        assert!(
            !opml_export_temp_path(&dest).exists(),
            "failed OPML export should clean up its temp file"
        );
    }

    #[test]
    fn export_to_file_rejects_blank_path_before_touching_the_database() {
        let error = validate_opml_export_path("   ".to_string())
            .expect_err("blank OPML export paths should be rejected");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "OPML export path cannot be empty"
        ));
    }

    #[test]
    fn export_to_file_reports_missing_account_without_creating_the_file() {
        let db = test_db();
        let dir = export_dir();
        let dest = dir.path().join("feeds.opml");

        let error = export_opml_to_file_in_db(&db, "missing".to_string(), &dest)
            .expect_err("missing account should fail the export before writing");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Account not found"
        ));
        assert!(!dest.exists());
        assert!(!opml_export_temp_path(&dest).exists());
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/t00114/src/github.com/jey3dayo/ultra-rss-reader/src-tauri && cargo test --lib opml_commands::tests::export_to_file`
Expected: compile error — `ensure_opml_extension`, `export_opml_to_file_in_db`, `opml_export_temp_path`, `validate_opml_export_path` not found.

- [ ] **Step 3: Implement the command, helpers, and shared generator**

In `src-tauri/src/commands/opml_commands.rs`:

Add to the imports at the top of the file (after `use std::sync::Mutex;`):

```rust
use std::path::{Path, PathBuf};
```

Add the constants next to the existing OPML constants (after line 32 `OPML_IMPORT_CONTENT_TOO_LARGE_MESSAGE`):

```rust
const OPML_EXPORT_PATH_EMPTY_MESSAGE: &str = "OPML export path cannot be empty";
const OPML_EXPORT_WRITE_ERROR_PREFIX: &str = "Failed to write OPML export";
const OPML_EXPORT_FILE_EXTENSION: &str = "opml";
```

Replace the body of the current `export_opml` command (`opml_commands.rs:318-357`) with a thin wrapper plus shared generator, and add the new command + helpers directly below it:

```rust
#[tauri::command]
pub fn export_opml(state: State<'_, AppState>, account_id: String) -> Result<String, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    generate_export_opml_in_db(&db, account_id)
}

#[tauri::command]
pub fn export_opml_to_file(
    state: State<'_, AppState>,
    account_id: String,
    path: String,
) -> Result<(), AppError> {
    let path = validate_opml_export_path(path)?;
    let db = crate::commands::lock_db(&state.db)?;
    export_opml_to_file_in_db(&db, account_id, &path)
}

fn export_opml_to_file_in_db(
    db: &DbManager,
    account_id: String,
    path: &Path,
) -> Result<(), AppError> {
    let opml = generate_export_opml_in_db(db, account_id)?;
    write_opml_export_atomic(path, &opml)
}

fn generate_export_opml_in_db(db: &DbManager, account_id: String) -> Result<String, AppError> {
    let account_id = AccountId(account_id);

    // Get account name for the OPML title
    let account_repo = SqliteAccountRepository::new(db.reader());
    let accounts = account_repo.find_all().map_err(AppError::from)?;
    let account = accounts
        .iter()
        .find(|a| a.id == account_id)
        .ok_or_else(|| AppError::UserVisible {
            message: "Account not found".to_string(),
        })?;
    let title = account.name.clone();

    // Load folders for name lookup
    let folder_repo = SqliteFolderRepository::new(db.reader());
    let folders = folder_repo
        .find_by_account(&account_id)
        .map_err(AppError::from)?;
    // Load feeds and convert to OpmlFeed
    let feed_repo = SqliteFeedRepository::new(db.reader());
    let feeds = feed_repo
        .find_by_account(&account_id)
        .map_err(AppError::from)?;

    let opml_feeds = build_export_opml_feeds(feeds, folders);

    opml::generate_opml(&title, &opml_feeds).map_err(|_message| {
        tracing::error!(
            error = OPML_GENERATE_LOG_ERROR,
            "failed to generate OPML export"
        );
        AppError::UserVisible {
            message: OPML_GENERATE_ERROR_MESSAGE.to_string(),
        }
    })
}

fn validate_opml_export_path(path: String) -> Result<PathBuf, AppError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppError::UserVisible {
            message: OPML_EXPORT_PATH_EMPTY_MESSAGE.to_string(),
        });
    }
    Ok(ensure_opml_extension(PathBuf::from(trimmed)))
}

/// Contract: auto_appends_extension. Append ".opml" when the selected path
/// does not already have the extension; never replace a user-provided
/// extension because the OS dialog confirmed overwrite for that exact name.
fn ensure_opml_extension(path: PathBuf) -> PathBuf {
    let has_opml_extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case(OPML_EXPORT_FILE_EXTENSION));
    if has_opml_extension {
        return path;
    }

    let Some(file_name) = path.file_name() else {
        return path.with_file_name("feeds.opml");
    };
    let mut file_name = file_name.to_os_string();
    file_name.push(".opml");
    path.with_file_name(file_name)
}

fn opml_export_temp_path(path: &Path) -> PathBuf {
    let mut file_name = path
        .file_name()
        .map(std::ffi::OsStr::to_os_string)
        .unwrap_or_else(|| std::ffi::OsString::from("feeds.opml"));
    file_name.push(".tmp");
    path.with_file_name(file_name)
}

/// Contract: TempFileThenRename with temp cleanup on failure
/// (same shape as infra/db/backup.rs::copy_backup_file_atomic).
fn write_opml_export_atomic(path: &Path, contents: &str) -> Result<(), AppError> {
    let temp_path = opml_export_temp_path(path);
    if temp_path.exists() {
        std::fs::remove_file(&temp_path)
            .map_err(|error| opml_export_write_error(&temp_path, &error))?;
    }
    std::fs::write(&temp_path, contents).map_err(|error| {
        let _ = std::fs::remove_file(&temp_path);
        opml_export_write_error(path, &error)
    })?;
    std::fs::rename(&temp_path, path).map_err(|error| {
        let _ = std::fs::remove_file(&temp_path);
        opml_export_write_error(path, &error)
    })?;
    Ok(())
}

fn opml_export_write_error(path: &Path, error: &std::io::Error) -> AppError {
    tracing::error!(
        error = %error,
        path = %crate::infra::db::backup::redacted_path_label(path),
        "failed to write OPML export"
    );
    AppError::UserVisible {
        message: format!(
            "{OPML_EXPORT_WRITE_ERROR_PREFIX}: {error} ({})",
            crate::infra::db::backup::redacted_path_label(path)
        ),
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/t00114/src/github.com/jey3dayo/ultra-rss-reader/src-tauri && cargo test --lib opml_commands`
Expected: all new `export_to_file_*` tests PASS; all pre-existing `import_*`/`export_*` tests still PASS.

- [ ] **Step 5: Wire the new command (dispatcher policy, handler, permission, capability contract test)**

`src-tauri/src/commands/mod.rs` — in `command_db_lock_policy`, the `BlockingLock` arm currently reads (lines 108-112):

```rust
        | "toggle_article_star"
        | "export_opml"
        | "export_settings_profile"
        | "export_settings_profile_to_file"
```

Change to:

```rust
        | "toggle_article_star"
        | "export_opml"
        | "export_opml_to_file"
        | "export_settings_profile"
        | "export_settings_profile_to_file"
```

`src-tauri/src/commands/mod.rs` — in the test `command_db_lock_policy_classifies_command_categories` (line 442), after `("export_opml", CommandDbLockPolicy::BlockingLock),` add:

```rust
            ("export_opml_to_file", CommandDbLockPolicy::BlockingLock),
```

`src-tauri/src/lib.rs` — after line 907 `commands::opml_commands::export_opml,` add:

```rust
            commands::opml_commands::export_opml_to_file,
```

`src-tauri/permissions/reader-commands.toml` — after `"export_opml",` (line 51) add:

```toml
  "export_opml_to_file",
```

`src/__tests__/schemas/tauri-window-capability-contract.test.ts` — in the `reader-commands` array of `expectedCommandOwnerAllowlists`, after `"export_opml",` (line 103) add:

```ts
    "export_opml_to_file",
```

- [ ] **Step 6: Verify wiring compiles and contract test passes**

Run: `cd /Users/t00114/src/github.com/jey3dayo/ultra-rss-reader/src-tauri && cargo test --lib commands::tests::command_db_lock_policy_classifies_command_categories`
Expected: PASS.
Run: `pnpm exec vitest run src/__tests__/schemas/tauri-window-capability-contract.test.ts`
Expected: PASS (registered handler, permission allowlist, and expected list all contain both `export_opml` and `export_opml_to_file`).

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands/opml_commands.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src-tauri/permissions/reader-commands.toml src/__tests__/schemas/tauri-window-capability-contract.test.ts
git commit -m "feat(opml): add export_opml_to_file command with atomic temp-file write"
```

---

### Task 2: Frontend IPC wiring — schema, wrapper, dev mock (additive; legacy wrapper stays until Task 4)

### Files

- Modify: `src/api/schemas/commands/integration.ts:58` (new args schema)
- Modify: `src/api/schemas/commands/registry.ts:56,138` (import + registry entry)
- Modify: `src/api/schemas/index.ts:48` (barrel re-export)
- Modify: `src/api/tauri-commands/sync.ts` (new wrapper)
- Modify: `src/dev/mocks.ts:927` area (new browser dev-mode mock case)
- Test: `src/__tests__/api/tauri-commands.node.test.ts` (blank-arg contract), `src/__tests__/dev/dev-mocks-browser.node.test.ts` (dev mock round-trip)

### Interfaces

- Consumes: Task 1's `export_opml_to_file` command name and `{ accountId, path }` camelCase args; existing `safeInvoke`, `NullResponseSchema`, `nonBlankTrimmedIdSchema`, `parseBrowserMockArgs`.
- Produces: `export const exportOpmlToFileArgs = z.object({ accountId: nonBlankTrimmedIdSchema, path: z.string().trim().min(1) })` (exported from `@/api/schemas`); `export const exportOpmlToFile = (accountId: string, path: string) => Result.ResultAsync<null, AppError>`-shaped wrapper exported from `@/api/tauri-commands`. Task 3's hook imports `exportOpmlToFile`.

- [ ] **Step 1: Write the failing wrapper contract test**

In `src/__tests__/api/tauri-commands.node.test.ts`, add `exportOpmlToFile` to the `@/api/tauri-commands` import list (next to `exportOpml` at line 37), then add one row to the blank-id table right after line 1609 `["accountId", "export_opml", () => exportOpml("   ")],`:

```ts
    ["accountId", "export_opml_to_file", () => exportOpmlToFile("   ", "/tmp/feeds.opml")],
```

In `src/__tests__/dev/dev-mocks-browser.node.test.ts`, add `exportOpmlToFile` to the `@/api/tauri-commands` import block (next to `exportOpml` at line 54), and directly after the existing line 452 (`StringResponseSchema.parse(...exportOpml...)`) add:

```ts
    expect(Result.unwrap(await exportOpmlToFile("acc-freshrss", "/tmp/acc-freshrss-feeds.opml"))).toBeNull();
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/__tests__/api/tauri-commands.node.test.ts src/__tests__/dev/dev-mocks-browser.node.test.ts`
Expected: FAIL — `exportOpmlToFile` is not exported from `@/api/tauri-commands`.

- [ ] **Step 3: Implement schema, registry entry, barrel export, wrapper, and dev mock**

`src/api/schemas/commands/integration.ts` — after line 58 (`export const exportOpmlArgs = ...`) add:

```ts
export const exportOpmlToFileArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  path: z.string().trim().min(1),
});
```

`src/api/schemas/commands/registry.ts` — extend the `./integration` import (lines 53-61) to include `exportOpmlToFileArgs`:

```ts
import {
  addToReadingListArgs,
  copyToClipboardArgs,
  exportOpmlArgs,
  exportOpmlToFileArgs,
  importOpmlArgs,
  openExternalUrlArgs,
  openInBrowserArgs,
  setPreferenceArgs,
} from "./integration";
```

and after line 138 `export_opml: exportOpmlArgs,` add:

```ts
  export_opml_to_file: exportOpmlToFileArgs,
```

`src/api/schemas/index.ts` — after line 48 `exportOpmlArgs,` add:

```ts
  exportOpmlToFileArgs,
```

`src/api/tauri-commands/sync.ts` — extend the schema import and add the wrapper below `exportOpml`:

```ts
import {
  exportOpmlArgs,
  exportOpmlToFileArgs,
  FeedDtoListSchema,
  importOpmlArgs,
  NullResponseSchema,
  StringResponseSchema,
  SyncResultSchema,
  startupSyncArgs,
  syncAccountArgs,
  syncFeedArgs,
} from "@/api/schemas";
```

```ts
export const exportOpmlToFile = (accountId: string, path: string) =>
  safeInvoke(
    "export_opml_to_file",
    { response: NullResponseSchema, args: exportOpmlToFileArgs },
    { accountId, path },
  );
```

`src/dev/mocks.ts` — after the `case "export_opml":` block (ends line 938) add, mirroring the `export_settings_profile_to_file` case at line 876:

```ts
      case "export_opml_to_file":
        parseBrowserMockArgs("export_opml_to_file", rawIpcPayload);
        return null;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/api/tauri-commands.node.test.ts src/__tests__/dev/dev-mocks-browser.node.test.ts src/__tests__/api/schema-barrel-public-api.test.ts src/__tests__/api/schemas.node.test.ts`
Expected: PASS. (`schema-barrel-public-api.test.ts` derives the expected barrel export name `exportOpmlToFileArgs` from the registry key automatically — no edit needed there; running it proves the barrel export in `index.ts` is correct.)

- [ ] **Step 5: Commit**

```bash
git add src/api/schemas/commands/integration.ts src/api/schemas/commands/registry.ts src/api/schemas/index.ts src/api/tauri-commands/sync.ts src/dev/mocks.ts src/__tests__/api/tauri-commands.node.test.ts src/__tests__/dev/dev-mocks-browser.node.test.ts
git commit -m "feat(api): add exportOpmlToFile IPC wrapper, schema, and dev mock"
```

---

### Task 3: Hook rewrite — native save dialog flow in `handleExportOpml` (tests first)

### Files

- Modify: `src/components/settings/hooks/account-detail/use-account-detail-danger-zone.ts` (export handler + remove Blob/objectURL machinery)
- Test: `src/__tests__/hooks/use-account-detail-danger-zone.node.test.tsx` (rewrite Blob/anchor export tests to showSaveDialog pattern)
- Test: `src/__tests__/components/account-detail.test.tsx:1511-1562` (rewrite objectURL integration test)
- Verify only (no expected change): `src/__tests__/components/account-danger-zone-view.test.tsx` (pure view test; `onExport` callback contract is unchanged)

### Interfaces

- Consumes: `exportOpmlToFile(accountId: string, path: string)` from `@/api/tauri-commands` (Task 2); `showSaveDialog(options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null>` from `@/lib/platform/save-dialog`; existing `buildOpmlExportFilename`, `createAccountDetailErrorToast(t, "account.failed_to_export_opml")`, `getErrorMessage`.
- Produces: unchanged public hook contract — `handleExportOpml: () => Promise<void>`, `exportingOpml: boolean`, and unchanged `buildOpmlExportFilename` export. `use-account-detail-view-props.tsx` needs no changes.

- [ ] **Step 1: Rewrite the export tests in the hook test file**

In `src/__tests__/hooks/use-account-detail-danger-zone.node.test.tsx`:

(a) In the `vi.hoisted` block (lines 20-40), rename `exportOpmlMock` to `exportOpmlToFileMock` and add a hoisted dialog mock after the block:

```ts
const {
  deleteAccountMock,
  exportLocalAccountSyncOperationsMock,
  exportOpmlToFileMock,
  getLocalAccountSyncSettingsMock,
  getPreferencesMock,
  importLocalAccountSyncOperationsMock,
  importOpmlMock,
  setLocalAccountSyncSettingsMock,
  setPreferenceMock,
} = vi.hoisted(() => ({
  deleteAccountMock: vi.fn(),
  exportLocalAccountSyncOperationsMock: vi.fn(),
  exportOpmlToFileMock: vi.fn(),
  getLocalAccountSyncSettingsMock: vi.fn(),
  getPreferencesMock: vi.fn(),
  importLocalAccountSyncOperationsMock: vi.fn(),
  importOpmlMock: vi.fn(),
  setLocalAccountSyncSettingsMock: vi.fn(),
  setPreferenceMock: vi.fn(),
}));

const { showSaveDialogMock } = vi.hoisted(() => ({ showSaveDialogMock: vi.fn() }));

vi.mock("@/api/tauri-commands", () => ({
  deleteAccount: deleteAccountMock,
  exportLocalAccountSyncOperations: exportLocalAccountSyncOperationsMock,
  exportOpmlToFile: exportOpmlToFileMock,
  getLocalAccountSyncSettings: getLocalAccountSyncSettingsMock,
  getPreferences: getPreferencesMock,
  importLocalAccountSyncOperations: importLocalAccountSyncOperationsMock,
  importOpml: importOpmlMock,
  setLocalAccountSyncSettings: setLocalAccountSyncSettingsMock,
  setPreference: setPreferenceMock,
}));

vi.mock("@/lib/platform/save-dialog", () => ({ showSaveDialog: showSaveDialogMock }));
```

(b) In `beforeEach` (lines 70-127): delete the `HTMLAnchorElement` stub, both `URL.createObjectURL` / `URL.revokeObjectURL` `Object.defineProperty` blocks, and the anchor `click` spy. Replace `exportOpmlMock.mockReset();` with:

```ts
    exportOpmlToFileMock.mockReset();
    exportOpmlToFileMock.mockResolvedValue(Result.succeed(null));
    showSaveDialogMock.mockReset();
    showSaveDialogMock.mockResolvedValue("/tmp/Local-feeds.opml");
```

(c) In `afterEach` (lines 129-145): delete both `Object.defineProperty(URL, ...)` restore blocks. Also delete the `originalCreateObjectUrl` / `originalRevokeObjectUrl` declarations at lines 66-67.

(d) Keep the `buildOpmlExportFilename` test (lines 147-151) unchanged. Replace the six Blob/anchor export tests (lines 153-187, 227-264, 266-297, 299-321, 323-351, 353-375, 377-398 — i.e. every test mentioning `createObjectURL`, `revokeObjectURL`, or `HTMLAnchorElement`) with:

```ts
  it("guards repeated OPML exports while the current export is in flight", async () => {
    const exportResult = createDeferred<ReturnType<typeof Result.succeed<null>>>();
    exportOpmlToFileMock.mockReturnValue(exportResult.promise);
    const queryClient = createTestQueryClient();
    const account = { ...sampleAccounts[0], name: "Local" };

    const { result } = renderHook(() =>
      useAccountDetailDangerZone({
        account,
        queryClient,
        t,
        onAccountDeleted: vi.fn(),
      }),
    );

    let firstExport: Promise<void> | undefined;
    let secondExport: Promise<void> | undefined;
    act(() => {
      firstExport = result.current.handleExportOpml();
      secondExport = result.current.handleExportOpml();
    });

    expect(result.current.exportingOpml).toBe(true);
    expect(showSaveDialogMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(exportOpmlToFileMock).toHaveBeenCalledTimes(1);
    });
    expect(exportOpmlToFileMock).toHaveBeenCalledWith("acc-1", "/tmp/Local-feeds.opml");

    exportResult.resolve(Result.succeed(null));
    await firstExport;
    await secondExport;

    await waitFor(() => {
      expect(result.current.exportingOpml).toBe(false);
    });
  });

  it("uses the account snapshot from export start for the suggested filename and command", async () => {
    const dialogResult = createDeferred<string | null>();
    showSaveDialogMock.mockReturnValue(dialogResult.promise);
    const firstAccount = { ...sampleAccounts[0], id: "acc-1", name: "Local Work" };
    const secondAccount = { ...sampleAccounts[0], id: "acc-2", name: "Local Personal" };

    const { result, rerender } = renderHook(
      ({ account }) =>
        useAccountDetailDangerZone({
          account,
          queryClient: createTestQueryClient(),
          t,
          onAccountDeleted: vi.fn(),
        }),
      { initialProps: { account: firstAccount } },
    );

    const exportOpmlPromise = result.current.handleExportOpml();
    rerender({ account: secondAccount });

    dialogResult.resolve("/tmp/Local Work-feeds.opml");
    await exportOpmlPromise;

    expect(showSaveDialogMock).toHaveBeenCalledWith({
      defaultPath: "Local Work-feeds.opml",
      filters: [{ name: "OPML", extensions: ["opml"] }],
    });
    expect(exportOpmlToFileMock).toHaveBeenCalledWith("acc-1", "/tmp/Local Work-feeds.opml");
  });

  it("treats a canceled save dialog as a silent no-op without invoking the export command", async () => {
    showSaveDialogMock.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useAccountDetailDangerZone({
        account: sampleAccounts[0],
        queryClient: createTestQueryClient(),
        t,
        onAccountDeleted: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleExportOpml();
    });

    expect(exportOpmlToFileMock).not.toHaveBeenCalled();
    expect(useUiStore.getState().toastMessage?.message).toBeUndefined();
    expect(result.current.exportingOpml).toBe(false);
  });

  it("skips the export write when the dialog resolves after unmount", async () => {
    const dialogResult = createDeferred<string | null>();
    showSaveDialogMock.mockReturnValue(dialogResult.promise);

    const { result, unmount } = renderHook(() =>
      useAccountDetailDangerZone({
        account: sampleAccounts[0],
        queryClient: createTestQueryClient(),
        t,
        onAccountDeleted: vi.fn(),
      }),
    );

    const exportOpmlPromise = result.current.handleExportOpml();
    unmount();

    dialogResult.resolve("/tmp/Local-feeds.opml");
    await exportOpmlPromise;

    expect(exportOpmlToFileMock).not.toHaveBeenCalled();
  });

  it("surfaces export write failures with the OPML export error toast", async () => {
    exportOpmlToFileMock.mockResolvedValue(Result.fail({ type: "UserVisible", message: "disk full" }));

    const { result } = renderHook(() =>
      useAccountDetailDangerZone({
        account: sampleAccounts[0],
        queryClient: createTestQueryClient(),
        t,
        onAccountDeleted: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleExportOpml();
    });

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage?.message).toBe("Failed to export OPML: disk full");
    });
    expect(result.current.exportingOpml).toBe(false);
  });

  it("shows the export error toast when the native save dialog is unavailable", async () => {
    showSaveDialogMock.mockRejectedValue(new Error("dialog unavailable"));

    const { result } = renderHook(() =>
      useAccountDetailDangerZone({
        account: sampleAccounts[0],
        queryClient: createTestQueryClient(),
        t,
        onAccountDeleted: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleExportOpml();
    });

    expect(exportOpmlToFileMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(useUiStore.getState().toastMessage?.message).toBe("Failed to export OPML: dialog unavailable");
    });
    expect(result.current.exportingOpml).toBe(false);
  });
```

Keep the OPML *import* tests (lines 189-225) and everything from the account-delete test (line 400) onward unchanged.

- [ ] **Step 2: Run the hook tests to verify the new ones fail**

Run: `pnpm exec vitest run src/__tests__/hooks/use-account-detail-danger-zone.node.test.tsx`
Expected: FAIL — hook still imports `exportOpml` (now `undefined` in the module mock) and never calls `showSaveDialog` / `exportOpmlToFile`.

- [ ] **Step 3: Rewrite the hook**

In `src/components/settings/hooks/account-detail/use-account-detail-danger-zone.ts`:

(a) Imports — replace `exportOpml` with `exportOpmlToFile` in the `@/api/tauri-commands` import (lines 6-14) and add the dialog import after the query-invalidation import block:

```ts
import {
  deleteAccount,
  exportLocalAccountSyncOperations,
  exportOpmlToFile,
  getLocalAccountSyncSettings,
  importLocalAccountSyncOperations,
  importOpml,
  setLocalAccountSyncSettings,
} from "@/api/tauri-commands";
```

```ts
import { showSaveDialog } from "@/lib/platform/save-dialog";
```

(b) Delete the objectURL machinery: the refs at lines 154-155 (`pendingExportUrlRef`, `pendingExportUrlTimerRef`), the `revokePendingExportUrl` callback (lines 177-187), and the account-switch revoke effect (lines 197-201). Simplify the mount effect (lines 189-195) to:

```ts
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
```

(c) Replace `handleExportOpml` (lines 270-314) with:

```ts
  const handleExportOpml = async () => {
    if (exportInFlightRef.current) {
      return;
    }

    const exportAccountSnapshot = {
      id: account.id,
      name: account.name,
    };
    exportInFlightRef.current = true;
    setExportingOpml(true);
    try {
      const path = await showSaveDialog({
        defaultPath: buildOpmlExportFilename(exportAccountSnapshot.name),
        filters: [{ name: "OPML", extensions: ["opml"] }],
      });
      if (path === null || !mountedRef.current) {
        return;
      }

      const exportResult = await exportOpmlToFile(exportAccountSnapshot.id, path);
      if (!mountedRef.current) {
        return;
      }

      Result.pipe(exportResult, Result.inspectError(showExportError));
    } catch (error) {
      if (mountedRef.current) {
        showExportError({ message: getErrorMessage(error) });
      }
    } finally {
      exportInFlightRef.current = false;
      if (mountedRef.current) {
        setExportingOpml(false);
      }
    }
  };
```

- [ ] **Step 4: Run the hook tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/hooks/use-account-detail-danger-zone.node.test.tsx`
Expected: PASS (all tests, including untouched import/delete/local-sync tests).

- [ ] **Step 5: Rewrite the account-detail integration export test**

In `src/__tests__/components/account-detail.test.tsx`:

(a) Near the top of the file (with the other `vi.mock` calls, e.g. before line 88), add:

```ts
const { showSaveDialogMock } = vi.hoisted(() => ({ showSaveDialogMock: vi.fn() }));
vi.mock("@/lib/platform/save-dialog", () => ({ showSaveDialog: showSaveDialogMock }));
```

(b) Replace the test `"revokes OPML export object URLs after download, before a rapid replacement, and on unmount"` (lines 1511-1562) with:

```ts
  it("exports OPML through the native save dialog and the export_opml_to_file command", async () => {
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    showSaveDialogMock.mockReset();
    showSaveDialogMock.mockResolvedValue("/tmp/FreshRSS-feeds.opml");

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });
      switch (cmd) {
        case "list_accounts":
          return [
            {
              id: "acc-1",
              kind: "FreshRss",
              name: "FreshRSS",
              username: "user",
              server_url: "https://freshrss.example.com",
              sync_interval_secs: 3600,
              sync_on_startup: true,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "export_opml_to_file":
          return null;
        default:
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });
    const exportButton = await screen.findByRole("button", {
      name: "Export OPML",
    });

    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(calls).toContainEqual(
        expect.objectContaining({
          cmd: "export_opml_to_file",
          args: expect.objectContaining({ accountId: "acc-1", path: "/tmp/FreshRSS-feeds.opml" }),
        }),
      );
    });
    expect(showSaveDialogMock).toHaveBeenCalledWith({
      defaultPath: "FreshRSS-feeds.opml",
      filters: [{ name: "OPML", extensions: ["opml"] }],
    });
  });

  it("does not invoke the export command when the OPML save dialog is canceled", async () => {
    const calls: Array<{ cmd: string }> = [];
    showSaveDialogMock.mockReset();
    showSaveDialogMock.mockResolvedValue(null);

    setupTauriMocks((cmd) => {
      calls.push({ cmd });
      switch (cmd) {
        case "list_accounts":
          return [
            {
              id: "acc-1",
              kind: "FreshRss",
              name: "FreshRSS",
              username: "user",
              server_url: "https://freshrss.example.com",
              sync_interval_secs: 3600,
              sync_on_startup: true,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        default:
          return undefined;
      }
    });

    render(<AccountDetail />, { wrapper: createWrapper() });
    const exportButton = await screen.findByRole("button", {
      name: "Export OPML",
    });

    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(showSaveDialogMock).toHaveBeenCalledTimes(1);
    });
    expect(calls.map(({ cmd }) => cmd)).not.toContain("export_opml_to_file");
  });
```

Note for the implementer: if the existing `setupTauriMocks` helper delivers args in a different shape than the raw invoke payload, mirror whatever the neighboring import test (`"imports the selected OPML file into the current account..."`, line 1564) asserts against — that test already pushes `{ cmd, args }` pairs the same way.

- [ ] **Step 6: Run the component tests to verify they pass**

Run: `pnpm exec vitest run src/__tests__/components/account-detail.test.tsx src/__tests__/components/account-danger-zone-view.test.tsx`
Expected: PASS (danger-zone view test passes without changes — it only asserts the `onExport` callback fires).

- [ ] **Step 7: Commit**

```bash
git add src/components/settings/hooks/account-detail/use-account-detail-danger-zone.ts src/__tests__/hooks/use-account-detail-danger-zone.node.test.tsx src/__tests__/components/account-detail.test.tsx
git commit -m "feat(settings): export OPML through native save dialog"
```

---

### Task 4: Remove the legacy `export_opml` string command end-to-end

### Files

- Modify: `src-tauri/src/commands/opml_commands.rs` (delete the `export_opml` command fn; keep `generate_export_opml_in_db`)
- Modify: `src-tauri/src/commands/mod.rs` (remove `| "export_opml"` arm entry and the `("export_opml", CommandDbLockPolicy::BlockingLock),` test row)
- Modify: `src-tauri/src/lib.rs:907` (remove `commands::opml_commands::export_opml,`)
- Modify: `src-tauri/permissions/reader-commands.toml:51` (remove `"export_opml",`)
- Modify: `src/__tests__/schemas/tauri-window-capability-contract.test.ts:103` (remove `"export_opml",` from reader-commands)
- Modify: `src/api/tauri-commands/sync.ts` (remove `exportOpml` wrapper and now-unused `exportOpmlArgs` / `StringResponseSchema` imports)
- Modify: `src/api/schemas/commands/integration.ts:58` (remove `exportOpmlArgs`)
- Modify: `src/api/schemas/commands/registry.ts` (remove `export_opml:` entry and `exportOpmlArgs` import)
- Modify: `src/api/schemas/index.ts:48` (remove `exportOpmlArgs,` re-export)
- Modify: `src/dev/mocks.ts:927-938` (remove the `case "export_opml":` block)
- Modify: `src/__tests__/api/tauri-commands.node.test.ts` (remove `exportOpml` import and the line-1609 blank-arg row)
- Modify: `src/__tests__/dev/dev-mocks-browser.node.test.ts` (remove `exportOpml` import and its line-452 assertion; keep the Task 2 `exportOpmlToFile` assertion)

### Interfaces

- Consumes: nothing new. This task only deletes the superseded surface added-around in Tasks 1-3.
- Produces: `export_opml` no longer exists anywhere as a command; `export_opml_to_file` is the only OPML export IPC surface.

- [ ] **Step 1: Delete the backend command and wiring**

In `src-tauri/src/commands/opml_commands.rs`, delete this function (added in Task 1 Step 3) entirely:

```rust
#[tauri::command]
pub fn export_opml(state: State<'_, AppState>, account_id: String) -> Result<String, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    generate_export_opml_in_db(&db, account_id)
}
```

In `src-tauri/src/commands/mod.rs`, change the arm back to a single new entry:

```rust
        | "toggle_article_star"
        | "export_opml_to_file"
        | "export_settings_profile"
        | "export_settings_profile_to_file"
```

and delete the test row `("export_opml", CommandDbLockPolicy::BlockingLock),` (keep the `export_opml_to_file` row).

In `src-tauri/src/lib.rs`, delete the line `commands::opml_commands::export_opml,` (keep `export_opml_to_file`).

In `src-tauri/permissions/reader-commands.toml`, delete the line `"export_opml",` (keep `"export_opml_to_file",`).

In `src/__tests__/schemas/tauri-window-capability-contract.test.ts`, delete `"export_opml",` from the reader-commands array (keep `"export_opml_to_file",`).

- [ ] **Step 2: Verify backend and capability contract**

Run: `cd /Users/t00114/src/github.com/jey3dayo/ultra-rss-reader/src-tauri && cargo test --lib opml_commands && cargo test --lib commands::tests::command_db_lock_policy_classifies_command_categories`
Expected: PASS.
Run: `pnpm exec vitest run src/__tests__/schemas/tauri-window-capability-contract.test.ts`
Expected: PASS. Note: `command_db_lock_policy` is `#[cfg(test)]`; if `cargo test` reports an unreachable-pattern or unused warning after removal, the arm edit above resolves it.

- [ ] **Step 3: Delete the frontend legacy surface**

`src/api/tauri-commands/sync.ts` — delete the `exportOpml` export and prune imports so the file's import block becomes:

```ts
import {
  exportOpmlToFileArgs,
  FeedDtoListSchema,
  importOpmlArgs,
  NullResponseSchema,
  SyncResultSchema,
  startupSyncArgs,
  syncAccountArgs,
  syncFeedArgs,
} from "@/api/schemas";
```

(`StringResponseSchema` and `exportOpmlArgs` were only used by `exportOpml` in this file.)

`src/api/schemas/commands/integration.ts` — delete `export const exportOpmlArgs = z.object({ accountId: nonBlankTrimmedIdSchema });`.

`src/api/schemas/commands/registry.ts` — delete `export_opml: exportOpmlArgs,` and remove `exportOpmlArgs` from the `./integration` import.

`src/api/schemas/index.ts` — delete the `exportOpmlArgs,` re-export line.

`src/dev/mocks.ts` — delete the whole `case "export_opml": ... return`<?xml ...`;` block (lines 927-938).

`src/__tests__/api/tauri-commands.node.test.ts` — delete `["accountId", "export_opml", () => exportOpml("   ")],` and the `exportOpml` import.

`src/__tests__/dev/dev-mocks-browser.node.test.ts` — delete the `exportOpml` assertion line (`StringResponseSchema.parse(Result.unwrap(await exportOpml("acc-freshrss")))...`) and the `exportOpml` import; if `StringResponseSchema` is now unused in that file, remove that import too.

- [ ] **Step 4: Verify no stale references remain**

Run: `grep -rn '"export_opml"' /Users/t00114/src/github.com/jey3dayo/ultra-rss-reader/src /Users/t00114/src/github.com/jey3dayo/ultra-rss-reader/src-tauri/src /Users/t00114/src/github.com/jey3dayo/ultra-rss-reader/src-tauri/permissions`
Expected: no matches. (The i18n label key `account.export_opml` in `src/locales/**` and `use-account-detail-view-props.tsx` uses a different string and must remain.)
Run: `grep -rn "exportOpmlArgs\|exportOpml\b" /Users/t00114/src/github.com/jey3dayo/ultra-rss-reader/src --include='*.ts' --include='*.tsx'`
Expected: only `exportOpmlToFile` / `exportOpmlToFileArgs` matches remain.

- [ ] **Step 5: Run typecheck and the affected test files**

Run: `pnpm exec tsc && pnpm exec vitest run src/__tests__/api/tauri-commands.node.test.ts src/__tests__/dev/dev-mocks-browser.node.test.ts src/__tests__/api/schema-barrel-public-api.test.ts src/__tests__/api/schemas.node.test.ts src/__tests__/dev/dev-mocks.node.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/opml_commands.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src-tauri/permissions/reader-commands.toml src/__tests__/schemas/tauri-window-capability-contract.test.ts src/api/tauri-commands/sync.ts src/api/schemas/commands/integration.ts src/api/schemas/commands/registry.ts src/api/schemas/index.ts src/dev/mocks.ts src/__tests__/api/tauri-commands.node.test.ts src/__tests__/dev/dev-mocks-browser.node.test.ts
git commit -m "refactor(opml): remove legacy export_opml string command"
```

---

### Task 5: Promote sleep/resume stance to Guarded + docs + TODO/CHANGELOG

### Files

- Modify: `src-tauri/src/commands/database_commands.rs:394` (stance) and `src-tauri/src/commands/database_commands.rs:759-762` (test expectation)
- Modify: `docs/feed-content-privacy.md:306` (stance table row) and frontmatter `timestamp` (line 8)
- Modify: `TODO.md` (delete the P2 OPML export migration entry under "Feed / Folder / Storage / Settings Data")
- Modify: `CHANGELOG.md` (one line under `[Unreleased]`)

### Interfaces

- Consumes: Tasks 1-4 complete (production code now satisfies `TempFileThenRename` + native dialog overwrite confirmation).
- Produces: `long_running_native_operation_contract(LongRunningNativeOperation::OpmlExport).sleep_resume_stance == SleepResumeStance::Guarded`; docs/TODO/CHANGELOG reflect completion.

- [ ] **Step 1: Update the contract test expectation first (failing test)**

In `src-tauri/src/commands/database_commands.rs`, test `long_running_native_operations_invalidate_partial_artifacts_after_interruption` (line 753), change the OpmlExport row (lines 759-762) to:

```rust
            (
                LongRunningNativeOperation::OpmlExport,
                SleepResumeStance::Guarded,
            ),
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/t00114/src/github.com/jey3dayo/ultra-rss-reader/src-tauri && cargo test --lib long_running_native_operations_invalidate_partial_artifacts_after_interruption`
Expected: FAIL — `assertion failed: left == right` with `Unsupported` vs `Guarded`.

- [ ] **Step 3: Promote the stance in the contract**

In `src-tauri/src/commands/database_commands.rs`, `long_running_native_operation_contract` (line 392-396), change:

```rust
    let sleep_resume_stance = match operation {
        LongRunningNativeOperation::UpdaterDownload => SleepResumeStance::Unsupported,
        LongRunningNativeOperation::OpmlExport => SleepResumeStance::Guarded,
        LongRunningNativeOperation::DatabaseBackup => SleepResumeStance::Guarded,
    };
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /Users/t00114/src/github.com/jey3dayo/ultra-rss-reader/src-tauri && cargo test --lib long_running_native_operations_invalidate_partial_artifacts_after_interruption`
Expected: PASS.

- [ ] **Step 5: Update docs, TODO, CHANGELOG**

`docs/feed-content-privacy.md` — replace the OPML export row of the "Sleep And Long-Running Native Operation Cancellation" table (line 306) with:

```markdown
| OPML export      | Guarded     | `export_opml_to_file` writes the artifact itself through a temp-file-then-rename atomic write with temp cleanup on failure, so a sleep- or crash-interrupted export can never become a finalized partial file and every retry starts fresh. The destination comes from a native save dialog with the OS overwrite confirmation.                        |
```

Also update the frontmatter `timestamp:` (line 8) to the current date, and re-align the table column padding if the docs lint requires it.

`TODO.md` — delete the entire P2 entry block under "### Feed / Folder / Storage / Settings Data" that begins `- priority: P2 / domain: db-recovery / work type: implementation` and describes "OPML export をブラウザ Blob ダウンロードから ... native save dialog + temp file + rename の atomic write へ移行する" (currently lines 56-63).

`CHANGELOG.md` — under `## [Unreleased]`, add a `### Changed` section after the existing `### Features` section:

```markdown
### Changed

- OPML エクスポートをブラウザダウンロードからネイティブ保存ダイアログに変更し、temp file + rename の atomic write で書き込むようにした。保存ダイアログのキャンセルは何も行わない。
```

- [ ] **Step 6: Run the full repository gate**

Run: `cd /Users/t00114/src/github.com/jey3dayo/ultra-rss-reader && mise run check`
Expected: PASS (Rust tests, frontend tests, typecheck, lint, docs checks).

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands/database_commands.rs docs/feed-content-privacy.md TODO.md CHANGELOG.md
git commit -m "docs(privacy): promote OPML export sleep/resume stance to guarded"
```

---

## Self-Review Notes

- Contract coverage: `TempFileThenRename` (Task 1 atomic helper + temp-cleanup tests), `ConfirmBeforeReplacingExistingFile` (OS save dialog, documented in Task 5 row), `NoOpSuccess` cancel (Task 3 hook `path === null` early return + silent-no-op tests at hook and integration level), `auto_appends_extension` (Task 1 `ensure_opml_extension` + case-insensitivity test), `RequireOpmlExtension` (Task 3 `filters: [{ name: "OPML", extensions: ["opml"] }]` asserted in tests), `filename_suggestion` (Task 3 `defaultPath: buildOpmlExportFilename(...)` asserted with account snapshot semantics), `exposes_raw_path_to_webview` (dialog path passed through the frontend to the command).
- Type consistency: command args are camelCase `{ accountId, path }` over IPC (Tauri converts to `account_id`/`path` for the Rust signature, same as `export_settings_profile_to_file`); the wrapper is `exportOpmlToFile(accountId: string, path: string)` everywhere (Tasks 2, 3, 4); Rust helpers `generate_export_opml_in_db` / `export_opml_to_file_in_db` / `opml_export_temp_path` are named identically in Task 1 code and tests.
- Green-per-commit strategy: Task 1 adds the new command alongside the old one (capability contract test updated in the same commit because it parses `lib.rs` and the permission TOML); Task 2 is additive on the frontend; Task 3 switches the only caller; Task 4 deletes the then-dead legacy surface on both sides; Task 5 promotes the stance only after the implementation exists.
