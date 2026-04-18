# Ultra RSS Reader

Use [README.md](README.md) as the primary source of truth for product overview, architecture, development modes, and command details.
This file stays intentionally short and focuses on agent-facing workflow guidance.

## Daily Workflow

- Run `mise run check` before committing.
- Use `mise run ci` when you need the full repository gate including build validation.
- Default desktop development entry point: `mise run app:dev`.
- Use `mise run app:dev:browser` only when browser-mode UI debugging is enough.

## Operational Notes

- Dev builds log to stdout. Set `RUST_LOG=info` or higher when diagnosing sync, browser, or provider issues.
- Release builds write file logs. Use the in-app "Open log directory" flow or `get_log_dir` for packaged-app troubleshooting.
- `DEV_CREDENTIALS=1` is for development only and switches credentials to file-based storage. Production builds must keep using the OS keyring.
- Before tagging a release or sharing a packaged build, follow [docs/release-manual-verification.md](docs/release-manual-verification.md).
- For incident triage, logs, backups, or failure-specific recovery steps, start from [docs/README.md](docs/README.md).

## Task Tracking

- `TODO.md` tracks in-progress and upcoming work only.
- `CHANGELOG.md` records completed user-visible changes.
- Move finished TODO items into `CHANGELOG.md` once the work stabilizes.

## Temporary Artifacts

- Save screenshots only when they are necessary for the task.
- Store screenshots under `tmp/screenshots/`.
- Prefer other temporary Codex-generated artifacts under `tmp/` as well.
- Do not leave ad-hoc artifacts in the repository root or alongside source files.

## Documentation Map

- [README.md](README.md): product overview, architecture, commands, verification model
- [docs/README.md](docs/README.md): operational and reference docs index
- [.claude/rules/README.md](.claude/rules/README.md): project-specific focused rules by topic

## Feature Work Reminder

When adding a feature, prefer this path unless the existing code suggests a tighter local pattern:

1. Domain types in `src-tauri/src/domain/` if new entities are needed.
2. Repository trait and implementation updates in `repository/` and `infra/db/`.
3. Service orchestration in `service/`.
4. Tauri command wiring in `commands/`.
5. TypeScript wrapper in `src/api/tauri-commands.ts` via `safeInvoke`.
6. React Query hooks in `src/hooks/`.
7. UI components in `src/components/`.
8. Verification in Rust and TypeScript test suites.
