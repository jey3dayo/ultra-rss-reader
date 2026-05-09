import { Result } from "@praha/byethrow";
import type { AppError } from "@/api/schemas";
import { copyToClipboard } from "@/api/tauri-commands";
import { hasTauriRuntime } from "@/lib/window/window-chrome";

export type ClipboardErrorCategory = "runtime_unavailable" | "permission_denied" | "invalid_text" | "unknown";

export type ClipboardCopyError = AppError & {
  category: ClipboardErrorCategory;
};

type CopyValueToClipboardCallbacks = {
  onSuccess: () => void;
  onError: (message: string, error: ClipboardCopyError) => void;
};

function hasClipboardErrorToken(message: string, token: string): boolean {
  return message.split(/[^a-z0-9]+/).includes(token);
}

export function resolveClipboardErrorCategory(message: string): ClipboardErrorCategory {
  const normalized = message.toLowerCase();
  if (normalized.includes("permission") || normalized.includes("denied") || normalized.includes("not allowed")) {
    return "permission_denied";
  }
  if (
    normalized.includes("unavailable") ||
    normalized.includes("not available") ||
    normalized.includes("plugin") ||
    normalized.includes("unknown command")
  ) {
    return "runtime_unavailable";
  }
  if (
    normalized.includes("invalid") ||
    normalized.includes("validation") ||
    hasClipboardErrorToken(normalized, "text")
  ) {
    return "invalid_text";
  }
  return "unknown";
}

function categorizeClipboardError(error: AppError): ClipboardCopyError {
  return {
    ...error,
    category: resolveClipboardErrorCategory(error.message),
  };
}

function toClipboardCopyError(error: unknown): ClipboardCopyError {
  if (error instanceof Error) {
    return {
      type: "UserVisible",
      message: error.message,
      category: resolveClipboardErrorCategory(error.message),
    };
  }

  const message = String(error);
  return {
    type: "UserVisible",
    message,
    category: resolveClipboardErrorCategory(message),
  };
}

async function copyTextWithFrontendClipboard(value: string): Result.ResultAsync<void, ClipboardCopyError> {
  if (typeof navigator === "undefined" || typeof navigator.clipboard?.writeText !== "function") {
    return Result.fail({
      type: "UserVisible",
      message: "Clipboard unavailable",
      category: "runtime_unavailable",
    });
  }

  try {
    await navigator.clipboard.writeText(value);
    return Result.succeed(undefined);
  } catch (error) {
    return Result.fail(toClipboardCopyError(error));
  }
}

export async function copyTextToClipboard(value: string): Result.ResultAsync<void, ClipboardCopyError> {
  if (value.trim().length === 0) {
    return Result.fail({
      type: "UserVisible",
      message: "Invalid clipboard text",
      category: "invalid_text",
    });
  }

  if (!hasTauriRuntime()) {
    return copyTextWithFrontendClipboard(value);
  }

  const result = await copyToClipboard(value);
  return Result.isSuccess(result)
    ? Result.succeed(undefined)
    : Result.fail(categorizeClipboardError(Result.unwrapError(result)));
}

export async function copyValueToClipboard(
  value: string,
  { onSuccess, onError }: CopyValueToClipboardCallbacks,
): Promise<void> {
  if (value.trim().length === 0) {
    return;
  }

  Result.pipe(
    await copyTextToClipboard(value),
    Result.inspect(onSuccess),
    Result.inspectError((error) => {
      onError(error.message, error);
    }),
  );
}
