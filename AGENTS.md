# AGENTS.md

## Overview

Use `./CLAUDE.md` as the master document for repository-local agent instructions.

## Instructions

- Read order for repository-local guidance: `AGENTS.md` -> `CLAUDE.md` -> linked documents from `CLAUDE.md`.
- Keep this file as a thin router only.
- Definition of Done quality checks follow the PR template quality gate checklist: run `mise run check`;
  when formatter/linter stability or macOS/Linux/WSL parity matters, also run `mise run check:linux-static`;
  for jsdom, DOM, React rendering, PR handoff, release, native, or Storybook impact,
  record `mise run test:unit:dom`, `mise run ci`, or a focused test in the PR verification notes.
- Put day-to-day agent guidance, coding standards, workflows, and project-rule links in `CLAUDE.md`.
- Put longer operational detail in skills, `README.md`, or `docs/`.
- For product, architecture, commands, and verification scope,
  use `README.md` as the source of truth after reading `CLAUDE.md`.
- If a configured external notification tool is unavailable in the current agent runtime, report that limitation instead of blocking the task.
- Do not deviate from `CLAUDE.md` or the documents it routes to unless explicitly instructed.
