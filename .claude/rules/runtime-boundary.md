---
paths:
  - "src/**/*.{ts,tsx}"
  - "src-tauri/**/*.rs"
---

# Runtime Boundary

Browser APIs, Tauri APIs, storage, platform globals, and native-window features are runtime boundaries. Treat them as unreliable inputs even when the happy path is stable in the desktop app.

## Rules

- Use a small helper when a runtime API is used from more than one place or has fallback behavior worth testing.
- Direct access is acceptable only inside a narrow owner module when the unavailable case is obvious and covered nearby.
- Guard browser globals such as `window`, `document`, `navigator`, `matchMedia`, `localStorage`, `ResizeObserver`, and View Transition APIs before assuming they exist.
- Guard Tauri/native calls for runtime unavailable, permission denied, malformed payload, and command rejection when the call can run in browser preview, Storybook, tests, or dev-only flows.
- Keep runtime fallback policy close to the boundary. UI components should receive already-normalized capability or state when practical.
- Do not add platform-specific padding, geometry offsets, or browser-mode assumptions to view components before checking the runtime boundary owner.

## Test Expectations

- Focused tests should include at least one unavailable or throwing runtime case when adding a new boundary helper.
- For event payloads, test malformed or unknown payloads at the listener boundary before they reach UI state.
- For storage and globals, test unavailable / throwing read / throwing write separately when behavior differs.
- For native desktop behavior that cannot be fully unit-tested, pair a small contract test with manual verification notes in the relevant task.

## Examples

- `matchMedia` based code should define fallback behavior for missing `matchMedia`, missing listener APIs, and listener cleanup.
- `localStorage` migration code should define behavior for read failure, write failure, and remove failure independently.
- Tauri runtime wrappers should classify unavailable runtime separately from user-visible command failure when the UI needs different behavior.
