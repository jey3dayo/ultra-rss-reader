import { useEffect } from "react";
import { readDevIntent } from "@/lib/dev-intent";
import { runRuntimeDevScenario } from "@/lib/dev-scenario-runtime";

export function useDevIntent() {
  useEffect(() => {
    const intent = readDevIntent();
    if (!intent) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void runRuntimeDevScenario(intent);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);
}
