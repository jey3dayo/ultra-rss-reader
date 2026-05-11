import type { AppError } from "@/api/tauri-commands";

export function isBrowserSurfaceAppError(
  error: unknown,
): error is Extract<AppError, { type: "UserVisible" | "Retryable" }> {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    "message" in error &&
    (error.type === "UserVisible" || error.type === "Retryable") &&
    typeof error.message === "string" &&
    error.message.trim().length > 0
  );
}
