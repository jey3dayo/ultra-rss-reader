import { useEffect } from "react";
import { usePreferencesStore } from "../stores/preferences-store";
import { useUiStore } from "../stores/ui-store";
import { resolveResponsiveLayoutMode } from "./use-layout";

export function useBreakpoint() {
  const setLayoutMode = useUiStore((s) => s.setLayoutMode);
  const layoutPref = usePreferencesStore((s) => s.prefs.layout ?? "automatic");

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const preferredLayoutMode = layoutPref === "automatic" ? "wide" : (layoutPref as "wide" | "compact");
      setLayoutMode(resolveResponsiveLayoutMode(preferredLayoutMode, w));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [setLayoutMode, layoutPref]);
}
