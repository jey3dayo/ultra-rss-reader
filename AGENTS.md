# AGENTS.md

## Overview

Follow the rules defined in CLAUDE.md.

## Instructions

- Always refer to ./CLAUDE.md for coding standards and workflows.
- For UI implementation, always consult `./DESIGN.md` first for visual rules and reusable design decisions.
- For UI review and abstraction decisions (`DESIGN.md` vs `shared` vs feature-local), follow `./DESIGN_REVIEW.md`.
- Keep this file as a thin router; put short day-to-day development guidance in `CLAUDE.md`.
- Put longer debugging, recovery, or diagnostic workflows in skills or `README.md` / `docs/`, not here.
- In Codex app sessions, when asking the user to choose among a small fixed set of options or confirm a decision, prefer the app's wizard/button selection UI over free-form text whenever possible. For prompts like `A/B`, `yes/no`, or short enumerated decisions, offer clickable choices first; if that UI is unavailable, fall back to a numbered list or `y/n` reply that can be answered with minimal typing.
- Do not deviate from the rules unless explicitly instructed.
