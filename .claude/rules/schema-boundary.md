---
paths:
  - "src/**/*.{ts,tsx}"
  - "src-tauri/**/*.rs"
---

# Schema Boundary

Schemas are runtime contracts, not just type generators. When adding or changing a schema, decide whether the boundary rejects invalid input, normalizes it, or passes it through to a narrower owner.

## Rules

- Keep Tauri IPC request and response schemas in `src/api/schemas/`.
- Keep frontend-owned schemas for preferences, localStorage, app config, and other non-IPC runtime data in `src/schemas/`.
- Derive boundary types from schemas with `z.output` / `z.infer` or the command wrapper source of truth.
- Do not duplicate DTO shapes as hand-written view/store types unless the UI model intentionally differs.
- For each schema, decide whether it is a trusted backend DTO, a frontend guard, a local persisted format, or a view-model normalization boundary.
- Be explicit about blank strings, whitespace-only strings, nonfinite numbers, negative counts, invalid dates, unknown enum values, duplicate identities, and unknown passthrough keys.
- Keep user-facing fallback copy outside schema files unless the schema itself owns the user-visible result.

## Test Expectations

- Add contract tests for boundary values when a schema feeds shared helpers, stores, or cross-feature UI.
- For DTO schemas, include at least one invalid shape that the backend should never send when the frontend relies on that invariant.
- For preferences and local persisted state, test unknown or legacy values separately from malformed values.
- For view models intentionally different from DTOs, test the DTO-to-view mapping instead of weakening the DTO schema.

## Examples

- A nullable count schema should define whether `null`, negative, fractional, `NaN`, and `Infinity` are rejected or normalized.
- A datetime field should define whether date-only, offset-less, malformed, and future values are accepted at the schema or handled by a formatter.
- Preferences may preserve unknown backend passthrough keys, but known keys and shortcut keys should have explicit normalization rules.
