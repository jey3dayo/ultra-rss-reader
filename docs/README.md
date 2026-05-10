# Documentation Index

Use this page as the entry point for repository documentation outside the main [README.md](../README.md).

## Top-Level Docs

- [../README.md](../README.md): current product overview, architecture, commands, and verification guidance
- [../CLAUDE.md](../CLAUDE.md): short agent-facing workflow guidance
- [../RTK.md](../RTK.md): repository command execution policy and RTK usage guidance
- [../TODO.md](../TODO.md): active and upcoming tasks only
- [../CHANGELOG.md](../CHANGELOG.md): completed user-visible changes

## Operational Docs

- [release-manual-verification.md](./release-manual-verification.md): checklist for packaged builds, live-service verification, keyring validation, and updater checks before release
- [incident-runbook.md](./incident-runbook.md): shortest path to logs, backups, and failure-specific triage when the app is already failing
- [feed-content-privacy.md](./feed-content-privacy.md): source of truth for feed-content privacy expectations and the current CSP policy
- [reader-keyboard-navigation.md](./reader-keyboard-navigation.md): source of truth for reader pane keyboard navigation, focus return behavior, and focus styling contracts
- [reader-article-scope-matrix.md](./reader-article-scope-matrix.md): source of truth for reader article source, scope, and filter combinations

## Project Guidance

- [../.claude/rules/README.md](../.claude/rules/README.md): topic-specific engineering rules for UI, Tauri, Rust, and release work

## Quality And Reproducibility Contracts

- Toolchain drift: `mise run quality:toolchain` is the local contract for Node and pnpm version parity across `package.json` `engines`, `packageManager`, and `mise.toml` `[tools]`.
- Dependency license inventory: `mise run report:licenses` writes pnpm and Cargo license reports to `tmp/dependency-licenses/`. Review `pnpm-licenses.json` and `cargo-licenses.json` for unknown, missing, or dual-license entries before release or store-distribution review.
- TODO triage export: `scripts/todo-triage.ts` parses `TODO.md` into priority, implementation order, domain bucket, target files, focused verification, duplicate groups, worker issue Markdown/JSON, and domain-owner shard plans. Use the `json`, `duplicates`, `shards`, `export-json`, or `export-md` command before splitting risk TODOs into issues or worker prompts.
- Markdown lint scope: `mise run quality:markdownlint-contract` fixes the markdownlint target contract at 158 Markdown files and the ignore patterns from `mise.toml`: `node_modules`, `.worktrees`, and `target`. If the count intentionally changes, update the task and this note in the same change.
- Dependency update smoke classification:
  - React Query updates require query-cache and invalidation smoke focused on stale data, optimistic updates, and refetch ordering.
  - Zustand updates require store-selector and equality smoke focused on unnecessary rerenders, persisted preference writes, and selection state.
  - Tauri updates require IPC/runtime smoke focused on command invocation, event listeners, updater behavior, keyring, file paths, and window APIs.
  - Vite updates require dev-server/build smoke focused on `mise run app:dev:browser`, frontend build output, HMR assumptions, and test runner behavior.
  - Pure dev-tool updates can use the owning quality task, but runtime, build, and test-runner updates need the matching smoke noted above.

## Historical Design And Planning Records

- [superpowers/README.md](./superpowers/README.md): entry point for historical specs and plans
- `superpowers/specs/`: dated design documents created during feature exploration
- `superpowers/plans/`: dated implementation plans paired with individual feature work

These `superpowers/` documents are historical records, not the primary source of truth for current product behavior.
When the current behavior matters, prefer `README.md`, the operational docs above, and the relevant code.
