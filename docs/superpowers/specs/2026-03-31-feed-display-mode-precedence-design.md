# Feed Display Mode Precedence Design

**Goal:** Make per-feed display mode stronger than the global reading default while keeping a global fallback for feeds that do not opt out.

## Decision

- `reader_view` remains the global default display mode.
- Feed-level `display_mode` becomes a three-state value:
  - `inherit`
  - `normal`
  - `widescreen`
- Effective display mode resolves as:
  - feed `normal` -> `normal`
  - feed `widescreen` -> `widescreen`
  - feed `inherit` -> `reader_view`

## Data Model

- Existing feed rows currently store `normal` or `widescreen`.
- To align old data with the new meaning, migrate persisted `normal` values to `inherit`.
- New feeds should default to `inherit`.
- Existing `widescreen` values remain explicit per-feed overrides.

## UI

- Settings screen keeps the existing "Default display mode" control and continues to write `reader_view`.
- Feed edit dialog adds a third option, "Default display mode", that maps to `inherit`.
- Toolbar display mode toggle continues to offer `normal` and `widescreen` only.
  - It reflects the effective display mode.
  - When changed, it writes an explicit per-feed override.

## Behavior

- Changing the global default updates only feeds whose `display_mode` is `inherit`.
- Changing a feed's display mode through the feed edit dialog or toolbar overrides the global default for that feed.

## Testing

- Add regression coverage for effective mode resolution.
- Add UI coverage for the new feed edit option.
- Add behavior coverage showing global default affects inherited feeds but not explicitly overridden feeds.
