---
paths:
  - "src-tauri/src/**/*.rs"
  - "src-tauri/tests/**/*.rs"
---

# Rust Test Unwrap Policy

Rust tests may use `unwrap` / `expect` only after classifying the call site as a fixture boundary or a production behavior boundary.

## Fixture Boundary

Fixture boundaries create test-only state: in-memory databases, temp directories, mock servers, static URLs, fixed timestamps, keyring setup, and repository writes whose failure means the test fixture did not start.

- `unwrap()` is acceptable for short fixture setup when the failing expression is local and obvious.
- Prefer `expect("... should ...")` when the setup spans IO, environment variables, keyring state, async mock setup, or shared helpers.
- Helper functions that lock or build test fixtures may keep `unwrap()` when the helper name already explains the fixture boundary.

## Production Behavior Boundary

Production behavior boundaries are the result under test: provider responses, parser errors, repository validation, sync scheduling outcomes, IPC/domain error mapping, and user-visible failure surfaces.

- Do not assert production behavior by unwrapping the happy path when the test is about error classification or recovery.
- Use `expect_err("... should ...")`, `unwrap_err()` followed by explicit assertions, or `match` with a panic message that names the missing behavior.
- When asserting a successful production result, prefer checking the returned value or domain state after the call. A preceding `unwrap()` is acceptable only when the later assertions identify the behavior that failed.
- Panic messages should name the boundary and policy, for example `auth status errors should preserve domain failure category`.

## Helper Policy

Do not introduce a generic `expect_ok` helper by default. It is only worth adding when a touched Rust test module repeats the same production-boundary success assertion enough that a local helper improves the failure message. Keep such helpers module-local first; move them wider only after multiple Rust modules need the same wording.
