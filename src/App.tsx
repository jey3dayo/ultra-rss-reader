import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Result } from "@praha/byethrow";
import { triggerSync } from "./api/tauri-commands";
import { AppShell } from "./components/AppShell";

const queryClient = new QueryClient();

function AppInner() {
  useEffect(() => {
    triggerSync().then((result) => {
      if (Result.isFailure(result)) {
        console.error("Initial sync failed:", result.error);
      }
    });
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
