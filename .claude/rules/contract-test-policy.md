---
paths:
  - "src/**/*.{ts,tsx}"
  - "src-tauri/**/*.rs"
  - "src/__tests__/**/*.{ts,tsx}"
  - "tests/**/*.{ts,tsx}"
---

# Contract Test Policy

Contract tests should capture durable boundaries: runtime inputs, DTO shapes, pure helper invariants, command arguments, query keys, and cross-feature behavior that would be expensive to rediscover in UI tests.

## Rules

- Prefer a focused contract test when a TODO is about boundary behavior, not visual polish or a one-off implementation detail.
- Put tests near the owner of the contract:
  - `src/__tests__/api/` for Tauri command wrappers and frontend IPC schemas.
  - `src/__tests__/schemas/` for frontend-owned schemas and persisted local formats.
  - `src/__tests__/lib/` for pure helpers and cross-feature utilities.
  - `src/__tests__/hooks/` for hook lifecycle, async ordering, query keys, and runtime wrappers.
  - `src/__tests__/components/` for view contracts that require rendering.
  - `src/__tests__/config/` for repo, workflow, docs, and toolchain contracts.
- Keep contract tests narrow. Do not turn a boundary-value test into a broad UI snapshot or full workflow test unless the behavior truly crosses layers.
- Name the contract in the test title. Good titles include the boundary value and expected policy, such as "ignores stale badge updates after a newer request".
- Preserve intentional passthrough behavior with tests when rejecting invalid input would be a behavior change.
- If a contract requires manual desktop verification, keep the unit test for the narrow invariant and leave manual verification to the task or release checklist.

## TODO Intake

- Classify new TODO entries as one of: implementation, contract test, type placement cleanup, rule update, or manual verification.
- If the same kind of TODO appears across multiple modules, first consider a rule update under `.claude/rules/` instead of adding more duplicate TODOs.
- If the TODO is caused by old code not matching an existing rule, record it as cleanup/refactor, not as a new rule gap.
- If the TODO needs a product decision, say what decision is missing and avoid encoding one possible answer as the only implementation path.
- Finished TODOs should leave `TODO.md`; user-visible completed work goes to `CHANGELOG.md` when it stabilizes.

## Boundary Values Worth Testing

- Blank and whitespace-only identifiers or labels.
- Invalid, date-only, offset-less, future, or malformed datetime values.
- Negative, fractional, `NaN`, and `Infinity` numeric inputs.
- Unknown enum values, legacy enum values, and unknown passthrough keys.
- Duplicate identity keys in maps, lists, and projection helpers.
- Throwing `toString`, malformed event payloads, rejected promises, and unavailable runtime APIs.
- Stale async completions after newer user intent, unmount, close, or cleanup.
