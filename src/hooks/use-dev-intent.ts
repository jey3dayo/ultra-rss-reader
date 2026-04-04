import { useEffect } from "react";
import { runDevScenario } from "@/dev/scenarios";
import { readDevIntent } from "@/lib/dev-intent";

export function useDevIntent() {
  useEffect(() => {
    const intent = readDevIntent();
    if (!intent) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void runDevScenario(intent);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);
}
