# Ultra RSS Reader

Desktop RSS feed reader built with Tauri 2 (Rust backend) + React 19 (TypeScript frontend) + SQLite.

## Tech Stack

- Runtime: Tauri 2 (Rust) + Vite (React 19, TypeScript) + tauri-plugin-updater (auto-update via GitHub Releases)
- Package manager: pnpm (managed via mise.toml)
- State: Zustand (UI state) + React Query (remote data)
- Database: SQLite via rusqlite (embedded)
- Providers: Local RSS feeds, FreshRSS (GReader API)
- UI: Base UI (`@base-ui/react`) headless primitives + shadcn (base-nova) theme/config layer
- Secrets: dotenvx (.env encryption), keyring (OS credential store), 1Password (signing keys & CI secrets)

## Commands

```bash
mise run check          # format + lint + test (local dev loop)
mise run ci             # format + lint + test + build (full gate)
mise run format         # Biome + cargo fmt + taplo
mise run lint           # tsc --noEmit + Biome lint + Clippy (-D warnings)
mise run test           # Vitest + cargo test
mise run test:live      # FreshRSS integration tests (requires .env credentials)
pnpm tauri dev          # Run the app in dev mode
```

Always run `mise run check` before committing.

## Task Management

- `TODO.md`: Track in-progress and upcoming tasks.
- `CHANGELOG.md`: Record completed features and fixes in Keep a Changelog format.
- Once a batch of work stabilizes, move finished items from TODO.md to CHANGELOG.md.

## Architecture

### Rust Backend (src-tauri/src/)

Layered architecture with strict dependency direction:

```text
Commands (IPC boundary) -> Service -> Repository (traits) -> Domain
                                          |
                                        Infra (SQLite, HTTP, providers)
```

- domain/: Core types (Account, Feed, Article, Folder, Tag), DomainError, provider traits. No external dependencies.
- repository/: Data access trait definitions (account, article, feed, folder, pending_mutation, preference, sync_state, tag).
- infra/: Implementations -- SQLite repos (db/, including sqlite_tag), feed providers (provider/), HTML sanitizer, OPML parser, keyring_store (OS credential storage).
- service/: Orchestration -- sync_service, sync_flow, sync_scheduler, event_bus, housekeeping.
- commands/: Tauri command handlers (IPC boundary). Modules: account, article, feed, opml, preference, share, tag, updater. Contains AppState, DTOs (dto.rs), and AppError. FreshRSS sync is orchestrated directly in feed_commands.rs with per-step Mutex lock scoping.
- menu.rs: Application menu builder (macOS native menu bar with View/Accounts/Subscriptions/Item/Share menus).

### TypeScript Frontend (src/)

- api/tauri-commands.ts: All Tauri `invoke()` calls wrapped in `safeInvoke` returning `Result` type.
- stores/ui-store.ts: Zustand store for UI state (selection, layout, view mode, toast).
- stores/preferences-store.ts: Zustand store for user preferences with async persistence to SQLite.
- hooks/: React Query hooks (use-accounts, use-articles, use-feeds, use-folders, use-tags) and UI hooks (use-keyboard, use-layout, use-breakpoint, use-menu-events, use-updater).
- components/reader/: Three-pane layout -- sidebar.tsx, article-list.tsx, article-view.tsx, browser-view.tsx. Extracted subcomponents: add-feed-dialog.tsx, feed-item.tsx, folder-section.tsx. AppShell orchestrates layout.
- components/settings/: Settings modal split into per-category files (general, appearance, reading, shortcuts, actions, bionic-reading, account-detail, add-account-form). Shared form components in settings-components.tsx.
- components/ui/: Base UI (`@base-ui/react`) headless primitives wrapped with Tailwind styling. shadcn (base-nova style) is config/theme layer only. Customize via className props.
- styles/global.css: Tailwind CSS v4 with OKLch color tokens. No CSS-in-JS libraries.

## Coding Conventions

### TypeScript

- Biome: double quotes, semicolons, 2-space indent, 120 line width
- Strict mode: noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch
- Error handling: `@praha/byethrow` Result type. All Tauri calls go through `safeInvoke` in tauri-commands.ts.
- AppError has two variants: `UserVisible` (show to user) and `Retryable` (can retry).
- Styling: Tailwind CSS utility classes with `cn()` helper (clsx + tailwind-merge). Design tokens via CSS custom properties in global.css.
- Functional components only. No class components.

### Rust

- cargo fmt + Clippy with `-D warnings` (zero warnings policy)
- Error handling: thiserror-based `DomainError` enum (Network, Parse, Persistence, Auth, Validation, Keychain).
  DomainError converts to `AppError` at the command boundary (Network -> Retryable, others -> UserVisible).
- Provider pattern: `FeedProvider` trait (async_trait) implemented by local and freshrss providers.
- DTOs: Domain types convert to serializable DTOs via `From` impls in commands/dto.rs.
- Database: rusqlite with `DbManager` behind Mutex in AppState. Migrations in infra/db/migration.rs.

## Security

- HTML sanitization is server-side only (ammonia crate in Rust). Content arrives pre-sanitized.
- Frontend uses `dangerouslySetInnerHTML` only for `content_sanitized` fields with biome-ignore comment.
- Credentials stored via OS keyring (keyring crate), never in SQLite.
- .env files encrypted with dotenvx. Never commit .env or plaintext secrets.
- Auto-update bundles verified via Ed25519 signatures (tauri-plugin-updater).

## Adding a New Feature

1. Domain types in `src-tauri/src/domain/` (if new entities needed)
2. Repository trait in `repository/` + SQLite implementation in `infra/db/`
3. Service logic in `service/` (if orchestration needed)
4. Tauri command in `commands/` with DTO conversion and AppError mapping
5. TypeScript wrapper in `src/api/tauri-commands.ts` using `safeInvoke`
6. React Query hook in `src/hooks/`
7. UI components in `src/components/`
8. Tests: `cargo test` (Rust), `vitest` (TypeScript)
