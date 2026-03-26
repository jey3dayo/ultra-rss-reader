# Ultra RSS Reader

Desktop RSS feed reader built with Tauri 2 (Rust backend) + React 19 (TypeScript frontend) + SQLite.

## Tech Stack

- Runtime: Tauri 2 (Rust) + Vite (React 19, TypeScript)
- Package manager: pnpm (managed via mise.toml)
- State: Zustand (UI state) + React Query (remote data)
- Database: SQLite via rusqlite (embedded)
- Providers: Local RSS feeds, FreshRSS (GReader API)
- Secrets: dotenvx (.env encryption), keyring (OS credential store)

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

## Architecture

### Rust Backend (src-tauri/src/)

Layered architecture with strict dependency direction:

```
Commands (IPC boundary) -> Service -> Repository (traits) -> Domain
                                          |
                                        Infra (SQLite, HTTP, providers)
```

- domain/: Core types (Account, Feed, Article, Folder), DomainError, provider traits. No external dependencies.
- repository/: Data access trait definitions (account, article, feed, folder, pending_mutation, sync_state).
- infra/: Implementations -- SQLite repos (db/), feed providers (provider/), HTML sanitizer, OPML parser.
- service/: Orchestration -- sync_service, sync_flow, event_bus, housekeeping.
- commands/: Tauri command handlers (IPC boundary). Contains AppState, DTOs (dto.rs), and AppError.

### TypeScript Frontend (src/)

- api/tauri-commands.ts: All Tauri `invoke()` calls wrapped in `safeInvoke` returning `Result` type.
- stores/ui-store.ts: Zustand store for UI state (selection, layout, view mode).
- hooks/: React Query hooks (use-accounts, use-articles, use-feeds) and UI hooks (use-keyboard, use-layout, use-breakpoint).
- components/: Three-pane layout -- sidebar/, list/, content/. AppShell orchestrates layout.
- styles/: tokens.css (CSS custom properties), global.css. Components use inline styles referencing tokens.

## Coding Conventions

### TypeScript

- Biome: double quotes, semicolons, 2-space indent, 120 line width
- Strict mode: noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch
- Error handling: `@praha/byethrow` Result type. All Tauri calls go through `safeInvoke` in tauri-commands.ts.
- AppError has two variants: `UserVisible` (show to user) and `Retryable` (can retry).
- Styling: inline CSS with design tokens (CSS variables from tokens.css). No CSS-in-JS libraries.
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

## Adding a New Feature

1. Domain types in `src-tauri/src/domain/` (if new entities needed)
2. Repository trait in `repository/` + SQLite implementation in `infra/db/`
3. Service logic in `service/` (if orchestration needed)
4. Tauri command in `commands/` with DTO conversion and AppError mapping
5. TypeScript wrapper in `src/api/tauri-commands.ts` using `safeInvoke`
6. React Query hook in `src/hooks/`
7. UI components in `src/components/`
8. Tests: `cargo test` (Rust), `vitest` (TypeScript)
