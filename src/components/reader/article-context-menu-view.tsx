import { ContextMenu } from "@/design-system/context-menu";
import { CONTEXT_MENU_ACTION_IDS } from "./context-menu-action-policy";
import { contextMenuStyles } from "./context-menu-styles";

type ArticleContextMenuViewProps = {
  toggleReadLabel: string;
  toggleStarLabel: string;
  openInBrowserLabel?: string;
  copyArticleLinkLabel?: string;
  editSourceFeedLabel?: string;
  onToggleRead: () => void;
  onToggleStar: () => void;
  onOpenInBrowser?: () => void;
  onCopyArticleLink?: () => void;
  onEditSourceFeed?: () => void;
};

export function ArticleContextMenuView({
  toggleReadLabel,
  toggleStarLabel,
  openInBrowserLabel,
  copyArticleLinkLabel,
  editSourceFeedLabel,
  onToggleRead,
  onToggleStar,
  onOpenInBrowser,
  onCopyArticleLink,
  onEditSourceFeed,
}: ArticleContextMenuViewProps) {
  const hasSecondaryActions = (onOpenInBrowser && openInBrowserLabel) || (onCopyArticleLink && copyArticleLinkLabel);

  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner className={contextMenuStyles.positioner}>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item
            data-action-id={CONTEXT_MENU_ACTION_IDS.articleToggleRead}
            className={contextMenuStyles.item}
            onClick={onToggleRead}
          >
            {toggleReadLabel}
          </ContextMenu.Item>
          <ContextMenu.Item
            data-action-id={CONTEXT_MENU_ACTION_IDS.articleToggleStar}
            className={contextMenuStyles.item}
            onClick={onToggleStar}
          >
            {toggleStarLabel}
          </ContextMenu.Item>
          {hasSecondaryActions && (
            <>
              <ContextMenu.Separator className={contextMenuStyles.separator} />
              {onOpenInBrowser && openInBrowserLabel && (
                <ContextMenu.Item
                  data-action-id={CONTEXT_MENU_ACTION_IDS.articleOpenBrowser}
                  className={contextMenuStyles.item}
                  onClick={onOpenInBrowser}
                >
                  {openInBrowserLabel}
                </ContextMenu.Item>
              )}
              {onCopyArticleLink && copyArticleLinkLabel && (
                <ContextMenu.Item
                  data-action-id={CONTEXT_MENU_ACTION_IDS.articleCopyLink}
                  className={contextMenuStyles.item}
                  onClick={onCopyArticleLink}
                >
                  {copyArticleLinkLabel}
                </ContextMenu.Item>
              )}
            </>
          )}
          {onEditSourceFeed && editSourceFeedLabel && (
            <>
              <ContextMenu.Separator className={contextMenuStyles.separator} />
              <ContextMenu.Item
                data-action-id={CONTEXT_MENU_ACTION_IDS.articleSourceFeedEdit}
                className={contextMenuStyles.item}
                onClick={onEditSourceFeed}
              >
                {editSourceFeedLabel}
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
