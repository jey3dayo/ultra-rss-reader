import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Result } from "@praha/byethrow";
import { triggerSync } from "./api/tauri-commands";
import { AppShell } from "./components/app-shell";

const queryClient = new QueryClient();

function AppInner() {
  useEffect(() => {
    triggerSync().then((result) =>
      Result.pipe(
        result,
        Result.inspectError((e) => console.error("Initial sync failed:", e)),
      ),
    );
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
