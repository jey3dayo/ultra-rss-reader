# Ultra RSS Reader

Desktop RSS feed reader built with Tauri 2 (Rust) + React 19 (TypeScript) + SQLite.

## Features

- Multiple providers — Local RSS/Atom feeds and FreshRSS (Google Reader API)
- Three-pane layout — Sidebar, article list, article view with in-app reader and external browser
- Full-text search — SQLite FTS5 across all articles
- Sync — Background periodic sync, sync-on-wake, manual trigger, and bidirectional pending mutations (read status, stars)
- Folder hierarchy — Organize feeds into nested folders
- OPML — Import and export feed lists
- Bionic reading — Bold-emphasis rendering for faster reading
- Keyboard shortcuts — `m` read/unread, `s` star, `v` in-app view, `b` browser, `a` mark all read, `/` search
- Theming — Light/dark with system detection, OKLch color tokens
- Secure credentials — OS keyring (Keychain / Credential Manager / Secret Service), never SQLite

## Tech Stack

| Layer                | Technology                                            |
| -------------------- | ----------------------------------------------------- |
| Desktop runtime      | Tauri 2 (Rust)                                        |
| Frontend build       | Vite + React 19 + TypeScript                          |
| State management     | Zustand (UI) + TanStack React Query (data)            |
| Styling              | Tailwind CSS v4 + Base UI headless primitives         |
| Database             | SQLite via rusqlite (embedded, bundled)               |
| Async runtime        | Tokio                                                 |
| HTTP client          | Reqwest                                               |
| HTML sanitization    | Ammonia (server-side only)                            |
| Error handling       | thiserror (Rust) / `@praha/byethrow` Result type (TS) |
| Linting / formatting | Biome + Clippy + cargo fmt + taplo                    |
| Testing              | Vitest + cargo test + Playwright (E2E)                |
| Package manager      | pnpm (managed via mise)                               |

## Prerequisites

- [mise](https://mise.jdx.dev/) — task runner and tool version manager
- Node.js 24+ and pnpm (installed automatically via mise)
- Rust stable toolchain
- Platform-specific Tauri prerequisites: [tauri.app/v2/guides/prerequisites](https://tauri.app/v2/guides/prerequisites)

## Getting Started

```bash
# Install tool versions and dependencies
mise install
pnpm install

# Run in development mode (hot reload)
pnpm tauri dev
```

## Development Commands

```bash
mise run check        # format + lint + test  (local dev loop)
mise run ci           # format + lint + test + build  (full CI gate)
mise run format       # Biome + cargo fmt + taplo
mise run lint         # tsc --noEmit + Biome + Clippy (-D warnings)
mise run test         # Vitest + cargo test
mise run test:live    # FreshRSS integration tests (requires .env credentials)
```

Always run `mise run check` before committing.

## Architecture

### Rust Backend (`src-tauri/src/`)

Strict layered architecture — dependencies only flow inward:

```text
Commands (IPC boundary)
    └── Service (orchestration)
          └── Repository traits
                └── Domain (core types, no external deps)
                      └── Infra (SQLite, HTTP, providers)
```

| Module            | Responsibility                                                            |
| ----------------- | ------------------------------------------------------------------------- |
| `domain/`         | Core types (Account, Feed, Article, Folder), DomainError, provider traits |
| `repository/`     | Data access trait definitions                                             |
| `infra/db/`       | SQLite implementations, migrations, DbManager                             |
| `infra/provider/` | FeedProvider implementations (local RSS, FreshRSS GReader)                |
| `service/`        | sync_service, sync_flow, event_bus, housekeeping, sync_scheduler          |
| `commands/`       | Tauri IPC handlers, DTOs, AppState, AppError                              |

Error mapping: `DomainError` → `AppError` at the command boundary (`Network` → `Retryable`, others → `UserVisible`).

### TypeScript Frontend (`src/`)

| Path                    | Responsibility                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `api/tauri-commands.ts` | All `invoke()` calls wrapped in `safeInvoke` returning `Result<T, AppError>`                |
| `stores/`               | Zustand stores — ui-store (selection, layout), preferences-store (async SQLite persistence) |
| `hooks/`                | React Query hooks (articles, feeds, accounts, folders) + UI hooks                           |
| `components/reader/`    | Three-pane layout: sidebar, article-list, article-view, browser-view                        |
| `components/settings/`  | Per-category settings panels (7 tabs)                                                       |
| `components/ui/`        | Base UI headless primitives wrapped with Tailwind                                           |
| `styles/global.css`     | Tailwind CSS v4 with OKLch design tokens                                                    |

## Coding Conventions

**TypeScript** — Biome: double quotes, semicolons, 2-space indent, 120-char line width. Strict mode enabled. Functional components only. All Tauri calls go through `safeInvoke`.

**Rust** — `cargo fmt` + Clippy with `-D warnings` (zero warnings policy). `std::sync::Mutex` locks must never be held across `.await` points.

## Security

- HTML sanitization happens in Rust (ammonia) before content reaches the frontend. The frontend renders `content_sanitized` fields only.
- Credentials (FreshRSS passwords, tokens) are stored in the OS keyring, never in SQLite.
- `.env` files are encrypted with dotenvx. Never commit `.env` or plaintext secrets.

## Release

Tagging `v*` triggers a GitHub Actions matrix build (macOS arm64/x86_64, Windows) and creates a draft GitHub Release. Version is kept in sync across `tauri.conf.json`, `Cargo.toml`, and `package.json`.

## License

MIT
