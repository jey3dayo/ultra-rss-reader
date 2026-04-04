import { useEffect } from "react";
import { runDevScenario } from "@/dev/scenarios";
import { consumeDevIntent, readDevIntent } from "@/lib/dev-intent";

export function useDevIntent() {
  useEffect(() => {
    const intent = readDevIntent();
    if (!intent) {
      return;
    }

    const pendingIntent = consumeDevIntent(intent);
    if (!pendingIntent) {
      return;
    }

    void runDevScenario(pendingIntent);
  }, []);
}
