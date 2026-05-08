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
- Organization workflows — Command palette feed landing, subscriptions index workspace with subscription review, tags, and mute keywords
- OPML — Import and export feed lists
- Bionic reading — Bold-emphasis rendering for faster reading
- Keyboard shortcuts — `m` read/unread, `s` star, `v` in-app view, `b` browser, `a` mark all read, `/` search
- Theming — Light/dark with system detection, OKLch color tokens
- Japanese localization — Reader, settings, sidebar, and subscription-management copy tuned for concise in-app Japanese
- Secure credentials — OS keyring (Keychain / Credential Manager / Secret Service), never SQLite

## Start Here

If you are new to the repository, use this order:

1. Read this `README.md` for product, architecture, development modes, and verification scope.
2. Run `mise install` and `pnpm install`.
3. Start the app with `mise run app:dev`.
4. Use `mise run check` as the default local verification gate.
5. Follow [docs/release-manual-verification.md](docs/release-manual-verification.md) before any release or packaged-build handoff.

## Quick Command Reference

```bash
mise run app:dev      # default native development
mise run app:dev:browser  # browser-only UI debugging
mise run check        # format + lint + test
mise run ci           # CI-equivalent local gate
mise run test:e2e     # Playwright browser-mode E2E tests
mise run test:live    # FreshRSS live integration tests
```

Use the detailed command table below when you need a specialized workflow such as native keyring validation, signed macOS runs, or focused dev entry points.

## Command Palette Feed Landing

- Press `Cmd+K` / `Ctrl+K` to open the command palette
- Type `@` to search subscriptions
- Press `Enter` on a feed to jump to its first visible article
- Feeds in `3-Pane` mode land in the reader
- Feeds in `Widescreen` mode land in browser view
- If a feed has no visible unread articles, the app stops at the feed list instead of forcing an article open

## Subscriptions Index

- Open the subscriptions index workspace from the sidebar management area
- Use it when you want to manage subscription structure and review flagged subscriptions
- Use the review flow to inspect why a feed is flagged before deleting it
- Use `Keep` or `Later` to clear review candidates without unsubscribing immediately
- For focused UI work, use `mise run app:dev:subscriptions-index`

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

## Localization

Japanese locale files live under `src/locales/ja/` and are treated as product UI, not mechanical translation.
Keep labels short enough for dense controls, prefer natural Japanese over literal English, and avoid repeating context that is already provided by the surrounding section. When a visible label changes, update tests that intentionally assert that copy.

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

### Development Mode Comparison

Use this table when you need to decide whether you are optimizing for iteration speed, credential realism, or macOS-native behavior.

| Mode | Main use | Data environment | Database / app data | Credential backend | Signing | Watch / reload |
| --- | --- | --- | --- | --- | --- | --- |
| `mise run app:dev` | Default day-to-day development | Dev-like credentials, shared local article/account DB | Same native app data DB used by the dev Tauri app | Dev file credentials (`DEV_CREDENTIALS=1`) | No | Yes |
| `mise run app:dev:native-keyring` | Verify real account access against the OS keyring without leaving the normal dev loop | Production-like credentials, shared local article/account DB | Same native app data DB used by the dev Tauri app | OS keyring | No | Yes |
| `mise run app:dev:signed` | macOS-only, more production-like validation for Keychain and signed-app behavior | Most production-like dev mode for credentials and macOS runtime behavior | Same native app data DB used by the dev Tauri app | OS keyring | Yes (`UltraRSSReader-Dev`) | No, one-shot run |

Practical guidance:

- `app:dev`, `app:dev:native-keyring`, and `app:dev:signed` usually point at the same local app database. The biggest environment difference is which credential store they can read from.
- `app:dev` can look like a different environment when an account exists in SQLite but its password/token only exists in the OS keyring. In that case the account row is shared, but authentication behavior is not.
- `app:dev:signed` is closer to packaged macOS behavior than `app:dev`, but it is still a debug build and not a substitute for packaged-app verification.
- When you want to inspect production-like data and authentication behavior, prefer `app:dev:native-keyring` first. Reach for `app:dev:signed` when macOS signing or Keychain dialog behavior itself matters.

`pnpm preview` is intentionally different from `mise run app:dev`:

- `mise run app:dev` is for day-to-day UI development.
- `pnpm preview` serves the built `dist/` directory and will show stale output until `pnpm build` is run again.
- Use `pnpm preview` to sanity-check the production bundle, not as a replacement for the normal dev workflow.

## Development Commands

```bash
mise run check        # format + lint + test  (local dev loop)
mise run ci           # format + lint + test + build  (full CI gate)
mise run format       # Biome + cargo fmt + taplo
mise run lint         # tsc --noEmit + Biome + Clippy (-D warnings) + actionlint + yamllint
mise run test         # Vitest + cargo test
mise run test:e2e     # Playwright browser-mode E2E tests
mise run test:all     # Rust + Vitest + Playwright
mise run test:live    # FreshRSS integration tests (requires .env credentials)
mise run app:dev      # Launch the native app in repository dev mode
mise run app:dev:native-keyring     # Launch the native app in dev mode with the OS keyring backend
mise run app:install  # Build and install the current-platform packaged app
mise run app:dev:signed              # macOS-only: build, codesign, and run the dev binary (no Keychain dialog)
mise run app:dev:subscriptions-index # Launch the native app directly into the subscriptions index workspace
mise run app:dev:web-preview         # Launch the native app directly into Web Preview for VITE_DEV_WEB_URL
mise run app:dev:browser         # Launch browser-mode UI testing
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

## Documentation Routing

- Use [docs/README.md](docs/README.md) when you need an operational or historical document and do not know the exact file yet.
- Use [docs/release-manual-verification.md](docs/release-manual-verification.md) for packaged builds, updater checks, and release sign-off.
- Use [docs/incident-runbook.md](docs/incident-runbook.md) for logs, backups, recovery, updater, keyring, and sync triage.
- Use [docs/feed-content-privacy.md](docs/feed-content-privacy.md) for privacy and CSP rules around remote article content.
- Use [docs/superpowers/README.md](docs/superpowers/README.md) for dated design and implementation records.

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

| Path                              | Responsibility                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `api/tauri-commands.ts`           | All `invoke()` calls wrapped in `safeInvoke` returning `Result<T, AppError>`                                       |
| `schemas/`                        | Frontend-owned runtime schemas and schema parse helpers for config, storage, and preferences                       |
| `constants/`                      | Cross-feature literal values, storage keys, layout constants, and motion tokens                                    |
| `lib/account/`                    | Account selection, add-account form state, pane navigation, and sync status formatting helpers                     |
| `lib/articles/`                   | Article display modes, list derivation, retained-selection state, and article-view summary helpers                 |
| `lib/browser/`                    | Browser/WebView geometry, bounds normalization, and history helpers shared across API and reader UI                |
| `lib/content/`                    | Article/content HTML normalization and text extraction helpers                                                     |
| `lib/debug/`                      | Debug HUD element summaries and input trace formatting/dispatch helpers                                            |
| `lib/feed/`                       | Feed URL/host helpers and feed landing display/article selection helpers                                           |
| `lib/keyboard/`                   | Keyboard shortcut definitions, display labels, preference defaults, and action resolution                          |
| `lib/query/`                      | React Query client singleton and focused query invalidation helpers                                                |
| `lib/reader/`                     | Reader query, source-plan, and reader selection helpers                                                            |
| `lib/runtime/`                    | Tauri runtime listener grouping and clipboard command helpers                                                      |
| `lib/sidebar/`                    | Sidebar feed grouping, unread/starred counts, and smart-view view-model helpers                                    |
| `lib/subscriptions/`              | Subscriptions index rows, review candidates, summary filters, and related workspace types                          |
| `lib/sync/`                       | Manual sync cooldown handling and sync-result feedback summarization                                               |
| `lib/ui/`                         | UI-only pure helpers for option labels, UI language resolution, and user-facing error messages                     |
| `lib/window/`                     | DOM window event binding, Tauri window commands, and desktop chrome runtime helpers                                |
| `lib/*.types.ts`                  | Cross-feature TypeScript contracts that are shared without React runtime dependencies                              |
| `stores/`                         | Zustand stores — ui-store (selection, layout), preferences-store (async SQLite persistence)                        |
| `hooks/`                          | Cross-feature React Query hooks, app-shell/runtime hooks, and shared hook factories                                |
| `components/reader/`              | Three-pane layout: sidebar, article-list, article-view, browser-view, command palette                              |
| `components/settings/`            | Per-category settings panels, settings-local hooks, and settings-scoped shared primitives                          |
| `components/subscriptions-index/` | Subscriptions index management workspace, including subscription review / cleanup flow                             |
| `components/icons/`               | Provider and product icon components plus their narrow icon-only types                                             |
| `components/shared/`              | Cross-feature primitives reused by reader, settings, and workspaces                                                |
| `components/ui/`                  | shadcn/ui + Base UI headless primitives wrapped with Tailwind                                                      |
| `dev/`                            | Browser/dev-only mocks, runtime dev intent helpers, and `VITE_DEV_INTENT` scenarios                                |
| `dev/mocks.ts`                    | Browser/dev-only mock IPC handlers                                                                                 |
| `dev/mock-data.ts`                | Deterministic sample data for browser/dev-only mocks                                                               |
| `locales/`                        | i18next resources; Japanese product copy lives under `locales/ja/`                                                 |
| `../tests/helpers/`               | Shared test-only helpers: fixtures, Tauri mock setup, test-only mock call contracts, wrappers, and story renderers |
| `styles/global.css`               | Tailwind CSS v4 with OKLch design tokens                                                                           |

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
