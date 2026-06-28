# Documentation Index

Use this page as the documentation index outside the main [README.md](../README.md).
When current product behavior, architecture, commands, or verification scope matters, start with `README.md` first and use this page to find focused operational or historical documents.

## Top-Level Docs

- [../README.md](../README.md): source of truth for product overview, architecture, development modes, commands, and verification model
- [../CLAUDE.md](../CLAUDE.md): short repository-local agent workflow, quality gates, and rule routing
- [../AGENTS.md](../AGENTS.md): thin entry point for agents that read it before repository-local guidance
- [../llms.txt](../llms.txt): compressed LLM-oriented map of sources, constraints, and main code areas
- [../TODO.md](../TODO.md): active and upcoming work only
- [../CHANGELOG.md](../CHANGELOG.md): completed user-visible changes

## Documentation Routing

- Unknown operational or historical document: start here.
- Product overview, architecture, command details, development modes, verification matrix, and release summary: [../README.md](../README.md).
- Agent workflow, quality gate selection, and rule routing: [../CLAUDE.md](../CLAUDE.md).
- Packaged builds, updater checks, live-service checks, release provenance, and release sign-off: [release-manual-verification.md](./release-manual-verification.md).
- Logs, backups, recovery, updater, keyring, and sync triage: [incident-runbook.md](./incident-runbook.md).
- Native dev app process capture, screenshots, key input, and Debug HUD verification: [native-dev-verification.md](./native-dev-verification.md).
- Remote article content privacy and CSP policy: [feed-content-privacy.md](./feed-content-privacy.md).
- Reader article source, scope, filter, hook, and paging order: [reader-article-scope-matrix.md](./reader-article-scope-matrix.md).
- Reader pane keyboard navigation, focus return, and focus styling contracts: [reader-keyboard-navigation.md](./reader-keyboard-navigation.md).
- Dated design and implementation records: [superpowers/README.md](./superpowers/README.md).

## Operational Docs

- [release-manual-verification.md](./release-manual-verification.md): checklist for packaged builds, live-service verification, keyring validation, and updater checks before release
- [incident-runbook.md](./incident-runbook.md): shortest path to logs, backups, and failure-specific triage when the app is already failing
- [native-dev-verification.md](./native-dev-verification.md): runbook for Tauri dev app process capture, window screenshots, keyboard input, and Debug HUD checks
- [feed-content-privacy.md](./feed-content-privacy.md): source of truth for feed-content privacy expectations and the current CSP policy
- [reader-keyboard-navigation.md](./reader-keyboard-navigation.md): source of truth for reader pane keyboard navigation, focus return behavior, and focus styling contracts
- [reader-article-scope-matrix.md](./reader-article-scope-matrix.md): source of truth for reader article source, scope, and filter combinations
- [flaky-test-quarantine-policy.md](./flaky-test-quarantine-policy.md): policy for quarantining, documenting, and retiring flaky tests
- [similarity-refactor-guidance.md](./similarity-refactor-guidance.md): guidance for interpreting similarity reports before extracting shared code

## Project Guidance

- [../.claude/rules/README.md](../.claude/rules/README.md): topic-specific engineering rules for UI, Tauri, Rust, and release work
- [../.claude/rules/boundary-ownership.md](../.claude/rules/boundary-ownership.md): owner routing for refactors, helper extraction, generated artifacts, UI copy, stable keys, and runtime capability boundaries

## Quality And Reproducibility Contracts

- Toolchain drift: `mise run quality:toolchain` is the local contract for Node and pnpm version parity across `package.json` `engines`, `packageManager`, and `mise.toml` `[tools]`.
- Dependency license inventory: `mise run report:licenses` writes pnpm and Cargo license reports to `tmp/dependency-licenses/`. Review `pnpm-licenses.json` and `cargo-licenses.json` for unknown, missing, or dual-license entries before release or store-distribution review.
- Release provenance checklist: [release-manual-verification.md](./release-manual-verification.md) records the release tag SHA, source commit, workflow run, artifact checksum sidecars, updater signatures, SBOM or dependency provenance record, and dev-only contamination gate evidence for packaged releases.
- Bundled app icon provenance: `assets/app-icon.png` is the checked-in raster design master, `assets/app-icon-tauri-source.png` is the checked-in Tauri source image that preserves the intended rounded-card presentation at 1024x1024, and `mise run app:icon` / `pnpm exec tauri icon assets/app-icon-tauri-source.png` regenerates the platform-specific PNG, ICO, and ICNS outputs. Treat those PNG files as the icon source of truth unless the product icon is intentionally redesigned. The current bundled app icon set is project-owned artwork with no third-party attribution requirement. If a third-party or externally generated source asset is introduced, add the source URL, license, and attribution note here before release review.
- TODO triage export: `scripts/todo-triage.ts` parses `TODO.md` into priority, implementation order, domain bucket, target files, focused verification, duplicate groups, worker issue Markdown/JSON, and domain-owner shard plans. Use the `json`, `duplicates`, `shards`, `export-json`, or `export-md` command before splitting risk TODOs into issues or worker prompts.
- Markdown lint scope: `mise run quality:markdownlint-contract` fixes the markdownlint glob and ignore pattern contract from `mise.toml`, including `node_modules`, `.worktrees`, `target`, and generated Tauri schema output.
- Test isolation policy:
  - Frontend suites must be safe to run in parallel unless the file explicitly documents a serial-only reason. Tests that touch `localStorage`, `sessionStorage`, clipboard, `window` globals, fake timers, observers, or singleton stores must restore them in `afterEach` and must not depend on file execution order.
  - Date fixtures must use a frozen clock plus relative offsets when the expected behavior depends on "now", recency, age, or ordering across days. Literal ISO strings are allowed only for static schema validity fixtures where wall-clock age is irrelevant.
  - Rust integration tests must use per-test temporary directories, databases, keyring namespaces, and environment-variable guards. Shared process state such as `OnceLock`, current directory, environment variables, ports, and global logging must either be immutable after setup or protected by a serial guard with a comment that names the shared surface.
  - Test helpers may centralize setup and cleanup, but hidden mutation is still owned by the calling suite. A helper that changes global state must expose an explicit reset or guard contract and have focused coverage for two consecutive test runs.
  - Suite boundaries own process-wide runtime cleanup for `process.env`, `localStorage`, `sessionStorage`, fake timers, Tauri IPC mocks, observer globals, and singleton diagnostics reporters. Helpers that mutate global runtime state must expose an explicit reset or rely on the shared suite teardown, with focused coverage for two consecutive test runs.
- Schema and query-cache contracts:
  - Schema parse failure fallbacks must not enable destructive, write, or navigation actions. Use a disabled action state with the parse-failure reason until the owner has validated fresh data.
  - Schema-owned query caches that can survive an app version upgrade must include a schema or query-key version segment. Bump the version when DTO shape, semantic defaults, or cache ownership changes would make old cache entries unsafe to reuse.
  - Generated schema drift becomes a failing gate when a generated or schema-backed command argument, DTO field, Rust command name, or safeInvoke argument boundary changes without the matching frontend schema contract update. Review comments are enough only for non-runtime docs or naming notes that do not affect parsed data.
- Reproducibility audit policy:
  - `mise run check` must not depend on local app state, live service credentials, OS keyring contents, running dev servers, untracked generated artifacts, local ports, or files under `tmp/`. Put those checks behind manual, live, or report tasks and document the required state at the task boundary.
- Failure artifact retention:
  - Frontend failures should retain the smallest useful UI evidence: Vitest logs, Playwright screenshots/videos/traces, console output, and the matching `test-results/*` or `playwright-report/*` directory for the gate that failed.
  - Rust failures should retain Rust test output, `RUST_LOG` output when enabled, redacted temp database paths or fixture class names, and cleanup diagnostics for leftover temp directories. Do not upload raw user-like database fixtures unless the fixture is already sanitized and intentionally checked in.
  - Native smoke failures should retain packaged/native app logs, platform name, app bundle or executable class, screenshots when relevant, and redacted database backup or temp profile class only when it proves the failure. Native debug app/log artifacts should be uploaded on failure only and kept out of successful runs.
  - Retention days must be explicit per artifact class in CI before upload is added. Use short retention for screenshots/logs from routine frontend gates, medium retention for Rust failure diagnostics, and release-triage retention only for native smoke or packaging failures that block a release.
- Dependency update smoke classification:
  - Runtime dependencies affect shipped code or native behavior. React Query updates require query-cache and invalidation smoke focused on stale data, optimistic updates, and refetch ordering; Zustand updates require store-selector and equality smoke focused on unnecessary rerenders, persisted preference writes, and selection state; Tauri updates require IPC/runtime smoke focused on command invocation, event listeners, updater behavior, keyring, file paths, and window APIs.
  - Build-only dependencies affect compilation, bundling, packaging, or generated assets without shipping as runtime code. Vite updates require dev-server/build smoke focused on `mise run app:dev:browser`, frontend build output, HMR assumptions, and test runner behavior; Storybook/Tailwind/build plugin updates require the owning build or Storybook gate.
  - Dev-only dependencies affect lint, format, reports, or local-only tooling. Use the owning quality task and baseline drift test; promote to build-only when the tool is also used during build, test, or release.
  - Transitive-risk updates are indirect dependency changes that alter lockfile-resolved runtime, build, native, security-sensitive, or parser packages. Classify by the highest-impact affected parent and run that smoke even when `package.json` did not change.

## Historical Design And Planning Records

- [superpowers/README.md](./superpowers/README.md): entry point for historical specs and plans
- `superpowers/specs/`: dated design documents created during feature exploration
- `superpowers/plans/`: dated implementation plans paired with individual feature work

These `superpowers/` documents are historical records, not the primary source of truth for current product behavior.
When the current behavior matters, prefer `README.md`, the operational docs above, and the relevant code.
