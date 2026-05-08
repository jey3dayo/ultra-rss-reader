# Ultra RSS Reader

Use [README.md](README.md) as the primary source of truth for product overview, architecture, development modes, and command details.
This file stays intentionally short and focuses on agent-facing workflow guidance.

## First Actions

- Run `mise run check` before committing.
- Use `mise run ci` when you need the full repository gate including build validation.
- Default desktop development entry point: `mise run app:dev`.
- Use `mise run app:dev:browser` only when browser-mode UI debugging is enough.

## High-Signal Rules

- Prefer editing existing files over creating new files.
- Keep changes scoped to the requested task; avoid incidental refactors.
- For reader article list behavior, treat [docs/reader-article-scope-matrix.md](docs/reader-article-scope-matrix.md) as the source of truth for `ReaderQuery`, smart views, subscription scopes, footer filters, source hooks, and paging order.
- Put screenshots and other temporary artifacts under `tmp/`.
- For UI changes, check `DESIGN.md` before introducing new reusable patterns.
- For UI review or abstraction decisions, follow `DESIGN_REVIEW.md`.
- Treat `src/locales/ja/` as product UI copy. Keep Japanese labels concise, natural, and context-aware; update copy-sensitive tests when changing visible labels.
- Before release validation or packaged-build handoff, follow [docs/release-manual-verification.md](docs/release-manual-verification.md).

## File Placement

- Put feature-local UI in `src/components/<feature>/`.
- Put UI reused by multiple features in `src/components/shared/`.
- Keep shadcn/Base UI wrappers in `src/components/ui/`; do not place app-specific feature UI there.
- Co-locate large feature controller hooks under that feature's `hooks/` directory when they are not reused elsewhere.
- Put cross-feature data hooks in `src/hooks/` and cross-feature pure helpers in `src/lib/`.
- Put feature-owned hooks under `src/components/<feature>/hooks/` once every runtime consumer is within that feature boundary.
- Put article/content normalization helpers in `src/lib/content/`.
- Put feed URL/host helpers and feed landing helpers in `src/lib/feed/`.
- Put reader query/source planning helpers in `src/lib/reader/`.
- Put sidebar feed grouping and smart-view helpers in `src/lib/sidebar/`.
- Put UI-only pure helpers in `src/lib/ui/`.
- Put Tauri/browser runtime boundary helpers in `src/lib/runtime/`.
- Keep app-wide action boundaries at `src/lib/actions.ts` and `src/lib/app-actions.ts` when they are shared by keyboard, menu, command palette, dev scenarios, and IPC validation.
- Keep app-wide runtime singletons and domain-neutral primitives at the `src/lib` root when no narrower feature owns them, including `i18n.ts`, `datetime.ts`, and `utils.ts`.
- Keep cross-pane DOM focus helpers at `src/lib/reader-focus.ts`; `src/lib/reader/` is for pure reader query/source planning.
- Put frontend-owned runtime schemas in `src/schemas/` when they validate local config, localStorage, preferences, or other non-IPC data.
- Keep Tauri IPC request/response schemas in `src/api/schemas/`; do not mix them with local storage or app-config schemas.
- Put cross-feature literals in `src/constants/`, and shared type-only contracts in `src/lib/*.types.ts` unless an existing feature-local type file is narrower.
- Do not keep `.types.ts` files as dumping grounds for view-local props or hook-internal params/results. When a type is only consumed by one component or one hook, co-locate it in that file; keep `.types.ts` for contracts shared across views, hooks, stories, tests, stores, or runtime boundaries.
- Do not move React props or hook params/results to `src/schemas/` unless they validate runtime input. Schemas are for runtime validation boundaries; component and hook types are compile-time contracts.
- Put reusable test helpers under `tests/helpers/` and import them as `@tests/helpers/*` from frontend tests.
- Keep sample DTO/data fixtures in `tests/helpers/fixtures.ts`, Tauri IPC mock setup in `tests/helpers/tauri-mocks.ts`, and test-only Tauri mock call contracts in `tests/helpers/tauri-types.ts`.
- Reader-only pure helpers may stay under `src/components/reader/`; move them to `src/lib/` only when `lib`, `stores`, or another feature needs them.
- Keep external tool routing shims under `rules/tools/`; put day-to-day project rules in `.claude/rules/`.

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

## Localization Notes

- Japanese UI copy lives in `src/locales/ja/`.
- Prefer short labels for controls, tabs, and dense lists.
- Avoid repeating context already implied by the current page or category.
- Keep technical terms only when they help debugging or match the product surface.
- Run focused locale/copy tests after changing labels, then use `mise run check` before finishing.

## Temporary Artifacts

- Save screenshots only when they are necessary for the task.
- Store screenshots under `tmp/screenshots/`.
- Prefer other temporary Codex-generated artifacts under `tmp/` as well.
- Do not leave ad-hoc artifacts in the repository root or alongside source files.

## Documentation Map

- [README.md](README.md): product overview, architecture, commands, verification model
- [docs/README.md](docs/README.md): operational and reference docs index
- [docs/reader-article-scope-matrix.md](docs/reader-article-scope-matrix.md): reader article list source/scope/filter matrix and debugging checklist
- [DESIGN.md](DESIGN.md): visual rules and reusable UI design decisions
- [DESIGN_REVIEW.md](DESIGN_REVIEW.md): UI review flow and routing (`DESIGN.md` vs `shared` vs feature-local)
- [.claude/rules/README.md](.claude/rules/README.md): project-specific focused rules by topic

## Agent Routing

- `AGENTS.md` is only the thin entry point for agents that read it first.
- Keep repository-local operating guidance centralized in this file.
- Put longer debugging, recovery, or diagnostic workflows in skills or `README.md` / `docs/`, not in `AGENTS.md`.

## MCP and Skills

- For browser-only frontend debugging or view-only inspection, prefer `mise run app:dev:browser` plus the `agent-browser` skill.
- In Codex, prefer Computer Use when you need to observe or drive desktop-app behavior beyond browser view-only inspection, including visible-state checks, screenshots, and end-to-end interaction against the development app.
- For a running native Tauri app, prefer `tauri-mcp-server` for DOM inspection, computed style checks, and webview-level interactive UI review.
- For native desktop UI debugging, start from `mise run app:dev`, turn on `Settings > Debug > Show layout HUD`, and inspect the running dev window with `tauri-mcp-server` rather than a packaged build or browser-only preview.
- If Computer Use is available, use it alongside `tauri-mcp-server` for visible-state confirmation and window-level interaction while the `Debug HUD` is on-screen.
- Use `tauri-dev-screenshot` only when you need a saved native-window PNG artifact, window chrome, or an occlusion-safe capture that Computer Use or `tauri-mcp-server` cannot provide reliably.
- For child webview sizing, overlay shells, or logical-vs-physical pixel issues, use `tauri-webview-geometry`.
- Use the `tauri` skill when changing Tauri-facing code paths, especially filesystem and path handling from the webview.
- Do not use `agent-browser` as a substitute for Tauri-native inspection when the bug depends on the desktop shell, IPC, window state, or embedded webview geometry.
- Start from `mise run app:dev` before using Computer Use or `tauri-mcp-server` against the desktop app.
- When using Computer Use for desktop debugging, always operate the development app, not a packaged or release build.
- Before launching the development app for Computer Use, check whether it is already running and avoid multi-launching duplicate app instances.

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
