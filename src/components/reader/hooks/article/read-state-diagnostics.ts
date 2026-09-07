import { Result } from "@praha/byethrow";
import type {
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

// Mirrors READ_DIAGNOSTICS_BATCH_MAX_EVENTS in src-tauri/src/commands/dto/read_diagnostics.rs and
// the frontend schema's own limit; this is also the in-memory ring buffer's event-count cap.
const RING_MAX_EVENTS = 64;
// Mirrors READ_DIAGNOSTICS_BATCH_MAX_BYTES (16 KiB), reused rather than inventing a new number.
const RING_MAX_BYTES = 16 * 1024;
// Mirrors READ_DIAGNOSTICS_SESSION_MAX_BYTES (256 KiB): once this many bytes have been sent (or
// attempted) in this session, further events are dropped without being queued. This is a known,
// documented limit, not a bug: a session generating this much diagnostic volume already has more
// than enough context captured.
const SESSION_MAX_BYTES = 256 * 1024;
// Minimum gap between two "normal" (non-immediate) flushes. A failure or pending_slow event
// bypasses this and flushes immediately regardless of when the last flush happened.
const MIN_FLUSH_INTERVAL_MS = 10_000;
// Periodic flush interval so routine scheduled/skipped/cancelled/dispatched activity is not lost
// forever when no failure or slow event ever occurs in a session.
const PERIODIC_FLUSH_INTERVAL_MS = 60_000;

type Sender = (events: readonly ReadDiagnosticEventArgs[]) => ReturnType<typeof recordReadDiagnosticsBatch>;

let sendBatch: Sender = recordReadDiagnosticsBatch;

let ring: ReadDiagnosticEventArgs[] = [];
let ringBytes = 0;
let sessionBytesUsed = 0;
let sessionBudgetExhausted = false;
let sending = false;
let lastFlushAt = 0;
let periodicFlushTimer: ReturnType<typeof setInterval> | null = null;
let warnedOnce = false;

function eventByteSize(event: ReadDiagnosticEventArgs): number {
  try {
    return JSON.stringify(event).length;
  } catch {
    return RING_MAX_BYTES;
  }
}

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

function flush({ immediate }: { immediate: boolean }): void {
  if (ring.length === 0 || sending) {
    return;
  }
  const now = Date.now();
  if (!immediate && now - lastFlushAt < MIN_FLUSH_INTERVAL_MS) {
    return;
  }

  const batch = ring;
  ring = [];
  ringBytes = 0;
  lastFlushAt = now;
  sending = true;

  sendBatch(batch)
    .then(Result.inspectError(() => warnOnceSafely()))
    .catch(() => {
      // sendBatch itself should never throw (safeInvoke wraps failures into a Result), but this
      // guards against a future transport swap that does throw, per the no-recursion contract.
      warnOnceSafely();
    })
    .finally(() => {
      sending = false;
    });
}

function pushEvent(event: ReadDiagnosticEventArgs, { immediate }: { immediate: boolean }): void {
  if (sessionBudgetExhausted) {
    return;
  }

  const size = eventByteSize(event);
  if (sessionBytesUsed + size > SESSION_MAX_BYTES) {
    sessionBudgetExhausted = true;
    return;
  }

  if (ring.length >= RING_MAX_EVENTS || ringBytes + size > RING_MAX_BYTES) {
    // The ring is full: flush what we have (oldest-first) before adding the new event, so a burst
    // never silently drops the newest (most relevant) event.
    flush({ immediate: true });
  }

  ring.push(event);
  ringBytes += size;
  sessionBytesUsed += size;
  ensurePeriodicFlushTimer();

  if (immediate) {
    flush({ immediate: true });
  } else {
    flush({ immediate: false });
  }
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
  pushEvent({ event: "dispatched", requestId, generation, driftMs }, { immediate: false });
}

export function recordAutoMarkSettled(
  requestId: string,
  generation: number,
  outcome: ReadDiagnosticOutcome,
  durationMs: number,
  errorClass: ReadDiagnosticErrorClass | undefined,
  staleOwner: boolean,
): void {
  pushEvent(
    { event: "settled", requestId, generation, outcome, durationMs, errorClass, staleOwner },
    { immediate: outcome === "failure" },
  );
}

export function recordAutoMarkPendingSlow(requestId: string, generation: number, elapsedMs: number): void {
  pushEvent({ event: "pending_slow", requestId, generation, elapsedMs }, { immediate: true });
}

/** Test-only: replace the IPC transport with a fake so tests never need a real Tauri runtime. */
export function setReadStateDiagnosticsTransportForTests(transport: Sender): void {
  sendBatch = transport;
}

/** Test-only: clears all in-memory state (ring, budgets, timer, warn-once flag, transport). */
export function resetReadStateDiagnosticsForTests(): void {
  sendBatch = recordReadDiagnosticsBatch;
  ring = [];
  ringBytes = 0;
  sessionBytesUsed = 0;
  sessionBudgetExhausted = false;
  sending = false;
  lastFlushAt = 0;
  warnedOnce = false;
  if (periodicFlushTimer !== null) {
    clearInterval(periodicFlushTimer);
    periodicFlushTimer = null;
  }
}

/** Test-only: current pending (unflushed) ring contents, oldest first. */
export function getReadStateDiagnosticsRingForTests(): readonly ReadDiagnosticEventArgs[] {
  return ring;
}
