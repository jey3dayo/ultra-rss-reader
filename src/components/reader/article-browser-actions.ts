import { Result } from "@praha/byethrow";
import { type AppError, addToReadingList, openInBrowser } from "@/api/tauri-commands";
import { copyTextToClipboard } from "@/lib/runtime/clipboard";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import type { ArticleStatusToast, ArticleToastActionParams } from "./article-actions.types";

export type ArticleActionErrorCategory =
  | "runtime_unavailable"
  | "permission_denied"
  | "invalid_text"
  | "invalid_url"
  | "unknown";

export type ArticleActionError = AppError & {
  category: ArticleActionErrorCategory;
};

type ArticleBrowserToastOperation<T> = () => Result.ResultAsync<T, AppError>;
type OpenExternalBrowserParams = {
  background: boolean;
  showToast: ArticleStatusToast;
  errorLabel: string;
};

function isArticleActionErrorCategory(value: unknown): value is ArticleActionErrorCategory {
  return (
    value === "runtime_unavailable" ||
    value === "permission_denied" ||
    value === "invalid_text" ||
    value === "invalid_url" ||
    value === "unknown"
  );
}

function isCategorizedActionError(error: AppError): error is ArticleActionError {
  return "category" in error && isArticleActionErrorCategory(error.category);
}

function isAppError(error: unknown): error is AppError {
  return (
    !!error && typeof error === "object" && "type" in error && "message" in error && typeof error.message === "string"
  );
}

function toArticleActionError(error: unknown): ArticleActionError {
  if (isAppError(error)) {
    return categorizeArticleActionError(error);
  }

  if (error instanceof Error) {
    return {
      type: "UserVisible",
      message: error.message,
      category: resolveArticleActionErrorCategory(error.message),
    };
  }

  const message = String(error);
  return {
    type: "UserVisible",
    message,
    category: resolveArticleActionErrorCategory(message),
  };
}

export function resolveArticleActionErrorCategory(message: string): ArticleActionErrorCategory {
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
    normalized.includes("invalid url") ||
    normalized.includes("invalid uri") ||
    normalized.includes("only http:// and https:// urls are supported")
  ) {
    return "invalid_url";
  }
  if (normalized.includes("invalid") || normalized.includes("validation") || normalized.includes("text")) {
    return "invalid_text";
  }

  return "unknown";
}

export function categorizeArticleActionError(error: AppError): ArticleActionError {
  if (isCategorizedActionError(error)) {
    return error;
  }

  return {
    ...error,
    category: resolveArticleActionErrorCategory(error.message),
  };
}

function runToastOperation<T>(
  operation: ArticleBrowserToastOperation<T>,
  { showToast, successMessage }: ArticleToastActionParams,
  errorLabel: string,
) {
  return operation()
    .then((result) =>
      Result.pipe(
        result,
        Result.inspect(() => showToast(successMessage)),
        Result.inspectError((error) => {
          console.error(`${errorLabel}:`, categorizeArticleActionError(error));
          showToast(error.message);
        }),
      ),
    )
    .catch((error: unknown) => {
      const actionError = toArticleActionError(error);
      console.error(`${errorLabel}:`, actionError);
      showToast(actionError.message);
      return Result.fail(actionError);
    });
}

function runExternalBrowserOperation(
  operation: ArticleBrowserToastOperation<null>,
  { showToast, errorLabel }: Pick<OpenExternalBrowserParams, "showToast" | "errorLabel">,
) {
  return operation()
    .then((result) =>
      Result.pipe(
        result,
        Result.inspectError((error) => {
          console.error(`${errorLabel}:`, categorizeArticleActionError(error));
          showToast(error.message);
        }),
      ),
    )
    .catch((error: unknown) => {
      const actionError = toArticleActionError(error);
      console.error(`${errorLabel}:`, actionError);
      showToast(actionError.message);
      return Result.fail(actionError);
    });
}

export function openArticleInExternalBrowser(
  url: string,
  showToast: ArticleStatusToast = useUiStore.getState().showToast,
) {
  const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";

  return openUrlInExternalBrowser(url, {
    background: bg,
    showToast,
    errorLabel: "Failed to open in browser",
  });
}

export function openUrlInExternalBrowser(
  url: string,
  { background, showToast, errorLabel }: OpenExternalBrowserParams,
) {
  return runExternalBrowserOperation(() => openInBrowser(url, background), { showToast, errorLabel });
}

export function copyArticleLink(url: string, { showToast, successMessage }: ArticleToastActionParams) {
  return runToastOperation(() => copyTextToClipboard(url), { showToast, successMessage }, "Copy failed");
}

export function addArticleToReadingList(url: string, { showToast, successMessage }: ArticleToastActionParams) {
  return runToastOperation(() => addToReadingList(url), { showToast, successMessage }, "Add to reading list failed");
}
