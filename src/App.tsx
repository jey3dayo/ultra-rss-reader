import { Result } from "@praha/byethrow";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { triggerSync } from "./api/tauri-commands";
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

  return <AppShell />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}
