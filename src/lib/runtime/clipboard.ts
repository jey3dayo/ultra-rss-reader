import { Result } from "@praha/byethrow";
import type { AppError } from "@/api/schemas";
import { normalizeHttpCommandUrl, SHARE_COMMAND_TEXT_MAX_CHARS } from "@/api/schemas/commands";
import { copyToClipboard } from "@/api/tauri-commands";
import { classifyRuntimeActionErrorCategory, type RuntimeActionErrorCategory } from "@/lib/ui-errors";
import { hasTauriRuntime } from "@/lib/window/window-chrome";

export type ClipboardErrorCategory = RuntimeActionErrorCategory;

export type ClipboardCopyError = AppError & {
  category: ClipboardErrorCategory;
};

export const CLIPBOARD_TEXT_MAX_CHARS = SHARE_COMMAND_TEXT_MAX_CHARS;
const INVALID_CLIPBOARD_TEXT_MESSAGE = "Invalid clipboard text";
const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

type ClipboardTextCategory = "plain_text" | "article_link";

type CopyTextToClipboardOptions = {
  category?: ClipboardTextCategory;
};

type CopyValueToClipboardCallbacks = {
  onSuccess: () => void;
  onError: (message: string, error: ClipboardCopyError) => void;
};

export function resolveClipboardErrorCategory(message: string): ClipboardErrorCategory {
  return classifyRuntimeActionErrorCategory(message, { validationCategory: "invalid_text" });
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

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String(error.message);
    return {
      type: "UserVisible",
      message,
      category: resolveClipboardErrorCategory(`${"name" in error ? String(error.name) : ""} ${message}`),
    };
  }

  const message = String(error);
  return {
    type: "UserVisible",
    message,
    category: resolveClipboardErrorCategory(message),
  };
}

function invalidClipboardTextError(
  message = INVALID_CLIPBOARD_TEXT_MESSAGE,
  category: ClipboardErrorCategory = "invalid_text",
): ClipboardCopyError {
  return {
    type: "UserVisible",
    message,
    category,
  };
}

function countClipboardGraphemes(value: string): number {
  return Array.from(graphemeSegmenter.segment(value)).length;
}

function validateClipboardText(value: string, category: ClipboardTextCategory): ClipboardCopyError | null {
  if (value.trim().length === 0 || countClipboardGraphemes(value) > CLIPBOARD_TEXT_MAX_CHARS) {
    return invalidClipboardTextError();
  }

  if (category === "article_link" && !normalizeHttpCommandUrl(value)) {
    return invalidClipboardTextError("Only http:// and https:// URLs are supported", "invalid_url");
  }

  return null;
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

export async function copyTextToClipboard(
  value: string,
  { category = "plain_text" }: CopyTextToClipboardOptions = {},
): Result.ResultAsync<void, ClipboardCopyError> {
  const validationError = validateClipboardText(value, category);
  if (validationError) {
    return Result.fail(validationError);
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
