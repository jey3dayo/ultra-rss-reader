# Ultra RSS Reader

Use [README.md](README.md) as the primary source of truth for product overview, architecture, development modes, and command details.
This file stays intentionally short and focuses on agent-facing workflow guidance.

## First Actions

- Run `mise run check` before committing; this is the default Codex/day-to-day local verification gate.
- Use `mise run ci` when you need the unit-first full repository gate including build validation.
- Use `mise run quality:react-doctor:diff` as the local React Doctor regression gate for changed files. It pins `react-doctor@0.1.4` and fails on score, error, warning, affected-file, or tool-version drift from the checked-in baseline.
- Use `mise run quality:react-doctor:full` as an informational full-codebase React Doctor report. It shares the pinned version but does not fail the task on known full-scan baseline debt.
- Use `mise run quality:knip` for Knip baseline drift checks. It pins `knip@6.12.2` and fails when the known issue/finding counts change.
- Use `mise run report:similarity` for the similarity-ts TODO baseline report. Read thresholds as 0.95 for near-copy candidates, 0.9 for TODO triage, and 0.87 for broad discovery; raise `--min-lines` / `--min-tokens` before extracting helpers from tiny callback-shape matches.
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
- When touching browser APIs, Tauri runtime APIs, storage, platform globals, or other runtime boundaries, follow [.claude/rules/runtime-boundary.md](.claude/rules/runtime-boundary.md).
- When adding async UI side effects, fire-and-forget calls, optimistic updates, or native command wrappers, follow [.claude/rules/async-side-effect-policy.md](.claude/rules/async-side-effect-policy.md).
- When adding or changing runtime schemas, DTO parsing, preferences schemas, or localStorage config schemas, follow [.claude/rules/schema-boundary.md](.claude/rules/schema-boundary.md).
- When adding boundary tests or turning TODO findings into durable coverage, follow [.claude/rules/contract-test-policy.md](.claude/rules/contract-test-policy.md).
- For TODO priority taxonomy, similarity false positives, React Compiler adoption, ES2023 array copy methods, or React Doctor suppression decisions, follow [.claude/rules/quality-policy.md](.claude/rules/quality-policy.md).
- For Rust test `unwrap` / `expect` usage, classify call sites as fixture boundary or production behavior boundary using [.claude/rules/rust-test-unwrap-policy.md](.claude/rules/rust-test-unwrap-policy.md).

## File Placement

- Follow the Repository Structure section in [.claude/rules/README.md](.claude/rules/README.md) before moving code or creating new shared surfaces.
- Treat `src-tauri/gen/schemas/` as generated Tauri capability schema output, not source. Do not hand-edit files there; change `src-tauri/capabilities/` or the owning Tauri permission/config source, rerun the Tauri CLI command that generated the schema drift, and review the resulting schema diff as generated output before committing.
- Do not keep `.types.ts` files as dumping grounds for view-local props or hook-internal params/results. When a type is only consumed by one component or one hook, co-locate it in that file; keep `.types.ts` for contracts shared across views, hooks, stories, tests, stores, or runtime boundaries.
- Do not move React props or hook params/results to `src/schemas/` unless they validate runtime input. Schemas are for runtime validation boundaries; component and hook types are compile-time contracts.
- When extracting component-local pure helpers to `src/lib/`, move only logic that is React-free, UI-copy-free, store-free, and Tauri-command-free.
- Keep hooks, toast execution, store access, listener lifecycle, optimistic updates, component props, and view labels in the owning feature.
- Prefer compatibility re-exports from the old feature module when tests, mocks, or nearby components still import that public surface.
- For RTK command guidance, follow [RTK.md](RTK.md); put day-to-day project rules in `.claude/rules/`.

## Type Surface Policy

- Prefer `type` aliases for object shapes, unions, mapped types, and component or hook contracts. Use `interface` only when declaration merging or external augmentation is required, such as `ImportMetaEnv`, `Window`, or library module augmentation.
- Keep `Props`, `Params`, and `Result` names tied to their owner: component view props in the component file unless imported by multiple runtime consumers, hook params/results next to the hook unless shared across hooks/controllers, and cross-feature domain contracts in `src/lib/**/*.types.ts`.
- Derive DTO and runtime-boundary types from schemas with `z.output` / `z.infer` or from the Tauri command wrapper source of truth. Do not duplicate schema shapes as hand-written React or store types unless the view model intentionally differs.
- Treat `as` assertions as boundary code only. Prefer `unknown` plus narrowing, schema parsing, `satisfies`, or small typed helpers; keep unavoidable assertions in test/runtime adapter helpers where the proof is local.
- Use `.types.ts` files for shared contracts, not for convenience exports. If a type has one runtime consumer, localize it during nearby refactors instead of adding another exported surface.

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
- Classify new TODO entries as implementation, contract test, rule update, manual verification, or type placement cleanup. If the durable answer is a rule, update `CLAUDE.md` or `.claude/rules/` instead of growing `TODO.md`.
- Before adding risk TODOs, first check whether the finding belongs in an existing tranche, domain shard, supersedes merge, or focused verification update; keep duplicate and undiscoverable concerns out of `TODO.md`.
- Use the P0/P1/P2/P3 taxonomy in [.claude/rules/quality-policy.md](.claude/rules/quality-policy.md) when adding or triaging TODO entries.
- React Doctor / Knip baselines live in `scripts/quality-baseline.ts`; similarity false-positive baselines live in `scripts/similarity-report.ts`. Update those constants only after running the matching pinned task, reviewing whether the drift is expected, and keeping the tool versions pinned in `package.json` / `pnpm-lock.yaml`. Test `@latest` versions outside the baseline tasks.

## Localization Notes

- Japanese UI copy lives in `src/locales/ja/`.
- Prefer short labels for controls, tabs, and dense lists.
- Avoid repeating context already implied by the current page or category.
- Keep technical terms only when they help debugging or match the product surface.
- Run focused locale/copy tests after changing labels, then use `mise run check` before finishing.

## Preference Allowlist

- When adding a preference, update `src/schemas/preferences.ts` schema/defaults, the Rust backend allowlist, settings UI/locale copy, and focused parity tests in the same change.
- `selected_account_id` is backend/runtime-owned and must not be exposed as a visible settings default.
- Shortcut preference keys are generated as `shortcut_${id}` from the shortcut definition ids and must stay aligned with Rust shortcut allowlist entries.
- The generated preference allowlist table lives in [.claude/rules/preferences-pattern.md](.claude/rules/preferences-pattern.md) and is covered by the preference schema contract test.

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
- [.claude/rules/runtime-boundary.md](.claude/rules/runtime-boundary.md): runtime API boundary handling and focused fallback tests
- [.claude/rules/async-side-effect-policy.md](.claude/rules/async-side-effect-policy.md): async side effects, latest-only ordering, cleanup, and rejection surface
- [.claude/rules/schema-boundary.md](.claude/rules/schema-boundary.md): schema strictness, DTO trust boundaries, and fallback ownership
- [.claude/rules/contract-test-policy.md](.claude/rules/contract-test-policy.md): contract test placement, TODO intake, and durable regression coverage
- [.claude/rules/quality-policy.md](.claude/rules/quality-policy.md): TODO priority taxonomy, similarity false positives, React Compiler opt-in, ES2023 array copy methods, and React Doctor warning suppression policy
- [.claude/rules/rust-test-unwrap-policy.md](.claude/rules/rust-test-unwrap-policy.md): Rust test unwrap/expect classification for fixture and production behavior boundaries

## Agent Routing

- `AGENTS.md` is only the thin entry point for agents that read it first.
- Keep repository-local operating guidance centralized in this file.
- Put longer debugging, recovery, or diagnostic workflows in skills or `README.md` / `docs/`, not in `AGENTS.md`.

## MCP and Skills

- Browser-only UI checks: use `mise run app:dev:browser` plus the `agent-browser` skill.
- Native desktop checks: start from `mise run app:dev`, avoid duplicate app instances, and operate the development app rather than a packaged or release build.
- For native Tauri inspection, prefer `tauri-mcp-server` for DOM/computed-style/webview interaction and Computer Use for visible window state.
- Use `tauri-dev-screenshot` for saved native-window PNG artifacts, and `tauri-webview-geometry` for child webview sizing or pixel-ratio issues.
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
