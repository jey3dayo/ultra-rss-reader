import { useEffect } from "react";
import { bindWindowEvents } from "@/lib/window/window-events";
import { usePreferencesStore } from "../stores/preferences-store";
import { useUiStore } from "../stores/ui-store";
import { type PreferredLayoutMode, resolveResponsiveLayoutMode } from "./use-layout";

export function resolvePreferredLayoutMode(layoutPref: string): PreferredLayoutMode {
  return layoutPref === "compact" ? "compact" : "wide";
}

export function useBreakpoint() {
  const setLayoutMode = useUiStore((s) => s.setLayoutMode);
  const layoutPref = usePreferencesStore((s) => s.prefs.layout ?? "automatic");

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const preferredLayoutMode = resolvePreferredLayoutMode(layoutPref);
      setLayoutMode(resolveResponsiveLayoutMode(preferredLayoutMode, w));
    };
    update();
    return bindWindowEvents([{ type: "resize", listener: update }]);
  }, [setLayoutMode, layoutPref]);
}
