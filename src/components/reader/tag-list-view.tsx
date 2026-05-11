import { ContextMenu } from "@base-ui/react/context-menu";
import type { ReactNode } from "react";
import { SidebarSectionToggle } from "@/components/shared/sidebar-section-toggle";
import { SIDEBAR_SELECTED_TARGET_ATTRIBUTE } from "@/lib/reader-focus";
import { cn } from "@/lib/utils";
import { useContextMenuTargetSnapshot } from "./context-menu-target";
import type { SidebarTagItem, SidebarTagItemsResult } from "./hooks/sidebar/use-sidebar-tag-items";
import { getSidebarDensityTokens, type SidebarDensity } from "./sidebar-density";
import { SidebarNavButton } from "./sidebar-nav-button";

export type SidebarTagListProps = {
  tagsLabel: string;
  emptyLabel?: string;
  isOpen: boolean;
  onToggleOpen: () => void;
  sidebarDensity?: SidebarDensity;
  tags: SidebarTagItemsResult;
  onSelectTag: (tagId: string) => void;
  renderContextMenu?: (tag: SidebarTagItem) => ReactNode;
  renderTagSectionContextMenu?: () => ReactNode;
};

export function TagListView({
  tagsLabel,
  emptyLabel,
  isOpen,
  onToggleOpen,
  sidebarDensity = "normal",
  tags,
  onSelectTag,
  renderContextMenu,
  renderTagSectionContextMenu,
}: SidebarTagListProps) {
  const tokens = getSidebarDensityTokens(sidebarDensity);
  const panelId = "sidebar-tag-section-panel";
  const isEmpty = tags.length === 0;

  return (
    <div>
      <div className="p-2">
        <SidebarSectionToggle
          label={tagsLabel}
          isOpen={isOpen}
          onToggle={onToggleOpen}
          panelId={panelId}
          contextMenu={renderTagSectionContextMenu?.()}
        />
      </div>
      <div
        id={panelId}
        data-state={isOpen ? "open" : "closed"}
        data-empty={isEmpty ? "true" : "false"}
        aria-hidden={isOpen ? "false" : "true"}
        className="motion-disclosure-panel"
      >
        <div className="motion-disclosure-body">
          <div className={cn("px-2", tokens.tagListGap)}>
            {isEmpty ? (
              emptyLabel ? (
                <p className="px-2 py-1.5 text-sm text-sidebar-foreground/65">{emptyLabel}</p>
              ) : null
            ) : (
              tags.map((tag) => (
                <TagListItem
                  key={tag.id}
                  tag={tag}
                  sidebarDensity={sidebarDensity}
                  onSelectTag={onSelectTag}
                  renderContextMenu={renderContextMenu}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type TagListItemProps = {
  tag: SidebarTagItem;
  sidebarDensity: SidebarDensity;
  onSelectTag: (tagId: string) => void;
  renderContextMenu?: (tag: SidebarTagItem) => ReactNode;
};

function TagListItem({ tag, sidebarDensity, onSelectTag, renderContextMenu }: TagListItemProps) {
  const { contextMenuTarget, captureTarget, captureKeyboardTarget, clearTarget } = useContextMenuTargetSnapshot(tag);

  return (
    <ContextMenu.Root onOpenChange={(open) => !open && clearTarget()}>
      <ContextMenu.Trigger
        render={
          <SidebarNavButton
            density={sidebarDensity}
            onClick={() => onSelectTag(tag.id)}
            selected={tag.isSelected}
            {...(tag.isSelected ? { [SIDEBAR_SELECTED_TARGET_ATTRIBUTE]: "true" } : {})}
            trailing={tag.articleCount > 0 ? tag.articleCount.toLocaleString() : undefined}
            className={!tag.isSelected ? "text-sidebar-foreground" : undefined}
          />
        }
        onContextMenu={captureTarget}
        onKeyDownCapture={captureKeyboardTarget}
      >
        <span className="flex size-5 shrink-0 items-center justify-center">
          {tag.color && <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: tag.color }} />}
        </span>
        <span className="max-w-full truncate" dir="auto" title={tag.name}>
          {tag.name}
        </span>
      </ContextMenu.Trigger>
      {renderContextMenu?.(contextMenuTarget)}
    </ContextMenu.Root>
  );
}
