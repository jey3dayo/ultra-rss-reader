# File Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add file logging for release builds so users can attach logs to support requests.

**Architecture:** `tauri-plugin-log` (with `tracing` feature) replaces `tracing-subscriber` in release builds. Dev builds keep stdout via `tracing-subscriber`. A new `get_log_dir` command exposes the log directory to the frontend. The Data settings section gets an "Open log directory" button.

**Tech Stack:** Rust (tauri-plugin-log, log crate), TypeScript/React (settings UI), i18n (en/ja)

**Spec:** `docs/superpowers/specs/2026-03-30-file-logging-design.md`

---

## File Map

| File                                        | Action | Purpose                                                 |
| ------------------------------------------- | ------ | ------------------------------------------------------- |
| `src-tauri/Cargo.toml`                      | Modify | Add `tauri-plugin-log`, `log` dependencies              |
| `src-tauri/src/lib.rs`                      | Modify | Conditional tracing init, log cleanup, register command |
| `src-tauri/src/commands/mod.rs`             | Modify | Add `pub mod log_commands;`                             |
| `src-tauri/src/commands/log_commands.rs`    | Create | `get_log_dir` Tauri command                             |
| `src/api/tauri-commands.ts`                 | Modify | Add `getLogDir` wrapper                                 |
| `src/dev-mocks.ts`                          | Modify | Add mock for `get_log_dir`                              |
| `src/components/settings/data-settings.tsx` | Modify | Add "Open log directory" button                         |
| `src/locales/en/settings.json`              | Modify | Add i18n keys for log section                           |
| `src/locales/ja/settings.json`              | Modify | Add i18n keys for log section                           |
| `package.json`                              | Modify | Add `@tauri-apps/plugin-opener` dependency              |

---

### Task 1: Add Rust Dependencies

**Files:**

- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add `tauri-plugin-log` and `log` to Cargo.toml**

In `[dependencies]` section, add:

```toml
log = "0.4"
tauri-plugin-log = { version = "2", features = ["tracing"] }
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && rtk cargo check`
Expected: compiles without errors

- [ ] **Step 3: Commit**

```bash
rtk git add src-tauri/Cargo.toml src-tauri/Cargo.lock && rtk git commit -m "$(cat <<'EOF'
feat: add tauri-plugin-log and log dependencies
EOF
)"
```

---

### Task 2: Create `log_commands.rs`

**Files:**

- Create: `src-tauri/src/commands/log_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: Create `log_commands.rs`**

```rust
use tauri::Manager;

use crate::commands::dto::AppError;

#[tauri::command]
pub fn get_log_dir(app: tauri::AppHandle) -> Result<String, AppError> {
    let dir = app.path().app_log_dir().map_err(|e| AppError::UserVisible {
        message: format!("Failed to resolve log directory: {e}"),
    })?;
    Ok(dir.to_string_lossy().into_owned())
}
```

- [ ] **Step 2: Register module in `mod.rs`**

Add `pub mod log_commands;` to `src-tauri/src/commands/mod.rs` (alphabetical order, after `feed_commands`).

- [ ] **Step 3: Register command in `lib.rs` invoke_handler**

Add `commands::log_commands::get_log_dir,` to the `generate_handler!` macro in `src-tauri/src/lib.rs` (after `database_commands::vacuum_database`).

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && rtk cargo check`
Expected: compiles without errors

- [ ] **Step 5: Commit**

```bash
rtk git add src-tauri/src/commands/log_commands.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs && rtk git commit -m "$(cat <<'EOF'
feat: add get_log_dir Tauri command
EOF
)"
```

---

### Task 3: Conditional Tracing Initialization and Log Cleanup

**Files:**

- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Replace tracing init with conditional logic**

Replace the current tracing init block (lines 48-53):

```rust
tracing_subscriber::fmt()
    .with_env_filter(
        tracing_subscriber::EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("warn")),
    )
    .init();
```

With this conditional initialization using immutable rebinding (Rust idiomatic pattern):

```rust
#[cfg(debug_assertions)]
{
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("warn")),
        )
        .init();
}

let builder = tauri::Builder::default();

#[cfg(not(debug_assertions))]
let builder = builder.plugin(
    tauri_plugin_log::Builder::new()
        .target(tauri_plugin_log::Target::new(
            tauri_plugin_log::TargetKind::LogDir {
                file_name: Some("app".into()),
            },
        ))
        .max_file_size(5_000_000) // ~5 MB
        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
        .level(log::LevelFilter::Info)
        .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
        .build(),
);
```

Note: Uses immutable `let` rebinding (not `mut`) to avoid Clippy `unused_mut` warnings under `-D warnings`.

- [ ] **Step 2: Add log cleanup function**

Add this function before `run()` in `lib.rs`:

```rust
#[cfg(not(debug_assertions))]
fn cleanup_old_logs(log_dir: &std::path::Path, max_age_days: u64) {
    use std::time::{Duration, SystemTime};

    let cutoff = match SystemTime::now().checked_sub(Duration::from_secs(max_age_days * 86400)) {
        Some(t) => t,
        None => return,
    };
    let entries = match std::fs::read_dir(log_dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        if let Ok(meta) = entry.metadata() {
            if let Ok(modified) = meta.modified() {
                if modified < cutoff {
                    let _ = std::fs::remove_file(entry.path());
                }
            }
        }
    }
}
```

- [ ] **Step 3: Call cleanup in `setup()`**

Inside the `setup(|app| { ... })` closure, after the existing initialization code (after `service::sync_scheduler::start_sync_scheduler`), add:

```rust
#[cfg(not(debug_assertions))]
{
    if let Ok(log_dir) = app.path().app_log_dir() {
        cleanup_old_logs(&log_dir, 7);
    }
}
```

- [ ] **Step 4: Update the builder chain**

Change the existing `tauri::Builder::default()` chain to use the `builder` variable. The `.plugin(...)` calls, `.setup(...)`, `.invoke_handler(...)`, and `.run(...)` should all chain from `builder` instead of `tauri::Builder::default()`.

- [ ] **Step 5: Verify it compiles**

Run: `cd src-tauri && rtk cargo check`
Expected: compiles without errors

- [ ] **Step 6: Run existing tests**

Run: `cd src-tauri && rtk cargo test`
Expected: all tests pass (existing tests in lib.rs still work)

- [ ] **Step 7: Commit**

```bash
rtk git add src-tauri/src/lib.rs && rtk git commit -m "$(cat <<'EOF'
feat: conditional file logging for release builds

Dev builds use tracing-subscriber (stdout), release builds use
tauri-plugin-log (file output with 5MB rotation, 7-day retention).
EOF
)"
```

---

### Task 4: Frontend - Add `getLogDir` Command and Mock

**Files:**

- Modify: `src/api/tauri-commands.ts`
- Modify: `src/dev-mocks.ts`

- [ ] **Step 1: Add `getLogDir` to `tauri-commands.ts`**

Add after the `vacuumDatabase` export (database commands section):

```typescript
export const getLogDir = () =>
  safeInvoke("get_log_dir", { response: z.string() });
```

- [ ] **Step 2: Add mock for browser dev mode**

In `src/dev-mocks.ts`, add a case in the mock IPC switch statement (after `vacuum_database`):

```typescript
case "get_log_dir":
  return "/tmp/mock-logs";
```

Note: `revealItemInDir` from `@tauri-apps/plugin-opener` will throw in browser dev mode since it requires the Tauri runtime. The `try/catch` in the button handler (Task 7) gracefully handles this.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `rtk pnpm exec tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
rtk git add src/api/tauri-commands.ts src/dev-mocks.ts && rtk git commit -m "$(cat <<'EOF'
feat: add getLogDir IPC wrapper and dev mock
EOF
)"
```

---

### Task 5: Install `@tauri-apps/plugin-opener` npm Package

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install the package**

Run: `rtk pnpm add @tauri-apps/plugin-opener`

Note: The Rust side (`tauri-plugin-opener`) and Tauri capability (`opener:default`) are already configured. Only the npm package is missing for frontend use.

- [ ] **Step 2: Commit**

```bash
rtk git add package.json pnpm-lock.yaml && rtk git commit -m "$(cat <<'EOF'
feat: add @tauri-apps/plugin-opener for frontend directory opening
EOF
)"
```

---

### Task 6: Add i18n Keys

**Files:**

- Modify: `src/locales/en/settings.json`
- Modify: `src/locales/ja/settings.json`

- [ ] **Step 1: Add English keys**

In `src/locales/en/settings.json`, inside the `"data"` object, add after `"vacuum_failed"`:

```json
"logs": "Logs",
"open_log_dir": "Open Log Directory",
"open_log_dir_description": "View application log files for troubleshooting."
```

- [ ] **Step 2: Add Japanese keys**

In `src/locales/ja/settings.json`, inside the `"data"` object, add after `"vacuum_failed"`:

```json
"logs": "ログ",
"open_log_dir": "ログフォルダを開く",
"open_log_dir_description": "トラブルシューティング用のアプリケーションログファイルを確認します。"
```

- [ ] **Step 3: Commit**

```bash
rtk git add src/locales/en/settings.json src/locales/ja/settings.json && rtk git commit -m "$(cat <<'EOF'
feat: add i18n keys for log directory button
EOF
)"
```

---

### Task 7: Add "Open Log Directory" Button to Data Settings

**Files:**

- Modify: `src/components/settings/data-settings.tsx`

- [ ] **Step 1: Add imports**

Add to the existing imports in `data-settings.tsx`:

```typescript
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { getLogDir } from "@/api/tauri-commands";
```

- [ ] **Step 2: Add the log section**

Inside `DataSettings`, add an `openLogDir` handler and a new `<section>` after the optimization section:

```typescript
const openLogDir = async () => {
  Result.pipe(
    await getLogDir(),
    Result.inspect(async (dir) => {
      try {
        await revealItemInDir(dir);
      } catch (e) {
        console.error("Failed to open log directory:", e);
        showToast(t("data.open_log_dir_failed", { message: String(e) }));
      }
    }),
    Result.inspectError((e) => {
      console.error("Failed to get log directory:", e);
      showToast(t("data.open_log_dir_failed", { message: e.message }));
    }),
  );
};
```

Add the section JSX after the optimization `</section>`:

```tsx
<section className="mt-6">
  <SectionHeading>{t("data.logs")}</SectionHeading>
  <p className="mb-3 text-xs text-muted-foreground">
    {t("data.open_log_dir_description")}
  </p>
  <Button variant="outline" size="sm" onClick={openLogDir}>
    {t("data.open_log_dir")}
  </Button>
</section>
```

- [ ] **Step 3: Add the missing i18n error key**

In `src/locales/en/settings.json` `"data"` object, add:

```json
"open_log_dir_failed": "Failed to open log directory: {{message}}"
```

In `src/locales/ja/settings.json` `"data"` object, add:

```json
"open_log_dir_failed": "ログフォルダを開けませんでした: {{message}}"
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `rtk pnpm exec tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Verify lint passes**

Run: `rtk pnpm exec biome check src/components/settings/data-settings.tsx`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/settings/data-settings.tsx src/locales/en/settings.json src/locales/ja/settings.json && rtk git commit -m "$(cat <<'EOF'
feat: add open log directory button to data settings
EOF
)"
```

---

### Task 8: Full Quality Check

- [ ] **Step 1: Run format**

Run: `mise run format`
Expected: all files formatted

- [ ] **Step 2: Run lint**

Run: `mise run lint`
Expected: no errors (tsc + Biome + Clippy)

- [ ] **Step 3: Run tests**

Run: `mise run test`
Expected: all tests pass (Vitest + cargo test)

- [ ] **Step 4: Fix any issues found**

If any step fails, fix the issue and re-run.

- [ ] **Step 5: Commit any format fixes**

If formatter changed anything:

```bash
rtk git add -u && rtk git commit -m "$(cat <<'EOF'
style: apply formatter
EOF
)"
```
