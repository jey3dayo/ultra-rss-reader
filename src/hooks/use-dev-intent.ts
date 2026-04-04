import { useEffect } from "react";
import { readDevIntent } from "@/lib/dev-intent";
import { runRuntimeDevScenario } from "@/lib/dev-scenario-runtime";
import { useUiStore } from "@/stores/ui-store";

export function useDevIntent() {
  useEffect(() => {
    const intent = readDevIntent();
    if (!intent) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void runRuntimeDevScenario(intent).catch((error) => {
        const message = error instanceof Error ? error.message : "Unknown error";
        useUiStore.getState().showToast(`Failed to run dev scenario "${intent}": ${message}`);
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);
}
