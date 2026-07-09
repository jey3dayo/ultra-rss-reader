# Lifecycle Contracts

Ordering contracts for embedded Tauri child webviews. The space model lives in
`geometry-model.md`; this file covers the time axis: create, close, bounds
sync, events, and focus.

## Two state machines

Model the system as two independent state machines with a sync contract:

```text
DOM state machine      : overlay open/closed, content mode, focus target
native state machine   : child webview exists/loading/closed, actual bounds
sync contract          : which commands/events move state between them, and
                         what happens on stall, failure, and stale completion
```

The DOM machine is authoritative for user experience; the native machine is
authoritative for what is actually painted. They are reconciled by commands
(DOM → native) and events (native → DOM), both async and both unreliable.

## Close contract (the most regressed path)

The proven shape for "close the embedded browser and return to the app UI":

```text
on close trigger:
  1. if owner in-flight flag set (or mode already left) -> ignore trigger
  2. set owner in-flight flag
  3. fire native close, fire-and-forget:
       - log Result failure and promise rejection
       - race against a bounded timeout (~2s); on timeout, warn and move on
  4. finalize DOM immediately (do NOT await step 3):
       - restore mode, focus, preferences, pending action queue
  5. native "closed" event later confirms; a second finalize must be a no-op
     (guard with a finalized flag)
```

Why each line exists:

- Step 1 dedupes double Escape / shortcut+button races. The dedupe belongs to
  the hook/store that owns the transition. A module-level in-flight promise
  cache looks equivalent but changes finalize timing and has been reverted in
  practice.
- Step 3's timeout exists because native close can stall (plugin busy, bridge
  deadlock, dev-mode zombie). The helper's job is to observe and log, not to
  block. It should never reject.
- Step 4 is the **immediate-finalize contract**: a stalled native close must
  cost a console warning, not a dead overlay the user is stuck behind. This is
  the single most commonly "cleaned up" (and then reverted) line. Pin it with
  a focused test: "finalizes immediately when the native close never
  resolves".
- Step 5 makes finalize idempotent, so the eventual native event or a repeat
  trigger cannot double-run focus/preference side effects.

The fire-and-forget helper's defensive branches (never-reject, bounded
timeout, separate logs for Result failure vs promise rejection, timer-setup
fallback) should each map 1:1 to a pinned test. Reshaping the helper is fine
only while those tests stay green unchanged; a "simplification" that needs a
test edit is a contract change, not a cleanup.

## Bounds sync contract

For create/resize, the frontend owns serialization:

```text
single drain loop, owner hook:
  - one in-flight command at a time
  - while in flight, new rects overwrite a single pending slot
    (last-write-wins)
  - after EVERY await: re-check epoch/request-id/cancelled; if stale, return
    without touching the new session's flags or pending slot
  - on reset (URL change, retry, recovery): bump the epoch so in-flight
    completions from the old session become no-ops
```

Failure branches: when the drain exits on a command failure (after confirming
its epoch is still current), clear the pending slot too. A rect queued behind
a failed command is stale input for the next drain, not a retry — leaving it
lets an older rect be applied after newer bounds.

Hazards this prevents:

- Two concurrent `set_bounds` invokes completing out of order and leaving the
  old rect applied.
- A stale drain loop stealing or clearing the new session's pending bounds.
- A stale completion clearing the new session's in-flight flag.

Additional rules:

- Measure the rect from the single host element and convert units once at the
  boundary (`references/geometry-model.md`). The drain loop moves rects; it
  never computes them.
- Bounds queued during create must survive later non-fatal failures (e.g. a
  focus command rejecting) — flush pending bounds before or independently of
  optional post-create steps.
- Clean up the ResizeObserver **and** the window resize listener in the same
  effect cleanup, and set a cancelled flag so late observer callbacks bail.

## Event contract

Native → DOM events (state-changed, closed, fallback):

- Carry a load generation (and URL) in the payload; the listener drops
  payloads whose generation/URL do not match current intent.
- A "closed" event after DOM already finalized must be a no-op.
- Validate payloads at the listener boundary with a schema; malformed payloads
  are a logged drop, not a crash or a silent partial apply.

## Focus contract

- The native surface steals focus while open. Decide explicitly who owns focus
  after close (usually the list/row that opened it) and restore it in the DOM
  finalize step, then re-assert once on the next frame — native focus release
  can land after the first restore.
- Focus commands can reject; treat them as optional post-steps that never
  block finalize or strand pending work.

## Dev-mode hazards

- Hot reload does not close native child webviews. Register a dev-only cleanup
  (close-by-label on module reload) or restart the app before judging
  behavior.
- Never conclude from a hot-reloaded session that ordering is broken; capture
  runtime signals only after a fresh start.

## Test expectations

Pin each contract with a focused test, named after the contract:

- close: immediate finalize when the native close command never resolves;
  repeated triggers close natively at most once; finalize is idempotent.
- bounds: a stale drain completion after reset does not overwrite newer
  bounds or steal pending state; pending bounds survive optional post-create
  failures; only the latest queued rect is applied after the in-flight
  command settles.
- events: stale-generation payloads are dropped; malformed payloads are
  rejected at the boundary.
- unmount: cleanup runs with a pending promise outstanding; the late
  resolution is a no-op.

When a refactor makes one of these tests fail, the default assumption is that
the refactor broke the contract — not that the test is outdated.
