import { Result } from "@praha/byethrow";
import { normalizeHttpCommandUrl } from "@/api/schemas/commands";
import type { AppError } from "@/api/tauri-commands";
import { classifyRuntimeActionErrorCategory, type RuntimeActionErrorCategory } from "@/lib/ui-errors";

export type ArticleActionErrorCategory = RuntimeActionErrorCategory;

export type ArticleActionErrorLocaleKey =
  | "article_actions.errors.runtime_unavailable"
  | "article_actions.errors.permission_denied"
  | "article_actions.errors.invalid_text"
  | "article_actions.errors.invalid_url"
  | "article_actions.errors.unknown";

export type ArticleActionError = AppError & {
  category: ArticleActionErrorCategory;
  localeKey: ArticleActionErrorLocaleKey;
};

const ARTICLE_EXTERNAL_BROWSER_INVALID_URL_MESSAGE = "Only http:// and https:// URLs are supported";
const ARTICLE_EXTERNAL_BROWSER_CREDENTIAL_URL_MESSAGE = "Article URLs must not include credentials";
const ARTICLE_ACTION_ERROR_LOCALE_KEYS = {
  runtime_unavailable: "article_actions.errors.runtime_unavailable",
  permission_denied: "article_actions.errors.permission_denied",
  invalid_text: "article_actions.errors.invalid_text",
  invalid_url: "article_actions.errors.invalid_url",
  unknown: "article_actions.errors.unknown",
} as const satisfies Record<ArticleActionErrorCategory, ArticleActionErrorLocaleKey>;

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
  return "category" in error && isArticleActionErrorCategory(error.category) && "localeKey" in error;
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

export function resolveArticleActionErrorLocaleKey(category: ArticleActionErrorCategory): ArticleActionErrorLocaleKey {
  return ARTICLE_ACTION_ERROR_LOCALE_KEYS[category];
}

export function resolveArticleActionErrorMetadata(
  message: string,
  category = resolveArticleActionErrorCategory(message),
): Pick<ArticleActionError, "category" | "localeKey"> {
  return {
    category,
    localeKey: resolveArticleActionErrorLocaleKey(category),
  };
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
