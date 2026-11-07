import { type PendingKind, useUpdaterPendingStore } from "@/hooks/updater/updater-pending-store";
import { useUiStore } from "@/stores/ui-store";

type Outcome = { type: "busy" } | { type: "done" } | { type: "failed"; reason: string } | { type: "blocked" };
type Request = {
  kind: PendingKind;
  version: string;
  run: (isCurrent: () => boolean) => Promise<Outcome>;
  onCancel?: () => void;
  onBlocked?: () => void;
  onRetry?: () => void;
};
let request: Request | null = null;
let sequence = 0;
let firstAttempt = false;
let unsubscribe: (() => void) | undefined;
let timer: ReturnType<typeof setInterval> | undefined;

function stopWatching() {
  unsubscribe?.();
  unsubscribe = undefined;
  if (timer) clearInterval(timer);
  timer = undefined;
}
function clear() {
  stopWatching();
  request = null;
  sequence += 1;
  useUpdaterPendingStore.setState({ pending: { status: "idle" } });
}
export function resetPendingUpdateForTests() {
  clear();
}
export function isUpdatePending() {
  const status = useUpdaterPendingStore.getState().pending.status;
  return status === "waiting" || status === "attempting";
}
export function cancelPendingUpdate() {
  const pending = useUpdaterPendingStore.getState().pending;
  if (pending.status !== "waiting" && pending.status !== "failed") return;
  const onCancel = pending.status === "waiting" ? request?.onCancel : undefined;
  clear();
  onCancel?.();
}
export function retryPendingUpdate() {
  if (useUpdaterPendingStore.getState().pending.status !== "failed") return;
  if (request?.onRetry) {
    const retry = request.onRetry;
    clear();
    retry();
  } else void attempt();
}
async function attempt() {
  const current = request;
  const pending = useUpdaterPendingStore.getState().pending;
  if (
    !current ||
    pending.status === "attempting" ||
    (pending.status === "waiting" && useUiStore.getState().syncProgress.active)
  )
    return;
  stopWatching();
  const id = ++sequence;
  useUpdaterPendingStore.setState({
    pending: { status: "attempting", kind: current.kind, version: current.version, requestId: id },
  });
  const isCurrent = () => sequence === id;
  let outcome: Outcome;
  try {
    outcome = await current.run(isCurrent);
  } catch (error) {
    outcome = { type: "failed", reason: error instanceof Error ? error.message : String(error) };
  }
  if (!isCurrent()) return;
  if (outcome.type === "busy") {
    useUpdaterPendingStore.setState({
      pending: { status: "waiting", kind: current.kind, version: current.version, requestId: id },
    });
    unsubscribe = useUiStore.subscribe((state, previous) => {
      if (previous.syncProgress.active && !state.syncProgress.active) void attempt();
    });
    timer = setInterval(() => {
      void attempt();
    }, 5_000);
    if (firstAttempt && !useUiStore.getState().syncProgress.active) {
      firstAttempt = false;
      void attempt();
    }
    return;
  }
  if (outcome.type === "failed") {
    useUpdaterPendingStore.setState({
      pending: {
        status: "failed",
        kind: current.kind,
        version: current.version,
        reason: outcome.reason,
        requestId: id,
      },
    });
    return;
  }
  clear();
  if (outcome.type === "blocked") current.onBlocked?.();
}
export function startPendingUpdate(next: Request, initiallyBusy = false) {
  if (isUpdatePending()) return;
  clear();
  request = next;
  firstAttempt = !initiallyBusy;
  if (initiallyBusy) {
    const id = ++sequence;
    useUpdaterPendingStore.setState({
      pending: { status: "waiting", kind: next.kind, version: next.version, requestId: id },
    });
    unsubscribe = useUiStore.subscribe((state, previous) => {
      if (previous.syncProgress.active && !state.syncProgress.active) void attempt();
    });
    timer = setInterval(() => {
      void attempt();
    }, 5_000);
    if (!useUiStore.getState().syncProgress.active) void attempt();
  } else void attempt();
}
