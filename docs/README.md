# Documentation Index

Use this page as the entry point for repository documentation outside the main [README.md](../README.md).

## Top-Level Docs

- [../README.md](../README.md): current product overview, architecture, commands, and verification guidance
- [../CLAUDE.md](../CLAUDE.md): short agent-facing workflow guidance
- [../TODO.md](../TODO.md): active and upcoming tasks only
- [../CHANGELOG.md](../CHANGELOG.md): completed user-visible changes

## Operational Docs

- [release-manual-verification.md](./release-manual-verification.md): checklist for packaged builds, live-service verification, keyring validation, and updater checks before release
- [incident-runbook.md](./incident-runbook.md): shortest path to logs, backups, and failure-specific triage when the app is already failing
- [feed-content-privacy.md](./feed-content-privacy.md): source of truth for feed-content privacy expectations and the current CSP policy

## Project Guidance

- [../.claude/rules/README.md](../.claude/rules/README.md): topic-specific engineering rules for UI, Tauri, Rust, and release work

## Historical Design And Planning Records

- [superpowers/README.md](./superpowers/README.md): entry point for historical specs and plans
- `superpowers/specs/`: dated design documents created during feature exploration
- `superpowers/plans/`: dated implementation plans paired with individual feature work

These `superpowers/` documents are historical records, not the primary source of truth for current product behavior.
When the current behavior matters, prefer `README.md`, the operational docs above, and the relevant code.
