import i18n from "@/lib/i18n";
import type { ToastData, ToastSeverity } from "@/lib/ui/toast.types";

function unknownErrorMessage(): string {
  return i18n.t("errors.unknown");
}

function normalizeErrorMessage(message: unknown): string {
  if (typeof message !== "string") {
    return unknownErrorMessage();
  }

  const normalizedMessage = message.trim();
  return normalizedMessage.length > 0 ? normalizedMessage : unknownErrorMessage();
}

function getObjectErrorMessage(error: object): string {
  try {
    return normalizeErrorMessage(Reflect.get(error, "message"));
  } catch {
    return unknownErrorMessage();
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return getObjectErrorMessage(error);
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return getObjectErrorMessage(error);
  }
  return unknownErrorMessage();
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
