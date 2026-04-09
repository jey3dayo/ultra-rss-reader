import { useEffect } from "react";
import { loadDevRuntimeOptions, readDevIntent } from "@/lib/dev-intent";
import { runRuntimeDevScenario } from "@/lib/dev-scenario-runtime";
import { useUiStore } from "@/stores/ui-store";

export function useDevIntent() {
  useEffect(() => {
    let timeoutId: number | null = null;
    let cancelled = false;

    void (async () => {
      let intent = readDevIntent();
      if (!intent) {
        await loadDevRuntimeOptions();
        if (cancelled) {
          return;
        }
        intent = readDevIntent();
      }

      if (!intent) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        void runRuntimeDevScenario(intent).catch((error) => {
          const message = error instanceof Error ? error.message : "Unknown error";
          useUiStore.getState().showToast(`Failed to run dev scenario "${intent}": ${message}`);
        });
      }, 0);
    })();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);
}
