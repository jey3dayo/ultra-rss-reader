import { APP_EVENTS } from "@/constants/events";
import { formatDebugTimestamp } from "@/lib/datetime";

export type DebugTraceSource = "input" | "browser_geometry" | "sync_error" | "app";

function removeDebugTimestampPrefix(message: string): string {
  return message.replace(/^\d{2}:\d{2}:\d{2}\.\d{3} /, "");
}

export function resolveDebugTraceSource(message: string): DebugTraceSource {
  const traceMessage = removeDebugTimestampPrefix(message);

  if (
    traceMessage.startsWith("raw-key ") ||
    traceMessage.startsWith("raw-pointer ") ||
    traceMessage.startsWith("raw-click ") ||
    traceMessage.startsWith("window-key ") ||
    traceMessage.startsWith("window-mouse ") ||
    traceMessage.startsWith("list-key ") ||
    traceMessage.startsWith("menu-action ")
  ) {
    return "input";
  }

  if (traceMessage.startsWith("browser-geometry ")) {
    return "browser_geometry";
  }

  if (traceMessage.startsWith("sync-error ")) {
    return "sync_error";
  }

  return "app";
}

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

function formatDebugCoordinates(clientX: number, clientY: number): string {
  return `x=${Math.round(clientX)} y=${Math.round(clientY)}`;
}

export function formatRawPointerTrace(params: {
  type: string;
  clientX: number;
  clientY: number;
  targetDescription: string;
}): string {
  const { type, clientX, clientY, targetDescription } = params;
  return `${formatDebugTimestamp()} raw-pointer ${type} ${formatDebugCoordinates(clientX, clientY)} target=${targetDescription}`;
}

export function formatRawClickTrace(clientX: number, clientY: number, targetDescription: string): string {
  return `${formatDebugTimestamp()} raw-click ${formatDebugCoordinates(clientX, clientY)} target=${targetDescription}`;
}
