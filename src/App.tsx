import { Result } from "@praha/byethrow";
import { QueryClientProvider } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef } from "react";
import { listAccounts, syncAccount, triggerSync } from "./api/tauri-commands";
import { AppShell } from "./components/app-shell";
import { useDevIntent } from "./hooks/use-dev-intent";
import { queryClient } from "./lib/query-client";
import { resolvePreferenceValue, usePreferencesStore } from "./stores/preferences-store";

function AppInner() {
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);
  const prefs = usePreferencesStore((s) => s.prefs);
  const preferencesLoaded = usePreferencesStore((s) => s.loaded);
  useDevIntent();

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const startupSyncRequested = useRef(false);
  const syncOnStartupEnabled = resolvePreferenceValue(prefs, "sync_on_startup") === "true";

  useEffect(() => {
    if (!preferencesLoaded || !syncOnStartupEnabled || startupSyncRequested.current) {
      return;
    }

    startupSyncRequested.current = true;
    triggerSync().then((result) =>
      Result.pipe(
        result,
        Result.inspectError((error) => {
          console.warn("Startup sync failed:", error);
        }),
      ),
    );
  }, [preferencesLoaded, syncOnStartupEnabled]);

  // Sync on wake: trigger sync when returning from sleep/suspend if any account has sync_on_wake enabled
  const lastHiddenAt = useRef<number>(0);
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      lastHiddenAt.current = Date.now();
      return;
    }
    // Only trigger if hidden for more than 30 seconds (likely sleep, not tab switch)
    const hiddenDuration = Date.now() - lastHiddenAt.current;
    if (hiddenDuration < 30_000) return;

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
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    listen("sync-completed", () => {
      queryClient.invalidateQueries();
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
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
