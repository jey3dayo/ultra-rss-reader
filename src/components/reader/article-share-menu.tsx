import { Menu } from "@base-ui/react/menu";
import { Result } from "@praha/byethrow";
import { BookmarkPlus, Copy, Mail, Share } from "lucide-react";
import type { ArticleDto } from "@/api/tauri-commands";
import { addToReadingList, copyToClipboard, openInBrowser } from "@/api/tauri-commands";
import { IconToolbarMenuTrigger } from "@/components/shared/icon-toolbar-control";
import { contextMenuStyles } from "./context-menu-styles";

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
      <IconToolbarMenuTrigger label={labels.share} disabled={!article?.url}>
        <Share className="h-4 w-4" />
      </IconToolbarMenuTrigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4}>
          <Menu.Popup className={contextMenuStyles.popup}>
            <Menu.Item
              className={contextMenuStyles.item}
              onSelect={async () => {
                if (!article?.url) return;
                Result.pipe(
                  await copyToClipboard(article.url),
                  Result.inspect(() => showToast(labels.linkCopied)),
                  Result.inspectError((error) => {
                    console.error("Copy failed:", error);
                    showToast(error.message);
                  }),
                );
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              {labels.copyLink}
            </Menu.Item>
            {supportsReadingList ? (
              <Menu.Item
                className={contextMenuStyles.item}
                onSelect={async () => {
                  if (!article?.url) return;
                  Result.pipe(
                    await addToReadingList(article.url),
                    Result.inspect(() => showToast(labels.addedToReadingList)),
                    Result.inspectError((error) => {
                      console.error("Add to reading list failed:", error);
                      showToast(error.message);
                    }),
                  );
                }}
              >
                <BookmarkPlus className="mr-2 h-4 w-4" />
                {labels.addToReadingList}
              </Menu.Item>
            ) : null}
            <Menu.Separator className={contextMenuStyles.separator} />
            <Menu.Item
              className={contextMenuStyles.item}
              onSelect={async () => {
                if (!article?.url) return;
                const mailto = `mailto:?subject=${encodeURIComponent(article.title)}&body=${encodeURIComponent(article.url)}`;
                Result.pipe(
                  await openInBrowser(mailto, false),
                  Result.inspectError((error) => {
                    console.error("Failed to open email client:", error);
                    showToast(error.message);
                  }),
                );
              }}
            >
              <Mail className="mr-2 h-4 w-4" />
              {labels.shareViaEmail}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
