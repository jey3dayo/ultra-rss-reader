import { Result } from "@praha/byethrow";
import { type AppError, addToReadingList, openInBrowser } from "@/api/tauri-commands";
import {
  type ArticleActionError,
  categorizeArticleActionError,
  normalizeArticleExternalBrowserUrl,
  toArticleActionError,
} from "@/lib/articles/article-actions";
import { copyTextToClipboard } from "@/lib/runtime/clipboard";
import { logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

export type ArticleStatusToast = (message: string) => void;

export type ArticleToastActionParams = {
  showToast: ArticleStatusToast;
  successMessage: string;
};

type ArticleBrowserToastOperation<T> = () => Result.ResultAsync<T, AppError>;
type OpenExternalBrowserParams = {
  background: boolean;
  showToast: ArticleStatusToast;
  errorLabel: string;
};
type PendingExternalBrowserOpen = Promise<Result.Result<null, AppError>>;

const pendingExternalBrowserOpens = new Map<string, PendingExternalBrowserOpen>();

function logArticleActionFailure(errorLabel: string, error: ArticleActionError): void {
  logRuntimeDiagnostic("article-action", `${errorLabel}:`, error);
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
          logArticleActionFailure(errorLabel, categorizeArticleActionError(error));
          showToast(error.message);
        }),
      ),
    )
    .catch((error: unknown) => {
      const actionError = toArticleActionError(error);
      logArticleActionFailure(errorLabel, actionError);
      showToast(actionError.message);
      return Result.fail(actionError);
    });
}

function runExternalBrowserOperation(
  operation: ArticleBrowserToastOperation<null>,
  { showToast, errorLabel }: Pick<OpenExternalBrowserParams, "showToast" | "errorLabel">,
): PendingExternalBrowserOpen {
  return operation()
    .then((result) =>
      Result.pipe(
        result,
        Result.inspectError((error) => {
          logArticleActionFailure(errorLabel, categorizeArticleActionError(error));
          showToast(error.message);
        }),
      ),
    )
    .catch((error: unknown) => {
      const actionError = toArticleActionError(error);
      logArticleActionFailure(errorLabel, actionError);
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
  const normalizedUrlResult = normalizeArticleExternalBrowserUrl(url);
  if (Result.isFailure(normalizedUrlResult)) {
    const actionError = Result.unwrapError(normalizedUrlResult);
    logArticleActionFailure(errorLabel, actionError);
    showToast(actionError.message);
    return Promise.resolve(Result.fail(actionError));
  }

  const normalizedUrl = Result.unwrap(normalizedUrlResult);
  const pendingKey = `${background ? "background" : "foreground"}:${normalizedUrl}`;
  const pendingOpen = pendingExternalBrowserOpens.get(pendingKey);
  if (pendingOpen) {
    return pendingOpen;
  }

  const openPromise = runExternalBrowserOperation(() => openInBrowser(normalizedUrl, background), {
    showToast,
    errorLabel,
  }).finally(() => {
    pendingExternalBrowserOpens.delete(pendingKey);
  });
  pendingExternalBrowserOpens.set(pendingKey, openPromise);
  return openPromise;
}

export function copyArticleLink(url: string, { showToast, successMessage }: ArticleToastActionParams) {
  if (url.trim().length === 0) {
    return runToastOperation(
      () => copyTextToClipboard(url, { category: "article_link" }),
      { showToast, successMessage },
      "Copy failed",
    );
  }

  const normalizedUrlResult = normalizeArticleExternalBrowserUrl(url);
  if (Result.isFailure(normalizedUrlResult)) {
    const actionError = Result.unwrapError(normalizedUrlResult);
    logArticleActionFailure("Copy failed", actionError);
    showToast(actionError.message);
    return Promise.resolve(Result.fail(actionError));
  }

  const normalizedUrl = Result.unwrap(normalizedUrlResult);

  return runToastOperation(
    () => copyTextToClipboard(normalizedUrl, { category: "article_link" }),
    { showToast, successMessage },
    "Copy failed",
  );
}

export function addArticleToReadingList(url: string, { showToast, successMessage }: ArticleToastActionParams) {
  const normalizedUrlResult = normalizeArticleExternalBrowserUrl(url);
  if (Result.isFailure(normalizedUrlResult)) {
    const actionError = Result.unwrapError(normalizedUrlResult);
    logArticleActionFailure("Add to reading list failed", actionError);
    showToast(actionError.message);
    return Promise.resolve(Result.fail(actionError));
  }

  const normalizedUrl = Result.unwrap(normalizedUrlResult);

  return runToastOperation(
    () => addToReadingList(normalizedUrl),
    { showToast, successMessage },
    "Add to reading list failed",
  );
}
