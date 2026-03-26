import { useKeyboard } from "../hooks/use-keyboard";
import { AppLayout } from "./AppLayout";

export function AppShell() {
  useKeyboard();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <AppLayout />
    </div>
  );
}
