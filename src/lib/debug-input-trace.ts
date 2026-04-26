import { APP_EVENTS } from "@/constants/events";
import { formatDebugTimestamp } from "@/lib/datetime";

export function emitDebugInputTrace(message: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(APP_EVENTS.debugInputTrace, {
      detail: `${formatDebugTimestamp()} ${message}`,
    }),
  );
}
