import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { triggerSync } from "./api/tauri-commands";
import { AppShell } from "./components/AppShell";

const queryClient = new QueryClient();

function AppInner() {
  useEffect(() => {
    triggerSync().catch(console.error);
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
