import { Result } from "@praha/byethrow";
import { normalizeHttpCommandUrl } from "@/api/schemas/commands";
import type { AppError } from "@/api/tauri-commands";
import { classifyRuntimeActionErrorCategory, type RuntimeActionErrorCategory } from "@/lib/ui-errors";

type ArticleActionErrorCategory = RuntimeActionErrorCategory;

export type ArticleActionError = AppError & {
  category: ArticleActionErrorCategory;
};

const ARTICLE_EXTERNAL_BROWSER_INVALID_URL_MESSAGE = "Only http:// and https:// URLs are supported";
const ARTICLE_EXTERNAL_BROWSER_CREDENTIAL_URL_MESSAGE = "Article URLs must not include credentials";

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
  if (!error || typeof error !== "object" || !("type" in error) || !("message" in error)) {
    return false;
  }

  return (
    typeof error.message === "string" &&
    (error.type === "UserVisible" || error.type === "Retryable" || error.type === "Diagnostics")
  );
}

function toInvalidArticleUrlError(message = ARTICLE_EXTERNAL_BROWSER_INVALID_URL_MESSAGE): ArticleActionError {
  return {
    type: "UserVisible",
    message,
    ...resolveArticleActionErrorMetadata(message, "invalid_url"),
  };
}

export function normalizeArticleExternalBrowserUrl(url: string): Result.Result<string, ArticleActionError> {
  const normalizedUrl = normalizeHttpCommandUrl(url);
  if (!normalizedUrl) {
    return Result.fail(toInvalidArticleUrlError());
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    if (parsedUrl.username || parsedUrl.password) {
      return Result.fail(toInvalidArticleUrlError(ARTICLE_EXTERNAL_BROWSER_CREDENTIAL_URL_MESSAGE));
    }

    return Result.succeed(normalizedUrl);
  } catch {
    return Result.fail(toInvalidArticleUrlError());
  }
}

export function resolveArticleActionErrorCategory(message: string): ArticleActionErrorCategory {
  return classifyRuntimeActionErrorCategory(message, { validationCategory: "invalid_text" });
}

function resolveArticleActionErrorMetadata(
  message: string,
  category = resolveArticleActionErrorCategory(message),
): Pick<ArticleActionError, "category"> {
  return { category };
}

export function categorizeArticleActionError(error: AppError): ArticleActionError {
  if (isCategorizedActionError(error)) {
    return error;
  }

  const metadata = resolveArticleActionErrorMetadata(error.message);

  return {
    ...error,
    ...metadata,
  };
}

export function toArticleActionError(error: unknown): ArticleActionError {
  if (isAppError(error)) {
    return categorizeArticleActionError(error);
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    type: "UserVisible",
    message,
    ...resolveArticleActionErrorMetadata(message),
  };
}
