import { Menu } from "@base-ui/react/menu";
import { Result } from "@praha/byethrow";
import { BookmarkPlus, Copy, Mail, Share } from "lucide-react";
import { SHARE_COMMAND_TEXT_MAX_CHARS } from "@/api/schemas/commands";
import { type AppError, type ArticleDto, openExternalUrl } from "@/api/tauri-commands";
import { IconToolbarMenuTrigger } from "@/components/shared/icon-toolbar-control";
import { categorizeArticleActionError, normalizeArticleExternalBrowserUrl } from "@/lib/articles/article-actions";
import { addArticleToReadingList, copyArticleLink } from "./article-browser-actions";
import { CONTEXT_MENU_ACTION_IDS, createMenuActionHandler } from "./context-menu-action-policy";
import { contextMenuStyles } from "./context-menu-styles";

const articleShareMenuUnavailableClassName =
  "disabled:opacity-35 disabled:saturate-0 disabled:hover:bg-transparent disabled:focus-visible:bg-transparent";

const MAILTO_FALLBACK_SUBJECT = "Untitled article";
const MAILTO_SUBJECT_MAX_LENGTH = 160;
const MAILTO_BODY_MAX_LENGTH = SHARE_COMMAND_TEXT_MAX_CHARS;

function truncateGraphemes(value: string, maxGraphemes: number) {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let result = "";
    let count = 0;
    for (const { segment } of segmenter.segment(value)) {
      if (count >= maxGraphemes) {
        break;
      }
      result += segment;
      count += 1;
    }
    return result;
  }

  let result = "";
  let count = 0;
  for (const character of value) {
    if (count >= maxGraphemes) {
      break;
    }
    result += character;
    count += 1;
  }
  return result;
}

function resolveMailtoValue(value: string | null, fallback: string, maxLength: number) {
  const normalized = value?.trim() || fallback;
  return truncateGraphemes(normalized, maxLength);
}

function buildArticleMailto(article: ArticleDto) {
  const rawUrl = article.url;
  if (!rawUrl?.trim()) {
    return Result.fail(null);
  }

  const normalizedUrlResult = normalizeArticleExternalBrowserUrl(rawUrl);
  if (Result.isFailure(normalizedUrlResult)) {
    return normalizedUrlResult;
  }

  const normalizedUrl = Result.unwrap(normalizedUrlResult);
  const subject = resolveMailtoValue(article.title, MAILTO_FALLBACK_SUBJECT, MAILTO_SUBJECT_MAX_LENGTH);
  const body = resolveMailtoValue(normalizedUrl, normalizedUrl, MAILTO_BODY_MAX_LENGTH);
  return Result.succeed(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
}

type ArticleShareMenuLabels = {
  share: string;
  copyLink: string;
  addToReadingList: string;
  addedToReadingList: string;
  shareViaEmail: string;
  linkCopied: string;
};

type ArticleShareMenuProps = {
  article: ArticleDto | null;
  supportsReadingList: boolean;
  showToast: (message: string) => void;
  labels: ArticleShareMenuLabels;
};

function isAppError(error: unknown): error is AppError {
  if (!error || typeof error !== "object" || !("type" in error) || !("message" in error)) {
    return false;
  }

  return (
    typeof error.message === "string" &&
    (error.type === "UserVisible" || error.type === "Retryable" || error.type === "Diagnostics")
  );
}

function runArticleShareMenuAction(
  actionId: Parameters<typeof createMenuActionHandler>[0],
  action: () => Promise<unknown>,
  showToast: ArticleShareMenuProps["showToast"],
  errorLabel: string,
) {
  return createMenuActionHandler(
    actionId,
    async () => {
      await action();
    },
    {
      showToast,
      getToastMessage: (error: unknown) => {
        const appError: AppError = isAppError(error)
          ? error
          : {
              type: "UserVisible",
              message: error instanceof Error ? error.message : String(error),
            };
        const actionError = categorizeArticleActionError(appError);
        console.error(errorLabel, actionError);
        return actionError.message;
      },
    },
  );
}

export function ArticleShareMenu({ article, supportsReadingList, showToast, labels }: ArticleShareMenuProps) {
  return (
    <Menu.Root>
      <IconToolbarMenuTrigger
        label={labels.share}
        disabled={!article?.url}
        className={articleShareMenuUnavailableClassName}
      >
        <Share className="size-4" />
      </IconToolbarMenuTrigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4}>
          <Menu.Popup className={contextMenuStyles.popup}>
            <Menu.Item
              data-action-id={CONTEXT_MENU_ACTION_IDS.articleCopyLink}
              className={contextMenuStyles.item}
              onClick={runArticleShareMenuAction(
                CONTEXT_MENU_ACTION_IDS.articleCopyLink,
                async () => {
                  if (!article?.url) return;
                  await copyArticleLink(article.url, {
                    showToast,
                    successMessage: labels.linkCopied,
                  });
                },
                showToast,
                "Copy failed",
              )}
            >
              <Copy className="mr-2 size-4" />
              {labels.copyLink}
            </Menu.Item>
            {supportsReadingList ? (
              <Menu.Item
                data-action-id={CONTEXT_MENU_ACTION_IDS.articleAddToReadingList}
                className={contextMenuStyles.item}
                onClick={runArticleShareMenuAction(
                  CONTEXT_MENU_ACTION_IDS.articleAddToReadingList,
                  async () => {
                    if (!article?.url) return;
                    await addArticleToReadingList(article.url, {
                      showToast,
                      successMessage: labels.addedToReadingList,
                    });
                  },
                  showToast,
                  "Add to reading list failed",
                )}
              >
                <BookmarkPlus className="mr-2 size-4" />
                {labels.addToReadingList}
              </Menu.Item>
            ) : null}
            <Menu.Separator className={contextMenuStyles.separator} />
            <Menu.Item
              data-action-id={CONTEXT_MENU_ACTION_IDS.articleShareEmail}
              className={contextMenuStyles.item}
              onClick={runArticleShareMenuAction(
                CONTEXT_MENU_ACTION_IDS.articleShareEmail,
                async () => {
                  if (!article) return;
                  const mailtoResult = buildArticleMailto(article);
                  if (Result.isFailure(mailtoResult)) {
                    const error = Result.unwrapError(mailtoResult);
                    if (error) {
                      throw error;
                    }
                    return;
                  }

                  const mailto = Result.unwrap(mailtoResult);
                  const result = await openExternalUrl(mailto);
                  if (Result.isFailure(result)) {
                    throw Result.unwrapError(result);
                  }
                },
                showToast,
                "Failed to open email client:",
              )}
            >
              <Mail className="mr-2 size-4" />
              {labels.shareViaEmail}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
