# Ultra RSS Reader Agent Guide

Use [README.md](README.md) as the source of truth for product overview, architecture, development modes, command details, and verification scope.
This file is the short repository-local workflow guide for agents.

## First Actions

- Read `AGENTS.md` first when your runtime routes through it, then this file, then the linked source documents.
- Check `git status --short` before editing. Preserve unrelated user or generated changes.
- Prefer existing files and local patterns. Keep changes scoped to the requested task.
- Default desktop development entry point: `mise run app:dev`.
- Browser-only UI debugging entry point: `mise run app:dev:browser`.
- Default fast local verification gate before finishing or committing: `mise run check`.
- Use `mise run test:unit:dom` for jsdom-affected changes, and `mise run ci` when release, native, Storybook, build output, PR handoff, broad UI behavior, or full repository confidence is affected.

## Source Of Truth

Use this table as the Source of Truth Table (SoTT) when deciding where to read or update durable project knowledge.
Do not duplicate the same fact across documents; update the owning source and keep routers lightweight.

| Target | Source of truth | Use |
| --- | --- | --- |
| Agent runtime entry | [AGENTS.md](AGENTS.md) | Thin router for runtimes that read `AGENTS.md` before repository-local guidance |
| Agent workflow, source routing, and this SoTT | [CLAUDE.md](CLAUDE.md) | Repository-local workflow, quality-gate selection, rule routing, and source ownership |
| Product scope, setup, usage, architecture overview, and verification scope | [README.md](README.md) | User-facing product overview, development modes, command details, and architecture summary |
| Operational docs and historical records index | [docs/README.md](docs/README.md) | Entry point for focused operational docs and historical design/planning records |
| Visual design rules, UX principles, and style-token policy | [DESIGN.md](DESIGN.md) | Durable reusable visual guidance; implementation tokens live in [src/styles/global.css](src/styles/global.css) |
| UI review and abstraction routing | [DESIGN_REVIEW.md](DESIGN_REVIEW.md) | Review process, shared-vs-local routing, exceptions, and escalation |
| Runtime coding rules and security-adjacent policy | [.claude/rules/README.md](.claude/rules/README.md) and topic rules | Browser/Tauri boundaries, schemas, owner routing, async effects, Result placement, preferences, release, and native/runtime rules |
| UI display messages and translation keys | [src/locales/](src/locales/) and [src/lib/i18n-resources.ts](src/lib/i18n-resources.ts) | i18next locale resources, namespaces, and resource registry; Japanese product copy lives under `src/locales/ja/` |
| Frontend storage keys and cleanup contracts | [src/constants/storage.ts](src/constants/storage.ts) | localStorage keys, legacy aliases, owners, schema policies, and cleanup policy connections |
| Frontend runtime validation | [src/schemas/](src/schemas/) | Frontend-owned runtime schemas for app config, localStorage, preferences, and non-IPC validation |
| Tauri IPC contracts | [src/api/tauri-commands.ts](src/api/tauri-commands.ts), [src/api/schemas/](src/api/schemas/), and [src-tauri/src/commands/](src-tauri/src/commands/) | `safeInvoke` wrappers, request/response schemas, command DTOs, and command-boundary error mapping |
| SQLite schema and migrations | [src-tauri/src/infra/db/migration.rs](src-tauri/src/infra/db/migration.rs) and [src-tauri/src/infra/db/](src-tauri/src/infra/db/) | Embedded DB schema, migration ordering, connection policy, and SQLite repository implementations |
| Domain and repository contracts | [src-tauri/src/domain/](src-tauri/src/domain/) and [src-tauri/src/repository/](src-tauri/src/repository/) | Core domain types and data-access trait boundaries |
| App action IDs and protocol-like markers | [src/lib/app-actions.ts](src/lib/app-actions.ts) and [src/lib/actions.ts](src/lib/actions.ts) | Keyboard, menu, command palette, and dev-scenario action identifiers and execution routing |
| Build, verification commands, and tool versions | [mise.toml](mise.toml), `mise/*.toml`, and [package.json](package.json) | mise tasks, package scripts, package manager version, engines, and toolchain contract |
| Active work tracking | [TODO.md](TODO.md) | In-progress work, follow-up tasks, known gaps, and TODO triage inputs |
| Completed user-visible changes | [CHANGELOG.md](CHANGELOG.md) | Completed user-visible changes and release readiness notes |
| Generated artifacts | `dist/` and `src-tauri/gen/schemas/` | Not source of truth; regenerate from owning source before reviewing or committing artifact drift |

Keep UI display messages, AI/dev prompt text, storage keys, protocol/action markers, and compatibility regex separate.
Display copy belongs in locale resources, storage keys in storage constants, protocol markers in their action or IPC owners,
and compatibility regex next to the parser or schema that owns the fallback.

## Quality Gates

- `mise run check` is the default day-to-day fast gate for the current OS and covers format, lint, Rust tests, and node Vitest.
- `mise run check:wsl` is the WSL-backed static-analysis gate for formatter/linter stability. On Windows it delegates to a WSL checkout via `WSL_REPO_DIR`.
- `mise run test:unit:dom` runs the jsdom Vitest suite separately when DOM, React rendering, Testing Library, or browser global behavior is affected.
- `mise run ci` is the unit-first full local gate including jsdom Vitest and build validation.
- `mise run quality:react-doctor:diff` is the changed-file React Doctor regression gate.
- `mise run quality:react-doctor:full` is informational for known full-scan baseline debt.
- `mise run quality:knip` checks Knip baseline drift.
- `mise run report:similarity` reports the similarity-ts TODO baseline. Treat 0.95 as near-copy, 0.9 as TODO triage, and 0.87 as broad discovery; increase size thresholds before extracting helpers from tiny callback-shape matches.
- Before release validation or packaged-build handoff, follow [docs/release-manual-verification.md](docs/release-manual-verification.md).

## High-Signal Rules

- Prefer editing existing files over creating new files.
- Avoid incidental refactors, feature additions, or docs churn outside the task.
- Put screenshots and other temporary artifacts under `tmp/`, preferably `tmp/screenshots/` for screenshots.
- Treat `src/locales/ja/` as product UI copy. Keep Japanese labels concise and natural, and update copy-sensitive tests when visible labels change.
- Reader article list behavior is governed by [docs/reader-article-scope-matrix.md](docs/reader-article-scope-matrix.md).
- Reader pane keyboard behavior is governed by [docs/reader-keyboard-navigation.md](docs/reader-keyboard-navigation.md).
- Incident triage starts from [docs/incident-runbook.md](docs/incident-runbook.md) or the broader [docs/README.md](docs/README.md) index.

## Placement And Boundaries

- Follow the repository structure rules in [.claude/rules/README.md](.claude/rules/README.md) before moving code or creating shared surfaces.
- Treat `src-tauri/gen/schemas/` as generated Tauri capability schema output, not source. Do not hand-edit files there; change `src-tauri/capabilities/` or the owning Tauri permission/config source, rerun the Tauri CLI command that generated the schema drift, and review the resulting schema diff as generated output before committing.
- Keep frontend-owned runtime schemas in `src/schemas/`; keep Tauri IPC request/response schemas in `src/api/schemas/`.
- Do not move React props or hook params/results to `src/schemas/` unless they validate runtime input.
- Keep one-consumer component or hook types local. Use `.types.ts` only for contracts shared across views, hooks, stories, tests, stores, or runtime boundaries.
- Extract component-local pure helpers to `src/lib/` only when they are React-free, UI-copy-free, store-free, and Tauri-command-free.
- Prefer compatibility re-exports from the old feature module when tests, mocks, or nearby components still import that public surface.

## Type Surface Policy

- Prefer `type` aliases for object shapes, unions, mapped types, and component or hook contracts.
- Use `interface` only when declaration merging or external augmentation is required, such as `ImportMetaEnv`, `Window`, or library module augmentation.
- Derive DTO and runtime-boundary types from schemas with Valibot's `InferOutput` / `InferInput` or from the Tauri command wrapper source of truth.
- Treat `as` assertions as boundary code only. Prefer `unknown` plus narrowing, schema parsing, `satisfies`, or small typed helpers.

## Rule Routing

- Browser APIs, Tauri runtime APIs, storage, platform globals, or runtime boundaries: [.claude/rules/runtime-boundary.md](.claude/rules/runtime-boundary.md).
- `@praha/byethrow` Result placement and component boundary rules: [.claude/rules/result-boundary.md](.claude/rules/result-boundary.md).
- Async UI side effects, fire-and-forget calls, optimistic updates, or native command wrappers: [.claude/rules/async-side-effect-policy.md](.claude/rules/async-side-effect-policy.md).
- Runtime schemas, DTO parsing, preferences schemas, or localStorage config schemas: [.claude/rules/schema-boundary.md](.claude/rules/schema-boundary.md).
- Refactor-time owner selection, helper extraction destinations, generated artifacts, UI copy, stable keys, and runtime capability ownership: [.claude/rules/boundary-ownership.md](.claude/rules/boundary-ownership.md).
- Boundary tests or TODO findings that should become durable coverage: [.claude/rules/contract-test-policy.md](.claude/rules/contract-test-policy.md).
- Preference schema/defaults, backend allowlist, settings copy, and shortcut preference parity: [.claude/rules/preferences-pattern.md](.claude/rules/preferences-pattern.md).
- TODO priority taxonomy, similarity false positives, React Compiler, ES2023 copy methods, or React Doctor suppression decisions: [.claude/rules/quality-policy.md](.claude/rules/quality-policy.md).
- Rust test `unwrap` / `expect` usage: [.claude/rules/rust-test-unwrap-policy.md](.claude/rules/rust-test-unwrap-policy.md).

## Task Tracking

- `TODO.md` tracks in-progress and upcoming work only.
- `CHANGELOG.md` records completed user-visible changes.
- Move finished TODO items into `CHANGELOG.md` once the work stabilizes.
- Classify new TODO entries as implementation, contract test, rule update, manual verification, or type placement cleanup.
- If the durable answer is a rule, update `CLAUDE.md` or `.claude/rules/` instead of growing `TODO.md`.
- React Doctor / Knip baselines live in `scripts/quality-baseline.ts`; similarity false-positive baselines live in `scripts/similarity-report.ts`. Update those constants only after running the matching pinned task and confirming expected drift.

## Native, Browser, And Skills

- macOS is the primary day-to-day development environment. Treat Windows as authoritative for native Windows runtime/build checks, and use `mise run check:wsl` when static-analysis stability is more important than exercising Windows shims.
- Browser-only UI checks use `mise run app:dev:browser` plus the `agent-browser` skill.
- Native desktop checks start from `mise run app:dev`; avoid duplicate app instances and operate the development app.
- For native Tauri inspection, prefer `tauri-mcp-server` for DOM/computed-style/webview interaction and Computer Use for visible window state.
- Use `tauri-dev-screenshot` for saved native-window PNG artifacts and `tauri-webview-geometry` for child webview sizing or pixel-ratio issues.
- Use the `tauri` skill when changing Tauri-facing code paths, especially filesystem and path handling from the webview.

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
