import { useBreakpoint } from "../hooks/use-breakpoint";
import { useKeyboard } from "../hooks/use-keyboard";
import { AppLayout } from "./AppLayout";
import { SettingsModal } from "./settings/SettingsModal";

export function AppShell() {
  useBreakpoint();
  useKeyboard();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <AppLayout />
      <SettingsModal />
    </div>
  );
}
