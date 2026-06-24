# DESIGN_REVIEW.md

## Purpose

This document defines how to review UI and decide where design changes should live.

- [DESIGN.md](./DESIGN.md) is the visual source of truth.
- `DESIGN_REVIEW.md` is the operational guide for review, routing, and escalation.
- Keep visual rules in `DESIGN.md`. Keep review process and decision rules here.

## Scope

Use this document when:

- reviewing UI consistency or polish
- deciding whether a problem belongs in `DESIGN.md`
- deciding whether a fix should live in `shared`
- deciding whether a fix should stay feature-local
- reviewing settings-form alignment, control placement, or radius consistency

Do not use this document as a replacement for `DESIGN.md`. If the question is about color, typography, spacing, component appearance, or layout principles, read `DESIGN.md` first.
After reading `DESIGN.md`, consult the Storybook UI Reference catalog in this order before introducing new UI patterns:

1. `UI Reference / Input Controls Canvas`
2. `UI Reference / Button Controls Canvas`
3. `UI Reference / Shell & Overlay Canvas`
4. `UI Reference / View Specimens Canvas`

Routing rules:

- `@/design-system` is the public UI API for app, feature, Storybook, and test code
- `src/components/ui` owns primitive wrappers around headless UI dependencies
- `src/components/shared` owns reusable app-specific building blocks
- feature code should import shared UI through `@/design-system` instead of reaching into `src/components/ui` or `src/components/shared`
- form rows, validation, and disabled states go in `Input Controls Canvas`
- button variants, decision/delete/form actions, settings actions, and utility icon action strips go in `Button Controls Canvas`
- settings-form row behavior, control rail alignment, and shared radius rules belong in `shared` once they repeat
- app-level outer frames, dialog shells, and menu shells go in `Shell & Overlay Canvas`
- runtime chrome frames and overlay surfaces belong in `Shell & Overlay Canvas`; their compact action buttons should still be checked against `Button Controls Canvas`
- feature-local display fragments and density specimens go in `View Specimens Canvas`
- do not mix shell examples into section or form reference surfaces
- when adjusting radius in these reference canvases, prefer shared scale utilities such as `rounded-md` through `rounded-2xl` instead of pixel literals
- feature-local exceptions to shared form-row behavior require explicit review justification

## Review Flow

When a design concern appears, resolve it in this order:

1. `DESIGN.md`
2. `shared`
3. feature-local components

### 1. `DESIGN.md`

Update `DESIGN.md` first when the issue comes from:

- missing design guidance
- weak or ambiguous design language
- contradictory rules
- repeated one-off decisions appearing across multiple screens

### 2. `shared`

Promote a fix into `shared` only when all of these are true:

- the semantic role is the same
- the state model is the same
- the accessibility behavior is the same
- the pattern is repeated or clearly reusable
- the row alignment rule or radius rule should stay consistent across multiple settings surfaces
- compact utility-action chrome keeps the same borderless resting state, focus treatment, and tonal selected treatment across screens
- compact ghost utility actions that share the same semantic role and state model should reuse the same shared interaction class or shared primitive for hover, focus, active, disabled, and pressed behavior
- button families can preserve their semantic role names instead of collapsing into a generic `Button`

Do not promote a component into `shared` only because it looks similar.
Do not fold form buttons, primary CTAs, or label-led action buttons into the compact utility-action family just because they share an icon.

### 3. Feature-local components

Keep a fix local when it depends on:

- screen-specific information architecture
- content-specific hierarchy
- feature workflow or domain behavior
- an intentional exception that should not spread

## Review Format

Use the `design-md-review` format unless the user asks for something else.

```markdown
総合判定: OK | 調整推奨 | 大幅修正推奨

- 構造: OK | 要修正 | 不足
  理由: ...
- 雰囲気記述: OK | 要修正 | 不足
  理由: ...
- 色: OK | 要修正 | 不足
  理由: ...
- タイポグラフィ: OK | 要修正 | 不足
  理由: ...
- コンポーネント: OK | 要修正 | 不足
  理由: ...
- レイアウト: OK | 要修正 | 不足
  理由: ...
- Stitch再利用性: OK | 要修正 | 不足
  理由: ...

優先修正:

1. ...
2. ...
3. ...
```

## Review Criteria

Prioritize these questions during review:

1. Is the issue caused by missing or weak design guidance?
2. Is the pattern truly reusable across features?
3. Would shared extraction reduce duplication without weakening semantics?
4. Is the current component a valid local exception?
5. Will the result remain reusable for Stitch or agent-driven UI generation?

### Settings Form Checklist

When reviewing settings rows or input-control specimens, check these before suggesting a new pattern:

- label column is stable
- control column is stable
- controls resolve against one shared right-column endpoint
- shared primitives use approved Tailwind radius tokens only
- compact controls do not invent one-off placement
- explanatory or safety copy is integrated into the settings row-group rhythm instead of becoming a centered prose block between controls
- `DESIGN.md` and `UI Reference / Input Controls Canvas` were checked before proposing a feature-local fix

### Runtime Chrome Checklist

When reviewing browser previews, embedded WebView surfaces, or app-shell chrome, separate browser-mode evidence from native Tauri evidence before judging platform-specific layout:

- browser-mode screenshots can validate React layout, density, and visual rhythm, but not native child-webview bounds or desktop titlebar behavior
- browser-mode mocks must not reserve macOS traffic-light, titlebar, or platform-safe insets unless the real native runtime is active
- native Tauri checks own child-webview bounds, logical-vs-physical pixel behavior, platform titlebar reserves, and OS-specific window chrome
- header height, close/action button centering, and overlay rail density should stay app-owned and visually consistent across browser preview, macOS, and Windows unless a native platform constraint requires an explicit exception
- if browser-mode and native Tauri disagree, inspect the overlay root, host rect, and native bounds contract before adding local padding or per-platform offsets

### Utility Action Checklist

When reviewing compact icon-only action strips, check semantic state and visual emphasis separately:

- `aria-pressed` or equivalent state may be required for accessibility, but it should not automatically create a filled selected surface
- baseline states such as read, default, or closed should stay visually quiet unless the product meaning requires emphasis
- semantic states such as starred or unread may use tokenized icon tint or a quiet tonal surface, but avoid making every state look equally selected
- keyboard focus must remain visible even when the pressed surface is intentionally transparent
- hover, focus, active, disabled, and pressed behavior should come from a shared utility-action primitive or shared interaction class when the controls perform the same kind of action
- compare sidebar header, reader header, article toolbar, and browser-overlay action strips in `UI Reference / Button Controls Canvas` before adding a local button style

## Escalation

If the direction is unclear:

- use `design-md-review` to evaluate `DESIGN.md`
- request `ui-ux-pro-max` review when visual or UX judgment is still ambiguous

## Notes

- Prefer the smallest fix that increases reuse.
- Keep design specs and review operations separate.
- If a local exception is intentional, document the reason in review output.
- If a motion rule affects multiple screens or shell-level behavior, document it in `DESIGN.md` instead of leaving it feature-local.
- If a settings-form issue appears in multiple rows or multiple settings pages, treat it as a `DESIGN.md` plus `shared` concern before considering feature-local overrides.
- If a passive card or empty state looks visually low in a tall pane, treat optical-centering compensation as a reusable layout rule. Put the rule in `DESIGN.md` and keep the implementation in shared or repeated shell-level components instead of scattering per-screen nudges.
