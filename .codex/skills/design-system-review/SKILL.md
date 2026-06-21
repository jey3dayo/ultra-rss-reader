---
name: design-system-review
description: Review Ultra RSS Reader UI changes for design-system compliance, reusable component routing, token usage, and interaction consistency.
---

# Design System Review

Use this skill after UI or component changes in Ultra RSS Reader.

## Review Inputs

1. Read `AGENTS.md`, `CLAUDE.md`, `DESIGN.md`, and `DESIGN_REVIEW.md`.
2. Inspect the diff for files under `src/design-system`, `src/components`, `src/styles`, Storybook canvases, and UI tests.
3. Treat `src/design-system/index.ts` as the public component-library API.

## Checklist

- Public UI imports in feature, app, Storybook, and test code go through `@/design-system`.
- `src/components/ui` and `src/components/shared` stay implementation owners for primitives and shared building blocks.
- Repeated controls, rows, chips, shell surfaces, toolbar actions, empty states, and progress/status patterns use design-system exports instead of feature-local clones.
- New colors, radius choices, shadows, motion timings, and semantic state styles use `src/styles/global.css` tokens or documented exception palettes.
- Button, utility action, form row, shell, dialog, list, and navigation behavior follows `DESIGN.md`.
- Keyboard focus, `aria-*` state, disabled behavior, tooltips, and loading/status labels stay intact after refactors.
- Storybook UI Reference canvases continue to represent the shared components rather than feature-only copies.

## Verification

Run the narrowest relevant checks first, then the repository gate before completion:

```bash
mise run test:unit:dom
mise run test:e2e
mise run check
```

For browser-visible changes, also run `mise run app:dev:browser` and exercise the reader, settings modal, command palette, and subscriptions workspace with click and keyboard flows.

## Report Format

```markdown
総合判定: OK | 調整推奨 | 大幅修正推奨

- Design-system routing: OK | 要修正
- Token usage: OK | 要修正
- Component reuse: OK | 要修正
- Interaction/a11y: OK | 要修正
- Storybook/tests: OK | 要修正

優先修正:
1. ...
2. ...
3. ...
```
