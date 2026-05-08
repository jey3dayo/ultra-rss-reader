import { Result } from "@praha/byethrow";
import { QueryClientProvider } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef } from "react";
import { listAccounts, syncAccount, triggerStartupSync } from "./api/tauri-commands";
import { AppShell } from "./components/app-shell";
import { STORAGE_KEYS } from "./constants/storage";
import { APP_HIDDEN_DURATION_SYNC_THRESHOLD_MS, STARTUP_SYNC_THROTTLE_MS } from "./constants/ui-runtime";
import { useDevIntent } from "./dev/use-dev-intent";
import { useResolvedDevIntent } from "./dev/use-resolved-dev-intent";
import { getCurrentTimeMs } from "./lib/datetime";
import { queryClient } from "./lib/query-client";
import { attachTauriListeners } from "./lib/tauri-event-listeners";
import { usePreferencesStore } from "./stores/preferences-store";
import { useUiStore } from "./stores/ui-store";

function getLastStartupSyncTriggeredAt(): number | null {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEYS.startupSyncLastTriggeredAt);
    if (!rawValue) {
      return null;
    }

    const timestamp = Number(rawValue);
    return Number.isFinite(timestamp) ? timestamp : null;
  } catch {
    return null;
  }
}

function shouldThrottleStartupSync(): boolean {
  const lastTriggeredAt = getLastStartupSyncTriggeredAt();
  return lastTriggeredAt != null && getCurrentTimeMs() - lastTriggeredAt < STARTUP_SYNC_THROTTLE_MS;
}

function markStartupSyncTriggered(): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.startupSyncLastTriggeredAt, String(getCurrentTimeMs()));
  } catch {
    // Ignore storage failures and fall back to process-local guarding only.
  }
}

function AppInner() {
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);
  const preferencesLoaded = usePreferencesStore((s) => s.loaded);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const { intent: activeDevIntent, ready: devIntentReady } = useResolvedDevIntent();
  useDevIntent();

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const startupSyncRequested = useRef(false);

  useEffect(() => {
    if (!devIntentReady || !preferencesLoaded || startupSyncRequested.current || activeDevIntent !== null) {
      return;
    }

    if (shouldThrottleStartupSync()) {
      return;
    }

    startupSyncRequested.current = true;
    markStartupSyncTriggered();
    triggerStartupSync(selectedAccountId ?? undefined).then((result) =>
      Result.pipe(
        result,
        Result.inspectError((error) => {
          console.warn("Startup sync failed:", error);
        }),
      ),
    );
  }, [activeDevIntent, devIntentReady, preferencesLoaded, selectedAccountId]);

  // Sync on wake: trigger sync when returning from sleep/suspend if any account has sync_on_wake enabled
  const lastHiddenAt = useRef<number>(0);
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      lastHiddenAt.current = getCurrentTimeMs();
      return;
    }
    // Only trigger if hidden for more than 30 seconds (likely sleep, not tab switch)
    const hiddenDuration = getCurrentTimeMs() - lastHiddenAt.current;
    if (hiddenDuration < APP_HIDDEN_DURATION_SYNC_THRESHOLD_MS) return;

    listAccounts().then((result) =>
      Result.pipe(
        result,
        Result.inspect((accounts) => {
          for (const account of accounts) {
            if (account.sync_on_wake) {
              syncAccount(account.id);
            }
          }
        }),
      ),
    );
  }, []);

  useEffect(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [handleVisibilityChange]);

  // Invalidate all queries when background sync completes
  useEffect(() => {
    return attachTauriListeners([
      listen("sync-completed", () => {
        queryClient.invalidateQueries();
      }),
    ]);
  }, []);

  return <AppShell />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}
