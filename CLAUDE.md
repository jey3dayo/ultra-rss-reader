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
- [DESIGN.md](DESIGN.md): visual rules and reusable UI design decisions
- [DESIGN_REVIEW.md](DESIGN_REVIEW.md): UI review flow and routing (`DESIGN.md` vs `shared` vs feature-local)
- [.claude/rules/README.md](.claude/rules/README.md): project-specific focused rules by topic

## Agent Routing

- `AGENTS.md` is only the entry point. Keep repository-local operating guidance centralized in this file.
- For UI implementation, consult `DESIGN.md` before changing visuals or introducing reusable design patterns.
- For UI review and abstraction decisions, follow `DESIGN_REVIEW.md`.
- Put longer debugging, recovery, or diagnostic workflows in skills or `README.md` / `docs/`, not in `AGENTS.md`.

## MCP and Skills

- For browser-only frontend debugging, prefer `mise run app:dev:browser` plus the `agent-browser` skill.
- For a running native Tauri app, prefer `tauri-mcp-server` with the MCP Bridge plugin for webview screenshots, DOM inspection, JavaScript execution, window info, and IPC observation.
- For native-window capture on macOS or Windows, use `tauri-dev-screenshot` and save artifacts under `tmp/screenshots/`.
- For child webview sizing, overlay shells, or logical-vs-physical pixel issues, use `tauri-webview-geometry`.
- Use the `tauri` skill when changing Tauri-facing code paths, especially filesystem and path handling from the webview.
- Do not use `agent-browser` as a substitute for Tauri-native inspection when the bug depends on the desktop shell, IPC, window state, or embedded webview geometry.
- Start from `mise run app:dev` before using `tauri-mcp-server` tools against the desktop app.

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
