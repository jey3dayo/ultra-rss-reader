---
name: tauri-webview-geometry
description: Use when implementing, refactoring, or debugging a Tauri child webview (WebviewBuilder / add_child) embedded in a DOM UI — before writing overlay open/close/resize/bounds code — or when the native surface looks shifted, clipped, or too small, stays open after close, closes or fires twice, applies stale bounds after rapid resize or URL change, hangs the UI when a native command stalls, or when logical vs physical pixels are being mixed.
---

# Tauri Webview Geometry & Lifecycle

Use this skill for **Tauri native child webviews embedded in a DOM UI**: alignment problems, and any change to the code that opens, closes, resizes, or synchronizes one. It is not for generic CSS layout issues without a native child surface.

## When Not to Use

- Pure CSS layout bugs with no Tauri child webview involved
- General responsive design tuning
- Browser-only iframe sizing problems outside Tauri

## Why this is not React/HTML

A child webview is a native surface, not a DOM element. Every recurring bug in this area comes from applying a DOM mental model to it:

- It always paints **above** the DOM. `z-index`, `overflow`, `clip-path`, `border-radius`, and portals do not affect it. DOM chrome that must stay clickable has to live outside the native rect.
- It changes only via **async IPC commands**. A React re-render does not move, hide, or close it; only an explicit command does. Unmounting the host component leaves the native surface alive unless something closes it.
- Commands can **stall, fail, or complete out of order**. DOM state and native state are two separate state machines with an explicit sync contract, not one tree.
- Native events (state-changed, closed) arrive **late and possibly stale**. Match generation/URL before applying them.
- Platforms diverge: logical vs physical pixel units, overlay-titlebar offsets, focus and shortcut bridges. One unconditional formula is usually wrong somewhere.
- Hot reload can leave **stale child webviews, listeners, and callbacks** alive. Restart before trusting runtime signals.

Every embedded-webview change therefore has two contracts to keep:

1. Space contract — which rect the native surface occupies (geometry).
2. Time contract — when native create/close/bounds commands run relative to DOM state changes (lifecycle and ordering).

A wrong picture is a space bug. A wrong sequence — stuck overlay, double close, stale size after rapid input, frozen UI on a stalled command — is a time bug. Identify which contract is failing before touching code; fixing one with the other's tools reintroduces the bug.

## Space contract (geometry)

Treat geometry as four layers in one direction only:

1. `overlay client area`
2. `stage rect`
3. `host rect`
4. `native child webview rect`

Only derive downward:

- `overlay` is the root coordinate space.
- `stage` is the intended visible surface inside that root.
- `host` should normally equal `stage`.
- `native` must be set from `host`, not recomputed independently.
- Keep one explicit client root for the coordinate contract. In overlay-titlebar
  apps this may be an inner overlay shell rather than the outer portal element.

If the picture is wrong, first ask **which layer is wrong**, not "which offset should I tweak?"

### Coordinate rules

- Use the window client area as the root space.
- Keep DOM measurements in logical CSS pixels.
- Pass the same logical rect to Tauri child webview APIs, converting to
  physical units only at the single boundary that owns the unit contract
  (typically Windows sends physical, macOS/Linux logical). Guard
  `devicePixelRatio` for non-finite values.
- Do not add title bar, menu bar, or border offsets when the measured DOM rect already lives inside the client area.
- When checking native diagnostics, compare `native` to `host` first. If they match, the bug is usually in `overlay -> stage -> host`.
- Make diagnostics use the same coordinate space as native bounds. A HUD that
  compares viewport-relative DOM rects with client-root-relative native rects
  will report false deltas and send the investigation in the wrong direction.
- Update type comments, DTO comments, debug labels, and helper names when the
  coordinate contract changes. Stale observability text is part of the bug.

The official references that matter most are:

- Tauri webview API: `setPosition`, `setSize`, `position`, `size`, `setAutoResize`
- Tauri window API: `innerSize`, `innerPosition`

Read `references/geometry-model.md` before changing bounds logic.

### Geometry workflow

1. Identify the root rectangle. Find the DOM element that represents the real viewer root. Confirm whether it fills the whole app client area or only a sub-pane. If an outer portal root is shifted by a titlebar, padding helper, or native shell quirk, identify the inner client root that should be native coordinate zero.
2. Separate chrome from safe insets. Floating controls like close or external-link should not automatically shrink the stage. Only reserve space that must remain unobstructed. Prefer a small explicit `safeInsets` object over ad hoc utility classes spread across elements. Remember the native surface paints above DOM chrome — preserve interaction first, then remove only proven unintended gaps.
3. Compute a single stage rect. Derive one `stageRect` from `overlayRect - safeInsets` and reuse it for DOM styling, diagnostics, and native bounds. Convert the measured `hostRect` once at the boundary; do not duplicate `top`/`left` formulas across the frontend, native side, and diagnostics. Cover the conversion with tests for non-zero `top`, non-zero `left`, and logical-to-physical scaling.
4. Verify in order: overlay looks right → stage matches intent → host equals stage → native equals host → diagnostics use the same coordinate space as native. If `native == host` but the page still looks "too small," the stage is intentionally inset or the loaded site itself is center-column / fixed-width.

## Time contract (lifecycle & ordering)

Rules that hold in every embedded-webview implementation. Read
`references/lifecycle-contracts.md` before changing open/close/resize ordering.

- DOM leads, native follows. UI transitions (close overlay, switch mode, restore focus) finalize immediately from DOM state. Native commands are fire-and-forget with rejection logging and a bounded timeout. Never gate a DOM finalize on a native promise — a stalled IPC call must degrade to a log line, not a frozen or stuck UI.
- Dedupe at the trigger, in the owner. Guard repeated triggers (double Escape, shortcut + button) with an in-flight flag owned by the store/hook that owns the transition. Do not add module-level promise caches "for safety" — they change finalize timing and fight the owner's guard.
- **Latest-only after every await.** Code that applies native bounds or state after an await must re-check its request id / epoch / cancelled flag immediately after **every** await boundary, then apply or bail. The re-check guards not only the next apply but every write to shared mutable state (in-flight flags, pending slots) after the await returns. One check at the top of the function is not enough; that is where stale-resize and stale-close bugs live.
- Serialize on the frontend. Concurrent invokes are not guaranteed to complete in order. Drain queued bounds through a single in-flight loop with last-write-wins pending state instead of firing parallel commands.
- Ignore stale native events. Apply state-changed / closed payloads only when their generation and URL match current intent; otherwise drop them.
- Ordering contracts are pinned by tests. Before "cleaning up" ordering that looks wrong (immediate finalize, fire-and-forget close, dedupe shape), check the focused tests and git history — these shapes are usually deliberate fixes for a previous regression. First determine whether each pinned test fixes an _order_ or only a _result_; an ordering change that aligns code with a documented contract is done by adding a focused test for the new order, never by deleting or weakening an existing one to make a refactor pass.
- Observability follows ordering. When an ordering contract changes, update trace labels, debug text, and story fixtures in the same change. Stale observability text is part of the bug (same rule as the space contract).

## Debugging checklist

Space:

- Print `overlay`, `stage`, `host`, and `native` widths/heights in the same units, plus the derived insets.
- Check whether HUD or floating chrome forces extra top inset.
- Check whether the overlay root is attached to the whole app shell or only to a sub-pane.
- Check whether `window.innerWidth/innerHeight` and measured DOM rects describe the same visible space.

Time:

- After rapid resize / URL change / open-close-open, check whether every await boundary in the sync path re-validates latest-only before applying.
- Check whether close triggers are deduped by the owning in-flight flag, and whether DOM finalize runs without waiting for the native command.
- Check whether native event handlers drop stale generations.
- Check whether hot reload left stale child webviews or callbacks alive. Prefer a fresh app restart before treating native logs or screenshots as final.

Always capture at least one runtime signal after a fresh restart: native bounds log, debug HUD row, window-specific screenshot, or manual click result.

## Anti-patterns

Space:

- Measuring one DOM rect and styling a different one.
- Using utility classes (`top-* left-*`) as the only definition of geometry.
- Letting HUD placement, diagnostics, and native bounds use separate calculations or coordinate spaces.
- Compensating for title bars twice.
- Moving the native surface to full bleed before confirming DOM controls remain clickable.
- Debugging `native` first when `host` is already visibly too small.

Time:

- Awaiting a native close/create before finalizing DOM state ("looks safer" — it freezes the UI when native stalls).
- Adding a module-level in-flight promise cache next to an owner-level dedupe flag.
- Checking staleness once at function entry, then applying results after later awaits.
- Assuming invoke completion order matches invoke call order.
- Rewriting pinned ordering tests to match a refactor instead of treating them as the contract.
- Trusting runtime behavior under hot reload.
