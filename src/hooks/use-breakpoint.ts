import { useEffect } from "react";
import { usePreferencesStore } from "../stores/preferences-store";
import { useUiStore } from "../stores/ui-store";

export function useBreakpoint() {
  const setLayoutMode = useUiStore((s) => s.setLayoutMode);
  const layoutPref = usePreferencesStore((s) => s.prefs.layout ?? "automatic");

  useEffect(() => {
    if (layoutPref !== "automatic") {
      setLayoutMode(layoutPref as "wide" | "compact");
      return;
    }

    const update = () => {
      const w = window.innerWidth;
      if (w >= 1100) setLayoutMode("wide");
      else if (w >= 500) setLayoutMode("compact");
      else setLayoutMode("mobile");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [setLayoutMode, layoutPref]);
}
