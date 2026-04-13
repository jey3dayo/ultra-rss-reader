# Ultra RSS Reader

Desktop RSS feed reader built with Tauri 2 (Rust) + React 19 (TypeScript) + SQLite.

## Overview

Ultra RSS Reader is a desktop-first RSS reader with a Rust/Tauri runtime and a React frontend.
It supports local feeds and FreshRSS, stores data in SQLite, and keeps credentials in the OS keyring.

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

## Command Palette Feed Landing

- Press `Cmd+K` / `Ctrl+K` to open the command palette
- Type `@` to search subscriptions
- Press `Enter` on a feed to jump to its first visible article
- Feeds in `3-Pane` mode land in the reader
- Feeds in `Widescreen` mode land in browser view
- If a feed has no visible unread articles, the app stops at the feed list instead of forcing an article open

## Feed Cleanup

- Open `Feed Cleanup` from the sidebar management area
- Review subscriptions that have not updated for a long time
- Inspect why a feed is a candidate before deleting it
- Use `Keep` or `Later` to clear the queue without unsubscribing immediately
- For focused UI work, use `mise run app:dev:feed-cleanup` or `mise run app:dev:browser:feed-cleanup`

## Tech Stack

| Layer                | Technology                                            |
| -------------------- | ----------------------------------------------------- |
| Desktop runtime      | Tauri 2 (Rust)                                        |
| Frontend build       | Vite 8 + React 19 + TypeScript 6                      |
| State management     | Zustand (UI) + TanStack React Query (data)            |
| Styling              | Tailwind CSS v4 + Base UI headless primitives         |
| i18n                 | i18next + react-i18next                               |
| Database             | SQLite via rusqlite (embedded, bundled)               |
| Async runtime        | Tokio                                                 |
| HTTP client          | Reqwest                                               |
| HTML sanitization    | Ammonia (server-side only)                            |
| Error handling       | thiserror (Rust) / `@praha/byethrow` Result type (TS) |
| Linting / formatting | Biome + Clippy + cargo fmt + taplo                    |
| Testing              | Vitest + cargo test + Playwright (E2E)                |
| Component dev        | Storybook 10                                          |
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

# Run the desktop app in development mode
pnpm tauri dev
```

`pnpm tauri dev` is the default development entry point. In this project, Tauri starts the Vite dev server with
`beforeDevCommand` and loads the frontend from `devUrl` (`http://localhost:1420`).

## Development Modes

| Goal                                  | Command                      | Notes                                                                                                 |
| ------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Live desktop development              | `pnpm tauri dev`             | Recommended default. Launches the Tauri shell and connects it to the Vite dev server with hot reload. |
| Web-only frontend debugging           | `pnpm dev`                   | Starts the Vite dev server on `http://localhost:1420` without the Tauri shell.                        |
| Preview the production frontend build | `pnpm build && pnpm preview` | Serves the current `dist/` output. Rebuild before previewing new changes.                             |

`pnpm preview` is intentionally different from `pnpm tauri dev`:

- `pnpm tauri dev` is for day-to-day UI development.
- `pnpm preview` serves the built `dist/` directory and will show stale output until `pnpm build` is run again.
- Use `pnpm preview` to sanity-check the production bundle, not as a replacement for the normal dev workflow.

## Development Commands

```bash
mise run check        # format + lint + test  (local dev loop)
mise run ci           # format + lint + test + build  (full CI gate)
mise run format       # Biome + cargo fmt + taplo
mise run lint         # tsc --noEmit + Biome + Clippy (-D warnings)
mise run test         # Vitest + cargo test
mise run test:e2e     # Playwright browser-mode E2E tests
mise run test:all     # Rust + Vitest + Playwright
mise run test:live    # FreshRSS integration tests (requires .env credentials)
mise run app:dev:feed-cleanup         # Launch the native app directly into Feed Cleanup
mise run app:dev:browser:feed-cleanup # Launch browser-mode UI directly into Feed Cleanup
```

Always run `mise run check` before committing.

### Test Scope

- `mise run test` is the default fast verification loop for repository tests (Rust + Vitest).
- `mise run test:e2e` runs Playwright against the browser-mode UI flow.
- `mise run test:live` is opt-in and requires real FreshRSS credentials from `.env`.
- Features that depend on OS services such as updater installation and native keyring behavior still need platform-specific manual verification. Follow [docs/release-manual-verification.md](docs/release-manual-verification.md) before tagging a release or sharing a packaged build.

### Verification Matrix

| Area | Default CI / local gate | Additional verification |
| ---- | ------------------------ | ----------------------- |
| TypeScript / Rust regressions | `mise run check` | None |
| Browser-mode UI flow | `mise run test:e2e` | Optional manual pass in `mise run app:dev:browser` |
| FreshRSS real-server integration | Not part of default CI | `mise run test:live` with real credentials |
| Native keyring integration | Unit / integration tests around app logic only | Manual verification on each target OS |
| Updater download / install | Config and command-level checks only | Manual verification on packaged builds per target OS |

`mise run ci` intentionally covers format, lint, repository tests, and frontend build. It does not run live-service tests or native packaged-app checks, so release validation still needs the checklist in [docs/release-manual-verification.md](docs/release-manual-verification.md).

## Troubleshooting

- Use [docs/incident-runbook.md](docs/incident-runbook.md) for the shortest path to logs, backups, and failure-specific triage steps.
- If the app looks stale during development, make sure you are using `pnpm tauri dev` or `pnpm dev`, not `pnpm preview`.
- If `pnpm preview` does not reflect a recent frontend change, run `pnpm build` first so `dist/` is regenerated.

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

### Sync & Concurrency

| Mechanism                  | Location                     | Purpose                                                           |
| -------------------------- | ---------------------------- | ----------------------------------------------------------------- |
| `AtomicBool` + `SyncGuard` | `commands/feed_commands.rs`  | Prevents overlapping sync runs (scheduler vs manual trigger)      |
| WAL journal mode           | `infra/db/connection.rs`     | Allows concurrent reads during writes                             |
| `busy_timeout = 5000`      | `infra/db/connection.rs`     | Retries on lock contention for up to 5 seconds                    |
| Reader/writer split        | `DbManager`                  | Dedicated connections for reads and writes                        |
| Scoped `Mutex` locks       | All command handlers         | Locks released before `.await` points (see `rust-async-mutex.md`) |
| Pending mutations dedup    | `sqlite_pending_mutation.rs` | Latest mutation wins per `(account_id, remote_entry_id)`          |

#### Current Sync Consistency Rules

- Remote-state accounts push queued `pending_mutations` before pulling folders, subscriptions, entries, and remote state.
- Pending mutations are deleted only after `push_mutations()` succeeds; if the push fails, they remain queued for the next sync attempt.
- When remote state is applied, entries that still have pending local mutations are excluded from overwrite so local intent wins until the queue is drained.
- Unread counts are recalculated after the sync flow completes.
- The current contract treats mutation push as a batch operation. Fine-grained recovery for partial remote success is not implemented yet.

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
- The current CSP policy is compatibility-first for feed content: scripts stay locked to `'self'`, while remote `http:` / `https:` images and frames are allowed so sanitized articles and the in-app browser can load external pages.
- Tightening CSP further requires checking article rendering, thumbnail loading, and embedded browser behavior across the supported providers.
- Credentials (FreshRSS passwords, tokens) are stored in the OS keyring, never in SQLite.
- Setting `DEV_CREDENTIALS=1` switches development builds to a file-based credential store; production builds continue to use the OS keyring.
- `.env` files are encrypted with dotenvx. Never commit `.env` or plaintext secrets.

## Release

Tagging `v*` triggers a GitHub Actions release build for macOS Apple Silicon and Windows, then creates a draft GitHub Release. Version is kept in sync across `tauri.conf.json`, `Cargo.toml`, and `package.json`.

## License

MIT
