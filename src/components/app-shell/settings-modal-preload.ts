type SettingsModalPreloadState = "idle" | "pending" | "succeeded" | "retrying" | "failed";

type SettingsModalPreloadCallbacks = {
  readonly isDev?: boolean;
  readonly retryDelayMs?: number;
  readonly onInitialFailure?: (error: unknown) => void;
  readonly onRetryFailure?: (error: unknown) => void;
};

const SETTINGS_MODAL_PRELOAD_RETRY_DELAY_MS = 250;

let settingsModalPreloadState: SettingsModalPreloadState = "idle";
let settingsModalPreloadRetryTimer: ReturnType<typeof setTimeout> | null = null;
let settingsModalPreloadGeneration = 0;

function clearSettingsModalPreloadRetryTimer() {
  if (settingsModalPreloadRetryTimer === null) {
    return;
  }

  clearTimeout(settingsModalPreloadRetryTimer);
  settingsModalPreloadRetryTimer = null;
}

export function preloadSettingsModalModuleForDev(
  loadModule: () => Promise<unknown>,
  {
    isDev = import.meta.env.DEV,
    retryDelayMs = SETTINGS_MODAL_PRELOAD_RETRY_DELAY_MS,
    onInitialFailure,
    onRetryFailure,
  }: SettingsModalPreloadCallbacks = {},
) {
  if (!isDev) {
    return;
  }

  if (settingsModalPreloadState !== "idle") {
    return;
  }

  settingsModalPreloadState = "pending";
  settingsModalPreloadGeneration += 1;
  const preloadGeneration = settingsModalPreloadGeneration;

  void loadModule()
    .then(() => {
      if (settingsModalPreloadGeneration !== preloadGeneration) {
        return;
      }

      settingsModalPreloadState = "succeeded";
    })
    .catch((error: unknown) => {
      if (settingsModalPreloadGeneration !== preloadGeneration) {
        return;
      }

      onInitialFailure?.(error);
      settingsModalPreloadState = "retrying";
      settingsModalPreloadRetryTimer = setTimeout(() => {
        settingsModalPreloadRetryTimer = null;
        if (settingsModalPreloadGeneration !== preloadGeneration) {
          return;
        }

        void loadModule()
          .then(() => {
            if (settingsModalPreloadGeneration !== preloadGeneration) {
              return;
            }

            settingsModalPreloadState = "succeeded";
          })
          .catch((retryError: unknown) => {
            if (settingsModalPreloadGeneration !== preloadGeneration) {
              return;
            }

            settingsModalPreloadState = "failed";
            onRetryFailure?.(retryError);
          });
      }, retryDelayMs);
    });
}

export function resetSettingsModalPreloadSession() {
  settingsModalPreloadGeneration += 1;
  clearSettingsModalPreloadRetryTimer();
  settingsModalPreloadState = "idle";
}
