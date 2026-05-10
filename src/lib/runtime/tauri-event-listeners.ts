import { hasTauriRuntime } from "@/lib/window/window-chrome";

type TauriEventCleanup = () => void;
type TauriEventSubscription = Promise<TauriEventCleanup>;
type TauriEventSubscriptionOwner = string | null;
type TauriEventSubscriptionEntry = {
  owner?: string;
  subscription: TauriEventSubscription;
};
type TauriEventSubscriptionInput = TauriEventSubscription | TauriEventSubscriptionEntry;
type NormalizedTauriEventSubscription = {
  owner: TauriEventSubscriptionOwner;
  subscription: TauriEventSubscription;
};
type TauriListenerErrorHandler = (error: unknown) => void;
type TauriListenerOptions = {
  owner?: string;
  onError?: TauriListenerErrorHandler;
  onUnavailable?: TauriListenerErrorHandler;
};
type ResolvedTauriListenerOptions = {
  owner: TauriEventSubscriptionOwner;
  onError: TauriListenerErrorHandler;
  onUnavailable: TauriListenerErrorHandler;
  reportError: (error: unknown, owner: TauriEventSubscriptionOwner) => void;
};
type TauriListenerGroup = {
  ready: Promise<void>;
  dispose: () => void;
};
type TauriListenerFailureEventDetail = {
  owner: TauriEventSubscriptionOwner;
};

export const TAURI_EVENT_LISTENER_FAILURE_EVENT = "ultra-rss:tauri-event-listener-failure";

const hasReportedTauriListenerFailureOwners = new Set<string | null>();

export function resetTauriEventListenerFailureReportForRuntimeRecovery() {
  hasReportedTauriListenerFailureOwners.clear();
}

function dispatchTauriListenerFailureEvent(owner: string | null) {
  if (hasReportedTauriListenerFailureOwners.has(owner) || typeof window === "undefined") {
    return;
  }

  hasReportedTauriListenerFailureOwners.add(owner);
  window.dispatchEvent(
    new CustomEvent<TauriListenerFailureEventDetail>(TAURI_EVENT_LISTENER_FAILURE_EVENT, {
      detail: { owner },
    }),
  );
}

function defaultTauriListenerErrorHandler(error: unknown, owner: TauriEventSubscriptionOwner) {
  if (!hasTauriRuntime()) {
    return;
  }

  console.warn("[tauri-event-listeners] Failed to register or cleanup Tauri event listener.", error);
  dispatchTauriListenerFailureEvent(owner);
}

function defaultTauriUnavailableHandler() {}

function resolveTauriListenerOptions(
  options: TauriListenerErrorHandler | TauriListenerOptions | undefined,
): ResolvedTauriListenerOptions {
  if (typeof options === "function") {
    return {
      owner: null,
      onError: options,
      onUnavailable: options,
      reportError: options,
    };
  }

  const owner = options?.owner ?? null;
  const onError = options?.onError;

  return {
    owner,
    onError: onError ?? ((error) => defaultTauriListenerErrorHandler(error, owner)),
    onUnavailable: options?.onUnavailable ?? defaultTauriUnavailableHandler,
    reportError: onError ?? defaultTauriListenerErrorHandler,
  };
}

function runCleanup(cleanup: TauriEventCleanup, onError: TauriListenerErrorHandler) {
  try {
    cleanup();
  } catch (error) {
    onError(error);
  }
}

function handleSubscriptionError(
  error: unknown,
  options: ResolvedTauriListenerOptions,
  owner: TauriEventSubscriptionOwner,
) {
  if (hasTauriRuntime()) {
    options.reportError(error, owner);
    return;
  }

  options.onUnavailable(error);
}

function normalizeTauriSubscriptionInput(
  input: TauriEventSubscriptionInput,
  defaultOwner: TauriEventSubscriptionOwner,
): NormalizedTauriEventSubscription {
  if ("then" in input) {
    return {
      owner: defaultOwner,
      subscription: input,
    };
  }

  return {
    owner: input.owner ?? defaultOwner,
    subscription: input.subscription,
  };
}

export function createTauriListenerGroup(
  subscriptions: readonly TauriEventSubscriptionInput[],
  listenerOptions?: TauriListenerErrorHandler | TauriListenerOptions,
): TauriListenerGroup {
  const options = resolveTauriListenerOptions(listenerOptions);
  let disposed = false;
  const cleanups: TauriEventCleanup[] = [];
  const ready = Promise.all(
    subscriptions.map((subscriptionInput) => {
      const { owner, subscription } = normalizeTauriSubscriptionInput(subscriptionInput, options.owner);
      return subscription
        .then((cleanup) => {
          if (disposed) {
            runCleanup(cleanup, options.onError);
            return;
          }
          cleanups.push(cleanup);
        })
        .catch((error: unknown) => {
          handleSubscriptionError(error, options, owner);
        });
    }),
  ).then(() => {});

  return {
    ready,
    dispose: () => {
      disposed = true;
      while (cleanups.length > 0) {
        const cleanup = cleanups.pop();
        if (cleanup) {
          runCleanup(cleanup, options.onError);
        }
      }
    },
  };
}

export function attachTauriListeners(
  subscriptions: readonly TauriEventSubscriptionInput[],
  listenerOptions?: TauriListenerErrorHandler | TauriListenerOptions,
) {
  return createTauriListenerGroup(subscriptions, listenerOptions).dispose;
}
