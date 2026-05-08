import type { ToastData, ToastSeverity } from "@/lib/ui/toast.types";

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(Reflect.get(error, "message"));
  }
  return "Unknown error";
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

  if (retryLabel && onRetry) {
    actions.push({ label: retryLabel, onClick: onRetry });
  }

  if (dismissLabel && onDismiss) {
    actions.push({ label: dismissLabel, onClick: onDismiss });
  }

  return {
    message,
    severity,
    ...(actions.length > 0 ? { actions } : {}),
  };
}
