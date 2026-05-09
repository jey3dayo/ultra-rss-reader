import { Menu } from "@base-ui/react/menu";
import { Result } from "@praha/byethrow";
import { BookmarkPlus, Copy, Mail, Share } from "lucide-react";
import { type ArticleDto, openExternalUrl } from "@/api/tauri-commands";
import { IconToolbarMenuTrigger } from "@/components/shared/icon-toolbar-control";
import { addArticleToReadingList, copyArticleLink } from "./article-browser-actions";
import { contextMenuStyles } from "./context-menu-styles";

const articleShareMenuUnavailableClassName =
  "disabled:opacity-35 disabled:saturate-0 disabled:hover:bg-transparent disabled:focus-visible:bg-transparent";

const MAILTO_FALLBACK_SUBJECT = "Untitled article";
const MAILTO_FALLBACK_BODY = "Article URL unavailable";
const MAILTO_SUBJECT_MAX_LENGTH = 160;
const MAILTO_BODY_MAX_LENGTH = 2_000;

function resolveMailtoValue(value: string | null, fallback: string, maxLength: number) {
  const normalized = value?.trim() || fallback;
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function buildArticleMailto(article: ArticleDto) {
  const subject = resolveMailtoValue(article.title, MAILTO_FALLBACK_SUBJECT, MAILTO_SUBJECT_MAX_LENGTH);
  const body = resolveMailtoValue(article.url, MAILTO_FALLBACK_BODY, MAILTO_BODY_MAX_LENGTH);
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
              className={contextMenuStyles.item}
              onClick={async () => {
                if (!article?.url) return;
                await copyArticleLink(article.url, {
                  showToast,
                  successMessage: labels.linkCopied,
                });
              }}
            >
              <Copy className="mr-2 size-4" />
              {labels.copyLink}
            </Menu.Item>
            {supportsReadingList ? (
              <Menu.Item
                className={contextMenuStyles.item}
                onClick={async () => {
                  if (!article?.url) return;
                  await addArticleToReadingList(article.url, {
                    showToast,
                    successMessage: labels.addedToReadingList,
                  });
                }}
              >
                <BookmarkPlus className="mr-2 size-4" />
                {labels.addToReadingList}
              </Menu.Item>
            ) : null}
            <Menu.Separator className={contextMenuStyles.separator} />
            <Menu.Item
              className={contextMenuStyles.item}
              onClick={async () => {
                if (!article) return;
                const mailto = buildArticleMailto(article);
                Result.pipe(
                  await openExternalUrl(mailto),
                  Result.inspectError((error) => {
                    console.error("Failed to open email client:", error);
                    showToast(error.message);
                  }),
                );
              }}
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
