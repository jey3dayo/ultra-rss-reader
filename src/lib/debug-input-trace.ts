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

export function formatRawKeyboardTrace(key: string, targetDescription: string): string {
  return `${formatDebugTimestamp()} raw-key ${key} target=${targetDescription}`;
}

export function formatRawPointerTrace(params: {
  type: string;
  clientX: number;
  clientY: number;
  targetDescription: string;
}): string {
  const { type, clientX, clientY, targetDescription } = params;
  return `${formatDebugTimestamp()} raw-pointer ${type} x=${Math.round(clientX)} y=${Math.round(clientY)} target=${targetDescription}`;
}

export function formatRawClickTrace(clientX: number, clientY: number, targetDescription: string): string {
  return `${formatDebugTimestamp()} raw-click x=${Math.round(clientX)} y=${Math.round(clientY)} target=${targetDescription}`;
}
