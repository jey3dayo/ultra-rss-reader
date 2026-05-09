import type { ToastData, ToastSeverity } from "@/lib/ui/toast.types";

const UNKNOWN_ERROR_MESSAGE = "Unknown error";

function normalizeErrorMessage(message: unknown): string {
  if (typeof message !== "string") {
    return UNKNOWN_ERROR_MESSAGE;
  }

  const normalizedMessage = message.trim();
  return normalizedMessage.length > 0 ? normalizedMessage : UNKNOWN_ERROR_MESSAGE;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return normalizeErrorMessage(error.message);
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    try {
      return normalizeErrorMessage(Reflect.get(error, "message"));
    } catch {
      return UNKNOWN_ERROR_MESSAGE;
    }
  }
  return UNKNOWN_ERROR_MESSAGE;
}

export type UiErrorProjectionInput = {
  message: string;
  severity?: ToastSeverity;
  retryLabel?: string;
  onRetry?: () => void;
  dismissLabel?: string;
  onDismiss?: () => void;
};

export function projectUiErrorToast({
  message,
  severity = "error",
  retryLabel,
  onRetry,
  dismissLabel,
  onDismiss,
}: UiErrorProjectionInput): ToastData {
  const actions: ToastData["actions"] = [];
  const normalizedRetryLabel = retryLabel?.trim();
  const normalizedDismissLabel = dismissLabel?.trim();

  if (normalizedRetryLabel && onRetry) {
    actions.push({ label: normalizedRetryLabel, onClick: onRetry });
  }

  if (normalizedDismissLabel && onDismiss) {
    actions.push({ label: normalizedDismissLabel, onClick: onDismiss });
  }

  return {
    message: normalizeErrorMessage(message),
    severity,
    ...(actions.length > 0 ? { actions } : {}),
  };
}
