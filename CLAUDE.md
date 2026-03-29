# Ultra RSS Reader

Desktop RSS feed reader built with Tauri 2 (Rust) + React 19 (TypeScript) + SQLite.
Architecture, tech stack, and coding conventions are documented in [README.md](README.md).

## Commands

```bash
mise run check          # format + lint + test (local dev loop)
mise run ci             # format + lint + test + build (full gate)
mise run format         # Biome + cargo fmt + taplo
mise run lint           # tsc --noEmit + Biome lint + Clippy (-D warnings)
mise run test           # Vitest + cargo test
mise run test:live      # FreshRSS integration tests (requires .env credentials)
mise run app:dev        # Run the app in dev mode
mise run app:dev:browser # Browser UI testing (http://127.0.0.1:4173/)
mise run app:build      # Build native app for current platform
mise run app:icon       # Generate app icons
```

Always run `mise run check` before committing.

## Task Management

- `TODO.md`: Track in-progress and upcoming tasks.
- `CHANGELOG.md`: Record completed features and fixes in Keep a Changelog format.
- Once a batch of work stabilizes, move finished items from TODO.md to CHANGELOG.md.

## Architecture Overview

```text
Commands (IPC boundary) -> Service -> Repository (traits) -> Domain
                                          |
                                        Infra (SQLite, HTTP, providers)
```

Details in [README.md § Architecture](README.md#architecture).

## Adding a New Feature

1. Domain types in `src-tauri/src/domain/` (if new entities needed)
2. Repository trait in `repository/` + SQLite implementation in `infra/db/`
3. Service logic in `service/` (if orchestration needed)
4. Tauri command in `commands/` with DTO conversion and AppError mapping
5. TypeScript wrapper in `src/api/tauri-commands.ts` using `safeInvoke`
6. React Query hook in `src/hooks/`
7. UI components in `src/components/`
8. Tests: `cargo test` (Rust), `vitest` (TypeScript)
