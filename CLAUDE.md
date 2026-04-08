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

## Development Notes

- Use `mise run app:dev` as the default desktop development entry point. Use `mise run app:dev:browser` when you only need browser-mode UI debugging.
- Treat `README.md` as the human-facing source of truth for development modes and command details. Keep only short, always-needed guidance here.
- Dev builds log to stdout. The default Rust log level is `warn`, so use `RUST_LOG=info` or higher when diagnosing sync, browser, or provider issues.
- Release builds write file logs. Use the in-app "Open log directory" flow or `get_log_dir` when you need packaged-app logs for troubleshooting.
- Setting `DEV_CREDENTIALS=1` switches development builds to the file-based credential store. Production builds should continue using the OS keyring.
- Use `mise run test:live` only for live FreshRSS verification with encrypted `.env` credentials; keep it separate from the normal local dev loop.
- If a debugging or recovery procedure grows beyond a short note, move the detailed workflow into a skill and keep the background details in `README.md` or `docs/`.

## Temporary Artifacts

- Save screenshots only when they are necessary for the task.
- When a screenshot must be saved, store it under `tmp/screenshots/`.
- Do not place screenshots in the repository root or alongside source files.
- Prefer temporary logs and other Codex-generated artifacts under `tmp/` as well.

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
