import { AppLayout } from "./AppLayout";

export function AppShell() {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <AppLayout />
    </div>
  );
}
