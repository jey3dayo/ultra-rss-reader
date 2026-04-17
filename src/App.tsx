import { Result } from "@praha/byethrow";
import { QueryClientProvider } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef } from "react";
import { listAccounts, syncAccount, triggerStartupSync } from "./api/tauri-commands";
import { AppShell } from "./components/app-shell";
import { APP_HIDDEN_DURATION_SYNC_THRESHOLD_MS } from "./constants/ui-runtime";
import { useDevIntent } from "./hooks/use-dev-intent";
import { useResolvedDevIntent } from "./hooks/use-resolved-dev-intent";
import { queryClient } from "./lib/query-client";
import { attachTauriListeners } from "./lib/tauri-event-listeners";
import { resolvePreferenceValue, usePreferencesStore } from "./stores/preferences-store";

function AppInner() {
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);
  const prefs = usePreferencesStore((s) => s.prefs);
  const preferencesLoaded = usePreferencesStore((s) => s.loaded);
  const { intent: activeDevIntent, ready: devIntentReady } = useResolvedDevIntent();
  useDevIntent();

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const startupSyncRequested = useRef(false);
  const syncOnStartupEnabled = resolvePreferenceValue(prefs, "sync_on_startup") === "true";

  useEffect(() => {
    if (
      !devIntentReady ||
      !preferencesLoaded ||
      !syncOnStartupEnabled ||
      startupSyncRequested.current ||
      activeDevIntent !== null
    ) {
      return;
    }

    startupSyncRequested.current = true;
    triggerStartupSync().then((result) =>
      Result.pipe(
        result,
        Result.inspectError((error) => {
          console.warn("Startup sync failed:", error);
        }),
      ),
    );
  }, [activeDevIntent, devIntentReady, preferencesLoaded, syncOnStartupEnabled]);

  // Sync on wake: trigger sync when returning from sleep/suspend if any account has sync_on_wake enabled
  const lastHiddenAt = useRef<number>(0);
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      lastHiddenAt.current = Date.now();
      return;
    }
    // Only trigger if hidden for more than 30 seconds (likely sleep, not tab switch)
    const hiddenDuration = Date.now() - lastHiddenAt.current;
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
