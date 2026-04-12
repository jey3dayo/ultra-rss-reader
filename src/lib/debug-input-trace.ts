import { APP_EVENTS } from "@/constants/events";

export function emitDebugInputTrace(message: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(APP_EVENTS.debugInputTrace, {
      detail: `${new Date().toISOString().slice(11, 23)} ${message}`,
    }),
  );
}
