# Superpowers Records

This directory stores dated design and implementation records created during feature work.

## What Lives Here

- `specs/`: design exploration documents, usually written before implementation
- `plans/`: implementation plans and execution records paired with specific work items

## How To Read These Files

- Treat them as historical context, not as the current source of truth.
- Prefer [../../README.md](../../README.md), [../README.md](../README.md), and the code when you need the current product behavior.
- Use these records when you want decision history, implementation rationale, or the original rollout sequence for a feature.

## Notes On Command References

Some older records refer to direct commands such as `pnpm tauri dev` or `pnpm dev`.
For current day-to-day work in this repository, prefer the equivalent `mise` tasks from [../../README.md](../../README.md):

- `pnpm tauri dev` → `mise run app:dev`
- `pnpm dev --host 127.0.0.1 --port 4173 --strictPort` → `mise run app:dev:browser`

The historical command text is kept as-is inside the dated records unless there is a specific reason to rewrite that document.
