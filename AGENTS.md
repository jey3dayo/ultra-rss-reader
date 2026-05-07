# AGENTS.md

## Overview

Use `./CLAUDE.md` as the master document for repository-local agent instructions.

## Instructions

- Read order for repository-local guidance: `AGENTS.md` -> `CLAUDE.md` -> linked documents from `CLAUDE.md`.
- Keep this file as a thin router only.
- Put day-to-day agent guidance, coding standards, workflows, and project-rule links in `CLAUDE.md`.
- Put longer operational detail in skills, `README.md`, or `docs/`.
- For product, architecture, commands, and verification scope, use `README.md` as the source of truth after reading `CLAUDE.md`.
- If a configured external notification tool is unavailable in the current agent runtime, report that limitation instead of blocking the task.
- Do not deviate from `CLAUDE.md` or the documents it routes to unless explicitly instructed.
