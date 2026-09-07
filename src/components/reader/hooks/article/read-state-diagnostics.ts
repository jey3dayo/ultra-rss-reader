import { Result } from "@praha/byethrow";
import type {
  AppError,
  ReadDiagnosticCancelReason,
  ReadDiagnosticErrorClass,
  ReadDiagnosticEventArgs,
  ReadDiagnosticOutcome,
  ReadDiagnosticSkipReason,
} from "@/api/schemas";
import { recordReadDiagnosticsBatch } from "@/api/tauri-commands/system";

// Local-only diagnostics for the auto-mark-as-read flow (see tmp/read-state/design-contract.md).
// This module never touches article/feed/account identifiers, titles, URLs, body text, search
// strings, tokens, local paths, SQL, or raw error messages; it only ever builds the bounded
// ReadDiagnosticEventArgs shapes below. A failure anywhere in this module must never affect the
// caller's read/unread result: every public function here is synchronous and void, and the actual
// IPC send is fire-and-forget with its own one-time failure log.

// Provisional operating value (see tmp/read-state/design-contract.md): how long an auto-mark
// mutation may stay unanswered before a single pending_slow event is recorded for it. Not a
// timeout or cancellation -- the mutation keeps waiting for its real result.
export const READ_STATE_PENDING_SLOW_THRESHOLD_MS = 5_000;

// Mirrors READ_DIAGNOSTICS_BATCH_MAX_EVENTS in src-tauri/src/commands/dto/read_diagnostics.rs and
// the frontend schema's own limit; this is also the in-memory ring buffer's event-count cap,
// enforced continuously (including while a send is in flight), not just at send time.
const RING_MAX_EVENTS = 64;
// Mirrors READ_DIAGNOSTICS_BATCH_MAX_BYTES (16 KiB), reused rather than inventing a new number.
const RING_MAX_BYTES = 16 * 1024;
// Mirrors READ_DIAGNOSTICS_SESSION_MAX_BYTES (256 KiB): once this many bytes have been attempted
// in this session, further events are dropped without being queued. This is a known, documented
// limit, not a bug: a session generating this much diagnostic volume already has more than enough
// context captured.
const SESSION_MAX_BYTES = 256 * 1024;
// Minimum gap between two "normal" (non-immediate) flushes. A failure or pending_slow event
// bypasses this and flushes immediately regardless of when the last flush happened; a backlog
// that accumulated while a send was in flight is drained at the next permitted time, not
// immediately, so this cadence is never exceeded.
const MIN_FLUSH_INTERVAL_MS = 10_000;
// Periodic flush interval so routine scheduled/skipped/cancelled/dispatched activity is not lost
// forever when no failure or slow event ever occurs in a session.
const PERIODIC_FLUSH_INTERVAL_MS = 60_000;

const DRIFT_MS_MIN = -60_000;
const DRIFT_MS_MAX = 60_000;
const DURATION_MS_MIN = 0;
const DURATION_MS_MAX = 60_000;
const ELAPSED_MS_MIN = 0;
const ELAPSED_MS_MAX = 600_000;

const textEncoder = new TextEncoder();

/** Maps an AppError to the safe, message-free classification the diagnostics wire allows. */
export function classifyAppErrorForReadDiagnostics(error: AppError): ReadDiagnosticErrorClass {
  switch (error.type) {
    case "UserVisible":
      return "user_visible";
    case "Retryable":
      return "retryable";
    default:
      return "unknown";
  }
}

type SaturatedValue = { value: number; saturated: boolean };

/**
 * Normalizes a real-time-derived millisecond value to fit the wire schema's [min, max] range.
 * Returns null for NaN/Infinity/-Infinity (a value with no real-time meaning): callers must drop
 * the event and count it, never send a fabricated number for it. `saturated` is true only when
 * the value was actually out of range and had to be clamped, so `60000` from a genuinely-60s
 * operation is never confused with a value that was truncated from something larger.
 */
function saturateFiniteMs(value: number, min: number, max: number): SaturatedValue | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  if (rounded < min) {
    return { value: min, saturated: true };
  }
  if (rounded > max) {
    return { value: max, saturated: true };
  }
  return { value: rounded, saturated: false };
}

/** Real UTF-8 byte size of a JSON-serialized payload, matching what the Rust side measures via
 * `serde_json::to_vec(..).len()`. `JSON.stringify(...).length` alone undercounts multi-byte
 * characters, so this must go through TextEncoder rather than the raw string length. */
function realByteSize(payload: unknown): number {
  try {
    return textEncoder.encode(JSON.stringify(payload)).length;
  } catch {
    return RING_MAX_BYTES + 1;
  }
}

type Sender = (
  events: readonly ReadDiagnosticEventArgs[],
  droppedCount: number,
) => ReturnType<typeof recordReadDiagnosticsBatch>;

let sendBatch: Sender = recordReadDiagnosticsBatch;

// The ring is a strict FIFO bounded to RING_MAX_EVENTS / RING_MAX_BYTES at all times, including
// while sending is in flight: a send takes an immutable snapshot (splice) of the ring, so events
// pushed after that point start a fresh, independently-bounded ring rather than growing an
// in-flight batch. ringSizes tracks each entry's real byte size so eviction can maintain
// ringBytesTotal without recomputing it from scratch.
let ring: ReadDiagnosticEventArgs[] = [];
let ringSizes: number[] = [];
let ringBytesTotal = 0;
// Typed count of events dropped since the last successful hand-off to a batch: FIFO ring
// eviction, a single oversized event, or a non-finite duration/drift/elapsed value. Sent as
// `droppedCount` alongside (or instead of) events on the next batch, then reset -- never silently
// discarded, and never encoded as free text.
let droppedCount = 0;
let sessionBytesUsed = 0;
let sessionBudgetExhausted = false;
let sending = false;
let lastFlushAt = 0;
// Set when an immediate (failure/pending_slow) flush request arrives while a send is already in
// flight; consumed by that send's completion handler so the next flush does not wait out the
// normal throttle for urgent content that was merely queued behind the in-flight send.
let pendingImmediateFlush = false;
let periodicFlushTimer: ReturnType<typeof setInterval> | null = null;
let throttledFlushTimer: ReturnType<typeof setTimeout> | null = null;
let warnedOnce = false;

function warnOnceSafely(): void {
  if (warnedOnce) {
    return;
  }
  warnedOnce = true;
  // No error object, message, or payload is included: this is a fixed, safe string only.
  console.warn("[read-state-diagnostics] failed to send a diagnostics batch; further failures are not logged.");
}

function ensurePeriodicFlushTimer(): void {
  if (periodicFlushTimer !== null || typeof setInterval !== "function") {
    return;
  }
  periodicFlushTimer = setInterval(() => {
    flush({ immediate: false });
  }, PERIODIC_FLUSH_INTERVAL_MS);
}

function clearThrottledFlushTimer(): void {
  if (throttledFlushTimer !== null) {
    clearTimeout(throttledFlushTimer);
    throttledFlushTimer = null;
  }
}

/** Schedules exactly one flush attempt at the earliest permitted time; does not stack timers. */
function scheduleThrottledFlush(delayMs: number): void {
  if (throttledFlushTimer !== null || typeof setTimeout !== "function") {
    return;
  }
  throttledFlushTimer = setTimeout(() => {
    throttledFlushTimer = null;
    flush({ immediate: false });
  }, delayMs);
}

/** Evicts oldest ring entries (FIFO, no per-type protection) until `incomingSize` fits within the
 * count/byte cap. Every eviction counts toward droppedCount. */
function evictOldestUntilRoom(incomingSize: number): void {
  while (ring.length > 0 && (ring.length >= RING_MAX_EVENTS || ringBytesTotal + incomingSize > RING_MAX_BYTES)) {
    ring.shift();
    const evictedSize = ringSizes.shift() ?? 0;
    ringBytesTotal -= evictedSize;
    droppedCount += 1;
  }
}

function takeBatchDroppedCount(): number {
  const count = droppedCount;
  droppedCount = 0;
  return count;
}

/** Runs after a send settles (success, failure, or a synchronous throw from the transport
 * itself): always releases the in-flight flag, then either flushes immediately (if an immediate
 * request was queued behind this send) or schedules/attempts a normal flush for whatever
 * accumulated meanwhile. Never retries the batch that just finished. */
function finishSend(): void {
  sending = false;
  if (ring.length === 0 && droppedCount === 0) {
    return;
  }
  if (pendingImmediateFlush) {
    pendingImmediateFlush = false;
    flush({ immediate: true });
    return;
  }
  flush({ immediate: false });
}

function flush({ immediate }: { immediate: boolean }): void {
  if (sending) {
    if (immediate) {
      pendingImmediateFlush = true;
    }
    return;
  }
  if (ring.length === 0 && droppedCount === 0) {
    return;
  }

  const now = Date.now();
  if (!immediate) {
    const elapsed = now - lastFlushAt;
    if (elapsed < MIN_FLUSH_INTERVAL_MS) {
      scheduleThrottledFlush(MIN_FLUSH_INTERVAL_MS - elapsed);
      return;
    }
  }
  clearThrottledFlushTimer();

  const batchEvents = ring;
  ring = [];
  ringSizes = [];
  ringBytesTotal = 0;
  const batchDroppedCount = takeBatchDroppedCount();
  lastFlushAt = now;
  sending = true;

  let sendPromise: ReturnType<Sender>;
  try {
    sendPromise = sendBatch(batchEvents, batchDroppedCount);
  } catch {
    // The transport (or a test double) threw synchronously instead of returning a rejected
    // promise. Treat it exactly like an async failure: warn once, release `sending`, and let any
    // backlog continue through the normal completion path -- never re-throw into the caller.
    warnOnceSafely();
    finishSend();
    return;
  }

  sendPromise
    .then(Result.inspectError(() => warnOnceSafely()))
    .catch(() => {
      // sendBatch itself should never throw (safeInvoke wraps failures into a Result), but this
      // guards against a future transport swap that does throw, per the no-recursion contract.
      warnOnceSafely();
    })
    .finally(() => {
      finishSend();
    });
}

/** Records a dropped event (FIFO eviction or a non-finite value) without forcing an out-of-cadence
 * send; it rides along with whatever batch goes out next (periodic, immediate, or throttled). */
function recordDroppedEvent(): void {
  droppedCount += 1;
  ensurePeriodicFlushTimer();
}

function pushEvent(event: ReadDiagnosticEventArgs, { immediate }: { immediate: boolean }): void {
  if (sessionBudgetExhausted) {
    return;
  }

  const size = realByteSize(event);
  if (sessionBytesUsed + size > SESSION_MAX_BYTES) {
    sessionBudgetExhausted = true;
    return;
  }
  sessionBytesUsed += size;

  if (size > RING_MAX_BYTES) {
    // A single event alone exceeds the batch cap: drop it outright, never place it in the ring.
    recordDroppedEvent();
    if (immediate) {
      flush({ immediate: true });
    }
    return;
  }

  evictOldestUntilRoom(size);
  ring.push(event);
  ringSizes.push(size);
  ringBytesTotal += size;
  ensurePeriodicFlushTimer();

  flush({ immediate });
}

/** An opaque per-operation id. Never derived from or correlated with an article/account id. */
export function createReadDiagnosticRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (still opaque, still not correlatable).
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function recordAutoMarkScheduled(requestId: string, generation: number, delayMs: number): void {
  pushEvent({ event: "scheduled", requestId, generation, delayMs }, { immediate: false });
}

export function recordAutoMarkSkipped(requestId: string, generation: number, reason: ReadDiagnosticSkipReason): void {
  pushEvent({ event: "skipped", requestId, generation, reason }, { immediate: false });
}

export function recordAutoMarkCancelled(
  requestId: string,
  generation: number,
  reason: ReadDiagnosticCancelReason,
): void {
  pushEvent({ event: "cancelled", requestId, generation, reason }, { immediate: false });
}

export function recordAutoMarkDispatched(requestId: string, generation: number, driftMs: number): void {
  const saturatedDrift = saturateFiniteMs(driftMs, DRIFT_MS_MIN, DRIFT_MS_MAX);
  if (saturatedDrift === null) {
    recordDroppedEvent();
    return;
  }
  pushEvent(
    {
      event: "dispatched",
      requestId,
      generation,
      driftMs: saturatedDrift.value,
      saturated: saturatedDrift.saturated,
    },
    { immediate: false },
  );
}

export function recordAutoMarkSettled(
  requestId: string,
  generation: number,
  outcome: ReadDiagnosticOutcome,
  durationMs: number,
  errorClass: ReadDiagnosticErrorClass | undefined,
  staleOwner: boolean,
): void {
  const saturatedDuration = saturateFiniteMs(durationMs, DURATION_MS_MIN, DURATION_MS_MAX);
  if (saturatedDuration === null) {
    recordDroppedEvent();
    return;
  }
  pushEvent(
    {
      event: "settled",
      requestId,
      generation,
      outcome,
      durationMs: saturatedDuration.value,
      saturated: saturatedDuration.saturated,
      errorClass,
      staleOwner,
    },
    { immediate: outcome === "failure" },
  );
}

export function recordAutoMarkPendingSlow(requestId: string, generation: number, elapsedMs: number): void {
  const saturatedElapsed = saturateFiniteMs(elapsedMs, ELAPSED_MS_MIN, ELAPSED_MS_MAX);
  if (saturatedElapsed === null) {
    recordDroppedEvent();
    return;
  }
  pushEvent(
    {
      event: "pending_slow",
      requestId,
      generation,
      elapsedMs: saturatedElapsed.value,
      saturated: saturatedElapsed.saturated,
    },
    { immediate: true },
  );
}

/** Test-only: replace the IPC transport with a fake so tests never need a real Tauri runtime. */
export function setReadStateDiagnosticsTransportForTests(transport: Sender): void {
  sendBatch = transport;
}

/** Test-only: clears all in-memory state (ring, budgets, timers, warn-once flag, transport). */
export function resetReadStateDiagnosticsForTests(): void {
  sendBatch = recordReadDiagnosticsBatch;
  ring = [];
  ringSizes = [];
  ringBytesTotal = 0;
  droppedCount = 0;
  sessionBytesUsed = 0;
  sessionBudgetExhausted = false;
  sending = false;
  lastFlushAt = 0;
  pendingImmediateFlush = false;
  warnedOnce = false;
  clearThrottledFlushTimer();
  if (periodicFlushTimer !== null) {
    clearInterval(periodicFlushTimer);
    periodicFlushTimer = null;
  }
}

/** Test-only: current pending (unflushed) ring contents, oldest first. */
export function getReadStateDiagnosticsRingForTests(): readonly ReadDiagnosticEventArgs[] {
  return ring;
}

/** Test-only: current accumulated dropped-event count awaiting the next batch. */
export function getReadStateDiagnosticsDroppedCountForTests(): number {
  return droppedCount;
}
