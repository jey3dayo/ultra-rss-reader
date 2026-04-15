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

Do not use this document as a replacement for `DESIGN.md`. If the question is about color, typography, spacing, component appearance, or layout principles, read `DESIGN.md` first.

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

Do not promote a component into `shared` only because it looks similar.

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

## Escalation

If the direction is unclear:

- use `design-md-review` to evaluate `DESIGN.md`
- request `ui-ux-pro-max` review when visual or UX judgment is still ambiguous

## Notes

- Prefer the smallest fix that increases reuse.
- Keep design specs and review operations separate.
- If a local exception is intentional, document the reason in review output.
