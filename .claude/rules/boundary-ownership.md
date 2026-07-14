---
paths:
  - "src/**/*.{ts,tsx}"
  - "src-tauri/**/*.rs"
  - ".claude/rules/**/*.md"
---

# Boundary Ownership

Use this rule when moving code, extracting helpers, or deciding whether a
duplicated concern should become shared. First find the existing owner from
repository evidence. Do not create a new `validation/` or `transformer/`
convention unless nearby code already proves that shape.

## Owner Table

| Concern | Owner | Move when |
| --- | --- | --- |
| Tauri IPC request / response schemas | `src/api/schemas/` plus `src/api/tauri-commands.ts` | Command payload parsing or DTO validation is repeated outside the API boundary |
| Frontend-owned runtime schemas | `src/schemas/` | Preferences, localStorage, app config, or other non-IPC runtime data parsing is repeated |
| Result and error conversion | `src/api/`, `src/lib/`, or the adapter hook that owns the async boundary | Components inspect `@praha/byethrow` directly or repeated error conversion appears in multiple callers |
| Rust data access contracts | `src-tauri/src/repository/` | A service or command starts defining ad hoc data-access behavior instead of using a repository trait |
| SQLite schema, migration, and query implementation | `src-tauri/src/infra/db/` | Raw SQL, migrations, connection policy, or SQLite row mapping leaks outside the DB implementation |
| Rust orchestration | `src-tauri/src/service/` | Commands coordinate multi-step domain or repository work that should be reusable outside IPC |
| Tauri command boundary | `src-tauri/src/commands/` | UI-facing DTOs, AppState access, or `DomainError` to `AppError` mapping is duplicated elsewhere |
| DTO / view-model transformation | Existing `src/lib/<domain>/`, `src/components/<feature>/lib/`, or schema-adjacent parser | The same DTO-to-view, row-to-domain, option-list, or presentation normalization is repeated |
| Feature-local controller behavior | `src/components/<feature>/hooks/` or `src/components/<feature>/lib/` | Logic closes over feature state, component props, copy, toasts, optimistic updates, or local lifecycle |
| Cross-feature pure helpers | `src/lib/<domain>/` | Logic is React-free, UI-copy-free, store-free, Tauri-command-free, and has multiple production callers |
| Stable literals and protocol markers | `src/constants/`, `src/lib/actions.ts`, or `src/lib/app-actions.ts` | Storage keys, action IDs, event names, or protocol-like markers are repeated |
| UI copy and translation resources | `src/locales/` plus `src/lib/i18n-resources.ts` | User-visible copy is embedded in shared helpers, schemas, constants, or tests without a locale owner |
| Runtime capability wrappers | `src/lib/runtime/`, `src/lib/window/`, or `src/lib/browser/` | Browser globals, Tauri runtime, window geometry, WebView, clipboard, or platform checks scatter into views |
| Generated artifacts | Owning source config plus the generator command | Generated output such as `src-tauri/gen/schemas/` or `dist/` is hand-edited |
| Shared test support | `tests/helpers/` | Fixtures, Tauri mocks, app-error helpers, or rendering wrappers are repeated across frontend tests |

## Current Rust Exceptions

- Commands may construct concrete SQLite repositories from `AppState` when they
  are wiring IPC to existing repository traits. Treat ad hoc SQL or duplicated
  data-access policy in commands as drift, not repository construction itself.
- Service code may call provider or sanitizer infrastructure when it is part of
  the current sync flow boundary. Move only repeated orchestration or policy
  drift after checking the existing service and provider shape.
- `commands/sync_providers.rs` currently owns provider-specific sync command
  behavior. Do not relocate that surface as part of an unrelated cleanup.

## Rules

- Keep ownership tables diagnostic. The destination still needs local evidence:
  imports, nearby tests, docs, or repeated call patterns.
- Keep this file as owner routing. Detailed strictness stays in the matching
  topic rule, such as `schema-boundary.md`, `result-boundary.md`, or
  `runtime-boundary.md`.
- Prefer existing feature terminology over generic `transformer`, `mapper`, or
  `validation` folders.
- Leave one-consumer component props, hook params, view labels, and lifecycle
  policy local unless another owner already consumes the same contract.
- Do not weaken a schema so a view model can fit it. Keep DTO validation strict
  and transform into a separate view model at the owning boundary.
- Use compatibility re-exports when moving a public feature helper would churn
  nearby tests, mocks, or imports.

## Test Expectations

- Add focused contract tests when moving schema parsing, error conversion,
  repository return values, generated-artifact assumptions, or DTO-to-view
  mapping.
- For pure helper moves, run the nearest existing unit tests for both the old
  callers and the new owner.
- For documentation-only owner clarifications, run Markdown lint or the
  repository documentation gate.
