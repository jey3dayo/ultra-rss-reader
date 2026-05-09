import { ContextMenu } from "@base-ui/react/context-menu";
import { contextMenuStyles } from "./context-menu-styles";

type ArticleContextMenuViewProps = {
  toggleReadLabel: string;
  toggleStarLabel: string;
  openInBrowserLabel?: string;
  onToggleRead: () => void;
  onToggleStar: () => void;
  onOpenInBrowser?: () => void;
};

export function ArticleContextMenuView({
  toggleReadLabel,
  toggleStarLabel,
  openInBrowserLabel,
  onToggleRead,
  onToggleStar,
  onOpenInBrowser,
}: ArticleContextMenuViewProps) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item
            data-action-id="article-toggle-read"
            className={contextMenuStyles.item}
            onClick={onToggleRead}
          >
            {toggleReadLabel}
          </ContextMenu.Item>
          <ContextMenu.Item
            data-action-id="article-toggle-star"
            className={contextMenuStyles.item}
            onClick={onToggleStar}
          >
            {toggleStarLabel}
          </ContextMenu.Item>
          {onOpenInBrowser && openInBrowserLabel && (
            <>
              <ContextMenu.Separator className={contextMenuStyles.separator} />
              <ContextMenu.Item
                data-action-id="article-open-browser"
                className={contextMenuStyles.item}
                onClick={onOpenInBrowser}
              >
                {openInBrowserLabel}
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
