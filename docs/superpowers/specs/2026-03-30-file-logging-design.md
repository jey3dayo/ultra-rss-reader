# File Logging Design

## Summary

リリースビルドでファイルログ出力を追加し、ユーザーがサポート依頼時にログを添付できるようにする。
開発ビルドでは従来通り stdout のみ。

## Decisions

| Item           | Decision                                                                            |
| -------------- | ----------------------------------------------------------------------------------- |
| Plugin         | `tauri-plugin-log` v2 with `tracing` feature                                        |
| Target builds  | Release only (`!cfg(debug_assertions)`)                                             |
| Dev builds     | stdout only (no change)                                                             |
| Rotation       | Size-based, `max_file_size = 5_000_000` bytes (~5 MB), `KeepAll`                    |
| Retention      | 7 days, cleanup on app startup (release only)                                       |
| Log directory  | `tauri_plugin_log::TargetKind::LogDir` (macOS: `~/Library/Logs/{bundleIdentifier}`) |
| Release stdout | Disabled (file only)                                                                |
| Default level  | Release: `info` (hardcoded), Dev: `warn` (overridable via `RUST_LOG`)               |
| UI             | "Open log directory" button in settings (all builds, section: Data)                 |

## Architecture

### Rust Side

#### Dependencies (`Cargo.toml`)

```toml
tauri-plugin-log = { version = "2", features = ["tracing"] }
log = "0.4"
# tracing-subscriber is RETAINED for dev builds
```

#### Initialization (`lib.rs`)

```rust
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(debug_assertions)]
    let builder = {
        // Dev: stdout only via tracing-subscriber (existing behavior)
        tracing_subscriber::fmt()
            .with_env_filter(
                tracing_subscriber::EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("warn")),
            )
            .init();
        builder
    };

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

    builder
        .plugin(tauri_plugin_clipboard_manager::init())
        // ... rest of plugins
        .setup(|app| {
            // ... existing DB init, menu, state management ...

            // Clean up old log files (release only)
            #[cfg(not(debug_assertions))]
            {
                if let Ok(log_dir) = app.path().app_log_dir() {
                    cleanup_old_logs(&log_dir, 7);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ... existing commands ...
            commands::log_commands::get_log_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### Log Cleanup (startup, release only)

```rust
#[cfg(not(debug_assertions))]
fn cleanup_old_logs(log_dir: &Path, max_age_days: u64) {
    let cutoff = SystemTime::now() - Duration::from_secs(max_age_days * 86400);
    if let Ok(entries) = std::fs::read_dir(log_dir) {
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
}
```

#### New Command: `commands/log_commands.rs`

```rust
#[tauri::command]
pub fn get_log_dir(app: tauri::AppHandle) -> Result<String, AppError> {
    let dir = app.path().app_log_dir().map_err(|e| AppError::UserVisible {
        message: format!("Failed to resolve log directory: {e}"),
    })?;
    Ok(dir.to_string_lossy().into_owned())
}
```

Register in `lib.rs` `invoke_handler` as `commands::log_commands::get_log_dir`.

### Frontend Side

#### `tauri-commands.ts`

```typescript
export const getLogDir = () => safeInvoke<string>("get_log_dir");
```

#### Settings UI (General section)

Add an "Open log directory" button to the Data section of the settings screen (alongside Database info and Vacuum).
Displayed in all builds (dev may show an empty directory, which is acceptable).
Uses `@tauri-apps/plugin-opener` (already a dependency).

```typescript
import { revealItemInDir } from "@tauri-apps/plugin-opener";

const logDir = await getLogDir();
await revealItemInDir(logDir);
```

## Files Changed

| File                                     | Change                                               |
| ---------------------------------------- | ---------------------------------------------------- |
| `src-tauri/Cargo.toml`                   | Add `tauri-plugin-log` (with tracing feature), `log` |
| `src-tauri/src/lib.rs`                   | Conditional tracing init, log cleanup, register cmd  |
| `src-tauri/src/commands/log_commands.rs` | New file: `get_log_dir` command                      |
| `src-tauri/src/commands/mod.rs`          | Add `pub mod log_commands;`                          |
| `src/api/tauri-commands.ts`              | Add `getLogDir` wrapper                              |
| `src/components/` (settings)             | Add "Open log directory" button in General section   |

Note: `tauri-plugin-log` does not require permission entries in `tauri.conf.json`.

## Out of Scope

- JS-side log integration (`@tauri-apps/plugin-log` JS API)
- Webview target for in-app log viewer
- Custom log format
- Log level configuration in settings UI
- `RUST_LOG` override for release builds
