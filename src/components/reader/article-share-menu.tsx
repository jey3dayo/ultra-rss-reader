import { BookmarkPlus, Copy, Mail, Share } from "lucide-react";
import type { ArticleDto } from "@/api/tauri-commands";
import { IconToolbarMenuTrigger } from "@/design-system";
import { Menu } from "@/design-system/menu";
import { toArticleActionError } from "@/lib/articles/article-actions";
import { openArticleEmailShare } from "@/lib/articles/article-share";
import { addArticleToReadingList, copyArticleLink } from "./article-browser-actions";
import { CONTEXT_MENU_ACTION_IDS, createMenuActionHandler } from "./context-menu-action-policy";
import { contextMenuStyles } from "./context-menu-styles";

const articleShareMenuUnavailableClassName =
  "disabled:opacity-35 disabled:saturate-0 disabled:hover:bg-transparent disabled:focus-visible:bg-transparent";

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
        const actionError = toArticleActionError(error);
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
                  await openArticleEmailShare(article);
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
