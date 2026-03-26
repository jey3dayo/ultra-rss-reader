import { useBreakpoint } from "../hooks/use-breakpoint";
import { useKeyboard } from "../hooks/use-keyboard";
import { AppLayout } from "./app-layout";
import { SettingsModal } from "./reader/settings-modal";

export function AppShell() {
  useBreakpoint();
  useKeyboard();

  return (
    <div className="flex h-full flex-col">
      <AppLayout />
      <SettingsModal />
    </div>
  );
}
