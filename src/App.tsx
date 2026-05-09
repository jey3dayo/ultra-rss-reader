import { Result } from "@praha/byethrow";
import { QueryClientProvider } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef } from "react";
import { type AccountDto, listAccounts, syncAccount, triggerStartupSync } from "./api/tauri-commands";
import { AppShell } from "./components/app-shell";
import { APP_HIDDEN_DURATION_SYNC_THRESHOLD_MS } from "./constants/ui-runtime";
import { useDevIntent } from "./dev/use-dev-intent";
import { useResolvedDevIntent } from "./dev/use-resolved-dev-intent";
import { getCurrentTimeMs } from "./lib/datetime";
import { queryClient } from "./lib/query/query-client";
import { invalidateSyncCompletedQueries } from "./lib/query/query-invalidation";
import { attachTauriListeners } from "./lib/runtime/tauri-event-listeners";
import { markStartupSyncTriggered, shouldThrottleStartupSync } from "./lib/sync/startup-sync-storage";
import { usePreferencesStore } from "./stores/preferences-store";
import { useUiStore } from "./stores/ui-store";

function extractSyncOnWakeAccountIds(accounts: AccountDto[]): string[] {
  const accountIds: string[] = [];

  for (const account of accounts) {
    if (account.sync_on_wake) {
      accountIds.push(account.id);
    }
  }

  return accountIds;
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
    void triggerStartupSync(selectedAccountId ?? undefined)
      .then((result) =>
        Result.pipe(
          result,
          Result.inspectError((error) => {
            console.warn("Startup sync failed:", error);
          }),
        ),
      )
      .catch((error: unknown) => {
        console.warn("Startup sync rejected:", error);
      });
  }, [activeDevIntent, devIntentReady, preferencesLoaded, selectedAccountId]);

  // Sync on wake: trigger sync when returning from sleep/suspend if any account has sync_on_wake enabled
  const lastHiddenAt = useRef<number>(0);
  const syncOnWakeInFlight = useRef(false);
  const runSyncOnWake = useCallback(async () => {
    if (syncOnWakeInFlight.current) {
      return;
    }

    syncOnWakeInFlight.current = true;
    try {
      const accountsResult = await listAccounts();
      if (Result.isFailure(accountsResult)) {
        console.warn("Sync on wake failed to list accounts:", Result.unwrapError(accountsResult));
        return;
      }

      const accounts = Result.unwrap(accountsResult);
      const syncTasks = extractSyncOnWakeAccountIds(accounts).map((accountId) =>
        syncAccount(accountId).then((syncResult) => {
          if (Result.isFailure(syncResult)) {
            console.warn("Sync on wake failed:", Result.unwrapError(syncResult));
          }
        }),
      );
      await Promise.all(syncTasks);
    } finally {
      syncOnWakeInFlight.current = false;
    }
  }, []);
  const runSyncOnWakeRef = useRef(runSyncOnWake);

  useEffect(() => {
    runSyncOnWakeRef.current = runSyncOnWake;
  }, [runSyncOnWake]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        lastHiddenAt.current = getCurrentTimeMs();
        return;
      }
      // Only trigger if hidden for more than 30 seconds (likely sleep, not tab switch)
      const hiddenDuration = getCurrentTimeMs() - lastHiddenAt.current;
      if (hiddenDuration < APP_HIDDEN_DURATION_SYNC_THRESHOLD_MS) return;

      void runSyncOnWakeRef.current();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Keep background sync invalidation scoped to data that can change during sync.
  useEffect(() => {
    return attachTauriListeners([
      listen("sync-completed", () => {
        invalidateSyncCompletedQueries(queryClient);
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
