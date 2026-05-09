import { APP_EVENTS } from "@/constants/events";
import { formatDebugTimestamp } from "@/lib/datetime";

export type DebugTraceSource = "input" | "browser_geometry" | "sync_error" | "app";

const REDACTED_DEBUG_INPUT_VALUE = "[redacted]";
const DEBUG_HUD_CLIPBOARD_TRACE_LIMIT = 8;
const DEBUG_HUD_CLIPBOARD_MAX_LENGTH = 4000;
const PRINTABLE_KEY_MAX_LENGTH = 1;
const SENSITIVE_TARGET_LABEL_PATTERN = /(credential|password|secret|token|server|url|endpoint)/i;

type DebugHudClipboardSnapshot = {
  focusedPane: string;
  contentMode: string;
  selectedArticleId: string | null;
  browserCloseInFlight: boolean;
  pendingBrowserCloseAction: string | null;
  activeElementDescription: string;
  traces: readonly string[];
};

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

function isEditableDebugInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return target.matches("input, textarea, [contenteditable=''], [contenteditable='true']");
}

function isSensitiveDebugInputTarget(target: EventTarget | null, targetDescription: string): boolean {
  if (!(target instanceof Element)) {
    return SENSITIVE_TARGET_LABEL_PATTERN.test(targetDescription);
  }

  if (target.matches("input[type='password']")) {
    return true;
  }

  const inputType = target instanceof HTMLInputElement ? target.type : "";
  const targetName = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.name : "";
  const autocomplete = target instanceof HTMLInputElement ? target.autocomplete : "";
  const sensitivityProbe = [
    inputType,
    targetName,
    autocomplete,
    target.id,
    target.getAttribute("aria-label") ?? "",
    target.getAttribute("placeholder") ?? "",
    targetDescription,
  ].join(" ");

  return isEditableDebugInputTarget(target) || SENSITIVE_TARGET_LABEL_PATTERN.test(sensitivityProbe);
}

function shouldRedactDebugInputKey(key: string, target: EventTarget | null, targetDescription: string): boolean {
  if (!isSensitiveDebugInputTarget(target, targetDescription)) {
    return false;
  }

  return key.length <= PRINTABLE_KEY_MAX_LENGTH || key === "Space" || key === "Unidentified";
}

export function sanitizeDebugInputTraceTargetDescription(
  targetDescription: string,
  target?: EventTarget | null,
): string {
  if (!isSensitiveDebugInputTarget(target ?? null, targetDescription)) {
    return targetDescription;
  }

  const elementName = target instanceof Element ? target.tagName.toLowerCase() : targetDescription.split(/\s|\|/, 1)[0];
  return `${elementName || "target"} | sensitive=${REDACTED_DEBUG_INPUT_VALUE}`;
}

function sanitizeDebugTraceLine(line: string): string {
  return line.replace(/target=(.+)$/u, (_match, targetDescription: string) => {
    return `target=${sanitizeDebugInputTraceTargetDescription(targetDescription)}`;
  });
}

export function formatRawKeyboardTrace(key: string, targetDescription: string, target?: EventTarget | null): string {
  const safeTargetDescription = sanitizeDebugInputTraceTargetDescription(targetDescription, target);
  const safeKey = shouldRedactDebugInputKey(key, target ?? null, targetDescription) ? REDACTED_DEBUG_INPUT_VALUE : key;
  return `${formatDebugTimestamp()} raw-key ${safeKey} target=${safeTargetDescription}`;
}

function formatDebugCoordinates(clientX: number, clientY: number): string {
  return `x=${Math.round(clientX)} y=${Math.round(clientY)}`;
}

export function formatRawPointerTrace(params: {
  type: string;
  clientX: number;
  clientY: number;
  targetDescription: string;
  target?: EventTarget | null;
}): string {
  const { type, clientX, clientY, targetDescription, target } = params;
  const safeTargetDescription = sanitizeDebugInputTraceTargetDescription(targetDescription, target);
  return `${formatDebugTimestamp()} raw-pointer ${type} ${formatDebugCoordinates(clientX, clientY)} target=${safeTargetDescription}`;
}

export function formatRawClickTrace(
  clientX: number,
  clientY: number,
  targetDescription: string,
  target?: EventTarget | null,
): string {
  const safeTargetDescription = sanitizeDebugInputTraceTargetDescription(targetDescription, target);
  return `${formatDebugTimestamp()} raw-click ${formatDebugCoordinates(clientX, clientY)} target=${safeTargetDescription}`;
}

export function buildDebugHudClipboardText(snapshot: DebugHudClipboardSnapshot): string {
  const omittedTraceCount = Math.max(0, snapshot.traces.length - DEBUG_HUD_CLIPBOARD_TRACE_LIMIT);
  const traceLines = snapshot.traces.slice(-DEBUG_HUD_CLIPBOARD_TRACE_LIMIT).map(sanitizeDebugTraceLine);
  const lines = [
    `pane=${snapshot.focusedPane} mode=${snapshot.contentMode} article=${snapshot.selectedArticleId ?? "none"}`,
    `closing=${snapshot.browserCloseInFlight} pending=${snapshot.pendingBrowserCloseAction ?? "none"}`,
    sanitizeDebugInputTraceTargetDescription(snapshot.activeElementDescription),
    omittedTraceCount > 0 ? `trace_omitted=${omittedTraceCount}` : null,
    ...traceLines,
  ].filter((line): line is string => line !== null);
  const text = lines.join("\n");

  if (text.length <= DEBUG_HUD_CLIPBOARD_MAX_LENGTH) {
    return text;
  }

  return `${text.slice(0, DEBUG_HUD_CLIPBOARD_MAX_LENGTH)}\ntrace_truncated=true`;
}
