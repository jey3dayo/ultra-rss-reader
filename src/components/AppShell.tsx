import { useBreakpoint } from "../hooks/use-breakpoint";
import { AppLayout } from "./AppLayout";

export function AppShell() {
  useBreakpoint();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <AppLayout />
    </div>
  );
}
