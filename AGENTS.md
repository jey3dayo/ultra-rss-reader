# AGENTS.md

## Overview

Use `./CLAUDE.md` as the master document for repository-local agent instructions.

## Instructions

- Read order for repository-local guidance: `AGENTS.md` -> `CLAUDE.md` -> linked documents from `CLAUDE.md`.
- Keep this file as a thin router only.
- Definition of Done quality checks follow the PR template quality gate checklist: run `mise run check`; for release, native, or Storybook impact, record `mise run ci` or a focused test in the PR verification notes.
- Put day-to-day agent guidance, coding standards, workflows, and project-rule links in `CLAUDE.md`.
- Put longer operational detail in skills, `README.md`, or `docs/`.
- Do not deviate from `CLAUDE.md` or the documents it routes to unless explicitly instructed.
