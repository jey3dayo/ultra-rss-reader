import { useEffect } from "react";
import { useUiStore } from "../stores/ui-store";

export function useBreakpoint() {
  const setLayoutMode = useUiStore((s) => s.setLayoutMode);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1100) setLayoutMode("wide");
      else if (w >= 500) setLayoutMode("compact");
      else setLayoutMode("mobile");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [setLayoutMode]);
}
