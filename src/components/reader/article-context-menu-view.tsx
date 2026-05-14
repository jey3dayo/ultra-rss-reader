import { ContextMenu } from "@base-ui/react/context-menu";
import { CONTEXT_MENU_ACTION_IDS } from "./context-menu-action-policy";
import { contextMenuStyles } from "./context-menu-styles";

type ArticleContextMenuViewProps = {
  toggleReadLabel: string;
  toggleStarLabel: string;
  openInBrowserLabel?: string;
  copyFeedUrlLabel?: string;
  onToggleRead: () => void;
  onToggleStar: () => void;
  onOpenInBrowser?: () => void;
  onCopyFeedUrl?: () => void;
};

export function ArticleContextMenuView({
  toggleReadLabel,
  toggleStarLabel,
  openInBrowserLabel,
  copyFeedUrlLabel,
  onToggleRead,
  onToggleStar,
  onOpenInBrowser,
  onCopyFeedUrl,
}: ArticleContextMenuViewProps) {
  const hasSecondaryActions = (onOpenInBrowser && openInBrowserLabel) || (onCopyFeedUrl && copyFeedUrlLabel);

  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner>
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
              {onCopyFeedUrl && copyFeedUrlLabel && (
                <ContextMenu.Item
                  data-action-id={CONTEXT_MENU_ACTION_IDS.articleCopyFeedUrl}
                  className={contextMenuStyles.item}
                  onClick={onCopyFeedUrl}
                >
                  {copyFeedUrlLabel}
                </ContextMenu.Item>
              )}
            </>
          )}
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
