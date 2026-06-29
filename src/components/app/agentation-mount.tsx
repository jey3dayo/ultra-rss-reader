import { lazy, Suspense } from "react";
import { resolvePreferenceValue } from "@/schemas/preferences";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const AgentationToolbar = import.meta.env.DEV
  ? lazy(async () => {
      const { Agentation } = await import("agentation");
      return { default: Agentation };
    })
  : null;
const AGENTATION_ENDPOINT = "http://127.0.0.1:4747";

export function AgentationMount() {
  const prefs = usePreferencesStore((s) => s.prefs);
  const settingsOpen = useUiStore((s) => s.settingsOpen);

  if (!AgentationToolbar) {
    return null;
  }

  const visibility = resolvePreferenceValue(prefs, "debug_agentation_visibility");
  if (visibility === "off" || (visibility === "hide_in_settings" && settingsOpen)) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AgentationToolbar className="ultra-agentation-toolbar" endpoint={AGENTATION_ENDPOINT} />
    </Suspense>
  );
}
