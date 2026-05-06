# RTK - Rust Token Killer (Codex CLI)

Usage: Token-optimized CLI proxy for shell commands.

## Rule

Prefer `rtk` for noisy external commands. This repository already declares
`rtk` in `mise.toml`, and many non-Windows check, lint, and test tasks use RTK
wrappers there.

Examples:

    rtk git status
    rtk cargo test
    rtk pnpm run build
    rtk test pnpm run test
    rtk err cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

## Repository Policy

- Prefer repository tasks such as `mise run check`, `mise run ci`, and focused
  `mise run ...` commands over ad-hoc command sequences.
- For noisy external commands run manually, prefer `rtk <command>` or the
  command family used in `mise.toml`, such as `rtk err ...` for error-focused
  checks and `rtk test ...` for test runners.
- Keep shell builtins and shell-state changes raw. Examples include changing
  directories, setting environment variables for the current shell, and tiny
  one-line inspections.
- If RTK output hides details needed for debugging, rerun the command with
  `rtk proxy <command>` or run the raw command and report why.
- Do not add or tune `.rtk/filters.toml` unless a repeated project-specific
  noise pattern is proven safe to filter.

## Meta Commands

    rtk gain            # Token savings analytics
    rtk gain --history  # Recent command savings history
    rtk proxy <cmd>     # Run raw command without filtering

## Verification

    rtk --version
    rtk gain
    where rtk

## Current Repository Notes

- `mise.toml` is the source of truth for tool versions and task commands.
- `CLAUDE.md` remains the source of truth for repository-local agent workflow.
- Missing RTK must not block a task: use the raw command, keep the output
  focused, and mention the fallback in the final report.
