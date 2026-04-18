# Ultra RSS Reader

Desktop RSS feed reader built with Tauri 2 (Rust) + React 19 (TypeScript) + SQLite.

## Overview

Ultra RSS Reader is a desktop-first RSS reader with a Rust/Tauri runtime and a React frontend.
It supports local feeds and FreshRSS, stores data in SQLite, and keeps credentials in the OS keyring.

## Features

- Multiple providers — Local RSS/Atom feeds and FreshRSS (Google Reader API)
- Reader and Web Preview — Three-pane reading flow plus embedded publisher pages with dedicated browser controls
- Full-text search — SQLite FTS5 across all articles
- Sync — Background periodic sync, sync-on-wake, manual trigger, and bidirectional pending mutations (read status, stars)
- Folder hierarchy — Organize feeds into nested folders
- Organization workflows — Command palette feed landing, subscriptions index workspace, Feed Cleanup review queue, tags, and mute keywords
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

## Subscriptions Index

- Open the subscriptions index workspace from the sidebar management area
- Use it when you want to manage subscription structure separately from the cleanup queue
- For focused UI work, use `mise run app:dev:subscriptions-index`

## Feed Cleanup

- Open `Feed Cleanup` from the sidebar management area
- Review subscriptions that have not updated for a long time
- Inspect why a feed is a candidate before deleting it
- Use `Keep` or `Later` to clear the queue without unsubscribing immediately
- For focused UI work, use `mise run app:dev:feed-cleanup` or `mise run app:dev:browser:feed-cleanup`

## Web Preview

- Open the article title or browser actions to load the publisher page inside the app
- Use Web Preview when you need the original page layout without leaving the reading workflow
- For focused UI work, use `mise run app:dev:web-preview` with `VITE_DEV_WEB_URL`

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
mise run app:dev
```

`mise run app:dev` is the default development entry point. It wraps the Tauri dev configuration used by this repository.
Under the hood, Tauri starts the Vite dev server with `beforeDevCommand` and loads the frontend from `devUrl`
(`http://localhost:1420`).
By default, `mise run app:dev` uses `DEV_CREDENTIALS=1`, so credentials go to the dev file store instead of the native OS keyring.
Use `mise run app:dev:native-keyring` when you need to verify Keychain or Credential Manager behavior in development.

## Development Modes

- Live desktop development: `mise run app:dev`
  Recommended default. Launches the Tauri shell with the repository dev config and hot reload, using file-based dev credentials.
- Native keyring desktop development: `mise run app:dev:native-keyring`
  Launches the same Tauri dev flow without `DEV_CREDENTIALS`, so credentials use the OS keyring backend.
- macOS signed dev run: `mise run app:dev:signed`
  Builds, codesigns with `UltraRSSReader-Dev`, and runs the dev binary to suppress Keychain access dialogs. macOS only and one-shot (no file watching). Initial setup is documented in [.claude/rules/macos-dev-codesign.md](.claude/rules/macos-dev-codesign.md).
- Subscriptions index development: `mise run app:dev:subscriptions-index`
  Starts the native app and jumps directly into the subscriptions index workspace.
- Web Preview development: `mise run app:dev:web-preview`
  Starts the native app and opens `VITE_DEV_WEB_URL` directly in Web Preview. Optional sizing comes from `VITE_DEV_WINDOW_WIDTH` and `VITE_DEV_WINDOW_HEIGHT`.
- Web-only frontend debugging: `mise run app:dev:browser`
  Starts the browser-mode dev server on `http://127.0.0.1:4173/` without the Tauri shell.
- Preview the production frontend build: `pnpm build && pnpm preview`
  Serves the current `dist/` output. Rebuild before previewing new changes.

`pnpm preview` is intentionally different from `mise run app:dev`:

- `mise run app:dev` is for day-to-day UI development.
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
mise run app:dev      # Launch the native app in repository dev mode
mise run app:dev:native-keyring     # Launch the native app in dev mode with the OS keyring backend
mise run app:dev:signed              # macOS-only: build, codesign, and run the dev binary (no Keychain dialog)
mise run app:dev:subscriptions-index # Launch the native app directly into the subscriptions index workspace
mise run app:dev:web-preview         # Launch the native app directly into Web Preview for VITE_DEV_WEB_URL
mise run app:dev:browser         # Launch browser-mode UI testing
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

| Area                             | Default CI / local gate                        | Additional verification                              |
| -------------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| TypeScript / Rust regressions    | `mise run check`                               | None                                                 |
| Browser-mode UI flow             | `mise run test:e2e`                            | Optional manual pass in `mise run app:dev:browser`   |
| FreshRSS real-server integration | Not part of default CI                         | `mise run test:live` with real credentials           |
| Native keyring integration       | Unit / integration tests around app logic only | Manual verification on each target OS                |
| Updater download / install       | Config and command-level checks only           | Manual verification on packaged builds per target OS |

`mise run ci` intentionally covers format, lint, repository tests, and frontend build. It does not run live-service tests or native packaged-app checks, so release validation still needs the checklist in [docs/release-manual-verification.md](docs/release-manual-verification.md).

## Troubleshooting

- Start from [docs/README.md](docs/README.md) if you are not sure which operational document you need.
- Use [docs/incident-runbook.md](docs/incident-runbook.md) for the shortest path to logs, backups, and failure-specific triage steps.
- If the app looks stale during development, make sure you are using `mise run app:dev` or `mise run app:dev:browser`, not `pnpm preview`.
- If `pnpm preview` does not reflect a recent frontend change, run `pnpm build` first so `dist/` is regenerated.

## Documentation Map

- [docs/README.md](docs/README.md) — index for operational docs and historical implementation records
- [docs/superpowers/README.md](docs/superpowers/README.md) — reading guide for dated design and implementation records
- [docs/release-manual-verification.md](docs/release-manual-verification.md) — packaged-build and live-service release checklist
- [docs/incident-runbook.md](docs/incident-runbook.md) — failure triage for logs, backups, updater, keyring, and sync issues
- [docs/feed-content-privacy.md](docs/feed-content-privacy.md) — privacy and CSP policy for remote article content
- [.claude/rules/README.md](.claude/rules/README.md) — project-specific engineering rules by topic

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

| Path                              | Responsibility                                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `api/tauri-commands.ts`           | All `invoke()` calls wrapped in `safeInvoke` returning `Result<T, AppError>`                                      |
| `stores/`                         | Zustand stores — ui-store (selection, layout), preferences-store (async SQLite persistence)                       |
| `hooks/`                          | React Query hooks (articles, feeds, accounts, folders) + UI hooks                                                 |
| `components/reader/`              | Three-pane layout: sidebar, article-list, article-view, browser-view, command palette                             |
| `components/settings/`            | Per-category settings panels (general, reading, appearance, mute, tags, shortcuts, actions, data, dev-only debug) |
| `components/accounts/`            | Account setup wizard and credential flows                                                                         |
| `components/feed-cleanup/`        | Feed Cleanup review queue workspace                                                                               |
| `components/subscriptions-index/` | Subscriptions index management workspace                                                                          |
| `components/shared/`              | Cross-feature primitives reused by reader, settings, and workspaces                                               |
| `components/ui/`                  | shadcn/ui + Base UI headless primitives wrapped with Tailwind                                                     |
| `dev/scenarios/`                  | `VITE_DEV_INTENT` scenarios for direct dev entry points and command palette dev commands                          |
| `styles/global.css`               | Tailwind CSS v4 with OKLch design tokens                                                                          |

## Coding Conventions

**TypeScript** — Biome: double quotes, semicolons, 2-space indent, 120-char line width. Strict mode enabled. Functional components only. All Tauri calls go through `safeInvoke`.

**Rust** — `cargo fmt` + Clippy with `-D warnings` (zero warnings policy). `std::sync::Mutex` locks must never be held across `.await` points.

## Security

- HTML sanitization happens in Rust (ammonia) before content reaches the frontend. The frontend renders `content_sanitized` fields only.
- The current CSP policy is compatibility-first for feed content: scripts stay locked to `'self'`, while remote `http:` / `https:` images and frames are allowed so sanitized articles and the in-app browser can load external pages.
- Feed content privacy expectations and future tightening rules are documented in [docs/feed-content-privacy.md](docs/feed-content-privacy.md).
- Tightening CSP further requires checking article rendering, thumbnail loading, and embedded browser behavior across the supported providers.
- Credentials (FreshRSS passwords, tokens) are stored in the OS keyring, never in SQLite.
- Setting `DEV_CREDENTIALS=1` switches development builds to a file-based credential store; production builds continue to use the OS keyring.
- `.env` files are encrypted with dotenvx. Never commit `.env` or plaintext secrets.

## Release

Tagging `v*` triggers a GitHub Actions release build for macOS Apple Silicon and Windows, then creates a draft GitHub Release. Version is kept in sync across `tauri.conf.json`, `Cargo.toml`, and `package.json`.

## License

MIT
