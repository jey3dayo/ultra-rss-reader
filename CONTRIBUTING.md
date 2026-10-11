# Contributing / Development Guide

This document is the source of truth for development setup, development modes, verification commands, architecture, provider support (Local feeds and FreshRSS via the GReader API), and coding conventions.
For the product overview, see [README.md](README.md). For agent workflow and rule routing, see [AGENTS.md](AGENTS.md).

## Start Here

1. Read [README.md](README.md) for the product overview, then this file for development workflow.
2. Run `mise install` and `pnpm install`.
3. Run `pnpm hooks:install` to install the lefthook pre-commit / pre-push hooks.
4. Start the app with `mise run app:dev`.
5. Use `mise run check` as the default fast local verification gate.
6. Use `mise run check:wsl` when formatter/linter stability or WSL parity matters.
7. Follow [docs/release-manual-verification.md](docs/release-manual-verification.md) before any release or packaged-build handoff.

## Prerequisites

- [mise](https://mise.jdx.dev/) — task runner and tool version manager
- Node.js 26+ and pnpm (installed automatically via mise)
- Rust stable toolchain
- Platform-specific Tauri prerequisites: [tauri.app/v2/guides/prerequisites](https://tauri.app/v2/guides/prerequisites)

## Getting Started

```bash
# Install tool versions and dependencies
mise install
pnpm install

# Install lefthook pre-commit / pre-push hooks
pnpm hooks:install

# Run the desktop app in development mode
mise run app:dev
```

`mise run app:dev` is the default development entry point. It wraps the Tauri dev configuration used by this repository.
Under the hood, Tauri starts the Vite dev server with `beforeDevCommand` and loads the frontend from `devUrl`
(`http://localhost:1420`).
By default, `mise run app:dev` uses `DEV_CREDENTIALS=1`, so FreshRSS account credentials go to the dev file store instead of the native OS keyring.
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
- Seed dev data from packaged app data: `mise run app:dev:seed-from-prod`
  Copies the packaged app database into the development app data location when you need to reproduce behavior against production-like local data.
- Web-only frontend debugging: `mise run app:dev:browser`
  Starts the browser-mode dev server on `http://127.0.0.1:4173/` without the Tauri shell.
  Account commands use UI mocks in this mode; it does not verify Cloudflare Access authentication or native keyring storage.
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
mise run check        # fast format + lint + Rust + node Vitest  (day-to-day local dev loop)
mise run check:wsl    # WSL-backed static-analysis gate  (Windows delegates to WSL_REPO_DIR)
mise run ci           # unit-first format + lint + test + build  (full CI gate)
mise run format       # Biome + cargo fmt + taplo
mise run lint         # tsc --noEmit + Biome + Clippy (-D warnings) + jactionlint + yamllint
mise run test         # Vitest + cargo test
mise run test:ci      # quiet unit-first CI test gate
mise run test:unit:dom # jsdom Vitest for DOM/rendering changes
mise run test:e2e     # Playwright browser-mode E2E tests
mise run test:storybook:e2e # Storybook Playwright smoke tests
mise run build:storybook    # Storybook static build check
mise run test:all     # Rust + Vitest + Playwright
mise run test:live    # FreshRSS integration tests (requires .env credentials)
mise run report:jev   # jev-lint LLM review of the diff against origin/main (needs TYPESAFE_API_KEY; advisory, not a gate)
mise run app:dev      # Launch the native app in repository dev mode
mise run app:dev:native-keyring     # Launch the native app in dev mode with the OS keyring backend
mise run app:install  # Build, locally re-sign, and install the current checkout; not published release verification
mise run app:dev:signed              # macOS-only: build, codesign, and run the dev binary (no Keychain dialog)
mise run app:dev:subscriptions-index # Launch the native app directly into the subscriptions index workspace
mise run app:dev:web-preview         # Launch the native app directly into Web Preview for VITE_DEV_WEB_URL
mise run app:dev:seed-from-prod      # Seed the dev app database from packaged app data
mise run app:dev:browser         # Launch browser-mode UI testing
pnpm storybook                       # Launch Storybook for component development
pnpm build-storybook                 # Build Storybook static output
```

Always run `mise run check` before committing. Run `mise run check:wsl` when formatter/linter stability should be checked through WSL; on Windows it delegates to the WSL checkout set by `WSL_REPO_DIR`. Run `mise run test:unit:dom` for DOM, React rendering, Testing Library, or browser global changes; run `mise run ci` before PR handoff or when full repository confidence is needed.

### Test Scope

- `mise run check` is the default fast verification loop for local work (format + lint + Rust tests + node Vitest).
- `mise run check:wsl` is the WSL-backed static-analysis gate for formatter/linter stability. On Windows, install a WSL distribution visible to the current Windows user, then set `WSL_REPO_DIR` to that WSL checkout path before running it.
- `mise run test` runs the full repository test set (Rust + Vitest).
- `mise run test:ci` runs the quieter CI test gate with Vitest first, then Rust tests.
- `pnpm run check:release-contamination` validates release sources and the actual Cargo dependency graph. Node unit tests exercise the source checks and injected dependency-runner failures without resolving Cargo dependencies. CI runs the full command separately on Linux and Windows after Rust tests; release builds and local release preflight also run it. Cargo uses `--locked`, may populate its registry cache, and fails closed on missing tools, resolution errors, or its 120-second subprocess timeout. Source and dependency stages report separate timings.
- `mise run test:unit:dom` runs the jsdom Vitest suite for DOM, React rendering, Testing Library, and browser global coverage.
- `mise run test:e2e` runs Playwright against the browser-mode UI flow. Its default config also collects `e2e/storybook/`, whose specs need the Storybook server; run `mise exec -- pnpm exec playwright test e2e/app.spec.ts` for the app flow only.
- `mise run test:storybook:e2e` runs the Storybook Playwright smoke suite against the UI reference canvases. Use it after changing Storybook stories, shared visual reference canvases, or Storybook-only decorators.
- `mise run build:storybook` is the static Storybook build gate. Run it with `mise run test:storybook:e2e` before relying on a Storybook fixture in a review or release note.
- `mise run test:live` is opt-in and requires real FreshRSS credentials from `.env`.
- Features that depend on OS services such as updater installation and native keyring behavior still need platform-specific manual verification. Follow [docs/release-manual-verification.md](docs/release-manual-verification.md) before tagging a release or sharing a packaged build.
- Published release install verification must use the artifact from GitHub Releases and record its digest, codesign result, and Gatekeeper result. macOS releases currently assume no Apple Developer Program / Developer ID; the app is ad-hoc signed, so `codesign --verify --deep --strict` is required evidence and Gatekeeper notarization acceptance is recorded as skipped or rejected by policy unless Apple notarization credentials are configured. `mise run app:install` rebuilds from the current checkout and may locally re-sign the app, so it is not a substitute for published artifact verification.

### Verification Matrix

| Area                                      | Default CI / local gate                        | Additional verification                                    |
| ----------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| TypeScript / Rust / node unit regressions | `mise run check`                               | `mise run ci` before PR handoff or broad changes           |
| DOM / React rendering regressions         | `mise run ci`                                  | Focused `mise run test:unit:dom` during local iteration    |
| Browser-mode UI flow                      | `mise run test:e2e`                            | Optional manual pass in `mise run app:dev:browser`         |
| Storybook reference canvases              | Not part of default CI                         | `mise run build:storybook` + `mise run test:storybook:e2e` |
| FreshRSS real-server integration          | Not part of default CI                         | `mise run test:live` with real credentials                 |
| Native keyring integration                | Unit / integration tests around app logic only | Manual verification on each target OS                      |
| Updater download / install                | Config and command-level checks only           | Manual verification on packaged builds per target OS       |
| Code quality baseline reports             | Not part of default CI                         | `mise run report:knip` / `mise run report:similarity`      |
| jev-lint diff review (LLM, advisory)      | Not part of default CI                         | `mise run report:jev` (needs `TYPESAFE_API_KEY`)           |

> **Windows Rust scope:** Windows CI's `mise run test:rust` runs `cargo test --test integration_test` only. Full Rust library tests run in Linux CI and on macOS/Linux with `mise run check`.

`mise run ci` intentionally covers format, lint, repository tests, and frontend build. It runs the quiet Vitest unit gate before lint, Rust tests, and build so unit failures surface before heavier checks. It does not run Playwright, Storybook static build, live-service tests, or native packaged-app checks, so release validation still needs the checklist in [docs/release-manual-verification.md](docs/release-manual-verification.md).

### Cloud UI Verification

Execution steps for headless browser checks when no dedicated browser tool is available. When to run them and how to report unverified items is owned by [.claude/rules/ui-browser-prep.md](.claude/rules/ui-browser-prep.md).

1. Run the standard setup (`mise install` and `pnpm install`) with the pinned versions; do not change pins to fit the host. If `mise install` fails on a tool that browser checks do not need (for example `rust` on a read-only `~/.rustup`), run `mise install node`, record the failure, and continue. The repository `mise.toml` does not provide pnpm; use the `packageManager` version from `package.json`, for example `mise exec pnpm@<version> -- pnpm install`.
2. Install Chromium and its Linux system dependencies with `mise exec -- pnpm exec playwright install --with-deps chromium`. If system installation is unavailable, try `mise exec -- pnpm exec playwright install chromium` when the host already provides the required libraries. Record failures and continue checks that do not need a browser.
3. Run the browser-mode flow with `mise exec -- pnpm exec playwright test e2e/app.spec.ts`, or another relevant spec outside `e2e/storybook/`. Bare `mise run test:e2e` also collects the `e2e/storybook/` specs, which need the Storybook server from `mise run test:storybook:e2e`. `playwright.config.ts` starts its own Vite through `pnpm dev:tauri:vite`, waits on the fixed URL `http://localhost:1420` (leave `TAURI_DEV_PORT` unset), and refuses server reuse.
4. Port 1420 is also the `mise run app:dev` port. Confirm it is free before running, and do not run E2E while another session's `mise run app:dev` is active: when the Vite manager finds this checkout's Vite already listening there, it stops that process (SIGTERM, then SIGKILL).
5. The config saves screenshots only on failure. For a visual check of a passing state, start `mise run app:dev:browser` (port 4173, independent of 1420) and capture it with `mise exec -- pnpm exec playwright screenshot --viewport-size=1280,800 --wait-for-timeout=1000 http://127.0.0.1:4173/ tmp/screenshots/<name>.png`, changing `--viewport-size` for each width relevant to the change. For states reached through interaction, rerun the spec with `--trace on`; open the trace under `test-results/e2e` with `mise exec -- pnpm exec playwright show-trace <trace.zip>` to view step screenshots. Inspect captured images with an available image viewer.
6. Keep temporary screenshots under `tmp/screenshots/`; E2E failure artifacts and reports stay under `test-results/e2e` and `playwright-report/e2e`. Do not commit them or include real credentials in them.

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

| Module            | Responsibility                                                                     |
| ----------------- | ---------------------------------------------------------------------------------- |
| `domain/`         | Core types (Account, Feed, Article, Folder), DomainError, provider traits          |
| `repository/`     | Data access trait definitions                                                      |
| `infra/db/`       | SQLite implementations, migrations, DbManager                                      |
| `infra/provider/` | FeedProvider implementations (local RSS, FreshRSS GReader)                         |
| `service/`        | article_materializer, local_account_sync, local_account_sync_apply, sync_scheduler |
| `commands/`       | Tauri IPC handlers, DTOs, AppState, AppError                                       |

Error mapping: `DomainError` → `AppError` at the command boundary (`Network` → `Retryable`, others → `UserVisible`).

### Sync & Concurrency

| Mechanism                  | Location                     | Purpose                                                           |
| -------------------------- | ---------------------------- | ----------------------------------------------------------------- |
| `AtomicBool` + `SyncGuard` | `commands/feed_commands.rs`  | Prevents overlapping sync runs (scheduler vs manual trigger)      |
| WAL journal mode           | `infra/db/connection/mod.rs` | Allows concurrent reads during writes                             |
| `busy_timeout = 5000`      | `infra/db/connection/mod.rs` | Retries on lock contention for up to 5 seconds                    |
| Reader/writer split        | `DbManager`                  | Dedicated connections for reads and writes                        |
| Scoped `Mutex` locks       | All command handlers         | Locks released before `.await` points (see `rust-async-mutex.md`) |
| Pending mutations dedup    | `sqlite_pending_mutation.rs` | Latest mutation wins per `(account_id, remote_entry_id)`          |

#### Current Sync Consistency Rules

- Remote-state accounts push queued `pending_mutations` before applying remote state.
- FreshRSS pending mutations are replayed one item at a time. A successful push is deleted from the queue immediately, while a failed push remains queued and reports a retry warning for the next sync attempt.
- When remote state is applied, entries that still have pending local mutations and entries pushed successfully in the same sync are excluded from overwrite so local intent wins until the provider catches up.
- Unread counts are recalculated after the sync flow completes.
- FreshRSS API responses are still treated as success or failure per mutation request; there is no deeper provider-specific partial-success detection inside a single edit-tag request.

### TypeScript Frontend (`src/`)

| Path                              | Responsibility                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `api/tauri-commands.ts`           | All `invoke()` calls wrapped in `safeInvoke` returning `Result<T, AppError>`                                       |
| `design-system/`                  | Public UI barrel (`index.ts`); app, feature, Storybook, and test code import shared UI as `@/design-system`        |
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

## Localization

Japanese locale files live under `src/locales/ja/` and are treated as product UI, not mechanical translation.
Keep labels short enough for dense controls, prefer natural Japanese over literal English, and avoid repeating context that is already provided by the surrounding section. When a visible label changes, update tests that intentionally assert that copy.

## Security

- HTML sanitization happens in Rust (ammonia) before content reaches the frontend. The frontend renders `content_sanitized` fields only.
- The current CSP policy is compatibility-first for feed content: scripts stay locked to `'self'`, while remote `http:` / `https:` images and frames are allowed so sanitized articles and the in-app browser can load external pages.
- Feed content privacy expectations and future tightening rules are documented in [docs/feed-content-privacy.md](docs/feed-content-privacy.md).
- Tightening CSP further requires checking article rendering, thumbnail loading, and embedded browser behavior across the supported providers.
- Credentials (FreshRSS passwords, tokens) are stored in the OS keyring, never in SQLite.
- Setting `DEV_CREDENTIALS=1` switches development builds to a file-based credential store; production builds continue to use the OS keyring.
- Cloudflare Access Service Token credentials always use the OS keyring, including in development; `DEV_CREDENTIALS=1` never routes them to the dev file store.
- `.env` is encrypted with dotenvx and safe to commit; only encrypted `encrypted:` values ever land in git. Never commit plaintext secrets, `.env.keys` (the decryption key), or `.env.local`.

## Release

Tagging `v*` triggers a GitHub Actions release build for macOS Apple Silicon and Windows, then creates a draft GitHub Release. Version is kept in sync across `tauri.conf.json`, `Cargo.toml`, and `package.json`.

macOS release artifacts are built under a no Developer ID policy. The release config uses ad-hoc signing, validates the packaged `.app` with `codesign --verify --deep --strict`, and only treats Gatekeeper notarization assessment as required when Apple notarization credentials are configured.

## Troubleshooting

- Start from [docs/README.md](docs/README.md) if you are not sure which operational document you need.
- Use [docs/incident-runbook.md](docs/incident-runbook.md) for the shortest path to logs, backups, and failure-specific triage steps.
- If the app looks stale during development, make sure you are using `mise run app:dev` or `mise run app:dev:browser`, not `pnpm preview`.
- If `pnpm preview` does not reflect a recent frontend change, run `pnpm build` first so `dist/` is regenerated.
- Playwright failure artifacts are split by gate: browser-mode E2E writes to `test-results/e2e` and `playwright-report/e2e`; Storybook smoke writes to `test-results/storybook` and `playwright-report/storybook`.

## Documentation

Use [docs/README.md](docs/README.md) as the index for operational docs, current behavior references, and historical design records.
Agent-specific workflow guidance lives in [AGENTS.md](AGENTS.md), and topic-specific engineering rules live in [.claude/rules/README.md](.claude/rules/README.md).
