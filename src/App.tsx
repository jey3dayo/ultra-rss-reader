import { Result } from "@praha/byethrow";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef } from "react";
import { listAccounts, triggerSync } from "./api/tauri-commands";
import { AppShell } from "./components/app-shell";
import { usePreferencesStore } from "./stores/preferences-store";

const queryClient = new QueryClient();

function AppInner() {
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);

  useEffect(() => {
    loadPreferences();
    triggerSync().then((result) =>
      Result.pipe(
        result,
        Result.inspectError((e) => console.error("Initial sync failed:", e)),
      ),
    );
  }, [loadPreferences]);

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
          if (accounts.some((a) => a.sync_on_wake)) {
            triggerSync();
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
